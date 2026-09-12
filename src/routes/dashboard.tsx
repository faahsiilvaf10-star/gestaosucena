import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { WeatherWidget } from '../components/WeatherWidget'
import { DashboardRemindersWidget } from '../components/DashboardRemindersWidget'
import { DashboardVistoriasWidget } from '../components/DashboardVistoriasWidget'
import { useTheme } from '../contexts/ThemeContext'
import { CalendarDays } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardTitle } from '../components/ui/card'

export const Route = createFileRoute('/dashboard')({
  component: DashboardComponent,
})

// Mock sparkline data
const presentesData = [
  { val: 10 }, { val: 15 }, { val: 12 }, { val: 14 }, { val: 18 }, { val: 20 }, { val: 22 }, { val: 35 }
]

const ausenciasData = [
  { val: 3 }, { val: 2 }, { val: 4 }, { val: 1 }, { val: 3 }, { val: 2 }, { val: 7 }
]

function DashboardComponent() {
  const { isDark } = useTheme()
  const [totalFuncionarios, setTotalFuncionarios] = useState<number | string>('...')
  
  useEffect(() => {
    const fetchTotal = async () => {
      try {
        const { count, error } = await supabase.from('rh_efetivo').select('*', { count: 'exact', head: true })
        if (!error) {
          setTotalFuncionarios(count ?? 0)
        }
      } catch (e) {
        console.error(e)
        setTotalFuncionarios(0)
      }
    }
    fetchTotal()
  }, [])

  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })

  const currentDateShort = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })

  return (
    <div className={`min-h-screen font-sans selection:bg-purple-500/30 transition-colors duration-300 relative`}>
      {/* Dashboard Grid */}
      <div className="py-4 pb-8 sm:py-8 sm:pb-24 space-y-4 sm:space-y-6 max-w-[1600px] w-full mx-auto relative z-10">

        {/* Title & Date — responsivo */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 mb-4 sm:mb-8 mt-1 sm:mt-2">
          <div>
            <h1
              className={`font-display italic tracking-tight ${isDark ? 'text-gray-900 dark:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]' : 'text-gray-900 drop-shadow-none'}`}
              style={{ fontSize: 'clamp(32px, 8vw, 54px)', lineHeight: '1' }}
            >
              Início
            </h1>
            <p className={`text-sm mt-1 ml-0.5 font-medium ${isDark ? 'text-gray-900 dark:text-white/70' : 'text-gray-500'}`}>
              Visão geral da operação
            </p>
          </div>
          {/* Data — compacta em mobile, completa em desktop */}
          <div className={`flex items-center gap-2 font-evantic tracking-wide ${isDark ? 'text-gray-900 dark:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]' : 'text-gray-900 drop-shadow-none'}`}
            style={{ fontSize: 'clamp(14px, 4vw, 22px)' }}
          >
            <CalendarDays size={20} className={`flex-shrink-0 ${isDark ? 'opacity-80' : 'opacity-60'}`} />
            {/* Data curta em mobile, completa em desktop */}
            <span className="sm:hidden">{currentDateShort}</span>
            <span className="hidden sm:inline">{currentDate}</span>
          </div>
        </div>

        {/* Main Grid — 1 col mobile, 2 col tablet, 4 col desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          
          {/* Coluna 1: Clima + Total Funcionários */}
          <div className="flex flex-col gap-4 sm:gap-6">
            <WeatherWidget />
            
            {/* Total Funcionários */}
            <Card className="flex-1 flex flex-col justify-between overflow-hidden shadow-md">
              <CardContent className="flex-1 flex flex-col p-4 sm:p-6">
                <CardTitle className="text-center text-[10px] uppercase tracking-widest pt-2 sm:pt-4 text-muted-foreground">
                  Total de Funcionários
                </CardTitle>
                <div className="flex justify-center items-center flex-1 w-full relative z-10 pt-3 sm:pt-4">
                  <span
                    className="font-sans font-bold tracking-tight metric-value"
                    style={{ fontSize: 'clamp(36px, 10vw, 60px)' }}
                  >
                    {totalFuncionarios}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna 2: Presença (mobile empilha, desktop coluna) */}
          <div className="flex flex-col gap-4 sm:gap-6">
            <Card className="overflow-hidden shadow-md">
              <CardContent className="p-4 sm:p-6">
                <CardTitle className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                  Presentes Hoje
                </CardTitle>
                <div className="flex items-end justify-between gap-2">
                  <span className="font-bold text-4xl sm:text-5xl text-green-500 metric-value">
                    {presentesData[presentesData.length - 1].val}
                  </span>
                  <div className="flex-1 min-w-0" style={{ height: 60 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={presentesData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <Bar dataKey="val" fill="#22c55e" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden shadow-md">
              <CardContent className="p-4 sm:p-6">
                <CardTitle className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                  Ausências
                </CardTitle>
                <div className="flex items-end justify-between gap-2">
                  <span className="font-bold text-4xl sm:text-5xl text-red-500 metric-value">
                    {ausenciasData[ausenciasData.length - 1].val}
                  </span>
                  <div className="flex-1 min-w-0" style={{ height: 60 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ausenciasData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <Bar dataKey="val" fill="#ef4444" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>

        {/* Bottom Widgets Row — empilhados em mobile */}
        <div className="w-full flex flex-col lg:flex-row gap-4 sm:gap-6">
          <div className="w-full lg:w-1/2">
            <DashboardRemindersWidget />
          </div>
          <div className="w-full lg:w-1/2">
            <DashboardVistoriasWidget />
          </div>
        </div>

      </div>
    </div>
  )
}
