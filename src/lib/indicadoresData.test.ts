import { describe, it, expect } from 'vitest'
import {
  fmtMes,
  prevMes,
  fmtNum,
  statusDe,
  variacaoTxt,
  calcularTFTG,
  gerarTextoRelatorioIndicadores,
  extrairMesDeDataStr,
  contarDdsMes,
  contarOcorrenciasMes,
  contarDesviosMes,
  contarTreinamentosVencidos,
  contarInspecoesMes,
  INDICADORES_LISTA,
  type IndicadorConfig,
  type IndicadoresStore,
} from './indicadoresData'

describe('indicadoresData utils', () => {
  it('formats month correctly', () => {
    expect(fmtMes('2026-10')).toBe('out/2026')
    expect(fmtMes('2026-01')).toBe('jan/2026')
    expect(fmtMes('')).toBe('—')
  })

  it('calculates previous month correctly across year boundary', () => {
    expect(prevMes('2026-10')).toBe('2026-09')
    expect(prevMes('2026-01')).toBe('2025-12')
  })

  it('formats numbers with Brazilian locale', () => {
    expect(fmtNum(null)).toBe('—')
    expect(fmtNum(undefined)).toBe('—')
    expect(fmtNum(4.2, 2)).toBe('4,20')
    expect(fmtNum(100, 0)).toBe('100')
  })

  it('determines status correctly based on direction', () => {
    const indMenor: IndicadorConfig = {
      id: 'tf',
      nome: 'TF',
      desc: '',
      casas: 2,
      dir: 'menor',
      metaPadrao: 5,
      unidade: '',
      dica: '',
    }
    expect(statusDe(indMenor, 4.5, 5).dentro).toBe(true)
    expect(statusDe(indMenor, 5.0, 5).dentro).toBe(true)
    expect(statusDe(indMenor, 5.5, 5).dentro).toBe(false)
    expect(statusDe(indMenor, null, 5).dentro).toBeNull()

    const indMaior: IndicadorConfig = {
      id: 'dds',
      nome: 'DDS',
      desc: '',
      casas: 0,
      dir: 'maior',
      metaPadrao: 20,
      unidade: '',
      dica: '',
    }
    expect(statusDe(indMaior, 22, 20).dentro).toBe(true)
    expect(statusDe(indMaior, 18, 20).dentro).toBe(false)
  })

  it('calculates variation text correctly', () => {
    const ind: IndicadorConfig = {
      id: 'tf',
      nome: 'TF',
      desc: '',
      casas: 2,
      dir: 'menor',
      metaPadrao: 5,
      unidade: '',
      dica: '',
    }
    expect(variacaoTxt(ind, null, 5)).toContain('Sem valor')
    expect(variacaoTxt(ind, 4, null)).toContain('Sem mês anterior')
    const txt = variacaoTxt(ind, 4, 5)
    expect(txt).toContain('melhorou')
  })

  it('calculates TF and TG accurately', () => {
    const calc = calcularTFTG(100000, 2, 10)
    expect(calc.tf).toBe(20)
    expect(calc.tg).toBe(100)

    const zero = calcularTFTG(0, 2, 10)
    expect(zero.tf).toBe(0)
    expect(zero.tg).toBe(0)
  })

  it('generates report text', () => {
    const store: IndicadoresStore = {
      '2026-10': {
        valores: { tf: 4, tg: 80, acidentes: 0 },
        metas: { tf: 5, tg: 100, acidentes: 0 },
        salvoEm: '2026-10-30T10:00:00Z',
      },
    }
    const report = gerarTextoRelatorioIndicadores(store, '2026-10')
    expect(report).toContain('RELATÓRIO MENSAL — INDICADORES DE SEGURANÇA')
    expect(report).toContain('TF — Taxa de Frequência')
    expect(report).toContain('DENTRO DA META')
  })
})

