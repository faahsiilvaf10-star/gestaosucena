import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useChat } from '../contexts/ChatContext'
import { Message } from '../lib/api-chat'

export function useChatRealtime(currentUserId?: string) {
  const { setUnreadCountGlobally, activeConversation } = useChat()

  useEffect(() => {
    if (!currentUserId) return

    // Busca contagem inicial de não lidas
    const fetchUnreadCount = async () => {
      // Para saber as não lidas, pegamos as mensagens de conversas do usuário
      // onde a mensagem.id > conversation_participants.last_read_message_id
      // (Isso requereria uma query complexa. Para simplificar no frontend ou faremos uma RPC)
      // Como não criamos RPC no script SQL ainda, vamos fazer uma query aproximada
      
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', currentUserId)

      if (!participations || participations.length === 0) return

      const convIds = participations.map(p => p.conversation_id)
      
      // Busca mensagens nessas conversas criadas DEPOIS do last_read_at, que NÃO SÃO nossas
      let totalUnread = 0
      
      // Usando for loop para simplificar a lógica no frontend (embora RPC seja mais performático)
      // No mundo real, usaríamos supabase.rpc('get_unread_count', { uid: currentUserId })
      // Vamos tentar manter 0 por enquanto e contar conforme chegam, 
      // mas se o backend estiver disponível, seria a query acima
    }

    fetchUnreadCount()

    // Inscreve-se nas mensagens novas direcionadas às minhas conversas
    const messagesChannel = supabase.channel('chat_messages_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          const newMessage = payload.new as Message
          
          // Verifica se eu sou o remetente. Se sim, não é não-lida.
          if (newMessage.sender_id === currentUserId) return
          
          // Se eu estiver com a conversa aberta, marca como lida imediatamente
          if (activeConversation === newMessage.conversation_id && document.visibilityState === 'visible') {
            // Marca como visualizada
            supabase.from('messages')
              .update({ status: 'read' })
              .eq('id', newMessage.id)
              .then()
              
            supabase.from('conversation_participants')
              .update({ last_read_message_id: newMessage.id, last_read_at: new Date().toISOString() })
              .eq('conversation_id', activeConversation)
              .eq('user_id', currentUserId)
              .then()
          } else {
            // Aumenta o contador global se for pra mim (a RLS garante que eu só recebo da minha conversa)
            setUnreadCountGlobally(prev => prev + 1)
            // Tocar som opcional aqui
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(messagesChannel)
    }
  }, [currentUserId, activeConversation, setUnreadCountGlobally])
}
