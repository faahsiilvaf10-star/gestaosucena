import { useQuery } from '@tanstack/react-query'
import { getAllPermissions, MODULES } from '../lib/permissions'

export function usePermissions(userId: string | undefined | null) {
  const { data: allPermissions, isLoading } = useQuery({
    queryKey: ['user_permissions'],
    queryFn: getAllPermissions
  })

  // Derick ID (a19a50e3-b761-4920-9a8b-f195670d330d) possui acesso e edição total liberados para RH
  const isDerick = userId === 'a19a50e3-b761-4920-9a8b-f195670d330d'

  // Retorna 'full' por padrão se não houver configuração específica
  const getAccessLevel = (moduleId: string) => {
    if (isDerick && moduleId === 'rh') return 'full'
    if (!userId || !allPermissions) return 'full'
    return allPermissions[userId]?.[moduleId] || 'full'
  }

  const canView = (moduleId: string) => {
    if (isDerick && moduleId === 'rh') return true
    return getAccessLevel(moduleId) !== 'hidden'
  }

  const canEdit = (moduleId: string) => {
    if (isDerick && moduleId === 'rh') return true
    return getAccessLevel(moduleId) === 'full'
  }

  return {
    isLoading,
    getAccessLevel,
    canView,
    canEdit,
    allPermissions
  }
}
