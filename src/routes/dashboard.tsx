import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
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
  User,
  Home,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ShoppingBag,
  Search,
  Activity,
  ChevronsLeft,
  ChevronsRight,
  MapPin,
  ArrowLeftRight,
  LogOut
} from 'lucide-react'
import { DashboardRemindersWidget } from '../components/DashboardRemindersWidget'
import { WeatherWidget } from '../components/WeatherWidget'
import { LogoutOverlay } from '../components/LogoutOverlay'
import { ThemeToggle } from '../components/ThemeToggle'
import { useTheme } from '../contexts/ThemeContext'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export const Route = createFileRoute('/dashboard')({
  component: DashboardComponent,
})

const sidebarLinks = [
  { icon: LayoutDashboard, label: 'Destaques', active: true, href: '/dashboard' },
  { icon: Bell, label: 'Lembretes', href: '/lembretes' },
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

// Mock data for charts
const pieData = [
  { name: 'Issues', value: 36, color: '#8b5cf6' },
  { name: 'Snoozed', value: 20, color: '#10b981' },
  { name: 'Good health', value: 44, color: '#6b7280' },
]

const horizBarData = [
  { name: 'Malware', value: 15 },
  { name: 'Runtime Detections', value: 7 },
  { name: 'Potentially Unwanted...', value: 10 },
  { name: 'Mobile Devices', value: 5 },
  { name: 'Security', value: 14 },
]

const monthlyData = [
  { name: 'Jan', val1: 720, val2: 380 },
  { name: 'Feb', val1: 450, val2: 240 },
  { name: 'Mar', val1: 300, val2: 120 },
  { name: 'Apr', val1: 420, val2: 280 },
  { name: 'May', val1: 530, val2: 290 },
  { name: 'Jun', val1: 700, val2: 280 },
  { name: 'Jul', val1: 430, val2: 210 },
  { name: 'Aug', val1: 540, val2: 220 },
  { name: 'Sep', val1: 410, val2: 210 },
  { name: 'Oct', val1: 560, val2: 160 },
  { name: 'Nov', val1: 430, val2: 260 },
  { name: 'Dec', val1: 300, val2: 150 },
]

function DashboardComponent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const navigate = useNavigate()
  const { isDark } = useTheme()

  const [environment, setEnvironment] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [currentUser, setCurrentUser] = useState({ name: '', role: '' })
  
  useEffect(() => {
    setEnvironment(localStorage.getItem('sucena_environment') || 'barcarena')
    
    // Check if user is admin
    supabase.auth.getUser().then(({ data }) => {
      const role = data.user?.user_metadata?.role || ''
      setCurrentUser({
        name: data.user?.user_metadata?.full_name || data.user?.email || 'Usuário',
        role: role || 'Usuário'
      })
      if (role.toLowerCase().includes('admin')) {
        setIsAdmin(true)
      }
    })
  }, [])
  const envName = environment === 'barcarena' ? 'BARCARENA' : 'PARAGOMINAS'
  const envColor = environment === 'barcarena' ? 'text-blue-400' : 'text-emerald-400'

  const handleLogout = async () => {
    setIsLoggingOut(true)
    setTimeout(async () => {
      await supabase.auth.signOut()
      navigate({ to: '/' })
    }, 5000)
  }

  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })

  return (
    <div className={`min-h-screen flex overflow-hidden font-sans selection:bg-purple-500/30 transition-colors duration-300 ${isDark ? 'bg-[#09090b] text-white' : 'bg-gray-50 text-black'}`}>
      <LogoutOverlay isVisible={isLoggingOut} userName={currentUser.name} userRole={currentUser.role} />
      
      {/* Sidebar */}
      <aside className={`vt-sidebar border-r flex flex-col h-screen flex-shrink-0 transition-all duration-300 ${isSidebarOpen ? 'w-56' : 'w-20'} ${isDark ? 'bg-[#09090b] border-white/5' : 'bg-gray-100 border-black/5'}`}>
        <div className={`pt-4 pb-2 ${isSidebarOpen ? 'pl-6 pr-0' : 'px-4'}`}>
          <div className={`flex items-center mb-8 ${isSidebarOpen ? 'justify-between px-2 pr-8' : 'justify-center'}`}>
            {isSidebarOpen && (
              <img src={isDark ? "/logo.png" : "/logo-light-theme.png"} alt="Sucena Logo" className={`h-10 w-auto object-contain transition-all duration-300 ${isDark ? 'filter brightness-0 invert' : ''}`} />
            )}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${isDark ? 'text-white/50 hover:text-white hover:bg-white/10' : 'text-black/50 hover:text-black hover:bg-black/10'}`}
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
                {isSidebarOpen && <ArrowLeftRight size={14} className={`ml-auto ${isDark ? 'text-white/30' : 'text-gray-400'}`} />}
              </button>
            </div>
          )}

          {isSidebarOpen && <p className={`text-[10px] uppercase font-semibold tracking-wider mb-4 px-2 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>Menu</p>}
          <nav className="flex flex-col gap-1" onMouseLeave={() => setHoveredIdx(null)}>
            {sidebarLinks.map((link, idx) => {
              const Icon = link.icon
              return (
                <div key={idx} className="relative" onMouseEnter={() => setHoveredIdx(idx)}>
                  {hoveredIdx === idx && !link.active && (
                    <motion.div
                      layoutId="sidebar-hover-dashboard"
                      className={`absolute inset-0 bg-white/5 rounded-lg z-0 ${isSidebarOpen ? 'mr-6' : ''}`}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <button
                    title={!isSidebarOpen ? link.label : undefined}
                    className={`flex items-center transition-all duration-300 text-sm font-medium relative z-10 w-full ${
                      link.active 
                        ? (isSidebarOpen 
                          ? (isDark ? 'sidebar-active-tab text-white' : 'sidebar-active-tab text-yellow-500') 
                          : (isDark ? 'sidebar-active-tab-closed text-white' : 'sidebar-active-tab-closed text-yellow-500'))
                        : (isDark ? `text-white/60 hover:text-white rounded-lg ${isSidebarOpen ? 'mr-6' : ''}` : `text-gray-500 hover:text-gray-900 rounded-lg ${isSidebarOpen ? 'mr-6' : ''}`)
                    } ${isSidebarOpen ? 'gap-3 px-3 py-2' : 'justify-center p-3'}`}
                    onClick={() => {
                      if (link.href) navigate({ to: link.href as any })
                    }}
                  >
                    <Icon size={isSidebarOpen ? 18 : 22} className={link.active ? (isDark ? 'text-white' : 'text-yellow-500') : (isDark ? 'text-white/50' : 'text-gray-400')} />
                    {isSidebarOpen && <span className={`whitespace-nowrap ${link.active ? 'font-tarmiles text-lg tracking-wide' : ''}`}>{link.label}</span>}
                  </button>
                </div>
              )
            })}
          </nav>
        </div>
        
        <div className={`mt-auto pt-4 pb-4 border-t ${isDark ? 'border-white/5' : 'border-black/5'} ${isSidebarOpen ? 'pl-6 pr-0' : 'px-4'}`}>
          <nav className={`flex ${isSidebarOpen ? 'flex-row items-center gap-2 pr-6' : 'flex-col gap-1'}`}>
            <button title={!isSidebarOpen ? "Configurações" : undefined} className={`flex-1 flex items-center transition-all duration-300 rounded-lg text-sm font-medium ${isDark ? 'text-white/60 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'} ${isSidebarOpen ? 'gap-3 px-3 py-2' : 'justify-center p-3'}`}>
              <Settings size={isSidebarOpen ? 18 : 22} className={isDark ? "text-white/50" : "text-slate-400"} />
              {isSidebarOpen && <span className="whitespace-nowrap">Configurações</span>}
            </button>
            <button 
              title="Sair" 
              onClick={handleLogout}
              className={`flex items-center transition-all duration-300 rounded-lg text-sm font-medium ${isDark ? 'text-white/60 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-500 hover:text-red-500 hover:bg-red-50'} ${isSidebarOpen ? 'p-2' : 'justify-center p-3'}`}
            >
              <LogOut size={isSidebarOpen ? 18 : 22} className={!isSidebarOpen ? (isDark ? 'text-white/50' : 'text-slate-400') : ''} />
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`vt-main flex-1 flex flex-col h-screen overflow-y-auto overflow-x-hidden transition-colors duration-300 ${isDark ? 'bg-gradient-to-br from-[#0a0a0c] to-[#09090b]' : 'bg-gray-50'}`}>
        
        {/* Header */}
        <header className={`h-20 border-b px-8 flex items-center justify-end sticky top-0 backdrop-blur-md z-10 transition-colors duration-300 ${isDark ? 'bg-[#09090b]/80 border-white/5' : 'bg-white/80 border-black/5 shadow-sm'}`}>
          
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${isDark ? 'bg-white/5 border-white/5 text-white/70 hover:bg-white/10' : 'bg-gray-100 border-black/5 text-gray-700 hover:bg-gray-200'}`}>
              <Bell size={18} />
            </button>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="p-8 space-y-6 max-w-[1600px] w-full mx-auto">
          
          <style>
            {`
              @font-face {
                font-family: 'TarmilesAction';
                src: url('/TarmilesAction_PERSONAL_USE_ONLY.otf') format('opentype');
                font-weight: normal;
                font-style: normal;
              }
            `}
          </style>

          {/* Title & Controls */}
          <div className="flex items-center justify-between mb-4 mt-2">
            <h1 className={`text-5xl tracking-wide ${isDark ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]' : 'text-gray-900 drop-shadow-sm'}`} style={{ fontFamily: "'TarmilesAction', cursive" }}>
              Dashboard
            </h1>
            <div className={`flex items-center capitalize font-evantic tracking-wide text-xl ${isDark ? 'text-white/70' : 'text-gray-500'}`}>
              {currentDate}
            </div>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <WeatherWidget />
            <KpiCard title="Investigating" value="21,268" change={10} isUp={true} icon={<Search size={16} />} />
            <KpiCard title="Action required" value="1,254" change={10} isUp={false} icon={<Activity size={16} />} />
            <KpiCard title="Resolved" value="1,245" change={10} isUp={true} icon={<Shield size={16} />} />
          </div>

          {/* Lembretes / Tarefas Rápidas Widget */}
          <DashboardRemindersWidget />

          {/* Middle Row (Charts) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Donut Chart */}
            <div className={`lg:col-span-1 rounded-2xl border shadow-lg p-6 flex flex-col relative overflow-hidden group transition-colors ${isDark ? 'bg-[#101014] border-white/5 border-b-white/10' : 'bg-gray-100 border-black/5 border-b-black/10'}`}>
              {/* Bottom Glow */}
              <div className={`absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t pointer-events-none ${isDark ? 'from-white/[0.07]' : 'from-black/[0.03]'}`} />
              <div className={`absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${isDark ? 'from-white/[0.03]' : 'from-black/[0.02]'}`} />
              <div className="flex items-center justify-between mb-8 z-10">
                <h3 className={`font-medium ${isDark ? 'text-white/90' : 'text-gray-900'}`}>Account Health Summary</h3>
                <button className={`text-xs transition-colors ${isDark ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>View All</button>
              </div>
              <div className="flex-1 flex items-center justify-center z-10">
                <div className="relative w-48 h-48 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        stroke="none"
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} className="drop-shadow-lg filter" style={{ filter: `drop-shadow(0px 0px 8px ${entry.color}40)` }} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-3 ml-4">
                  {pieData.map((item, i) => (
                    <div key={i} className={`flex items-center gap-2 text-sm ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color, boxShadow: `0 0 10px ${item.color}80` }} />
                      <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.value}</span>
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Horizontal Bar Chart */}
            <div className={`lg:col-span-2 rounded-2xl border shadow-lg p-6 flex flex-col relative overflow-hidden group transition-colors ${isDark ? 'bg-[#101014] border-white/5 border-b-white/10' : 'bg-gray-100 border-black/5 border-b-black/10'}`}>
              {/* Bottom Glow */}
              <div className={`absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t pointer-events-none ${isDark ? 'from-white/[0.07]' : 'from-black/[0.03]'}`} />
              <div className={`absolute inset-0 bg-gradient-to-bl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${isDark ? 'from-white/[0.03]' : 'from-black/[0.02]'}`} />
              <div className="flex items-center justify-between mb-6 z-10">
                <h3 className={`font-medium ${isDark ? 'text-white/90' : 'text-gray-900'}`}>Top alert categories</h3>
                <button className={`h-8 px-3 rounded-md border flex items-center gap-2 text-xs font-medium transition-colors ${isDark ? 'bg-white/5 border-white/5 hover:bg-white/10 text-white/70' : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'}`}>
                  All Products
                  <ChevronDown size={14} />
                </button>
              </div>
              <div className="flex-1 min-h-[220px] z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={horizBarData}
                    layout="vertical"
                    margin={{ top: 0, right: 30, left: 40, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="barGlowHoriz" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={isDark ? "#ffffff" : "#000000"} stopOpacity={0.1} />
                        <stop offset="100%" stopColor={isDark ? "#ffffff" : "#000000"} stopOpacity={isDark ? 0.5 : 0.3} />
                      </linearGradient>
                    </defs>
                    <XAxis type="number" hide />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: isDark ? '#ffffff60' : '#6b7280', fontSize: 12 }} 
                      width={140}
                    />
                    <Tooltip cursor={{ fill: isDark ? '#ffffff05' : '#00000005' }} contentStyle={{ backgroundColor: isDark ? '#18181b' : '#ffffff', border: isDark ? '1px solid #3f3f46' : '1px solid #e5e7eb', borderRadius: '8px', color: isDark ? '#fff' : '#000' }} />
                    <Bar 
                      dataKey="value" 
                      fill="url(#barGlowHoriz)" 
                      radius={[0, 10, 10, 0]} 
                      barSize={12}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className={`flex justify-between px-10 ml-32 text-[10px] border-t pt-2 mt-2 z-10 ${isDark ? 'text-white/30 border-white/5' : 'text-gray-400 border-black/5'}`}>
                <span>50</span>
                <span>100</span>
                <span>150</span>
                <span>200</span>
                <span>250</span>
                <span>300</span>
                <span>350</span>
                <span>400</span>
                <span>450</span>
                <span>500</span>
              </div>
            </div>

          </div>

          {/* Bottom Bar Chart */}
          <div className={`rounded-2xl border shadow-lg p-6 flex flex-col relative overflow-hidden group transition-colors ${isDark ? 'bg-[#101014] border-white/5 border-b-white/10' : 'bg-gray-100 border-black/5 border-b-black/10'}`}>
            {/* Bottom Glow */}
            <div className={`absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t pointer-events-none ${isDark ? 'from-white/[0.07]' : 'from-black/[0.03]'}`} />
            <div className={`absolute inset-0 bg-gradient-to-t opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${isDark ? 'from-purple-500/[0.02]' : 'from-purple-500/[0.05]'}`} />
            <div className="flex items-center justify-between mb-8 z-10">
              <h3 className={`font-medium ${isDark ? 'text-white/90' : 'text-gray-900'}`}>Top alert categories</h3>
              <div className="flex items-center gap-3">
                <button className={`h-8 px-3 rounded-md border flex items-center gap-2 text-xs font-medium transition-colors ${isDark ? 'bg-white/5 border-white/5 hover:bg-white/10 text-white/70' : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'}`}>
                  Last 30 day
                  <ChevronDown size={14} />
                </button>
                <button className={`h-8 px-3 rounded-md border flex items-center gap-2 text-xs font-medium transition-colors ${isDark ? 'bg-white/5 border-white/5 hover:bg-white/10 text-white/70' : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'}`}>
                  Category
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>
            <div className="h-[250px] w-full z-10 relative">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barGap={6}>
                  <defs>
                    <linearGradient id="barGlow1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="barGlow2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isDark ? "#ffffff" : "#000000"} stopOpacity={isDark ? 0.5 : 0.3} />
                      <stop offset="100%" stopColor={isDark ? "#ffffff" : "#000000"} stopOpacity={isDark ? 0.05 : 0.02} />
                    </linearGradient>
                    {/* Filter for glow effect */}
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: isDark ? '#ffffff40' : '#6b7280', fontSize: 12 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: isDark ? '#ffffff40' : '#6b7280', fontSize: 12 }} 
                    ticks={[0, 250, 500, 750]}
                  />
                  <Tooltip 
                    cursor={{ fill: isDark ? '#ffffff03' : '#00000003' }}
                    contentStyle={{ backgroundColor: isDark ? '#18181b' : '#ffffff', border: isDark ? '1px solid #3f3f46' : '1px solid #e5e7eb', borderRadius: '8px', color: isDark ? '#fff' : '#000' }}
                  />
                  {/* Subtle horizontal grid lines matching design */}
                  <g className="recharts-cartesian-grid">
                    <line x1="40" y1="210" x2="100%" y2="210" stroke="#ffffff08" strokeDasharray="4 4" />
                    <line x1="40" y1="140" x2="100%" y2="140" stroke="#ffffff08" strokeDasharray="4 4" />
                    <line x1="40" y1="70" x2="100%" y2="70" stroke="#ffffff08" strokeDasharray="4 4" />
                  </g>
                  <Bar dataKey="val1" fill="url(#barGlow1)" radius={[6, 6, 6, 6]} barSize={10} style={{ filter: 'drop-shadow(0px 0px 4px rgba(139, 92, 246, 0.5))' }} />
                  <Bar dataKey="val2" fill="url(#barGlow2)" radius={[6, 6, 6, 6]} barSize={10} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}

