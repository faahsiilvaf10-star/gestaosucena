import React, { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useUsersPresence } from '../hooks/useUsersPresence'

export interface NotificationItem {
  id: string
  type: 'mention' | 'instacena_post' | 'instacena_like' | 'instacena_comment' | 'instacena_story' | 'system'
  title: string
  message: string
  actorId?: string
  actorName?: string
  actorAvatar?: string
  actorUsername?: string
  targetId?: string // postId, commentId, etc.
  targetUrl?: string // navigation target
  read: boolean
  createdAt: string
  metadata?: Record<string, any>
}

type NotificationState = {
  notifications: NotificationItem[]
  unreadCount: number
}

type NotificationAction =
  | { type: 'ADD_NOTIFICATION'; payload: NotificationItem }
  | { type: 'ADD_NOTIFICATIONS'; payload: NotificationItem[] }
  | { type: 'MARK_AS_READ'; payload: string }
  | { type: 'MARK_ALL_AS_READ' }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'SET_NOTIFICATIONS'; payload: NotificationItem[] }
  | { type: 'SET_UNREAD_COUNT'; payload: number }

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
}

function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case 'ADD_NOTIFICATION': {
      // Check for duplicates
      const exists = state.notifications.some(n => n.id === action.payload.id)
      if (exists) return state

      const newNotifications = [action.payload, ...state.notifications].slice(0, 50)
      return {
        notifications: newNotifications,
        unreadCount: newNotifications.filter(n => !n.read).length,
      }
    }
    case 'ADD_NOTIFICATIONS': {
      const existingIds = new Set(state.notifications.map(n => n.id))
      const newOnes = action.payload.filter(n => !existingIds.has(n.id))
      const newNotifications = [...newOnes, ...state.notifications].slice(0, 50)
      return {
        notifications: newNotifications,
        unreadCount: newNotifications.filter(n => !n.read).length,
      }
    }
    case 'MARK_AS_READ': {
      const newNotifications = state.notifications.map(n =>
        n.id === action.payload ? { ...n, read: true } : n
      )
      return {
        notifications: newNotifications,
        unreadCount: newNotifications.filter(n => !n.read).length,
      }
    }
    case 'MARK_ALL_AS_READ': {
      const newNotifications = state.notifications.map(n => ({ ...n, read: true }))
      return {
        notifications: newNotifications,
        unreadCount: 0,
      }
    }
    case 'REMOVE_NOTIFICATION': {
      const newNotifications = state.notifications.filter(n => n.id !== action.payload)
      return {
        notifications: newNotifications,
        unreadCount: newNotifications.filter(n => !n.read).length,
      }
    }
    case 'SET_NOTIFICATIONS': {
      return {
        notifications: action.payload,
        unreadCount: action.payload.filter(n => !n.read).length,
      }
    }
    case 'SET_UNREAD_COUNT': {
      return { ...state, unreadCount: action.payload }
    }
    default:
      return state
  }
}

