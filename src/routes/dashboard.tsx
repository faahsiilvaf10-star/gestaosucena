import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { WeatherWidget } from '../components/WeatherWidget'
import { DashboardRemindersWidget } from '../components/DashboardRemindersWidget'
import { DashboardVistoriasWidget } from '../components/DashboardVistoriasWidget'
import { useTheme } from '../contexts/ThemeContext'
import { CalendarDays } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar } from 'recharts'
import { Card, CardContent, CardTitle } from '../components/ui/card'
import { useQuery } from '@tanstack/react-query'
import { subDays, addDays, format, getMonth, getDate } from 'date-fns'
import { Gift } from 'lucide-react'

export const Route = createFileRoute('/dashboard')({
  component: DashboardComponent,
})

function DashboardComponent() {
  const { isDark } = useTheme()
  
  // Buscar lista de presença real (últimos 7 dias)
  const { data: chartData } = useQuery({
    queryKey: ['presencas_dashboard'],
    queryFn: async () => {
      const days = []
      // 7 days including today
      for (let i = 6; i >= 0; i--) {
        days.push(format(subDays(new Date(), i), 'yyyy-MM-dd'))
      }

      const { data, error } = await supabase
        .from('rh_presencas')
        .select('data, status')
        .in('data', days)

      if (error) throw error

      return days.map(dayStr => {
        const records = data?.filter(r => r.data === dayStr) || []
        return {
          date: dayStr,
          presentes: records.filter(r => r.status === 'PRESENTE').length,
          // Ausência: conta faltas puras, atestados e trabalhos externos
          ausencias: records.filter(r => r.status === 'AUSENTE' || r.status === 'ATESTADO' || r.status === 'EXTERNO').length 
        }
      })
    },
    refetchInterval: 60000 // Refaz a query automaticamente a cada 1 minuto
  })

  // Dados mapeados para os gráficos
  const presentesData = chartData ? chartData.map(d => ({ val: d.presentes })) : [{ val: 0 }]
  const ausenciasData = chartData ? chartData.map(d => ({ val: d.ausencias })) : [{ val: 0 }]

  // Valores de hoje
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayData = chartData?.find(d => d.date === todayStr) || { presentes: 0, ausencias: 0 }
  
  // Buscar DDS
  const { data: ddsData } = useQuery({
    queryKey: ['dds_dashboard'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd')
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')

      const { data: schedule } = await supabase
        .from('seguranca_dds')
        .select('*')
        .in('date', [today, tomorrow])
        
      const { data: users } = await supabase.rpc('get_system_users')
      
      const getPalestranteName = (id: string) => {
        if (!id) return 'Sem Palestrante'
        const user = (users || []).find((u: any) => u.id === id)
        return user ? user.nome : 'Desconhecido'
      }

      const todayDds = schedule?.find(s => s.date === today)
      const tomorrowDds = schedule?.find(s => s.date === tomorrow)

      return {
        hoje: {
          tema: todayDds?.tema || 'Sem tema agendado',
          palestrante: todayDds ? getPalestranteName(todayDds.palestrante_id) : 'Livre'
        },
        amanha: {
          tema: tomorrowDds?.tema || 'Sem tema agendado',
          palestrante: tomorrowDds ? getPalestranteName(tomorrowDds.palestrante_id) : 'Livre'
        }
      }
    },
    refetchInterval: 300000 // Refaz a cada 5 min
  })

  // Buscar efetivo completo para contagem e aniversariantes
  const { data: efetivo = [] } = useQuery({
    queryKey: ['efetivo_dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('rh_efetivo').select('nome, raw_data, status')
      if (error) throw error
      return data || []
    }
  })
  
  const totalFuncionarios = efetivo.filter((e: any) => e.status !== 'REMOVIDO' && e.status !== 'INATIVO').length || '...'

  // Buscar equipamentos
  const { data: eqData } = useQuery({
    queryKey: ['equipments_dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eq_equipments').select('location_status, last_exit_reason')
      if (error) throw error
      
      let operacao = 0
      let manutencao = 0
      
      data?.forEach(eq => {
        const isInside = eq.location_status !== 'outside'
        if (isInside) operacao++
        else if (eq.last_exit_reason === 'preventive_maintenance' || eq.last_exit_reason === 'corrective_maintenance') manutencao++
      })
      
      return { operacao, manutencao }
    }
  })

  // Calcular aniversariantes do mês
  const aniversariantesMes = (efetivo || []).map((emp: any) => {
    if (!emp.raw_data) return null
    
    // Find key containing 'NASCIMENTO'
    const nascKey = Object.keys(emp.raw_data).find(k => k.toUpperCase().includes('NASCIMENTO'))
    if (!nascKey) return null

    let val = emp.raw_data[nascKey]
    let day = 0
    let month = 0
    let valid = false

    if (typeof val === 'number') {
      const d = new Date((val - (25567 + 2)) * 86400 * 1000)
      if (!isNaN(d.getTime())) {
        day = d.getUTCDate()
        month = d.getUTCMonth()
        valid = true
      }
    } else if (typeof val === 'string' && val.includes('/')) {
      const parts = val.split('/')
      if (parts.length === 3) {
        day = Number(parts[0])
        month = Number(parts[1]) - 1
        valid = !isNaN(day) && !isNaN(month)
      }
    }

    if (!valid) return null

    return {
      nome: emp.nome,
      day,
      month
    }
  })
  .filter(Boolean)
  .filter((a: any) => a.month === getMonth(new Date()))
  .sort((a: any, b: any) => a.day - b.day)

  const hojeDay = getDate(new Date())

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

        {/* Main Grid — responsivo */}
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
                    {todayData.presentes}
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
                    {todayData.ausencias}
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



          {/* Coluna 4: Aniversariantes do Mês */}
          <div className="flex flex-col gap-4 sm:gap-6">
            <Card className="flex-1 flex flex-col overflow-hidden shadow-md">
              <CardContent className="flex-1 p-4 sm:p-6 flex flex-col">
                <CardTitle className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                  <Gift size={14} /> Aniversariantes do Mês
                </CardTitle>
                <div className="flex flex-col gap-2 overflow-y-auto max-h-[140px] pr-2 custom-scrollbar">
                  {aniversariantesMes.length > 0 ? (
                    aniversariantesMes.map((aniv: any, idx: number) => (
                      <div 
                        key={idx} 
                        className={`flex justify-between items-center p-2 rounded-md text-sm ${aniv.day === hojeDay ? 'bg-black text-white font-bold' : 'bg-gray-50 text-gray-700'}`}
                      >
                        <span className="line-clamp-1 capitalize flex-1">{typeof aniv.nome === 'string' ? aniv.nome.toLowerCase() : aniv.nome}</span>
                        <span className="ml-2 whitespace-nowrap">Dia {String(aniv.day).padStart(2, '0')}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-sm text-gray-400">Nenhum aniversariante encontrado neste mês.</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna 5: Equipamentos */}
          <div className="flex flex-col gap-4 sm:gap-6">
            <Card className="flex-1 flex flex-col justify-between overflow-hidden shadow-md">
              <CardContent className="flex-1 p-4 sm:p-6 flex flex-col justify-center">
                <CardTitle className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h.01"/><path d="M17 7h.01"/><path d="M7 17h.01"/><path d="M17 17h.01"/><path d="M12 2v20"/><path d="M2 12h20"/></svg>
                  Em Operação
                </CardTitle>
                <div className="flex flex-col items-center">
                  <span className="font-bold text-4xl sm:text-5xl text-blue-500 metric-value">
                    {eqData?.operacao || 0}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="flex-1 flex flex-col justify-between overflow-hidden shadow-md">
              <CardContent className="flex-1 p-4 sm:p-6 flex flex-col justify-center">
                <CardTitle className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m14 7 3-3 4 4-3 3-4-4Z"/><path d="M12 11.5 5 19l-3 3 3-3 7-7"/><path d="m17.5 13-3-3"/><path d="m10.5 16-3-3"/></svg>
                  Em Manutenção
                </CardTitle>
                <div className="flex flex-col items-center">
                  <span className="font-bold text-4xl sm:text-5xl text-orange-500 metric-value">
                    {eqData?.manutencao || 0}
                  </span>
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
          <div className="w-full lg:w-1/2 flex flex-col gap-4 sm:gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <Card className="flex-1 flex flex-col justify-between overflow-hidden shadow-md">
                <CardContent className="flex-1 p-4 sm:p-6 flex flex-col justify-center">
                  <CardTitle className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                    DDS Hoje
                  </CardTitle>
                  <div className="flex flex-col">
                    <span className="font-bold text-xl sm:text-2xl text-black line-clamp-2 leading-tight capitalize">
                      {typeof ddsData?.hoje?.palestrante === 'string' ? ddsData.hoje.palestrante.toLowerCase() : ddsData?.hoje?.palestrante || 'Carregando...'}
                    </span>
                    <span className="text-sm text-gray-500 mt-1 line-clamp-1">
                      Tema: {ddsData?.hoje?.tema || '-'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="flex-1 flex flex-col justify-between overflow-hidden shadow-md">
                <CardContent className="flex-1 p-4 sm:p-6 flex flex-col justify-center">
                  <CardTitle className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                    DDS Amanhã
                  </CardTitle>
                  <div className="flex flex-col">
                    <span className="font-bold text-xl sm:text-2xl text-black line-clamp-2 leading-tight capitalize">
                      {typeof ddsData?.amanha?.palestrante === 'string' ? ddsData.amanha.palestrante.toLowerCase() : ddsData?.amanha?.palestrante || 'Carregando...'}
                    </span>
                    <span className="text-sm text-gray-500 mt-1 line-clamp-1">
                      Tema: {ddsData?.amanha?.tema || '-'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
            <DashboardVistoriasWidget />
          </div>
        </div>

      </div>
    </div>
  )
}
