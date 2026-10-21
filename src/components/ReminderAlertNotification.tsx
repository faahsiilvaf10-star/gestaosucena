import Calendar from 'lucide-react/dist/esm/icons/calendar.js';
import Clock from 'lucide-react/dist/esm/icons/clock.js';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle.js';
import Repeat from 'lucide-react/dist/esm/icons/repeat.js';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Tipos
interface ReminderData {
  id: string
  title: string
  description?: string
  priority: string
  due_date?: string
  due_time?: string
  is_recurring: boolean
  image_url?: string
  creator_id?: string
}

interface ReminderNotif {
  id: string
  title: string
  message: string
  created_at?: string
  reminder?: ReminderData
  exiting?: boolean
  priority?: string
}

// Som de lembrete
function playReminderSound() {
  try {
    const audio = new Audio('/comunicado.mp3')
    audio.volume = 0.8
    audio.play().catch(() => {})
  } catch (_) {}
}

// Animação CSS via style tag
const styleContent = `
  @keyframes comunicado-entrance {
    0% {
      opacity: 0;
      transform: scale(0.9) translateY(20px);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  
  @keyframes comunicado-pulse-ring {
    0% {
      transform: scale(1);
      opacity: 0.8;
    }
    50% {
      transform: scale(1.05);
      opacity: 0.4;
    }
    100% {
      transform: scale(1);
      opacity: 0.8;
    }
  }
  
  @keyframes comunicado-glow {
    0%, 100% {
      box-shadow: 0 0 20px rgba(214, 167, 43, 0.3), 0 25px 50px -12px rgba(0, 0, 0, 0.4);
    }
    50% {
      box-shadow: 0 0 40px rgba(214, 167, 43, 0.5), 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
  }
  
  @keyframes close-entrance {
    0% {
      opacity: 0;
      transform: translateY(10px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .comunicado-card {
    animation: comunicado-entrance 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
  
  .comunicado-pulse {
    animation: comunicado-pulse-ring 2s ease-in-out infinite;
  }
  
  .comunicado-glow {
    animation: comunicado-glow 3s ease-in-out infinite;
  }
  
  .comunicado-actions {
    animation: close-entrance 0.3s ease-out 0.2s both;
  }
`

// Componente de Badge de Prioridade
function PriorityBadge({ priority }: { priority?: string }) {
  const colors = {
    'Urgente': 'bg-red-500 text-white border-red-600',
    'Alta': 'bg-orange-500 text-white border-orange-600',
    'Normal': 'bg-green-500 text-white border-green-600',
    'Baixa': 'bg-blue-500 text-white border-blue-600',
  }
  
  const bgColor = colors[priority as keyof typeof colors] || colors['Normal']
  
  return (
    <span className={`px-2.5 py-1 rounded-md text-xs font-bold border uppercase tracking-wide ${bgColor}`}>
      {priority || 'Normal'}
    </span>
  )
}

// Componente de Badge de Recorrência
function RecurringBadge() {
  return (
    <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase tracking-wide flex items-center gap-1.5">
      <Repeat size={12} />
      Recorrente
    </span>
  )
}

// Componente de Badge de Data/Hora
function DateTimeBadge({ due_date, due_time }: { due_date?: string; due_time?: string }) {
  const dateStr = due_date 
    ? new Date(due_date + 'T12:00:00').toLocaleDateString('pt-BR', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
      })
    : null

  return (
    <div className="flex flex-wrap items-center gap-3">
      {dateStr && (
        <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <Calendar size={14} className="text-[#D6A72B]" />
          <span className="capitalize">{dateStr}</span>
        </div>
      )}
      {due_time && (
        <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <Clock size={14} className="text-[#D6A72B]" />
          <span>{due_time.substring(0, 5)}</span>
        </div>
      )}
    </div>
  )
}

