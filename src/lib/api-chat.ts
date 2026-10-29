import { supabase } from './supabase'

export type ChatUserPresence = {
  user_id: string
  is_online: boolean
  last_seen: string
  last_heartbeat: string
}

export type Conversation = {
  id: string
  type: 'direct' | 'group'
  created_at: string
  updated_at: string
  last_message_id?: string
  last_message_at: string
}

export type ConversationParticipant = {
  id: string
  conversation_id: string
  user_id: string
  joined_at: string
  last_read_message_id?: string
  last_read_at?: string
  is_muted: boolean
  cleared_at?: string
}

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'system'
export type MessageStatus = 'sent' | 'delivered' | 'read'

export type Message = {
  id: string
  conversation_id: string
  sender_id: string
  type: MessageType
  text: string
  reply_to_message_id?: string
  created_at: string
  updated_at: string
  deleted_at?: string
  deleted_for_everyone: boolean
  status: MessageStatus
  
  // Joins that might be populated by the API
  sender?: {
    id: string
    name: string
    avatar_url?: string
  }
  attachments?: MessageAttachment[]
}

export type MessageAttachment = {
  id: string
  message_id: string
  type: MessageType
  file_url: string
  file_path: string
  file_name?: string
  mime_type?: string
  file_size?: number
  duration?: number
  created_at: string
}

// Funções base de API
export async function getConversations() {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      participants:conversation_participants(*),
      last_message:messages!last_message_id(*)
    `)
    .order('last_message_at', { ascending: false })

  if (error) {
    console.error('Error fetching conversations:', error)
    return []
  }
  return data
}

export async function getConversationMessages(conversationId: string, currentUserId: string, limit = 50, beforeTime?: string) {
  // First get the cleared_at timestamp for the current user
  const { data: participant } = await supabase
    .from('conversation_participants')
    .select('cleared_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', currentUserId)
    .single()

  let query = supabase
    .from('messages')
    .select(`
      *,
      attachments:message_attachments(*)
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (beforeTime) {
    query = query.lt('created_at', beforeTime)
  }
  
  if (participant?.cleared_at) {
    query = query.gt('created_at', participant.cleared_at)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching messages:', error)
    return []
  }
  return data
}

export async function sendMessage(payload: Omit<Message, 'id' | 'created_at' | 'updated_at' | 'status' | 'deleted_for_everyone'>) {
  const { data, error } = await supabase
    .from('messages')
    .insert([{ ...payload, status: 'sent' }])
    .select()
    .single()

  if (error) {
    console.error('Error sending message:', error)
    throw error
  }
  
  // A trigger or function could automatically update conversation.last_message_id
  // But for now, we'll do it manually to ensure consistency if no trigger exists.
  await supabase
    .from('conversations')
    .update({ 
      last_message_id: data.id, 
      last_message_at: new Date().toISOString() 
    })
    .eq('id', payload.conversation_id)

  return data
}

export async function getOrCreateDirectConversation(userId1: string, userId2: string) {
  // First, try to find an existing conversation
  // This is a complex query, we can use an RPC ideally, but for now we'll do it with JS
  
  const { data: myParticipations, error: myPartError } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId1)
    
  if (myPartError) {
    console.error('myPartError', myPartError)
    throw new Error('Falha ao buscar participações: ' + myPartError.message)
  }

  if (myParticipations && myParticipations.length > 0) {
    const myConvIds = myParticipations.map(p => p.conversation_id)
    
    const { data: otherParticipations } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId2)
      .in('conversation_id', myConvIds)
      
    if (otherParticipations && otherParticipations.length > 0) {
      // Return the first match (there should only be one direct conversation between two users)
      return otherParticipations[0].conversation_id
    }
  }

  // If not found, create new conversation
  const { data: newConv, error: convError } = await supabase
    .from('conversations')
    .insert([{ type: 'direct' }])
    .select()
    .single()
    
  if (convError || !newConv) {
    console.error('convError', convError)
    throw new Error('Erro ao criar conversa no banco: ' + (convError?.message || 'Erro desconhecido'))
  }

  // Add participants
  await supabase
    .from('conversation_participants')
    .insert([
      { conversation_id: newConv.id, user_id: userId1 },
      { conversation_id: newConv.id, user_id: userId2 }
    ])

  return newConv.id
}

