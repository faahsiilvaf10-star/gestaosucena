import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard,
  Bell,
  Camera,
  Package,
  FileText,
  Wrench,
  Shield,
  Users,
  ClipboardList,
  Leaf,
  CalendarDays,
  HelpCircle,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Search,
  Filter,
  List as ListIcon,
  KanbanSquare,
  Calendar as CalendarIcon,
  Star,
  CheckCircle2,
  Circle,
  Clock,
  User as UserIcon,
  AlertCircle
} from 'lucide-react'
import { fetchReminders, createReminder, toggleReminderCompletion, fetchUsers, type Reminder } from '../lib/api-reminders'
import { format, isPast, isToday, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ReminderSheet } from '../components/ReminderSheet'

export const Route = createFileRoute('/lembretes')({
  component: LembretesComponent,
})

const sidebarLinks = [
  { icon: LayoutDashboard, label: 'Destaques', href: '/dashboard' },
  { icon: Bell, label: 'Lembretes', active: true, href: '/lembretes' },
  { icon: Camera, label: 'InstaCena' },
  { icon: Package, label: 'Almoxarifado' },
  { icon: FileText, label: 'Documentos' },
  { icon: Wrench, label: 'Equipamentos' },
  { icon: Shield, label: 'Segurança' },
  { icon: Users, label: 'RH' },
  { icon: ClipboardList, label: 'Relatório Diário Obra' },
  { icon: Leaf, label: 'Meio Ambiente' },
  { icon: CalendarDays, label: 'Planejamento' },
]

