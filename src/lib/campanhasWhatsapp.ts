import { getWhatsappSettings } from './settings'
import { sendWhatsappTextOnServer, sendWhatsappMediaOnServer } from './whatsapp-api'
import { supabase } from './supabase'
import { getCampanhaAtual, type CampanhaData } from './campanhasData'

/**
 * Converte uma URL de imagem do diretório public para string base64 Data URL no navegador ou Node.
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
 * Verifica e dispara automaticamente a notificação no grupo de WhatsApp da Campanha de Segurança do Mês.
 * Executado na virada do mês / dia 01 ou chamada forçada.
 */
export async function notificarCampanhaMesAutomatico(forcar: boolean = false): Promise<boolean> {
  try {
    const hoje = new Date()
    const mesNum = hoje.getMonth() + 1
    const anoNum = hoje.getFullYear()
    const env = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
    const syncKey = `campanha_whatsapp_${anoNum}_${mesNum}_${env}`

    // 1. Verificar se já foi disparado neste mês
    if (!forcar) {
      const { data: jaDisparado } = await supabase
        .from('global_settings')
        .select('key, value')
        .eq('key', syncKey)
        .maybeSingle()

      if (jaDisparado?.value) {
        // Já disparado este mês
        return false
      }
    }

    // 2. Configurações do WhatsApp
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

    // 3. Montar mensagem com template configurável
    let msg =
      settings.messageTemplates?.campanhaSegurancaMes ||
      '🎗️ *CAMPANHA DO MÊS: {campanha_nome} ({mes_nome})* 🎗️\n\n💡 *Conscientização:* {tema}\n\n📝 *Sobre a campanha:*\n{descricao}\n\n📢 *Mensagem:* "{frase}"\n\n_Mensagem automática de Segurança do Trabalho - Sucena / Hydro Reabilitação_'

    msg = msg.replaceAll('{mes_nome}', campanha.mes)
    msg = msg.replaceAll('{campanha_nome}', campanha.camp)
    msg = msg.replaceAll('{tema}', campanha.tema)
    msg = msg.replaceAll('{descricao}', campanha.desc)
    msg = msg.replaceAll('{frase}', campanha.frase)

    // 4. Enviar mensagem de texto principal
    await sendWhatsappTextOnServer({
      data: {
        url: settings.url,
        token: settings.token,
        instanceId: settings.instanceId,
        phone: targetGroup,
        text: msg,
      },
    })

    // 5. Enviar a imagem oficial da campanha se disponível
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
              caption: `🎨 Arte Oficial — *${campanha.camp}* (${campanha.mes})\n${campanha.tema}`,
              base64Media: base64Img,
              fileName: `campanha-${campanha.mes.toLowerCase()}.png`,
            },
          })
        }
      } catch (mediaErr) {
        console.warn('[Campanhas WhatsApp] Erro ao enviar imagem da campanha:', mediaErr)
      }
    }

    // 6. Registrar que já foi enviado no banco
    const registroDisparo = {
      enviadoEm: new Date().toISOString(),
      mes: mesNum,
      mesNome: campanha.mes,
      ano: anoNum,
      campanha: campanha.camp,
    }

    try {
      const { data: existe } = await supabase
        .from('global_settings')
        .select('key')
        .eq('key', syncKey)
        .maybeSingle()

      if (existe?.key) {
        await supabase.from('global_settings').update({ value: registroDisparo }).eq('key', syncKey)
      } else {
        await supabase.from('global_settings').insert({ key: syncKey, value: registroDisparo })
      }
    } catch (_) {}

    // 7. Registrar em system_activities
    try {
      await supabase.from('system_activities').insert({
        module: 'Segurança',
        action: `Campanha do Mês enviada ao WhatsApp: ${campanha.camp} (${campanha.mes})`,
        user_name: 'Sistema Automático',
        environment: env,
      })
    } catch (_) {}

    console.info(`[Campanhas WhatsApp] Notificação do mês ${campanha.mes} enviada com sucesso!`)
    return true
  } catch (err) {
    console.warn('[Campanhas WhatsApp] Falha ao enviar campanha do mês:', err)
    return false
  }
}

