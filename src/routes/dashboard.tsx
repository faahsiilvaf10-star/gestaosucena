import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
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
  ChevronsRight
} from 'lucide-react'
import { DashboardRemindersWidget } from '../components/DashboardRemindersWidget'
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

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex overflow-hidden font-sans selection:bg-purple-500/30">
      
      {/* Sidebar */}
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto overflow-x-hidden bg-gradient-to-br from-[#0a0a0c] to-[#09090b]">
        
        {/* Header */}
        <header className="h-20 border-b border-white/5 px-8 flex items-center justify-end sticky top-0 bg-[#09090b]/80 backdrop-blur-md z-10">
          
          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/70 hover:bg-white/10 transition-colors">
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
            <h1 className="text-5xl text-white tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" style={{ fontFamily: "'TarmilesAction', cursive" }}>
              Dashboard
            </h1>
            <button className="h-9 px-4 rounded-lg bg-white/5 border border-white/5 flex items-center gap-2 text-sm font-medium hover:bg-white/10 transition-colors text-white/70">
              Last 24 hours
              <ChevronDown size={14} />
            </button>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <KpiCard title="Total Assets" value="32,268" change={10} isUp={true} icon={<ShoppingBag size={16} />} />
            <KpiCard title="Investigating" value="21,268" change={10} isUp={true} icon={<Search size={16} />} />
            <KpiCard title="Action required" value="1,254" change={10} isUp={false} icon={<Activity size={16} />} />
            <KpiCard title="Resolved" value="1,245" change={10} isUp={true} icon={<Shield size={16} />} />
          </div>

          {/* Lembretes / Tarefas Rápidas Widget */}
          <DashboardRemindersWidget />

          {/* Middle Row (Charts) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Donut Chart */}
            <div className="lg:col-span-1 rounded-2xl bg-[#101014] border border-white/5 border-b-white/10 shadow-lg p-6 flex flex-col relative overflow-hidden group">
              {/* Bottom Glow */}
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-white/[0.07] to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <div className="flex items-center justify-between mb-8 z-10">
                <h3 className="font-medium text-white/90">Account Health Summary</h3>
                <button className="text-xs text-white/50 hover:text-white transition-colors">View All</button>
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
                    <div key={i} className="flex items-center gap-2 text-sm text-white/70">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color, boxShadow: `0 0 10px ${item.color}80` }} />
                      <span className="font-medium text-white">{item.value}</span>
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Horizontal Bar Chart */}
            <div className="lg:col-span-2 rounded-2xl bg-[#101014] border border-white/5 border-b-white/10 shadow-lg p-6 flex flex-col relative overflow-hidden group">
              {/* Bottom Glow */}
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-white/[0.07] to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-bl from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <div className="flex items-center justify-between mb-6 z-10">
                <h3 className="font-medium text-white/90">Top alert categories</h3>
                <button className="h-8 px-3 rounded-md bg-white/5 border border-white/5 flex items-center gap-2 text-xs font-medium hover:bg-white/10 transition-colors text-white/70">
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
                        <stop offset="0%" stopColor="#ffffff" stopOpacity={0.1} />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity={0.5} />
                      </linearGradient>
                    </defs>
                    <XAxis type="number" hide />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#ffffff60', fontSize: 12 }} 
                      width={140}
                    />
                    <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }} />
                    <Bar 
                      dataKey="value" 
                      fill="url(#barGlowHoriz)" 
                      radius={[0, 10, 10, 0]} 
                      barSize={12}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-between px-10 ml-32 text-[10px] text-white/30 border-t border-white/5 pt-2 mt-2 z-10">
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
          <div className="rounded-2xl bg-[#101014] border border-white/5 border-b-white/10 shadow-lg p-6 flex flex-col relative overflow-hidden group">
            {/* Bottom Glow */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-white/[0.07] to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-purple-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className="flex items-center justify-between mb-8 z-10">
              <h3 className="font-medium text-white/90">Top alert categories</h3>
              <div className="flex items-center gap-3">
                <button className="h-8 px-3 rounded-md bg-white/5 border border-white/5 flex items-center gap-2 text-xs font-medium hover:bg-white/10 transition-colors text-white/70">
                  Last 30 day
                  <ChevronDown size={14} />
                </button>
                <button className="h-8 px-3 rounded-md bg-white/5 border border-white/5 flex items-center gap-2 text-xs font-medium hover:bg-white/10 transition-colors text-white/70">
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
                      <stop offset="0%" stopColor="#ffffff" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity={0.05} />
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
                    tick={{ fill: '#ffffff40', fontSize: 12 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#ffffff40', fontSize: 12 }} 
                    ticks={[0, 250, 500, 750]}
                  />
                  <Tooltip 
                    cursor={{ fill: '#ffffff03' }}
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
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
  return (
    <div className="rounded-2xl bg-[#101014] border border-white/5 border-b-white/10 shadow-lg p-5 flex flex-col relative overflow-hidden group">
      {/* Bottom Glow effect to match image */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-white/[0.08] to-transparent pointer-events-none" />
      {/* Subtle background glow effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      <div className="flex items-start justify-between mb-6 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/60">
          {icon}
        </div>
      </div>
      
      <div className="mt-auto relative z-10">
        <p className="text-sm text-white/50 mb-1">{title}</p>
        <div className="flex items-end justify-between">
          <h2 className="text-3xl font-light text-white tracking-tight">{value}</h2>
          <div className={`flex items-center gap-1 text-xs font-medium pb-1 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
            {isUp ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            {change}%
          </div>
        </div>
      </div>
    </div>
  )
}
