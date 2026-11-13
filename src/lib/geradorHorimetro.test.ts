import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  calcHorasRestantes,
  getStatusGerador,
  saveGeradorHorimetro
} from './geradorHorimetro'
import * as whatsappApiMod from './whatsapp-api'
import * as settingsMod from './settings'
import { supabase } from './supabase'

describe('Controle de Horímetro e Manutenção do Gerador', () => {
  it('calcHorasRestantes calcula a diferença correta de horas até a manutenção', () => {
    expect(calcHorasRestantes(100, 250)).toBe(150)
    expect(calcHorasRestantes(230, 250)).toBe(20)
    expect(calcHorasRestantes(250, 250)).toBe(0)
    expect(calcHorasRestantes(265.5, 250)).toBe(-15.5)
  })

  it('getStatusGerador retorna normal quando faltam mais de 20 horas', () => {
    expect(getStatusGerador(100, 250, 20)).toBe('normal')
    expect(getStatusGerador(229, 250, 20)).toBe('normal')
  })

  it('getStatusGerador retorna alerta quando faltam 20 horas ou menos', () => {
    expect(getStatusGerador(230, 250, 20)).toBe('alerta')
    expect(getStatusGerador(245, 250, 20)).toBe('alerta')
    expect(getStatusGerador(249.9, 250, 20)).toBe('alerta')
  })

  it('getStatusGerador retorna vencido quando o horímetro atingir ou ultrapassar o limite', () => {
    expect(getStatusGerador(250, 250, 20)).toBe('vencido')
    expect(getStatusGerador(260, 250, 20)).toBe('vencido')
  })

  it('notificarGeradorHorimetroManutencao formata corretamente variáveis dinâmicas e dispara WhatsApp', async () => {
    const { notificarGeradorHorimetroManutencao } = await import('./geradorHorimetroWhatsapp')

    let sentText = ''
    let sentPhone = ''

    vi.spyOn(whatsappApiMod, 'sendWhatsappTextOnServer').mockImplementation(async ({ data }: any) => {
      sentPhone = data.phone
      sentText = data.text
      return { success: true } as any
    })

    vi.spyOn(settingsMod, 'getWhatsappSettings').mockResolvedValue({
      url: 'https://wa.fake/api',
      token: 'fake-token',
      instanceId: 'fake-inst',
      groupId: '120363408136247156@g.us',
      interval: 30,
      geradorManutencao: {
        enabled: true,
        specificGroupId: '120363408136247156@g.us',
        alertHours: 20
      },
      messageTemplates: {
        geradorHorimetroManutencao:
          'GERADOR {equipamento} TAG {tag} ATUAL {horimetro_atual} PROX {proximo_horimetro} RESTA {horas_restantes} POR {responsavel}'
      }
    } as any)

    const ok = await notificarGeradorHorimetroManutencao({
      eqName: 'GERADOR',
      plateTag: 'E9A4808',
      currentHorimeter: 235,
      nextMaintenanceHorimeter: 250,
      remainingHours: 15,
      userName: 'Carlos Silva'
    })

    expect(ok).toBe(true)
    expect(sentPhone).toBe('120363408136247156@g.us')
    expect(sentText).toContain('GERADOR GERADOR TAG E9A4808 ATUAL 235 PROX 250 RESTA 15 POR Carlos Silva')
  })
})
