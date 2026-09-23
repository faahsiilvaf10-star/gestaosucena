import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

// Toca o som de notificação de nova mensagem
function playNotificationSound() {
  try {
    const audio = new Audio('/chat-notification.mp3')
    audio.volume = 0.7
    audio.play().catch(() => {/* Autoplay bloqueado pelo browser, ignora */})
  } catch (_) {}
}

interface MessageNotif {
  id: string
  userId: string
  name: string
  text: string
  avatarUrl?: string
  exiting?: boolean
}

export function NewMessageNotification({ currentUserId }: { currentUserId: string }) {
  const [notifications, setNotifications] = useState<MessageNotif[]>([])
  const usersMapRef = useRef<Record<string, any>>({})
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!currentUserId) return

    const init = async () => {
      // Carrega todos os usuários
      const { data: users } = await supabase.rpc('get_users')
      if (users) {
        usersMapRef.current = (users as any[]).reduce((acc: any, u: any) => {
          acc[u.id] = u
          return acc
        }, {})
      }

      // Evita disparos ao carregar a página
      setTimeout(() => { initializedRef.current = true }, 2000)
    }

    init()

    // Escuta novas mensagens
    const channel = supabase.channel(`new_msg_notif_${currentUserId}_${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload: any) => {
        if (!initializedRef.current) return
        const msg = payload.new
        if (!msg || msg.sender_id === currentUserId) return

        // Verifica se o usuário atual participa da conversa
        const { data: participants } = await supabase
          .from('conversation_participants')
          .select('id')
          .eq('conversation_id', msg.conversation_id)
          .eq('user_id', currentUserId)

        if (participants && participants.length > 0) {
          const user = usersMapRef.current[msg.sender_id]
          const notifId = `${msg.id}_${Date.now()}`
          
          let previewText = msg.text
          if (msg.type !== 'text') {
            previewText = `Enviou um(a) ${msg.type === 'image' ? 'imagem' : msg.type === 'audio' ? 'áudio' : 'arquivo'}`
          }

          const newNotif: MessageNotif = {
            id: notifId,
            userId: msg.sender_id,
            name: user?.name || 'Usuário',
            avatarUrl: user?.avatar_url || '',
            text: previewText
          }

          // Toca o som de notificação
          playNotificationSound()

          setNotifications(prev => [...prev, newNotif])

          // Remove automaticamente após 5s com animação de saída
          setTimeout(() => {
            setNotifications(prev =>
              prev.map(n => n.id === notifId ? { ...n, exiting: true } : n)
            )
            setTimeout(() => {
              setNotifications(prev => prev.filter(n => n.id !== notifId))
            }, 400)
          }, 5000)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId])

  if (notifications.length === 0) return null

  // Usamos as mesmas classes da notificação de online
  return (
    <div className="fixed bottom-[140px] right-5 z-[200] flex flex-col-reverse gap-3 pointer-events-none">
      {notifications.map((notif) => (
        <div
          key={notif.id}
          className={`pointer-events-auto flex items-center gap-3 bg-white dark:bg-[#1A1B20] 
            border border-black/8 dark:border-white/10 rounded-2xl shadow-2xl px-4 py-3 
            min-w-[240px] max-w-[300px] transition-all duration-400
            ${notif.exiting
              ? 'opacity-0 translate-y-4 scale-95'
              : 'opacity-100 translate-y-0 scale-100 animate-slide-up-notif'
            }`}
          style={{
            boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)'
          }}
        >
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-11 h-11 rounded-full overflow-hidden bg-gray-200 dark:bg-zinc-700 flex items-center justify-center">
              {notif.avatarUrl ? (
                <img src={notif.avatarUrl} alt={notif.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-gray-500 dark:text-gray-300 font-bold text-sm">
                  {notif.name.substring(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            {/* Ícone de mensagem (opcional, pode ser bolinha azul) */}
            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#53BDEB] border-2 border-white dark:border-[#1A1B20]" />
          </div>

          {/* Texto */}
          <div className="flex-1 overflow-hidden">
            <p className="font-semibold text-[13px] text-gray-900 dark:text-white truncate leading-tight">
              {notif.name}
            </p>
            <p className="text-[11px] text-[#53BDEB] font-medium mt-0.5 truncate max-w-full">
              {notif.text}
            </p>
          </div>

          {/* Botão fechar */}
          <button
            onClick={() => {
              setNotifications(prev =>
                prev.map(n => n.id === notif.id ? { ...n, exiting: true } : n)
              )
              setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== notif.id))
              }, 400)
            }}
            className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
