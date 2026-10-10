import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useUsersPresence } from '../hooks/useUsersPresence'

// Toca o som de notificação de online
function playOnlineSound() {
  try {
    const audio = new Audio('/chat-online.mp3')
    audio.volume = 0.6
    audio.play().catch(() => {/* Autoplay bloqueado pelo browser, ignora */})
  } catch (_) {}
}

interface OnlineNotif {
  id: string
  userId: string
  name: string
  avatarUrl?: string
  role?: string
  exiting?: boolean
}

export function UserOnlineNotification({ currentUserId }: { currentUserId: string }) {
  const [notifications, setNotifications] = useState<OnlineNotif[]>([])
  
  const { data: usersMap } = useUsersPresence()
  const previousPresenceRef = useRef<Record<string, boolean>>({})
  const initializedRef = useRef(false)

  useEffect(() => {
    // Aguarda 2s antes de começar a disparar notificações (evita flood no carregamento inicial)
    const t = setTimeout(() => { initializedRef.current = true }, 2000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!usersMap || !currentUserId) return

    Object.values(usersMap).forEach(user => {
      if (user.id === currentUserId) return
      
      const wasOnline = previousPresenceRef.current[user.id] ?? false
      const isNowOnline = user.isOnline

      // Atualiza snapshot
      previousPresenceRef.current[user.id] = isNowOnline

      // Só notifica quando ENTROU (transição offline → online)
      if (initializedRef.current && !wasOnline && isNowOnline) {
        const notifId = `${user.id}_${Date.now()}`
        const newNotif: OnlineNotif = {
          id: notifId,
          userId: user.id,
          name: user.name || 'Usuário',
          avatarUrl: user.avatar_url || '',
          role: user.role || ''
        }

        playOnlineSound()
        setNotifications(prev => [...prev, newNotif])

        const startRemovalTimer = () => {
          setTimeout(() => {
            setNotifications(prev =>
              prev.map(n => n.id === notifId ? { ...n, exiting: true } : n)
            )
            setTimeout(() => {
              setNotifications(prev => prev.filter(n => n.id !== notifId))
            }, 400)
          }, 10000)
        }

        if (document.hasFocus()) {
          startRemovalTimer()
        } else {
          const onFocus = () => {
            window.removeEventListener('focus', onFocus)
            startRemovalTimer()
          }
          window.addEventListener('focus', onFocus)
        }
      }
    })
  }, [usersMap, currentUserId])

  if (notifications.length === 0) return null

  return (
    <div className="fixed bottom-20 right-5 z-[9999] flex flex-col-reverse gap-3 pointer-events-none">
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
            {/* Bolinha verde de online */}
            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-white dark:border-[#1A1B20]" />
          </div>

          {/* Texto */}
          <div className="flex-1 overflow-hidden">
            <p className="font-semibold text-[13px] text-white truncate leading-tight">
              {notif.name}
            </p>
            <p className="text-[11px] text-green-500 font-medium mt-0.5 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Acabou de entrar
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
