import { describe, it, expect } from 'vitest'
import {
  fmtData,
  parseData,
  diasParaPrazo,
  statusEfetivo,
  isVencido,
  prazoInfo,
  gerarTextoRelatorio,
  hojeISO,
  type PlanoAcaoItem,
} from './planoAcaoData'

describe('planoAcaoData helper functions', () => {
  it('correctly parses and formats dates', () => {
    expect(fmtData('2026-10-30')).toBe('30/10/2026')
    expect(fmtData(undefined)).toBe('—')
    expect(fmtData('')).toBe('—')
    expect(parseData('invalid')).toBeNull()
  })

  it('calculates deadline days correctly', () => {
    const today = hojeISO()
    expect(diasParaPrazo(today)).toBe(0)

    // Future date
    const d = new Date()
    d.setDate(d.getDate() + 5)
    const future = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    expect(diasParaPrazo(future)).toBe(5)

    // Past date
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 3)
    const past = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, '0')}-${String(pastDate.getDate()).padStart(2, '0')}`
    expect(diasParaPrazo(past)).toBe(-3)
  })

  it('computes effective status and vencido check', () => {
    const openItem: PlanoAcaoItem = {
      id: '1',
      origem: 'Desvio',
      acao: 'Instalar guarda-corpo',
      responsavel: 'João',
      dataAbertura: '2026-10-01',
      prioridade: 'Crítica',
      status: 'Pendente',
    }

    expect(isVencido(openItem)).toBe(false)
    expect(statusEfetivo(openItem)).toBe('Pendente')

    const doingItem: PlanoAcaoItem = {
      ...openItem,
      status: 'Em andamento',
    }
    expect(statusEfetivo(doingItem)).toBe('Em andamento')

    const concludedItem: PlanoAcaoItem = {
      ...openItem,
      status: 'Concluído',
      feito: 'Guarda-corpo instalado',
      concluidoEm: '2026-10-25',
    }

    expect(isVencido(concludedItem)).toBe(false)
    expect(statusEfetivo(concludedItem)).toBe('Concluído')
  })

  it('generates accurate conclusion descriptions', () => {
    const infoPendente = prazoInfo({ status: 'Pendente' })
    expect(infoPendente.texto).toBe('')

    const infoConcluido = prazoInfo({
      status: 'Concluído',
      concluidoEm: '2026-10-18',
    })
    expect(infoConcluido.classe).toBe('ok')
    expect(infoConcluido.texto).toBe('Concluída em 18/10/2026')
  })

  it('generates full text report', () => {
    const items: PlanoAcaoItem[] = [
      {
        id: '1',
        origem: 'Desvio',
        acao: 'Corrigir fiação',
        responsavel: 'Carlos',
        dataAbertura: '2026-10-01',
        prazo: '2026-11-15',
        prioridade: 'Alta',
        status: 'Em andamento',
      },
    ]

    const report = gerarTextoRelatorio(items)
    expect(report).toContain('RELATÓRIO — PLANO DE AÇÃO — SEGURANÇA')
    expect(report).toContain('Total de ações: 1')
    expect(report).toContain('Corrigir fiação')
    expect(report).toContain('Carlos')
  })
})
