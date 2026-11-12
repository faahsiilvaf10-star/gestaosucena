import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notificarDesvioRegistrado, notificarDesvioCorrigido } from './desviosWhatsapp'
import * as settingsMod from './settings'
import * as whatsappApiMod from './whatsapp-api'
import { supabase } from './supabase'

describe('desviosWhatsapp', () => {
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

    vi.spyOn(supabase, 'from').mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    } as any)
  })

  it('notificarDesvioRegistrado deve enviar mensagem de texto e fotos', async () => {
    vi.spyOn(settingsMod, 'getWhatsappSettings').mockResolvedValue({
      url: 'https://api.wapi.test',
      instanceId: 'inst_1',
      token: 'tok_1',
      groupId: 'default@g.us',
      desviosSeguranca: {
        enabled: true,
        specificGroupId: '120363409913606942@g.us',
      },
      messageTemplates: {
        desvioRegistrado: 'NOVO: {titulo} no local {local}. Prioridade: {prioridade}',
      },
    } as any)

    await notificarDesvioRegistrado(
      {
        uid: 'desv-1',
        titulo: 'Falta de EPI',
        descricao: 'Colaborador sem óculos',
        local: 'Oficina',
        categoria: 'EPI',
        prioridade: 'Alta',
        risco: 'Queda',
        gravidade: 'Alta',
        tecnico: 'Carlos Segurança',
        previsao: '2026-11-20',
      },
      ['data:image/jpeg;base64,abc123']
    )

    expect(sentTexts).toHaveLength(1)
    expect(sentTexts[0].phone).toBe('120363409913606942@g.us')
    expect(sentTexts[0].text).toContain('Falta de EPI')
    expect(sentTexts[0].text).toContain('Oficina')
    expect(sentMedia).toHaveLength(1)
    expect(sentMedia[0].caption).toContain('Falta de EPI')
  })

  it('notificarDesvioCorrigido deve enviar mensagem de correção com dados e fotos anexadas', async () => {
    vi.spyOn(settingsMod, 'getWhatsappSettings').mockResolvedValue({
      url: 'https://api.wapi.test',
      instanceId: 'inst_1',
      token: 'tok_1',
      groupId: 'default@g.us',
      desviosSeguranca: {
        enabled: true,
        specificGroupId: '120363409913606942@g.us',
      },
      messageTemplates: {
        desvioCorrigido: 'CORRIGIDO: {titulo}. Correção: {correcao}. Feito por: {usuario}',
      },
    } as any)

    await notificarDesvioCorrigido(
      {
        uid: 'desv-1',
        titulo: 'Poltronas Danificadas Ônibus',
        descricao: 'Poltronas quebradas',
        local: 'Transporte',
        categoria: 'Frota',
        prioridade: 'Média',
        risco: 'Ergonomia',
        gravidade: 'Média',
        tecnico: 'Alexssandro Chaves',
        correcaoTexto: 'Instalação das travas e encostos das poltronas 33 e 34.',
        usuario: 'Alexssandro Chaves',
        dataCorrecao: '12/11/2026, 14:39:16',
      },
      ['data:image/jpeg;base64,foto1', 'data:image/jpeg;base64,foto2']
    )

    expect(sentTexts).toHaveLength(1)
    expect(sentTexts[0].phone).toBe('120363409913606942@g.us')
    expect(sentTexts[0].text).toContain('Poltronas Danificadas Ônibus')
    expect(sentTexts[0].text).toContain('Instalação das travas e encostos das poltronas 33 e 34.')
    expect(sentTexts[0].text).toContain('Alexssandro Chaves')

    expect(sentMedia).toHaveLength(2)
    expect(sentMedia[0].caption).toContain('Poltronas Danificadas Ônibus')
    expect(sentMedia[0].caption).toContain('(1/2)')
    expect(sentMedia[1].caption).toContain('(2/2)')
  })

  it('não deve enviar se desviosSeguranca estiver desativado', async () => {
    vi.spyOn(settingsMod, 'getWhatsappSettings').mockResolvedValue({
      url: 'https://api.wapi.test',
      instanceId: 'inst_1',
      token: 'tok_1',
      desviosSeguranca: {
        enabled: false,
        specificGroupId: '120363409913606942@g.us',
      },
    } as any)

    await notificarDesvioCorrigido(
      {
        uid: 'desv-2',
        titulo: 'Teste',
        descricao: 'Desc',
        local: 'Local',
        categoria: 'Cat',
        prioridade: 'Baixa',
        risco: 'Risco',
        gravidade: 'Baixa',
        tecnico: 'Tec',
        correcaoTexto: 'Texto',
      },
      []
    )

    expect(sentTexts).toHaveLength(0)
    expect(sentMedia).toHaveLength(0)
  })
})
