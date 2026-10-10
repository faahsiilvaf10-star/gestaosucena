import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { isReallyOnline, UserWithPresence } from './useUsersPresence'

export function useGlobalPresenceSync(currentUserId?: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase.channel(`global_presence_sync_${currentUserId}_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, (payload: any) => {
        const newPresence = payload.new
        if (!newPresence || !newPresence.user_id) return

        queryClient.setQueryData(['global_users_presence'], (old: Record<string, UserWithPresence> | undefined) => {
          if (!old) return old
          const userId = newPresence.user_id
          if (old[userId]) {
            return {
              ...old,
              [userId]: {
                ...old[userId],
                isOnline: isReallyOnline(newPresence),
                lastSeen: newPresence.last_seen,
                _presenceRaw: newPresence
              }
            }
          }
          return old
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, queryClient])
}
