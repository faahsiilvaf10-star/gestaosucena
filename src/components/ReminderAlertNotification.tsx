import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Calendar, Clock, AlertCircle, AlignLeft, Repeat } from 'lucide-react'

function playReminderSound() {
  try {
    const audio = new Audio('/comunicado.mp3')
    audio.volume = 0.8
    audio.play().catch(() => {/* Autoplay bloqueado pelo browser, ignora */})
  } catch (_) {}
}

interface ReminderData {
  id: string
  title: string
  description?: string
  priority: string
  due_date?: string
  due_time?: string
  is_recurring: boolean
  image_url?: string
}

interface ReminderNotif {
  id: string
  title: string
  message: string
  created_at?: string
  reminder?: ReminderData
  exiting?: boolean
}

export function ReminderAlertNotification() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<ReminderNotif[]>([])
  
  const todayDateStr = new Date().toLocaleDateString('pt-BR').split('/').reverse().join('-')
  
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
    if (!currentUserId) return

    const fetchPendingNotifications = async () => {
      const { data, error } = await supabase
        .from('reminder_notifications')
        .select(`
          *,
          reminder:reminders (
            id, title, description, priority, due_date, due_time, is_recurring, image_url
          )
        `)
        .eq('user_id', currentUserId)
        .eq('read', false)
      
      if (!error && data) {
        const pending: ReminderNotif[] = []
        for (const notif of data) {
          const snoozedDate = localStorage.getItem(`snoozed_notif_${notif.id}`)
          if (snoozedDate !== todayDateStr) {
            pending.push({
              id: notif.id,
              title: notif.title || 'Lembrete',
              message: notif.message || 'Você tem um novo lembrete!',
              created_at: notif.created_at,
              reminder: notif.reminder as ReminderData
            })
          }
        }
        if (pending.length > 0) {
          setNotifications(prev => {
            const existingIds = new Set(prev.map(p => p.id))
            const newNotifs = pending.filter(p => !existingIds.has(p.id))
            return [...prev, ...newNotifs]
          })
        }
      }
    }
    fetchPendingNotifications()

    const channel = supabase.channel(`reminder_notif_${currentUserId}_${Date.now()}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'reminder_notifications',
        filter: `user_id=eq.${currentUserId}` 
      }, async (payload: any) => {
        const notif = payload.new
        const snoozedDate = localStorage.getItem(`snoozed_notif_${notif.id}`)
        
        if (snoozedDate !== todayDateStr) {
          // Busca os detalhes do lembrete para notificações em tempo real
          let reminderData = undefined
          if (notif.reminder_id) {
            const { data } = await supabase
              .from('reminders')
              .select('id, title, description, priority, due_date, due_time, is_recurring, image_url')
              .eq('id', notif.reminder_id)
              .single()
            if (data) reminderData = data
          }

          const newNotif: ReminderNotif = {
            id: notif.id,
            title: notif.title || 'Lembrete',
            message: notif.message || 'Você tem um novo lembrete!',
            created_at: notif.created_at,
            reminder: reminderData
          }

          playReminderSound()

          setNotifications(prev => {
            if (prev.some(n => n.id === newNotif.id)) return prev
            return [...prev, newNotif]
          })
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, todayDateStr])

  const dismissNotification = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, exiting: true } : n)
    )
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 400)
  }

  const handleVisto = async (id: string) => {
    await supabase.from('reminder_notifications').update({ read: true }).eq('id', id)
    dismissNotification(id)
  }

  const handleAdiar = (id: string) => {
    localStorage.setItem(`snoozed_notif_${id}`, todayDateStr)
    dismissNotification(id)
  }

  const getPriorityColor = (priority?: string) => {
    switch(priority) {
      case 'Baixa': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'
      case 'Normal': return 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 border-green-200 dark:border-green-500/20'
      case 'Alta': return 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 border-orange-200 dark:border-orange-500/20'
      case 'Urgente': return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-red-200 dark:border-red-500/20'
      default: return 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white/70 border-gray-200 dark:border-white/10'
    }
  }

  if (notifications.length === 0) return null

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto p-4">
      <div className="flex flex-col gap-4 w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className={`relative bg-white dark:bg-[#1A1B20] rounded-2xl shadow-2xl overflow-hidden transition-all duration-400 flex-shrink-0
              ${notif.exiting ? 'opacity-0 scale-95' : 'opacity-100 scale-100 animate-slide-in-bottom'}
            `}
            style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
          >
            <div className="h-2 w-full bg-[#D6A72B]"></div>
            
            <div className="p-5 sm:p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-500/20 text-[#D6A72B]">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  </svg>
                </div>
                <h3 className="font-bold text-lg sm:text-xl text-gray-900 dark:text-white leading-tight">
                  {notif.title}
                </h3>
              </div>
              
              <div className="bg-gray-50 dark:bg-black/20 rounded-xl p-4 sm:p-5 mb-6 border border-gray-100 dark:border-white/5 space-y-4">
                
                {/* Fallback caso falhe o fetch do reminder */}
                {!notif.reminder && (
                   <p className="text-[15px] text-gray-700 dark:text-gray-300 font-medium whitespace-pre-wrap">
                    {notif.message}
                   </p>
                )}

                {/* Detalhes ricos */}
                {notif.reminder && (
                  <>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <div className={`px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1.5 ${getPriorityColor(notif.reminder.priority)}`}>
                        <AlertCircle size={14} />
                        {notif.reminder.priority || 'Normal'}
                      </div>
                      
                      {notif.reminder.is_recurring && (
                        <div className="px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/20 flex items-center gap-1.5">
                          <Repeat size={14} />
                          Recorrente
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      {(notif.reminder.due_date || notif.reminder.due_time || notif.created_at) && (
                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                            <Calendar size={16} className="text-[#D6A72B]" />
                            <span className="font-medium">
                              {notif.reminder.due_date 
                                ? new Date(notif.reminder.due_date + 'T12:00:00').toLocaleDateString('pt-BR')
                                : (notif.created_at ? new Date(notif.created_at).toLocaleDateString('pt-BR') : '')}
                            </span>
                          </div>
                          {notif.reminder.due_time && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                              <Clock size={16} className="text-[#D6A72B]" />
                              <span className="font-medium">{notif.reminder.due_time.substring(0, 5)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {notif.reminder.description && (
                        <div className="pt-3 border-t border-gray-200 dark:border-white/10">
                          <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                            <AlignLeft size={16} className="text-gray-400 shrink-0 mt-0.5" />
                            <p className="font-medium whitespace-pre-wrap leading-relaxed">
                              {notif.reminder.description}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {notif.reminder.image_url && (
                        <div className="pt-3 border-t border-gray-200 dark:border-white/10">
                          <img 
                            src={notif.reminder.image_url} 
                            alt="Anexo do Lembrete" 
                            className="w-full h-auto max-h-72 object-contain rounded-xl border border-gray-200 dark:border-white/10" 
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => handleAdiar(notif.id)}
                  className="px-6 py-2.5 font-bold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl transition-colors"
                >
                  Adiar
                </button>
                <button
                  onClick={() => handleVisto(notif.id)}
                  className="px-6 py-2.5 font-bold text-black bg-[#D6A72B] hover:bg-[#c49823] rounded-xl transition-colors shadow-lg shadow-[#D6A72B]/20"
                >
                  Visto
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
