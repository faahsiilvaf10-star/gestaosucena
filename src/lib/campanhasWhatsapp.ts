import { getWhatsappSettings } from './settings'
import { sendWhatsappTextOnServer, sendWhatsappMediaOnServer } from './whatsapp-api'
import { supabase } from './supabase'
import { getCampanhaAtual, type CampanhaData } from './campanhasData'

// Mutex em memória para impedir execuções simultâneas
let isDispatchingCampanha = false

/**
 * Converte uma URL de imagem do diretório public para string base64 Data URL no navegador.
 */
async function carregarImagemComoBase64(urlPath: string): Promise<string | null> {
  try {
    if (typeof window !== 'undefined') {
      const resp = await fetch(urlPath)
      if (!resp.ok) return null
      const blob = await resp.blob()
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
      })
    }
    return null
  } catch (err) {
    console.warn('[Campanhas WhatsApp] Erro ao converter imagem em base64:', err)
    return null
  }
}

/**
 * Verifica e dispara a notificação no grupo de WhatsApp da Campanha de Segurança do Mês.
 * GARANTIA: Envia EXATAMENTE UMA ÚNICA VEZ por mês (a foto com a legenda completa na mesma mensagem).
 * Possui travas em 3 níveis (Memória, LocalStorage síncrono e Reserva no Supabase).
 */
export async function notificarCampanhaMesAutomatico(forcar: boolean = false): Promise<boolean> {
  // Trava 1: Mutex em memória
  if (isDispatchingCampanha) {
    console.info('[Campanhas WhatsApp] Disparo já em andamento. Ignorando chamada concorrente.')
    return false
  }

  const hoje = new Date()
  const mesNum = hoje.getMonth() + 1
  const anoNum = hoje.getFullYear()
  const env = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
  const syncKey = `campanha_whatsapp_${anoNum}_${mesNum}_${env}`
  const localLockKey = `campanha_whatsapp_sent_${anoNum}_${mesNum}_${env}`

  // Trava 2: Verificação síncrona no LocalStorage
  if (!forcar && typeof window !== 'undefined') {
    const jaEnviadoLocal = localStorage.getItem(localLockKey)
    if (jaEnviadoLocal) {
      return false
    }
  }

  isDispatchingCampanha = true

  try {
    // Trava 3: Verificação no Supabase
    if (!forcar) {
      const { data: jaDisparado } = await supabase
        .from('global_settings')
        .select('key, value')
        .eq('key', syncKey)
        .maybeSingle()

      if (jaDisparado?.value && (jaDisparado.value.enviadoEm || jaDisparado.value.emProcessamento)) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(localLockKey, 'true')
        }
        return false
      }

      // Reserva no Supabase imediatamente para bloquear outras abas
      try {
        await supabase.from('global_settings').upsert({
          key: syncKey,
          value: { emProcessamento: true, iniciadoEm: new Date().toISOString() },
        })
      } catch (_) {}
    }

    // Configurações do WhatsApp
    const settings = await getWhatsappSettings()
    if (settings.campanhasSeguranca?.enabled === false) {
      console.info('[Campanhas WhatsApp] Notificação mensal desativada nas configurações.')
      return false
    }

    const targetGroup = settings.campanhasSeguranca?.specificGroupId || settings.groupId
    if (!targetGroup || !settings.url || !settings.token) {
      console.warn('[Campanhas WhatsApp] WhatsApp não configurado (URL/Token/Grupo ausentes).')
      return false
    }

    const campanha: CampanhaData = getCampanhaAtual()

    // Montar mensagem com template configurável
    let msg =
      settings.messageTemplates?.campanhaSegurancaMes ||
      '🎗️ *CAMPANHA DO MÊS: {campanha_nome} ({mes_nome})* 🎗️\n\n💡 *Conscientização:* {tema}\n\n📝 *Sobre a campanha:*\n{descricao}\n\n📢 *Mensagem:* "{frase}"\n\n_Mensagem automática de Segurança do Trabalho - Sucena / Hydro Reabilitação_'

    msg = msg.replaceAll('{mes_nome}', campanha.mes)
    msg = msg.replaceAll('{campanha_nome}', campanha.camp)
    msg = msg.replaceAll('{tema}', campanha.tema)
    msg = msg.replaceAll('{descricao}', campanha.desc)
    msg = msg.replaceAll('{frase}', campanha.frase)

    // Se houver imagem oficial, carrega e envia em UMA ÚNICA MENSAGEM (Foto + Legenda completa)
    let enviouComFoto = false
    if (campanha.imagem) {
      try {
        const base64Img = await carregarImagemComoBase64(campanha.imagem)
        if (base64Img) {
          await sendWhatsappMediaOnServer({
            data: {
              url: settings.url,
              token: settings.token,
              instanceId: settings.instanceId,
              phone: targetGroup,
              caption: msg, // Todo o texto vai como legenda da foto (uma única mensagem)
              base64Media: base64Img,
              fileName: `campanha-${campanha.mes.toLowerCase()}.png`,
            },
          })
          enviouComFoto = true
        }
      } catch (mediaErr) {
        console.warn('[Campanhas WhatsApp] Falha ao enviar foto com legenda, tentando texto:', mediaErr)
      }
    }

    // Se não tiver imagem ou se o envio da mídia falhou, envia mensagem única de texto
    if (!enviouComFoto) {
      await sendWhatsappTextOnServer({
        data: {
          url: settings.url,
          token: settings.token,
          instanceId: settings.instanceId,
          phone: targetGroup,
          text: msg,
        },
      })
    }

    // Registrar no LocalStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(localLockKey, 'true')
    }

    // Registrar no Supabase que foi enviado com sucesso
    const registroDisparo = {
      enviadoEm: new Date().toISOString(),
      mes: mesNum,
      mesNome: campanha.mes,
      ano: anoNum,
      campanha: campanha.camp,
      comFoto: enviouComFoto,
    }

    try {
      await supabase.from('global_settings').upsert({
        key: syncKey,
        value: registroDisparo,
      })
    } catch (_) {}

    // Registrar no histórico de atividades
    try {
      await supabase.from('system_activities').insert({
        module: 'Segurança',
        action: `Campanha do Mês enviada ao WhatsApp: ${campanha.camp} (${campanha.mes})`,
        user_name: 'Sistema Automático',
        environment: env,
      })
    } catch (_) {}

    console.info(`[Campanhas WhatsApp] Notificação única do mês ${campanha.mes} enviada com sucesso!`)
    return true
  } catch (err) {
    console.warn('[Campanhas WhatsApp] Falha ao enviar campanha do mês:', err)
    // Limpar trava local para permitir retentativa se falhou
    if (typeof window !== 'undefined') {
      localStorage.removeItem(localLockKey)
    }
    return false
  } finally {
    isDispatchingCampanha = false
  }
}
