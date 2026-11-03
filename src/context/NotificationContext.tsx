import React, { createContext, useContext, useReducer, useEffect, useState, useCallback, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useUsersPresence } from '../hooks/useUsersPresence'

export interface NotificationItem {
  id: string
  type: 'mention' | 'instacena_post' | 'instacena_like' | 'instacena_comment' | 'instacena_story' | 'system' | 'reminder'
  title: string
  message: string
  actorId?: string
  actorName?: string
  actorAvatar?: string
  actorUsername?: string
  targetId?: string // postId, commentId, reminderId, etc.
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
  | { type: 'UPSERT_NOTIFICATIONS'; payload: NotificationItem[] }
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
      if (exists) {
        // Se já existe, atualiza caso os dados tenham mudado (por exemplo lido/não lido)
        const updated = state.notifications.map(n => n.id === action.payload.id ? action.payload : n)
        return {
          notifications: updated,
          unreadCount: updated.filter(n => !n.read).length,
        }
      }

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
    case 'UPSERT_NOTIFICATIONS': {
      const incomingMap = new Map(action.payload.map(n => [n.id, n]))
      const mergedExisting = state.notifications.map(n => {
        if (incomingMap.has(n.id)) {
          const incoming = incomingMap.get(n.id)!
          incomingMap.delete(n.id)
          return incoming
        }
        return n
      })
      const remainingNew = Array.from(incomingMap.values())
      const newNotifications = [...remainingNew, ...mergedExisting]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 50)
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
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null)
  const { data: usersMap } = useUsersPresence()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) {
        setCurrentUser({
          id: data.user.id,
          name: data.user.user_metadata?.full_name || '',
        })
      }
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        setCurrentUser({
          id: session.user.id,
          name: session.user.user_metadata?.full_name || '',
        })
      } else {
        setCurrentUser(null)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const addNotification = useCallback((notif: NotificationItem) => {
    dispatch({ type: 'ADD_NOTIFICATION', payload: notif })
  }, [])

  const markAsRead = useCallback((id: string) => {
    dispatch({ type: 'MARK_AS_READ', payload: id })

    // Se a notificação for de lembrete do banco de dados, marca como lida no Supabase
    if (id.startsWith('reminder_notif_')) {
      const dbId = id.replace('reminder_notif_', '')
      supabase
        .from('reminder_notifications')
        .update({ read: true })
        .eq('id', dbId)
        .then(({ error }) => {
          if (error) console.warn('Erro ao marcar notificação de lembrete como lida no banco:', error)
        })
    } else if (id.startsWith('reminder_due_')) {
      const remId = id.replace('reminder_due_', '')
      try {
        localStorage.setItem(`read_reminder_due_${remId}`, 'true')
      } catch (_) {}
    }
  }, [])

  const markAllAsRead = useCallback(() => {
    dispatch({ type: 'MARK_ALL_AS_READ' })

    if (currentUser?.id) {
      supabase
        .from('reminder_notifications')
        .update({ read: true })
        .eq('user_id', currentUser.id)
        .eq('read', false)
        .then(({ error }) => {
          if (error) console.warn('Erro ao marcar todas notificações de lembrete como lidas:', error)
        })
    }
  }, [currentUser?.id])

  const removeNotification = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id })
  }, [])

  // Load persisted notifications on mount and clean up erroneous self-notifications
  useEffect(() => {
    try {
      const stored = localStorage.getItem('hydro_notifications')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((n: NotificationItem) => {
            if (currentUser?.id && n.actorId === currentUser.id) return false
            if (currentUser?.name && n.message?.startsWith(`${currentUser.name} curtiu`)) return false
            return true
          })
          dispatch({ type: 'SET_NOTIFICATIONS', payload: cleaned })
        }
      }
    } catch (e) {
      console.warn('Failed to load notifications:', e)
    }
  }, [currentUser])

  // Persist notifications
  useEffect(() => {
    try {
      localStorage.setItem('hydro_notifications', JSON.stringify(state.notifications))
    } catch (e) {
      console.warn('Failed to save notifications:', e)
    }
  }, [state.notifications])

  // Sincronização e carregamento de lembretes na central de notificações do sininho
  useEffect(() => {
    if (!currentUser?.id) return

    let isMounted = true

    const loadReminderNotifications = async () => {
      try {
        // 1. Carrega notificações da tabela reminder_notifications
        const { data: notifData, error: notifError } = await supabase
          .from('reminder_notifications')
          .select(`
            id,
            reminder_id,
            title,
            message,
            read,
            created_at,
            reminder:reminders (
              id, title, description, priority, due_date, due_time, is_recurring
            )
          `)
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(30)

        if (notifError) {
          console.warn('Erro ao carregar reminder_notifications para o sininho:', notifError)
        }

        const items: NotificationItem[] = []
        const coveredReminderIds = new Set<string>()

        if (notifData) {
          for (const r of notifData) {
            if (r.reminder_id) coveredReminderIds.add(r.reminder_id)
            const rem = (r.reminder as any) || {}
            let timeLabel = ''
            if (rem.due_date) {
              const [y, m, d] = rem.due_date.split('-')
              timeLabel = `${d}/${m}/${y}`
              if (rem.due_time) timeLabel += ` às ${rem.due_time.substring(0, 5)}`
            }

            const displayTitle = r.title?.trim() || (rem.title ? `Lembrete: ${rem.title}` : 'Lembrete')
            const displayMessage = r.message?.trim() || rem.description || (timeLabel ? `Agendado para ${timeLabel}` : 'Você tem um lembrete pendente.')

            items.push({
              id: `reminder_notif_${r.id}`,
              type: 'reminder',
              title: displayTitle,
              message: displayMessage,
              targetId: r.reminder_id,
              targetUrl: '/lembretes',
              read: Boolean(r.read),
              createdAt: r.created_at || new Date().toISOString(),
              metadata: {
                dbId: r.id,
                reminder_id: r.reminder_id,
                source: 'reminder_notifications',
                priority: rem.priority,
              },
            })
          }
        }

        // 2. Fallback proativo: carregar lembretes pendentes/em andamento atribuídos ou criados pelo usuário
        const todayStr = new Date().toLocaleDateString('pt-BR').split('/').reverse().join('-')
        const { data: dueReminders } = await supabase
          .from('reminders')
          .select('id, title, description, due_date, due_time, priority, status, creator_id, assigned_user_id, created_at')
          .or(`creator_id.eq.${currentUser.id},assigned_user_id.eq.${currentUser.id}`)
          .in('status', ['Pendente', 'Em andamento'])
          .lte('due_date', todayStr)
          .order('due_date', { ascending: true })
          .limit(15)

        if (dueReminders) {
          for (const rem of dueReminders) {
            if (coveredReminderIds.has(rem.id)) continue
            const isReadLocal = typeof window !== 'undefined' && localStorage.getItem(`read_reminder_due_${rem.id}`) === 'true'
            let timeLabel = ''
            if (rem.due_date) {
              const [y, m, d] = rem.due_date.split('-')
              timeLabel = `${d}/${m}/${y}`
              if (rem.due_time) timeLabel += ` às ${rem.due_time.substring(0, 5)}`
            }

            items.push({
              id: `reminder_due_${rem.id}`,
              type: 'reminder',
              title: `Lembrete: ${rem.title}`,
              message: rem.description || (timeLabel ? `Agendado para ${timeLabel}` : 'Você tem um lembrete para hoje.'),
              targetId: rem.id,
              targetUrl: '/lembretes',
              read: isReadLocal,
              createdAt: rem.created_at || new Date().toISOString(),
              metadata: {
                reminder_id: rem.id,
                source: 'reminders_table',
                priority: rem.priority,
              },
            })
          }
        }

        if (isMounted && items.length > 0) {
          dispatch({ type: 'UPSERT_NOTIFICATIONS', payload: items })
        }
      } catch (err) {
        console.warn('Falha ao processar lembretes para o sininho:', err)
      }
    }

    loadReminderNotifications()

    // Realtime subscription na tabela reminder_notifications para novos lembretes e atualizações de leitura
    const channel = supabase
      .channel(`bell_reminder_notifs_${currentUser.id}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reminder_notifications',
          filter: `user_id=eq.${currentUser.id}`,
        },
        async (payload: any) => {
          const r = payload.new
          if (!r) return

          let remTitle = ''
          let remDesc = ''
          let remPriority = 'Normal'
          if (r.reminder_id) {
            const { data: remData } = await supabase
              .from('reminders')
              .select('title, description, priority')
              .eq('id', r.reminder_id)
              .single()
            if (remData) {
              remTitle = remData.title
              remDesc = remData.description
              remPriority = remData.priority
            }
          }

          const newItem: NotificationItem = {
            id: `reminder_notif_${r.id}`,
            type: 'reminder',
            title: r.title?.trim() || (remTitle ? `Lembrete: ${remTitle}` : 'Lembrete'),
            message: r.message?.trim() || remDesc || 'Você tem um novo lembrete!',
            targetId: r.reminder_id,
            targetUrl: '/lembretes',
            read: Boolean(r.read),
            createdAt: r.created_at || new Date().toISOString(),
            metadata: {
              dbId: r.id,
              reminder_id: r.reminder_id,
              source: 'reminder_notifications',
              priority: remPriority,
            },
          }
          dispatch({ type: 'ADD_NOTIFICATION', payload: newItem })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'reminder_notifications',
          filter: `user_id=eq.${currentUser.id}`,
        },
        (payload: any) => {
          const r = payload.new
          if (!r) return
          if (r.read) {
            dispatch({ type: 'MARK_AS_READ', payload: `reminder_notif_${r.id}` })
          }
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      channel.unsubscribe()
    }
  }, [currentUser?.id])

  // Escuta evento local de leitura emitido pelo popup de lembrete (Visto ou Adiar)
  useEffect(() => {
    const handleReminderRead = (e: any) => {
      const id = e?.detail?.id
      if (id) {
        dispatch({ type: 'MARK_AS_READ', payload: `reminder_notif_${id}` })
      }
    }

    window.addEventListener('hydro_reminder_read', handleReminderRead as EventListener)
    return () => window.removeEventListener('hydro_reminder_read', handleReminderRead as EventListener)
  }, [])

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

  // Processador central de atividades do Instacena com filtro estrito de destinatário
  const processInstacenaActivity = useCallback((activity: any) => {
    if (!activity || !activity.actorId) return

    // 1. NUNCA notificar a si próprio (ações executadas pelo próprio usuário)
    if (currentUser?.id && activity.actorId === currentUser.id) return
    if (currentUser?.name && activity.actorName && currentUser.name.trim().toLowerCase() === activity.actorName.trim().toLowerCase()) return

    // 2. Para 'like' e 'comment', SOMENTE o autor do post original deve receber a notificação
    if (activity.type === 'like' || activity.type === 'comment') {
      if (activity.targetUserId && currentUser?.id && activity.targetUserId !== currentUser.id) {
        return
      }
    }

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
  }, [currentUser, addNotification])

  // Subscribe to Instacena activities via BroadcastChannel
  useEffect(() => {
    let bc: BroadcastChannel | null = null

    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('instacena_activity_bus')
        bc.onmessage = (event) => {
          processInstacenaActivity(event?.data)
        }
      }
    } catch (e) {
      console.warn('Failed to setup Instacena BroadcastChannel:', e)
    }

    return () => {
      if (bc) bc.close()
    }
  }, [processInstacenaActivity])

  // Also listen for local window events
  useEffect(() => {
    const handleLocalEvent = (e: CustomEvent) => {
      processInstacenaActivity(e?.detail)
    }

    window.addEventListener('instacena_activity', handleLocalEvent as EventListener)
    return () => window.removeEventListener('instacena_activity', handleLocalEvent as EventListener)
  }, [processInstacenaActivity])

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
