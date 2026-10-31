import { getWhatsappSettings } from './settings'
import { sendWhatsappTextOnServer } from './whatsapp-api'
import { supabase } from './supabase'

export function fmtDataBr(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const [y, m, d] = dateStr.split('-')
  if (!y || !m || !d) return dateStr
  return `${d}/${m}/${y}`
}

/**
 * Dispara notificação no grupo do WhatsApp quando uma vistoria/laudo de equipamento estiver vencendo em 20 dias
 */
export async function notificarVistoriaEquipamento20Dias(params: {
  eqName: string
  plateTag: string
  docType: string
  expiryDate: string
  daysRemaining: number
}): Promise<boolean> {
  try {
    const settings = await getWhatsappSettings()

    if (settings.vistoriasEquipamentos?.enabled_20_dias === false) {
      console.info('[Vistoria WhatsApp] Alerta de 20 dias desativado nas configurações.')
      return false
    }

    const targetGroup = settings.vistoriasEquipamentos?.specificGroupId || settings.groupId
    if (!targetGroup || !settings.url || !settings.token) {
      console.warn('[Vistoria WhatsApp] WhatsApp não configurado para envio.')
      return false
    }

    let msg =
      settings.messageTemplates?.vistoriaEquipamentoVencendo20Dias ||
      "⏳ *AVISO: VISTORIA DE EQUIPAMENTO VENCENDO EM 20 DIAS* ⏳\n\n🚜 *Equipamento:* {equipamento}\n🏷️ *Placa / TAG:* {placa_tag}\n📋 *Tipo de Vistoria / Laudo:* {tipo_vistoria}\n📅 *Data de Vencimento:* {data_vencimento}\n⏳ *Prazo Restante:* Faltam {dias_restantes} dia(s) para o vencimento!\n\n⚠️ _Por favor, providencie a renovação do laudo/manutenção com antecedência para evitar paralisação do equipamento na obra._\n_Mensagem automática - Sucena / Hydro Reabilitação_"

    msg = msg.replaceAll('{equipamento}', params.eqName || 'Equipamento')
    msg = msg.replaceAll('{placa_tag}', params.plateTag || '-')
    msg = msg.replaceAll('{tipo_vistoria}', params.docType || 'Vistoria Geral')
    msg = msg.replaceAll('{data_vencimento}', fmtDataBr(params.expiryDate))
    msg = msg.replaceAll('{dias_restantes}', String(params.daysRemaining))

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
      module: 'Equipamentos',
      action: `[WHATSAPP 20 DIAS] Vistoria ${params.docType} de ${params.eqName} (${params.plateTag}) vence em ${params.daysRemaining} dias (${fmtDataBr(params.expiryDate)})`,
      user_name: 'Sistema Automático',
      environment: env,
    })

    return true
  } catch (err) {
    console.error('[Vistoria WhatsApp] Erro ao notificar 20 dias:', err)
    return false
  }
}
