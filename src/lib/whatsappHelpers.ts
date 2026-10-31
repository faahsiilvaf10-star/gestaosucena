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

    msg = msg.replaceAll('{hora}', hora)
    msg = msg.replaceAll('{equipamento}', eqName)
    msg = msg.replaceAll('{placa}', eqPlate)
    msg = msg.replaceAll('{tag}', eqTag)
    msg = msg.replaceAll('{motorista}', driverName || 'Não informado')

    if (type === 'exit') {
      const reasonLabel = (exitReasonRaw && EXIT_REASONS_MAP[exitReasonRaw]) || exitReasonRaw || 'Não informado'
      const motivoText = exitDescription?.trim() ? `${reasonLabel} - ${exitDescription.trim()}` : reasonLabel
      msg = msg.replaceAll('{motivo}', motivoText)
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
      msg = msg.replaceAll('{numero_pedido}', numStr)
      msg = msg.replaceAll('{requisitante}', requesterName)
      msg = msg.replaceAll('{responsaveis}', responsiblesNames)
      msg = msg.replaceAll('{data_esperada}', dataEsperada)
      msg = msg.replaceAll('{prioridade}', order.priority)
      msg = msg.replaceAll('{observacoes}', order.notes || 'Nenhuma')
      msg = msg.replaceAll('{itens}', itemsList)

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

export async function sendEpiRequisitionWhatsappNotification(params: {
  authorizerName: string;
  authorizerMatricula?: string;
  employeeName: string;
  employeeCargo?: string;
  employeeMatricula?: string;
  destinationArea?: string;
  reason?: string;
  items: Array<{
    name: string;
    quantity: number | string;
    productId?: string;
    remainingStock?: number;
    minStock?: number;
    unit?: string;
    isBelowMin?: boolean;
  }>;
  dateStr?: string;
  receiptBase64?: string;
  receiptImageUrl?: string | null;
}): Promise<{ success: boolean; error?: string; queued?: boolean; mode?: 'media' | 'text' | 'queued' }> {
  try {
    const settings = await getWhatsappSettings();
    if (!settings.url || !settings.token) {
      return { success: false, error: 'Configurações do WhatsApp não estão preenchidas (URL ou Token ausentes no Admin).' };
    }

    if (!settings.requisitionAlerts?.enabled) {
      return { success: false, error: 'O envio automático de requisições de EPI está desativado na aba WhatsApp do painel Admin.' };
    }

    const groupId = (settings.requisitionAlerts.specificGroupId || settings.groupId || '').trim();
    if (!groupId) {
      return { success: false, error: 'Nenhum ID de grupo do WhatsApp configurado para receber alertas de requisição.' };
    }

    const { format } = await import('date-fns');
    const dateStr = params.dateStr || format(new Date(), 'dd/MM/yyyy');

    // Se algum item não tiver o saldo em estoque, busca no banco de dados para garantir precisão
    const itemsWithStock = await Promise.all(params.items.map(async (it) => {
      let rem = it.remainingStock;
      let min = it.minStock;
      let unit = it.unit || 'un';
      let isBelow = it.isBelowMin;

      if (rem === undefined && (it.productId || it.name)) {
        try {
          let q = supabase.from('al_products').select('id, name, current_quantity, min_stock, unit_of_measure');
          if (it.productId) {
            q = q.eq('id', it.productId);
          } else {
            q = q.ilike('name', it.name.trim());
          }
          const { data: prods } = await q.limit(1);
          if (prods && prods.length > 0) {
            const p = prods[0];
            rem = Number(p.current_quantity) || 0;
            const rawMin = Number(p.min_stock) || 0;
            min = rawMin >= 1000 ? 5 : rawMin;
            unit = p.unit_of_measure || 'un';
            isBelow = min > 0 && rem <= min;
          }
        } catch (_) {}
      }

      const safeMin = (min !== undefined && min >= 1000) ? 5 : min;
      return {
        ...it,
        remainingStock: rem,
        minStock: safeMin,
        unit,
        isBelowMin: isBelow ?? (safeMin !== undefined && safeMin > 0 && rem !== undefined && rem <= safeMin)
      };
    }));

    const itemsList = itemsWithStock.length > 0
      ? itemsWithStock.map(it => {
          const nome = it.name || 'Desconhecido';
          const qtd = it.quantity;
          const unit = it.unit || 'un';

          if (it.remainingStock !== undefined) {
            const isBelow = it.isBelowMin || (it.minStock !== undefined && it.minStock > 0 && it.remainingStock <= it.minStock);
            if (isBelow) {
              return `  - ${nome} (${qtd}) — Restam no estoque: ${it.remainingStock} ${unit} ⚠️ *(Abaixo do mínimo: ${(it.minStock && it.minStock < 1000) ? it.minStock : 5} ${unit})*`;
            }
            return `  - ${nome} (${qtd}) — Restam no estoque: ${it.remainingStock} ${unit}`;
          }
          return `  - ${nome} (${qtd})`;
        }).join('\n')
      : '  - 1 item';

    // Alerta de itens que ultrapassaram o estoque mínimo
    const itensAbaixoMinimo = itemsWithStock.filter(it => 
      it.isBelowMin || (it.minStock !== undefined && it.minStock > 0 && it.remainingStock !== undefined && it.remainingStock <= it.minStock)
    );

    let observacaoEstoque = '';
    if (itensAbaixoMinimo.length > 0) {
      const avisos = itensAbaixoMinimo.map(it => 
        `• *${it.name}:* restam apenas *${it.remainingStock} ${it.unit || 'un'}* no almoxarifado (mínimo: ${(it.minStock && it.minStock < 1000) ? it.minStock : 5} ${it.unit || 'un'}). Reposição necessária!`
      ).join('\n');
      observacaoEstoque = `\n\n⚠️ *OBSERVAÇÃO:* O estoque ultrapassou o mínimo configurado:\n${avisos}`;
    }

    let caption = settings.messageTemplates?.requisicaoEpi ||
      '🦺 *TROCA DE EPI*\n\n📅 *Data:* {data}\n👤 *Funcionário:* {nome}\n💼 *Função:* {cargo}\n🆔 *Matrícula:* {matricula}\n📝 *Motivo:* {motivo}\n✅ *Autorizado por:* {autorizador} ({matricula_autorizador})\n\n*Itens:*\n{itens}{observacao_estoque}';

    caption = caption
      .replaceAll('{data}', dateStr)
      .replaceAll('{nome}', params.employeeName || 'Não informado')
      .replaceAll('{cargo}', params.employeeCargo || '-')
      .replaceAll('{matricula}', params.employeeMatricula || '-')
      .replaceAll('{motivo}', params.reason || 'Substituição / Entrega periódica')
      .replaceAll('{autorizador}', params.authorizerName || 'Almoxarifado')
      .replaceAll('{matricula_autorizador}', params.authorizerMatricula || '-')
      .replaceAll('{area}', params.destinationArea || 'Almoxarifado')
      .replaceAll('{itens}', itemsList);

    if (caption.includes('{observacao_estoque}')) {
      caption = caption.replaceAll('{observacao_estoque}', observacaoEstoque);
    } else if (observacaoEstoque) {
      caption += observacaoEstoque;
    }

    // Se houver recibo como imagem (base64 ou URL pública), tenta enviar com imagem
    let base64ToSend = params.receiptBase64;

    // Se não tiver base64 mas tiver URL pública do comprovante, tenta obter o base64
    if (!base64ToSend && params.receiptImageUrl) {
      try {
        const imgRes = await fetch(params.receiptImageUrl, { signal: AbortSignal.timeout(6000) });
        if (imgRes.ok) {
          const blob = await imgRes.blob();
          base64ToSend = await new Promise<string>((res, rej) => {
            const reader = new FileReader();
            reader.onloadend = () => res(reader.result as string);
            reader.onerror = rej;
            reader.readAsDataURL(blob);
          });
        }
      } catch (imgFetchErr) {
        console.warn('Não foi possível carregar imagem do comprovante via URL:', imgFetchErr);
      }
    }

    // 1. Tenta envio com imagem/mídia
    if (base64ToSend) {
      try {
        const res = await sendWhatsappMediaOnServer({
          data: {
            url: settings.url,
            token: settings.token,
            instanceId: settings.instanceId,
            phone: groupId,
            caption,
            base64Media: base64ToSend,
            imageUrl: params.receiptImageUrl || undefined,
            fileName: 'recibo-epi.png'
          }
        });
        if (res.success) {
          return { success: true, mode: 'media' };
        }
      } catch (mediaErr: any) {
        console.warn('Falha no envio de mídia via WhatsApp API, tentando fallback em texto:', mediaErr?.message || mediaErr);
      }
    }

    // 2. Fallback: envio em formato de texto estruturado
    let textToSend = caption;
    if (params.receiptImageUrl) {
      textToSend += `\n\n📄 *Comprovante:* ${params.receiptImageUrl}`;
    }

    try {
      const textRes = await sendWhatsappTextOnServer({
        data: {
          url: settings.url,
          token: settings.token,
          instanceId: settings.instanceId,
          phone: groupId,
          text: textToSend
        }
      });
      if (textRes.success) {
        return { success: true, mode: 'text' };
      }
    } catch (textErr: any) {
      console.warn('Envio direto de texto falhou, colocando na fila offline:', textErr?.message || textErr);
    }

    // 3. Fallback resiliente: enfileirar na fila offline-first do sistema
    try {
      await queueWhatsappMessage(settings, groupId, textToSend);
      return { success: true, queued: true, mode: 'queued' };
    } catch (queueErr: any) {
      return { success: false, error: queueErr?.message || 'Falha geral ao despachar WhatsApp' };
    }
  } catch (err: any) {
    console.error('Erro em sendEpiRequisitionWhatsappNotification:', err);
    return { success: false, error: err?.message || 'Erro inesperado ao enviar WhatsApp' };
  }
}

/**
 * Envia notificação de alteração de quantidade de estoque no WhatsApp
 */
export async function sendStockQuantityChangeWhatsappNotification(params: {
  responsibleName: string;
  productName: string;
  productCode?: string;
  previousQuantity: number;
  newQuantity: number;
  unitOfMeasure: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await getWhatsappSettings();
    if (!settings?.url || !settings?.token) {
      return { success: false, error: 'Configurações do WhatsApp não estão preenchidas.' };
    }

    if (!settings.estoqueAlteracao?.enabled) {
      return { success: false, error: 'O envio de notificações de alteração de estoque está desativado.' };
    }

    const groupId = (settings.estoqueAlteracao.specificGroupId || settings.groupId || '').trim();
    if (!groupId) {
      return { success: false, error: 'Nenhum ID de grupo do WhatsApp configurado.' };
    }

    const diff = params.newQuantity - params.previousQuantity;
    const diffStr = diff > 0 ? `+${diff}` : `${diff}`;

    let msg = settings.messageTemplates?.estoqueAlteracao ||
      '📝 *ALTERAÇÃO DE ESTOQUE*\n\n👤 *Responsável:* {responsavel}\n📦 *Produto:* {produto}\n🏷️ *Código:* {codigo}\n\n🔄 *Quantidade anterior:* {quantidade_anterior} {unidade}\n➡️ *Nova quantidade:* {nova_quantidade} {unidade}\n📝 *Diferença:* {diferenca} {unidade}\n\n_Mensagem automática - Sucena_';

    msg = msg
      .replaceAll('{responsavel}', params.responsibleName || 'Não identificado')
      .replaceAll('{produto}', params.productName)
      .replaceAll('{codigo}', params.productCode || '-')
      .replaceAll('{quantidade_anterior}', String(params.previousQuantity))
      .replaceAll('{nova_quantidade}', String(params.newQuantity))
      .replaceAll('{unidade}', params.unitOfMeasure)
      .replaceAll('{diferenca}', diffStr);

    try {
      await sendWhatsappTextOnServer({
        data: {
          url: settings.url,
          token: settings.token,
          instanceId: settings.instanceId,
          phone: groupId,
          text: msg
        }
      });
      return { success: true };
    } catch (sendErr: any) {
      console.warn('Falha no envio direto, tentando fila offline:', sendErr?.message || sendErr);
    }

    // Fallback: enfileirar na fila offline-first
    try {
      await queueWhatsappMessage(settings, groupId, msg);
      return { success: true };
    } catch (queueErr: any) {
      return { success: false, error: queueErr?.message || 'Falha ao enfileirar mensagem' };
    }
  } catch (err: any) {
    console.error('Erro em sendStockQuantityChangeWhatsappNotification:', err);
    return { success: false, error: err?.message || 'Erro inesperado' };
  }
}

/**
 * Envia alerta de estoque mínimo no WhatsApp
 */
export async function sendStockMinAlertWhatsappNotification(params: {
  productName: string;
  productCode?: string;
  location?: string;
  currentQuantity: number;
  minStock: number;
  unitOfMeasure: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await getWhatsappSettings();
    if (!settings?.url || !settings?.token) {
      return { success: false, error: 'Configurações do WhatsApp não estão preenchidas.' };
    }

    if (!settings.estoqueMinimo?.enabled) {
      return { success: false, error: 'O envio de alertas de estoque mínimo está desativado.' };
    }

    const groupId = (settings.estoqueMinimo.specificGroupId || settings.groupId || '').trim();
    if (!groupId) {
      return { success: false, error: 'Nenhum ID de grupo do WhatsApp configurado.' };
    }

    let msg = settings.messageTemplates?.estoqueMinimo ||
      '⚠️ *ALERTA: ESTOQUE MÍNIMO* ⚠️\n\n📦 *Produto:* {produto}\n🏷️ *Código:* {codigo}\n📍 *Localização:* {localizacao}\n\n🔴 *Quantidade atual:* {quantidade_atual} {unidade}\n📉 *Estoque mínimo:* {estoque_minimo} {unidade}\n\n_Reponha o estoque o mais rápido possível._\n\n_Mensagem automática - Sucena_';

    msg = msg
      .replaceAll('{produto}', params.productName)
      .replaceAll('{codigo}', params.productCode || '-')
      .replaceAll('{localizacao}', params.location || '-')
      .replaceAll('{quantidade_atual}', String(params.currentQuantity))
      .replaceAll('{estoque_minimo}', String(params.minStock))
      .replaceAll('{unidade}', params.unitOfMeasure);

    try {
      await sendWhatsappTextOnServer({
        data: {
          url: settings.url,
          token: settings.token,
          instanceId: settings.instanceId,
          phone: groupId,
          text: msg
        }
      });
      return { success: true };
    } catch (sendErr: any) {
      console.warn('Falha no envio direto, tentando fila offline:', sendErr?.message || sendErr);
    }

    // Fallback: enfileirar na fila offline-first
    try {
      await queueWhatsappMessage(settings, groupId, msg);
      return { success: true };
    } catch (queueErr: any) {
      return { success: false, error: queueErr?.message || 'Falha ao enfileirar mensagem' };
    }
  } catch (err: any) {
    console.error('Erro em sendStockMinAlertWhatsappNotification:', err);
    return { success: false, error: err?.message || 'Erro inesperado' };
  }
}

