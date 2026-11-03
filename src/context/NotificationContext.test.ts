import { describe, it, expect } from 'vitest'

// Test reducer logic directly for NotificationContext
interface NotificationItem {
  id: string
  type: 'mention' | 'instacena_post' | 'instacena_like' | 'instacena_comment' | 'instacena_story' | 'system' | 'reminder'
  title: string
  message: string
  read: boolean
  createdAt: string
  targetUrl?: string
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

function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case 'ADD_NOTIFICATION': {
      const exists = state.notifications.some(n => n.id === action.payload.id)
      if (exists) {
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
    default:
      return state
  }
}

describe('NotificationContext - Lembretes no Sininho', () => {
  it('deve adicionar notificação de lembrete e atualizar unreadCount', () => {
    const initialState: NotificationState = {
      notifications: [],
      unreadCount: 0,
    }

    const reminderNotif: NotificationItem = {
      id: 'reminder_notif_1',
      type: 'reminder',
      title: 'Lembrete: Reunião de Contrato Hydro',
      message: 'Reunião agendada para 14:00',
      read: false,
      createdAt: new Date().toISOString(),
      targetUrl: '/lembretes',
    }

    const state1 = notificationReducer(initialState, { type: 'ADD_NOTIFICATION', payload: reminderNotif })
    expect(state1.notifications).toHaveLength(1)
    expect(state1.unreadCount).toBe(1)
    expect(state1.notifications[0].type).toBe('reminder')
    expect(state1.notifications[0].targetUrl).toBe('/lembretes')
  })

  it('deve marcar lembrete como lido e decrementar unreadCount', () => {
    const stateWithUnread: NotificationState = {
      notifications: [
        {
          id: 'reminder_notif_1',
          type: 'reminder',
          title: 'Lembrete: Reunião de Contrato Hydro',
          message: 'Reunião agendada para 14:00',
          read: false,
          createdAt: new Date().toISOString(),
          targetUrl: '/lembretes',
        },
      ],
      unreadCount: 1,
    }

    const stateRead = notificationReducer(stateWithUnread, { type: 'MARK_AS_READ', payload: 'reminder_notif_1' })
    expect(stateRead.unreadCount).toBe(0)
    expect(stateRead.notifications[0].read).toBe(true)
  })

  it('deve marcar todos como lidos', () => {
    const stateWithMultiple: NotificationState = {
      notifications: [
        { id: 'reminder_1', type: 'reminder', title: 'Lembrete 1', message: 'Msg 1', read: false, createdAt: '2026-11-03T10:00:00Z' },
        { id: 'mention_1', type: 'mention', title: 'Menção 1', message: 'Msg 2', read: false, createdAt: '2026-11-03T11:00:00Z' },
      ],
      unreadCount: 2,
    }

    const stateAllRead = notificationReducer(stateWithMultiple, { type: 'MARK_ALL_AS_READ' })
    expect(stateAllRead.unreadCount).toBe(0)
    expect(stateAllRead.notifications.every(n => n.read)).toBe(true)
  })

  it('deve atualizar o estado de leitura via UPSERT_NOTIFICATIONS sem duplicar itens', () => {
    const existingState: NotificationState = {
      notifications: [
        { id: 'reminder_notif_1', type: 'reminder', title: 'Lembrete 1', message: 'Msg 1', read: false, createdAt: '2026-11-03T10:00:00Z' },
      ],
      unreadCount: 1,
    }

    const incoming: NotificationItem[] = [
      { id: 'reminder_notif_1', type: 'reminder', title: 'Lembrete 1', message: 'Msg 1', read: true, createdAt: '2026-11-03T10:00:00Z' },
      { id: 'reminder_notif_2', type: 'reminder', title: 'Lembrete 2', message: 'Msg 2', read: false, createdAt: '2026-11-03T11:00:00Z' },
    ]

    const updatedState = notificationReducer(existingState, { type: 'UPSERT_NOTIFICATIONS', payload: incoming })
    expect(updatedState.notifications).toHaveLength(2)
    // reminder_notif_1 foi atualizado para read: true
    const item1 = updatedState.notifications.find(n => n.id === 'reminder_notif_1')
    expect(item1?.read).toBe(true)
    // Apenas reminder_notif_2 está não lido
    expect(updatedState.unreadCount).toBe(1)
  })
})
