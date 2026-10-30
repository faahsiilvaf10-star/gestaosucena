import { getWhatsappSettings } from './settings'
import { sendWhatsappTextOnServer } from './whatsapp-api'
import { supabase } from './supabase'
import { type AnaliseRiscoItem, fmtValidade } from './analiseRiscoData'

/**
 * Dispara notificação no grupo do WhatsApp quando a Análise de Risco estiver faltando 5 dias para vencer
 */
export async function notificarAnaliseRiscoVencendo5Dias(item: AnaliseRiscoItem): Promise<boolean> {
  try {
    const settings = await getWhatsappSettings()

    if (settings.analiseRisco?.enabled_5_dias === false) {
      console.info('[Análise Risco WhatsApp] Alerta de 5 dias desativado nas configurações.')
      return false
    }

    const targetGroup = settings.analiseRisco?.specificGroupId || settings.groupId
    if (!targetGroup || !settings.url || !settings.token) {
      console.warn('[Análise Risco WhatsApp] WhatsApp não configurado para envio.')
      return false
    }

    let msg =
      settings.messageTemplates?.analiseRiscoVencendo5Dias ||
      '⏳ *AVISO: ANÁLISE DE RISCO VENCENDO EM 5 DIAS* ⏳\n\n📋 *Título:* {titulo}\n📍 *Atividade / Local:* {local}\n📅 *Válida até:* {data_validade}\n⏳ *Prazo:* Faltam 5 dias para o vencimento!\n\n⚠️ _Por favor, providencie a elaboração da nova Análise de Risco com antecedência._\n_Mensagem automática - Sucena / Hydro Reabilitação_'

    msg = msg.replaceAll('{titulo}', item.titulo || item.nome || 'Análise de Risco')
    msg = msg.replaceAll('{local}', item.atividadeLocal || 'Não informado / Geral')
    msg = msg.replaceAll('{data_validade}', fmtValidade(item.validaAte) || 'A definir')
    msg = msg.replaceAll('{dias_restantes}', '5')

    await sendWhatsappTextOnServer({
      data: {
        url: settings.url,
        token: settings.token,
        instanceId: settings.instanceId,
        phone: targetGroup,
        text: msg,
      },
    })

    const env = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
    await supabase.from('system_activities').insert({
      module: 'Segurança',
      action: `[WHATSAPP 5 DIAS] Análise de Risco "${item.titulo}" vence em 5 dias (${fmtValidade(item.validaAte)})`,
      user_name: 'Sistema Automático',
      environment: env,
    })

    return true
  } catch (err) {
    console.error('[Análise Risco WhatsApp] Erro ao notificar 5 dias:', err)
    return false
  }
}

/**
 * Dispara notificação no grupo do WhatsApp no dia em que a Análise de Risco vence
 */
export async function notificarAnaliseRiscoVencendoHoje(item: AnaliseRiscoItem): Promise<boolean> {
  try {
    const settings = await getWhatsappSettings()

    if (settings.analiseRisco?.enabled_dia_vencimento === false) {
      console.info('[Análise Risco WhatsApp] Alerta no dia do vencimento desativado nas configurações.')
      return false
    }

    const targetGroup = settings.analiseRisco?.specificGroupId || settings.groupId
    if (!targetGroup || !settings.url || !settings.token) {
      console.warn('[Análise Risco WhatsApp] WhatsApp não configurado para envio.')
      return false
    }

    let msg =
      settings.messageTemplates?.analiseRiscoVencendoHoje ||
      '🚨 *ATENÇÃO: ANÁLISE DE RISCO VENCE HOJE* 🚨\n\n📋 *Título:* {titulo}\n📍 *Atividade / Local:* {local}\n📅 *Data de Vencimento:* {data_validade} (HOJE)\n\n⚠️ _A validade desta Análise de Risco expira hoje. O Técnico de Segurança deve emitir a nova análise e fechar a anterior._\n_Mensagem automática - Sucena / Hydro Reabilitação_'

    msg = msg.replaceAll('{titulo}', item.titulo || item.nome || 'Análise de Risco')
    msg = msg.replaceAll('{local}', item.atividadeLocal || 'Não informado / Geral')
    msg = msg.replaceAll('{data_validade}', fmtValidade(item.validaAte) || 'Hoje')

    await sendWhatsappTextOnServer({
      data: {
        url: settings.url,
        token: settings.token,
        instanceId: settings.instanceId,
        phone: targetGroup,
        text: msg,
      },
    })

    const env = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
    await supabase.from('system_activities').insert({
      module: 'Segurança',
      action: `[WHATSAPP HOJE] Análise de Risco "${item.titulo}" vence hoje (${fmtValidade(item.validaAte)})`,
      user_name: 'Sistema Automático',
      environment: env,
    })

    return true
  } catch (err) {
    console.error('[Análise Risco WhatsApp] Erro ao notificar vencimento hoje:', err)
    return false
  }
}
