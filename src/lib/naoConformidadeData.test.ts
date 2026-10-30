import { describe, it, expect } from 'vitest'
import {
  fmtData,
  contarPorCampo,
  gerarTextoRelatorioNC,
  type NaoConformidadeItem,
} from './naoConformidadeData'

describe('naoConformidadeData helper functions', () => {
  it('formats dates properly', () => {
    expect(fmtData('2026-10-30')).toBe('30/10/2026')
    expect(fmtData(undefined)).toBe('—')
    expect(fmtData('')).toBe('—')
  })

  it('counts by field correctly', () => {
    const items = [
      { status: 'Aberta', classificacao: 'Crítica' },
      { status: 'Fechada', classificacao: 'Menor' },
      { status: 'Aberta', classificacao: 'Menor' },
    ]

    const porStatus = contarPorCampo(items, 'status')
    expect(porStatus['Aberta']).toBe(2)
    expect(porStatus['Fechada']).toBe(1)

    const porClassif = contarPorCampo(items, 'classificacao')
    expect(porClassif['Menor']).toBe(2)
    expect(porClassif['Crítica']).toBe(1)
  })

  it('generates text report correctly', () => {
    const ncs: NaoConformidadeItem[] = [
      {
        id: '1',
        numero: 'NC-2026-001',
        data: '2026-10-25',
        local: 'Canteiro Central',
        descricao: 'Falta de cinto de segurança',
        classificacao: 'Crítica',
        prazo: '2026-10-28',
        responsavel: 'Carlos Lima',
        status: 'Fechada',
        verificacao: {
          eficaz: 'sim',
          obs: 'Trabalho regularizado com linha de vida.',
          data: '2026-10-28',
        },
      },
    ]

    const report = gerarTextoRelatorioNC(ncs)
    expect(report).toContain('RELATÓRIO DE NÃO CONFORMIDADE')
    expect(report).toContain('Total de NCs: 1')
    expect(report).toContain('Fechadas: 1 (100%)')
    expect(report).toContain('NC-2026-001')
    expect(report).toContain('Carlos Lima')
    expect(report).toContain('Verificação: eficaz')
  })
})

