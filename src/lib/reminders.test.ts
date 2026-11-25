import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockState = vi.hoisted(() => ({
  remindersUpdateMock: vi.fn(),
  mentionsDeleteMock: vi.fn(),
  mentionsInsertMock: vi.fn(),
  getUserMock: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getUser: mockState.getUserMock,
    },
    from: (table: string) => {
      if (table === 'reminders') {
        return {
          update: (payload: any) => {
            mockState.remindersUpdateMock(payload)
            return {
              eq: () => ({
                select: () => ({
                  single: async () => ({ data: { id: 'rem-1', ...payload }, error: null }),
                }),
              }),
            }
          },
          insert: (rows: any[]) => ({
            select: () => ({
              single: async () => ({ data: { id: 'rem-new', ...rows[0] }, error: null }),
            }),
          }),
        }
      }
      if (table === 'reminder_mentions') {
        return {
          delete: () => ({
            eq: async (col: string, val: string) => {
              mockState.mentionsDeleteMock(col, val)
              return { error: null }
            },
          }),
          insert: async (rows: any[]) => {
            mockState.mentionsInsertMock(rows)
            return { error: null }
          },
        }
      }
      return {}
    },
  },
}))

import {
  buildReminderMentionsPayload,
  createReminder,
  getReminderResponsibleIds,
  isReminderForAllUsers,
  resolveReminderInitialMentions,
  updateReminder,
  type Reminder,
  type UserProfile,
} from './api-reminders'

describe('Lembretes - Responsáveis, Todos (Grupo) e Persistência de Menções', () => {
  const users: UserProfile[] = [
    { id: 'u-alex', email: 'alex@sucena.com', name: 'Alexassandra Souza Chaves', avatar_url: '' },
    { id: 'u-jose', email: 'jose@sucena.com', name: 'José Maria', avatar_url: '' },
    { id: 'u-fabricio', email: 'fab@sucena.com', name: 'Fabrício Silva', avatar_url: '' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockState.getUserMock.mockResolvedValue({ data: { user: { id: 'u-fabricio' } } })
  })

  it('buildReminderMentionsPayload ao selecionar ALL deve expandir para UUIDs válidos, limpar assigned_user_id e marcar isAll=true', () => {
    const payload = buildReminderMentionsPayload({
      mentions: ['ALL'],
      users,
      currentUserId: 'u-fabricio',
    })

    expect(payload.isAll).toBe(true)
    expect(payload.assignedUserId).toBeNull()
    expect(payload.mentionUserIds).toEqual(['u-alex', 'u-jose', 'u-fabricio'])
    expect(payload.mentionUserIds).not.toContain('ALL')
  })

  it('buildReminderMentionsPayload com usuários específicos deve manter assigned_user_id no primeiro e isAll=false', () => {
    const payload = buildReminderMentionsPayload({
      mentions: ['u-jose', 'u-fabricio', 'u-jose'],
      users,
      currentUserId: 'u-fabricio',
    })

    expect(payload.isAll).toBe(false)
    expect(payload.assignedUserId).toBe('u-jose')
    expect(payload.mentionUserIds).toEqual(['u-jose', 'u-fabricio'])
  })

  it('isReminderForAllUsers deve detectar lembrete para todos tanto por flag isAll quanto por menção de todos os usuários (legado)', () => {
    const legacyAllReminder: Partial<Reminder> = {
      assigned_user_id: 'u-alex',
      reminder_mentions: [
        { user_id: 'u-alex' },
        { user_id: 'u-jose' },
        { user_id: 'u-fabricio' },
      ],
    }
    expect(isReminderForAllUsers(legacyAllReminder, users)).toBe(true)
    expect(resolveReminderInitialMentions(legacyAllReminder, users)).toEqual(['ALL'])

    const flaggedAllReminder: Partial<Reminder> = {
      assigned_user_id: null,
      recurrence_config: { isAll: true },
      reminder_mentions: [{ user_id: 'u-alex' }],
    }
    expect(isReminderForAllUsers(flaggedAllReminder, users)).toBe(true)
    expect(resolveReminderInitialMentions(flaggedAllReminder, users)).toEqual(['ALL'])

    const specificReminder: Partial<Reminder> = {
      assigned_user_id: 'u-alex',
      reminder_mentions: [{ user_id: 'u-alex' }, { user_id: 'u-jose' }],
    }
    expect(isReminderForAllUsers(specificReminder, users)).toBe(false)
    expect(getReminderResponsibleIds(specificReminder)).toEqual(['u-alex', 'u-jose'])
    expect(resolveReminderInitialMentions(specificReminder, users)).toEqual(['u-alex', 'u-jose'])
  })

  it('updateReminder sem passar mentions (ex: Adiar ou Concluir) NÃO deve apagar reminder_mentions existentes', async () => {
    await updateReminder('rem-1', { due_date: '2026-11-26', last_notified_at: null })

    expect(mockState.remindersUpdateMock).toHaveBeenCalledWith({
      due_date: '2026-11-26',
      last_notified_at: null,
    })
    expect(mockState.mentionsDeleteMock).not.toHaveBeenCalled()
    expect(mockState.mentionsInsertMock).not.toHaveBeenCalled()
  })

  it('updateReminder passando mentions explícitas deve atualizar reminder_mentions sem duplicatas e sem sentinela ALL', async () => {
    await updateReminder('rem-1', { title: 'Atualizado' }, ['u-alex', 'u-jose', 'u-alex', 'ALL'])

    expect(mockState.mentionsDeleteMock).toHaveBeenCalledWith('reminder_id', 'rem-1')
    expect(mockState.mentionsInsertMock).toHaveBeenCalledWith([
      { reminder_id: 'rem-1', user_id: 'u-alex', mentioned_by: 'u-fabricio' },
      { reminder_id: 'rem-1', user_id: 'u-jose', mentioned_by: 'u-fabricio' },
    ])
  })

  it('createReminder deve deduplicar menções e filtrar eventual sentinela ALL', async () => {
    await createReminder({ title: 'Vistoria' }, ['u-alex', 'u-alex', 'ALL', 'u-jose'])

    expect(mockState.mentionsInsertMock).toHaveBeenCalledWith([
      { reminder_id: 'rem-new', user_id: 'u-alex', mentioned_by: 'u-fabricio' },
      { reminder_id: 'rem-new', user_id: 'u-jose', mentioned_by: 'u-fabricio' },
    ])
  })
})
