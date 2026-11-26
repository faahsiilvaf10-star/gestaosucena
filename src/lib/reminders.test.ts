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
  filterDashboardRemindersForToday,
  getLocalDateStr,
  getLocalDayOfWeek,
  getReminderResponsibleIds,
  isReminderForAllUsers,
  resolveReminderInitialMentions,
  shouldAutoExpireReminderNotification,
  shouldDisplayReminderNotification,
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

describe('Lembretes - Expiração de data única e exibição no modal', () => {
  it('getLocalDateStr deve converter UTC para dia local no fuso America/Belem (UTC-3)', () => {
    // 2026-11-26T01:30:00Z = 2026-11-25 22:30:00 em Belém (ainda dia 25)
    expect(getLocalDateStr(new Date('2026-11-26T01:30:00Z'))).toBe('2026-11-25')
    // 2026-11-26T04:00:00Z = 2026-11-26 01:00:00 em Belém (já dia 26)
    expect(getLocalDateStr(new Date('2026-11-26T04:00:00Z'))).toBe('2026-11-26')
  })

  it('lembrete pontual (não recorrente) deve exibir apenas na data agendada e expirar nos dias seguintes', () => {
    const oneTimeReminder: Partial<Reminder> = {
      is_recurring: false,
      due_date: '2026-11-25',
      status: 'Pendente',
    }

    // No dia anterior (aviso prévio) e no próprio dia agendado: NÃO expira
    expect(shouldAutoExpireReminderNotification(oneTimeReminder, '2026-11-24')).toBe(false)
    expect(shouldAutoExpireReminderNotification(oneTimeReminder, '2026-11-25')).toBe(false)
    expect(shouldDisplayReminderNotification({
      reminder: oneTimeReminder,
      todayStr: '2026-11-25',
    })).toBe(true)

    // No dia seguinte (26/11): deve expirar automaticamente e NÃO aparecer no comunicado/modal
    expect(shouldAutoExpireReminderNotification(oneTimeReminder, '2026-11-26')).toBe(true)
    expect(shouldDisplayReminderNotification({
      reminder: oneTimeReminder,
      todayStr: '2026-11-26',
    })).toBe(false)
  })

  it('lembrete recorrente deve continuar elegível mesmo quando due_date original for antigo', () => {
    const recurringReminder: Partial<Reminder> = {
      is_recurring: true,
      due_date: '2026-10-21',
      status: 'Pendente',
    }

    expect(shouldAutoExpireReminderNotification(recurringReminder, '2026-11-26')).toBe(false)
    expect(shouldDisplayReminderNotification({
      reminder: recurringReminder,
      todayStr: '2026-11-26',
    })).toBe(true)
  })

  it('lembrete concluído ou cancelado nunca deve exibir no modal', () => {
    expect(shouldAutoExpireReminderNotification({
      is_recurring: false,
      due_date: '2026-11-26',
      status: 'Concluído',
    }, '2026-11-26')).toBe(true)

    expect(shouldAutoExpireReminderNotification({
      is_recurring: true,
      due_date: null,
      status: 'Cancelado',
    }, '2026-11-26')).toBe(true)
  })

  it('deve respeitar snooze com timestamp futuro e voltar a exibir após vencer', () => {
    const activeReminder: Partial<Reminder> = {
      is_recurring: false,
      due_date: '2026-11-26',
      status: 'Pendente',
    }

    const nowMs = new Date('2026-11-26T13:00:00-03:00').getTime()
    expect(shouldDisplayReminderNotification({
      reminder: activeReminder,
      snoozedVal: '2026-11-26T14:00:00-03:00',
      todayStr: '2026-11-26',
      nowMs,
    })).toBe(false)

    expect(shouldDisplayReminderNotification({
      reminder: activeReminder,
      snoozedVal: '2026-11-26T12:00:00-03:00',
      todayStr: '2026-11-26',
      nowMs,
    })).toBe(true)

    expect(shouldDisplayReminderNotification({
      reminder: activeReminder,
      snoozedVal: '2026-11-26',
      todayStr: '2026-11-26',
      nowMs,
    })).toBe(false)
  })
})

