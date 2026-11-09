/**
 * Utilitários para distinção entre Equipamentos e Veículos,
 * e definições para controle de Equipamentos Parados / Quebrados.
 */

export interface BaseEquipmentRecord {
  id?: string
  name?: string | null
  plate_tag?: string | null
  type?: string | null
  category?: string | null
}

/**
 * Identifica se um registro é um veículo (ex: Caminhões, Ônibus, Pick-up/Toro, etc.)
 * ou um equipamento puro (ex: Roçadeiras, Motopodas, Motoserras, Sopradores, Perfuradores, Geradores, Carretéis, etc.).
 */
export function isVehicle(eq: BaseEquipmentRecord | null | undefined): boolean {
  if (!eq) return false

  const type = (eq.type || '').toLowerCase().trim()
  const name = (eq.name || '').toLowerCase().trim()

  // Equipamentos conhecidos que contêm prefixos como "moto" mas NÃO são veículos
  const toolExceptions = ['motopoda', 'motoserra', 'moto-serra', 'moto-poda', 'motobomba', 'moto-bomba', 'motopulverizador']
  if (toolExceptions.some(t => type.includes(t) || name.includes(t))) {
    return false
  }

  // Palavras ou termos de veículos
  const vehicleRegex = /\b(caminh[aã]o|caminh[oõ]es|ônibus|onibus|pick[\s-]?up|pickup|toro|saveiro|strada|hilux|s10|ranger|munk|pipa|carro|van|ve[ií]culo|motocicleta|motociclo|cavalo\s*mec[aâ]nico|carreta|utilit[aá]rio)\b/i

  if (vehicleRegex.test(type) || vehicleRegex.test(name)) {
    return true
  }

  // "moto" isolada (não motopoda/motoserra)
  if (/\bmoto\b/i.test(type) || /\bmoto\b/i.test(name)) {
    return true
  }

  // Padrões de código de frota (CP = Caminhão Pipa, CM = Caminhão Munk, OB = Ônibus, SUC = Toro/Pick Up)
  if (/^(cp\s*\d+|cm\s*\d+|ob\s*\d+|suc\s*\d+)/i.test(name)) {
    return true
  }

  return false
}

/**
 * Motivos de parada / quebra para equipamentos (sem ser veículos).
 */
export const BROKEN_REASONS = [
  { value: 'corrective_maintenance', label: 'Manutenção Corretiva' },
  { value: 'mechanical_failure', label: 'Falha Mecânica' },
  { value: 'electrical_failure', label: 'Falha Elétrica' },
  { value: 'waiting_parts', label: 'Aguardando Peça / Acessório' },
  { value: 'blade_cutting_wear', label: 'Desgaste / Lâmina / Fio / Corrente' },
  { value: 'leak_overheating', label: 'Vazamento / Superaquecimento' },
  { value: 'other', label: 'Outro Defeito' },
] as const

export type BrokenReasonValue = (typeof BROKEN_REASONS)[number]['value']

export function getBrokenReasonLabel(value?: string | null): string {
  if (!value) return 'Defeito não especificado'
  const found = BROKEN_REASONS.find(r => r.value === value)
  return found ? found.label : value
}