function LembretesComponent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [currentView, setCurrentView] = useState<'list' | 'board' | 'calendar'>('list')
  const [currentFilter, setCurrentFilter] = useState('Todos')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null)

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

  // Filter the list based on current selection
  const filteredReminders = reminders.filter(r => {
    if (currentFilter === 'Concluídos') return r.status === 'Concluído'
    if (currentFilter === 'Atrasados') return atrasados.includes(r)
    if (currentFilter === 'Hoje') return r.due_date && isToday(parseISO(r.due_date))
    return true // 'Todos'
  })

  const getUserDetails = (userId?: string) => {
    if (!userId) return null
    return users.find(u => u.id === userId)
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex overflow-hidden font-sans selection:bg-purple-500/30">
      
      {/* Sidebar - Idêntica ao Dashboard */}
      <aside className={`border-r border-white/5 bg-[#09090b] flex flex-col h-screen flex-shrink-0 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className={`p-4 pb-2 ${isSidebarOpen ? 'px-6' : ''}`}>
          <div className={`flex items-center mb-8 ${isSidebarOpen ? 'justify-between px-2' : 'justify-center'}`}>
            {isSidebarOpen && (
              <img src="/logo.png" alt="Sucena Logo" className="h-10 w-auto object-contain filter brightness-0 invert" />
            )}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
              title={isSidebarOpen ? "Recolher menu" : "Expandir menu"}
            >
              {isSidebarOpen ? <ChevronsLeft size={20} /> : <ChevronsRight size={20} />}
            </button>
          </div>
          {isSidebarOpen && <p className="text-[10px] uppercase text-white/40 font-semibold tracking-wider mb-4 px-2">Menu</p>}
          <nav className="flex flex-col gap-1">
            {sidebarLinks.map((link, idx) => {
              const Icon = link.icon
              return (
                <button
                  key={idx}
                  title={!isSidebarOpen ? link.label : undefined}
                  className={`flex items-center transition-all duration-300 text-sm font-medium rounded-lg ${
                    link.active 
                      ? 'bg-gradient-to-r from-white/10 to-transparent text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]' 
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  } ${isSidebarOpen ? 'gap-3 px-3 py-2' : 'justify-center p-3'}`}
                  onClick={() => {
                    if (link.href) window.location.href = link.href
                  }}
                >
                  <Icon size={isSidebarOpen ? 18 : 22} className={link.active ? 'text-white' : 'text-white/50'} />
                  {isSidebarOpen && <span className="whitespace-nowrap">{link.label}</span>}
                </button>
              )
            })}
          </nav>
        </div>
        
        <div className={`mt-auto p-4 pt-4 border-t border-white/5 ${isSidebarOpen ? 'px-6' : ''}`}>
          <nav className="flex flex-col gap-1">
            <button title={!isSidebarOpen ? "Help Center" : undefined} className={`flex items-center transition-all duration-300 rounded-lg text-white/60 hover:text-white hover:bg-white/5 text-sm font-medium ${isSidebarOpen ? 'gap-3 px-3 py-2' : 'justify-center p-3'}`}>
              <HelpCircle size={isSidebarOpen ? 18 : 22} className="text-white/50" />
              {isSidebarOpen && <span className="whitespace-nowrap">Help Center</span>}
            </button>
            <button title={!isSidebarOpen ? "Preferences" : undefined} className={`flex items-center transition-all duration-300 rounded-lg text-white/60 hover:text-white hover:bg-white/5 text-sm font-medium ${isSidebarOpen ? 'gap-3 px-3 py-2' : 'justify-center p-3'}`}>
              <Settings size={isSidebarOpen ? 18 : 22} className="text-white/50" />
              {isSidebarOpen && <span className="whitespace-nowrap">Preferences</span>}
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden bg-gradient-to-br from-[#0a0a0c] to-[#09090b]">
        
        {/* Left Sub-Sidebar (Filtros Asana-like) */}
        <div className="w-64 flex-shrink-0 bg-[#09090b]/50 border-r border-white/5 flex flex-col hidden md:flex">
          <div className="p-6">
            <h2 className="text-white font-medium text-lg mb-1">Lembretes</h2>
            <p className="text-white/40 text-xs">Organize tarefas e compromissos.</p>
          </div>
          
          <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-6">
            <button 
              onClick={() => {
                setSelectedReminder(null)
                setIsSheetOpen(true)
              }}
              className="w-full h-10 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-600/20"
            >
              <Plus size={18} />
              Novo lembrete
            </button>
            
            <div className="space-y-1">
              {filterOptions.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setCurrentFilter(opt.label)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    currentFilter === opt.label 
                      ? 'bg-white/10 text-white font-medium' 
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {opt.label === 'Favoritos' && <Star size={14} />}
                    {opt.label}
                  </span>
                  {opt.count > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      opt.label === 'Atrasados' ? 'bg-red-500/20 text-red-400' : 
                      opt.label === 'Hoje' ? 'bg-indigo-500/20 text-indigo-400' :
                      'bg-white/10 text-white/60'
                    }`}>
                      {opt.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Reminders List Area */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-gradient-to-br from-[#0A0A0B] to-[#121214]">
          {/* Header */}
          <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 shrink-0 bg-[#0A0A0B]/80 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-medium text-white">{currentFilter}</h1>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input 
                  type="text"
                  placeholder="Pesquisar..."
                  className="bg-white/5 border border-white/10 rounded-full h-9 pl-9 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-64 transition-all"
                />
              </div>
              
              <div className="flex items-center p-1 bg-white/5 rounded-lg border border-white/5">
                <button 
                  onClick={() => setCurrentView('list')}
                  className={`p-1.5 rounded-md transition-colors ${currentView === 'list' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'}`}
                >
                  <ListIcon size={16} />
                </button>
                <button 
                  onClick={() => setCurrentView('board')}
                  className={`p-1.5 rounded-md transition-colors ${currentView === 'board' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'}`}
                >
                  <KanbanSquare size={16} />
                </button>
                <button 
                  onClick={() => setCurrentView('calendar')}
                  className={`p-1.5 rounded-md transition-colors ${currentView === 'calendar' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'}`}
                >
                  <CalendarIcon size={16} />
                </button>
              </div>
            </div>
          </header>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-4">
              
              {/* Quick Add */}
              <div className="relative flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 group focus-within:bg-white/10 focus-within:border-indigo-500/50 transition-all">
                <Plus size={20} className="text-white/40 group-focus-within:text-indigo-400" />
                <input 
                  type="text" 
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={handleQuickAdd}
                  disabled={createMutation.isPending}
                  placeholder="Adicionar um lembrete... Pressione Enter para salvar."
                  className="flex-1 bg-transparent text-white placeholder:text-white/40 focus:outline-none text-sm"
                />
              </div>

              {/* Reminders Items */}
              {isLoading ? (
                <div className="space-y-2 mt-8">
                  {[1,2,3].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.02] animate-pulse">
                      <div className="w-5 h-5 rounded-full bg-white/10" />
                      <div className="flex-1">
                        <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
                        <div className="h-3 bg-white/5 rounded w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredReminders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-white/40">
                  <CheckCircle2 size={48} className="mb-4 text-white/20" />
                  <p className="text-lg font-medium text-white/60">Tudo limpo por aqui!</p>
                  <p className="text-sm">Nenhum lembrete encontrado para esta categoria.</p>
                </div>
              ) : (
                <div className="space-y-2 mt-8">
                  {filteredReminders.map((reminder) => {
                    const isCompleted = reminder.status === 'Concluído'
                    const assignee = getUserDetails(reminder.assigned_user_id)
                    
                    return (
                      <div 
                        key={reminder.id}
                        onClick={() => {
                          setSelectedReminder(reminder)
                          setIsSheetOpen(true)
                        }}
                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer group ${
                          isCompleted 
                            ? 'bg-transparent border-transparent opacity-50' 
                            : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10'
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
                            <CheckCircle2 size={22} className="text-indigo-400" />
                          ) : (
                            <Circle size={22} className="text-white/20 group-hover:text-white/40 transition-colors" />
                          )}
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate transition-all ${
                            isCompleted ? 'text-white/40 line-through' : 'text-white/90 group-hover:text-white'
                          }`}>
                            {reminder.title}
                          </p>
                          
                          <div className="flex items-center gap-3 mt-1.5">
                            {/* Date */}
                            {reminder.due_date && (
                              <div className="flex items-center gap-1.5 text-xs text-white/40">
                                <Clock size={12} />
                                <span>{format(parseISO(reminder.due_date), "dd 'de' MMM", { locale: ptBR })}</span>
                              </div>
                            )}

                            {/* Priority Badge */}
                            {reminder.priority !== 'Normal' && (
                              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider border ${
                                reminder.priority === 'Urgente' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                reminder.priority === 'Alta' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              }`}>
                                {reminder.priority}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Assignee Avatar */}
                        {assignee && (
                          <div 
                            className="w-7 h-7 rounded-full bg-white/10 border border-white/5 overflow-hidden flex items-center justify-center shrink-0"
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

      </main>

      <ReminderSheet 
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        reminder={selectedReminder}
        users={users}
      />
    </div>
  )
}
