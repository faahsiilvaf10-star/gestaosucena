import { describe, it, expect } from 'vitest'
import {
  fmtDate,
  hojeISO,
  diasAte,
  progresso,
  statusDe,
  prazoTxt,
  ETAPAS_NOVATOS,
  gerarTextoRelatorioNovatos,
  type NovatoItem,
} from './novatosData'

describe('novatosData utils', () => {
  it('formats dates to Brazilian standard', () => {
    expect(fmtDate('2026-10-30')).toBe('30/10/2026')
    expect(fmtDate('')).toBe('—')
    expect(fmtDate(undefined)).toBe('—')
  })

  it('calculates days relative to today', () => {
    const hj = hojeISO()
    expect(diasAte(hj)).toBe(0)

    const am = new Date()
    am.setDate(am.getDate() + 5)
    const ano = am.getFullYear()
    const mes = String(am.getMonth() + 1).padStart(2, '0')
    const dia = String(am.getDate()).padStart(2, '0')
    expect(diasAte(`${ano}-${mes}-${dia}`)).toBe(5)
  })

  it('calculates progress percentage based on 6 stages', () => {
    expect(progresso({ etapas: [] })).toBe(0)
    expect(progresso({ etapas: ['Integração de segurança'] })).toBe(17)
    expect(progresso({ etapas: ['1', '2', '3'] })).toBe(50)
    expect(progresso({ etapas: [...ETAPAS_NOVATOS] })).toBe(100)
  })

  it('determines status correctly: Concluído, Atrasado, Em integração', () => {
    const concluido = {
      etapas: [...ETAPAS_NOVATOS],
      prazo: '2026-10-01',
    }
    expect(statusDe(concluido)).toBe('Concluído')

    const atrasado = {
      etapas: ['Integração de segurança'],
      prazo: '2026-01-01',
    }
    expect(statusDe(atrasado)).toBe('Atrasado')

    const emIntegracao = {
      etapas: ['Integração de segurança'],
      prazo: '2099-01-01',
    }
    expect(statusDe(emIntegracao)).toBe('Em integração')
  })

  it('generates formatted report text', () => {
    const item: NovatoItem = {
      uid: 'n1',
      nome: 'João da Silva',
      cargo: 'Ajudante',
      matricula: '1234',
      admissao: '2026-10-01',
      setor: 'Terraplenagem',
      tutor: 'Carlos Padrinho',
      prazo: '2026-11-01',
      etapas: ['Integração de segurança', 'Uso de EPI'],
      salvoEm: '30/10/2026 às 10:00',
    }

    const relatorio = gerarTextoRelatorioNovatos([item])
    expect(relatorio).toContain('PROGRAMA DE NOVATOS')
    expect(relatorio).toContain('João da Silva')
    expect(relatorio).toContain('Carlos Padrinho')
    expect(relatorio).toContain('Terraplenagem')
  })
})