describe('getLocalDayOfWeek e filterDashboardRemindersForToday', () => {
  const makeReminder = (overrides: Partial<Reminder>): Reminder => ({
    id: 'rem-1',
    title: 'Lembrete',
    description: null,
    creator_id: 'creator-1',
    assigned_user_id: null,
    due_date: '2026-11-26',
    due_time: '09:00:00',
    priority: 'Normal',
    status: 'Pendente',
    is_recurring: false,
    recurrence_config: null,
    created_at: '2026-11-26T10:00:00Z',
    updated_at: '2026-11-26T10:00:00Z',
    reminder_mentions: [],
    ...overrides,
  })

  it('retorna o dia da semana correto no fuso America/Belem', () => {
    // 2026-11-26T01:30:00Z corresponde a 25/11 22:30 (quarta = 3)
    expect(getLocalDayOfWeek(new Date('2026-11-26T01:30:00Z'))).toBe(3)
    // 2026-11-26T04:00:00Z corresponde a 26/11 01:00 (quinta = 4)
    expect(getLocalDayOfWeek(new Date('2026-11-26T04:00:00Z'))).toBe(4)
  })

  it('inclui lembrete criado pelo usuário para outro responsável, filtra por data/status/recorrência e ordena por horário', () => {
    const todayStr = '2026-11-26'
    const todayDow = 4 // quinta-feira

    const createdForOther = makeReminder({
      id: 'rem-creator',
      title: 'TESTE',
      creator_id: 'user-current',
      assigned_user_id: 'user-other',
      due_date: '2026-11-26',
      due_time: '13:34:00',
      reminder_mentions: [{ user_id: 'user-other' }],
    })

    const assignedDirect = makeReminder({
      id: 'rem-assigned',
      title: 'Atribuído direto',
      creator_id: 'user-other',
      assigned_user_id: 'user-current',
      due_date: '2026-11-26',
      due_time: '08:00:00',
    })

    const recurringToday = makeReminder({
      id: 'rem-rec-today',
      title: 'Recorrente Quinta',
      creator_id: 'user-other',
      assigned_user_id: null,
      due_date: null,
      due_time: '10:30:00',
      is_recurring: true,
      recurrence_config: { isAll: true, days: [4] },
    })

    const recurringWrongDay = makeReminder({
      id: 'rem-rec-other',
      title: 'Recorrente Sexta',
      creator_id: 'user-current',
      due_date: null,
      due_time: '07:00:00',
      is_recurring: true,
      recurrence_config: { days: [5] },
    })

    const futureReminder = makeReminder({
      id: 'rem-future',
      title: 'Data futura',
      creator_id: 'user-current',
      due_date: '2026-11-30',
      due_time: '07:30:00',
    })

    const completedReminder = makeReminder({
      id: 'rem-done',
      title: 'Já concluído',
      creator_id: 'user-current',
      status: 'Concluído',
      due_date: '2026-11-26',
      due_time: '06:00:00',
    })

    const canceledReminder = makeReminder({
      id: 'rem-cancel',
      title: 'Cancelado',
      creator_id: 'user-current',
      status: 'Cancelado',
      due_date: '2026-11-26',
      due_time: '06:30:00',
    })

    const result = filterDashboardRemindersForToday(
      [
        createdForOther,
        futureReminder,
        completedReminder,
        canceledReminder,
        recurringToday,
        recurringWrongDay,
        assignedDirect,
      ],
      'user-current',
      todayStr,
      todayDow,
    )

    expect(result.map((r) => r.id)).toEqual([
      'rem-assigned',
      'rem-rec-today',
      'rem-creator',
    ])
  })
})
