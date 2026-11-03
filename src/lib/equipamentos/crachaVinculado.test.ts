import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  filtrarMotoristasEfetivo,
  filtrarEquipamentosPesados,
  getStorageKeyCracha,
  carregarVinculosCracha,
  salvarVinculosCracha,
  type MotoristaRH,
  type EquipamentoItem,
} from './crachaVinculado'

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              value: {
                'mot-1': ['eq-1', 'eq-2'],
                'mot-2': ['eq-3'],
              },
            },
            error: null,
          }),
        })),
      })),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}))

describe('Crachá Vinculado - Helpers e Filtros', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve filtrar apenas colaboradores ativos com cargo de motorista ou operador', () => {
    const lista: MotoristaRH[] = [
      { id: '1', nome: 'João Pipa', cargo: 'MOTORISTA DE CAMINHÃO PIPA', status: 'ATIVO' },
      { id: '2', nome: 'Carlos Munck', cargo: 'MOTORISTA DE CAMINHÃO MUNCK', status: 'ATIVO' },
      { id: '3', nome: 'Pedro Operador', cargo: 'OPERADOR DE MAQUINAS', status: 'ATIVO' },
      { id: '4', nome: 'Maria Silva', cargo: 'MOTORISTA OPERACIONAL', status: 'DEMITIDO' },
      { id: '5', nome: 'Lucas Ajudante', cargo: 'AJUDANTE GERAL', status: 'ATIVO' },
    ]

    const filtrados = filtrarMotoristasEfetivo(lista)
    expect(filtrados).toHaveLength(3)
    expect(filtrados.map((m) => m.nome)).toEqual(['João Pipa', 'Carlos Munck', 'Pedro Operador'])
  })

  it('deve filtrar apenas equipamentos pesados ou frotas pesadas', () => {
    const lista: EquipamentoItem[] = [
      { id: '1', name: 'CP 01', plate_tag: 'ABC-1234', type: 'Caminhão Pipa', category: 'Equipamento Pesado', status: 'Em operação' },
      { id: '2', name: 'CM 01', plate_tag: 'XYZ-9876', type: 'Caminhão Munk', category: 'Equipamento Pesado', status: 'Em operação' },
      { id: '3', name: 'OB 01', plate_tag: 'BUS-1122', type: 'Ônibus', category: 'Frota', status: 'Em operação' },
      { id: '4', name: 'ROÇADEIRA 71', plate_tag: '71', type: 'Roçadeira', category: 'Jardinagem', status: 'Em operação' },
      { id: '5', name: 'SOPRADOR 01', plate_tag: 'SO-01', type: 'Soprador', category: 'Jardinagem', status: 'Em operação' },
    ]

    const pesados = filtrarEquipamentosPesados(lista)
    expect(pesados).toHaveLength(3)
    expect(pesados.map((p) => p.name)).toEqual(['CP 01', 'CM 01', 'OB 01'])
  })

  it('deve gerar storage key correta por ambiente', () => {
    expect(getStorageKeyCracha('barcarena')).toBe('equipamentos_cracha_vinculado_barcarena')
    expect(getStorageKeyCracha('belem')).toBe('equipamentos_cracha_vinculado_belem')
  })

  it('deve carregar vínculos do Supabase com sucesso', async () => {
    const vinculos = await carregarVinculosCracha('barcarena')
    expect(vinculos).toBeDefined()
    expect(vinculos['mot-1']).toEqual(['eq-1', 'eq-2'])
    expect(vinculos['mot-2']).toEqual(['eq-3'])
  })

  it('deve salvar vínculos no Supabase com sucesso', async () => {
    const ok = await salvarVinculosCracha({ 'mot-1': ['eq-1'] }, 'barcarena')
    expect(ok).toBe(true)
  })
})
