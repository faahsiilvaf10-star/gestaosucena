import { supabase } from './supabase'

export type AccessLevel = 'full' | 'view_only' | 'hidden'

export type UserPermissions = {
  [moduleId: string]: AccessLevel
}

export type AllUsersPermissions = {
  [userId: string]: UserPermissions
}

export const MODULES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'almoxarifado', label: 'Almoxarifado' },
  { id: 'equipamentos', label: 'Equipamentos' },
  { id: 'seguranca', label: 'Segurança (SSMA)' },
  { id: 'rh', label: 'Recursos Humanos' },
  { id: 'relatorio-obra', label: 'Relatório de Obra (RDO)' },
  { id: 'meio-ambiente', label: 'Meio Ambiente' },
  { id: 'permissao-trabalho', label: 'Permissão de Trabalho' }
]

let cachedPermissions: AllUsersPermissions | null = null
let permissionsTimestamp = 0
const PERMISSIONS_CACHE_TTL = 1000 * 60 * 5 // 5 minutos

export async function getAllPermissions(forceRefresh = false): Promise<AllUsersPermissions> {
  if (!forceRefresh && cachedPermissions && (Date.now() - permissionsTimestamp < PERMISSIONS_CACHE_TTL)) {
    return cachedPermissions
  }

  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', 'user_permissions')
      .maybeSingle()

    if (error || !data) {
      return cachedPermissions || {}
    }

    cachedPermissions = (data.value || {}) as AllUsersPermissions
    permissionsTimestamp = Date.now()
    return cachedPermissions
  } catch (err) {
    console.error('Erro ao buscar permissões:', err)
    return cachedPermissions || {}
  }
}

export async function saveAllPermissions(permissions: AllUsersPermissions): Promise<boolean> {
  cachedPermissions = permissions
  permissionsTimestamp = Date.now()
  try {
    const { error } = await supabase
      .from('global_settings')
      .upsert({
        key: 'user_permissions',
        value: permissions,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })
      
    if (error) {
      console.error('Erro ao salvar permissões:', error)
      return false
    }
    return true
  } catch (err) {
    console.error('Erro ao salvar permissões:', err)
    return false
  }
}
