import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function playReminderSound() {
  try {
    const audio = new Audio('/comunicado.mp3') // Reutilizando o som de comunicado existente
    audio.volume = 0.8
    audio.play().catch(() => {/* Autoplay bloqueado pelo browser, ignora */})
  } catch (_) {}
}

interface ReminderNotif {
  id: string
  title: string
  message: string
  exiting?: boolean
}

export function ReminderAlertNotification({ currentUserId }: { currentUserId: string }) {
  const [notifications, setNotifications] = useState<ReminderNotif[]>([])
  
  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase.channel(`reminder_notif_${currentUserId}_${Date.now()}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'reminder_notifications',
        filter: `user_id=eq.${currentUserId}` 
      }, (payload: any) => {
        const notif = payload.new

        const notifId = notif.id
        const newNotif: ReminderNotif = {
          id: notifId,
          title: notif.title || 'Lembrete',
          message: notif.message || 'Você tem um novo lembrete!'
        }

        playReminderSound()

        setNotifications(prev => [...prev, newNotif])

        // Remove automaticamente após 10s
        setTimeout(() => {
          setNotifications(prev =>
            prev.map(n => n.id === notifId ? { ...n, exiting: true } : n)
          )
          setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== notifId))
          }, 400)
        }, 10000)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId])

  if (notifications.length === 0) return null

  return (
    <div className="fixed top-20 right-5 z-[250] flex flex-col gap-3 pointer-events-none">
      {notifications.map((notif) => (
        <div
          key={notif.id}
          className={`pointer-events-auto flex items-start gap-4 bg-white dark:bg-[#1A1B20] 
            border-l-4 border-l-[#D6A72B] border-y border-r border-black/10 dark:border-white/10 rounded-r-xl shadow-2xl px-5 py-4 
            min-w-[280px] max-w-[350px] transition-all duration-400
            ${notif.exiting
              ? 'opacity-0 translate-x-12 scale-95'
              : 'opacity-100 translate-x-0 scale-100 animate-slide-in-right'
            }`}
          style={{
            boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)'
          }}
        >
          {/* Ícone */}
          <div className="shrink-0 pt-0.5 text-[#D6A72B]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          </div>

          {/* Texto */}
          <div className="flex-1 overflow-hidden">
            <p className="font-bold text-[14px] text-gray-900 dark:text-white leading-tight mb-1">
              {notif.title}
            </p>
            <p className="text-[13px] text-gray-600 dark:text-gray-400 font-medium leading-snug">
              {notif.message}
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
            className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors p-1 -mr-2 -mt-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
