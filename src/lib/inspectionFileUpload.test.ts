import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getInspectionFiles, saveInspectionFile } from './inspectionFileUpload'
import { supabase } from './supabase'

describe('inspectionFileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve retornar mapa vazio se não houver registros salvos', async () => {
    vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
    } as any)

    const files = await getInspectionFiles()
    expect(files).toEqual({})
  })

  it('deve salvar arquivo com sucesso em global_settings', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null })
    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'global_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { value: { 'eq-1': {} } },
            error: null
          }),
          upsert: mockUpsert
        } as any
      }
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null })
      } as any
    })

    const success = await saveInspectionFile('eq-1', 'opacity_report', {
      url: 'https://storage.com/laudo.pdf',
      name: 'laudo.pdf',
      uploadedAt: '2026-11-11T12:00:00Z'
    })

    expect(success).toBe(true)
    expect(mockUpsert).toHaveBeenCalled()
  })
})