export async function clearConversation(conversationId: string, userId: string) {
  const now = new Date().toISOString()

  // 1. Persistência local imediata para garantir exclusão permanente no cliente
  try {
    if (typeof window !== 'undefined' && userId) {
      const storageKey = 'sucena_deleted_conversations_' + userId
      const raw = localStorage.getItem(storageKey)
      const map = raw ? JSON.parse(raw) : {}
      map[conversationId] = now
      localStorage.setItem(storageKey, JSON.stringify(map))
    }
  } catch (e) {
    console.warn('Erro ao salvar conversa excluída no localStorage:', e)
  }

  // 2. Atualiza no Supabase
  try {
    const { error } = await supabase
      .from('conversation_participants')
      .update({ cleared_at: now })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)

    if (error) {
      console.warn('Aviso ao atualizar cleared_at no Supabase:', error)
    }
  } catch (err) {
    console.warn('Falha na requisição de exclusão no Supabase:', err)
  }
}

export function restoreConversation(conversationId: string, userId: string) {
  try {
    if (typeof window !== 'undefined' && userId) {
      const storageKey = 'sucena_deleted_conversations_' + userId
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const map = JSON.parse(raw)
        delete map[conversationId]
        localStorage.setItem(storageKey, JSON.stringify(map))
      }
    }
  } catch (e) {
    console.warn('Erro ao restaurar conversa no localStorage:', e)
  }
}


export async function getUnreadMessagesData(currentUserId: string): Promise<{
  totalUnread: number
  unreadByConversation: Record<string, number>
  unreadConversationsCount: number
}> {
  if (!currentUserId) {
    return { totalUnread: 0, unreadByConversation: {}, unreadConversationsCount: 0 }
  }

  try {
    const { data: participations, error: partError } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at, cleared_at, last_read_message_id')
      .eq('user_id', currentUserId)

    if (partError || !participations || participations.length === 0) {
      return { totalUnread: 0, unreadByConversation: {}, unreadConversationsCount: 0 }
    }

    const convIds = participations.map(p => p.conversation_id)

    // Only messages from others (sender_id != currentUserId)
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, created_at, status')
      .in('conversation_id', convIds)
      .neq('sender_id', currentUserId)
      .neq('status', 'read')

    if (msgError || !messages) {
      return { totalUnread: 0, unreadByConversation: {}, unreadConversationsCount: 0 }
    }

    const unreadByConversation: Record<string, number> = {}
    let totalUnread = 0

    let localDeletedMap: Record<string, string> = {}
    try {
      if (typeof window !== 'undefined' && currentUserId) {
        const raw = localStorage.getItem('sucena_deleted_conversations_' + currentUserId)
        if (raw) localDeletedMap = JSON.parse(raw)
      }
    } catch (_) {}

    const partMap = new Map()
    participations.forEach(p => partMap.set(p.conversation_id, p))

    messages.forEach(msg => {
      const p = partMap.get(msg.conversation_id)
      if (!p) return

      // Exclude messages before user cleared conversation (db or local)
      const localCleared = localDeletedMap[msg.conversation_id]
      const dbCleared = p.cleared_at
      const effectiveCleared = localCleared || dbCleared
      if (effectiveCleared && new Date(msg.created_at).getTime() <= new Date(effectiveCleared).getTime()) {
        return
      }

      // Exclude messages at or before user's last_read_at
      if (p.last_read_at && new Date(msg.created_at).getTime() <= new Date(p.last_read_at).getTime()) {
        return
      }

      // Exclude last read message ID
      if (p.last_read_message_id && msg.id === p.last_read_message_id) {
        return
      }

      unreadByConversation[msg.conversation_id] = (unreadByConversation[msg.conversation_id] || 0) + 1
      totalUnread++
    })

    const unreadConversationsCount = Object.keys(unreadByConversation).length

    return { totalUnread, unreadByConversation, unreadConversationsCount }
  } catch (err) {
    console.error('Error fetching unread messages count:', err)
    return { totalUnread: 0, unreadByConversation: {}, unreadConversationsCount: 0 }
  }
}

export async function markConversationAsRead(conversationId: string, currentUserId: string) {
  if (!conversationId || !currentUserId) return

  const now = new Date().toISOString()
  try {
    // 1. Update participant last_read_at
    await supabase
      .from('conversation_participants')
      .update({ last_read_at: now })
      .eq('conversation_id', conversationId)
      .eq('user_id', currentUserId)

    // 2. Mark messages received from others in this conversation as read
    await supabase
      .from('messages')
      .update({ status: 'read' })
      .eq('conversation_id', conversationId)
      .neq('sender_id', currentUserId)
      .neq('status', 'read')
  } catch (err) {
    console.error('Error marking conversation as read:', err)
  }
}
