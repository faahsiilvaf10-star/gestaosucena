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
    description: 'Ambiente de gestão e operações da unidade Hydro Civil.',
  }
]

// Mapeamento: userId -> array de IDs dos ambientes permitidos
// Ex: { "uuid-1": ["barcarena"], "uuid-2": ["barcarena", "hydro-civil"] }
export type UserEnvironmentAccessMap = {
  [userId: string]: string[]
}

/**
 * Carrega o mapa de acessos a ambientes de todos os usuários a partir de global_settings.
 */
export async function getUserEnvironmentAccess(): Promise<UserEnvironmentAccessMap> {
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', 'user_environment_access')
      .maybeSingle()

    if (error || !data) {
      return {}
    }

    return (data.value || {}) as UserEnvironmentAccessMap
  } catch (err) {
    console.error('Erro ao buscar acessos de ambientes:', err)
    return {}
  }
}

/**
 * Salva o mapa de acessos a ambientes em global_settings.
 */
export async function saveUserEnvironmentAccess(accessMap: UserEnvironmentAccessMap): Promise<boolean> {
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

  // Administrador ou Diretor sempre possui acesso irrestrito
  if (isAdmin(userName || '', userRole || '')) {
    return true
  }

  // Se o usuário foi configurado no mapa
  if (accessMap && accessMap[userId] !== undefined) {
    const allowed = accessMap[userId]
    return Array.isArray(allowed) && allowed.includes(environmentId)
  }

  // Se o mapa ainda está vazio no sistema (nenhuma regra salva ainda)
  if (!accessMap || Object.keys(accessMap).length === 0) {
    // Ambiente padrão é 'barcarena'
    return environmentId === 'barcarena'
  }

  // Se o mapa já existe mas este usuário específico não está nele, por padrão ele não tem acesso
  return false
}