function KpiCard({ title, value, change, isUp, icon }: { title: string, value: string, change: number, isUp: boolean, icon: React.ReactNode }) {
  const { isDark } = useTheme()
  return (
    <div className={`rounded-2xl border shadow-lg p-5 flex flex-col relative overflow-hidden group transition-colors duration-300 ${isDark ? 'bg-[#101014] border-white/5 border-b-white/10' : 'bg-gray-100 border-black/5 border-b-black/10'}`}>
      {/* Bottom Glow effect to match image */}
      <div className={`absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t pointer-events-none ${isDark ? 'from-white/[0.08]' : 'from-black/[0.04]'}`} />
      {/* Subtle background glow effect on hover */}
      <div className={`absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${isDark ? 'from-white/[0.04]' : 'from-black/[0.02]'}`} />
      
      <div className="flex items-start justify-between mb-6 relative z-10">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${isDark ? 'bg-white/5 border-white/5 text-white/60' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
          {icon}
        </div>
      </div>
      
      <div className="mt-auto relative z-10">
        <p className={`text-sm mb-1 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>{title}</p>
        <div className="flex items-end justify-between">
          <h2 className={`text-3xl font-light tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</h2>
          <div className={`flex items-center gap-1 text-xs font-medium pb-1 ${isUp ? 'text-emerald-400' : 'text-red-500'}`}>
            {isUp ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            {change}%
          </div>
        </div>
      </div>
    </div>
  )
}
