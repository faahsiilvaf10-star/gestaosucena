import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  notificarEquipamentoQuebrado,
  notificarEquipamentoEmprestado
} from './equipamentosStatusWhatsapp'
import * as settingsMod from './settings'
import * as offlineSyncMod from './offline-sync'

describe('equipamentosStatusWhatsapp', () => {
  let queuedMessages: Array<{ phone: string; message: string }> = []

  beforeEach(() => {
    queuedMessages = []
    vi.restoreAllMocks()

    vi.spyOn(offlineSyncMod, 'queueWhatsappMessage').mockImplementation(async (_settings, phone, message) => {
      queuedMessages.push({ phone, message })
      return { success: true }
    })
  })

  it('deve disparar notificação de equipamento quebrado substituindo todas as variáveis', async () => {
    vi.spyOn(settingsMod, 'getWhatsappSettings').mockResolvedValue({
      url: 'https://api.wapi.test',
      instanceId: 'inst_1',
      token: 'tok_1',
      groupId: 'default_group@g.us',
      equipamentosStatusAlerts: {
        enabled_quebrado: true,
        enabled_emprestado: true,
        specificGroupId: '120363408136247156@g.us'
      },
      messageTemplates: {
        equipamentoQuebrado:
          'ALERTA QUEBRA: {equipamento} | Tag: {tag} | Cat: {categoria} | Motivo: {motivo} | Data: {data_hora} | Por: {responsavel} | Obs: {observacoes}'
      }
    } as any)

    const res = await notificarEquipamentoQuebrado({
      equipment: {
        name: 'ROÇADEIRA FS 220',
        plate_tag: 'ROC-04',
        category: 'Jardinagem'
      },
      brokenReason: 'mechanical_failure',
      description: 'Lâmina danificada e cabo frouxo',
      actionDateTime: '2026-11-10T14:30:00Z',
      userName: 'Carlos Silva'
    })

    expect(res.success).toBe(true)
    expect(queuedMessages).toHaveLength(1)
    expect(queuedMessages[0].phone).toBe('120363408136247156@g.us')
    expect(queuedMessages[0].message).toContain('ROÇADEIRA FS 220')
    expect(queuedMessages[0].message).toContain('ROC-04')
    expect(queuedMessages[0].message).toContain('Jardinagem')
    expect(queuedMessages[0].message).toContain('Falha Mecânica')
    expect(queuedMessages[0].message).toContain('Carlos Silva')
    expect(queuedMessages[0].message).toContain('Lâmina danificada e cabo frouxo')
  })

  it('não deve enviar equipamento quebrado se enabled_quebrado for false', async () => {
    vi.spyOn(settingsMod, 'getWhatsappSettings').mockResolvedValue({
      equipamentosStatusAlerts: {
        enabled_quebrado: false,
        enabled_emprestado: true,
        specificGroupId: '120363408136247156@g.us'
      }
    } as any)

    const res = await notificarEquipamentoQuebrado({
      equipment: { name: 'GERADOR 5KVA' },
      brokenReason: 'electrical_failure',
      actionDateTime: new Date(),
      userName: 'Carlos'
    })

    expect(res.success).toBe(false)
    expect(queuedMessages).toHaveLength(0)
  })

  it('deve disparar notificação de equipamento emprestado com empresa, data e detalhes', async () => {
    vi.spyOn(settingsMod, 'getWhatsappSettings').mockResolvedValue({
      equipamentosStatusAlerts: {
        enabled_quebrado: true,
        enabled_emprestado: true,
        specificGroupId: '120363408136247156@g.us'
      },
      messageTemplates: {
        equipamentoEmprestado:
          'EMPRÉSTIMO: {equipamento} ({tag}) para {empresa} em {data_hora} por {responsavel}. Obs: {observacoes}'
      }
    } as any)

    const res = await notificarEquipamentoEmprestado({
      equipment: {
        name: 'SOPRADOR BG 86',
        plate_tag: 'SOP-01',
        category: 'Jardinagem'
      },
      company: 'Hydro Civil Engenharia',
      description: 'Devolução prevista em 2 dias',
      actionDateTime: '2026-11-10T14:30:00Z',
      userName: 'Marcos Encarregado'
    })

    expect(res.success).toBe(true)
    expect(queuedMessages).toHaveLength(1)
    expect(queuedMessages[0].phone).toBe('120363408136247156@g.us')
    expect(queuedMessages[0].message).toContain('SOPRADOR BG 86')
    expect(queuedMessages[0].message).toContain('SOP-01')
    expect(queuedMessages[0].message).toContain('Hydro Civil Engenharia')
    expect(queuedMessages[0].message).toContain('Devolução prevista em 2 dias')
    expect(queuedMessages[0].message).toContain('Marcos Encarregado')
  })

  it('não deve enviar equipamento emprestado se enabled_emprestado for false', async () => {
    vi.spyOn(settingsMod, 'getWhatsappSettings').mockResolvedValue({
      equipamentosStatusAlerts: {
        enabled_quebrado: true,
        enabled_emprestado: false,
        specificGroupId: '120363408136247156@g.us'
      }
    } as any)

    const res = await notificarEquipamentoEmprestado({
      equipment: { name: 'MOTOPODA HT 133' },
      company: 'Terceirizada X',
      actionDateTime: new Date(),
      userName: 'Marcos'
    })

    expect(res.success).toBe(false)
    expect(queuedMessages).toHaveLength(0)
  })
})
