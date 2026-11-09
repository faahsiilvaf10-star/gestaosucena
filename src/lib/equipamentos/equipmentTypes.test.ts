import { describe, it, expect } from 'vitest'
import { isVehicle, BROKEN_REASONS, getBrokenReasonLabel } from './equipmentTypes'

describe('equipmentTypes - isVehicle', () => {
  it('retorna true para caminhões e ônibus', () => {
    expect(isVehicle({ name: 'CP 01', type: 'Caminhão Pipa' })).toBe(true)
    expect(isVehicle({ name: 'OB 01', type: 'Ônibus' })).toBe(true)
    expect(isVehicle({ name: 'CM 01', type: 'Caminhão Munk' })).toBe(true)
    expect(isVehicle({ name: 'SUC 01', type: 'Pick Up/Toro' })).toBe(true)
    expect(isVehicle({ name: 'Van Master', type: 'Van' })).toBe(true)
  })

  it('retorna false para equipamentos puros (jardinagem, canteiro, geradores)', () => {
    expect(isVehicle({ name: 'ROÇADEIRA', type: 'Roçadeira', category: 'Jardinagem' })).toBe(false)
    expect(isVehicle({ name: 'SOPRADOR', type: 'Soprador', category: 'Jardinagem' })).toBe(false)
    expect(isVehicle({ name: 'PERFURADOR', type: 'Perfurador', category: 'Jardinagem' })).toBe(false)
    expect(isVehicle({ name: 'MOTOPODA', type: 'Motopoda', category: 'Jardinagem' })).toBe(false)
    expect(isVehicle({ name: 'MOTOSERRA', type: 'Motoserra', category: 'Jardinagem' })).toBe(false)
    expect(isVehicle({ name: 'IRRIGATE', type: 'Carretel de Irrigação', category: 'Jardinagem' })).toBe(false)
    expect(isVehicle({ name: 'GERADOR', type: 'Gerador', category: 'Canteiro' })).toBe(false)
  })

  it('retorna false para valores nulos ou vazios', () => {
    expect(isVehicle(null)).toBe(false)
    expect(isVehicle(undefined)).toBe(false)
    expect(isVehicle({})).toBe(false)
  })

  it('retorna rótulo legível do motivo da quebra', () => {
    expect(getBrokenReasonLabel('mechanical_failure')).toBe('Falha Mecânica')
    expect(getBrokenReasonLabel('electrical_failure')).toBe('Falha Elétrica')
    expect(getBrokenReasonLabel('waiting_parts')).toBe('Aguardando Peça / Acessório')
    expect(getBrokenReasonLabel(null)).toBe('Defeito não especificado')
    expect(getBrokenReasonLabel('outro_qualquer')).toBe('outro_qualquer')
  })
})
