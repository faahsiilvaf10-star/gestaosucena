import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchReminders, toggleReminderCompletion, updateReminder, fetchUsers } from '../lib/api-reminders'
import { CheckCircle2, Circle, Clock, Calendar as CalendarIcon, User as UserIcon, Users } from 'lucide-react'
import { format, parseISO, isPast, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'

export function DashboardRemindersWidget() {
  const { isDark } = useTheme()
  const queryClient = useQueryClient()
  const [snoozeReminderId, setSnoozeReminderId] = useState<string | null>(null)
  const [snoozeDate, setSnoozeDate] = useState('')
  const [snoozeTime, setSnoozeTime] = useState('')
  const [crossedOutIds, setCrossedOutIds] = useState<Set<string>>(new Set())

  const toggleCrossedOut = (id: string) => {
    setCrossedOutIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Fetch data
  const { data: reminders = [] } = useQuery({ queryKey: ['reminders'], queryFn: fetchReminders })
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: fetchUsers })
  
  // We need to know who is logged in to show "Eu"
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  useState(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  })

  // Filter for dashboard: Pendentes e (Atribuídos a mim ou criados por mim que exigem atenção hoje/atrasados)
  const activeReminders = reminders.filter(r => {
    if (r.status === 'Concluído' || r.status === 'Cancelado') return false
    
    const isMentioned = r.reminder_mentions?.some(m => m.user_id === currentUserId)
    const isMine = r.creator_id === currentUserId || r.assigned_user_id === currentUserId || isMentioned
    if (!isMine) return false

    // Mostrar os que têm data para hoje ou estão atrasados
    if (r.due_date) {
      const isDueTodayOrPast = isToday(parseISO(r.due_date)) || isPast(new Date(`${r.due_date}T${r.due_time || '23:59:00'}`))
      return isDueTodayOrPast
    }
    
    // Se não tem data, mostra sempre como algo pendente pra fazer (ou limitar a N)
    return true
  }).slice(0, 5) // Show top 5

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: string }) => toggleReminderCompletion(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminders'] })
  })

  const snoozeMutation = useMutation({
    mutationFn: (data: { id: string, date: string, time?: string }) => 
      updateReminder(data.id, { due_date: data.date, due_time: data.time || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      setSnoozeReminderId(null)
    }
  })

  const getUserDetails = (userId?: string) => {
    if (!userId) return null
    return users.find(u => u.id === userId)
  }

  if (activeReminders.length === 0) return null

  return (
    <div className={`border rounded-2xl p-6 relative overflow-hidden transition-colors ${isDark ? 'bg-[#121214] border-white/5' : 'bg-gray-100 border-black/5 shadow-lg'}`}>
      {/* Decorative gradient */}
      <div className={`absolute top-0 right-0 w-64 h-64 blur-[80px] rounded-full pointer-events-none ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-500/5'}`} />
      
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className={`p-2 rounded-lg ${isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
          <Clock size={20} />
        </div>
        <h2 className={`text-lg font-medium ${isDark ? 'text-white/90' : 'text-gray-900'}`}>Lembretes para Hoje</h2>
      </div>

      <div className="space-y-3 relative z-10">
        {activeReminders.map(reminder => {
          const isSnoozing = snoozeReminderId === reminder.id
          const isCrossedOut = crossedOutIds.has(reminder.id)
          const mentionedUserIds = reminder.reminder_mentions?.map(m => m.user_id) || []
          const allResponsibleIds = Array.from(new Set([reminder.assigned_user_id, ...mentionedUserIds].filter(Boolean) as string[]))

          return (
            <div key={reminder.id} className={`p-4 rounded-xl border transition-colors group ${isDark ? 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]' : 'border-gray-200 bg-white hover:bg-gray-50 shadow-sm'}`}>
              <div className="flex items-start gap-4">
                <button 
                  onClick={() => toggleCrossedOut(reminder.id)}
                  className="mt-0.5 flex-shrink-0"
                  title="Riscar tarefa"
                >
                  {isCrossedOut ? (
                    <CheckCircle2 size={20} className="text-indigo-500" />
                  ) : (
                    <Circle size={20} className={`transition-colors ${isDark ? 'text-white/20 group-hover:text-white/50' : 'text-gray-300 group-hover:text-gray-500'}`} />
                  )}
                </button>
                
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate transition-all ${
                    isCrossedOut 
                      ? (isDark ? 'text-white/40 line-through' : 'text-gray-500 line-through') 
                      : (isDark ? 'text-white/90 group-hover:text-white' : 'text-gray-900')
                  }`}>
                    {reminder.title}
                  </p>
                  
                  {reminder.description && (
                    <p className={`text-xs mt-0.5 line-clamp-1 transition-all ${
                      isCrossedOut
                        ? (isDark ? 'text-white/30 line-through' : 'text-gray-400 line-through')
                        : (isDark ? 'text-white/60 group-hover:text-white/80' : 'text-gray-500')
                    }`}>
                      {reminder.description}
                    </p>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    {/* Time */}
                    {reminder.due_date && (
                      <div className={`flex items-center gap-1.5 text-xs ${isPast(new Date(`${reminder.due_date}T${reminder.due_time || '23:59:00'}`)) && !isToday(parseISO(reminder.due_date)) ? 'text-red-400' : 'text-indigo-400'}`}>
                        <CalendarIcon size={12} />
                        <span>
                          {format(parseISO(reminder.due_date), "dd/MM")}
                          {reminder.due_time && ` às ${reminder.due_time}`}
                        </span>
                      </div>
                    )}

                    {/* Mention Tags */}
                    {(() => {
                      // Se tem pelo menos 1 usuário e o número de responsáveis é igual (ou maior, por segurança) ao total de usuários, 
                      // ou se contém a string 'ALL' explicitamente (legado/fallback).
                      const isEveryone = (users.length > 0 && allResponsibleIds.length >= users.length) || allResponsibleIds.includes('ALL')

                      if (isEveryone) {
                        return (
                          <div key="ALL" className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium ${isDark ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-indigo-100 border-indigo-200 text-indigo-600'}`}>
                            <Users size={10} />
                            <span>Todos</span>
                          </div>
                        )
                      }

                      return allResponsibleIds.map(userId => {
                        const user = getUserDetails(userId)
                        if (!user) return null
                        const isMeUser = user.id === currentUserId
                        return (
                          <div key={user.id} className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium ${isDark ? 'bg-white/5 border-white/10 text-white/60' : 'bg-gray-100 border-gray-200 text-gray-600'}`}>
                            {user.avatar_url ? (
                              <img src={user.avatar_url} className="w-3 h-3 rounded-full" />
                            ) : (
                              <UserIcon size={10} />
                            )}
                            <span>{isMeUser ? 'Você' : user.name}</span>
                          </div>
                        )
                      })
                    })()}
                    
                    {/* Priority */}
                    {reminder.priority !== 'Normal' && (
                      <div className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                        reminder.priority === 'Urgente' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        reminder.priority === 'Alta' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        {reminder.priority}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => {
                      setSnoozeReminderId(reminder.id)
                      setSnoozeDate(reminder.due_date || '')
                      setSnoozeTime(reminder.due_time || '')
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900'}`}
                  >
                    Adiar
                  </button>
                  <button 
                    onClick={() => toggleMutation.mutate({ id: reminder.id, status: reminder.status })}
                    className="px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-xs font-medium text-indigo-400 transition-colors"
                  >
                    Visto
                  </button>
                </div>
              </div>

              {/* Snooze Panel inline */}
              {isSnoozing && (
                <div className={`mt-4 pt-4 border-t flex flex-wrap items-center gap-3 ${isDark ? 'border-white/5' : 'border-gray-200'}`}>
                  <input 
                    type="date"
                    value={snoozeDate}
                    onChange={e => setSnoozeDate(e.target.value)}
                    className={`text-sm px-2 py-1.5 rounded-md border focus:outline-none focus:border-indigo-500 ${isDark ? 'bg-black/20 text-white border-white/10 [color-scheme:dark]' : 'bg-white text-gray-900 border-gray-300'}`}
                  />
                  <input 
                    type="time"
                    value={snoozeTime}
                    onChange={e => setSnoozeTime(e.target.value)}
                    className={`text-sm px-2 py-1.5 rounded-md border focus:outline-none focus:border-indigo-500 ${isDark ? 'bg-black/20 text-white border-white/10 [color-scheme:dark]' : 'bg-white text-gray-900 border-gray-300'}`}
                  />
                  <div className="flex-1" />
                  <button 
                    onClick={() => setSnoozeReminderId(null)}
                    className={`px-3 py-1.5 text-xs transition-colors ${isDark ? 'text-white/40 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => snoozeMutation.mutate({ id: reminder.id, date: snoozeDate, time: snoozeTime })}
                    disabled={!snoozeDate}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                  >
                    Salvar
                  </button>
                </div>
              )}

            </div>
          )
        })}
      </div>
    </div>
  )
}
