import { describe, it, expect } from 'vitest'
import { filterRemindersForUser, type Reminder } from './api-reminders'

describe('Regras de Visibilidade de Lembretes', () => {
  const userA = 'user-creator-123'
  const userB = 'user-mentioned-456'
  const userC = 'user-unmentioned-789'

  const mockReminders: Reminder[] = [
    {
      id: 'rem-1',
      title: 'Reunião de Contrato Hydro',
      description: 'Alinhamento com equipe',
      creator_id: userA,
      assigned_user_id: userB,
      reminder_mentions: [{ user_id: userB }],
      status: 'Pendente',
      priority: 'Alta',
      is_recurring: false,
      created_at: '2026-10-20T10:00:00Z',
      updated_at: '2026-10-20T10:00:00Z'
    },
    {
      id: 'rem-2',
      title: 'Relatório Mensal',
      creator_id: userA,
      status: 'Concluído',
      priority: 'Normal',
      is_recurring: false,
      created_at: '2026-10-19T10:00:00Z',
      updated_at: '2026-10-19T10:00:00Z'
    },
    {
      id: 'rem-3',
      title: 'Lembrete exclusivo do User B',
      creator_id: userB,
      status: 'Pendente',
      priority: 'Normal',
      is_recurring: false,
      created_at: '2026-10-20T12:00:00Z',
      updated_at: '2026-10-20T12:00:00Z'
    }
  ]

  it('na tela de Lembretes (/lembretes - creatorOnly), o lembrete é exibido exclusivamente ao criador', () => {
    // User A criou rem-1 e rem-2
    const userAReminders = filterRemindersForUser(mockReminders, userA, { creatorOnly: true })
    expect(userAReminders.map(r => r.id)).toEqual(['rem-1', 'rem-2'])

    // User B foi mencionado em rem-1, mas na tela de Lembretes NÃO deve ver rem-1, apenas o que ele próprio criou (rem-3)
    const userBReminders = filterRemindersForUser(mockReminders, userB, { creatorOnly: true })
    expect(userBReminders.map(r => r.id)).toEqual(['rem-3'])
    expect(userBReminders.some(r => r.id === 'rem-1')).toBe(false)

    // User C não criou nenhum lembrete
    const userCReminders = filterRemindersForUser(mockReminders, userC, { creatorOnly: true })
    expect(userCReminders).toEqual([])
  })

  it('no Dashboard, lembretes criados pelo usuário E onde ele foi mencionado são exibidos', () => {
    // User A vê seus criados
    const userADashboard = filterRemindersForUser(mockReminders, userA, { creatorOnly: false })
    expect(userADashboard.map(r => r.id)).toContain('rem-1')
    expect(userADashboard.map(r => r.id)).toContain('rem-2')

    // User B vê rem-3 (criado por ele) E rem-1 (onde foi mencionado)
    const userBDashboard = filterRemindersForUser(mockReminders, userB, { creatorOnly: false })
    expect(userBDashboard.map(r => r.id)).toContain('rem-1')
    expect(userBDashboard.map(r => r.id)).toContain('rem-3')
    expect(userBDashboard.map(r => r.id)).not.toContain('rem-2') // Não criado nem mencionado
  })

  it('usuário que não tenha sido mencionado não recebe e não vê nenhum lembrete de terceiros', () => {
    // User C não criou e não foi mencionado em nenhum lembrete
    const userCDashboard = filterRemindersForUser(mockReminders, userC, { creatorOnly: false })
    expect(userCDashboard).toEqual([])

    const userCLembretes = filterRemindersForUser(mockReminders, userC, { creatorOnly: true })
    expect(userCLembretes).toEqual([])
  })

  it('quando não há usuário autenticado (null ou undefined), retorna lista vazia', () => {
    expect(filterRemindersForUser(mockReminders, null)).toEqual([])
    expect(filterRemindersForUser(mockReminders, undefined)).toEqual([])
  })
})
