import { describe, it, expect } from 'vitest'
import {
  CARGOS_MATRIZ,
  ehPersonalizada,
  getMesKey,
  getMesNome,
  criarEstadoInicial,
  getMetricasCargo,
  getMetricasGerais,
  FORMS_URL_MATRIZ,
  type AtividadeMatriz,
} from './matrizResponsabilidadesData'

describe('Matriz de Responsabilidades - Regras e Definições', () => {
  it('contém exatamente os 6 cargos obrigatórios', () => {
    expect(CARGOS_MATRIZ).toHaveLength(6)
    const nomes = CARGOS_MATRIZ.map((c) => c.nome)
    expect(nomes).toEqual([
      'Preposto',
      'Encarregado Geral',
      'Encarregado I',
      'Encarregado II',
      'Téc. Segurança I',
      'Téc. Segurança II',
    ])
  })

  it('possui 28 atividades padrão somadas nos 6 cargos', () => {
    const totalAtiv = CARGOS_MATRIZ.reduce((acc, c) => acc + c.atividades.length, 0)
    expect(totalAtiv).toBe(28)
    // 28 * 3 marcações = 84 marcações possíveis
    expect(totalAtiv * 3).toBe(84)
  })

  it('identifica a 7ª atividade como personalizada apenas para os Técnicos de Segurança I e II', () => {
    expect(ehPersonalizada('tec-1', 6)).toBe(true)
    expect(ehPersonalizada('tec-2', 6)).toBe(true)
    expect(ehPersonalizada('tec-1', 0)).toBe(false)
    expect(ehPersonalizada('preposto', 0)).toBe(false)
    expect(ehPersonalizada('enc-geral', 2)).toBe(false)
  })

  it('cria estado inicial zerado para um novo mês', () => {
    const estado = criarEstadoInicial()
    expect(Object.keys(estado)).toHaveLength(6)

    for (const c of CARGOS_MATRIZ) {
      const ativs = estado[c.id]
      expect(ativs).toHaveLength(c.atividades.length)
      for (const a of ativs) {
        expect(a.marks).toBe(0)
      }
    }
  })

  it('calcula métricas de um cargo com regra de 3 bolinhas', () => {
    const cargo = CARGOS_MATRIZ[0] // Preposto (5 atividades, 15 marcas max)
    const ativs: AtividadeMatriz[] = [
      { nome: 'Ativ 1', marks: 3 }, // Concluída (3/3)
      { nome: 'Ativ 2', marks: 2 }, // Em andamento (2/3)
      { nome: 'Ativ 3', marks: 1 }, // Em andamento (1/3)
      { nome: 'Ativ 4', marks: 0 }, // Pendente (0/3)
      { nome: 'Ativ 5', marks: 3 }, // Concluída (3/3)
    ]

    const metricas = getMetricasCargo(cargo, ativs)
    expect(metricas.totalAtividades).toBe(5)
    expect(metricas.totalMarcacoesPossiveis).toBe(15)
    expect(metricas.marcacoesFeitas).toBe(9) // 3 + 2 + 1 + 0 + 3 = 9
    expect(metricas.concluidas).toBe(2) // Apenas as com marks >= 3
    expect(metricas.porcentagem).toBe(60) // (9 / 15) * 100 = 60%
    expect(metricas.isConcluidoTotal).toBe(false)
  })

  it('considera cargo 100% somente se todas as atividades forem concluídas (3/3)', () => {
    const cargo = CARGOS_MATRIZ[1] // Encarregado Geral (3 atividades, 9 marcas)
    const ativs: AtividadeMatriz[] = [
      { nome: 'Ativ 1', marks: 3 },
      { nome: 'Ativ 2', marks: 3 },
      { nome: 'Ativ 3', marks: 3 },
    ]

    const metricas = getMetricasCargo(cargo, ativs)
    expect(metricas.concluidas).toBe(3)
    expect(metricas.porcentagem).toBe(100)
    expect(metricas.isConcluidoTotal).toBe(true)
  })

  it('calcula totais gerais somando todos os 6 cargos', () => {
    const estado = criarEstadoInicial()
    // Preposto conclui 100% (5 * 3 = 15)
    estado['preposto'] = estado['preposto'].map((a) => ({ ...a, marks: 3 }))

    const gerais = getMetricasGerais(estado)
    expect(gerais.totalCargos).toBe(6)
    expect(gerais.cargosConcluidos).toBe(1)
    expect(gerais.cargosPendentes).toBe(5)
    expect(gerais.ativTotal).toBe(28)
    expect(gerais.marcTotal).toBe(15)
    expect(gerais.marcMax).toBe(84)
    expect(gerais.pctGeral).toBe(Math.round((15 / 84) * 100)) // 18%
  })

  it('possui a URL real do Microsoft Forms', () => {
    expect(FORMS_URL_MATRIZ).toContain('https://forms.cloud.microsoft/Pages/ResponsePage.aspx')
    expect(FORMS_URL_MATRIZ).toContain('id=kYkdvChKUkWrwaznrhCCdO-80STG5SxAvb9Y_fx1cCNUQjVWRVRNSlE0Q08xNFhVNlFDSEFVTUJFNy4u')
  })

  it('gera chave de mês no formato YYYY-MM', () => {
    const d = new Date(2026, 9, 15) // Outubro 2026
    expect(getMesKey(d)).toBe('2026-10')
    expect(getMesNome(d)).toBe('Outubro')
  })
})

