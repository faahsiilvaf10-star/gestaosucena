import React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Calendar as CalendarIcon, Info } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  getISOWeek,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const Route = createFileRoute('/rh/calendario-hydro')({
  component: CalendarioHydroPage,
})

const feriados: Record<string, string> = {
  '2026-01-01': 'Confraternização Universal',
  '2026-04-03': 'Paixão de Cristo',
  '2026-04-21': 'Tiradentes',
  '2026-05-01': 'Dia do Trabalhador',
  '2026-06-04': 'Corpus Christi',
  '2026-08-15': 'Adesão do Pará',
  '2026-09-07': 'Independência do Brasil',
  '2026-10-12': 'Nossa Sra. Aparecida / Dias das Crianças',
  '2026-11-02': 'Finados',
  '2026-11-15': 'Proclamação da República',
  '2026-11-20': 'Dia da Consciência Negra',
  '2026-12-03': 'Feriado Municipal - São Francisco Xavier',
  '2026-12-25': 'Natal',
}

const prensados: Record<string, string> = {
  '2026-02-16': 'Carnaval',
  '2026-02-17': 'Carnaval',
  '2026-02-18': 'Quarta Cinzas (dia compensado)',
  '2026-04-20': 'Dia Compensado',
  '2026-06-05': 'Dia Compensado',
  '2026-12-04': 'Dia Compensado',
}

function CalendarioHydroPage() {
  const { isDark } = useTheme()
  const year = 2026
  
  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1))
  const weekDays = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM']

  return (
    <div className={`flex flex-col min-h-screen ${isDark ? 'bg-[#111111] text-white' : 'bg-[#faf9f6] text-gray-900'}`}>
      <div className="flex flex-col gap-6 p-4 md:p-8 w-full max-w-7xl mx-auto flex-1">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link to="/rh" className="text-gray-500 hover:text-black dark:hover:text-white transition-colors">
                <ArrowLeft size={24} />
              </Link>
              <h1 className="text-[42px] font-display italic tracking-tight" style={{ lineHeight: '1' }}>
                Calendário Projetos Alunorte {year}
              </h1>
            </div>
            <p className="text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-2 text-sm">
              <CalendarIcon size={16} /> Visão geral de feriados e dias de compensação (Hydro)
            </p>
          </div>
          
          {/* Legenda */}
          <div className="flex flex-col gap-2 bg-black/5 dark:bg-white/5 p-4 rounded-2xl border border-black/10 dark:border-white/10 w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-sm bg-red-600 dark:bg-red-500"></div>
              <span className="text-sm font-medium">Feriados Nacionais e Local</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-sm bg-gray-400 dark:bg-gray-500"></div>
              <span className="text-sm font-medium">Dias Prensados (compensação de horas)</span>
            </div>
          </div>
        </div>

        {/* Grid de Meses */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-4">
          {months.map((month, monthIdx) => {
            const monthStart = startOfMonth(month)
            const monthEnd = endOfMonth(monthStart)
            const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
            const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })
            
            const days = eachDayOfInterval({
              start: startDate,
              end: endDate
            })

            // Filter special days for this month's text summary
            const monthFeriados = Object.entries(feriados).filter(([dateStr]) => dateStr.startsWith(format(month, 'yyyy-MM')))
            const monthPrensados = Object.entries(prensados).filter(([dateStr]) => dateStr.startsWith(format(month, 'yyyy-MM')))

            return (
              <div key={monthIdx} className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-white/10 rounded-2xl p-4 shadow-sm flex flex-col">
                <h2 className="text-center font-bold text-lg mb-4 uppercase tracking-wider text-[#0866ff] dark:text-[#3b82f6]">
                  {format(month, 'MMMM', { locale: ptBR })}
                </h2>
                
                {/* Dias da Semana Header */}
                <div className="grid grid-cols-8 gap-1 mb-2 text-center text-[10px] font-bold text-gray-500">
                  <div className="text-gray-400 flex items-center justify-center">SEM</div>
                  {weekDays.map(day => (
                    <div key={day} className="w-full flex items-center justify-center">{day}</div>
                  ))}
                </div>

                {/* Dias */}
                <div className="grid grid-cols-8 gap-1 text-center text-sm flex-1">
                  {days.map((day, dayIdx) => {
                    const isFirstDayOfWeek = dayIdx % 7 === 0;
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const isFeriado = feriados[dateStr]
                    const isPrensado = prensados[dateStr]
                    const isCurrentMonth = isSameMonth(day, month)
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6
                    
                    let bgClass = "bg-transparent"
                    let textClass = isCurrentMonth ? "text-gray-900 dark:text-gray-100" : "text-gray-300 dark:text-gray-600"
                    
                    if (isCurrentMonth) {
                      if (isFeriado) {
                        bgClass = "bg-red-600 dark:bg-red-500 text-white font-bold"
                        textClass = "text-white"
                      } else if (isPrensado) {
                        bgClass = "bg-gray-400 dark:bg-gray-500 text-white font-bold"
                        textClass = "text-white"
                      } else if (isWeekend) {
                        bgClass = "bg-gray-100 dark:bg-white/5"
                        textClass = "text-gray-500 dark:text-gray-400 font-medium"
                      }
                    }

                    return (
                      <React.Fragment key={day.toISOString()}>
                        {isFirstDayOfWeek && (
                          <div className="flex items-center justify-center text-[10px] font-bold text-gray-400 border-r border-gray-100 dark:border-white/5 pr-1 mr-1">
                            {getISOWeek(day)}
                          </div>
                        )}
                        <div 
                          className={`aspect-square flex items-center justify-center rounded-md ${bgClass} ${textClass} transition-all`}
                          title={isFeriado || isPrensado || undefined}
                        >
                          {format(day, 'd')}
                        </div>
                      </React.Fragment>
                    )
                  })}
                </div>

                {/* Resumo do mês */}
                {((monthFeriados.length > 0) || (monthPrensados.length > 0)) && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/10 text-xs flex flex-col gap-1.5">
                    {monthFeriados.map(([dateStr, name]) => (
                      <div key={dateStr} className="flex gap-2">
                        <span className="font-bold text-red-600 dark:text-red-400">{format(new Date(dateStr + 'T12:00:00'), 'dd')} -</span>
                        <span className="text-gray-600 dark:text-gray-300">{name}</span>
                      </div>
                    ))}
                    {monthPrensados.map(([dateStr, name]) => (
                      <div key={dateStr} className="flex gap-2">
                        <span className="font-bold text-gray-500 dark:text-gray-400">{format(new Date(dateStr + 'T12:00:00'), 'dd')} -</span>
                        <span className="text-gray-600 dark:text-gray-300">{name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        
        <div className="mt-8 text-center text-sm text-gray-400 pb-8 flex items-center justify-center gap-2">
          <Info size={16} />
          Fonte: feriados e compensados - RH informa - Hydro Alunorte
        </div>
      </div>
    </div>
  )
}
