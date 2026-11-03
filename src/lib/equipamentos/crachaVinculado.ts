import { supabase } from '../supabase'

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

export interface CrachaVinculoRegistro {
  motoristaId: string
  motoristaNome: string
  motoristaCargo: string
  equipamentosIds: string[]
  updatedAt: string
}

export function getStorageKeyCracha(env: string = 'barcarena'): string {
  return `equipamentos_cracha_vinculado_${env}`
}

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

/**
 * Carrega o mapa de vínculos { [motoristaId]: [equipamentoId, ...] }
 */
export async function carregarVinculosCracha(
  env: string = 'barcarena'
): Promise<Record<string, string[]>> {
  const key = getStorageKeyCracha(env)
  const localKey = `hydro-cracha-vinculos-${env}`

  try {
    const { data } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()

    if (data?.value && typeof data.value === 'object') {
      const mapa = data.value as Record<string, string[]>
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(localKey, JSON.stringify(mapa))
        } catch (_) {}
      }
      return mapa
    }
  } catch (err) {
    console.warn('[Crachá Vinculado] Erro ao carregar do Supabase:', err)
  }

  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(localKey)
      if (cached) return JSON.parse(cached)
    } catch (_) {}
  }

  return {}
}

/**
 * Salva o mapa de vínculos no Supabase e LocalStorage
 */
export async function salvarVinculosCracha(
  mapa: Record<string, string[]>,
  env: string = 'barcarena'
): Promise<boolean> {
  const key = getStorageKeyCracha(env)
  const localKey = `hydro-cracha-vinculos-${env}`

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(localKey, JSON.stringify(mapa))
    } catch (_) {}
  }

  try {
    const { error } = await supabase
      .from('global_settings')
      .upsert({
        key,
        value: mapa,
        updated_at: new Date().toISOString(),
      })
    return !error
  } catch (err) {
    console.warn('[Crachá Vinculado] Erro ao salvar no Supabase:', err)
    return false
  }
}
