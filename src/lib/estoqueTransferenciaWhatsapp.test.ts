import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notificarTransferenciaEstoque } from './estoqueTransferenciaWhatsapp'
import * as settingsMod from './settings'
import * as offlineSyncMod from './offline-sync'

describe('estoqueTransferenciaWhatsapp', () => {
  let queuedMessages: Array<{ phone: string; message: string }> = []

  beforeEach(() => {
    queuedMessages = []
    vi.restoreAllMocks()

    vi.spyOn(offlineSyncMod, 'queueWhatsappMessage').mockImplementation(async (_settings, phone, message) => {
      queuedMessages.push({ phone, message })
      return { success: true }
    })
  })

  it('deve disparar notificação de transferência de estoque preenchendo todos os dados', async () => {
    vi.spyOn(settingsMod, 'getWhatsappSettings').mockResolvedValue({
      url: 'https://api.wapi.test',
      instanceId: 'inst_1',
      token: 'tok_1',
      groupId: 'default@g.us',
      estoqueTransferencia: {
        enabled: true,
        specificGroupId: '120363406691114696@g.us'
      },
      messageTemplates: {
        estoqueTransferencia:
          'TRANSF: {produto} ({codigo}) Cat: {categoria} Qtd: {quantidade} {unidade} de {ambiente_origem} para {ambiente_destino}. Saldos: Origem {saldo_origem}, Destino {saldo_destino}. Por: {responsavel}. Obs: {observacoes}'
      }
    } as any)

    const res = await notificarTransferenciaEstoque({
      product: {
        name: 'LUVAS DE VAQUETA',
        internal_code: 'EPI-001',
        category_name: 'EPI',
        unit_of_measure: 'PAR'
      },
      quantity: 15,
      originEnv: 'barcarena',
      destinationEnv: 'hydro-civil',
      originRemainingQty: 35,
      destinationNewQty: 25,
      userName: 'Marcos Almoxarife',
      observations: 'Reforço operacional da frente Hydro Civil',
      actionDateTime: '2026-11-10T14:45:00Z'
    })

    expect(res.success).toBe(true)
    expect(queuedMessages).toHaveLength(1)
    expect(queuedMessages[0].phone).toBe('120363406691114696@g.us')
    expect(queuedMessages[0].message).toContain('LUVAS DE VAQUETA')
    expect(queuedMessages[0].message).toContain('EPI-001')
    expect(queuedMessages[0].message).toContain('EPI')
    expect(queuedMessages[0].message).toContain('15 PAR')
    expect(queuedMessages[0].message).toContain('HYDRO REABILITAÇÃO')
    expect(queuedMessages[0].message).toContain('HYDRO CIVIL')
    expect(queuedMessages[0].message).toContain('Origem 35')
    expect(queuedMessages[0].message).toContain('Destino 25')
    expect(queuedMessages[0].message).toContain('Marcos Almoxarife')
    expect(queuedMessages[0].message).toContain('Reforço operacional da frente Hydro Civil')
  })

  it('não deve enviar mensagem se enabled for false', async () => {
    vi.spyOn(settingsMod, 'getWhatsappSettings').mockResolvedValue({
      estoqueTransferencia: {
        enabled: false,
        specificGroupId: '120363406691114696@g.us'
      }
    } as any)

    const res = await notificarTransferenciaEstoque({
      product: { name: 'CAPACETE DE SEGURANÇA' },
      quantity: 5,
      originEnv: 'barcarena',
      destinationEnv: 'hydro-civil',
      originRemainingQty: 10,
      destinationNewQty: 5,
      userName: 'Carlos'
    })

    expect(res.success).toBe(false)
    expect(queuedMessages).toHaveLength(0)
  })
})
