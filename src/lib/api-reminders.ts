import { supabase } from './supabase'

export type ReminderRecurrenceConfig = {
  days?: number[]
  advanceNotice?: number
  cardColor?: string
  isPulsing?: boolean
  isAll?: boolean
  [key: string]: any
}

export type Reminder = {
  id: string
  title: string
  description?: string
  creator_id: string
  assigned_user_id?: string | null
  status: 'Pendente' | 'Em andamento' | 'Concluído' | 'Cancelado'
  priority: 'Baixa' | 'Normal' | 'Alta' | 'Urgente'
  due_date?: string | null
  due_time?: string | null
  is_recurring: boolean
  recurrence_type?: string
  recurrence_config?: ReminderRecurrenceConfig | null
  last_notified_at?: string | null
  completed_at?: string
  created_at: string
  updated_at: string
  reminder_mentions?: { user_id: string }[]
  environment?: string
  image_url?: string
  card_color?: string
  is_pulsing?: boolean
}

/**
 * Retorna a lista deduplicada de IDs de usuários responsáveis por um lembrete
 * (combinando `assigned_user_id` e `reminder_mentions`, sem o sentinela `'ALL'`).
 */
export function getReminderResponsibleIds(reminder?: Partial<Reminder> | null): string[] {
  if (!reminder) return []
  const mentionedIds = reminder.reminder_mentions?.map(m => m.user_id) || []
  const combined = [reminder.assigned_user_id, ...mentionedIds]
    .filter((id): id is string => Boolean(id) && id !== 'ALL')
  return Array.from(new Set(combined))
}

/**
 * Determina se um lembrete foi direcionado a todos os usuários (envio em grupo).
 * Considera a flag explícita `recurrence_config.isAll`, o sentinela `'ALL'` ou todos os usuários listados.
 */
export function isReminderForAllUsers(
  reminder?: Partial<Reminder> | null,
  users: Pick<UserProfile, 'id'>[] = []
): boolean {
  if (!reminder) return false
  if (reminder.recurrence_config?.isAll) return true
  if (reminder.assigned_user_id === 'ALL') return true
  if (reminder.reminder_mentions?.some(m => m.user_id === 'ALL')) return true

  if (users.length === 0) return false

  const responsibleIds = getReminderResponsibleIds(reminder)
  if (responsibleIds.length === 0) return false

  const responsibleSet = new Set(responsibleIds)
  return responsibleIds.length >= users.length || users.every(u => responsibleSet.has(u.id))
}

/**
 * Resolve o estado inicial do campo de responsáveis no formulário de edição do lembrete.
 */
export function resolveReminderInitialMentions(
  reminder?: Partial<Reminder> | null,
  users: Pick<UserProfile, 'id'>[] = []
): string[] {
  if (!reminder) return []
  if (isReminderForAllUsers(reminder, users)) return ['ALL']
  return getReminderResponsibleIds(reminder)
}

/**
 * Prepara os campos `assigned_user_id`, `isAll` e `mentionUserIds` (UUIDs válidos) para persistência.
 * Expande `'ALL'` em IDs reais de usuários para respeitar a FK UUID de `reminder_mentions`,
 * evitando atribuir o lembrete a apenas um usuário em `assigned_user_id`.
 */
export function buildReminderMentionsPayload(params: {
  mentions: string[]
  users: Pick<UserProfile, 'id'>[]
  currentUserId?: string | null
}): {
  isAll: boolean
  assignedUserId: string | null
  mentionUserIds: string[]
} {
  const { mentions, users, currentUserId } = params
  const isAll = mentions.includes('ALL')

  if (isAll) {
    const allIds = users.map(u => u.id).filter(Boolean)
    if (currentUserId && !allIds.includes(currentUserId)) {
      allIds.push(currentUserId)
    }
    return {
      isAll: true,
      assignedUserId: null,
      mentionUserIds: Array.from(new Set(allIds)),
    }
  }

  const specificIds = Array.from(
    new Set(mentions.filter((id): id is string => Boolean(id) && id !== 'ALL'))
  )

  return {
    isAll: false,
    assignedUserId: specificIds.length > 0 ? specificIds[0] : null,
    mentionUserIds: specificIds,
  }
}

