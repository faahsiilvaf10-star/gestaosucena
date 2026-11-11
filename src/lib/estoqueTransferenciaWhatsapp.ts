import { getWhatsappSettings, WHATSAPP_DEFAULT_GROUPS } from './settings'
import { queueWhatsappMessage } from './offline-sync'
import { getEnvironmentLabel } from './environmentAccess'

export interface EstoqueTransferenciaNotificationParams {
  product: {
    name: string
    internal_code?: string | null
    category_name?: string | null
    unit_of_measure?: string | null
  }
  quantity: number
  originEnv: string
  destinationEnv: string
  originRemainingQty: number
  destinationNewQty: number
  userName: string
  observations?: string | null
  actionDateTime?: string | Date
}

function formatDataHora(actionDateTime?: string | Date): string {
  try {
    const d = actionDateTime ? new Date(actionDateTime) : new Date()
    if (isNaN(d.getTime())) return new Date().toLocaleString('pt-BR')
    const dataStr = d.toLocaleDateString('pt-BR')
    const horaStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return `${dataStr} às ${horaStr}`
  } catch {
    return new Date().toLocaleString('pt-BR')
  }
}

/**
 * Envia notificação automática de transferência de estoque entre contratos/ambientes
 * para o grupo de Estoque no WhatsApp.
 */
export async function notificarTransferenciaEstoque(
  params: EstoqueTransferenciaNotificationParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const whatsappSettings = await getWhatsappSettings()

    // Verificar se envio está habilitado (padrão true se não definido)
    if (whatsappSettings.estoqueTransferencia?.enabled === false) {
      return { success: false, error: 'Notificação de transferência de estoque desativada nas configurações.' }
    }

    const targetGroupId =
      whatsappSettings.estoqueTransferencia?.specificGroupId?.trim() ||
      whatsappSettings.requisitionAlerts?.specificGroupId?.trim() ||
      WHATSAPP_DEFAULT_GROUPS.ESTOQUE

    if (!targetGroupId) {
      return { success: false, error: 'Nenhum grupo de estoque configurado.' }
    }

    const template =
      whatsappSettings.messageTemplates?.estoqueTransferencia ||
      '🔄 *TRANSFERÊNCIA DE ESTOQUE ENTRE AMBIENTES* 🔄\n\n📦 *Produto:* {produto}\n🏷️ *Código:* {codigo}\n📂 *Categoria:* {categoria}\n🔢 *Quantidade Transferida:* {quantidade} {unidade}\n\n📤 *Origem:* {ambiente_origem}\n📥 *Destino:* {ambiente_destino}\n\n📊 *Saldos Atualizados:*\n• Saldo restante na Origem: {saldo_origem} {unidade}\n• Novo saldo no Destino: {saldo_destino} {unidade}\n\n📅 *Data e Hora:* {data_hora}\n👤 *Responsável:* {responsavel}\n📝 *Observações:* {observacoes}\n\n_Mensagem automática - Sucena Almoxarifado / Estoque_'

    const prodName = params.product.name || 'Item'
    const prodCode = params.product.internal_code || 'S/ Código'
    const prodCategory = params.product.category_name || 'Almoxarifado'
    const prodUnit = params.product.unit_of_measure || 'UN'
    const qtd = params.quantity
    const origemNome = getEnvironmentLabel(params.originEnv)
    const destinoNome = getEnvironmentLabel(params.destinationEnv)
    const saldoOrigem = params.originRemainingQty
    const saldoDestino = params.destinationNewQty
    const dataHora = formatDataHora(params.actionDateTime)
    const responsavel = params.userName || 'Almoxarifado'
    const observacoes = params.observations?.trim() ? params.observations.trim() : 'Nenhuma observação informada'

    const message = template
      .replaceAll('{produto}', prodName)
      .replaceAll('{codigo}', prodCode)
      .replaceAll('{categoria}', prodCategory)
      .replaceAll('{quantidade}', String(qtd))
      .replaceAll('{unidade}', prodUnit)
      .replaceAll('{ambiente_origem}', origemNome)
      .replaceAll('{ambiente_destino}', destinoNome)
      .replaceAll('{saldo_origem}', String(saldoOrigem))
      .replaceAll('{saldo_destino}', String(saldoDestino))
      .replaceAll('{data_hora}', dataHora)
      .replaceAll('{responsavel}', responsavel)
      .replaceAll('{observacoes}', observacoes)

    const result = await queueWhatsappMessage(whatsappSettings, targetGroupId, message)
    return { success: result?.success ?? true }
  } catch (err: any) {
    console.error('[WhatsApp] Falha ao disparar notificação de transferência de estoque:', err)
    return { success: false, error: err?.message || String(err) }
  }
}
