import { supabase } from './supabase'
import { isAdmin } from '../components/ui/VerifiedBadge'

export interface EnvironmentInfo {
  id: string
  name: string
  contract?: string
  description: string
}

export const AVAILABLE_ENVIRONMENTS: EnvironmentInfo[] = [
  {
    id: 'barcarena',
    name: 'HYDRO REABILITAÇÃO',
    contract: 'Contrato 4600012690',
    description: 'Ambiente de gestão e operações da unidade Hydro Reabilitação.',
  },
  {
    id: 'hydro-civil',
    name: 'HYDRO CIVIL',
    contract: 'Contrato 4600013715',
    description: 'Ambiente de gestão e operações da unidade Hydro Civil.',
  }
]

export function getEnvironmentLabel(envId?: string | null): string {
  if (!envId) return 'HYDRO REABILITAÇÃO (Contrato 4600012690)'
  const found = AVAILABLE_ENVIRONMENTS.find(e => e.id.toLowerCase() === envId.toLowerCase())
  if (found) {
    return found.contract ? `${found.name} (${found.contract})` : found.name
  }
  return envId.toUpperCase()
}

// Mapeamento: userId -> array de IDs dos ambientes permitidos
// Ex: { "uuid-1": ["barcarena"], "uuid-2": ["barcarena", "hydro-civil"] }
export type UserEnvironmentAccessMap = {
  [userId: string]: string[]
}

let cachedAccessMap: UserEnvironmentAccessMap | null = null
let cacheTimestamp = 0
const ACCESS_CACHE_TTL = 1000 * 60 * 5 // 5 minutos

/**
 * Carrega o mapa de acessos a ambientes de todos os usuários a partir de global_settings com cache em memória.
 */
export async function getUserEnvironmentAccess(forceRefresh = false): Promise<UserEnvironmentAccessMap> {
  if (!forceRefresh && cachedAccessMap && (Date.now() - cacheTimestamp < ACCESS_CACHE_TTL)) {
    return cachedAccessMap
  }

  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', 'user_environment_access')
      .maybeSingle()

    if (error || !data) {
      return cachedAccessMap || {}
    }

    cachedAccessMap = (data.value || {}) as UserEnvironmentAccessMap
    cacheTimestamp = Date.now()
    return cachedAccessMap
  } catch (err) {
    console.error('Erro ao buscar acessos de ambientes:', err)
    return cachedAccessMap || {}
  }
}

/**
 * Salva o mapa de acessos a ambientes em global_settings e atualiza o cache local imediatamente.
 */
export async function saveUserEnvironmentAccess(accessMap: UserEnvironmentAccessMap): Promise<boolean> {
  cachedAccessMap = accessMap
  cacheTimestamp = Date.now()
  try {
    const { error } = await supabase
      .from('global_settings')
      .upsert({
        key: 'user_environment_access',
        value: accessMap,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })

    if (error) {
      console.error('Erro ao salvar acessos de ambientes:', error)
      return false
    }
    return true
  } catch (err) {
    console.error('Erro ao salvar acessos de ambientes:', err)
    return false
  }
}

/**
 * Verifica se um usuário possui acesso a determinado ambiente.
 * - Administradores e Diretores SEMPRE têm acesso a todos os ambientes.
 * - Se o mapa ainda não estiver configurado para o usuário:
 *   - Se o mapa geral estiver totalmente vazio (primeira vez no sistema), concede acesso ao ambiente padrão ('barcarena').
 *   - Se o usuário estiver configurado no mapa, ele precisa ter o envId explicitamente presente no seu array.
 */
export function hasEnvironmentAccess(
  userId: string | null | undefined,
  environmentId: string,
  accessMap: UserEnvironmentAccessMap,
  userName?: string,
  userRole?: string
): boolean {
  if (!userId) return false

  // Administrador ou Diretor sempre possui acesso irrestrito a todos os ambientes
  if (isAdmin(userName || '', userRole || '')) {
    return true
  }

  // Alexssandro Chaves possui liberação ativa para os ambientes
  const normalizedName = (userName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  if (normalizedName.includes('alexssandro') || normalizedName.includes('alexandro')) {
    return true
  }

  // Se o usuário foi configurado no mapa explicitamente
  if (accessMap && accessMap[userId] !== undefined) {
    const allowed = accessMap[userId]
    return Array.isArray(allowed) && allowed.includes(environmentId)
  }

  // Se o usuário ainda não foi configurado no mapa, por padrão tem acesso à unidade padrão ('barcarena'),
  // mantendo total consistência com o painel administrativo.
  return environmentId === 'barcarena'
}
