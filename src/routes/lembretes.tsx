import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
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
  AlertCircle,
  LogOut
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
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const navigate = useNavigate()

  const [environment, setEnvironment] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  
  useEffect(() => {
    setEnvironment(localStorage.getItem('sucena_environment') || 'barcarena')
    
    // Check if user is admin
    supabase.auth.getUser().then(({ data }) => {
      const role = data.user?.user_metadata?.role || ''
      if (role.toLowerCase().includes('admin')) {
        setIsAdmin(true)
      }
    })
  }, [])
  const envName = environment === 'barcarena' ? 'BARCARENA' : 'PARAGOMINAS'
  const envColor = environment === 'barcarena' ? 'text-blue-400' : 'text-emerald-400'
  
  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate({ to: '/' })
  }

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
      
      {/* Sidebar */}
      <aside className={`vt-sidebar border-r border-white/5 bg-[#09090b] flex flex-col h-screen flex-shrink-0 transition-all duration-300 ${isSidebarOpen ? 'w-56' : 'w-20'}`}>
        <div className={`pt-4 pb-2 ${isSidebarOpen ? 'pl-6 pr-0' : 'px-4'}`}>
          <div className={`flex items-center mb-8 ${isSidebarOpen ? 'justify-between px-2 pr-8' : 'justify-center'}`}>
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

          {/* Environment Indicator */}
          {isAdmin && (
            <div className={`mb-6 ${isSidebarOpen ? 'px-2' : 'flex justify-center'}`}>
              <button 
                onClick={() => navigate({ to: '/ambientes' })}
                className={`flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/5 transition-colors rounded-lg ${isSidebarOpen ? 'px-3 py-2 w-full max-w-[190px]' : 'p-2'}`}
                title={isSidebarOpen ? "Trocar Ambiente" : envName}
              >
                <MapPin size={16} className={envColor} />
                {isSidebarOpen && (
                  <div className="flex flex-col items-start overflow-hidden text-left flex-1">
                    <span className="text-[10px] text-white/50 font-medium uppercase tracking-wider leading-tight">Ambiente</span>
                    <span className="text-xs font-bold text-white truncate w-full">{envName}</span>
                  </div>
                )}
                {isSidebarOpen && <ArrowLeftRight size={14} className="text-white/30 ml-auto" />}
              </button>
            </div>
          )}

          {isSidebarOpen && <p className="text-[10px] uppercase text-white/40 font-semibold tracking-wider mb-4 px-2">Menu</p>}
          <nav className="flex flex-col gap-1" onMouseLeave={() => setHoveredIdx(null)}>
            {sidebarLinks.map((link, idx) => {
              const Icon = link.icon
              return (
                <div key={idx} className="relative" onMouseEnter={() => setHoveredIdx(idx)}>
                  {hoveredIdx === idx && !link.active && (
                    <motion.div
                      layoutId="sidebar-hover-lembretes"
                      className={`absolute inset-0 bg-white/5 rounded-lg z-0 ${isSidebarOpen ? 'mr-6' : ''}`}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <button
                    title={!isSidebarOpen ? link.label : undefined}
                    className={`flex items-center transition-all duration-300 text-sm font-medium relative z-10 w-full ${
                      link.active 
                        ? (isSidebarOpen ? 'sidebar-active-tab text-white' : 'sidebar-active-tab-closed text-white')
                        : `text-white/60 hover:text-white rounded-lg ${isSidebarOpen ? 'mr-6' : ''}`
                    } ${isSidebarOpen ? 'gap-3 px-3 py-2' : 'justify-center p-3'}`}
                    onClick={() => {
                      if (link.href) navigate({ to: link.href as any })
                    }}
                  >
                    <Icon size={isSidebarOpen ? 18 : 22} className={link.active ? 'text-white' : 'text-white/50'} />
                    {isSidebarOpen && <span className={`whitespace-nowrap ${link.active ? 'font-tarmiles text-lg tracking-wide' : ''}`}>{link.label}</span>}
                  </button>
                </div>
              )
            })}
          </nav>
        </div>
        
        <div className={`mt-auto pt-4 pb-4 border-t border-white/5 ${isSidebarOpen ? 'pl-6 pr-0' : 'px-4'}`}>
          <nav className={`flex ${isSidebarOpen ? 'flex-row items-center gap-2 pr-6' : 'flex-col gap-1'}`}>

            <button title={!isSidebarOpen ? "Configurações" : undefined} className={`flex-1 flex items-center transition-all duration-300 rounded-lg text-white/60 hover:text-white hover:bg-white/5 text-sm font-medium ${isSidebarOpen ? 'gap-3 px-3 py-2' : 'justify-center p-3'}`}>
              <Settings size={isSidebarOpen ? 18 : 22} className="text-white/50" />
              {isSidebarOpen && <span className="whitespace-nowrap">Configurações</span>}
            </button>
            <button 
              title="Sair" 
              onClick={handleLogout}
              className={`flex items-center transition-all duration-300 rounded-lg text-white/60 hover:text-red-400 hover:bg-red-500/10 text-sm font-medium ${isSidebarOpen ? 'p-2' : 'justify-center p-3'}`}
            >
              <LogOut size={isSidebarOpen ? 18 : 22} className={!isSidebarOpen ? 'text-white/50' : ''} />
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="vt-main flex-1 flex overflow-hidden bg-gradient-to-br from-[#0a0a0c] to-[#09090b]">
        
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
