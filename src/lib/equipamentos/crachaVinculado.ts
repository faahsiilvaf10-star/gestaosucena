import { supabase, rawSupabase } from '../supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export interface MotoristaRH {
  id: string
  nome: string
  cargo: string
  status: string
  matricula?: string
  foto_url?: string
}

export interface EquipamentoItem {
  id: string
  name: string
  plate_tag: string
  type: string
  category: string
  status: string
}

export interface CrachaVinculo {
  id: string
  environment: string
  motorista_id: string
  equipamento_id: string
  created_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtros de negócio
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filtra colaboradores do RH cujo cargo seja de motorista ou operador
 */
export function filtrarMotoristasEfetivo(colaboradores: MotoristaRH[]): MotoristaRH[] {
  if (!Array.isArray(colaboradores)) return []
  return colaboradores.filter((colab) => {
    const s = (colab.status || '').toUpperCase()
    if (s.includes('DEMITIDO') || s.includes('INATIVO') || s.includes('DESLIGADO')) {
      return false
    }
    const cargo = (colab.cargo || '').toUpperCase()
    return (
      cargo.includes('MOTORISTA') ||
      cargo.includes('OPERADOR') ||
      cargo.includes('PILOTO') ||
      cargo.includes('CONDUTOR')
    )
  })
}

/**
 * Filtra equipamentos que pertencem à categoria pesada ou tipos de veículos pesados
 */
export function filtrarEquipamentosPesados(equipamentos: EquipamentoItem[]): EquipamentoItem[] {
  if (!Array.isArray(equipamentos)) return []
  return equipamentos.filter((eq) => {
    const cat = (eq.category || '').toLowerCase()
    const tipo = (eq.type || '').toLowerCase()
    const nome = (eq.name || '').toLowerCase()

    return (
      cat.includes('pesad') ||
      cat.includes('frota') ||
      tipo.includes('caminh') ||
      tipo.includes('onibus') ||
      tipo.includes('ônibus') ||
      tipo.includes('munck') ||
      tipo.includes('munk') ||
      tipo.includes('pipa') ||
      tipo.includes('trator') ||
      tipo.includes('retro') ||
      tipo.includes('escav') ||
      tipo.includes('pick up') ||
      nome.includes('cp ') ||
      nome.includes('cm ') ||
      nome.includes('ob ')
    )
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD — Tabela dedicada eq_cracha_vinculos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Carrega todos os vínculos do ambiente como mapa { [motorista_id]: equipamento_id[] }
 * Faz fallback para global_settings (legado) se a tabela ainda não existir.
 */
export async function carregarVinculosCracha(
  env: string = 'barcarena'
): Promise<Record<string, string[]>> {
  const localKey = `hydro-cracha-vinculos-${env}`

  try {
    const { data, error } = await rawSupabase
      .from('eq_cracha_vinculos')
      .select('motorista_id, equipamento_id')
      .eq('environment', env)

    if (error) {
      // Tabela ainda não existe → tenta legado
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return _carregarVinculosLegado(env, localKey)
      }
      console.warn('[Crachá Vinculado] Erro ao carregar:', error.message)
      return _carregarCacheLocal(localKey)
    }

    const mapa: Record<string, string[]> = {}
    for (const row of data || []) {
      if (!mapa[row.motorista_id]) mapa[row.motorista_id] = []
      mapa[row.motorista_id].push(row.equipamento_id)
    }

    _salvarCacheLocal(localKey, mapa)
    return mapa
  } catch (err) {
    console.warn('[Crachá Vinculado] Falha na carga:', err)
    return _carregarCacheLocal(localKey)
  }
}

/**
 * Salva (upsert + delete) os vínculos de um motorista específico.
 * Recebe o mapa completo e atualiza apenas o motorista afetado.
 */
export async function salvarVinculosCracha(
  mapa: Record<string, string[]>,
  env: string = 'barcarena',
  motoristaIdAlterado?: string
): Promise<boolean> {
  const localKey = `hydro-cracha-vinculos-${env}`
  _salvarCacheLocal(localKey, mapa)

  try {
    // Se sabemos qual motorista mudou, opera só nele (mais eficiente)
    if (motoristaIdAlterado) {
      return await _sincronizarMotoristaSingle(motoristaIdAlterado, mapa[motoristaIdAlterado] || [], env)
    }

    // Fallback: re-sincroniza todos
    return await _sincronizarTodosMapa(mapa, env)
  } catch (err) {
    console.warn('[Crachá Vinculado] Erro ao salvar:', err)
    return false
  }
}

/**
 * Vincula um equipamento a um motorista (insert único).
 */
export async function vincularEquipamento(
  motoristaId: string,
  equipamentoId: string,
  env: string = 'barcarena'
): Promise<boolean> {
  const { error } = await rawSupabase
    .from('eq_cracha_vinculos')
    .upsert(
      { environment: env, motorista_id: motoristaId, equipamento_id: equipamentoId },
      { onConflict: 'environment,motorista_id,equipamento_id', ignoreDuplicates: true }
    )

  if (error) {
    console.warn('[Crachá Vinculado] Erro ao vincular:', error.message)
    return false
  }
  return true
}

/**
 * Desvincula um equipamento de um motorista.
 */
export async function desvincularEquipamento(
  motoristaId: string,
  equipamentoId: string,
  env: string = 'barcarena'
): Promise<boolean> {
  const { error } = await rawSupabase
    .from('eq_cracha_vinculos')
    .delete()
    .eq('environment', env)
    .eq('motorista_id', motoristaId)
    .eq('equipamento_id', equipamentoId)

  if (error) {
    console.warn('[Crachá Vinculado] Erro ao desvincular:', error.message)
    return false
  }
  return true
}

/**
 * Busca todos os motoristas vinculados a um equipamento específico.
 * Útil para a view "Por Equipamento".
 */
export async function buscarMotoristasPorEquipamento(
  equipamentoId: string,
  env: string = 'barcarena'
): Promise<string[]> {
  const { data, error } = await rawSupabase
    .from('eq_cracha_vinculos')
    .select('motorista_id')
    .eq('environment', env)
    .eq('equipamento_id', equipamentoId)

  if (error) {
    console.warn('[Crachá Vinculado] Erro ao buscar motoristas do equipamento:', error.message)
    return []
  }
  return (data || []).map((r) => r.motorista_id)
}

/**
 * Carrega mapa invertido { [equipamento_id]: motorista_id[] }
 */
export async function carregarMapaEquipamentoParaMotoristas(
  env: string = 'barcarena'
): Promise<Record<string, string[]>> {
  const { data, error } = await rawSupabase
    .from('eq_cracha_vinculos')
    .select('motorista_id, equipamento_id')
    .eq('environment', env)

  if (error) {
    console.warn('[Crachá Vinculado] Erro ao carregar mapa invertido:', error.message)
    return {}
  }

  const mapa: Record<string, string[]> = {}
  for (const row of data || []) {
    if (!mapa[row.equipamento_id]) mapa[row.equipamento_id] = []
    mapa[row.equipamento_id].push(row.motorista_id)
  }
  return mapa
}

// ─────────────────────────────────────────────────────────────────────────────
// Migração de legado (global_settings → tabela dedicada)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Migra dados do global_settings (formato legado) para a tabela eq_cracha_vinculos.
 * Executar UMA única vez após criar a tabela.
 */
export async function migrarVinculosLegados(env: string = 'barcarena'): Promise<boolean> {
  const legacyKey = `equipamentos_cracha_vinculado_${env}`

  try {
    const { data } = await rawSupabase
      .from('global_settings')
      .select('value')
      .eq('key', legacyKey)
      .maybeSingle()

    if (!data?.value || typeof data.value !== 'object') return true // sem legado

    const mapa = data.value as Record<string, string[]>
    const rows = Object.entries(mapa).flatMap(([motId, eqIds]) =>
      eqIds.map((eqId) => ({ environment: env, motorista_id: motId, equipamento_id: eqId }))
    )

    if (rows.length === 0) return true

    const { error } = await rawSupabase
      .from('eq_cracha_vinculos')
      .upsert(rows, { onConflict: 'environment,motorista_id,equipamento_id', ignoreDuplicates: true })

    if (error) {
      console.warn('[Migração] Erro ao migrar vínculos legados:', error.message)
      return false
    }

    console.info(`[Migração] ${rows.length} vínculo(s) migrados com sucesso.`)
    return true
  } catch (err) {
    console.warn('[Migração] Falha geral:', err)
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────

async function _sincronizarMotoristaSingle(
  motoristaId: string,
  equipamentosIds: string[],
  env: string
): Promise<boolean> {
  // 1. Apaga todos os vínculos atuais do motorista
  const { error: delErr } = await rawSupabase
    .from('eq_cracha_vinculos')
    .delete()
    .eq('environment', env)
    .eq('motorista_id', motoristaId)

  if (delErr) {
    console.warn('[Crachá Vinculado] Erro ao limpar vínculos:', delErr.message)
    return false
  }

  if (equipamentosIds.length === 0) return true

  // 2. Insere os novos
  const rows = equipamentosIds.map((eqId) => ({
    environment: env,
    motorista_id: motoristaId,
    equipamento_id: eqId,
  }))

  const { error: insErr } = await rawSupabase
    .from('eq_cracha_vinculos')
    .insert(rows)

  if (insErr) {
    console.warn('[Crachá Vinculado] Erro ao inserir vínculos:', insErr.message)
    return false
  }

  return true
}

async function _sincronizarTodosMapa(
  mapa: Record<string, string[]>,
  env: string
): Promise<boolean> {
  const rows = Object.entries(mapa).flatMap(([motId, eqIds]) =>
    eqIds.map((eqId) => ({ environment: env, motorista_id: motId, equipamento_id: eqId }))
  )

  // Limpa tudo do ambiente e reinsere
  const { error: delErr } = await rawSupabase
    .from('eq_cracha_vinculos')
    .delete()
    .eq('environment', env)

  if (delErr) return false
  if (rows.length === 0) return true

  const { error: insErr } = await rawSupabase
    .from('eq_cracha_vinculos')
    .insert(rows)

  return !insErr
}

function _salvarCacheLocal(key: string, mapa: Record<string, string[]>): void {
  if (typeof window !== 'undefined') {
    try { localStorage.setItem(key, JSON.stringify(mapa)) } catch (_) {}
  }
}

function _carregarCacheLocal(key: string): Record<string, string[]> {
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(key)
      if (cached) return JSON.parse(cached)
    } catch (_) {}
  }
  return {}
}

async function _carregarVinculosLegado(env: string, localKey: string): Promise<Record<string, string[]>> {
  try {
    const { data } = await rawSupabase
      .from('global_settings')
      .select('value')
      .eq('key', `equipamentos_cracha_vinculado_${env}`)
      .maybeSingle()

    if (data?.value && typeof data.value === 'object') {
      const mapa = data.value as Record<string, string[]>
      _salvarCacheLocal(localKey, mapa)
      return mapa
    }
  } catch (err) {
    console.warn('[Crachá Vinculado] Erro ao carregar legado:', err)
  }
  return _carregarCacheLocal(localKey)
}

// Mantida por compatibilidade com código legado
export function getStorageKeyCracha(env: string = 'barcarena'): string {
  return `equipamentos_cracha_vinculado_${env}`
}
