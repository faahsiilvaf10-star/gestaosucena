import { supabase } from '../supabase'

export interface EquipmentMobilizationRecord {
  equipment_id: string
  mobilized_at?: string | null // ISO 8601 string
  demobilized_at?: string | null // ISO 8601 string
  demobilized_reason?: string | null
  updated_at?: string
  updated_by?: string
}

export const SETTINGS_KEY = 'equipment_mobilization_records'

export async function getEquipmentMobilizationMap(): Promise<Record<string, EquipmentMobilizationRecord>> {
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle()

    if (error || !data?.value) return {}
    return typeof data.value === 'string' ? JSON.parse(data.value) : data.value
  } catch (err) {
    console.warn('[Mobilizacao] Falha ao carregar registros de mobilização:', err)
    return {}
  }
}

export async function saveEquipmentMobilization(
  record: EquipmentMobilizationRecord
): Promise<void> {
  try {
    const currentMap = await getEquipmentMobilizationMap()
    const updatedMap = {
      ...currentMap,
      [record.equipment_id]: {
        ...currentMap[record.equipment_id],
        ...record,
        updated_at: new Date().toISOString(),
      },
    }

    await supabase.from('global_settings').upsert(
      {
        key: SETTINGS_KEY,
        value: updatedMap,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )
  } catch (err) {
    console.error('[Mobilizacao] Erro ao salvar registro de mobilização:', err)
    throw err
  }
}

export async function desmobilizarEquipamento(params: {
  equipmentId: string
  eqName: string
  plateTag: string
  demobilizedAt: string // ISO string
  reason?: string
  userName?: string
  environment?: string
}): Promise<void> {
  const env =
    params.environment ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('sucena_environment') || 'barcarena'
      : 'barcarena')

  // 1. Atualiza registro em global_settings
  await saveEquipmentMobilization({
    equipment_id: params.equipmentId,
    demobilized_at: params.demobilizedAt,
    demobilized_reason: params.reason || 'Desmobilizado da obra',
    updated_by: params.userName || 'Sistema',
  })

  // 2. Atualiza eq_equipments
  const d = new Date(params.demobilizedAt)
  const dateFormatted = !isNaN(d.getTime())
    ? `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : params.demobilizedAt

  await supabase
    .from('eq_equipments')
    .update({
      status: 'Desmobilizado',
      location_status: 'outside',
      last_exit_reason: 'demobilized',
      last_exit_description: `Desmobilizado em ${dateFormatted}${params.reason ? `: ${params.reason}` : ''}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.equipmentId)

  // 3. Registra saída em eq_movements para rastreabilidade de histórico
  try {
    await supabase.from('eq_movements').insert({
      equipment_id: params.equipmentId,
      movement_type: 'exit',
      exit_reason: 'demobilized',
      description: `Equipamento desmobilizado da obra em ${dateFormatted}${params.reason ? `: ${params.reason}` : ''}`,
      created_by: params.userName || 'Sistema',
      created_at: params.demobilizedAt,
      environment: env,
    })
  } catch (e) {
    console.warn('[Mobilizacao] Falha ao registrar movimento de saída:', e)
  }

  // 4. Registra system_activities para auditoria
  try {
    await supabase.from('system_activities').insert({
      module: 'Equipamentos',
      action: `[DESMOBILIZAÇÃO] ${params.eqName} (${params.plateTag}) desmobilizado em ${dateFormatted}`,
      user_name: params.userName || 'Sistema',
      environment: env,
    })
  } catch (e) {
    console.warn('[Mobilizacao] Falha ao registrar atividade:', e)
  }
}

