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
            <h1 className={`text-[54px] font-display italic tracking-tight ${isDark ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]' : 'text-gray-900 drop-shadow-none'}`} style={{ lineHeight: '1' }}>
              Início
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
            <Card className="flex-1 flex flex-col justify-between overflow-hidden shadow-md">
              <CardContent className="flex-1 flex flex-col p-6">
                <CardTitle className="text-center text-[10px] uppercase tracking-widest pt-4 text-muted-foreground">Total de Funcionários</CardTitle>
                <div className="flex justify-center items-center flex-1 w-full relative z-10 pt-4">
                  <span className="font-sans font-bold tracking-tight text-6xl">
                    45
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Column 2: Avanço Mensal */}
          <Card className="flex flex-col overflow-hidden shadow-md">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-[10px] uppercase tracking-widest">Avanço Mensal</CardTitle>
                  <CardDescription className="text-xs mt-1">Metas do Planejamento</CardDescription>
                </div>
                <button className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary">Ver tudo &rarr;</button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col pt-0 pb-6 px-6">
              <div className="flex-1 flex flex-col items-center justify-center mt-2 relative">
                <svg viewBox="0 0 100 100" className="w-40 h-40 transform -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" className="text-muted/20" strokeWidth="8" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" className="text-primary" strokeWidth="8" strokeDasharray="264" strokeDashoffset="34" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                  <span className="font-sans font-bold tracking-tight text-5xl">87%</span>
                  <span className="text-[9px] uppercase tracking-wider font-semibold mt-1 text-muted-foreground">AVANÇO</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-6 mb-4">
                <div className="flex flex-col items-center">
                  <div className="h-[12px]"></div>
                  <span className="font-sans font-bold tracking-tight text-3xl">11</span>
                  <span className="text-[8px] uppercase tracking-wider font-bold mt-1 text-muted-foreground">TOTAL</span>
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

              <div className="w-full h-1 rounded-full overflow-hidden bg-muted">
                <div className="h-full w-[45%] bg-primary" />
              </div>
              <p className="text-[9px] mt-2 text-center text-muted-foreground">5 de 11 metas concluídas</p>
            </CardContent>
          </Card>

          {/* Column 3: Radar Chart */}
          <Card className="flex flex-col shadow-md">
            <CardHeader className="items-center pb-4">
              <CardTitle className="text-[10px] uppercase tracking-widest">Desempenho Geral</CardTitle>
              <CardDescription className="text-xs">Métricas da equipe</CardDescription>
            </CardHeader>
            <CardContent className="pb-0">
              <ChartContainer
                config={radarConfig}
                className="mx-auto aspect-square max-h-[250px]"
              >
                <RadarChart data={radarData}>
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <PolarAngleAxis dataKey="subject" className="text-[10px] fill-muted-foreground" />
                  <PolarGrid className="stroke-muted/30" />
                  <Radar
                    dataKey="desktop"
                    fill="var(--color-desktop)"
                    fillOpacity={0.6}
                    stroke="var(--color-desktop)"
                    strokeWidth={2}
                    dot={{
                      r: 4,
                      fillOpacity: 1,
                    }}
                    style={{ filter: 'drop-shadow(0px 0px 8px rgba(37,99,235,0.5))' }}
                  />
                </RadarChart>
              </ChartContainer>
            </CardContent>
            <CardFooter className="flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 font-medium leading-none text-xs text-muted-foreground mt-4">
                Visão de competências do time
              </div>
            </CardFooter>
          </Card>

          {/* Column 4: Equipamentos Ativos */}
          <Card className="flex flex-col overflow-hidden shadow-md">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-[10px] uppercase tracking-widest">Equipamentos Ativos</CardTitle>
                <button className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary">Ver tudo &rarr;</button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col pt-0 pb-6 px-6">
              <div className="flex-1 flex flex-col items-center justify-center mt-4 relative">
                <div className="relative flex items-center justify-center mt-2 mb-6">
                  <svg viewBox="0 0 100 100" className="w-48 h-48 transform -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" className="text-muted/20" strokeWidth="6" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" className="text-primary" strokeWidth="6" strokeDasharray="264" strokeDashoffset="44" strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="font-sans font-bold tracking-tight text-6xl">83%</span>
                  </div>
                </div>
                <div className="flex w-full justify-between items-end relative z-10 mt-auto">
                  <span className="font-sans font-bold tracking-tight text-5xl">19</span>
                  <span className="text-xs font-medium mb-1 text-muted-foreground">de 23</span>
                </div>
              </div>
            </CardContent>
          </Card>

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

