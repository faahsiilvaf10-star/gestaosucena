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
  if (value === 'loaned' || value === 'Empréstimo') return 'Emprestado'
  const found = BROKEN_REASONS.find(r => r.value === value)
  return found ? found.label : value
}

/**
 * Identifica se um equipamento está marcado como emprestado para outra empresa.
 */
export function isLoanedEquipment(eq: {
  last_exit_reason?: string | null
  status?: string | null
  last_exit_description?: string | null
} | null | undefined): boolean {
  if (!eq) return false
  const reason = (eq.last_exit_reason || '').toLowerCase().trim()
  const status = (eq.status || '').toLowerCase().trim()
  const desc = (eq.last_exit_description || '').toLowerCase().trim()

  return (
    reason === 'loaned' ||
    reason === 'emprestimo' ||
    reason === 'empréstimo' ||
    status === 'emprestado' ||
    desc.startsWith('empresa:')
  )
}

/**
 * Extrai a empresa e as observações de um registro de empréstimo.
 */
export function parseLoanDetails(
  exitReason?: string | null,
  exitDescription?: string | null
): { company: string; notes: string } | null {
  const isLoan = isLoanedEquipment({ last_exit_reason: exitReason, last_exit_description: exitDescription })
  if (!isLoan) return null

  const desc = (exitDescription || '').trim()
  if (!desc) {
    return { company: 'Empresa não informada', notes: '' }
  }

  const companyMatch = desc.match(/Empresa:\s*([^|\n]+)/i)
  const company = companyMatch ? companyMatch[1].trim() : desc

  const notesMatch = desc.match(/\|\s*(?:Obs(?:ervação|ervações)?:?\s*)?(.*)$/i)
  const notes = notesMatch ? notesMatch[1].trim() : ''

  return { company, notes }
}

/**
 * Formata o texto persistido para saída de empréstimo.
 */
export function formatLoanDescription(company: string, notes?: string | null): string {
  const cleanCompany = (company || '').trim()
  const cleanNotes = (notes || '').trim()
  if (!cleanNotes) {
    return `Empresa: ${cleanCompany}`
  }
  return `Empresa: ${cleanCompany} | Obs: ${cleanNotes}`
}
