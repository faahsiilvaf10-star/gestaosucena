import { describe, it, expect } from 'vitest'
import {
  calcularDiasSemAcidente,
  calcularDataRetroativa,
  calcularProgressoMeta,
  obterFeitoSeguranca,
  CONFIG_PADRAO_PLACAR,
  formatarDataBr,
  normalizarDataIso,
} from './diasSemAcidentesData'

describe('diasSemAcidentesData utils', () => {
  it('formatarDataBr e normalizarDataIso convertem datas corretamente', () => {
    expect(formatarDataBr('2026-07-20')).toBe('20/07/2026')
    expect(formatarDataBr('')).toBe('—')
    expect(formatarDataBr(null)).toBe('—')

    expect(normalizarDataIso('20/07/2026')).toBe('2026-07-20')
    expect(normalizarDataIso('2026-07-20')).toBe('2026-07-20')
    expect(normalizarDataIso('')).toBe('')
    expect(normalizarDataIso(null)).toBe('')
  })

  it('calcularDataRetroativa calcula a data ISO corretamente a partir dos dias', () => {
    const hoje = new Date(2026, 10, 4, 12, 0, 0) // 04/11/2026
    expect(calcularDataRetroativa(0, hoje)).toBe('2026-11-04')
    expect(calcularDataRetroativa(4, hoje)).toBe('2026-10-31')
    expect(calcularDataRetroativa(30, hoje)).toBe('2026-10-05')
  })

  it('calcularDataRetroativa e calcularDiasSemAcidente sao operacoes inversas', () => {
    const hoje = new Date(2026, 10, 23, 9, 0, 0)
    const diasComAfastamento = 290
    const dataComAfastamento = calcularDataRetroativa(diasComAfastamento, hoje)
    expect(calcularDiasSemAcidente(dataComAfastamento, hoje)).toBe(290)

    const diasSemAfastamento = 90
    const dataSemAfastamento = calcularDataRetroativa(diasSemAfastamento, hoje)
    expect(calcularDiasSemAcidente(dataSemAfastamento, hoje)).toBe(90)
  })

  it('CONFIG_PADRAO_PLACAR possui os valores padrão alinhados à referência', () => {
    expect(CONFIG_PADRAO_PLACAR.nomeObra).toBe('PLACAR DA OBRA')
    expect(CONFIG_PADRAO_PLACAR.fraseDestaque).toBe('NOSSO MAIOR VALOR É A VIDA')
    expect(CONFIG_PADRAO_PLACAR.metaDias).toBe(365)
    expect(CONFIG_PADRAO_PLACAR.recordeHistoricoDias).toBe(365)
    expect(CONFIG_PADRAO_PLACAR.diasSemAcidentesComAfastamento).toBe(290)
    expect(CONFIG_PADRAO_PLACAR.diasSemAfastamento).toBe(90)
  })
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

