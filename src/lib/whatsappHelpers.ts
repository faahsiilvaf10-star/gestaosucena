import { getWhatsappSettings } from './settings'
import { sendWhatsappTextOnServer, sendWhatsappMediaOnServer } from './whatsapp-api'
import { queueWhatsappMessage } from './offline-sync'
import { supabase } from './supabase'
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
  exitDescription?: string | null,
  driverName?: string | null
) {
  try {
    const whatsappSettings = await getWhatsappSettings()
    
    // Coletar todos os destinatários configurados (grupo de movimentação e grupo do app motorista)
    const targetNumbers = new Set<string>()
    if (whatsappSettings.equipamentosMovimentacao?.enabled !== false) {
      const num = whatsappSettings.equipamentosMovimentacao?.specificGroupId || whatsappSettings.groupId
      if (num) targetNumbers.add(num)
    }
    if (whatsappSettings.appMotoristaAlerts?.enabled !== false) {
      const num = whatsappSettings.appMotoristaAlerts?.specificGroupId || whatsappSettings.groupId
      if (num) targetNumbers.add(num)
    }

    if (targetNumbers.size === 0) return

    const d = new Date(actionDateTime)
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' de ' + d.toLocaleDateString('pt-BR')

    let msg = ''
    if (type === 'entry') {
      msg = whatsappSettings.messageTemplates?.equipamentoEntrada || '🚜 *ENTRADA DE EQUIPAMENTO*\n\n⏰ *Hora:* {hora}\n🚜 *Equipamento:* {equipamento}\n🚙 *Placa:* {placa}\n👤 *Motorista:* {motorista}\n\n_Mensagem automática - Sucena_'
    } else {
      msg = whatsappSettings.messageTemplates?.equipamentoSaida || '🚜 *SAÍDA DE EQUIPAMENTO*\n\n⏰ *Hora:* {hora}\n🚜 *Equipamento:* {equipamento}\n🚙 *Placa:* {placa}\n\n⚠️ *Motivo:* {motivo}\n👤 *Motorista:* {motorista}\n\n_Mensagem automática - Sucena_'
    }

    const eqName = equipment?.name || 'Equipamento'
    const eqPlate = equipment?.plate_tag || 'N/A'
    const eqTag = equipment?.id ? equipment.id.substring(0, 8).toUpperCase() : eqName

    msg = msg.replace('{hora}', hora)
    msg = msg.replace('{equipamento}', eqName)
    msg = msg.replace('{placa}', eqPlate)
    msg = msg.replace('{tag}', eqTag)
    msg = msg.replace('{motorista}', driverName || 'Não informado')

    if (type === 'exit') {
      const reasonLabel = (exitReasonRaw && EXIT_REASONS_MAP[exitReasonRaw]) || exitReasonRaw || 'Não informado'
      const motivoText = exitDescription?.trim() ? `${reasonLabel} - ${exitDescription.trim()}` : reasonLabel
      msg = msg.replace('{motivo}', motivoText)
    }

    // Disparar para cada grupo alvo usando a fila offline-first resiliente
    for (const phone of targetNumbers) {
      try {
        await queueWhatsappMessage(whatsappSettings, phone, msg)
      } catch (err) {
        console.warn(`Falha ao enviar WP movimentação para ${phone}:`, err)
      }
    }
  } catch (error: any) {
    console.error('Error sending Entry/Exit WhatsApp Notification:', error)
    toast.error('Erro no WhatsApp: ' + (error?.message || String(error)))
  }
}