const NotificationContext = createContext<{
  state: NotificationState
  dispatch: React.Dispatch<NotificationAction>
  addNotification: (notif: NotificationItem) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  removeNotification: (id: string) => void
} | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(notificationReducer, initialState)
  const { data: usersMap } = useUsersPresence()

  const addNotification = useCallback((notif: NotificationItem) => {
    dispatch({ type: 'ADD_NOTIFICATION', payload: notif })
  }, [])

  const markAsRead = useCallback((id: string) => {
    dispatch({ type: 'MARK_AS_READ', payload: id })
  }, [])

  const markAllAsRead = useCallback(() => {
    dispatch({ type: 'MARK_ALL_AS_READ' })
  }, [])

  const removeNotification = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id })
  }, [])

  // Load persisted notifications on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('hydro_notifications')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          dispatch({ type: 'SET_NOTIFICATIONS', payload: parsed })
        }
      }
    } catch (e) {
      console.warn('Failed to load notifications:', e)
    }
  }, [])

  // Persist notifications
  useEffect(() => {
    try {
      localStorage.setItem('hydro_notifications', JSON.stringify(state.notifications))
    } catch (e) {
      console.warn('Failed to save notifications:', e)
    }
  }, [state.notifications])

  // Subscribe to mention notifications (via a dedicated table or realtime)
  useEffect(() => {
    // TODO: When mentions table exists, subscribe here
    // For now, we'll use a custom event system
    const handleMention = (e: CustomEvent) => {
      const detail = e.detail
      if (!detail) return

      addNotification({
        id: `mention_${detail.id || Date.now()}`,
        type: 'mention',
        title: 'Menção',
        message: `${detail.actorName || 'Alguém'} te mencionou: "${detail.content || ''}"`,
        actorId: detail.actorId,
        actorName: detail.actorName,
        actorAvatar: detail.actorAvatar,
        targetId: detail.targetId,
        targetUrl: detail.targetUrl || '/comunicados',
        read: false,
        createdAt: detail.createdAt || new Date().toISOString(),
        metadata: detail,
      })
    }

    window.addEventListener('hydro_mention', handleMention as EventListener)
    return () => window.removeEventListener('hydro_mention', handleMention as EventListener)
  }, [addNotification])

  // Subscribe to Instacena activities via BroadcastChannel (same as InstacenaNotificationPopup)
  useEffect(() => {
    let bc: BroadcastChannel | null = null

    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('instacena_activity_bus')
        bc.onmessage = (event) => {
          const activity = event?.data
          if (!activity || !activity.actorId) return

          // Don't notify about own actions - we need current user ID
          // This will be filtered by the InstacenaNotificationPopup, but we also filter here
          // We'll rely on the fact that own actions don't broadcast to self, but just in case:

          let actionLabel = ''
          let targetUrl = '/instacena'

          switch (activity.type) {
            case 'like':
              actionLabel = 'curtiu sua publicação'
              break
            case 'comment':
              actionLabel = `comentou: "${activity.content || ''}"`
              break
            case 'post':
              actionLabel = 'publicou uma nova foto'
              break
            case 'story':
              actionLabel = 'adicionou um novo story'
              break
            default:
              actionLabel = 'teve atividade no Instacena'
          }

          addNotification({
            id: `instacena_${activity.type}_${activity.actorId}_${activity.targetPostId || activity.id || Date.now()}`,
            type: `instacena_${activity.type}` as NotificationItem['type'],
            title: 'Instacena',
            message: `${activity.actorName || 'Alguém'} ${actionLabel}`,
            actorId: activity.actorId,
            actorName: activity.actorName,
            actorAvatar: activity.actorAvatar,
            actorUsername: activity.actorUsername,
            targetId: activity.targetPostId,
            targetUrl,
            read: false,
            createdAt: activity.createdAt || new Date().toISOString(),
            metadata: activity,
          })
        }
      }
    } catch (e) {
      console.warn('Failed to setup Instacena BroadcastChannel:', e)
    }

    return () => {
      if (bc) bc.close()
    }
  }, [addNotification])

  // Also listen for local window events (from InstacenaNotificationPopup)
  useEffect(() => {
    const handleLocalEvent = (e: CustomEvent) => {
      const activity = e?.detail
      if (!activity || !activity.actorId) return

      let actionLabel = ''
      let targetUrl = '/instacena'

      switch (activity.type) {
        case 'like':
          actionLabel = 'curtiu sua publicação'
          break
        case 'comment':
          actionLabel = `comentou: "${activity.content || ''}"`
          break
        case 'post':
          actionLabel = 'publicou uma nova foto'
          break
        case 'story':
          actionLabel = 'adicionou um novo story'
          break
        default:
          actionLabel = 'teve atividade no Instacena'
      }

      addNotification({
        id: `instacena_${activity.type}_${activity.actorId}_${activity.targetPostId || activity.id || Date.now()}`,
        type: `instacena_${activity.type}` as NotificationItem['type'],
        title: 'Instacena',
        message: `${activity.actorName || 'Alguém'} ${actionLabel}`,
        actorId: activity.actorId,
        actorName: activity.actorName,
        actorAvatar: activity.actorAvatar,
        actorUsername: activity.actorUsername,
        targetId: activity.targetPostId,
        targetUrl,
        read: false,
        createdAt: activity.createdAt || new Date().toISOString(),
        metadata: activity,
      })
    }

    window.addEventListener('instacena_activity', handleLocalEvent as EventListener)
    return () => window.removeEventListener('instacena_activity', handleLocalEvent as EventListener)
  }, [addNotification])

  return (
    <NotificationContext.Provider value={{
      state,
      dispatch,
      addNotification,
      markAsRead,
      markAllAsRead,
      removeNotification,
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}