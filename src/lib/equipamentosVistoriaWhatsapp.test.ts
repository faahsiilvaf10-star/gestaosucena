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
})

