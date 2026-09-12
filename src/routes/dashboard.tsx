import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { WeatherWidget } from '../components/WeatherWidget'
import { DashboardRemindersWidget } from '../components/DashboardRemindersWidget'
import { DashboardVistoriasWidget } from '../components/DashboardVistoriasWidget'
import { useTheme } from '../contexts/ThemeContext'
import { CalendarDays, LogOut, CheckCircle2, Clock, Calendar, Check, AlertCircle, ArrowUp } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../components/ui/chart'


export const Route = createFileRoute('/dashboard')({
  component: DashboardComponent,
})

const presentesConfig = {
  val: {
    label: "Presentes",
    color: "hsl(var(--chart-1))",
  },
}

const ausenciasConfig = {
  val: {
    label: "Ausências",
    color: "hsl(var(--chart-2))",
  },
}

const radarConfig = {
  desktop: {
    label: "Desktop",
    color: "hsl(var(--chart-1))",
  },
}

const radarData = [
  { subject: "Frontend", desktop: 186 },
  { subject: "Backend", desktop: 305 },
  { subject: "DevOps", desktop: 237 },
  { subject: "Design", desktop: 273 },
  { subject: "Testing", desktop: 209 },
  { subject: "Security", desktop: 214 },
]

// Mock data for sparklines
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
          setTotalFuncionarios(count || 0)
        }
      } catch (e) {
        console.error(e)
      }
    }
    fetchTotal()
  }, [])

  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })

  return (
    <div className={`min-h-screen font-sans selection:bg-purple-500/30 transition-colors duration-300 relative overflow-hidden`}>
      {/* Background is handled globally via AppLayout/CSS, here we just provide spacing */}

      {/* === Signature S Background === */}


      {/* Dashboard Grid */}
      <div className="p-8 pb-24 space-y-6 max-w-[1600px] w-full mx-auto relative z-10">
        


        {/* Title & Controls */}
        <div className="flex items-center justify-between mb-8 mt-2">
          <div>
            <h1 className={`text-[54px] font-display italic tracking-tight ${isDark ? 'text-gray-900 dark:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]' : 'text-gray-900 drop-shadow-none'}`} style={{ lineHeight: '1' }}>
              Início
            </h1>
            <p className={`text-sm mt-1 ml-1 font-medium ${isDark ? 'text-gray-900 dark:text-white/70' : 'text-gray-500'}`}>Visão geral da operação</p>
          </div>
          <div className={`flex items-center gap-2 font-evantic tracking-wide text-2xl ${isDark ? 'text-gray-900 dark:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]' : 'text-gray-900 drop-shadow-none'}`}>
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
            <Card className="flex-1 flex flex-col justify-between overflow-hidden shadow-md">
              <CardContent className="flex-1 flex flex-col p-6">
                <CardTitle className="text-center text-[10px] uppercase tracking-widest pt-4 text-muted-foreground">Total de Funcionários</CardTitle>
                <div className="flex justify-center items-center flex-1 w-full relative z-10 pt-4">
                  <span className="font-sans font-bold tracking-tight text-6xl">
                    {totalFuncionarios}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>



        </div>

        {/* Bottom Widgets Row */}
        <div className="mt-6 w-full flex flex-col lg:flex-row gap-6">
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