describe('indicadores vinculados ao sistema (cálculos automáticos)', () => {
  it('extrairMesDeDataStr extrai ano-mês corretamente de múltiplos formatos', () => {
    expect(extrairMesDeDataStr('2026-11-03T18:00:00Z')).toBe('2026-11')
    expect(extrairMesDeDataStr('2026-11-03')).toBe('2026-11')
    expect(extrairMesDeDataStr('2026-11')).toBe('2026-11')
    expect(extrairMesDeDataStr('03/11/2026 às 15:30')).toBe('2026-11')
    expect(extrairMesDeDataStr('25/10/2026')).toBe('2026-10')
    expect(extrairMesDeDataStr(null)).toBeNull()
    expect(extrairMesDeDataStr('')).toBeNull()
    expect(extrairMesDeDataStr('data inválida')).toBeNull()
  })

  it('contarDdsMes conta apenas fotos/posts de DDS do mês solicitado', () => {
    const posts = [
      { id: '1', created_at: '2026-11-01T08:00:00Z', caption: '🎤 **DDS Realizado!**\nTema: Trabalho em Altura' },
      { id: '2', created_at: '2026-11-02T08:00:00Z', caption: '🎤 **DDS Realizado!**\nTema: Uso de EPI' },
      { id: '3', created_at: '2026-10-31T08:00:00Z', caption: '🎤 **DDS Realizado!**\nTema: Mês Passado' },
      { id: '4', created_at: '2026-11-03T10:00:00Z', caption: 'Foto de confraternização da equipe' },
    ]

    expect(contarDdsMes(posts, '2026-11')).toBe(2)
    expect(contarDdsMes(posts, '2026-10')).toBe(1)
    expect(contarDdsMes(posts, '2026-09')).toBe(0)
  })

  it('contarOcorrenciasMes separa acidentes de quase acidentes por anexo no mês', () => {
    const anexos = [
      { nome: 'relatorio_acidente_queda.pdf', titulo: 'Acidente de trabalho canteiro', anexadoEm: '05/11/2026 às 14:00' },
      { nome: 'cat_colaborador.pdf', titulo: 'Abertura de CAT', anexadoEm: '10/11/2026 às 09:30' },
      { nome: 'relato_quase_acidente.docx', titulo: 'Quase acidente na empilhadeira', anexadoEm: '15/11/2026 às 16:00' },
      { nome: 'quase_colisao.jpg', titulo: '', anexadoEm: '20/11/2026 às 11:00' },
      { nome: 'acidente_antigo.pdf', titulo: 'Acidente de Outubro', anexadoEm: '28/10/2026 às 10:00' },
    ]

    const resNov = contarOcorrenciasMes(anexos, '2026-11')
    expect(resNov.acidentes).toBe(2) // 2 acidentes em nov
    expect(resNov.quase).toBe(2) // 2 quase acidentes em nov

    const resOut = contarOcorrenciasMes(anexos, '2026-10')
    expect(resOut.acidentes).toBe(1)
    expect(resOut.quase).toBe(0)
  })

  it('contarDesviosMes conta desvios abertos e fechados respeitando mês e status', () => {
    const desvios = [
      // Aberto no mês atual
      { uid: 'd1', dataRegistro: '2026-11-01', statusFluxo: 'Aberto', corrigido: false },
      // Em andamento (aberto)
      { uid: 'd2', dataRegistro: '2026-11-02', statusFluxo: 'Em Andamento', corrigido: false },
      // Corrigido no mês atual
      { uid: 'd3', dataRegistro: '2026-10-25', dataCorrecao: '2026-11-03', statusFluxo: 'Corrigido', corrigido: true },
      // Corrigido no mês anterior
      { uid: 'd4', dataRegistro: '2026-10-10', dataCorrecao: '2026-10-20', statusFluxo: 'Corrigido', corrigido: true },
      // Cancelado (não conta)
      { uid: 'd5', dataRegistro: '2026-11-01', statusFluxo: 'Cancelado', corrigido: false },
    ]

    const nov = contarDesviosMes(desvios, '2026-11', '2026-11')
    expect(nov.desvAbertos).toBe(2)
    expect(nov.desvFechados).toBe(1)

    const out = contarDesviosMes(desvios, '2026-10', '2026-11')
    expect(out.desvFechados).toBe(1)
  })

  it('contarTreinamentosVencidos identifica treinamentos expirados', () => {
    const dataRef = new Date(2026, 10, 3, 12, 0, 0) // 03/11/2026
    const treinamentos = [
      { uid: 't1', expira: '2026-10-20' }, // Vencido
      { uid: 't2', expira: '2026-10-31' }, // Vencido
      { uid: 't3', expira: '2026-11-20' }, // Válido
      { uid: 't4', expira: '2027-05-10' }, // Válido
    ]

    expect(contarTreinamentosVencidos(treinamentos, dataRef)).toBe(2)
  })

  it('contarInspecoesMes soma inspeções de canteiro e cintas no mês', () => {
    const canteiro = [
      { data: '2026-11-02', local: 'Canteiro 1' },
      { data: '2026-11-08', local: 'Canteiro 2' },
      { data: '2026-10-20', local: 'Canteiro Antigo' },
    ]

    const cintas = [
      { inspecionadaEm: '05/11/2026', status: 'Inspecionada' },
      { data_inspecao: '2026-11-12', status: 'Inspecionada' },
      { inspecionadaEm: '15/10/2026', status: 'Inspecionada' },
      { inspecionadaEm: '20/11/2026', status: 'Cancelada' }, // não conta
    ]

    const res = contarInspecoesMes(canteiro, cintas, '2026-11')
    expect(res.canteiro).toBe(2)
    expect(res.cintas).toBe(2)
    expect(res.total).toBe(4)
  })
})
