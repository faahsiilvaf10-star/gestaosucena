import { supabase } from './supabase'

export const DEFAULT_ROLES = [
  "Preposto",
  "Encarregado Geral",
  "Encarregado I",
  "Encarregado II",
  "Técnico de Segurança I",
  "Técnico de Segurança II",
  "Técnico Meio Ambiente",
  "Aux. Administrativo",
  "Aux. Almoxarifado",
  "Planejador",
  "Engenheiro Civil",
  "Engenheiro de Planejamento",
  "Técnico de Planejamento",
  "Engenheiro de Segurança"
]

export async function getAvailableRoles(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', 'available_roles')
      .single()

    if (error || !data) {
      // If not found, create it initially
      if (error && error.code === 'PGRST116') {
        await saveAvailableRoles(DEFAULT_ROLES)
        return DEFAULT_ROLES
      }
      return DEFAULT_ROLES
    }

    return Array.isArray(data.value) ? data.value : DEFAULT_ROLES
  } catch (err) {
    console.error('Erro ao buscar cargos:', err)
    return DEFAULT_ROLES
  }
}

export async function saveAvailableRoles(roles: string[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('global_settings')
      .upsert({
        key: 'available_roles',
        value: roles,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })
      
    if (error) {
      console.error('Erro ao salvar cargos:', error)
      return false
    }
    return true
  } catch (err) {
    console.error('Erro ao salvar cargos:', err)
    return false
  }
}
