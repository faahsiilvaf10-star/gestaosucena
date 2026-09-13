import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { WeatherWidget } from '../components/WeatherWidget'
import { DashboardRemindersWidget } from '../components/DashboardRemindersWidget'
import { DashboardVistoriasWidget } from '../components/DashboardVistoriasWidget'
import { useTheme } from '../contexts/ThemeContext'
import { CalendarDays } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { subDays, addDays, format, getMonth } from 'date-fns'
import { Gift, MapPin } from 'lucide-react'
import '../dashboard.css'

export const Route = createFileRoute('/dashboard')({
  component: DashboardComponent,
})

function DashboardComponent() {
  const { isDark } = useTheme()
  const hojeDay = new Date().getDate()
  
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

  // Calcular porcentagens para os gráficos donut
  const totalFuncNum = typeof totalFuncionarios === 'number' ? totalFuncionarios : 0
  const pctPresenca = totalFuncNum > 0 ? Math.round((todayData.presentes / totalFuncNum) * 100) : 0
  const pctAusencia = totalFuncNum > 0 ? Math.round((todayData.ausencias / totalFuncNum) * 100) : 0
  
  const eqTotal = (eqData?.operacao || 0) + (eqData?.manutencao || 0)
  const pctOperacao = eqTotal > 0 ? Math.round(((eqData?.operacao || 0) / eqTotal) * 100) : 0
  const pctManutencao = eqTotal > 0 ? Math.round(((eqData?.manutencao || 0) / eqTotal) * 100) : 0

  return (
    <div className="dashboard-page selection:bg-blue-500/30">
      <div className="dashboard-container">
        
        {/* Title & Date — responsivo */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 mb-4 sm:mb-8 mt-1 sm:mt-2 px-2 sm:px-0">
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

        <div className="dashboard-grid">
          
          {/* WEATHER */}
          <WeatherWidget />

          {/* PRESENÇA */}
          <div className="dashboard-card card-presence">
            <div className="card-header">
              <div className="card-title-wrap">
                <div className="icon-box icon-green">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <h3 className="card-title">PRESENTES HOJE</h3>
              </div>
              <button className="card-menu">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              </button>
            </div>
            <div className="donut-wrapper">
              <div className="donut" style={{ "--value": pctPresenca, "--accent": "var(--green)", "--track": "rgba(32, 199, 108, 0.15)" } as any}>
                <div className="donut-content">
                  <div className="donut-number">{todayData.presentes}</div>
                  <div className="donut-total">de {totalFuncionarios}</div>
                </div>
              </div>
              <div className="percent-box percent-green">
                <strong>{pctPresenca}%</strong>
                <span>de presença</span>
              </div>
            </div>
          </div>

          {/* ANIVERSARIANTES */}
          <div className="dashboard-card card-birthday">
            <div className="card-header">
              <div className="card-title-wrap">
                <div className="icon-box icon-purple">
                  <Gift size={20} />
                </div>
                <h3 className="card-title">ANIVERSARIANTES DO MÊS</h3>
              </div>
              <button className="card-menu">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              </button>
            </div>
            <div className="birthday-list">
              {aniversariantesMes.length > 0 ? (
                aniversariantesMes.slice(0, 3).map((aniv: any, idx: number) => (
                  <div key={idx} className={`birthday-item ${aniv.day === hojeDay ? 'active' : ''}`}>
                    <span className="birthday-name capitalize">{typeof aniv.nome === 'string' ? aniv.nome.toLowerCase() : aniv.nome}</span>
                    <span className="birthday-day">Dia {String(aniv.day).padStart(2, '0')}</span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500 text-center mt-4">Nenhum neste mês</div>
              )}
            </div>
          </div>

          {/* OPERAÇÃO */}
          <div className="dashboard-card card-operation">
            <div className="card-header">
              <div className="card-title-wrap">
                <div className="icon-box icon-blue">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                </div>
                <h3 className="card-title">EM OPERAÇÃO</h3>
              </div>
              <button className="card-menu">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              </button>
            </div>
            <div className="donut-wrapper">
              <div className="donut" style={{ "--value": pctOperacao, "--accent": "var(--blue)", "--track": "rgba(22, 119, 255, 0.15)" } as any}>
                <div className="donut-content">
                  <div className="donut-number">{eqData?.operacao || 0}</div>
                  <div className="donut-total">de {eqTotal}</div>
                </div>
              </div>
              <div className="percent-box percent-blue">
                <strong>{pctOperacao}%</strong>
                <span>em operação</span>
              </div>
            </div>
          </div>

          {/* TOTAL FUNCIONARIOS */}
          <div className="dashboard-card card-total">
            <div className="card-header">
              <div className="card-title-wrap">
                <div className="icon-box icon-blue">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <h3 className="card-title">TOTAL DE FUNCIONÁRIOS</h3>
              </div>
              <button className="card-menu">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              </button>
            </div>
            <div className="big-number">{totalFuncionarios}</div>
            <div className="big-number-label">colaboradores</div>
            
            <svg className="employee-decoration" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>

          {/* AUSÊNCIAS */}
          <div className="dashboard-card card-absence">
            <div className="card-header">
              <div className="card-title-wrap">
                <div className="icon-box icon-red">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="23" y2="14"/><line x1="23" y1="8" x2="17" y2="14"/></svg>
                </div>
                <h3 className="card-title">AUSÊNCIAS</h3>
              </div>
              <button className="card-menu">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              </button>
            </div>
            <div className="donut-wrapper">
              <div className="donut" style={{ "--value": pctAusencia, "--accent": "var(--red)", "--track": "rgba(242, 55, 89, 0.15)" } as any}>
                <div className="donut-content">
                  <div className="donut-number">{todayData.ausencias}</div>
                  <div className="donut-total">de {totalFuncionarios}</div>
                </div>
              </div>
              <div className="percent-box percent-red">
                <strong>{pctAusencia}%</strong>
                <span>de ausências</span>
              </div>
            </div>
          </div>

          {/* MANUTENÇÃO */}
          <div className="dashboard-card card-maintenance">
            <div className="card-header">
              <div className="card-title-wrap">
                <div className="icon-box icon-orange">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                </div>
                <h3 className="card-title">EM MANUTENÇÃO</h3>
              </div>
              <button className="card-menu">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              </button>
            </div>
            <div className="donut-wrapper">
              <div className="donut" style={{ "--value": pctManutencao, "--accent": "var(--orange)", "--track": "rgba(255, 114, 0, 0.15)" } as any}>
                <div className="donut-content">
                  <div className="donut-number">{eqData?.manutencao || 0}</div>
                  <div className="donut-total">de {eqTotal}</div>
                </div>
              </div>
              <div className="percent-box percent-orange">
                <strong>{pctManutencao}%</strong>
                <span>em manutenção</span>
              </div>
            </div>
          </div>

          {/* DDS HOJE */}
          <div className="dashboard-card card-dds">
            <div className="dds-card-content">
              <div className="dds-main">
                <div className="icon-box icon-blue">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <div>
                  <div className="dds-label text-blue-600">DDS Hoje</div>
                  <div className="dds-status capitalize">{typeof ddsData?.hoje?.palestrante === 'string' ? ddsData.hoje.palestrante.toLowerCase() : ddsData?.hoje?.palestrante || 'Livre'}</div>
                  <div className="dds-theme">Tema: {ddsData?.hoje?.tema || 'Sem tema agendado'}</div>
                </div>
              </div>
              <div className="dds-arrow">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </div>
          </div>

          {/* DDS AMANHÃ */}
          <div className="dashboard-card card-dds">
            <div className="dds-card-content">
              <div className="dds-main">
                <div className="icon-box icon-blue">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <div>
                  <div className="dds-label text-blue-600">DDS Amanhã</div>
                  <div className="dds-status capitalize">{typeof ddsData?.amanha?.palestrante === 'string' ? ddsData.amanha.palestrante.toLowerCase() : ddsData?.amanha?.palestrante || 'Livre'}</div>
                  <div className="dds-theme">Tema: {ddsData?.amanha?.tema || 'Sem tema agendado'}</div>
                </div>
              </div>
              <div className="dds-arrow">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </div>
          </div>

        </div>

        {/* BOTTOM WIDGETS */}
        <div className="w-full flex flex-col lg:flex-row gap-4 sm:gap-6 mt-6">
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
