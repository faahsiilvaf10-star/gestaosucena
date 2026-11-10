import { getWhatsappSettings, WHATSAPP_DEFAULT_GROUPS } from './settings'
import { queueWhatsappMessage } from './offline-sync'
import { getBrokenReasonLabel } from './equipamentos/equipmentTypes'

export interface EquipamentoQuebradoNotificationParams {
  equipment: {
    id?: string
    name: string
    plate_tag?: string | null
    category?: string | null
  }
  brokenReason: string
  description?: string | null
  actionDateTime: string | Date
  userName: string
}

export interface EquipamentoEmprestadoNotificationParams {
  equipment: {
    id?: string
    name: string
    plate_tag?: string | null
    category?: string | null
  }
  company: string
  description?: string | null
  actionDateTime: string | Date
  userName: string
}

/**
 * Formata a data/hora no padrão amigável pt-BR
 */
function formatDataHora(actionDateTime: string | Date): string {
  try {
    const d = new Date(actionDateTime)
    if (isNaN(d.getTime())) return new Date().toLocaleString('pt-BR')
    const dataStr = d.toLocaleDateString('pt-BR')
    const horaStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return `${dataStr} às ${horaStr}`
  } catch {
    return String(actionDateTime)
  }
}

/**
 * Envia notificação automática de equipamento marcado como quebrado para o grupo de Avisos no WhatsApp.
 */
export async function notificarEquipamentoQuebrado(
  params: EquipamentoQuebradoNotificationParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const whatsappSettings = await getWhatsappSettings()

    // Verificar se envio para quebrado está habilitado (padrão true se não definido)
    if (whatsappSettings.equipamentosStatusAlerts?.enabled_quebrado === false) {
      return { success: false, error: 'Notificação de equipamento quebrado desativada nas configurações.' }
    }

    const targetGroupId =
      whatsappSettings.equipamentosStatusAlerts?.specificGroupId?.trim() ||
      whatsappSettings.reminders?.specificGroupId?.trim() ||
      WHATSAPP_DEFAULT_GROUPS.AVISOS

    if (!targetGroupId) {
      return { success: false, error: 'Nenhum grupo de avisos configurado.' }
    }

    const template =
      whatsappSettings.messageTemplates?.equipamentoQuebrado ||
      '🚨 *ALERTA: EQUIPAMENTO MARCADO COMO QUEBRADO* 🚨\n\n🚜 *Equipamento:* {equipamento}\n🏷️ *Tag / Identificação:* {tag}\n📂 *Categoria:* {categoria}\n⚠️ *Motivo do Defeito:* {motivo}\n📅 *Data e Hora:* {data_hora}\n👤 *Registrado por:* {responsavel}\n📝 *Observações:* {observacoes}\n\n⚠️ _Equipamento paralisado. Não contará no RDO principal até ser regularizado._\n_Mensagem automática - Sucena / Gestão Operacional_'

    const eqName = params.equipment.name || 'Equipamento'
    const eqTag = params.equipment.plate_tag ? params.equipment.plate_tag.toUpperCase() : 'S/ Tag'
    const eqCategory = params.equipment.category || 'Geral'
    const motivo = getBrokenReasonLabel(params.brokenReason)
    const dataHora = formatDataHora(params.actionDateTime)
    const responsavel = params.userName || 'Sistema'
    const observacoes = params.description?.trim() ? params.description.trim() : 'Nenhuma observação informada'

    let message = template
      .replaceAll('{equipamento}', eqName)
      .replaceAll('{tag}', eqTag)
      .replaceAll('{categoria}', eqCategory)
      .replaceAll('{motivo}', motivo)
      .replaceAll('{data_hora}', dataHora)
      .replaceAll('{responsavel}', responsavel)
      .replaceAll('{observacoes}', observacoes)

    const result = await queueWhatsappMessage(whatsappSettings, targetGroupId, message)
    return { success: result?.success ?? true }
  } catch (err: any) {
    console.error('[WhatsApp] Falha ao disparar alerta de equipamento quebrado:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

/**
 * Envia notificação automática de equipamento emprestado para o grupo de Avisos no WhatsApp.
 */
export async function notificarEquipamentoEmprestado(
  params: EquipamentoEmprestadoNotificationParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const whatsappSettings = await getWhatsappSettings()

    // Verificar se envio para emprestado está habilitado (padrão true se não definido)
    if (whatsappSettings.equipamentosStatusAlerts?.enabled_emprestado === false) {
      return { success: false, error: 'Notificação de equipamento emprestado desativada nas configurações.' }
    }

    const targetGroupId =
      whatsappSettings.equipamentosStatusAlerts?.specificGroupId?.trim() ||
      whatsappSettings.reminders?.specificGroupId?.trim() ||
      WHATSAPP_DEFAULT_GROUPS.AVISOS

    if (!targetGroupId) {
      return { success: false, error: 'Nenhum grupo de avisos configurado.' }
    }

    const template =
      whatsappSettings.messageTemplates?.equipamentoEmprestado ||
      '🤝 *AVISO: EQUIPAMENTO EMPRESTADO* 🤝\n\n🚜 *Equipamento:* {equipamento}\n🏷️ *Tag / Identificação:* {tag}\n📂 *Categoria:* {categoria}\n🏢 *Empresa Destino:* {empresa}\n📅 *Data e Hora do Empréstimo:* {data_hora}\n👤 *Registrado por:* {responsavel}\n📝 *Observações:* {observacoes}\n\nℹ️ _Equipamento cedido temporariamente à empresa informada._\n_Mensagem automática - Sucena / Gestão Operacional_'

    const eqName = params.equipment.name || 'Equipamento'
    const eqTag = params.equipment.plate_tag ? params.equipment.plate_tag.toUpperCase() : 'S/ Tag'
    const eqCategory = params.equipment.category || 'Geral'
    const empresa = params.company?.trim() || 'Empresa parceira'
    const dataHora = formatDataHora(params.actionDateTime)
    const responsavel = params.userName || 'Sistema'
    const observacoes = params.description?.trim() ? params.description.trim() : 'Nenhuma observação informada'

    let message = template
      .replaceAll('{equipamento}', eqName)
      .replaceAll('{tag}', eqTag)
      .replaceAll('{categoria}', eqCategory)
      .replaceAll('{empresa}', empresa)
      .replaceAll('{data_hora}', dataHora)
      .replaceAll('{responsavel}', responsavel)
      .replaceAll('{observacoes}', observacoes)

    const result = await queueWhatsappMessage(whatsappSettings, targetGroupId, message)
    return { success: result?.success ?? true }
  } catch (err: any) {
    console.error('[WhatsApp] Falha ao disparar alerta de equipamento emprestado:', err)
    return { success: false, error: err?.message || String(err) }
  }
}