export async function sendPurchaseOrderWhatsappNotification(
  order: any,
  requesterName: string,
  responsiblesList: any[]
) {
  try {
    const whatsappSettings = await getWhatsappSettings()
    if (!whatsappSettings?.purchaseOrders) return

    const { enabled_group, enabled_individual, specificGroupId } = whatsappSettings.purchaseOrders
    if (!enabled_group && !enabled_individual) return

    const groupNumber = specificGroupId || whatsappSettings.groupId
    
    // Formatar itens
    const itemsList = order.items.map((it: any) => `- ${it.quantity} ${it.unit} ${it.product_name} ${it.description ? '('+it.description+')' : ''}`).join('\n')
    const responsiblesNames = responsiblesList.map(r => r.nome).join(', ') || 'Nenhum'

    // Formatar data
    const d = new Date(order.expected_delivery_date)
    const dataEsperada = d.toLocaleDateString('pt-BR')

    // Pega a primeira foto (se houver)
    const firstItemWithImage = order.items.find((it: any) => it.image_path)
    let imageUrl = null
    if (firstItemWithImage && firstItemWithImage.image_path) {
      if (firstItemWithImage.image_path.startsWith('http')) {
        imageUrl = firstItemWithImage.image_path
      } else {
        // Se for só o path do storage
        const { data } = supabase.storage.from('purchase-order-items').getPublicUrl(firstItemWithImage.image_path)
        imageUrl = data.publicUrl
      }
    }
    
    const numStr = order.order_number ? String(order.order_number).padStart(4, '0') : 'Rascunho'

    // Função helper para baixar a imagem em base64 e enviar como Media
    const sendMsg = async (phone: string, template: string) => {
      let msg = template
      msg = msg.replace('{numero_pedido}', numStr)
      msg = msg.replace('{requisitante}', requesterName)
      msg = msg.replace('{responsaveis}', responsiblesNames)
      msg = msg.replace('{data_esperada}', dataEsperada)
      msg = msg.replace('{prioridade}', order.priority)
      msg = msg.replace('{observacoes}', order.notes || 'Nenhuma')
      msg = msg.replace('{itens}', itemsList)

      if (imageUrl) {
        try {
          const imgRes = await fetch(imageUrl)
          const blob = await imgRes.blob()
          
          // Converter Blob para Base64 usando FileReader no Client Side
          const base64DataUri = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })

          await sendWhatsappMediaOnServer({
            data: {
              url: whatsappSettings.url,
              instanceId: whatsappSettings.instanceId,
              token: whatsappSettings.token,
              phone: phone,
              caption: msg,
              base64Media: base64DataUri,
              fileName: 'pedido.jpg'
            }
          })
          return
        } catch (e) {
          console.error("Falha ao enviar media, caindo pro envio de texto", e)
        }
      }

      // Fallback para texto sem imagem
      await sendWhatsappTextOnServer({
        data: {
          url: whatsappSettings.url,
          instanceId: whatsappSettings.instanceId,
          token: whatsappSettings.token,
          phone: phone,
          text: msg
        }
      })
    }

    // 1. Enviar para o GRUPO
    if (enabled_group && groupNumber) {
      const groupTemplate = whatsappSettings.messageTemplates?.pedidoCompraGrupo || '📦 *NOVO PEDIDO DE COMPRA #{numero_pedido}*\n\n👤 *Requisitante:* {requisitante}\n👥 *Responsável(is):* {responsaveis}\n📅 *Data Esperada:* {data_esperada}\n🚨 *Prioridade:* {prioridade}\n📝 *Observações:* {observacoes}\n\n*Itens do Pedido:*\n{itens}\n\n_Mensagem automática - Sucena_'
      await sendMsg(groupNumber, groupTemplate)
    }

    // 2. Enviar para o INDIVIDUAL (Responsaveis)
    if (enabled_individual && responsiblesList.length > 0) {
      const individualTemplate = whatsappSettings.messageTemplates?.pedidoCompraIndividual || '📦 *NOVO PEDIDO DE COMPRA #{numero_pedido} ATRIBUÍDO A VOCÊ*\n\n👤 *Requisitante:* {requisitante}\n📅 *Data Esperada:* {data_esperada}\n🚨 *Prioridade:* {prioridade}\n📝 *Observações:* {observacoes}\n\n*Itens do Pedido:*\n{itens}\n\n_Acesse o sistema para mais detalhes._'
      
      for (const resp of responsiblesList) {
        if (resp.telefone || resp.phone) {
          // Limpa tudo menos numeros
          const cleanPhone = (resp.telefone || resp.phone).replace(/\D/g, '')
          if (cleanPhone.length >= 10) {
            let phoneToApp = cleanPhone
            if (!phoneToApp.startsWith('55')) phoneToApp = '55' + phoneToApp
            await sendMsg(phoneToApp, individualTemplate)
          }
        }
      }
    }
  } catch (error: any) {
    console.error('Error sending Purchase Order WhatsApp Notification:', error)
  }
}
