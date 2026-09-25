import { useEffect, useState, useRef } from 'react'
import { ArrowLeft, MoreVertical, Search, Play, Minus, User } from 'lucide-react'
import { useChat } from '../../contexts/ChatContext'
import { useTheme } from '../../contexts/ThemeContext'
import { supabase } from '../../lib/supabase'
import { getConversationMessages, clearConversation, Message } from '../../lib/api-chat'
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns'
import { ChatComposer } from './ChatComposer'
import { ptBR as localePtBr } from 'date-fns/locale/pt-BR'
import { VerifiedBadge, isAdmin } from '../ui/VerifiedBadge'

function formatLastSeen(dateStr?: string | null) {
  if (!dateStr) return 'Offline'
  try {
    const d = new Date(dateStr)
    return 'Visto ' + formatDistanceToNow(d, { addSuffix: true, locale: localePtBr })
  } catch(e) {
    return 'Offline'
  }
}

// Deve ser idêntico ao OFFLINE_THRESHOLD_MS do usePresence.ts
const OFFLINE_THRESHOLD_MS = 60_000

function isReallyOnline(p: { is_online: boolean; last_heartbeat?: string | null } | null | undefined): boolean {
  if (!p || !p.is_online) return false
  if (!p.last_heartbeat) return false
  return (Date.now() - new Date(p.last_heartbeat).getTime()) < OFFLINE_THRESHOLD_MS
}

// Toca o som de notificação de mensagem recebida
function playNotificationSound() {
  try {
    const audio = new Audio('/chat-notification.mp3')
    audio.volume = 0.7
    audio.play().catch(() => {})
  } catch (_) {}
}

// Ícone de status estilo WhatsApp
function MessageStatus({ status }: { status: string }) {
  if (status === 'read') {
    // Dois checks AZUIS
    return (
      <svg width="16" height="11" viewBox="0 0 16 11" fill="none" className="inline-block ml-1 shrink-0">
        <path d="M11.071 0.5L4.5 7.071 1.929 4.5 0.5 5.929l4 4L12.5 1.929 11.071 0.5z" fill="#53BDEB"/>
        <path d="M15.071 0.5L8.5 7.071 7.5 6.071 6.071 7.5l2.429 2.429L16.5 1.929 15.071 0.5z" fill="#53BDEB"/>
      </svg>
    )
  }
  if (status === 'delivered') {
    // Dois checks CINZA
    return (
      <svg width="16" height="11" viewBox="0 0 16 11" fill="none" className="inline-block ml-1 shrink-0">
        <path d="M11.071 0.5L4.5 7.071 1.929 4.5 0.5 5.929l4 4L12.5 1.929 11.071 0.5z" fill="currentColor" fillOpacity="0.5"/>
        <path d="M15.071 0.5L8.5 7.071 7.5 6.071 6.071 7.5l2.429 2.429L16.5 1.929 15.071 0.5z" fill="currentColor" fillOpacity="0.5"/>
      </svg>
    )
  }
  // sent (1 check CINZA)
  return (
    <svg width="11" height="11" viewBox="0 0 12 11" fill="none" className="inline-block ml-1 shrink-0">
      <path d="M10.071 0.5L3.5 7.071 0.929 4.5 -0.5 5.929l4 4L11.5 1.929 10.071 0.5z" fill="currentColor" fillOpacity="0.5"/>
    </svg>
  )
}

function formatMessageDate(dateString: string) {
  const d = new Date(dateString)
  if (isToday(d)) return 'Hoje'
  if (isYesterday(d)) return 'Ontem'
  return format(d, 'dd/MM/yyyy')
}

