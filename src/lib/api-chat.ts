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

export async function getConversationMessages(conversationId: string, limit = 50, beforeTime?: string) {
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
  
  const { data: myParticipations } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId1)

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
    
  if (convError || !newConv) throw new Error('Could not create conversation')

  // Add participants
  await supabase
    .from('conversation_participants')
    .insert([
      { conversation_id: newConv.id, user_id: userId1 },
      { conversation_id: newConv.id, user_id: userId2 }
    ])

  return newConv.id
}
