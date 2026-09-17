import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { WeatherWidget } from '../components/WeatherWidget'
import { DashboardRemindersWidget } from '../components/DashboardRemindersWidget'
import { DashboardVistoriasWidget } from '../components/DashboardVistoriasWidget'
import { useTheme } from '../contexts/ThemeContext'
import { CalendarDays } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { subDays, addDays, format, getMonth } from 'date-fns'
import { Gift, MapPin, X } from 'lucide-react'
import '../dashboard.css'
import { DdsUploadModal } from '../components/DdsUploadModal'

export const Route = createFileRoute('/dashboard')({
  component: DashboardComponent,
})

function DashboardComponent() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const hojeDay = new Date().getDate()
  
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isDdsModalOpen, setIsDdsModalOpen] = useState(false)
  const [expandedImage, setExpandedImage] = useState<string | null>(null)
  
  const queryClient = useQueryClient()
  
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedImage(null)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data?.user || null)
    })
  }, [])
  
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
      
      const getPalestranteInfo = (id: string) => {
        if (!id) return { id: null, nome: 'Livre', avatar: null }
        const user = (users || []).find((u: any) => u.id === id)
        return user ? { id: user.id, nome: user.nome, avatar: user.avatar_url || null } : { id: null, nome: 'Desconhecido', avatar: null }
      }

      const todayDds = schedule?.find(s => s.date === today)
      const tomorrowDds = schedule?.find(s => s.date === tomorrow)

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      
      const { data: ddsPosts } = await supabase
        .from('social_posts')
        .select(`
          id,
          caption,
          social_post_media (
            media_url
          )
        `)
        .like('caption', '%DDS Realizado!%')
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)

      const postedMediaUrl = ddsPosts && ddsPosts[0]?.social_post_media?.[0]?.media_url || null

      return {
        hoje: {
          tema: todayDds?.tema || 'Sem tema agendado',
          palestrante: todayDds ? getPalestranteInfo(todayDds.palestrante_id) : { id: null, nome: 'Livre', avatar: null },
          postedMedia: postedMediaUrl
        },
        amanha: {
          tema: tomorrowDds?.tema || 'Sem tema agendado',
          palestrante: tomorrowDds ? getPalestranteInfo(tomorrowDds.palestrante_id) : { id: null, nome: 'Livre', avatar: null }
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
      const { data, error } = await supabase.from('eq_equipments').select('location_status, last_exit_reason, name, plate_tag, type, category, updated_at')
      if (error) throw error
      
      let operacaoCount = 0
      let manutencaoCount = 0
      let totalVehicles = 0
      let totalEquipments = 0
      let operacaoList: any[] = []
      let manutencaoList: any[] = []
      
      data?.forEach(eq => {
        totalEquipments++
        const isVehicle = eq.category === 'Leve' || eq.category === 'Equipamento Pesado'
        
        if (isVehicle) {
          totalVehicles++
          const isInside = eq.location_status !== 'outside'
          if (isInside) {
            operacaoCount++
            operacaoList.push(eq)
          }
        }

        if (eq.last_exit_reason === 'preventive_maintenance' || eq.last_exit_reason === 'corrective_maintenance') {
          manutencaoCount++
          manutencaoList.push(eq)
        }
      })
      
      operacaoList.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }))
      manutencaoList.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }))
      
      return { operacao: operacaoCount, manutencao: manutencaoCount, operacaoList, manutencaoList, totalVehicles, totalEquipments }
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

  const capitalizeWords = (str: string) => str.replace(/\b\w/g, c => c.toUpperCase())

  const todayDateFormatted = capitalizeWords(new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  }))

  const tomorrowDateFormatted = capitalizeWords(addDays(new Date(), 1).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  }))

  // Calcular porcentagens para os gráficos donut
  const totalFuncNum = typeof totalFuncionarios === 'number' ? totalFuncionarios : 0
  const pctPresenca = totalFuncNum > 0 ? Math.round((todayData.presentes / totalFuncNum) * 100) : 0
  const pctAusencia = totalFuncNum > 0 ? Math.round((todayData.ausencias / totalFuncNum) * 100) : 0
  
  const totalVehiclesNum = eqData?.totalVehicles || 0
  const totalEquipmentsNum = eqData?.totalEquipments || 0
  
  const pctOperacao = totalVehiclesNum > 0 ? Math.round(((eqData?.operacao || 0) / totalVehiclesNum) * 100) : 0
  const pctManutencao = totalEquipmentsNum > 0 ? Math.round(((eqData?.manutencao || 0) / totalEquipmentsNum) * 100) : 0

  const firstName = currentUser?.user_metadata?.full_name
    ? currentUser.user_metadata.full_name.split(' ')[0]
    : currentUser?.email?.split('@')[0] || 'Usuário'
  const displayFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()

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
              Olá, {displayFirstName}!
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

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6">
          
          {/* TOTAL FUNCIONARIOS */}
          <div className="dashboard-card col-span-1 md:col-span-4">
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

          {/* PRESENÇA */}
          <div className="dashboard-card col-span-1 md:col-span-4">
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

          {/* AUSÊNCIAS */}
          <div className="dashboard-card col-span-1 md:col-span-4">
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

          {/* WEATHER */}
          <div className="col-span-1 md:col-span-3">
            <WeatherWidget />
          </div>

          {/* ANIVERSARIANTES */}
          <div className="dashboard-card col-span-1 md:col-span-3">
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
          <div className="dashboard-card group !overflow-visible hover:z-50 col-span-1 md:col-span-3">
            {/* Tooltip Em Operação */}
            <div className="absolute top-0 left-0 w-full h-full z-10 hidden group-hover:block" />
            <div className="absolute top-[105%] left-1/2 -translate-x-1/2 w-56 sm:w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 p-3 max-h-[400px] overflow-y-auto custom-scrollbar">
              <h4 className="text-sm font-bold mb-2 text-gray-900 dark:text-white border-b border-gray-100 dark:border-white/10 pb-2">Em Operação</h4>
              {eqData?.operacaoList?.length ? (
                <ul className="text-xs space-y-2">
                  {eqData.operacaoList.map((eq: any, i: number) => (
                    <li key={i} className="flex flex-col border-b border-gray-50 dark:border-white/5 pb-1 last:border-0">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-blue-600 dark:text-blue-400 uppercase">{eq.plate_tag || 'S/N'}</span>
                        <span className="text-gray-500 dark:text-gray-400 truncate ml-2 text-right">{eq.name || 'N/A'}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">Nenhum equipamento.</p>
              )}
            </div>
            
            <div className="card-header relative z-0">
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
                  <div className="donut-total">de {totalVehiclesNum}</div>
                </div>
              </div>
              <div className="percent-box percent-blue">
                <strong>{pctOperacao}%</strong>
                <span>em operação</span>
              </div>
            </div>
          </div>

          {/* MANUTENÇÃO */}
          <div className="dashboard-card group !overflow-visible hover:z-50 col-span-1 md:col-span-3">
            {/* Tooltip Em Manutenção */}
            <div className="absolute top-0 left-0 w-full h-full z-10 hidden group-hover:block" />
            <div className="absolute top-[105%] left-1/2 -translate-x-1/2 w-56 sm:w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 p-3 max-h-[400px] overflow-y-auto custom-scrollbar">
              <h4 className="text-sm font-bold mb-2 text-gray-900 dark:text-white border-b border-gray-100 dark:border-white/10 pb-2">Em Manutenção</h4>
              {eqData?.manutencaoList?.length ? (
                <ul className="text-xs space-y-2">
                  {eqData.manutencaoList.map((eq: any, i: number) => (
                    <li key={i} className="flex flex-col border-b border-gray-50 dark:border-white/5 pb-2 last:border-0">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-orange-600 dark:text-orange-400 uppercase">{eq.plate_tag || 'S/N'}</span>
                        <span className="text-gray-500 dark:text-gray-400 truncate ml-2 text-right">{eq.name || 'N/A'}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        Desde: {eq.updated_at ? new Date(eq.updated_at).toLocaleDateString('pt-BR') : 'Data Indisponível'}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">Nenhum equipamento.</p>
              )}
            </div>
            
            <div className="card-header relative z-0">
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
                  <div className="donut-total">de {totalEquipmentsNum}</div>
                </div>
              </div>
              <div className="percent-box percent-orange">
                <strong>{pctManutencao}%</strong>
                <span>em manutenção</span>
              </div>
            </div>
          </div>

          {/* ALERTA DDS (SÓ SE O USUÁRIO FOR O PALESTRANTE) */}
          {currentUser?.id === ddsData?.hoje?.palestrante?.id && (
            <div className="col-span-1 md:col-span-12 flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-6 rounded-2xl bg-[#0f172a] text-white border border-[#1e293b] gap-4 mb-2">
               <div className="flex flex-col gap-3">
                 <div className="flex items-center gap-2 text-blue-400 font-semibold text-lg">
                   <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">!</div>
                   <span>🎤 Atenção! Você é o Palestrante de Hoje!</span>
                 </div>
                 <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                   <CalendarDays size={16} />
                   <span>{todayDateFormatted}</span>
                 </div>
                 <div className="text-white text-base font-medium mt-1">
                   Você está escalado para ministrar o DDS de hoje sobre:
                 </div>
                 <div className="bg-blue-600/20 border border-blue-500/30 px-4 py-2 rounded-full text-blue-300 font-medium text-sm w-fit">
                   {ddsData?.hoje?.tema}
                 </div>
               </div>
               
               <div className="hidden md:flex items-center gap-4 bg-slate-800/50 border border-slate-700 p-4 rounded-xl">
                 <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                   <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                 </div>
                 <div className="flex flex-col">
                   <span className="font-bold text-white text-sm">Prepare-se!</span>
                   <span className="text-slate-400 text-sm">Revise o tema com antecedência</span>
                 </div>
               </div>
            </div>
          )}

          {currentUser?.id === ddsData?.amanha?.palestrante?.id && currentUser?.id !== ddsData?.hoje?.palestrante?.id && (
            <div className="col-span-1 md:col-span-12 flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-6 rounded-2xl bg-[#0f172a] text-white border border-[#1e293b] gap-4 mb-2">
               <div className="flex flex-col gap-3">
                 <div className="flex items-center gap-2 text-blue-400 font-semibold text-lg">
                   <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">!</div>
                   <span>🎤 Atenção! Você é o Palestrante de Amanhã!</span>
                 </div>
                 <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                   <CalendarDays size={16} />
                   <span>{tomorrowDateFormatted}</span>
                 </div>
                 <div className="text-white text-base font-medium mt-1">
                   Você está escalado para ministrar o DDS de amanhã sobre:
                 </div>
                 <div className="bg-blue-600/20 border border-blue-500/30 px-4 py-2 rounded-full text-blue-300 font-medium text-sm w-fit">
                   {ddsData?.amanha?.tema}
                 </div>
               </div>
               
               <div className="hidden md:flex items-center gap-4 bg-slate-800/50 border border-slate-700 p-4 rounded-xl">
                 <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                   <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                 </div>
                 <div className="flex flex-col">
                   <span className="font-bold text-white text-sm">Prepare-se!</span>
                   <span className="text-slate-400 text-sm">Revise o tema com antecedência</span>
                 </div>
               </div>
            </div>
          )}

          {/* DDS HOJE */}
          <div 
            className="dashboard-card relative cursor-pointer hover:shadow-md transition-shadow col-span-1 md:col-span-6"
            onClick={() => navigate({ to: '/seguranca/dds' })}
          >
            <div className="dds-card-content w-full">
              <div className="dds-main w-full pr-12">
                {ddsData?.hoje?.postedMedia ? (
                  <div 
                    className="w-24 sm:w-32 rounded-xl overflow-hidden shrink-0 shadow-sm border border-gray-100/50 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); setExpandedImage(ddsData.hoje.postedMedia); }}
                  >
                    <img src={ddsData.hoje.postedMedia} alt="DDS Realizado" className="w-full h-auto object-contain" />
                  </div>
                ) : ddsData?.hoje?.palestrante?.avatar ? (
                  <div className="icon-box p-0 overflow-hidden shrink-0 shadow-sm border border-gray-100/50">
                    <img src={ddsData.hoje.palestrante.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="icon-box icon-blue shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  </div>
                )}
                <div className="flex-1 w-full">
                  <div className="flex justify-between items-start gap-4 w-full">
                    <div>
                      <div className="dds-label text-blue-600">DDS Hoje</div>
                      <div className="dds-status capitalize">{ddsData?.hoje?.palestrante?.nome?.toLowerCase() || 'livre'}</div>
                      <div className="dds-theme">Tema: {ddsData?.hoje?.tema || 'Sem tema agendado'}</div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsDdsModalOpen(true); }}
                      className="hidden sm:flex text-xs items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 px-3 py-1.5 rounded-lg font-semibold transition-colors border border-blue-500/20 shrink-0"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                      Postar DDS
                    </button>
                  </div>
                  {/* Botão Mobile */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsDdsModalOpen(true); }}
                    className="sm:hidden mt-3 w-full flex items-center justify-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 px-3 py-2 rounded-lg font-semibold transition-colors border border-blue-500/20"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                    Postar DDS
                  </button>
                </div>
              </div>
              <div className="dds-arrow absolute right-6 top-1/2 -translate-y-1/2 hidden sm:block">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </div>
          </div>

          {/* DDS AMANHÃ */}
          <div 
            className="dashboard-card cursor-pointer hover:shadow-md transition-shadow col-span-1 md:col-span-6"
            onClick={() => navigate({ to: '/seguranca/dds' })}
          >
            <div className="dds-card-content">
              <div className="dds-main">
                {ddsData?.amanha?.palestrante?.avatar ? (
                  <div className="icon-box p-0 overflow-hidden shrink-0 shadow-sm border border-gray-100/50">
                    <img src={ddsData.amanha.palestrante.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="icon-box icon-blue shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  </div>
                )}
                <div>
                  <div className="dds-label text-blue-600">DDS Amanhã</div>
                  <div className="dds-status capitalize">{ddsData?.amanha?.palestrante?.nome?.toLowerCase() || 'livre'}</div>
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
          <DashboardRemindersWidget />
          <DashboardVistoriasWidget />
        </div>

      </div>
      
      <DdsUploadModal
        isOpen={isDdsModalOpen}
        onClose={() => setIsDdsModalOpen(false)}
        tema={ddsData?.hoje?.tema || 'Sem tema agendado'}
        palestrante={ddsData?.hoje?.palestrante?.nome || 'Livre'}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['dds_dashboard'] })
        }}
      />

      {expandedImage && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[99999] p-4 cursor-zoom-out"
          onClick={() => setExpandedImage(null)}
        >
          <img src={expandedImage} alt="Expanded DDS" className="max-w-[85vw] max-h-[80vh] object-contain rounded-lg shadow-2xl" />
          <button 
            className="absolute top-20 right-6 sm:right-10 text-white p-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-md rounded-full transition-colors cursor-pointer border border-white/10 shadow-lg"
            onClick={(e) => {
              e.stopPropagation()
              setExpandedImage(null)
            }}
          >
            <X size={24} />
          </button>
        </div>
      )}
    </div>
  )
}