export function getReminderCardColor(reminder?: Reminder | null): string | undefined {
  if (!reminder) return undefined
  return reminder.recurrence_config?.cardColor || reminder.card_color || undefined
}

export function getReminderIsPulsing(reminder?: Reminder | null): boolean {
  if (!reminder) return false
  return !!(reminder.recurrence_config?.isPulsing ?? reminder.is_pulsing ?? false)
}

export type UserProfile = {
  id: string
  email: string
  name: string
  avatar_url: string
}

export async function fetchUsers(): Promise<UserProfile[]> {
  const { data, error } = await supabase.rpc('get_users')
  if (error) {
    console.error("Error fetching users:", error)
    return []
  }
  return data || []
}

export async function fetchReminders(): Promise<Reminder[]> {
  const env = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
  
  const { data, error } = await supabase
    .from('reminders')
    .select('*, reminder_mentions(user_id)')
    .eq('environment', env)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error("Error fetching reminders:", error)
    return []
  }
  return data || []
}

export async function createReminder(reminder: Partial<Reminder>, mentions?: string[]) {
  const env = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Não autenticado')

  const { data, error } = await supabase
    .from('reminders')
    .insert([{ ...reminder, creator_id: userData.user.id, environment: env }])
    .select()
    .single()
  
  if (error) throw error

  const uniqueMentions = Array.from(new Set((mentions || []).filter(id => Boolean(id) && id !== 'ALL')))
  if (uniqueMentions.length > 0) {
    const mentionsData = uniqueMentions.map(userId => ({
      reminder_id: data.id,
      user_id: userId,
      mentioned_by: userData.user.id
    }))
    const { error: mentionsError } = await supabase.from('reminder_mentions').insert(mentionsData)
    if (mentionsError) {
      console.error("Erro ao inserir menções:", mentionsError)
      // Throw para avisar o front
      throw mentionsError
    }
  }

  return data
}

export async function updateReminder(id: string, updates: Partial<Reminder>, mentions?: string[]) {
  // 1. Atualizar lembrete principal
  const { data, error } = await supabase
    .from('reminders')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  // 2. Atualizar menções apenas quando explicitamente informadas (preserva menções em ações como Adiar/Concluir)
  if (mentions !== undefined) {
    const { error: deleteError } = await supabase.from('reminder_mentions').delete().eq('reminder_id', id)
    if (deleteError) {
      console.error("Erro ao limpar menções:", deleteError)
      throw deleteError
    }

    const uniqueMentions = Array.from(new Set(mentions.filter(uid => Boolean(uid) && uid !== 'ALL')))
    if (uniqueMentions.length > 0) {
      const { data: userData } = await supabase.auth.getUser()
      const mentionsData = uniqueMentions.map(userId => ({
        reminder_id: id,
        user_id: userId,
        ...(userData.user?.id ? { mentioned_by: userData.user.id } : {})
      }))
      const { error: mentionsError } = await supabase.from('reminder_mentions').insert(mentionsData)
      if (mentionsError) {
        console.error("Erro ao atualizar menções:", mentionsError)
        throw mentionsError
      }
    }
  }

  return data
}

export async function uploadReminderImage(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Math.random()}.${fileExt}`
  const filePath = `${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('reminders_media')
    .upload(filePath, file)

  if (uploadError) {
    throw uploadError
  }

  const { data } = supabase.storage
    .from('reminders_media')
    .getPublicUrl(filePath)

  return data.publicUrl
}

export async function toggleReminderCompletion(id: string, currentStatus: string) {
  const newStatus = currentStatus === 'Concluído' ? 'Pendente' : 'Concluído'
  const { data: userData } = await supabase.auth.getUser()
  
  const updates: any = { 
    status: newStatus,
    updated_at: new Date().toISOString()
  }

  if (newStatus === 'Concluído') {
    updates.completed_at = new Date().toISOString()
    updates.completed_by = userData.user?.id
  } else {
    updates.completed_at = null
    updates.completed_by = null
  }

  return updateReminder(id, updates)
}

export async function deleteReminder(id: string) {
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}
