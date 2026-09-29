import { useQuery } from '@tanstack/react-query'
import { getAllPermissions, MODULES } from '../lib/permissions'

export function usePermissions(userId: string | undefined | null) {
  const { data: allPermissions, isLoading } = useQuery({
    queryKey: ['user_permissions'],
    queryFn: getAllPermissions
  })

  // Retorna 'full' por padrão se não houver configuração específica
  const getAccessLevel = (moduleId: string) => {
    if (!userId || !allPermissions) return 'full'
    return allPermissions[userId]?.[moduleId] || 'full'
  }

  const canView = (moduleId: string) => {
    return getAccessLevel(moduleId) !== 'hidden'
  }

  const canEdit = (moduleId: string) => {
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