// Card Individual de Comunicação
function ComunicadoCard({ 
  notif, 
  onDismiss, 
  onVisto, 
  onAdiar 
}: { 
  notif: ReminderNotif
  onDismiss: () => void
  onVisto: () => void
  onAdiar: () => void
}) {
  const isUrgente = notif.reminder?.priority === 'Urgente' || notif.priority === 'Urgente'
  
  return (
    <div 
      className={`
        relative bg-gradient-to-b from-white to-gray-50 dark:from-[#1A1B20] dark:to-[#121214] 
        rounded-2xl shadow-2xl overflow-hidden comunicado-card
        ${isUrgente ? 'comunicado-glow' : ''}
      `}
      style={{ boxShadow: isUrgente ? undefined : '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
    >
      {/* Header com barra de cor */}
      <div className={`h-2 w-full ${
        isUrgente 
          ? 'bg-gradient-to-r from-red-500 via-orange-500 to-red-500' 
          : 'bg-gradient-to-r from-[#D6A72B] via-[#E8B84A] to-[#D6A72B]'
      }`} />
      
      {/* Barra de urgência pulsante */}
      {isUrgente && (
        <div className="absolute top-2 right-2">
          <span className="relative flex h-3 w-3">
            <span className="comunicado-pulse absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        </div>
      )}

      <div className="p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-5">
          <div className={`
            shrink-0 flex items-center justify-center w-14 h-14 rounded-xl
            ${isUrgente 
              ? 'bg-gradient-to-br from-red-500 to-orange-500 text-white' 
              : 'bg-gradient-to-br from-[#D6A72B] to-[#E8B84A] text-white'
            }
          `}>
            {isUrgente ? (
              <AlertTriangle size={28} />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-xl sm:text-2xl text-[#1c1d21] dark:text-white leading-tight mb-2">
              {notif.title}
            </h3>
            
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              {notif.reminder && <PriorityBadge priority={notif.reminder.priority} />}
              {notif.reminder?.is_recurring && <RecurringBadge />}
            </div>
          </div>
          
          <button
            onClick={onDismiss}
            className="shrink-0 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo do Comunicado */}
        <div className="bg-gray-100/80 dark:bg-black/30 rounded-xl p-4 sm:p-5 mb-5 border border-gray-200/50 dark:border-white/5">
          {/* Data e Hora */}
          {notif.reminder && (notif.reminder.due_date || notif.reminder.due_time) && (
            <div className="mb-4 pb-4 border-b border-gray-200/50 dark:border-white/10">
              <DateTimeBadge 
                due_date={notif.reminder.due_date}
                due_time={notif.reminder.due_time}
              />
            </div>
          )}

          {/* Descrição */}
          {(notif.reminder?.description || notif.message) && (
            <div className="text-[15px] text-gray-700 dark:text-gray-200 leading-relaxed font-medium whitespace-pre-wrap">
              {notif.reminder?.description || notif.message}
            </div>
          )}

          {/* Imagem Anexa */}
          {notif.reminder?.image_url && (
            <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-white/10">
              <img 
                src={notif.reminder.image_url} 
                alt="Anexo do Lembrete" 
                className="w-full h-auto max-h-64 object-contain rounded-lg border border-gray-200 dark:border-white/10" 
              />
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="comunicado-actions flex flex-wrap justify-end gap-3">
          <button
            onClick={onAdiar}
            className="
              px-5 py-2.5 rounded-xl font-bold text-sm
              bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10
              text-gray-700 dark:text-gray-200
              transition-all duration-200
              hover:scale-[1.02] active:scale-[0.98]
            "
          >
            Adiar para Hoje
          </button>
          
          <button
            onClick={onDismiss}
            className="
              px-5 py-2.5 rounded-xl font-bold text-sm
              bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10
              text-gray-700 dark:text-gray-200
              transition-all duration-200
              hover:scale-[1.02] active:scale-[0.98]
            "
          >
            Fechar
          </button>
          
          <button
            onClick={onVisto}
            className={`
              px-6 py-2.5 rounded-xl font-bold text-sm
              transition-all duration-200
              hover:scale-[1.02] active:scale-[0.98]
              shadow-lg
              ${isUrgente
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/30'
                : 'bg-[#D6A72B] hover:bg-[#c49823] text-black shadow-[#D6A72B]/30'
              }
            `}
          >
            <span className="flex items-center gap-2">
              <CheckCircle size={16} />
              Marcar como Visto
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

// Componente Principal
export function ReminderAlertNotification() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<ReminderNotif[]>([])
  const [isStyleInjected, setIsStyleInjected] = useState(false)
  
  const todayDateStr = new Date().toLocaleDateString('pt-BR').split('/').reverse().join('-')
  
  // Injetar estilos CSS uma única vez
  useEffect(() => {
    if (!isStyleInjected) {
      const styleEl = document.createElement('style')
      styleEl.textContent = styleContent
      document.head.appendChild(styleEl)
      setIsStyleInjected(true)
      return () => {
        document.head.removeChild(styleEl)
      }
    }
  }, [isStyleInjected])
  
  // Obter ID do usuário
  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => {
      if (data?.user?.id) setCurrentUserId(data.user.id)
    })
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: { user: { id: string } | null } | null) => {
      setCurrentUserId(session?.user?.id || null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Carregar notificações pendentes
  const loadPendingNotifications = useCallback(async () => {
    if (!currentUserId) return

    const { data, error } = await supabase
      .from('reminder_notifications')
      .select(`
        *,
        reminder:reminders (
          id, title, description, priority, due_date, due_time, is_recurring, image_url, creator_id
        )
      `)
      .eq('user_id', currentUserId)
      .eq('read', false)
    
    if (!error && data) {
      const pending: ReminderNotif[] = []
      for (const notif of data) {
        // Verificar se foi adiado para hoje (nunca mostrar novamente hoje)
        const snoozedDate = localStorage.getItem(`snoozed_notif_${notif.id}`)
        if (snoozedDate === todayDateStr) {
          continue
        }
        
        // Verificar se já foi marcado como visto hoje
        const seenDate = localStorage.getItem(`seen_notif_${notif.id}`)
        if (seenDate === todayDateStr) {
          continue
        }
        
        pending.push({
          id: notif.id,
          title: notif.title || 'Lembrete',
          message: notif.message || 'Você tem um novo lembrete!',
          created_at: notif.created_at,
          reminder: notif.reminder as ReminderData,
          priority: notif.reminder?.priority
        })
      }
      
      if (pending.length > 0) {
        setNotifications(prev => {
          const existingIds = new Set(prev.map(p => p.id))
          const newNotifs = pending.filter(p => !existingIds.has(p.id))
          if (newNotifs.length > 0) {
            playReminderSound()
          }
          return [...prev, ...newNotifs]
        })
      }
    }
  }, [currentUserId, todayDateStr])

  // Carregar notificações iniciais
  useEffect(() => {
    loadPendingNotifications()
  }, [loadPendingNotifications])

  // Realtime subscription para novas notificações
  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase.channel(`reminder_comunicado_${currentUserId}_${Date.now()}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'reminder_notifications',
        filter: `user_id=eq.${currentUserId}` 
      }, async (payload: any) => {
        const notif = payload.new
        
        // Verificar se foi adiado
        const snoozedDate = localStorage.getItem(`snoozed_notif_${notif.id}`)
        if (snoozedDate === todayDateStr) return
        
        // Buscar detalhes do lembrete
        let reminderData: ReminderData | undefined
        if (notif.reminder_id) {
          const { data } = await supabase
            .from('reminders')
            .select('id, title, description, priority, due_date, due_time, is_recurring, image_url, creator_id')
            .eq('id', notif.reminder_id)
            .single()
          if (data) reminderData = data
        }

        const newNotif: ReminderNotif = {
          id: notif.id,
          title: notif.title || 'Lembrete',
          message: notif.message || 'Você tem um novo lembrete!',
          created_at: notif.created_at,
          reminder: reminderData,
          priority: reminderData?.priority
        }

        playReminderSound()

        setNotifications(prev => {
          if (prev.some(n => n.id === newNotif.id)) return prev
          return [...prev, newNotif]
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, todayDateStr])

  // Dismiss (fecha sem marcar)
  const dismissNotification = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, exiting: true } : n)
    )
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 300)
  }

  // Marcar como visto
  const handleVisto = async (id: string) => {
    // Salvar no localStorage que foi visto hoje (para não aparecer novamente)
    localStorage.setItem(`seen_notif_${id}`, todayDateStr)
    
    // Marcar como lido no banco
    await supabase.from('reminder_notifications').update({ read: true }).eq('id', id)
    
    dismissNotification(id)
  }

  // Adiar para hoje (não mostrar novamente hoje)
  const handleAdiar = (id: string) => {
    localStorage.setItem(`snoozed_notif_${id}`, todayDateStr)
    dismissNotification(id)
  }

  if (notifications.length === 0) return null

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 pointer-events-auto">
      {/* Overlay com gradiente */}
      <div 
        className="absolute inset-0 bg-gradient-to-br from-black/50 via-transparent to-black/50 pointer-events-none"
        onClick={() => {}} 
      />
      
      {/* Container dos Cards */}
      <div className="flex flex-col gap-4 w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar relative z-10">
        {/* Indicador de quantidade */}
        {notifications.length > 1 && (
          <div className="text-center mb-2">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-white/80 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-[#D6A72B] animate-pulse"></span>
              {notifications.length} comunicados pendentes
            </span>
          </div>
        )}
        
        {notifications.map((notif) => (
          <ComunicadoCard
            key={notif.id}
            notif={notif}
            onDismiss={() => dismissNotification(notif.id)}
            onVisto={() => handleVisto(notif.id)}
            onAdiar={() => handleAdiar(notif.id)}
          />
        ))}
      </div>
    </div>
  )
}
