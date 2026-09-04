import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function usePresence(userId?: string) {
  const presenceChannelRef = useRef<any>(null)
  
  useEffect(() => {
    if (!userId) return
    
    // Atualiza tabela para online e marca o último acesso inicial
    const markOnline = async () => {
      await supabase.from('user_presence').upsert({
        user_id: userId,
        is_online: true,
        last_seen: new Date().toISOString(),
        last_heartbeat: new Date().toISOString()
      })
    }
    
    markOnline()

    // Realtime Presence para online status instantâneo (muito mais rápido que banco)
    const channel = supabase.channel('global_presence')
    presenceChannelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        // console.log('Presence sync', channel.presenceState())
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        // console.log('join', key, newPresences)
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        // console.log('leave', key, leftPresences)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          })
        }
      })

    // Heartbeat a cada 25 segundos para manter o banco atualizado (last_seen)
    const heartbeatInterval = setInterval(async () => {
      await supabase.from('user_presence').upsert({
        user_id: userId,
        is_online: true,
        last_heartbeat: new Date().toISOString()
      })
    }, 25000)

    // Tratar o fechamento da aba de forma "graceful"
    const handleBeforeUnload = async () => {
      // Usar beacon para atualizar via edge function, ou apenas tentar atualizar sincrono
      // (Supabase não tem endpoint simples pra navigator.sendBeacon de insert/update direto sem API key)
      // O Realtime já cuida de remover o estado da presença na queda da conexão.
      // E quando o user abre, a gente sabe quem tá online pelo Realtime.
      
      // Tentativa de update síncrono no DB
      supabase.from('user_presence').upsert({
        user_id: userId,
        is_online: false,
        last_seen: new Date().toISOString()
      }).then()
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      clearInterval(heartbeatInterval)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (presenceChannelRef.current) {
        presenceChannelRef.current.untrack()
        supabase.removeChannel(presenceChannelRef.current)
      }
      
      // Marca como offline ao desmontar
      supabase.from('user_presence').upsert({
        user_id: userId,
        is_online: false,
        last_seen: new Date().toISOString()
      }).then()
    }
  }, [userId])
}
