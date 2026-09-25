import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Tempo máximo sem heartbeat para considerar o usuário OFFLINE (em ms)
// Heartbeat é enviado a cada 25s, então 60s dá 2.4x de margem para falhas de rede
const OFFLINE_THRESHOLD_MS = 60_000
// Intervalo do heartbeat em ms — enviado MESMO com aba em background
const HEARTBEAT_INTERVAL_MS = 25_000

export function usePresence(userId?: string) {
  const presenceChannelRef = useRef<any>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!userId) return

    const sendHeartbeat = async (isOnline: boolean = true) => {
      await supabase.from('user_presence').upsert({
        user_id: userId,
        is_online: isOnline,
        last_seen: new Date().toISOString(),
        last_heartbeat: new Date().toISOString()
      }, { onConflict: 'user_id' })
    }

    // Quando o usuário fica online, marca como "delivered" todas as mensagens
    // que chegaram para ele enquanto estava offline (ainda com status 'sent')
    const markPendingMessagesAsDelivered = async () => {
      try {
        // Busca todas as conversas em que este usuário participa
        const { data: participations } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', userId)

        if (!participations || participations.length === 0) return

        const conversationIds = participations.map((p: any) => p.conversation_id)

        // Busca mensagens enviadas para este usuário (não pelo próprio) com status 'sent'
        const { data: pendingMessages } = await supabase
          .from('messages')
          .select('id')
          .in('conversation_id', conversationIds)
          .neq('sender_id', userId)
          .eq('status', 'sent')

        if (pendingMessages && pendingMessages.length > 0) {
          const ids = pendingMessages.map((m: any) => m.id)
          await supabase.from('messages').update({ status: 'delivered' }).in('id', ids)
        }
      } catch (err) {
        console.error('Error marking messages as delivered:', err)
      }
    }

    // Marca online imediatamente ao entrar + atualiza mensagens pendentes
    sendHeartbeat(true)
    markPendingMessagesAsDelivered()

    // Realtime Presence Channel (detecção instantânea de queda de conexão)
    const channelName = `global_presence_${userId}_${Date.now()}_${Math.random()}`
    const channel = supabase.channel(channelName)
    presenceChannelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {})
      .on('presence', { event: 'join' }, () => {})
      .on('presence', { event: 'leave' }, () => {})
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: userId, online_at: new Date().toISOString() })
        }
      })

    // Heartbeat a cada 25s — SEMPRE enviado, mesmo com aba em background/segundo plano
    // Isso garante que usuários com o app minimizado apareçam como online
    heartbeatRef.current = setInterval(() => {
      if (navigator.onLine) {
        sendHeartbeat(true)
      }
    }, HEARTBEAT_INTERVAL_MS)

    // Quando a aba volta ao foco (visível), reenvia heartbeat imediato
    // Importante para reduzir latência da detecção de online após o usuário voltar ao app
    const handleVisibility = () => {
      if (navigator.onLine) {
        sendHeartbeat(true)
      }
    }

    // Quando a rede volta, reenvia heartbeat imediato
    const handleOnline = () => sendHeartbeat(true)

    // Quando a rede cai, marca offline imediatamente
    const handleOffline = () => sendHeartbeat(false)

    // Quando fecha a aba/navegador
    const handleBeforeUnload = () => {
      navigator.sendBeacon(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_presence?user_id=eq.${userId}`,
        JSON.stringify([{ user_id: userId, is_online: false, last_seen: new Date().toISOString(), last_heartbeat: new Date().toISOString() }])
      )
      // fallback síncrono
      supabase.from('user_presence').upsert({ user_id: userId, is_online: false, last_seen: new Date().toISOString(), last_heartbeat: new Date().toISOString() }).then()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (presenceChannelRef.current) {
        presenceChannelRef.current.untrack()
        supabase.removeChannel(presenceChannelRef.current)
      }
      sendHeartbeat(false)
    }
  }, [userId])
}

// Helper exportado: determina se um usuário está "realmente" online
// baseado no last_heartbeat (ignora is_online desatualizado no banco)
export function isUserTrulyOnline(presence: { is_online: boolean; last_heartbeat?: string | null } | null | undefined): boolean {
  if (!presence) return false
  if (!presence.is_online) return false
  if (!presence.last_heartbeat) return false
  const diff = Date.now() - new Date(presence.last_heartbeat).getTime()
  return diff < OFFLINE_THRESHOLD_MS
}
