import { describe, it, expect, vi, beforeEach } from 'vitest'
import { filterSystemModules, searchGlobalDatabase } from './globalSearch'

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        or: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({
            data:
              table === 'rh_efetivo'
                ? [{ id: '1', nome: 'João da Silva', cargo: 'Operador', matricula: '123', status: 'ATIVO' }]
                : table === 'eq_equipments'
                ? [{ id: '2', name: 'Caminhão Pipa', plate_tag: 'ABC-1234', category: 'Frota', status: 'Operando' }]
                : table === 'al_products'
                ? [{ id: '3', name: 'Capacete de Segurança', code: 'CAP-01', current_stock: 15, unit: 'un' }]
                : [],
            error: null,
          }),
        })),
        ilike: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({
            data:
              table === 'seguranca_dds'
                ? [{ id: '4', tema: 'Percepção de Riscos', date: '2026-11-01' }]
                : [],
            error: null,
          }),
        })),
      })),
    })),
  },
}))

describe('globalSearch', () => {
  it('filterSystemModules deve retornar os primeiros módulos quando query for vazia', () => {
    const res = filterSystemModules('')
    expect(res.length).toBeGreaterThan(0)
    expect(res[0].category).toBe('modulo')
  })

  it('filterSystemModules deve filtrar módulos por palavras-chave (ex: "epi")', () => {
    const res = filterSystemModules('epi')
    expect(res.some((r) => r.href.includes('almoxarifado') || r.title.toLowerCase().includes('epi'))).toBe(true)
  })

  it('filterSystemModules deve filtrar módulos por título (ex: "motorista")', () => {
    const res = filterSystemModules('motorista')
    expect(res.some((r) => r.href === '/equipamentos/app-motorista')).toBe(true)
  })

  it('searchGlobalDatabase deve trazer colaboradores com link direto para /rh/efetivo com id', async () => {
    const items = await searchGlobalDatabase('teste')
    const colab = items.find((i) => i.category === 'colaborador')
    expect(colab).toBeDefined()
    expect(colab?.title).toBe('João da Silva')
    expect(colab?.href).toContain('/rh/efetivo?id=1')
  })

  it('searchGlobalDatabase deve trazer equipamentos com link direto para /equipamentos/todos com id e tag', async () => {
    const items = await searchGlobalDatabase('teste')
    const eq = items.find((i) => i.category === 'equipamento')
    expect(eq).toBeDefined()
    expect(eq?.title).toContain('Caminhão Pipa')
    expect(eq?.href).toContain('/equipamentos/todos?id=2')
  })

  it('searchGlobalDatabase deve retornar array vazio se o termo for vazio', async () => {
    const items = await searchGlobalDatabase('   ')
    expect(items).toEqual([])
  })
})
