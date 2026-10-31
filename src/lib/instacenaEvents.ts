import { supabase } from './supabase'

export interface InstacenaActivityPayload {
  id?: string
  type: 'like' | 'comment' | 'post' | 'story'
  actorId: string
  actorName?: string
  actorAvatar?: string
  actorUsername?: string
  content?: string
  mediaUrl?: string
  targetPostId?: string
  targetUserId?: string
  createdAt?: string
}

let bus: BroadcastChannel | null = null
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    bus = new BroadcastChannel('instacena_activity_bus')
  }
} catch (_) {}

/**
 * Dispatches an Instacena activity notification immediately across tabs and to all users via Supabase Realtime broadcast.
 */
export async function broadcastInstacenaActivity(activity: InstacenaActivityPayload) {
  try {
    const payload: InstacenaActivityPayload = {
      ...activity,
      id: activity.id || `${activity.type}_${activity.actorId}_${Date.now()}`,
      createdAt: activity.createdAt || new Date().toISOString()
    }

    // 1. Same-window custom event (immediate dispatch, 0ms)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('instacena_activity', { detail: payload }))
    }

    // 2. Same-browser cross-tab BroadcastChannel (immediate dispatch, 0ms)
    if (bus) {
      try {
        bus.postMessage(payload)
      } catch (_) {}
    }

    // 3. Supabase Realtime Broadcast (sub-second delivery across all devices)
    const channel = supabase.channel('instacena_global_activity')
    await channel.send({
      type: 'broadcast',
      event: 'activity',
      payload
    })
  } catch (err) {
    console.error('Falha ao transmitir evento do Instacena:', err)
  }
}
