import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fmtDataBr,
  notificarVistoriaEquipamento20Dias,
  notificarVistoriaEquipamento1Dia,
} from './equipamentosVistoriaWhatsapp'

vi.mock('./settings', () => ({
  getWhatsappSettings: vi.fn(),
}))

vi.mock('./whatsapp-api', () => ({
  sendWhatsappTextOnServer: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}))

import { getWhatsappSettings } from './settings'
import { sendWhatsappTextOnServer } from './whatsapp-api'

describe('equipamentosVistoriaWhatsapp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fmtDataBr deve formatar datas YYYY-MM-DD para DD/MM/YYYY', () => {
    expect(fmtDataBr('2026-11-05')).toBe('05/11/2026')
    expect(fmtDataBr(null)).toBe('-')
    expect(fmtDataBr('')).toBe('-')
  })

  it('notificarVistoriaEquipamento1Dia deve disparar mensagem com modelo customizado', async () => {
    vi.mocked(getWhatsappSettings).mockResolvedValue({
      url: 'https://api.whatsapp.test',
      token: 'secret-token',
      instanceId: 'inst1',
      groupId: 'default-group@g.us',
      vistoriasEquipamentos: {
        enabled_20_dias: true,
        enabled_1_dia: true,
        specificGroupId: '120363408136247156@g.us',
      },
      messageTemplates: {
        vistoriaEquipamentoVencendo1Dia:
          '🚨 Vence amanhã: {equipamento} - {tipo_vistoria} em {data_vencimento}',
      },
    } as any)

    const enviado = await notificarVistoriaEquipamento1Dia({
      eqName: 'Caminhão Pipa',
      plateTag: 'ABC-1234',
      docType: 'Laudo Mecânico',
      expiryDate: '2026-11-02',
      daysRemaining: 1,
    })

    expect(enviado).toBe(true)
    expect(sendWhatsappTextOnServer).toHaveBeenCalledWith({
      data: {
        url: 'https://api.whatsapp.test',
        token: 'secret-token',
        instanceId: 'inst1',
        phone: '120363408136247156@g.us',
        text: '🚨 Vence amanhã: Caminhão Pipa - Laudo Mecânico em 02/11/2026',
      },
    })
  })

  it('notificarVistoriaEquipamento1Dia deve abortar se enabled_1_dia for false', async () => {
    vi.mocked(getWhatsappSettings).mockResolvedValue({
      url: 'https://api.whatsapp.test',
      token: 'secret-token',
      instanceId: 'inst1',
      groupId: 'default-group@g.us',
      vistoriasEquipamentos: {
        enabled_20_dias: true,
        enabled_1_dia: false,
        specificGroupId: '120363408136247156@g.us',
      },
    } as any)

    const enviado = await notificarVistoriaEquipamento1Dia({
      eqName: 'Caminhão Pipa',
      plateTag: 'ABC-1234',
      docType: 'Laudo Mecânico',
      expiryDate: '2026-11-02',
      daysRemaining: 1,
    })

    expect(enviado).toBe(false)
    expect(sendWhatsappTextOnServer).not.toHaveBeenCalled()
  })

  it('notificarVistoriaEquipamento20Dias deve exibir a quantidade real de dias restantes no título', async () => {
    vi.mocked(getWhatsappSettings).mockResolvedValue({
      url: 'https://api.whatsapp.test',
      token: 'secret-token',
      instanceId: 'inst1',
      groupId: 'default-group@g.us',
      vistoriasEquipamentos: {
        enabled_20_dias: true,
        enabled_1_dia: true,
        specificGroupId: '120363408136247156@g.us',
      },
      messageTemplates: {},
    } as any)

    const enviado = await notificarVistoriaEquipamento20Dias({
      eqName: 'CP 02',
      plateTag: 'RQN2D45',
      docType: 'Tacógrafo / ART',
      expiryDate: '2026-12-17',
      daysRemaining: 19,
    })

    expect(enviado).toBe(true)
    expect(sendWhatsappTextOnServer).toHaveBeenCalledWith({
      data: {
        url: 'https://api.whatsapp.test',
        token: 'secret-token',
        instanceId: 'inst1',
        phone: '120363408136247156@g.us',
        text: expect.stringContaining('*AVISO: VISTORIA DE EQUIPAMENTO VENCENDO EM 19 DIAS*'),
      },
    })
  })

  it('notificarVistoriaEquipamento20Dias deve corrigir template legado com "VENCENDO EM 20 DIAS" fixo para os dias reais', async () => {
    vi.mocked(getWhatsappSettings).mockResolvedValue({
      url: 'https://api.whatsapp.test',
      token: 'secret-token',
      instanceId: 'inst1',
      groupId: 'default-group@g.us',
      vistoriasEquipamentos: {
        enabled_20_dias: true,
        enabled_1_dia: true,
        specificGroupId: '120363408136247156@g.us',
      },
      messageTemplates: {
        vistoriaEquipamentoVencendo20Dias:
          '⏳ *AVISO: VISTORIA DE EQUIPAMENTO VENCENDO EM 20 DIAS* ⏳\n\nFaltam {dias_restantes} dia(s)!',
      },
    } as any)

    const enviado = await notificarVistoriaEquipamento20Dias({
      eqName: 'CP 02',
      plateTag: 'RQN2D45',
      docType: 'Tacógrafo / ART',
      expiryDate: '2026-12-17',
      daysRemaining: 19,
    })

    expect(enviado).toBe(true)
    expect(sendWhatsappTextOnServer).toHaveBeenCalledWith({
      data: {
        url: 'https://api.whatsapp.test',
        token: 'secret-token',
        instanceId: 'inst1',
        phone: '120363408136247156@g.us',
        text: '⏳ *AVISO: VISTORIA DE EQUIPAMENTO VENCENDO EM 19 DIAS* ⏳\n\nFaltam 19 dia(s)!',
      },
    })
  })
})

