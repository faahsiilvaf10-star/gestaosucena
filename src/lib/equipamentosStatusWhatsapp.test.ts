import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  notificarEquipamentoQuebrado,
  notificarEquipamentoEmprestado,
  notificarEquipamentoMobilizado,
  notificarEquipamentoDesmobilizado
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

  it('deve disparar notificação de equipamento novo mobilizado substituindo todas as variáveis dinâmicas', async () => {
    vi.spyOn(settingsMod, 'getWhatsappSettings').mockResolvedValue({
      equipamentosStatusAlerts: {
        enabled_quebrado: true,
        enabled_emprestado: true,
        enabled_mobilizado: true,
        specificGroupId: '120363408136247156@g.us'
      },
      messageTemplates: {
        equipamentoMobilizado:
          'NOVO MOBILIZADO: {equipamento} | Tag: {tag} | Categoria: {categoria} | Tipo: {tipo} | Data Mobilizacao: {data_mobilizacao} | Data Registro: {data_hora} | Por: {responsavel} | Obs: {observacoes}'
      }
    } as any)

    const res = await notificarEquipamentoMobilizado({
      equipment: {
        name: 'CAMINHÃO PIPA 05',
        plate_tag: 'RQN-2D45',
        category: 'Equipamento Pesado',
        type: 'Caminhão Pipa'
      },
      mobilizedAt: '2026-11-28T08:00:00Z',
      actionDateTime: '2026-11-28T09:45:00Z',
      userName: 'Luciano Gestor',
      observacoes: 'Mobilizado para apoio às frentes de terraplenagem'
    })

    expect(res.success).toBe(true)
    expect(queuedMessages).toHaveLength(1)
    expect(queuedMessages[0].phone).toBe('120363408136247156@g.us')
    expect(queuedMessages[0].message).toContain('CAMINHÃO PIPA 05')
    expect(queuedMessages[0].message).toContain('RQN-2D45')
    expect(queuedMessages[0].message).toContain('Equipamento Pesado')
    expect(queuedMessages[0].message).toContain('Caminhão Pipa')
    expect(queuedMessages[0].message).toContain('Luciano Gestor')
    expect(queuedMessages[0].message).toContain('Mobilizado para apoio às frentes de terraplenagem')
  })

  it('não deve enviar notificação de equipamento mobilizado se enabled_mobilizado for false', async () => {
    vi.spyOn(settingsMod, 'getWhatsappSettings').mockResolvedValue({
      equipamentosStatusAlerts: {
        enabled_quebrado: true,
        enabled_emprestado: true,
        enabled_mobilizado: false,
        specificGroupId: '120363408136247156@g.us'
      }
    } as any)

    const res = await notificarEquipamentoMobilizado({
      equipment: { name: 'TRATOR ESTEIRA' },
      mobilizedAt: new Date(),
      userName: 'Luciano'
    })

    expect(res.success).toBe(false)
    expect(queuedMessages).toHaveLength(0)
  })

  it('deve disparar notificação de equipamento desmobilizado substituindo todas as variáveis dinâmicas', async () => {
    vi.spyOn(settingsMod, 'getWhatsappSettings').mockResolvedValue({
      equipamentosStatusAlerts: {
        enabled_quebrado: true,
        enabled_emprestado: true,
        enabled_mobilizado: true,
        enabled_desmobilizado: true,
        specificGroupId: '120363408136247156@g.us'
      },
      messageTemplates: {
        equipamentoDesmobilizado:
          'DESMOBILIZADO: {equipamento} ({tag}) | Categoria: {categoria} | Tipo: {tipo} | Desmobilizado em: {data_desmobilizacao} | Registro: {data_hora} | Por: {responsavel} | Motivo: {motivo} | Obs: {observacoes}'
      }
    } as any)

    const res = await notificarEquipamentoDesmobilizado({
      equipment: {
        name: 'SUC 01',
        plate_tag: 'SNJ9G70',
        category: 'Leve',
        type: 'Pick Up/Toro'
      },
      demobilizedAt: '2026-11-20T12:40:00Z',
      demobilizedReason: 'Desmobilizado da obra',
      actionDateTime: '2026-11-28T09:41:00Z',
      userName: 'Luciano Gestor',
      observacoes: 'Veículo liberado da frente de serviço'
    })

    expect(res.success).toBe(true)
    expect(queuedMessages).toHaveLength(1)
    expect(queuedMessages[0].phone).toBe('120363408136247156@g.us')
    expect(queuedMessages[0].message).toContain('SUC 01')
    expect(queuedMessages[0].message).toContain('SNJ9G70')
    expect(queuedMessages[0].message).toContain('Leve')
    expect(queuedMessages[0].message).toContain('Pick Up/Toro')
    expect(queuedMessages[0].message).toContain('Luciano Gestor')
    expect(queuedMessages[0].message).toContain('Desmobilizado da obra')
    expect(queuedMessages[0].message).toContain('Veículo liberado da frente de serviço')
  })

  it('não deve enviar notificação de equipamento desmobilizado se enabled_desmobilizado for false', async () => {
    vi.spyOn(settingsMod, 'getWhatsappSettings').mockResolvedValue({
      equipamentosStatusAlerts: {
        enabled_quebrado: true,
        enabled_emprestado: true,
        enabled_mobilizado: true,
        enabled_desmobilizado: false,
        specificGroupId: '120363408136247156@g.us'
      }
    } as any)

    const res = await notificarEquipamentoDesmobilizado({
      equipment: { name: 'SUC 01' },
      demobilizedAt: new Date(),
      userName: 'Luciano'
    })

    expect(res.success).toBe(false)
    expect(queuedMessages).toHaveLength(0)
  })
})
