import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { WeatherWidget } from '../components/WeatherWidget'
import { DashboardRemindersWidget } from '../components/DashboardRemindersWidget'
import { useTheme } from '../contexts/ThemeContext'
import { CalendarDays, LogOut, CheckCircle2, Clock, Calendar, Check, AlertCircle, ArrowUp } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, ResponsiveContainer } from 'recharts'

export const Route = createFileRoute('/dashboard')({
  component: DashboardComponent,
})

// Mock data for sparklines
const presentesData = [
  { val: 10 }, { val: 15 }, { val: 12 }, { val: 14 }, { val: 18 }, { val: 20 }, { val: 22 }, { val: 35 }
]

const ausenciasData = [
  { val: 3 }, { val: 2 }, { val: 4 }, { val: 1 }, { val: 3 }, { val: 2 }, { val: 7 }
]

function DashboardComponent() {
  const { isDark } = useTheme()
  
  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })

  return (
    <div className={`min-h-screen font-sans selection:bg-purple-500/30 transition-colors duration-300`}>
      {/* Background is handled globally via AppLayout/CSS, here we just provide spacing */}
      
      {/* Dashboard Grid */}
      <div className="p-8 pb-24 space-y-6 max-w-[1600px] w-full mx-auto relative z-10">
        


        {/* Title & Controls */}
        <div className="flex items-center justify-between mb-8 mt-2">
          <div>
            <h1 className={`text-[54px] font-tarmiles font-bold tracking-tight ${isDark ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]' : 'text-gray-900 drop-shadow-none'}`} style={{ lineHeight: '1' }}>
              Dashboard
            </h1>
            <p className={`text-sm mt-1 ml-1 font-medium ${isDark ? 'text-white/70' : 'text-gray-500'}`}>Visão geral da operação</p>
          </div>
          <div className={`flex items-center gap-2 font-evantic tracking-wide text-2xl ${isDark ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]' : 'text-gray-900 drop-shadow-none'}`}>
            <CalendarDays size={24} className={isDark ? "opacity-80" : "opacity-60"} />
            {currentDate}
          </div>
        </div>

        {/* 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Column 1: Weather & Total Func */}
          <div className="flex flex-col gap-6">
            <WeatherWidget />
            
            {/* Total Func Card */}
            <div className={`flex-1 rounded-2xl border p-6 flex flex-col justify-between relative overflow-hidden transition-colors ${isDark ? 'bg-[#101014]/60 backdrop-blur-md border-white/10' : 'bg-white/60 backdrop-blur-md border-black/10 shadow-lg'}`}>
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t pointer-events-none from-white/[0.03]" />
              <h3 className={`text-center text-[10px] font-bold uppercase tracking-widest pt-4 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Total de Funcionários</h3>
              <div className="flex justify-center items-center flex-1 w-full relative z-10 pt-4">
                <span className={`font-sans font-bold tracking-tight text-6xl drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] ${isDark ? 'text-white' : 'text-gray-900 drop-shadow-none'}`}>
                  45
                </span>
              </div>
            </div>
          </div>

          {/* Column 2: Avanço Mensal */}
          <div className={`rounded-2xl border p-6 flex flex-col relative overflow-hidden transition-colors ${isDark ? 'bg-[#101014]/60 backdrop-blur-md border-white/10' : 'bg-white/60 backdrop-blur-md border-black/10 shadow-lg'}`}>
            <div className="flex justify-between items-start mb-1">
              <div>
                <h3 className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-white/80' : 'text-gray-800'}`}>Avanço Mensal</h3>
                <p className={`text-xs mt-1 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Metas do Planejamento</p>
              </div>
              <button className={`text-[10px] font-bold transition-colors uppercase tracking-wider ${isDark ? 'text-white hover:text-yellow-400' : 'text-gray-700 hover:text-yellow-500'}`}>Ver tudo &rarr;</button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center mt-6 relative">
              <svg viewBox="0 0 100 100" className={`w-40 h-40 transform -rotate-90 filter ${isDark ? 'drop-shadow-[0_0_12px_rgba(255,255,255,0.5)]' : 'drop-shadow-[0_0_8px_rgba(0,0,0,0.1)]'}`}>
                <circle cx="50" cy="50" r="42" fill="none" stroke={isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"} strokeWidth="8" />
                <circle cx="50" cy="50" r="42" fill="none" stroke={isDark ? "#fff" : "#111"} strokeWidth="8" strokeDasharray="264" strokeDashoffset="34" strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                <span className={`font-sans font-bold tracking-tight text-5xl ${isDark ? 'text-white' : 'text-gray-900'}`}>87%</span>
                <span className={`text-[9px] uppercase tracking-wider font-semibold mt-1 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>AVANÇO</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-8 mb-4 px-2">
              <div className="flex flex-col items-center">
                <div className="h-[12px]"></div>
                <span className={`font-sans font-bold tracking-tight text-3xl ${isDark ? 'text-white' : 'text-gray-800'}`}>11</span>
                <span className={`text-[8px] uppercase tracking-wider font-bold mt-1 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>TOTAL</span>
              </div>
              
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-green-500" />
                </div>
                <span className="font-sans font-bold tracking-tight text-3xl text-green-500">5</span>
                <span className="text-[8px] uppercase tracking-wider font-bold text-green-500 mt-1">CONCLUÍDAS</span>
              </div>
              
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1">
                  <Clock size={12} className="text-yellow-500" />
                </div>
                <span className="font-sans font-bold tracking-tight text-3xl text-yellow-500">6</span>
                <span className="text-[8px] uppercase tracking-wider font-bold text-yellow-500 mt-1">FALTAM</span>
              </div>
            </div>

            <div className={`w-full h-1 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-black/5'}`}>
              <div className={`h-full w-[45%] ${isDark ? 'bg-white' : 'bg-gray-800'}`} />
            </div>
            <p className={`text-[9px] mt-2 text-center ${isDark ? 'text-white/40' : 'text-gray-400'}`}>5 de 11 metas concluídas</p>
          </div>

          {/* Column 3: Stacked Charts */}
          <div className="flex flex-col gap-4">
            
            {/* Presentes */}
            <div className={`rounded-2xl border p-4 flex flex-col relative overflow-hidden h-40 transition-colors ${isDark ? 'bg-[#101014]/60 backdrop-blur-md border-white/10' : 'bg-white/60 backdrop-blur-md border-black/10 shadow-sm'}`}>
              <div className="flex justify-between items-start z-10">
                <h3 className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Presentes Hoje</h3>
                <Calendar size={12} className={isDark ? "text-white/40" : "text-gray-400"} />
              </div>
              <div className="flex items-end gap-3 z-10 relative">
                <span className={`font-sans font-bold tracking-tight text-5xl drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] ${isDark ? 'text-white' : 'text-gray-900 drop-shadow-none'}`}>35</span>
                <span className="text-xs font-bold text-green-500 mb-2 flex items-center gap-0.5">78% <ArrowUp size={10} /></span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none opacity-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={presentesData}>
                    <Line type="monotone" dataKey="val" stroke={isDark ? "#fff" : "#111"} strokeWidth={3} dot={false} style={{ filter: isDark ? 'drop-shadow(0px 0px 4px rgba(255,255,255,0.5))' : 'none' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ausências */}
            <div className={`rounded-2xl border p-4 flex flex-col relative overflow-hidden h-40 transition-colors ${isDark ? 'bg-[#101014]/60 backdrop-blur-md border-white/10' : 'bg-white/60 backdrop-blur-md border-black/10 shadow-sm'}`}>
              <div className="flex justify-between items-start z-10">
                <h3 className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Ausências</h3>
                <Clock size={12} className={isDark ? "text-white/40" : "text-gray-400"} />
              </div>
              <div className="flex items-end gap-3 z-10 relative">
                <span className={`font-sans font-bold tracking-tight text-5xl drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] ${isDark ? 'text-white' : 'text-gray-900 drop-shadow-none'}`}>2</span>
                <span className="text-xs font-bold text-green-500 mb-2 flex items-center gap-0.5">4% <ArrowUp size={10} /></span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none opacity-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ausenciasData} margin={{ left: 10, right: 10, bottom: -5 }}>
                    <Bar dataKey="val" fill={isDark ? "#8093af" : "#cbd5e1"} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Trabalho Externo */}
            <div className={`rounded-2xl border p-4 flex flex-col transition-colors ${isDark ? 'bg-[#101014]/60 backdrop-blur-md border-white/10' : 'bg-white/60 backdrop-blur-md border-black/10 shadow-sm'}`}>
              <div className="flex justify-between items-start">
                <h3 className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Trabalho Externo</h3>
                <LogOut size={12} className={isDark ? "text-white/40" : "text-gray-400"} />
              </div>
              <div className="flex items-end gap-3 z-10 relative mt-2">
                <span className={`font-sans font-bold tracking-tight text-5xl ${isDark ? 'text-white/50' : 'text-gray-400'}`}>0</span>
              </div>
            </div>

          </div>

          {/* Column 4: Equipamentos Ativos */}
          <div className={`rounded-2xl border p-6 flex flex-col relative overflow-hidden transition-colors ${isDark ? 'bg-[#101014]/60 backdrop-blur-md border-white/10' : 'bg-white/60 backdrop-blur-md border-black/10 shadow-lg'}`}>
            <div className="flex justify-between items-start mb-1">
              <h3 className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-white/80' : 'text-gray-800'}`}>Equipamentos Ativos</h3>
              <button className={`text-[10px] font-bold transition-colors uppercase tracking-wider ${isDark ? 'text-white hover:text-yellow-400' : 'text-gray-700 hover:text-yellow-500'}`}>Ver tudo &rarr;</button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center mt-4 relative">
              <div className="relative flex items-center justify-center mt-2 mb-6">
                <svg viewBox="0 0 100 100" className={`w-48 h-48 transform -rotate-90 filter ${isDark ? 'drop-shadow-[0_0_15px_rgba(255,255,255,0.6)]' : 'drop-shadow-[0_0_8px_rgba(0,0,0,0.1)]'}`}>
                  <circle cx="50" cy="50" r="42" fill="none" stroke={isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"} strokeWidth="6" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke={isDark ? "#fff" : "#111"} strokeWidth="6" strokeDasharray="264" strokeDashoffset="44" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className={`font-sans font-bold tracking-tight text-6xl ${isDark ? 'text-white' : 'text-gray-900'}`}>83%</span>
                </div>
              </div>
              <div className="flex justify-between items-end relative z-10 mt-auto">
                <span className={`font-sans font-bold tracking-tight text-5xl ${isDark ? 'text-white/80' : 'text-gray-700'}`}>19</span>
                <span className={`text-xs font-medium mb-1 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>de 23</span>
              </div>
            </div>

          </div>

        </div>

        {/* Linha dos Lembretes */}
        <div className="mt-6 w-full lg:w-1/2">
          <DashboardRemindersWidget />
        </div>

      </div>
    </div>
  )
}

