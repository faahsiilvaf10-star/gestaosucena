import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useChat } from '../contexts/ChatContext'
import { Message, getUnreadMessagesData } from '../lib/api-chat'

export function useChatRealtime(currentUserId?: string) {
  const { setUnreadCountGlobally, activeChats } = useChat()
  const activeChatsRef = useRef(activeChats)
  
  useEffect(() => {
    activeChatsRef.current = activeChats
  }, [activeChats])

  const refreshUnreadCount = useCallback(async () => {
    if (!currentUserId) return
    try {
      const data = await getUnreadMessagesData(currentUserId)
      setUnreadCountGlobally(data.totalUnread)
    } catch (err) {
      console.error('Erro ao atualizar contagem de mensagens nao lidas:', err)
    }
  }, [currentUserId, setUnreadCountGlobally])

  useEffect(() => {
    if (!currentUserId) return

    // Busca contagem inicial real de nao lidas vindas de outros usuarios
    refreshUnreadCount()

    // Ouve eventos de leitura locais para recalcular
    const handleLocalRead = () => {
      refreshUnreadCount()
    }
    window.addEventListener('hydro_chat_read', handleLocalRead)

    // Inscreve-se nas mensagens novas direcionadas as minhas conversas
    const channelName = `chat_messages_updates_${currentUserId}_${Date.now()}_${Math.random()}`
    const messagesChannel = supabase.channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          const newMessage = payload.new as Message
          
          // REGRA DE OURO: So faz contagem se ALGUEM enviar mensagem para mim.
          // Se eu sou o remetente, descarta imediatamente.
          if (!newMessage || newMessage.sender_id === currentUserId) return
          
          // Se eu estiver com a conversa aberta na tela e a janela visivel, marca como lida
          if (activeChatsRef.current.includes(newMessage.conversation_id) && document.visibilityState === 'visible') {
            supabase.from('messages')
              .update({ status: 'read' })
              .eq('id', newMessage.id)
              .then()
              
            supabase.from('conversation_participants')
              .update({ last_read_message_id: newMessage.id, last_read_at: new Date().toISOString() })
              .eq('conversation_id', newMessage.conversation_id)
              .eq('user_id', currentUserId)
              .then()
          } else {
            // Conversa nao esta ativa: incrementa contador de nao lidas
            setUnreadCountGlobally((prev: number) => prev + 1)
          }

          // Dispara evento para atualizar listas e conversas em tempo real
          window.dispatchEvent(new CustomEvent('hydro_chat_new_message', { detail: newMessage }))
        }
      )
      .subscribe()

    return () => {
      window.removeEventListener('hydro_chat_read', handleLocalRead)
      supabase.removeChannel(messagesChannel)
    }
  }, [currentUserId, setUnreadCountGlobally, refreshUnreadCount])
}
