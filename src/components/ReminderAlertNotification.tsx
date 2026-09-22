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

export function ReminderAlertNotification() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<ReminderNotif[]>([])
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setCurrentUserId(data.user.id)
    })
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user?.id || null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!currentUserId) {
      console.log("[ReminderAlert] No user ID, not subscribing.")
      return
    }

    console.log(`[ReminderAlert] Subscribing to reminder_notifications for user: ${currentUserId}`)
    const channel = supabase.channel(`reminder_notif_${currentUserId}_${Date.now()}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'reminder_notifications',
        filter: `user_id=eq.${currentUserId}` 
      }, (payload: any) => {
        console.log("[ReminderAlert] Received INSERT payload:", payload)
        const notif = payload.new

        const notifId = notif.id
        const newNotif: ReminderNotif = {
          id: notifId,
          title: notif.title || 'Lembrete',
          message: notif.message || 'Você tem um novo lembrete!'
        }

        playReminderSound()

        setNotifications(prev => [...prev, newNotif])

        // Removido auto-fechamento. O usuário precisa fechar manualmente.
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId])

  if (notifications.length === 0) return null

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto p-4">
      <div className="flex flex-col gap-4 w-full max-w-md">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className={`relative bg-white dark:bg-[#1A1B20] rounded-2xl shadow-2xl overflow-hidden transition-all duration-400
              ${notif.exiting ? 'opacity-0 scale-95' : 'opacity-100 scale-100 animate-slide-in-bottom'}
            `}
            style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
          >
            {/* Top header border line */}
            <div className="h-2 w-full bg-[#D6A72B]"></div>
            
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-500/20 text-[#D6A72B]">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  </svg>
                </div>
                <h3 className="font-bold text-xl text-gray-900 dark:text-white">
                  {notif.title}
                </h3>
              </div>
              
              <div className="bg-gray-50 dark:bg-black/20 rounded-xl p-4 mb-6 border border-gray-100 dark:border-white/5">
                <p className="text-[15px] text-gray-700 dark:text-gray-300 font-medium whitespace-pre-wrap">
                  {notif.message}
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setNotifications(prev =>
                      prev.map(n => n.id === notif.id ? { ...n, exiting: true } : n)
                    )
                    setTimeout(() => {
                      setNotifications(prev => prev.filter(n => n.id !== notif.id))
                    }, 400)
                  }}
                  className="px-6 py-2.5 font-bold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl transition-colors"
                >
                  Fechar
                </button>
                <a
                  href="/lembretes"
                  onClick={() => {
                    setNotifications(prev => prev.filter(n => n.id !== notif.id))
                  }}
                  className="px-6 py-2.5 font-bold text-black bg-[#D6A72B] hover:bg-[#c49823] rounded-xl transition-colors shadow-lg shadow-[#D6A72B]/20"
                >
                  Ver Lembretes
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
