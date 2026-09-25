import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Threshold idêntico ao usePresence.ts: 60s sem heartbeat = offline
const OFFLINE_THRESHOLD_MS = 60_000

function isReallyOnline(p: { is_online: boolean; last_heartbeat?: string | null } | null): boolean {
  if (!p || !p.is_online) return false
  if (!p.last_heartbeat) return false
  return (Date.now() - new Date(p.last_heartbeat).getTime()) < OFFLINE_THRESHOLD_MS
}

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
  // Guarda snapshot do estado anterior de presença para detectar a transição offline→online
  const presenceSnapshotRef = useRef<Record<string, boolean>>({})
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

      // Carrega estado inicial de presença (snapshot)
      const { data: presences } = await supabase.from('user_presence').select('*')
      if (presences) {
        presences.forEach((p: any) => {
          presenceSnapshotRef.current[p.user_id] = isReallyOnline(p)
        })
      }

      // Aguarda 2s antes de começar a disparar notificações (evita flood no carregamento inicial)
      setTimeout(() => { initializedRef.current = true }, 2000)
    }

    init()

    // Escuta mudanças na tabela user_presence em tempo real
    const channel = supabase.channel(`online_notif_${currentUserId}_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, (payload: any) => {
        if (!initializedRef.current) return
        const p = payload.new
        if (!p || p.user_id === currentUserId) return

        const wasOnline = presenceSnapshotRef.current[p.user_id] ?? false
        const isNowOnline = isReallyOnline(p)

        // Atualiza snapshot
        presenceSnapshotRef.current[p.user_id] = isNowOnline

        // Só notifica quando ENTROU (transição offline → online)
        if (!wasOnline && isNowOnline) {
          const user = usersMapRef.current[p.user_id]
          const notifId = `${p.user_id}_${Date.now()}`
          const newNotif: OnlineNotif = {
            id: notifId,
            userId: p.user_id,
            name: user?.name || 'Usuário',
            avatarUrl: user?.avatar_url || '',
            role: user?.role || ''
          }

          // Toca o som de notificação
          playOnlineSound()

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

  return (
    <div className="fixed bottom-20 right-5 z-[200] flex flex-col-reverse gap-3 pointer-events-none">
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
            <p className="font-semibold text-[13px] text-gray-900 dark:text-white truncate leading-tight">
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
