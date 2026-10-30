import { getWhatsappSettings } from './settings'
import { sendWhatsappTextOnServer, sendWhatsappMediaOnServer } from './whatsapp-api'
import { supabase } from './supabase'

export interface DesvioNotificacaoData {
  uid: string
  titulo: string
  descricao: string
  local: string
  area?: string
  categoria: string
  prioridade: string
  risco: string
  gravidade: string
  tecnico: string
  respCorrecao?: string
  empresa?: string
  previsao: string
  sugestao?: string
}

function formatarDataBr(iso?: string): string {
  if (!iso) return '—'
  const p = iso.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso
}

/**
 * Dispara notificação no grupo do WhatsApp ao abrir/salvar um novo Desvio de Segurança.
 * Inclui todos os detalhes (responsáveis, data limite, risco, categoria) e fotos anexadas.
 */
export async function notificarDesvioRegistrado(
  desvio: DesvioNotificacaoData,
  fotos: string[] = []
) {
  try {
    const settings = await getWhatsappSettings()

    if (settings.desviosSeguranca?.enabled === false) {
      console.info('[Desvios Segurança] Notificação desativada nas configurações do WhatsApp.')
      return
    }

    const targetGroup = settings.desviosSeguranca?.specificGroupId || settings.groupId
    if (!targetGroup || !settings.url || !settings.token) {
      console.warn('[Desvios Segurança] WhatsApp não configurado para envio de desvios.')
      return
    }

    let msg =
      settings.messageTemplates?.desvioRegistrado ||
      '⚠️ *NOVO DESVIO DE SEGURANÇA REGISTRADO* ⚠️\n\n📌 *Título:* {titulo}\n📝 *Descrição:* {descricao}\n🚨 *Prioridade:* {prioridade}\n⚠️ *Risco:* {risco} ({gravidade})\n📂 *Categoria:* {categoria}\n📍 *Local:* {local} {area}\n\n👷 *Técnico Responsável:* {tecnico}\n👥 *Pessoas Responsáveis:* {responsaveis}\n🏢 *Empresa/Equipe:* {empresa}\n⏰ *Data Limite para Correção:* {previsao}\n\n💡 *Instrução / Sugestão:* {sugestao}\n\n_Mensagem automática - Sucena Segurança_'

    msg = msg.replaceAll('{titulo}', desvio.titulo || 'Desvio de Segurança')
    msg = msg.replaceAll('{descricao}', desvio.descricao || 'Sem descrição')
    msg = msg.replaceAll('{prioridade}', desvio.prioridade || 'Média')
    msg = msg.replaceAll('{risco}', desvio.risco || 'Geral')
    msg = msg.replaceAll('{gravidade}', desvio.gravidade || 'Média')
    msg = msg.replaceAll('{categoria}', desvio.categoria || 'Geral')
    msg = msg.replaceAll('{local}', desvio.local || 'Canteiro')
    msg = msg.replaceAll('{area}', desvio.area ? `(${desvio.area})` : '')
    msg = msg.replaceAll('{tecnico}', desvio.tecnico || 'Técnico de Segurança')
    msg = msg.replaceAll('{responsaveis}', desvio.respCorrecao || 'A definir')
    msg = msg.replaceAll('{empresa}', desvio.empresa || 'Própria')
    msg = msg.replaceAll('{previsao}', formatarDataBr(desvio.previsao))
    msg = msg.replaceAll('{sugestao}', desvio.sugestao || 'Nenhuma instrução específica informada')

    // 1. Enviar mensagem de texto principal
    await sendWhatsappTextOnServer({
      data: {
        url: settings.url,
        token: settings.token,
        instanceId: settings.instanceId,
        phone: targetGroup,
        text: msg,
      },
    })

    // 2. Enviar fotos anexadas (suporte a mais de uma foto)
    const fotosValidas = (fotos || []).filter((f) => f && f.startsWith('data:image'))
    for (let i = 0; i < fotosValidas.length; i++) {
      const f = fotosValidas[i]
      try {
        await sendWhatsappMediaOnServer({
          data: {
            url: settings.url,
            token: settings.token,
            instanceId: settings.instanceId,
            phone: targetGroup,
            caption: `📷 Foto do Desvio: *${desvio.titulo}* (${i + 1}/${fotosValidas.length})`,
            base64Media: f,
            fileName: `desvio-${desvio.uid}-${i + 1}.jpg`,
          },
        })
      } catch (mediaErr) {
        console.warn(`[Desvios WhatsApp] Erro ao enviar foto ${i + 1}:`, mediaErr)
      }
    }

    // Registrar no histórico de atividades
    try {
      const env = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
      await supabase.from('system_activities').insert({
        module: 'Segurança',
        action: `Desvio de Segurança enviado ao grupo WhatsApp: "${desvio.titulo}" (${fotosValidas.length} foto(s))`,
        user_name: desvio.tecnico || 'Segurança',
        environment: env,
      })
    } catch (_) {}
  } catch (err) {
    console.warn('[Desvios Segurança] Falha ao enviar notificação WhatsApp:', err)
  }
}

