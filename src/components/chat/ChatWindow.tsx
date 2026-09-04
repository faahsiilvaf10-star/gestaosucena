import { useEffect, useState, useRef } from 'react'
import { ArrowLeft, MoreVertical, Search, Play } from 'lucide-react'
import { useChat } from '../../contexts/ChatContext'
import { useTheme } from '../../contexts/ThemeContext'
import { supabase } from '../../lib/supabase'
import { getConversationMessages, Message } from '../../lib/api-chat'
import { format, isToday, isYesterday } from 'date-fns'
import { ChatComposer } from './ChatComposer'
import ptBR from 'date-fns/locale/pt-BR'

function formatMessageDate(dateString: string) {
  const d = new Date(dateString)
  if (isToday(d)) return 'Hoje'
  if (isYesterday(d)) return 'Ontem'
  return format(d, 'dd/MM/yyyy')
}

export function ChatWindow({ currentUserId, conversationId }: { currentUserId: string, conversationId: string }) {
  const { isDark } = useTheme()
  const { setActiveConversation } = useChat()
  const [messages, setMessages] = useState<Message[]>([])
  const [contactName, setContactName] = useState('Carregando...')
  const [contactStatus, setContactStatus] = useState('')
  const [contactAvatar, setContactAvatar] = useState('')
  
  const scrollRef = useRef<HTMLDivElement>(null)

  // Rolagem automática
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  // Efeito de carregamento inicial
  useEffect(() => {
    let channel: any

    const loadData = async () => {
      // 1. Carrega as mensagens
      const msgs = await getConversationMessages(conversationId)
      // As mensagens vêm mais recentes primeiro (order: created_at desc)
      setMessages(msgs.reverse())
      setTimeout(scrollToBottom, 100)
      
      // 2. Busca informações do outro usuário na conversa
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .neq('user_id', currentUserId)
      
      if (participations && participations.length > 0) {
        const otherUserId = participations[0].user_id
        // Pega os dados do outro usuário (aproveitando o RPC get_users que já existe)
        const { data: users } = await supabase.rpc('get_users')
        const otherUser = users?.find((u: any) => u.id === otherUserId)
        if (otherUser) {
          setContactName(otherUser.name)
          setContactAvatar(otherUser.avatar_url || '')
        }
        
        // Inscreve-se na presença deste usuário
        const { data: presence } = await supabase.from('user_presence').select('*').eq('user_id', otherUserId).single()
        if (presence) {
          setContactStatus(presence.is_online ? 'Online' : 'Offline')
        }
      }

      // 3. Inscreve-se no canal de Realtime para ESTA conversa
      channel = supabase.channel(`chat_${conversationId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            const newMsg = payload.new as Message
            setMessages(prev => [...prev, newMsg])
            setTimeout(scrollToBottom, 50)
            
            // Marca como lida se formos o destinatário
            if (newMsg.sender_id !== currentUserId && document.visibilityState === 'visible') {
              supabase.from('messages').update({ status: 'read' }).eq('id', newMsg.id).then()
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new as Message : m))
          }
        )
        .subscribe()
    }
    
    loadData()
    
    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [conversationId, currentUserId])

  const handleMessageSent = () => {
    scrollToBottom()
  }

  // Agrupamento por datas
  const groupedMessages: { date: string, messages: Message[] }[] = []
  let lastDate = ''
  
  messages.forEach(msg => {
    const msgDate = formatMessageDate(msg.created_at)
    if (msgDate !== lastDate) {
      groupedMessages.push({ date: msgDate, messages: [msg] })
      lastDate = msgDate
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg)
    }
  })

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* HEADER */}
      <div className={`h-16 shrink-0 px-4 flex items-center justify-between border-b z-10 ${isDark ? 'border-white/5 bg-[#111216]' : 'border-black/5 bg-white'}`}>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setActiveConversation(null)}
            className="md:hidden p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
            {contactAvatar ? (
              <img src={contactAvatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
               <span className="text-gray-500 font-bold">{contactName.substring(0,2).toUpperCase()}</span>
            )}
          </div>
          
          <div className="flex flex-col leading-tight max-w-[200px]">
            <span className="font-semibold text-sm truncate" title={contactName}>{contactName}</span>
            <span className={`text-xs truncate ${contactStatus === 'Online' ? 'text-[#D6A72B]' : 'text-gray-500'}`}>{contactStatus}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-gray-400">
          <button className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
            <Search size={18} />
          </button>
          <button className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      {/* MESSAGES AREA */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-cover bg-center"
        style={{
           // Background discreto do Whatsapp (opcional, pode deixar liso se preferir)
           backgroundImage: isDark ? 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M54.627 0l.83.83v58.34h-58.34v-58.34h57.51zm-4.996 15.65c-2.485-2.484-6.52-2.484-9.004 0-2.484 2.484-2.484 6.52 0 9.004 2.484 2.484 6.52 2.484 9.004 0 2.484-2.484 2.484-6.52 0-9.004zm-14.143-2.828c-1.38-1.38-3.623-1.38-5.003 0-1.38 1.38-1.38 3.623 0 5.003 1.38 1.38 3.623 1.38 5.003 0 1.38-1.38 1.38-3.623 0-5.003z\' fill=\'%23ffffff\' fill-opacity=\'0.015\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")' : 'none',
           backgroundColor: isDark ? 'transparent' : '#f0f2f5'
        }}
      >
        {groupedMessages.map((group, gIdx) => (
          <div key={gIdx} className="space-y-3">
            <div className="flex flex-col items-center sticky top-2 z-10 my-4">
              <span className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full shadow-sm ${isDark ? 'bg-[#1A1B20]/90 text-white/50 border border-white/5 backdrop-blur-sm' : 'bg-white/90 text-gray-500 border border-black/5 backdrop-blur-sm'}`}>
                {group.date}
              </span>
            </div>
            
            {group.messages.map(msg => {
              const isMine = msg.sender_id === currentUserId
              const time = format(new Date(msg.created_at), 'HH:mm')
              
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`
                    max-w-[85%] md:max-w-[75%] rounded-2xl p-2.5 shadow-sm relative group
                    ${isMine 
                      ? (isDark ? 'bg-[#25200F] text-white rounded-tr-sm' : 'bg-[#e7f8d6] text-gray-900 rounded-tr-sm') 
                      : (isDark ? 'bg-[#202126] text-white rounded-tl-sm border border-white/5' : 'bg-white text-gray-900 rounded-tl-sm border border-black/5')
                    }
                  `}>
                    {msg.type === 'text' && (
                      <p className="text-[14.5px] leading-snug whitespace-pre-wrap break-words">{msg.text}</p>
                    )}
                    {msg.type === 'audio' && (
                      <div className="flex items-center gap-3 pr-8 min-w-[200px]">
                        <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                          <Play size={18} className={isMine ? 'text-[#D6A72B]' : 'text-gray-300'} />
                        </button>
                        {/* Audio Waveform dummy */}
                        <div className="flex-1 flex items-center gap-0.5 opacity-50">
                          {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
                            <div key={i} className="w-1 h-3 bg-current rounded-full" style={{ height: `${Math.max(2, Math.random() * 16)}px` }}/>
                          ))}
                        </div>
                        <audio src={msg.text} controls className="hidden" />
                      </div>
                    )}
                    {msg.type === 'image' && (
                      <div className="max-w-[250px] md:max-w-[300px] overflow-hidden rounded-xl">
                        <img src={msg.text} alt="Anexo" className="w-full h-auto object-cover cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(msg.text, '_blank')} />
                      </div>
                    )}
                    <div className="float-right mt-1 ml-3 flex items-center gap-1 opacity-70">
                      <span className="text-[10px]">{time}</span>
                      {isMine && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
                          className={msg.status === 'read' ? 'text-blue-400' : 'text-gray-400'}
                        >
                          <path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/>
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* INPUT AREA */}
      <ChatComposer 
        currentUserId={currentUserId} 
        conversationId={conversationId} 
        onMessageSent={handleMessageSent} 
      />
    </div>
  )
}
