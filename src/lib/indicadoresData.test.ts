import { describe, it, expect } from 'vitest'
import {
  fmtMes,
  prevMes,
  fmtNum,
  statusDe,
  variacaoTxt,
  calcularTFTG,
  gerarTextoRelatorioIndicadores,
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

