import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getConversations, getOrCreateDirectConversation } from '../../lib/api-chat'
import { useChat } from '../../contexts/ChatContext'
import { useTheme } from '../../contexts/ThemeContext'
import { User, Check, CheckCheck } from 'lucide-react'
import { format } from 'date-fns'

// Utilizaremos dados locais de teste se a RPC original falhar para não quebrar.
export function ConversationList({ currentUserId }: { currentUserId: string }) {
  const { isDark } = useTheme()
  const { setActiveConversation } = useChat()
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])
  const [conversations, setConversations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUsers = async () => {
      // 1. Pega os usuários
      const { data: users, error } = await supabase.rpc('get_users')
      if (error) {
        console.error('Error fetching users:', error)
        return
      }

      // 2. Pega a presença online atual do banco
      const { data: presence } = await supabase.from('user_presence').select('*')
      
      const usersMap = (users || []).reduce((acc: any, u: any) => {
        const p = presence?.find(p => p.user_id === u.id)
        return {
          ...acc,
          [u.id]: {
            ...u,
            isOnline: p?.is_online || false,
            lastSeen: p?.last_seen || null
          }
        }
      }, {})
      
      // Remove a nós mesmos da lista e ordena os online primeiro
      const filtered = Object.values(usersMap).filter((u: any) => u.id !== currentUserId)
      filtered.sort((a: any, b: any) => (a.isOnline === b.isOnline) ? 0 : a.isOnline ? -1 : 1)
      
      setOnlineUsers(filtered)
      
      // 3. Pega conversas existentes
      const convs = await getConversations()
      // Filtra para as minhas conversas
      const myConvs = convs.filter((c: any) => c.participants?.some((p: any) => p.user_id === currentUserId))
        .map((conv: any) => {
          const activeUsers = conv.participants.filter((p: any) => p.user_id !== currentUserId).map((p: any) => usersMap[p.user_id])
          const title = conv.is_group ? conv.title : activeUsers[0]?.name || 'Usuário Desconhecido'
          return {
            ...conv,
            displayTitle: title,
            users: activeUsers
          }
        })
        .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      
      setConversations(myConvs)
      
      setLoading(false)
    }

    fetchUsers()

    // Inscrever-se para presenças alteradas e novas mensagens afetando a ordem da lista
    const presenceSub = supabase.channel('presence_list')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_presence' }, (payload: any) => {
        setOnlineUsers(prev => {
          const updated = [...prev]
          const idx = updated.findIndex(u => u.id === payload.new.user_id)
          if (idx > -1) {
            updated[idx] = { ...updated[idx], isOnline: payload.new.is_online, lastSeen: payload.new.last_seen }
            updated.sort((a: any, b: any) => (a.isOnline === b.isOnline) ? 0 : a.isOnline ? -1 : 1)
          }
          return updated
        })
      }).subscribe()

    return () => {
      supabase.removeChannel(presenceSub)
    }
  }, [currentUserId])

  const handleStartChat = async (targetUser: any) => {
    try {
      const convId = await getOrCreateDirectConversation(currentUserId, targetUser.id)
      setActiveConversation(convId) 
    } catch (err) {
      console.error('Error starting chat:', err)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-sm text-gray-500">Carregando contatos...</div>
  }

  return (
    <div className="flex flex-col">
      <div className="px-4 py-3">
        <h3 className="text-[11px] uppercase tracking-wider font-bold mb-3 text-[#D6A72B]">Online ({onlineUsers.filter(u => u.isOnline).length})</h3>
        <div className="space-y-1">
          {onlineUsers.map(user => (
            <button
              key={user.id}
              onClick={() => handleStartChat(user)}
              className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'
              }`}
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <User size={20} className="text-gray-400" />
                  )}
                </div>
                {user.isOnline && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-current" style={{ borderColor: isDark ? '#090A0C' : '#F9FAFB' }} />
                )}
              </div>
              <div className="flex-1 text-left overflow-hidden">
                <p className={`text-sm font-semibold truncate ${isDark ? 'text-gray-900 dark:text-white' : 'text-gray-900'}`}>{user.name}</p>
                <p className={`text-xs truncate ${isDark ? 'text-gray-900 dark:text-white/50' : 'text-gray-500'}`}>
                  {user.isOnline ? 'Online' : 'Offline'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Seção de Conversas Recentes */}
      {conversations.length > 0 && (
        <div className="px-4 py-3">
          <h3 className="text-[11px] uppercase tracking-wider font-bold mb-3 text-gray-500">Recentes</h3>
          <div className="space-y-1">
            {conversations.map(conv => {
              const otherUser = conv.users[0]
              
              const lastMsg = conv.last_message
              const isMe = lastMsg?.sender_id === currentUserId
              const unread = false // Lógica real de não lida precisaria cruzar last_read_message_id do currentUserId
              
              const msgTime = lastMsg ? format(new Date(lastMsg.created_at), 'HH:mm') : ''

              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConversation(conv.id)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                    isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                      {otherUser.avatar_url ? (
                        <img src={otherUser.avatar_url} alt={otherUser.name} className="w-full h-full object-cover" />
                      ) : (
                        <User size={24} className="text-gray-400" />
                      )}
                    </div>
                    {otherUser.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-current" style={{ borderColor: isDark ? '#090A0C' : '#F9FAFB' }} />
                    )}
                  </div>
                  
                  <div className="flex-1 text-left overflow-hidden border-b pb-3 pt-1 border-black/5 dark:border-white/5">
                    <div className="flex justify-between items-center mb-1">
                      <p className={`text-[15px] font-semibold truncate ${isDark ? 'text-gray-900 dark:text-white' : 'text-gray-900'}`}>{otherUser.name}</p>
                      <span className={`text-xs ${unread ? 'text-[#D6A72B] font-bold' : (isDark ? 'text-gray-900 dark:text-white/40' : 'text-gray-500')}`}>{msgTime}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <p className={`text-[13px] truncate pr-2 flex items-center gap-1 ${unread ? (isDark ? 'text-gray-900 dark:text-white' : 'text-gray-900 font-medium') : (isDark ? 'text-gray-900 dark:text-white/50' : 'text-gray-500')}`}>
                        {isMe && (
                           lastMsg.status === 'read' ? <CheckCheck size={14} className="text-blue-400" /> :
                           lastMsg.status === 'delivered' ? <CheckCheck size={14} className="text-gray-400" /> :
                           <Check size={14} className="text-gray-400" />
                        )}
                        {lastMsg ? (lastMsg.type === 'text' ? lastMsg.text : 'Mídia') : 'Nenhuma mensagem'}
                      </p>
                      
                      {unread && (
                        <div className="w-5 h-5 rounded-full bg-[#D6A72B] flex items-center justify-center text-[10px] font-bold text-gray-900 dark:text-white shrink-0">
                          1
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}


