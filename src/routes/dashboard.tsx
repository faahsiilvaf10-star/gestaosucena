import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { DashboardRemindersWidget } from '../components/DashboardRemindersWidget'
import { DashboardVistoriasWidget } from '../components/DashboardVistoriasWidget'
import { RecentActivitiesWidget } from '../components/RecentActivitiesWidget'
import { useTheme } from '../contexts/ThemeContext'
import { CalendarDays, Gift, MapPin, X, AlertTriangle } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { subDays, addDays, format, getMonth, parseISO, differenceInDays } from 'date-fns'
import '../dashboard.css'
import { DdsUploadModal } from '../components/DdsUploadModal'
import { AlertaInspecaoMensal } from '../components/seguranca/AlertaInspecaoMensal'

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
  const [showBirthdayModal, setShowBirthdayModal] = useState(false)
  
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
        .select('id, date, tema, palestrante_id')
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

  // Buscar Permissões de Trabalho (PTs) vencendo em até 5 dias ou vencidas
  const { data: expiringPTs = [] } = useQuery({
    queryKey: ['expiring_pts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permissao_trabalho')
        .select('*')
        .order('data_vencimento', { ascending: true })
      
      if (error) return []
      
      const today = new Date()
      today.setHours(0,0,0,0)
      
      return data.filter((pt: any) => {
        const vencDate = parseISO(pt.data_vencimento)
        vencDate.setHours(0,0,0,0)
        const diff = differenceInDays(vencDate, today)
        return diff <= 5 // Vencendo em 5 dias ou menos (inclui vencidas)
      })
    }
  })

  // Buscar efetivo completo para contagem e aniversariantes/ASO
  const { data: efetivo = [] } = useQuery({
    queryKey: ['efetivo_dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('rh_efetivo').select('nome, raw_data, status, validade_aso_efetiva')
      if (error) throw error
      return data || []
    }
  })
  
  const totalFuncionarios = efetivo.filter((e: any) => e.status !== 'REMOVIDO' && e.status !== 'INATIVO').length || '...'

  // Buscar equipamentos
  const { data: eqData } = useQuery({
    queryKey: ['equipments_dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eq_equipments').select('location_status, last_exit_reason, name, plate_tag, type, category, updated_at').eq('environment', typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena')
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

  const aniversariantesHoje = aniversariantesMes.filter((a: any) => a.day === hojeDay)

  useEffect(() => {
    if (aniversariantesHoje.length > 0) {
      const alreadyShown = sessionStorage.getItem('birthday_modal_shown_today')
      if (!alreadyShown) {
        setShowBirthdayModal(true)
        sessionStorage.setItem('birthday_modal_shown_today', 'true')
      }
    }
  }, [aniversariantesHoje.length])

  // Calcular ASO vencendo em 10 dias ou menos (ou já vencidos)
  const asoVencendo = (efetivo || [])
    .filter((emp: any) => emp.status !== 'REMOVIDO' && emp.status !== 'INATIVO' && emp.validade_aso_efetiva)
    .map((emp: any) => {
      const parts = emp.validade_aso_efetiva.split('-')
      if (parts.length !== 3) return null
      
      const validade = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
      const hoje = new Date()
      hoje.setHours(0,0,0,0)
      
      const diffTime = validade.getTime() - hoje.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays <= 10) {
        return {
          nome: emp.nome,
          diasRestantes: diffDays,
          validadeFormatada: `${parts[2]}/${parts[1]}/${parts[0]}`
        }
      }
      return null
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.diasRestantes - b.diasRestantes)

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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 mt-2 px-2 sm:px-0">
          <div>
            <h1
              className={`tracking-tight ${isDark ? 'text-white' : 'text-gray-900 drop-shadow-none'}`}
              style={{ fontSize: 'clamp(32px, 8vw, 54px)', lineHeight: '1' }}
            >
              Olá, <span>{displayFirstName}</span>!
            </h1>
            <p className={`text-sm mt-1 ml-0.5 font-medium ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
              Visão geral da operação
            </p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className={`flex flex-col items-end gap-1 font-evantic tracking-wide ${isDark ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]' : 'text-gray-900'}`}>
              <div className="flex items-center gap-2" style={{ fontSize: 'clamp(14px, 4vw, 18px)' }}>
                <CalendarDays size={18} className={`flex-shrink-0 ${isDark ? 'opacity-80' : 'opacity-60'}`} />
                <span className="sm:hidden">{currentDateShort}</span>
                <span className="hidden sm:inline">{currentDate}</span>
              </div>
              <div className={`hidden sm:flex gap-3 text-[9px] tracking-[0.2em] font-sans mt-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                <span className={`cursor-pointer transition-colors border-b pb-1 ${isDark ? 'hover:text-white border-[#00d2ff] text-white' : 'hover:text-gray-900 border-gray-900 text-gray-900'}`}>PESSOAS</span>
                <span className={isDark ? 'text-slate-600' : 'text-gray-300'}>•</span>
                <span className={`cursor-pointer transition-colors ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`}>OPERAÇÃO</span>
                <span className={isDark ? 'text-slate-600' : 'text-gray-300'}>•</span>
                <span className={`cursor-pointer transition-colors ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`}>RESULTADOS</span>
              </div>
            </div>
            
            <div className={`hidden md:flex flex-col text-[9px] tracking-[0.2em] font-sans border-l pl-5 opacity-80 ${isDark ? 'text-slate-500 border-white/10' : 'text-gray-400 border-gray-200'}`}>
              <span>GRANDES</span>
              <span>PESSOAS</span>
              <span>MOVEM</span>
              <span>RESULTADOS</span>
            </div>
          </div>
        </div>

        {/* ===== ALERTA DE INSPEÇÃO MENSAL DE CINTAS ===== */}
        <div className="mb-2">
          <AlertaInspecaoMensal />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 pb-12">
          
          {/* ALERTA PT VENCENDO */}
          {expiringPTs.length > 0 && (
            <div className="col-span-1 md:col-span-12 dashboard-card bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-red-500/20 transition-colors" onClick={() => navigate({ to: '/permissao-trabalho' })}>
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-red-500" size={24} />
                <div>
                  <h3 className="font-bold text-red-500 dark:text-red-400">Alerta de Permissão de Trabalho</h3>
                  <p className="text-sm text-red-600 dark:text-red-300">Você tem {expiringPTs.length} permiss{expiringPTs.length > 1 ? 'ões' : 'ão'} de trabalho vencendo nos próximos 5 dias ou já vencida(s).</p>
                </div>
              </div>
              <button className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors">
                Ver detalhes
              </button>
            </div>
          )}
          
          {/* TOTAL FUNCIONARIOS */}
          <div className="dashboard-card neon-card neon-blue col-span-1 md:col-span-4 relative pb-8">
            <div className="card-header relative z-10">
              <div className="card-title-wrap">
                <div className={!isDark ? "flex-shrink-0" : "icon-box icon-blue"}>
                  {!isDark ? <img src="/icons/users_total.png" alt="Users" className="w-12 h-12 object-contain drop-shadow-sm" /> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
                </div>
                <h3 className="card-title">TOTAL DE FUNCIONÁRIOS</h3>
              </div>
              <button className="card-menu">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              </button>
            </div>
            <div className="big-number relative z-10">{totalFuncionarios}</div>
            <div className="big-number-label relative z-10">colaboradores</div>
            
            {/* Elemento visual do canto inferior direito */}
            <svg className="employee-decoration relative z-10" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>

            {isDark && (
              <div className="card-footer">
                <span className="footer-line"></span>
                <span className="footer-text">NOSSO MAIOR ATIVO</span>
              </div>
            )}
          </div>

          {/* PRESENÇA */}
          <div className="dashboard-card neon-card neon-green col-span-1 md:col-span-4 pb-8">
            <div className="card-header">
              <div className="card-title-wrap">
                <div className={!isDark ? "flex-shrink-0" : "icon-box icon-green"}>
                  {!isDark ? <img src="/icons/users.png" alt="Presentes" className="w-12 h-12 object-contain drop-shadow-sm" /> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
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
                <div className="flex items-center gap-2">
                  <strong>{pctPresenca}%</strong>
                  {isDark && (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="18" y="4" width="4" height="16" rx="1" />
                      <rect x="10" y="10" width="4" height="10" rx="1" />
                      <rect x="2" y="16" width="4" height="4" rx="1" />
                    </svg>
                  )}
                </div>
                <span>de presença</span>
              </div>
            </div>
            {isDark && (
              <div className="card-footer" style={{ right: '16px', left: 'auto' }}>
                <span className="footer-text">PESSOAS FAZEM A DIFERENÇA</span>
              </div>
            )}
          </div>

          {/* AUSÊNCIAS */}
          <div className="dashboard-card neon-card neon-red col-span-1 md:col-span-4 pb-8">
            <div className="card-header">
              <div className="card-title-wrap">
                <div className={!isDark ? "flex-shrink-0" : "icon-box icon-red"}>
                  {!isDark ? <img src="/icons/user_x.png" alt="Ausências" className="w-12 h-12 object-contain drop-shadow-sm" /> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="23" y2="14"/><line x1="23" y1="8" x2="17" y2="14"/></svg>}
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
                <div className="flex items-center gap-2">
                  <strong>{pctAusencia}%</strong>
                  {isDark && (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="18" y="4" width="4" height="16" rx="1" />
                      <rect x="10" y="10" width="4" height="10" rx="1" />
                      <rect x="2" y="16" width="4" height="4" rx="1" />
                    </svg>
                  )}
                </div>
                <span>de ausências</span>
              </div>
            </div>
            {isDark && (
              <div className="card-footer" style={{ right: '16px', left: 'auto' }}>
                <span className="footer-text">ACOMPANHAMENTO CONTÍNUO</span>
              </div>
            )}
          </div>

          {/* ASO VENCENDO */}
          <div className="dashboard-card neon-card neon-red col-span-1 md:col-span-3 pb-8">
            <div className="card-header">
              <div className="card-title-wrap">
                <div className={!isDark ? "flex-shrink-0" : "icon-box icon-red"}>
                  {!isDark ? <img src="/icons/alert.png" alt="ASO" className="w-12 h-12 object-contain drop-shadow-sm" /> : <AlertTriangle size={20} className="animate-pulse" />}
                </div>
                <h3 className="card-title">VENCIMENTO ASO</h3>
              </div>
              <button className="card-menu">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              </button>
            </div>
            <div className="birthday-list">
              {asoVencendo.length > 0 ? (
                asoVencendo.slice(0, 3).map((aso: any, idx: number) => (
                  <div key={idx} className="birthday-item" style={{ borderColor: aso.diasRestantes <= 0 ? 'rgba(239, 68, 68, 0.3)' : '' }}>
                    <span className={`birthday-name capitalize ${aso.diasRestantes <= 0 ? 'text-red-500 font-bold' : ''}`}>
                      {typeof aso.nome === 'string' ? aso.nome.toLowerCase() : aso.nome}
                    </span>
                    <span className={`birthday-day text-xs font-bold ${aso.diasRestantes <= 0 ? 'text-red-500' : aso.diasRestantes <= 5 ? 'text-orange-500' : 'text-yellow-500'}`}>
                      {aso.diasRestantes < 0 ? `Vencido` : aso.diasRestantes === 0 ? 'Vence Hoje' : `${aso.diasRestantes} dias`}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500 text-center mt-4">Nenhum ASO próximo do vencimento</div>
              )}
            </div>
            {isDark && (
              <div className="card-footer">
                <span className="footer-text">🏥 SAÚDE OCUPACIONAL</span>
              </div>
            )}
          </div>

          {/* ANIVERSARIANTE DO DIA */}
          {aniversariantesHoje.length > 0 && (
          <div className="dashboard-card neon-card neon-yellow col-span-1 md:col-span-3 pb-8">
            <div className="card-header">
              <div className="card-title-wrap">
                <div className={!isDark ? "flex-shrink-0" : "icon-box icon-yellow"}>
                  {!isDark ? <img src="/icons/gift.png" alt="Presente" className="w-12 h-12 object-contain drop-shadow-sm" /> : <Gift size={20} />}
                </div>
                <h3 className="card-title">ANIVERSARIANTE DO DIA</h3>
              </div>
              <button className="card-menu">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              </button>
            </div>
            <div className="birthday-list">
              {aniversariantesHoje.length > 0 ? (
                aniversariantesHoje.map((aniv: any, idx: number) => (
                  <div key={idx} className="birthday-item active">
                    <span className="birthday-name capitalize">{typeof aniv.nome === 'string' ? aniv.nome.toLowerCase() : aniv.nome}</span>
                    <span className="birthday-day font-bold text-yellow-500">HOJE! 🎉</span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500 text-center mt-4">Nenhum hoje</div>
              )}
            </div>
            {isDark && (
              <div className="card-footer">
                <span className="footer-text">🎈 PARABÉNS!</span>
              </div>
            )}
          </div>
          )}

          {/* ANIVERSARIANTES DO MÊS */}
          <div className="dashboard-card neon-card neon-purple col-span-1 md:col-span-3 pb-8">
            <div className="card-header">
              <div className="card-title-wrap">
                <div className={!isDark ? "flex-shrink-0" : "icon-box icon-purple"}>
                  {!isDark ? <img src="/icons/gift.png" alt="Presente" className="w-12 h-12 object-contain drop-shadow-sm" /> : <Gift size={20} />}
                </div>
                <h3 className="card-title">ANIVERSARIANTES DO MÊS</h3>
              </div>
              <button className="card-menu">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              </button>
            </div>
            <div className="birthday-list">
              {aniversariantesMes.length > 0 ? (
                aniversariantesMes.map((aniv: any, idx: number) => (
                  <div key={idx} className={`birthday-item ${aniv.day === hojeDay ? 'active' : ''}`}>
                    <span className="birthday-name capitalize">{typeof aniv.nome === 'string' ? aniv.nome.toLowerCase() : aniv.nome}</span>
                    <span className="birthday-day">Dia {String(aniv.day).padStart(2, '0')}</span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500 text-center mt-4">Nenhum neste mês</div>
              )}
            </div>
            {isDark && (
              <div className="card-footer">
                <span className="footer-text">🎂 VIDAS QUE FAZEM PARTE DESSA HISTÓRIA</span>
              </div>
            )}
          </div>

          {/* OPERAÇÃO */}
          <div 
            className="dashboard-card neon-card neon-blue group !overflow-visible hover:z-50 col-span-1 md:col-span-12 pb-8 cursor-pointer"
            onClick={() => navigate({ to: '/equipamentos' })}
          >
            {/* Tooltip Em Operação */}
            <div className="absolute top-0 left-0 w-full h-full z-10 hidden group-hover:block" />
            <div className="absolute top-[105%] left-1/4 -translate-x-1/2 w-56 sm:w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 p-3 max-h-[400px] overflow-y-auto custom-scrollbar">
              <h4 className="text-sm font-light mb-2 text-gray-900 dark:text-white border-b border-gray-100 dark:border-white/10 pb-2">Em Operação</h4>
              {eqData?.operacaoList?.length ? (
                <ul className="text-xs space-y-2">
                  {eqData.operacaoList.map((eq: any, i: number) => (
                    <li key={i} className="flex flex-col border-b border-gray-50 dark:border-white/5 pb-1 last:border-0">
                      <div className="flex justify-between items-center">
                        <span className="font-light text-blue-600 dark:text-blue-400 uppercase">{eq.plate_tag || 'S/N'}</span>
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
                <div className={!isDark ? "flex-shrink-0" : "icon-box icon-blue"}>
                  {!isDark ? <img src="/icons/layers.png" alt="Operação" className="w-12 h-12 object-contain drop-shadow-sm" /> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>}
                </div>
                <h3 className="card-title">EM OPERAÇÃO</h3>
              </div>
              <button className="card-menu">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="donut-wrapper">
              <div className="donut" style={{ "--value": pctOperacao, "--accent": "var(--blue)", "--track": "rgba(22, 119, 255, 0.15)" } as any}>
                <div className="donut-content">
                  <div className="donut-number">{eqData?.operacao || 0}</div>
                  <div className="donut-total">de {totalVehiclesNum}</div>
                </div>
              </div>
              <div className="percent-box percent-blue">
                <div className="flex items-center gap-2">
                  <strong>{pctOperacao}%</strong>
                  {isDark && (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="18" y="4" width="4" height="16" rx="1" />
                      <rect x="10" y="10" width="4" height="10" rx="1" />
                      <rect x="2" y="16" width="4" height="4" rx="1" />
                    </svg>
                  )}
                </div>
                <span>em operação</span>
              </div>
            </div>
            <div className="border-t border-blue-200/60 dark:border-white/10 pt-6 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
          {/* MANUTENÇÃO */}
            {/* Tooltip Em Manutenção */}
            <div className="absolute top-0 left-0 w-full h-full z-10 hidden group-hover:block" />
            <div className="absolute top-[105%] left-3/4 -translate-x-1/2 w-56 sm:w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 p-3 max-h-[400px] overflow-y-auto custom-scrollbar">
              <h4 className="text-sm font-light mb-2 text-gray-900 dark:text-white border-b border-gray-100 dark:border-white/10 pb-2">Em Manutenção</h4>
              {eqData?.manutencaoList?.length ? (
                <ul className="text-xs space-y-2">
                  {eqData.manutencaoList.map((eq: any, i: number) => (
                    <li key={i} className="flex flex-col border-b border-gray-50 dark:border-white/5 pb-2 last:border-0">
                      <div className="flex justify-between items-center">
                        <span className="font-light text-orange-600 dark:text-orange-400 uppercase">{eq.plate_tag || 'S/N'}</span>
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
                <div className={!isDark ? "flex-shrink-0" : "icon-box icon-orange"}>
                  {!isDark ? <img src="/icons/wrench.png" alt="Manutenção" className="w-12 h-12 object-contain drop-shadow-sm" /> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>}
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
                <div className="flex items-center gap-2">
                  <strong>{pctManutencao}%</strong>
                  {isDark && (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="18" y="4" width="4" height="16" rx="1" />
                      <rect x="10" y="10" width="4" height="10" rx="1" />
                      <rect x="2" y="16" width="4" height="4" rx="1" />
                    </svg>
                  )}
                </div>
                <span>em manutenção</span>
              </div>
            </div>
            {isDark && (
              <div className="card-footer">
                <span className="footer-text">⚙️ OPERAÇÃO EM MOVIMENTO</span>
              </div>
            )}
          </div>
            </div>
          </div>

          {/* ALERTA DDS (SÓ SE O USUÁRIO FOR O PALESTRANTE) */}
          {currentUser?.id === ddsData?.hoje?.palestrante?.id && (
            <div className="col-span-1 md:col-span-12 flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-6 rounded-2xl bg-[#0f172a] text-white border border-[#1e293b] gap-4 mb-2">
               <div className="flex flex-col gap-3">
                 <div className="flex items-center gap-2 text-blue-400 font-light text-lg">
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
                   <span className="font-light text-white text-sm">Prepare-se!</span>
                   <span className="text-slate-400 text-sm">Revise o tema com antecedência</span>
                 </div>
               </div>
            </div>
          )}

          {currentUser?.id === ddsData?.amanha?.palestrante?.id && currentUser?.id !== ddsData?.hoje?.palestrante?.id && (
            <div className="col-span-1 md:col-span-12 flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-6 rounded-2xl bg-[#0f172a] text-white border border-[#1e293b] gap-4 mb-2">
               <div className="flex flex-col gap-3">
                 <div className="flex items-center gap-2 text-blue-400 font-light text-lg">
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
                   <span className="font-light text-white text-sm">Prepare-se!</span>
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
                      className="hidden sm:flex text-xs items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 px-3 py-1.5 rounded-lg font-light transition-colors border border-blue-500/20 shrink-0"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                      Postar DDS
                    </button>
                  </div>
                  {/* Botão Mobile */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsDdsModalOpen(true); }}
                    className="sm:hidden mt-3 w-full flex items-center justify-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 px-3 py-2 rounded-lg font-light transition-colors border border-blue-500/20"
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
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 mt-6">
          <div className="lg:col-span-6 flex flex-col gap-4 sm:gap-6">
            <div className="flex-1"><DashboardRemindersWidget /></div>
            <div className="flex-1"><DashboardVistoriasWidget /></div>
          </div>
          <div className="lg:col-span-6 h-full min-h-[400px]">
            <RecentActivitiesWidget />
          </div>
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

      {/* MODAL DE ANIVERSARIANTE DO DIA */}
      {showBirthdayModal && aniversariantesHoje.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl p-8 max-w-md w-full relative animate-in fade-in zoom-in duration-300">
            <button 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
              onClick={() => setShowBirthdayModal(false)}
            >
              <X size={24} />
            </button>
            
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-500 mb-4 animate-bounce">
                <Gift size={40} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Tem festa hoje! 🎉</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Hoje é o aniversário de:
              </p>
              
              <div className="w-full flex flex-col gap-3 mb-8">
                {aniversariantesHoje.map((aniv: any, i: number) => (
                  <div key={i} className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl p-4 flex items-center justify-center">
                    <span className="font-bold text-lg text-gray-800 dark:text-white capitalize">
                      {typeof aniv.nome === 'string' ? aniv.nome.toLowerCase() : aniv.nome}
                    </span>
                  </div>
                ))}
              </div>
              
              <button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors"
                onClick={() => setShowBirthdayModal(false)}
              >
                Legal! Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
