/**
 * Fonte única de verdade do status de localização de equipamentos/veículos.
 *
 * REGRA DE OURO:
 * Um equipamento/veículo só pode estar FORA da obra se existir um registro
 * de SAÍDA (movimento do tipo 'exit') em `eq_movements`. Status operacional
 * (reset de jornada, fim de turno, auto-reset de meia-noite) NUNCA deve
 * alterar a localização — apenas o registro de portaria pode.
 *
 * A coluna `eq_equipments.location_status` é tratada como cache materializado
 * do último movimento. O trigger no banco (`eq_sync_equipment_location_status`)
 * mantém esse cache consistente com `eq_movements`, inclusive em modo offline.
 */

/** Motivos de saída disponíveis. Espelha `EXIT_REASONS` das telas e o check do app. */
export const EXIT_REASONS = [
  { value: 'preventive_maintenance', label: 'Manutenção Preventiva' },
  { value: 'corrective_maintenance', label: 'Manutenção Corretiva' },
  { value: 'inspection', label: 'Vistoria' },
  { value: 'external_service', label: 'Serviço Externo' },
  { value: 'other', label: 'Outro' },
] as const

export type ExitReasonValue = (typeof EXIT_REASONS)[number]['value']

/** Motivos que caracterizam envio do equipamento para manutenção. */
export const MAINTENANCE_REASONS: ExitReasonValue[] = [
  'preventive_maintenance',
  'corrective_maintenance',
]

export type LocationStatus = 'inside' | 'outside'

/** Registros de portaria gravados em `eq_movements`. */
export interface MovementRecord {
  movement_type: 'entry' | 'exit'
  created_at?: string | null
  exit_reason?: string | null
  description?: string | null
  created_by?: string | null
}

/** Colunas de `eq_equipments` relevantes para o status de localização. */
export interface LocationEquipment {
  id?: string
  name?: string
  plate_tag?: string
  location_status?: string | null
  last_exit_reason?: string | null
  last_exit_description?: string | null
  status?: string | null
  updated_at?: string | null
}

export const isExitReason = (value: unknown): value is ExitReasonValue =>
  EXIT_REASONS.some(r => r.value === value)

export const exitReasonLabel = (value?: string | null): string | null => {
  if (!value) return null
  return EXIT_REASONS.find(r => r.value === value)?.label ?? value
}

/**
 * Normaliza o cache persistido.
 *
 * `null`, `undefined` e qualquer valor fora do domínio são tratados como
 * DESCONHECIDO (não como "fora da obra"). Antes, um `null` legado era lido
 * como fora em uma tela e como dentro em outra — comportamento inconsistente.
 */
export const normalizeLocationStatus = (
  value: string | null | undefined,
): LocationStatus => {
  if (value === 'outside') return 'outside'
  return 'inside'
}

/**
 * Fonte de verdade: o último movimento de portaria registrado.
 *
 * Retorna `null` quando não existe NENHUM movimento.
 */
export const lastMovement = (
  movements: MovementRecord[] | null | undefined,
): MovementRecord | null => {
  if (!movements || movements.length === 0) return null
  // Assume ordenação decrescente por created_at (padrão das queries do projeto).
  const sorted = [...movements].sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0
    const tb = b.created_at ? Date.parse(b.created_at) : 0
    return tb - ta
  })
  return sorted[0]
}

/**
 * Localização derivada do registro de portaria.
 * Se a lista de movimentos foi fornecida e está vazia, o equipamento NUNCA teve saída
 * registrada e portanto está DENTRO da obra ('inside').
 */
export const locationFromMovements = (
  movements: MovementRecord[] | null | undefined,
): LocationStatus | null => {
  if (movements === undefined || movements === null) return null
  if (movements.length === 0) return 'inside'
  const last = lastMovement(movements)
  if (!last) return 'inside'
  return last.movement_type === 'exit' ? 'outside' : 'inside'
}

/**
 * Localização efetiva do equipamento, com o movimento real como fonte de
 * verdade absoluta e o cache da tabela apenas como fallback quando não
 * há histórico de movimentos carregado.
 */
export const resolveLocationStatus = (
  equipment: LocationEquipment | null | undefined,
  movements?: MovementRecord[] | null,
): LocationStatus => {
  const fromMovements = locationFromMovements(movements)
  if (fromMovements) return fromMovements
  return normalizeLocationStatus(equipment?.location_status)
}

/** `true` somente quando existe uma SAÍDA registrada que justifique. */
export const isOutside = (
  equipment: LocationEquipment | null | undefined,
  movements?: MovementRecord[] | null,
): boolean => resolveLocationStatus(equipment, movements) === 'outside'

/** `true` somente quando existe ENTRADA registrada e nenhuma saída posterior. */
export const isInside = (
  equipment: LocationEquipment | null | undefined,
  movements?: MovementRecord[] | null,
): boolean => resolveLocationStatus(equipment, movements) === 'inside'

/** Rótulo exibido nos badges. Nunca inventa "Fora da Obra" sem registro de saída. */
export const locationLabel = (
  equipment: LocationEquipment | null | undefined,
  movements?: MovementRecord[] | null,
): string => {
  const status = resolveLocationStatus(equipment, movements)
  if (status === 'inside') return 'Operando'
  if (status === 'outside') return exitReasonLabel(equipment?.last_exit_reason) ?? 'Fora da Obra'
  return 'Sem movimentação registrada'
}

/** `true` quando o equipamento está fora por motivo de manutenção. */
export const isUnderMaintenance = (
  equipment: LocationEquipment | null | undefined,
  movements?: MovementRecord[] | null,
): boolean => {
  if (!isOutside(equipment, movements)) return false
  return MAINTENANCE_REASONS.includes(equipment?.last_exit_reason as ExitReasonValue)
}

/**
 * Detecta inconsistência entre o cache `location_status` e o último movimento.
 * Usado para depuração e para auditoria — deve sempre retornar `false`
 * depois que a migration de reconciliação for aplicada.
 */
export const hasLocationDrift = (
  equipment: LocationEquipment | null | undefined,
  movements: MovementRecord[] | null | undefined,
): boolean => {
  const fromMovements = locationFromMovements(movements)
  if (!fromMovements) return false
  return fromMovements !== normalizeLocationStatus(equipment?.location_status)
}

/**
 * Monta o patch de `eq_equipments` derivado de um movimento de portaria.
 * Este é o ÚNICO formato aceito para alterar localização.
 */
export const buildLocationPatch = (
  movementType: 'entry' | 'exit',
  opts: {
    exitReason?: string | null
    exitDescription?: string | null
    timestamp?: string | null
  } = {},
): { location_status: LocationStatus; last_exit_reason: string | null; last_exit_description: string | null; updated_at: string } => {
  const isEntry = movementType === 'entry'
  const reason = isEntry ? null : opts.exitReason ?? null
  return {
    location_status: isEntry ? 'inside' : 'outside',
    last_exit_reason: reason,
    last_exit_description: isEntry ? null : opts.exitDescription ?? null,
    updated_at: opts.timestamp ?? new Date().toISOString(),
  }
}