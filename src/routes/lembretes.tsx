import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
  Plus,
  Search,
  List as ListIcon,
  KanbanSquare,
  Calendar as CalendarIcon,
  Star,
  CheckCircle2,
  Circle,
  Clock,
  User as UserIcon,
} from 'lucide-react'
import { fetchReminders, createReminder, toggleReminderCompletion, fetchUsers, type Reminder } from '../lib/api-reminders'
import { format, isPast, isToday, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ReminderSheet } from '../components/ReminderSheet'
import { useTheme } from '../contexts/ThemeContext'

export const Route = createFileRoute('/lembretes')({
  component: LembretesComponent,
})

function LembretesComponent() {
  const navigate = useNavigate()
  const { isDark } = useTheme()

  const [reminderToEdit, setReminderToEdit] = useState<Reminder | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [currentView, setCurrentView] = useState<'list' | 'board' | 'calendar'>('list')
  const [currentFilter, setCurrentFilter] = useState('Todos')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  
  const queryClient = useQueryClient()

  // Fetch Data
  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['reminders'],
    queryFn: fetchReminders
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: createReminder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      setNewTaskTitle('')
    }
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: string }) => toggleReminderCompletion(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
    }
  })

  const handleQuickAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTaskTitle.trim()) {
      createMutation.mutate({
        title: newTaskTitle.trim(),
        status: 'Pendente',
        priority: 'Normal',
        is_recurring: false
      })
    }
  }

  const handleSaveReminder = () => {
    queryClient.invalidateQueries({ queryKey: ['reminders'] })
    setIsSheetOpen(false)
    setReminderToEdit(null)
  }

  // Calculate Filters
  const completedCount = reminders.filter(r => r.status === 'Concluído').length
  const allCount = reminders.length
  
  const atrasados = reminders.filter(r => {
    if (r.status === 'Concluído' || r.status === 'Cancelado' || !r.due_date) return false
    return isPast(new Date(`${r.due_date}T${r.due_time || '23:59:00'}`)) && !isToday(parseISO(r.due_date))
  })
  
  const filterOptions = [
    { label: 'Hoje', count: reminders.filter(r => r.due_date && isToday(parseISO(r.due_date))).length },
    { label: 'Atrasados', count: atrasados.length },
    { label: 'Concluídos', count: completedCount },
    { label: 'Todos', count: allCount },
  ]

  const filteredReminders = reminders.filter(r => {
    if (currentFilter === 'Concluídos') return r.status === 'Concluído'
    if (currentFilter === 'Atrasados') return atrasados.includes(r)
    if (currentFilter === 'Hoje') return r.due_date && isToday(parseISO(r.due_date))
    return true
  })

  const getUserDetails = (userId?: string) => {
    if (!userId) return null
    return users.find(u => u.id === userId)
  }

  return (
    <>
      <div className={`p-8 pb-24 space-y-6 max-w-[1600px] w-full mx-auto relative z-10 transition-colors duration-300`}>
        


        {/* Title & Controls */}
        <div className="flex items-center justify-between mb-8 mt-2">
          <div>
            <h1 className="text-[54px] font-tarmiles font-bold tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" style={{ lineHeight: '1' }}>
              Lembretes
            </h1>
            <p className="text-white/70 text-sm mt-1 ml-1 font-medium">Organize tarefas e compromissos</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                setReminderToEdit(null)
                setIsSheetOpen(true)
              }}
              className="px-4 h-10 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold uppercase tracking-wider text-xs flex items-center gap-2 transition-colors shadow-[0_0_15px_rgba(234,179,8,0.4)]"
            >
              <Plus size={16} />
              Novo Lembrete
            </button>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className={`rounded-2xl border p-4 flex items-center justify-between transition-colors ${isDark ? 'bg-[#101014]/60 backdrop-blur-md border-white/10' : 'bg-white/60 backdrop-blur-md border-black/10'}`}>
          <div className="flex items-center gap-2">
            {filterOptions.map((opt) => (
              <button
                key={opt.label}
                onClick={() => setCurrentFilter(opt.label)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  currentFilter === opt.label 
                    ? (isDark ? 'bg-white/10 text-white' : 'bg-black/5 text-gray-900')
                    : (isDark ? 'text-white/50 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-black/5')
                }`}
              >
                {opt.label === 'Favoritos' && <Star size={14} />}
                {opt.label}
                {opt.count > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    opt.label === 'Atrasados' ? 'bg-red-500/20 text-red-400' : 
                    opt.label === 'Hoje' ? 'bg-blue-500/20 text-blue-400' :
                    (isDark ? 'bg-white/10 text-white/60' : 'bg-black/10 text-gray-600')
                  }`}>
                    {opt.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-white/40' : 'text-gray-400'}`} />
              <input 
                type="text"
                placeholder="Pesquisar..."
                className={`border rounded-xl h-10 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500 w-64 transition-all ${
                  isDark 
                    ? 'bg-black/20 border-white/10 text-white placeholder:text-white/30' 
                    : 'bg-white/50 border-black/10 text-gray-900 placeholder:text-gray-500'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Reminders List Area */}
        <div className={`rounded-2xl border transition-colors overflow-hidden ${isDark ? 'bg-[#101014]/60 backdrop-blur-md border-white/10' : 'bg-white/60 backdrop-blur-md border-black/10'}`}>
          <div className="p-6">
            
            <div className={`relative flex items-center gap-3 p-3 rounded-xl border group transition-all mb-6 ${
              isDark 
                ? 'border-white/10 bg-black/20 focus-within:bg-black/40 focus-within:border-yellow-500/50' 
                : 'border-black/10 bg-white/50 focus-within:bg-white focus-within:border-yellow-500 shadow-sm'
            }`}>
              <Plus size={20} className={`group-focus-within:text-yellow-500 ${isDark ? 'text-white/40' : 'text-gray-400'}`} />
              <input 
                type="text" 
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={handleQuickAdd}
                disabled={createMutation.isPending}
                placeholder="Adicionar um lembrete rápido... Pressione Enter para salvar."
                className={`flex-1 bg-transparent focus:outline-none text-sm ${
                  isDark ? 'text-white placeholder:text-white/40' : 'text-gray-900 placeholder:text-gray-500'
                }`}
              />
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[1,2,3].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-black/10 animate-pulse">
                    <div className="w-5 h-5 rounded-full bg-white/10" />
                    <div className="flex-1">
                      <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
                      <div className="h-3 bg-white/5 rounded w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredReminders.length === 0 ? (
              <div className={`flex flex-col items-center justify-center py-20 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
                <CheckCircle2 size={48} className={`mb-4 ${isDark ? 'text-white/20' : 'text-gray-300'}`} />
                <p className={`text-lg font-medium ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Tudo limpo por aqui!</p>
                <p className="text-sm">Nenhum lembrete encontrado para esta categoria.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredReminders.map((reminder) => {
                  const isCompleted = reminder.status === 'Concluído'
                  const assignee = getUserDetails(reminder.assigned_user_id)
                  
                  return (
                    <div 
                      key={reminder.id}
                      onClick={() => {
                        setReminderToEdit(reminder)
                        setIsSheetOpen(true)
                      }}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer group ${
                        isCompleted 
                          ? `opacity-50 ${isDark ? 'bg-black/10 border-white/5' : 'bg-black/5 border-black/5'}` 
                          : (isDark ? 'border-white/5 bg-black/20 hover:bg-black/40 hover:border-white/10' : 'border-black/5 bg-white/50 hover:bg-white hover:border-black/10')
                      }`}
                    >
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleMutation.mutate({ id: reminder.id, status: reminder.status })
                        }}
                        className="flex-shrink-0 focus:outline-none"
                      >
                        {isCompleted ? (
                          <CheckCircle2 size={22} className="text-yellow-500" />
                        ) : (
                          <Circle size={22} className={`${isDark ? 'text-white/20 group-hover:text-white/40' : 'text-gray-400 group-hover:text-gray-600'} transition-colors`} />
                        )}
                      </button>
                      
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate transition-all ${
                          isCompleted 
                            ? (isDark ? 'text-white/40 line-through' : 'text-gray-500 line-through') 
                            : (isDark ? 'text-white/90 group-hover:text-white' : 'text-gray-900 group-hover:text-black')
                        }`}>
                          {reminder.title}
                        </p>
                        
                        <div className="flex items-center gap-3 mt-1.5">
                          {reminder.due_date && (
                            <div className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
                              <Clock size={12} />
                              <span>{format(parseISO(reminder.due_date), "dd 'de' MMM", { locale: ptBR })}</span>
                            </div>
                          )}

                          {reminder.priority !== 'Normal' && (
                            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                              reminder.priority === 'Urgente' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                              reminder.priority === 'Alta' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                              'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            }`}>
                              {reminder.priority}
                            </div>
                          )}
                        </div>
                      </div>

                      {assignee && (
                        <div 
                          className="w-8 h-8 rounded-full bg-white/10 border border-white/10 overflow-hidden flex items-center justify-center shrink-0"
                          title={assignee.name}
                        >
                          {assignee.avatar_url ? (
                            <img src={assignee.avatar_url} alt={assignee.name} className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon size={14} className="text-white/50" />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Drawer */}
      <ReminderSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        reminder={reminderToEdit}
        users={users}
      />
    </>
  )
}
