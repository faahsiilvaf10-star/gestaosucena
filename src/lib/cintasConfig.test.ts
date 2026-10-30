import { describe, it, expect } from 'vitest'
import {
  getMesInspecaoAtual,
  isInspecionadaNesteMes,
  mesesInspecao,
  colorConfigs,
} from './cintasConfig'

describe('cintasConfig', () => {
  it('retorna a cor correta para cada mês do ano', () => {
    // 0 = Jan -> Vermelho
    expect(getMesInspecaoAtual(new Date(2026, 0, 15)).cor).toBe('Vermelho')
    // 1 = Fev -> Azul
    expect(getMesInspecaoAtual(new Date(2026, 1, 15)).cor).toBe('Azul')
    // 2 = Mar -> Amarelo
    expect(getMesInspecaoAtual(new Date(2026, 2, 15)).cor).toBe('Amarelo')
    // 3 = Abr -> Verde
    expect(getMesInspecaoAtual(new Date(2026, 3, 15)).cor).toBe('Verde')
    // 8 = Set -> Vermelho
    expect(getMesInspecaoAtual(new Date(2026, 8, 15)).cor).toBe('Vermelho')
    // 9 = Out -> Azul (Cor proibida do mês de Outubro!)
    expect(getMesInspecaoAtual(new Date(2026, 9, 15)).cor).toBe('Azul')
    expect(getMesInspecaoAtual(new Date(2026, 9, 15)).label).toBe('outubro de 2026')
  })

  it('possui as 4 cores configuradas com estilos válidos', () => {
    const cores = ['Vermelho', 'Azul', 'Amarelo', 'Verde'] as const
    cores.forEach((cor) => {
      expect(colorConfigs[cor]).toBeDefined()
      expect(colorConfigs[cor].accentHex).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(colorConfigs[cor].dotClass).toContain('bg-')
    })
  })

  it('valida corretamente se uma cinta foi inspecionada no mês de referência', () => {
    const refDate = new Date(2026, 9, 30) // Outubro 2026

    expect(
      isInspecionadaNesteMes(
        { status: 'Inspecionada', inspecionadaEm: '10/10/2026' },
        refDate
      )
    ).toBe(true)

    expect(
      isInspecionadaNesteMes(
        { status: 'Inspecionada', inspecionadaEm: '09/09/2026' },
        refDate
      )
    ).toBe(false)

    expect(
      isInspecionadaNesteMes(
        { status: 'Pendente', inspecionadaEm: '10/10/2026' },
        refDate
      )
    ).toBe(false)

    expect(
      isInspecionadaNesteMes(
        { status: 'Inspecionada', inspecionadaEm: null },
        refDate
      )
    ).toBe(false)
  })
})
