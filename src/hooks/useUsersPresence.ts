import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const OFFLINE_THRESHOLD_MS = 120_000

export function isReallyOnline(presence: { is_online: boolean; last_heartbeat?: string | null } | undefined | null): boolean {
  if (!presence || !presence.is_online) return false
  if (!presence.last_heartbeat) return false
  return (Date.now() - new Date(presence.last_heartbeat).getTime()) < OFFLINE_THRESHOLD_MS
}

export type UserWithPresence = {
  id: string
  name: string
  avatar_url?: string
  role?: string
  isOnline: boolean
  lastSeen: string | null
  _presenceRaw: any
}

export function useUsersPresence() {
  return useQuery({
    queryKey: ['global_users_presence'],
    queryFn: async () => {
      const { data: users, error } = await supabase.rpc('get_users')
      if (error) throw error

      const { data: presence } = await supabase.from('user_presence').select('*')

      const usersMap = (users || []).reduce((acc: any, u: any) => {
        const p = presence?.find((p: any) => p.user_id === u.id)
        acc[u.id] = {
          ...u,
          id: u.id,
          name: u.name || 'Usuário',
          avatar_url: u.avatar_url,
          role: u.role,
          isOnline: isReallyOnline(p),
          lastSeen: p?.last_seen || null,
          _presenceRaw: p || null
        }
        return acc
      }, {})

      return usersMap as Record<string, UserWithPresence>
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 15000, // Re-fetch and re-calculate heartbeats every 15s to update offline statuses
  })
}