export async function remobilizarEquipamento(params: {
  equipmentId: string
  eqName: string
  plateTag: string
  mobilizedAt?: string
  userName?: string
  environment?: string
}): Promise<void> {
  const env =
    params.environment ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('sucena_environment') || 'barcarena'
      : 'barcarena')

  const nowIso = params.mobilizedAt || new Date().toISOString()
  const d = new Date(nowIso)
  const dateFormatted = !isNaN(d.getTime())
    ? `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : nowIso

  // 1. Limpa demobilized_at em global_settings
  const currentMap = await getEquipmentMobilizationMap()
  const existing = currentMap[params.equipmentId] || { equipment_id: params.equipmentId }
  const updatedMap = {
    ...currentMap,
    [params.equipmentId]: {
      ...existing,
      demobilized_at: null,
      demobilized_reason: null,
      mobilized_at: existing.mobilized_at || nowIso,
      updated_at: new Date().toISOString(),
      updated_by: params.userName || 'Sistema',
    },
  }

  await supabase.from('global_settings').upsert(
    {
      key: SETTINGS_KEY,
      value: updatedMap,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  )

  // 2. Atualiza eq_equipments
  await supabase
    .from('eq_equipments')
    .update({
      status: 'Operando',
      location_status: 'inside',
      last_exit_reason: null,
      last_exit_description: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.equipmentId)

  // 3. Registra entrada em eq_movements
  try {
    await supabase.from('eq_movements').insert({
      equipment_id: params.equipmentId,
      movement_type: 'entry',
      description: `Equipamento remobilizado na obra em ${dateFormatted}`,
      created_by: params.userName || 'Sistema',
      created_at: nowIso,
      environment: env,
    })
  } catch (e) {
    console.warn('[Mobilizacao] Falha ao registrar movimento de entrada:', e)
  }

  // 4. Registra system_activities
  try {
    await supabase.from('system_activities').insert({
      module: 'Equipamentos',
      action: `[REMOBILIZAÇÃO] ${params.eqName} (${params.plateTag}) remobilizado em ${dateFormatted}`,
      user_name: params.userName || 'Sistema',
      environment: env,
    })
  } catch (e) {
    console.warn('[Mobilizacao] Falha ao registrar atividade:', e)
  }
}

/**
 * Função utilitária para verificar se um equipamento está desmobilizado
 */
export function isEquipmentDemobilized(
  eq: {
    id?: string
    status?: string | null
    last_exit_reason?: string | null
  },
  mobMap?: Record<string, EquipmentMobilizationRecord>
): boolean {
  if (eq.status === 'Desmobilizado' || eq.last_exit_reason === 'demobilized') {
    return true
  }
  if (eq.id && mobMap && mobMap[eq.id]?.demobilized_at) {
    return true
  }
  return false
}

export type RdoEquipmentStatus =
  | 'hidden_not_mobilized'
  | 'hidden_demobilized'
  | 'demobilized_today'
  | 'mobilized_today'
  | 'active'

/**
 * Verifica o status de exibição de um equipamento no RDO para uma data específica (YYYY-MM-DD).
 */
export function getEquipmentRdoStatus(
  equipmentId: string,
  queryDateStr: string, // YYYY-MM-DD
  mobMap?: Record<string, EquipmentMobilizationRecord>
): {
  status: RdoEquipmentStatus
  mobilizedTime?: string
  demobilizedTime?: string
  demobilizedDateTime?: string
} {
  const record = mobMap?.[equipmentId]
  if (!record) return { status: 'active' }

  const mobDate = record.mobilized_at ? record.mobilized_at.slice(0, 10) : null
  const desmobDate = record.demobilized_at ? record.demobilized_at.slice(0, 10) : null

  // 1. Antes da data de mobilização -> não aparece no RDO
  if (mobDate && queryDateStr < mobDate) {
    return { status: 'hidden_not_mobilized' }
  }

  // 2. Após a data de desmobilização -> não aparece no RDO
  if (desmobDate && queryDateStr > desmobDate) {
    return { status: 'hidden_demobilized' }
  }

  // 3. No dia exato da desmobilização -> aparece somente no dia com a hora
  if (desmobDate && queryDateStr === desmobDate) {
    const d = new Date(record.demobilized_at!)
    const demobilizedTime = !isNaN(d.getTime())
      ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : record.demobilized_at!.slice(11, 16) || '12:00'
    const demobilizedDateTime = !isNaN(d.getTime())
      ? `${d.toLocaleDateString('pt-BR')} às ${demobilizedTime}`
      : record.demobilized_at!

    return {
      status: 'demobilized_today',
      demobilizedTime,
      demobilizedDateTime,
    }
  }

  // 4. No dia exato da mobilização -> aparece com aviso de mobilização
  if (mobDate && queryDateStr === mobDate) {
    const d = new Date(record.mobilized_at!)
    const mobilizedTime = !isNaN(d.getTime())
      ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : record.mobilized_at!.slice(11, 16) || '07:00'

    return {
      status: 'mobilized_today',
      mobilizedTime,
    }
  }

  return { status: 'active' }
}
