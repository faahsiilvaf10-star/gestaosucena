import { getWhatsappSettings } from './settings'
import { sendWhatsappTextOnServer } from './whatsapp-api'
import { toast } from 'sonner'

const EXIT_REASONS_MAP: Record<string, string> = {
  preventive_maintenance: 'Manutenção Preventiva',
  corrective_maintenance: 'Manutenção Corretiva',
  inspection: 'Vistoria',
  external_service: 'Serviço Externo',
  other: 'Outro'
}

export async function sendEntryExitWhatsappNotification(
  type: 'entry' | 'exit',
  equipment: { name: string; id: string; plate_tag?: string },
  actionDateTime: string | Date,
  exitReasonRaw?: string | null,
  exitDescription?: string | null
) {
  try {
    const whatsappSettings = await getWhatsappSettings()
    if (!whatsappSettings?.equipamentosMovimentacao?.enabled) return

    const number = whatsappSettings.equipamentosMovimentacao.specificGroupId || whatsappSettings.groupId
    if (!number) return

    const d = new Date(actionDateTime)
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' de ' + d.toLocaleDateString('pt-BR')

    let msg = ''
    if (type === 'entry') {
      msg = whatsappSettings.messageTemplates?.equipamentoEntrada || '🚜 *ENTRADA DE EQUIPAMENTO*\n\n⏰ *Hora:* {hora}\n🚜 *Equipamento:* {equipamento}\n🚙 *Placa:* {placa}\n\n_Mensagem automática - Sucena_'
    } else {
      msg = whatsappSettings.messageTemplates?.equipamentoSaida || '🚜 *SAÍDA DE EQUIPAMENTO*\n\n⏰ *Hora:* {hora}\n🚜 *Equipamento:* {equipamento}\n🚙 *Placa:* {placa}\n\n⚠️ *Motivo:* {motivo}\n\n_Mensagem automática - Sucena_'
    }

    msg = msg.replace('{hora}', hora)
    msg = msg.replace('{equipamento}', equipment.name)
    msg = msg.replace('{placa}', equipment.plate_tag || 'N/A')
    msg = msg.replace('{tag}', equipment.id.substring(0, 8).toUpperCase())

    if (type === 'exit') {
      const reasonLabel = (exitReasonRaw && EXIT_REASONS_MAP[exitReasonRaw]) || exitReasonRaw || 'Não informado'
      const motivoText = exitDescription?.trim() ? `${reasonLabel} - ${exitDescription.trim()}` : reasonLabel
      msg = msg.replace('{motivo}', motivoText)
    }

    try {
      await sendWhatsappTextOnServer({
        data: {
          url: whatsappSettings.url,
          instanceId: whatsappSettings.instanceId,
          token: whatsappSettings.token,
          phone: number,
          text: msg
        }
      })
    } catch (serverErr) {
      console.warn("ServerFn failed, attempting direct fetch fallback...", serverErr);
      
      let baseUrl = whatsappSettings.url.trim()
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)
      if (baseUrl.includes('painel.w-api.app')) baseUrl = 'https://api.w-api.app/v1'
      else if (baseUrl.includes('api.w-api.app') && !baseUrl.includes('/v1')) baseUrl = baseUrl + '/v1'

      const endpoint = `${baseUrl}/messages/send-text?instanceId=${whatsappSettings.instanceId}`
      const payload = { number, phone: number, text: msg, message: msg }
      
      let res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${whatsappSettings.token}`,
          'apikey': whatsappSettings.token
        },
        body: JSON.stringify(payload)
      })
      if (res.status === 404) {
        const fallback = endpoint.includes('/message/') ? endpoint.replace('/message/', '/messages/') : endpoint.replace('/messages/', '/message/');
        res = await fetch(fallback, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${whatsappSettings.token}`, 'apikey': whatsappSettings.token }, body: JSON.stringify(payload) });
      }
      if (!res.ok) throw new Error("Direct fetch failed: " + await res.text())
    }
  } catch (error: any) {
    console.error('Error sending Entry/Exit WhatsApp Notification:', error)
    toast.error('Erro no WhatsApp: ' + (error?.message || String(error)))
  }
}
