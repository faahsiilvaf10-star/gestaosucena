import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getDdsAttachments,
  saveDdsAttachments,
  deleteDdsAttachment,
  DdsAttachment
} from './ddsAttachments'
import { supabase } from './supabase'

describe('ddsAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve retornar lista vazia quando não houver anexos salvos', async () => {
    vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
    } as any)

    const attachments = await getDdsAttachments('barcarena')
    expect(attachments).toEqual([])
  })

  it('deve salvar anexos com sucesso no banco de dados', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null })
    vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { value: [] }, error: null }),
      upsert: mockUpsert
    } as any)

    const item: DdsAttachment = {
      id: 'att-1',
      name: 'dds-tema-seguranca.pdf',
      url: 'https://storage.com/dds-tema-seguranca.pdf',
      fileType: 'pdf',
      size: 1024,
      uploadedAt: new Date().toISOString(),
      date: '2026-11-11'
    }

    const ok = await saveDdsAttachments([item], 'barcarena')
    expect(ok).toBe(true)
    expect(mockUpsert).toHaveBeenCalled()
  })

  it('deve excluir anexo pelo id corretamente', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null })
    const existing: DdsAttachment = {
      id: 'att-1',
      name: 'regras.pdf',
      url: 'https://storage.com/regras.pdf',
      fileType: 'pdf',
      uploadedAt: new Date().toISOString()
    }

    vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { value: [existing] }, error: null }),
      upsert: mockUpsert
    } as any)

    const ok = await deleteDdsAttachment('att-1', 'barcarena')
    expect(ok).toBe(true)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        value: []
      })
    )
  })
})
