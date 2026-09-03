import { supabase } from './supabase'

export type Reminder = {
  id: string
  title: string
  description?: string
  creator_id: string
  assigned_user_id?: string
  status: 'Pendente' | 'Em andamento' | 'Concluído' | 'Cancelado'
  priority: 'Baixa' | 'Normal' | 'Alta' | 'Urgente'
  due_date?: string
  due_time?: string
  is_recurring: boolean
  completed_at?: string
  created_at: string
  updated_at: string
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
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error("Error fetching reminders:", error)
    return []
  }
  return data || []
}

export async function createReminder(reminder: Partial<Reminder>) {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Não autenticado')

  const { data, error } = await supabase
    .from('reminders')
    .insert([{ ...reminder, creator_id: userData.user.id }])
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function updateReminder(id: string, updates: Partial<Reminder>) {
  const { data, error } = await supabase
    .from('reminders')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
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
