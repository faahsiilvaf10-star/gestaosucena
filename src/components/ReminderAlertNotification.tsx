import Calendar from 'lucide-react/dist/esm/icons/calendar.js';
import Clock from 'lucide-react/dist/esm/icons/clock.js';
import AlertCircle from 'lucide-react/dist/esm/icons/circle-alert.js';
import AlignLeft from 'lucide-react/dist/esm/icons/text-align-start.js';
import Repeat from 'lucide-react/dist/esm/icons/repeat.js';
import Check from 'lucide-react/dist/esm/icons/check.js';
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'

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
  reminder_id?: string
  title: string
  message: string
  created_at?: string
  reminder?: ReminderData
  exiting?: boolean
}

function isStillSnoozed(snoozedVal: string | null): boolean {
  if (!snoozedVal) return false;
  if (snoozedVal.includes('T')) {
    const snoozeTime = new Date(snoozedVal).getTime();
    if (!isNaN(snoozeTime)) {
      return Date.now() < snoozeTime;
    }
  }
  const todayStr = new Date().toLocaleDateString('pt-BR').split('/').reverse().join('-');
  return snoozedVal === todayStr;
}

export function ReminderAlertNotification() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<ReminderNotif[]>([])
  
  // Postpone state
  const [postponingId, setPostponingId] = useState<string | null>(null)
  const [postponeDate, setPostponeDate] = useState<string>('')
  const [postponeTime, setPostponeTime] = useState<string>('')
  const [isSavingPostpone, setIsSavingPostpone] = useState<boolean>(false)

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
          const snoozedVal = localStorage.getItem(`snoozed_notif_${notif.id}`)
          if (!isStillSnoozed(snoozedVal)) {
            pending.push({
              id: notif.id,
              reminder_id: notif.reminder_id,
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
        const snoozedVal = localStorage.getItem(`snoozed_notif_${notif.id}`)
        
        if (!isStillSnoozed(snoozedVal)) {
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
            reminder_id: notif.reminder_id,
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hydro_reminder_read', { detail: { id } }))
    }
    dismissNotification(id)
  }

  const handleStartAdiar = (notif: ReminderNotif) => {
    setPostponingId(notif.id)
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const currentToday = `${yyyy}-${mm}-${dd}`

    // Padrão: 1 hora à frente
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000)
    const defHours = String(inOneHour.getHours()).padStart(2, '0')
    const defMins = String(inOneHour.getMinutes()).padStart(2, '0')

    const baseDueDate = notif.reminder?.due_date
    setPostponeDate(baseDueDate && baseDueDate >= currentToday ? baseDueDate : currentToday)
    setPostponeTime(`${defHours}:${defMins}`)
  }

  const applyQuickSnooze = (type: '15m' | '30m' | '1h' | 'amanha_manha' | 'amanha_tarde') => {
    const now = new Date()
    let target = new Date()

    if (type === '15m') {
      target = new Date(now.getTime() + 15 * 60 * 1000)
    } else if (type === '30m') {
      target = new Date(now.getTime() + 30 * 60 * 1000)
    } else if (type === '1h') {
      target = new Date(now.getTime() + 60 * 60 * 1000)
    } else if (type === 'amanha_manha') {
      target.setDate(target.getDate() + 1)
      target.setHours(8, 0, 0, 0)
    } else if (type === 'amanha_tarde') {
      target.setDate(target.getDate() + 1)
      target.setHours(14, 0, 0, 0)
    }

    const yyyy = target.getFullYear()
    const mm = String(target.getMonth() + 1).padStart(2, '0')
    const dd = String(target.getDate()).padStart(2, '0')
    const hh = String(target.getHours()).padStart(2, '0')
    const min = String(target.getMinutes()).padStart(2, '0')

    setPostponeDate(`${yyyy}-${mm}-${dd}`)
    setPostponeTime(`${hh}:${min}`)
  }

  const handleConfirmPostpone = async (notif: ReminderNotif) => {
    if (!postponeDate) {
      toast.error('Por favor, informe a data para adiar o lembrete.')
      return
    }
    const time = postponeTime || '09:00'
    setIsSavingPostpone(true)

    try {
      const reminderId = notif.reminder?.id || notif.reminder_id
      if (reminderId) {
        // Atualiza a data e horário do lembrete no banco
        const { error: remErr } = await supabase
          .from('reminders')
          .update({
            due_date: postponeDate,
            due_time: time.length === 5 ? `${time}:00` : time,
            last_notified_at: null, // Permite nova notificação quando o horário chegar
            status: 'Pendente',
            updated_at: new Date().toISOString()
          })
          .eq('id', reminderId)

        if (remErr) {
          console.warn('Erro ao atualizar lembrete no banco:', remErr)
        }
      }

      // Marca a notificação atual como lida para não reabrir imediatamente
      await supabase
        .from('reminder_notifications')
        .update({ read: true })
        .eq('id', notif.id)

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hydro_reminder_read', { detail: { id: notif.id } }))
      }

      // Salva no localStorage com timestamp ISO para controle local de snooze
      const targetIso = `${postponeDate}T${time}:00`
      localStorage.setItem(`snoozed_notif_${notif.id}`, targetIso)

      const [y, m, d] = postponeDate.split('-')
      const dataFormatada = `${d}/${m}/${y}`
      toast.success(`Lembrete adiado para ${dataFormatada} às ${time.substring(0, 5)}!`)

      dismissNotification(notif.id)
    } catch (err) {
      console.error('Erro ao adiar lembrete:', err)
      toast.error('Erro ao adiar o lembrete.')
    } finally {
      setIsSavingPostpone(false)
      setPostponingId(null)
    }
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
                <h3 className="font-bold text-lg sm:text-xl text-[#1c1d21] dark:text-white leading-tight">
                  {notif.title}
                </h3>
              </div>
              
              <div className="bg-gray-50 dark:bg-black/20 rounded-xl p-4 sm:p-5 mb-5 border border-gray-100 dark:border-white/5 space-y-4">
                
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
                            <AlignLeft size={16} className="text-[#5f6472] dark:text-gray-400 shrink-0 mt-0.5" />
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

              {/* Se estiver no modo de adiamento deste card, exibe campos de data e hora */}
              {postponingId === notif.id ? (
                <div className="bg-amber-50/90 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-2xl p-4 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock size={17} className="text-[#D6A72B]" />
                      <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                        Adiar Lembrete
                      </h4>
                    </div>
                    <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 px-2.5 py-0.5 rounded-full">
                      Escolha data e hora
                    </span>
                  </div>

                  {/* Atalhos Rápidos */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                      Atalhos rápidos:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyQuickSnooze('15m')}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 hover:border-amber-400 hover:text-amber-700 dark:hover:text-amber-300 text-gray-700 dark:text-gray-200 transition-colors shadow-2xs cursor-pointer"
                      >
                        +15 min
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickSnooze('30m')}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 hover:border-amber-400 hover:text-amber-700 dark:hover:text-amber-300 text-gray-700 dark:text-gray-200 transition-colors shadow-2xs cursor-pointer"
                      >
                        +30 min
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickSnooze('1h')}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 hover:border-amber-400 hover:text-amber-700 dark:hover:text-amber-300 text-gray-700 dark:text-gray-200 transition-colors shadow-2xs cursor-pointer"
                      >
                        +1 hora
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickSnooze('amanha_manha')}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 hover:border-amber-400 hover:text-amber-700 dark:hover:text-amber-300 text-gray-700 dark:text-gray-200 transition-colors shadow-2xs cursor-pointer"
                      >
                        Amanhã 08:00
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickSnooze('amanha_tarde')}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 hover:border-amber-400 hover:text-amber-700 dark:hover:text-amber-300 text-gray-700 dark:text-gray-200 transition-colors shadow-2xs cursor-pointer"
                      >
                        Amanhã 14:00
                      </button>
                    </div>
                  </div>

                  {/* Campos de Input */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                        <Calendar size={13} className="text-[#D6A72B]" />
                        Nova Data:
                      </label>
                      <input
                        type="date"
                        value={postponeDate}
                        min={todayDateStr}
                        onChange={(e) => setPostponeDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl text-sm font-semibold border border-gray-300 dark:border-white/15 bg-white dark:bg-black/30 text-gray-900 dark:text-white outline-none focus:border-[#D6A72B] focus:ring-1 focus:ring-[#D6A72B] transition-colors"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                        <Clock size={13} className="text-[#D6A72B]" />
                        Novo Horário:
                      </label>
                      <input
                        type="time"
                        value={postponeTime}
                        onChange={(e) => setPostponeTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl text-sm font-semibold border border-gray-300 dark:border-white/15 bg-white dark:bg-black/30 text-gray-900 dark:text-white outline-none focus:border-[#D6A72B] focus:ring-1 focus:ring-[#D6A72B] transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                      />
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200 dark:border-white/10">
                    <button
                      type="button"
                      disabled={isSavingPostpone}
                      onClick={() => setPostponingId(null)}
                      className="px-4 py-2 font-bold text-xs text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={isSavingPostpone || !postponeDate}
                      onClick={() => handleConfirmPostpone(notif)}
                      className="px-5 py-2 font-bold text-xs text-black bg-[#D6A72B] hover:bg-[#c49823] rounded-xl transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isSavingPostpone ? (
                        <span>Salvando...</span>
                      ) : (
                        <>
                          <Check size={14} />
                          <span>Confirmar Adiamento</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => handleStartAdiar(notif)}
                    className="px-6 py-2.5 font-bold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                  >
                    Adiar
                  </button>
                  <button
                    onClick={() => handleVisto(notif.id)}
                    className="px-6 py-2.5 font-bold text-black bg-[#D6A72B] hover:bg-[#c49823] rounded-xl transition-colors shadow-lg shadow-[#D6A72B]/20 cursor-pointer"
                  >
                    Visto
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
