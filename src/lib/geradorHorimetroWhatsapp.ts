import { getWhatsappSettings } from './settings'
import { sendWhatsappTextOnServer } from './whatsapp-api'
import { supabase } from './supabase'

export interface GeradorWhatsappAlertParams {
  eqName: string
  plateTag: string
  currentHorimeter: number
  nextMaintenanceHorimeter: number
  remainingHours: number
  userName?: string
  force?: boolean
}

/**
 * Dispara notificação no grupo do WhatsApp configurado quando faltarem 20 horas (ou menos)
 * para o horímetro de manutenção do gerador, ou se já estiver vencido.
 */
export async function notificarGeradorHorimetroManutencao(
  params: GeradorWhatsappAlertParams
): Promise<boolean> {
  try {
    const env =
      typeof window !== 'undefined'
        ? localStorage.getItem('sucena_environment') || 'barcarena'
        : 'barcarena'

    const settings = await getWhatsappSettings(env)

    if (settings.geradorManutencao?.enabled === false && !params.force) {
      console.info('[Gerador WhatsApp] Envio de alerta de horímetro desativado nas configurações.')
      return false
    }

    const targetGroup = settings.geradorManutencao?.specificGroupId || settings.groupId
    if (!targetGroup || !settings.url || !settings.token) {
      console.warn('[Gerador WhatsApp] WhatsApp não configurado para envio de mensagens.')
      return false
    }

    let msg =
      settings.messageTemplates?.geradorHorimetroManutencao ||
      "⚡ *ALERTA: MANUTENÇÃO PREVENTIVA DO GERADOR* ⚡\n\n🚜 *Equipamento:* {equipamento}\n🏷️ *TAG / Placa:* {tag}\n⏱️ *Horímetro Atual:* {horimetro_atual} h\n🔧 *Próxima Manutenção:* {proximo_horimetro} h\n⏳ *Horas Restantes:* {horas_restantes} h\n📅 *Data / Hora:* {data_hora}\n👤 *Atualizado por:* {responsavel}\n\n⚠️ *Atenção:* Restam apenas {horas_restantes} horas para o horímetro de manutenção do gerador! Programar a manutenção preventiva com antecedência para evitar paradas operacionais.\n\n_Mensagem automática - Sucena / Gestão de Equipamentos_"

    const now = new Date()
    const dataHoraFormatada = now.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    const horasRestantesText =
      params.remainingHours <= 0
        ? `⚠️ VENCIDO HÁ ${Math.abs(params.remainingHours)}h`
        : `${params.remainingHours}`

    msg = msg.replaceAll('{equipamento}', params.eqName || 'GERADOR')
    msg = msg.replaceAll('{tag}', params.plateTag || 'E9A4808')
    msg = msg.replaceAll('{horimetro_atual}', String(params.currentHorimeter))
    msg = msg.replaceAll('{proximo_horimetro}', String(params.nextMaintenanceHorimeter))
    msg = msg.replaceAll('{horas_restantes}', horasRestantesText)
    msg = msg.replaceAll('{data_hora}', dataHoraFormatada)
    msg = msg.replaceAll('{responsavel}', params.userName || 'Sistema')

    await sendWhatsappTextOnServer({
      data: {
        url: settings.url,
        token: settings.token,
        instanceId: settings.instanceId,
        phone: targetGroup,
        text: msg
      }
    })

    await supabase.from('system_activities').insert({
      module: 'Equipamentos',
      action: `[WHATSAPP GERADOR] Horímetro: ${params.currentHorimeter}h / Manutenção: ${params.nextMaintenanceHorimeter}h (Faltam ${params.remainingHours}h) - Enviado para ${targetGroup}`,
      user_name: params.userName || 'Sistema'
    })

    return true
  } catch (error) {
    console.error('[Gerador WhatsApp] Erro ao enviar mensagem no WhatsApp:', error)
    return false
  }
}