export function ChatWindow({ currentUserId, conversationId }: { currentUserId: string, conversationId: string }) {
  const { isDark } = useTheme()
  const { closeChat } = useChat()
  const [messages, setMessages] = useState<Message[]>([])
  const [contactName, setContactName] = useState('Carregando...')
  const [contactRole, setContactRole] = useState('')
  const [contactStatus, setContactStatus] = useState<string>('Offline')
  const [contactAvatar, setContactAvatar] = useState('')
  const [showOptions, setShowOptions] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  // Guarda o raw de presença para recalcular via threshold
  const contactPresenceRawRef = useRef<{ is_online: boolean; last_heartbeat?: string | null } | null>(null)
  const recalcIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  
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
    let presenceChannel: any

    const loadData = async () => {
      // 1. Carrega as mensagens
      const msgs = await getConversationMessages(conversationId, currentUserId)
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
        const { data: users } = await supabase.rpc('get_users')
        const otherUser = users?.find((u: any) => u.id === otherUserId)
        if (otherUser) {
          setContactName(otherUser.name)
          setContactRole(otherUser.role || '')
          setContactAvatar(otherUser.avatar_url || '')
        }
        
        // Busca presença inicial
        const { data: presence } = await supabase
          .from('user_presence')
          .select('*')
          .eq('user_id', otherUserId)
          .single()
        
        if (presence) {
          contactPresenceRawRef.current = presence
          setContactStatus(isReallyOnline(presence) ? 'Online' : formatLastSeen(presence?.last_heartbeat))
        }

        // Intervalo local para recalcular status por threshold (detecta queda sem update no banco)
        if (recalcIntervalRef.current) clearInterval(recalcIntervalRef.current)
        recalcIntervalRef.current = setInterval(() => {
          setContactStatus(isReallyOnline(contactPresenceRawRef.current) ? 'Online' : formatLastSeen(contactPresenceRawRef.current?.last_heartbeat))
        }, 15_000)

        // Subscription REALTIME na presença do contato
        // Atualiza IMEDIATAMENTE quando o heartbeat chega ou is_online muda
        const presChannelName = `chat_presence_${otherUserId}_${conversationId}_${Date.now()}`
        presenceChannel = supabase.channel(presChannelName)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'user_presence', filter: `user_id=eq.${otherUserId}` },
            (payload: any) => {
              const p = payload.new
              if (p) {
                contactPresenceRawRef.current = p
                setContactStatus(isReallyOnline(p) ? 'Online' : formatLastSeen(p?.last_heartbeat))
              }
            }
          )
          .subscribe()
      }

      // 3. Inscreve-se no canal de Realtime para ESTA conversa
      const channelName = `chat_${conversationId}_${Date.now()}_${Math.random()}`
      channel = supabase.channel(channelName)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            const newMsg = payload.new as Message
            setMessages(prev => [...prev, newMsg])
            setTimeout(scrollToBottom, 50)
            
            if (newMsg.sender_id !== currentUserId) {
              playNotificationSound()
              if (document.visibilityState === 'visible') {
                supabase.from('messages').update({ status: 'read' }).eq('id', newMsg.id).then()
              } else {
                supabase.from('messages').update({ status: 'delivered' }).eq('id', newMsg.id).then()
              }
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

      // Marca mensagens recebidas não lidas como "read"
      const unread = msgs.filter(m => m.sender_id !== currentUserId && m.status !== 'read')
      if (unread.length > 0) {
        const ids = unread.map(m => m.id)
        supabase.from('messages').update({ status: 'read' }).in('id', ids).then()
      }
    }
    
    loadData()
    
    return () => {
      if (channel) supabase.removeChannel(channel)
      if (presenceChannel) supabase.removeChannel(presenceChannel)
      if (recalcIntervalRef.current) clearInterval(recalcIntervalRef.current)
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

  const handleClearConversation = async () => {
    if (confirm('Tem certeza que deseja limpar as mensagens desta conversa da sua tela?')) {
      await clearConversation(conversationId, currentUserId)
      setMessages([])
      setShowOptions(false)
    }
  }

  if (isMinimized) {
    return (
      <div 
        onClick={() => setIsMinimized(false)}
        className="pointer-events-auto w-[52px] h-[52px] rounded-full shadow-xl cursor-pointer hover:scale-105 transition-transform border-2 border-[#D6A72B] flex items-center justify-center bg-gray-200 shrink-0 relative mb-1"
        title={contactName}
      >
        {contactAvatar ? (
          <img src={contactAvatar} alt={contactName} className="w-full h-full object-cover rounded-full" />
        ) : (
          <User size={24} className="text-gray-400" />
        )}
        {contactStatus === 'Online' && (
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-white dark:border-[#111216]" />
        )}
      </div>
    )
  }

  return (
    <div className={`pointer-events-auto shadow-2xl flex flex-col transition-all duration-300 rounded-t-xl ${isDark ? 'bg-[#111216] border border-white/10' : 'bg-white border border-black/10'}`} style={{ width: '330px', height: '450px', maxHeight: 'calc(100vh - 100px)' }}>
      <div className="flex flex-col h-full w-full overflow-hidden relative rounded-t-xl">
        {/* HEADER */}
      <div className={`h-[52px] shrink-0 px-3 flex items-center justify-between border-b z-20 shadow-sm ${isDark ? 'border-white/5 bg-[#1A1B20]' : 'border-black/5 bg-gray-50'}`}>
        <div className="flex items-center gap-2 overflow-hidden flex-1 cursor-pointer">
          
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
              {contactAvatar ? (
                <img src={contactAvatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                 <span className="text-gray-500 font-bold text-xs">{contactName.substring(0,2).toUpperCase()}</span>
              )}
            </div>
            {contactStatus === 'Online' && (
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-current" style={{ borderColor: isDark ? '#1A1B20' : '#F9FAFB' }} />
            )}
          </div>
          
          <div className="flex flex-col leading-tight overflow-hidden">
            <span className={`font-semibold text-[13px] truncate flex items-center ${isDark ? 'text-white' : 'text-gray-900'}`} title={contactName}>
              {contactName}
              {isAdmin(contactName, contactRole) && <VerifiedBadge />}
            </span>
            <span className={`text-[10px] truncate ${contactStatus === 'Online' ? 'text-[#D6A72B]' : 'text-gray-500'}`}>{contactStatus}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-gray-400 relative">
          <button 
            onClick={() => setIsMinimized(true)}
            className={`p-1.5 rounded-full transition-colors ${isDark ? 'hover:bg-white/10 text-white/70' : 'hover:bg-black/5 text-gray-600'}`}
            title="Minimizar"
          >
            <Minus size={16} />
          </button>

          <button 
            onClick={() => setShowOptions(!showOptions)}
            className={`p-1.5 rounded-full transition-colors ${isDark ? 'hover:bg-white/10 text-white/70' : 'hover:bg-black/5 text-gray-600'}`}
          >
            <MoreVertical size={16} />
          </button>
          
          {showOptions && (
            <div className={`absolute top-10 right-0 w-36 rounded-lg shadow-xl overflow-hidden z-50 border ${isDark ? 'bg-[#15161A] border-white/10' : 'bg-white border-gray-100'}`}>
              <button 
                onClick={handleClearConversation}
                className={`w-full text-left px-4 py-2.5 text-xs transition-colors ${isDark ? 'hover:bg-white/5 text-white' : 'hover:bg-gray-50 text-gray-900'}`}
              >
                Limpar conversa
              </button>
            </div>
          )}

          <button 
            onClick={() => closeChat(conversationId)}
            className={`p-1.5 rounded-full transition-colors ${isDark ? 'hover:bg-red-500/20 hover:text-red-400 text-white/70' : 'hover:bg-red-50 hover:text-red-500 text-gray-600'}`}
          >
            <ArrowLeft className="hidden" /> {/* Para manter import se necessario, usaremos um X */}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
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
              <span className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full shadow-sm ${isDark ? 'bg-[#1A1B20]/90 text-gray-900 dark:text-white/50 border border-white/5 backdrop-blur-sm' : 'bg-white/90 text-gray-500 border border-black/5 backdrop-blur-sm'}`}>
                {group.date}
              </span>
            </div>
            
            {group.messages.map(msg => {
              const isMine = msg.sender_id === currentUserId
              const time = format(new Date(msg.created_at), 'HH:mm')
              
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-2.5 shadow-sm relative group ${isMine ? (isDark ? 'bg-[#25200F] text-gray-900 dark:text-white rounded-tr-sm' : 'bg-[#e7f8d6] text-gray-900 rounded-tr-sm') : (isDark ? 'bg-[#202126] text-gray-900 dark:text-white rounded-tl-sm border border-white/5' : 'bg-white text-gray-900 rounded-tl-sm border border-black/5') }`}>
                    {(() => {
                      const parts = (msg.text || '').split('|')
                      const url = parts[0]
                      const fileName = parts.length > 1 ? parts[1] : 'Anexo'

                      if (msg.type === 'text') {
                        return <p className="text-[14.5px] leading-snug whitespace-pre-wrap break-words">{msg.text}</p>
                      }
                      
                      if (msg.type === 'audio') {
                        return (
                          <div className="flex flex-col gap-2 min-w-[200px]">
                            <audio src={url} controls className="w-full h-10" />
                            {fileName && <span className="text-[10px] opacity-70 truncate">{fileName}</span>}
                          </div>
                        )
                      }
                      
                      if (msg.type === 'image') {
                        return (
                          <div className="max-w-[250px] md:max-w-[300px] overflow-hidden rounded-xl">
                            <img src={url} alt={fileName} className="w-full h-auto object-cover cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(url, '_blank')} />
                          </div>
                        )
                      }
                      
                      if (msg.type === 'video') {
                        return (
                          <div className="max-w-[250px] md:max-w-[300px] overflow-hidden rounded-xl">
                            <video src={url} controls className="w-full h-auto" />
                          </div>
                        )
                      }
                      
                      if (msg.type === 'document') {
                        return (
                          <a href={url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${isMine ? (isDark ? 'border-white/10 hover:bg-white/5 text-gray-900 dark:text-white' : 'border-black/10 hover:bg-black/5 text-gray-900') : (isDark ? 'border-white/10 hover:bg-white/5 text-white' : 'border-black/10 hover:bg-black/5 text-gray-900')}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isMine ? 'bg-[#D6A72B]' : 'bg-gray-500/20'}`}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isMine ? 'text-black' : 'text-current'}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                            </div>
                            <div className="flex flex-col overflow-hidden max-w-[150px]">
                              <span className="font-semibold text-sm truncate">{fileName}</span>
                              <span className="text-[10px] opacity-70 uppercase tracking-wider text-left">Baixar Arquivo</span>
                            </div>
                          </a>
                        )
                      }

                      return null
                    })()}
                    <div className="float-right mt-1 ml-3 flex items-center gap-0.5 opacity-80">
                      <span className="text-[10px]">{time}</span>
                      {isMine && (
                        <MessageStatus status={msg.status || 'sent'} />
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
    </div>
  )
}


