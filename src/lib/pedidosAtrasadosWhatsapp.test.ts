import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendDelayedPurchaseOrderWhatsappNotification } from './whatsappHelpers'
import * as settingsMod from './settings'
import * as whatsappApiMod from './whatsapp-api'
import { supabase } from './supabase'

describe('pedidosAtrasadosWhatsapp', () => {
  let sentTexts: Array<{ phone: string; text: string }> = []
  let sentMedia: Array<{ phone: string; caption: string; base64Media?: string; imageUrl?: string }> = []

  beforeEach(() => {
    sentTexts = []
    sentMedia = []
    vi.restoreAllMocks()

    vi.spyOn(whatsappApiMod, 'sendWhatsappTextOnServer').mockImplementation(async ({ data }: any) => {
      sentTexts.push({ phone: data.phone, text: data.text })
      return { success: true } as any
    })

    vi.spyOn(whatsappApiMod, 'sendWhatsappMediaOnServer').mockImplementation(async ({ data }: any) => {
      sentMedia.push({
        phone: data.phone,
        caption: data.caption,
        base64Media: data.base64Media,
        imageUrl: data.imageUrl,
      })
      return { success: true } as any
    })

    vi.spyOn(supabase, 'rpc').mockReturnValue({
      data: [
        { id: 'user-1', nome: 'Creriane Alcantara', cargo: 'Aux. Administrativo' },
        { id: 'user-2', nome: 'Luís Carlos Passos Araújo', cargo: 'Preposto', telefone: '91988887777' },
      ],
      error: null,
    } as any)
  })

  it('deve formatar e reenviar alerta de pedido em atraso para o grupo com todas as variáveis dinâmicas', async () => {
    vi.spyOn(settingsMod, 'getWhatsappSettings').mockResolvedValue({
      url: 'https://api.wapi.test',
      instanceId: 'inst_1',
      token: 'tok_1',
      groupId: 'default@g.us',
      purchaseOrders: {
        enabled_group: true,
        enabled_individual: true,
        specificGroupId: '120363406691114696@g.us',
      },
      messageTemplates: {
        pedidoCompraAtrasado:
          '🚨 ALERTA: PEDIDO #{numero_pedido} - Status: {status} - Prioridade: {prioridade} - Previsto: {data_esperada} - Atraso: {dias_atraso} dias - Requisitante: {requisitante} - Responsaveis: {responsaveis} - Itens:\n{itens}',
      },
    } as any)

    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 5) // 5 dias atrás

    const fakeOrder = {
      id: 'order-123',
      order_number: 42,
      status: 'Em Compra',
      priority: 'Urgente',
      expected_delivery_date: pastDate.toISOString(),
      notes: 'Entregar na oficina civil',
      requester_user_id: 'user-1',
      items: [
        { id: 'it-1', product_name: 'Suporte guidão roçadeira', quantity: 4, unit: 'UN', description: 'Husqvarna' },
        { id: 'it-2', product_name: 'Parafuso Suporte', quantity: 30, unit: 'UN' },
      ],
      responsibles: [
        { id: 'user-2', nome: 'Luís Carlos Passos Araújo', telefone: '91988887777' },
      ],
    }

    const result = await sendDelayedPurchaseOrderWhatsappNotification(fakeOrder)

    expect(result.success).toBe(true)
    // Mensagem enviada para o grupo
    expect(sentTexts.some((m) => m.phone === '120363406691114696@g.us')).toBe(true)
    // Mensagem enviada individualmente para o responsável configurado
    expect(sentTexts.some((m) => m.phone === '5591988887777')).toBe(true)

    const groupMsg = sentTexts.find((m) => m.phone === '120363406691114696@g.us')!.text
    expect(groupMsg).toContain('PEDIDO #0042')
    expect(groupMsg).toContain('Status: Em Compra')
    expect(groupMsg).toContain('Prioridade: Urgente')
    expect(groupMsg).toContain('Atraso: 5 dias')
    expect(groupMsg).toContain('Creriane Alcantara')
    expect(groupMsg).toContain('Luís Carlos Passos Araújo')
    expect(groupMsg).toContain('Suporte guidão roçadeira')
    expect(groupMsg).toContain('Parafuso Suporte')
  })

  it('deve retornar erro claro quando configurações do WhatsApp não estiverem preenchidas', async () => {
    vi.spyOn(settingsMod, 'getWhatsappSettings').mockResolvedValue({
      url: '',
      instanceId: '',
      token: '',
      groupId: '',
    } as any)

    const result = await sendDelayedPurchaseOrderWhatsappNotification({
      id: 'order-999',
      order_number: 1,
      expected_delivery_date: new Date().toISOString(),
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Configurações da W-API não configuradas')
  })
})
