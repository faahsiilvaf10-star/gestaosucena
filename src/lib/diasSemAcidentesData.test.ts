import { describe, it, expect } from 'vitest'
import {
  calcularDiasSemAcidente,
  calcularProgressoMeta,
  obterFeitoSeguranca,
  CONFIG_PADRAO_PLACAR,
} from './diasSemAcidentesData'

describe('diasSemAcidentesData utils', () => {
  it('calcularDiasSemAcidente calcula dias corridos corretamente', () => {
    const hoje = new Date(2026, 10, 4, 12, 0, 0) // 04/11/2026
    // 4 dias antes
    expect(calcularDiasSemAcidente('2026-10-31', hoje)).toBe(4)
    // Mesmo dia
    expect(calcularDiasSemAcidente('2026-11-04', hoje)).toBe(0)
    // 30 dias antes
    expect(calcularDiasSemAcidente('2026-10-05', hoje)).toBe(30)
    // Data futura ou inválida
    expect(calcularDiasSemAcidente('2026-11-10', hoje)).toBe(0)
    expect(calcularDiasSemAcidente(null, hoje)).toBe(0)
    expect(calcularDiasSemAcidente('', hoje)).toBe(0)
    expect(calcularDiasSemAcidente('invalido', hoje)).toBe(0)
  })

  it('calcularProgressoMeta calcula porcentagem e dias restantes', () => {
    const p1 = calcularProgressoMeta(100, 200)
    expect(p1.porcentagem).toBe(50)
    expect(p1.diasRestantes).toBe(100)
    expect(p1.metaBatida).toBe(false)

    const p2 = calcularProgressoMeta(365, 365)
    expect(p2.porcentagem).toBe(100)
    expect(p2.diasRestantes).toBe(0)
    expect(p2.metaBatida).toBe(true)

    const p3 = calcularProgressoMeta(400, 365)
    expect(p3.porcentagem).toBe(100)
    expect(p3.diasRestantes).toBe(0)
    expect(p3.metaBatida).toBe(true)
  })

  it('obterFeitoSeguranca atribui o nível e insígnias corretos', () => {
    // Menos de 30 dias
    const inicio = obterFeitoSeguranca(15, 365, 400)
    expect(inicio.nivel).toBe('inicio')
    expect(inicio.icone).toBe('🎯')

    // Bronze (30+)
    const bronze = obterFeitoSeguranca(35, 365, 400)
    expect(bronze.nivel).toBe('bronze')
    expect(bronze.icone).toBe('🥉')

    // Prata (60+)
    const prata = obterFeitoSeguranca(75, 365, 400)
    expect(prata.nivel).toBe('prata')
    expect(prata.icone).toBe('🥈')

    // Ouro (100+)
    const ouro = obterFeitoSeguranca(120, 365, 400)
    expect(ouro.nivel).toBe('ouro')
    expect(ouro.icone).toBe('🥇')

    // Diamante (365+)
    const diamante = obterFeitoSeguranca(370, 500, 500)
    expect(diamante.nivel).toBe('diamante')
    expect(diamante.icone).toBe('💎')

    // Recorde Histórico superado
    const recorde = obterFeitoSeguranca(450, 365, 400)
    expect(recorde.nivel).toBe('recorde')
    expect(recorde.icone).toBe('🏆')
  })
})

