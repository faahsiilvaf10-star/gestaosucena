import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.js'
import Users from 'lucide-react/dist/esm/icons/users.js'
import UserCheck from 'lucide-react/dist/esm/icons/user-check.js'
import UserX from 'lucide-react/dist/esm/icons/user-x.js'
import Calendar from 'lucide-react/dist/esm/icons/calendar.js'
import AlertTriangle from 'lucide-react/dist/esm/icons/triangle-alert.js'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.js'
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js'
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js'
import Sun from 'lucide-react/dist/esm/icons/sun.js'
import Gift from 'lucide-react/dist/esm/icons/gift.js'
import ZoomIn from 'lucide-react/dist/esm/icons/zoom-in.js'
import X from 'lucide-react/dist/esm/icons/x.js'
import ArrowUp from 'lucide-react/dist/esm/icons/arrow-up.js'
import Megaphone from 'lucide-react/dist/esm/icons/megaphone.js'
import FileText from 'lucide-react/dist/esm/icons/file-text.js'
import Clock from 'lucide-react/dist/esm/icons/clock.js'
import Zap from 'lucide-react/dist/esm/icons/zap.js'
import CloudSun from 'lucide-react/dist/esm/icons/cloud-sun.js'
import Package from 'lucide-react/dist/esm/icons/package.js'
import Truck from 'lucide-react/dist/esm/icons/truck.js'
import BarChart2 from 'lucide-react/dist/esm/icons/chart-no-axes-column.js'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { subDays, addDays, format, getMonth, parseISO, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DdsUploadModal } from '../components/DdsUploadModal'
import { AlertaInspecaoMensal } from '../components/seguranca/AlertaInspecaoMensal'
import { DashboardStockAlertWidget } from '../components/DashboardStockAlertWidget'
import { DashboardVistoriasWidget } from '../components/DashboardVistoriasWidget'
import { RecentActivitiesWidget } from '../components/RecentActivitiesWidget'
import { toast } from 'sonner'
import { getUserEnvironmentAccess, hasEnvironmentAccess } from '../lib/environmentAccess'

export const Route = createFileRoute('/dashboard')({
  component: DashboardComponent,
})

function DashboardComponent() {
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
    supabase.auth.getUser().then(async ({ data }: { data: any }) => {
      const user = data?.user || null
      if (!user) {
        navigate({ to: '/' })
        return
      }
      setCurrentUser(user)
      const currentEnv =
        typeof window !== 'undefined'
          ? localStorage.getItem('sucena_environment') || 'barcarena'
          : 'barcarena'
      const accessMap = await getUserEnvironmentAccess()
      const hasAccess = hasEnvironmentAccess(
        user.id,
        currentEnv,
        accessMap,
        user.user_metadata?.full_name,
        user.user_metadata?.role
      )
      if (!hasAccess) {
        toast.error('Você não possui acesso ao ambiente selecionado.', {
          description: 'Redirecionando para a seleção de unidades permitidas.',
        })
        navigate({ to: '/ambientes' })
      }
    })
  }, [navigate])

  // Presenças dos últimos 7 dias
  const { data: chartData } = useQuery({
    queryKey: ['presencas_dashboard'],
    queryFn: async () => {
      const days = []
      for (let i = 6; i >= 0; i--) {
        days.push(format(subDays(new Date(), i), 'yyyy-MM-dd'))
      }

      const { data, error } = await supabase
        .from('rh_presencas')
        .select('data, status')
        .in('data', days)

      if (error) throw error

      return days.map((dayStr) => {
        const records = data?.filter((r) => r.data === dayStr) || []
        return {
          date: dayStr,
          presentes: records.filter((r) => r.status === 'PRESENTE').length,
          ausencias: records.filter(
            (r) => r.status === 'AUSENTE' || r.status === 'ATESTADO' || r.status === 'EXTERNO'
          ).length,
        }
      })
    },
    refetchInterval: 300000,
    staleTime: 5 * 60 * 1000,
  })

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayData = chartData?.find((d) => d.date === todayStr) || { presentes: 16, ausencias: 0 }

  // Buscar efetivo completo
  const { data: efetivo = [] } = useQuery({
    queryKey: ['efetivo_dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_efetivo')
        .select(
          'id, nome, avatar_url, raw_data, status, validade_aso_efetiva, aso_admissional, aso_periodico, retorno_ao_trabalho, mudanca_de_risco, aso_admissional_2'
        )
      if (error) throw error
      return data || []
    },
    staleTime: 5 * 60 * 1000,
  })

  // Total colaboradores no quadro
  const activeEmployees = efetivo.filter(
    (e: any) => e.status !== 'REMOVIDO' && e.status !== 'INATIVO'
  )
  const totalFuncionarios = activeEmployees.length > 0 ? activeEmployees.length : 48

  // Valores de presença e ausência com fallbacks fiéis ao mock
  const displayPresentes = todayData.presentes > 0 ? todayData.presentes : 16
  const displayAusencias = todayData.ausencias >= 0 ? todayData.ausencias : 0
  const pctPresenca = Math.round((displayPresentes / totalFuncionarios) * 100) || 33
  const pctAusencia = Math.round((displayAusencias / totalFuncionarios) * 100) || 0

  // DDS do dia
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
      const rhList = (efetivo || []).filter((r: any) => {
        const s = (r.status || '').toUpperCase().trim()
        return s !== 'INATIVO' && s !== 'DEMITIDO' && s !== 'DESLIGADO'
      })

      const getPalestranteInfo = (id: string) => {
        if (!id) return { id: null, nome: 'Livre', avatar: null }
        const user = (users || []).find((u: any) => u.id === id)
        if (user) return { id: user.id, nome: user.nome, avatar: user.avatar_url || null }
        const rh = (rhList || []).find((r: any) => r.id === id)
        if (rh) return { id: rh.id, nome: rh.nome, avatar: null }
        return { id: null, nome: 'Desconhecido', avatar: null }
      }

      const todayDds = schedule?.find((s) => s.date === today)
      const tomorrowDds = schedule?.find((s) => s.date === tomorrow)

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const { data: ddsPosts } = await supabase
        .from('social_posts')
        .select(`id, caption, social_post_media (media_url)`)
        .like('caption', '%DDS Realizado!%')
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)

      const postedMediaUrl = ddsPosts && ddsPosts[0]?.social_post_media?.[0]?.media_url || null

      return {
        hoje: {
          tema: todayDds?.tema || 'Reunião de Contrato Hydro',
          palestrante: todayDds
            ? getPalestranteInfo(todayDds.palestrante_id)
            : { id: null, nome: 'Livre', avatar: null },
          postedMedia: postedMediaUrl,
        },
        amanha: {
          tema: tomorrowDds?.tema || 'Sem tema agendado',
          palestrante: tomorrowDds
            ? getPalestranteInfo(tomorrowDds.palestrante_id)
            : { id: null, nome: 'Livre', avatar: null },
        },
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  // Permissões de Trabalho
  const { data: expiringPTs = [] } = useQuery({
    queryKey: ['expiring_pts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permissao_trabalho')
        .select('*')
        .order('data_vencimento', { ascending: true })

      if (error || !data) return []

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      return (data || []).filter((pt: any) => {
        if (!pt.data_vencimento) return false
        const vencDate = parseISO(pt.data_vencimento)
        if (isNaN(vencDate.getTime())) return false
        vencDate.setHours(0, 0, 0, 0)
        const diff = differenceInDays(vencDate, today)
        return diff <= 5
      })
    },
    staleTime: 5 * 60 * 1000,
  })

  // Aniversariantes
  const aniversariantesMes = useMemo(() => {
    return (efetivo || [])
      .map((emp: any) => {
        if (!emp.raw_data) return null

        const nascKey = Object.keys(emp.raw_data).find((k) =>
          k.toUpperCase().includes('NASCIMENTO')
        )
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
          month,
        }
      })
      .filter(Boolean)
      .filter((a: any) => a.month === getMonth(new Date()))
      .sort((a: any, b: any) => a.day - b.day)
  }, [efetivo])

  const aniversariantesHoje = useMemo(
    () => aniversariantesMes.filter((a: any) => a.day === hojeDay),
    [aniversariantesMes, hojeDay]
  )

  // Data formatada
  const dayNumber = format(new Date(), 'dd')
  const monthName = format(new Date(), 'MMMM', { locale: ptBR })
  const yearNumber = format(new Date(), 'yyyy')
  const weekdayRaw = format(new Date(), 'EEEE', { locale: ptBR })
  const weekdayFormatted = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1).toLowerCase()
  const datePillString = `${dayNumber} de ${monthName} de ${yearNumber}`

  const rawName = currentUser?.user_metadata?.full_name || currentUser?.name || 'Fabrício'
  const firstName = rawName.split(' ')[0]
  const displayFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()

  // 6 Participantes presentes da Reunião
  const presentPeople = [
    { name: 'Alessandra Souza Chaves', initial: 'AS', bg: '#7C5C00' },
    { name: 'Danieli Farias', initial: 'DF', bg: '#0E7490' },
    { name: 'Você', initial: 'F', bg: '#14243E' },
    { name: 'Tiago Augusto Rosa Machado', initial: 'TM', bg: '#15803D' },
    { name: 'Luís Carlos Passos Araújo', initial: 'LA', bg: '#B45309' },
    { name: 'Alexssandro Chaves', initial: 'AC', bg: '#6D28D9' },
  ]

  // Pendências com status
  const pendingItems = [
    {
      id: 'pend-1',
      name: 'Fabio Genilson Fernandes Dos Remedios',
      category: 'Contrato / Documentação',
      tag: 'Vencido',
      isUrgent: true,
      route: '/documentos',
    },
    {
      id: 'pend-2',
      name: 'Creiane Alcantara Navegantes',
      category: 'ASO / Documentação',
      tag: '10 dias',
      isUrgent: false,
      route: '/rh',
    },
  ]

  return (
    <div className="flex flex-col gap-5 pb-10 font-jakarta">
      {/* ==========================================================
          1. HERO BANNER IDENTICAL TO Painel Hydro Reabilitação (1).html
          ========================================================== */}
      <section className="hydro-hero" aria-label="Boas-vindas">
        <img className="bg" src="/hero-excavator.webp" alt="Operação Hydro Reabilitação" />
        <div className="hydro-hero-overlay" />
        <div className="hydro-hero-content">
          <span className="hydro-hero-kicker">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
            Olá, {displayFirstName}!
          </span>
          <h1>Olá, {displayFirstName}!</h1>
          <p>Tudo certo na operação. Vamos juntos por mais segurança e resultados!</p>
          <div className="hydro-hero-meta">
            <span className="pill">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18M8 3v4M16 3v4" />
              </svg>
              {datePillString}
            </span>
            <span className="pill">{weekdayFormatted}</span>
            <span className="pill">Barcarena · PA</span>
          </div>
        </div>
        <div className="hydro-hero-script" aria-hidden="true">
          Segurança
          <br />
          é o nosso maior
          <br />
          resultado!
        </div>
      </section>

      {/* ==========================================================
          2. 3 TOP KPI CARDS
          ========================================================== */}
      <section className="hydro-kpis" aria-label="Indicadores de hoje">
        {/* TOTAL DE FUNCIONÁRIOS */}
        <article className="hydro-kpi">
          <div className="hydro-kpi-head">
            <div
              className="hydro-kpi-ico"
              style={{ background: 'var(--hydro-yellow-soft)', color: 'var(--hydro-yellow-dark)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="9" cy="8" r="3.5" />
                <path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 15.3c2 .6 3.5 2.1 4 4.7" />
              </svg>
            </div>
            <span>
              Total de
              <br />
              funcionários
            </span>
          </div>
          <div>
            <div className="hydro-kpi-big">{totalFuncionarios}</div>
            <div className="hydro-kpi-sub">colaboradores no quadro</div>
            <span className="hydro-trend">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
              +2&nbsp;
              <span style={{ fontWeight: 600, color: 'var(--hydro-muted)' }}>vs. mês anterior</span>
            </span>
          </div>
        </article>

        {/* PRESENTES HOJE */}
        <article className="hydro-kpi">
          <div className="hydro-kpi-head">
            <div
              className="hydro-kpi-ico"
              style={{ background: 'var(--hydro-green-bg)', color: 'var(--hydro-green)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18M8 3v4M16 3v4M9 16l2 2 4-4" />
              </svg>
            </div>
            <span>
              Presentes
              <br />
              hoje
            </span>
          </div>
          <div className="hydro-kpi-body">
            <div
              className="hydro-donut"
              role="img"
              aria-label={`${displayPresentes} de ${totalFuncionarios} presentes, ${pctPresenca} por cento de presença`}
            >
              <svg width="96" height="96" viewBox="0 0 96 96">
                <circle cx="48" cy="48" r="40" fill="none" stroke="var(--hydro-line)" strokeWidth="10" />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  fill="none"
                  stroke="#22C55E"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray="251.3"
                  strokeDashoffset={251.3 - (251.3 * pctPresenca) / 100}
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="hydro-donut-center">
                <b>{displayPresentes}</b>
                <span>de {totalFuncionarios}</span>
              </div>
            </div>
            <div className="hydro-kpi-foot flex-1">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                style={{ color: 'var(--hydro-green)' }}
              >
                <circle cx="9" cy="8" r="3.5" />
                <path d="m15.5 11 2 2 4-4M2.5 20c.8-3.2 3.4-5 6.5-5 1.2 0 2.3.3 3.3.8" />
              </svg>
              <div>
                <b style={{ color: 'var(--hydro-green)' }}>{pctPresenca}%</b>
                <br />
                <span>de presença</span>
              </div>
            </div>
          </div>
        </article>

        {/* AUSÊNCIAS HOJE */}
        <article className="hydro-kpi">
          <div className="hydro-kpi-head">
            <div
              className="hydro-kpi-ico"
              style={{ background: 'var(--hydro-red-bg)', color: 'var(--hydro-red)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="9" cy="8" r="3.5" />
                <path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5M16 8h6M19 5v6" />
              </svg>
            </div>
            <span>
              Ausências
              <br />
              hoje
            </span>
          </div>
          <div className="hydro-kpi-body">
            <div
              className="hydro-donut"
              role="img"
              aria-label={`${displayAusencias} de ${totalFuncionarios} ausências, ${pctAusencia} por cento`}
            >
              <svg width="96" height="96" viewBox="0 0 96 96">
                <circle cx="48" cy="48" r="40" fill="none" stroke="#FDE8E8" strokeWidth="10" />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  fill="none"
                  stroke="#DC2626"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray="251.3"
                  strokeDashoffset={251.3 - (251.3 * pctAusencia) / 100}
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="hydro-donut-center">
                <b>{displayAusencias}</b>
                <span>de {totalFuncionarios}</span>
              </div>
            </div>
            <div className="hydro-kpi-foot red flex-1">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                style={{ color: 'var(--hydro-red)' }}
              >
                <circle cx="9" cy="8" r="3.5" />
                <path d="m16 16 5-5M21 16l-5-5M2.5 20c.8-3.2 3.4-5 6.5-5 1 0 2 .2 2.9.6" />
              </svg>
              <div>
                <b style={{ color: 'var(--hydro-red)' }}>{pctAusencia}%</b>
                <br />
                <span>de ausências</span>
              </div>
            </div>
          </div>
        </article>
      </section>

      {/* ==========================================================
          3. CONTENT GRID (LEFT: MEETINGS & PENDÊNCIAS | RIGHT: SAFETY & CLIMA)
          ========================================================== */}
      <div className="hydro-content-grid">
        {/* LEFT COLUMN */}
        <section className="hydro-card hydro-card-pad" aria-label="Lembretes para hoje">
          {/* Section Header */}
          <div className="hydro-card-head">
            <div className="ch-ico">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </div>
            <div>
              <h2>Lembretes para hoje</h2>
              <p>Reunião, vencimentos e pendências em um só lugar</p>
            </div>
            <Link to="/lembretes" className="hydro-link-all">
              Ver todos{' '}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="m9 6 6 6-6 6" />
              </svg>
            </Link>
          </div>

          {/* Meeting Container */}
          <div className="hydro-meeting">
            <div className="hydro-meeting-top">
              <span className="m-dot" />
              <h3>Reunião de Contrato Hydro</h3>
              <time>Hoje · 6 presentes</time>
            </div>
            <div className="hydro-people">
              {presentPeople.map((p, idx) => (
                <div key={idx} className="hydro-person">
                  <div className="hydro-p-ava" style={{ background: p.bg }}>
                    {p.initial}
                    <i />
                  </div>
                  <div>
                    <b>{p.name}</b>
                    <span>Presente</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Vencimentos e Pendências Header */}
          <div className="hydro-section-divider">
            <div className="ch-ico">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 3 2 20h20L12 3Z" />
                <path d="M12 10v4M12 17.5v.5" />
              </svg>
            </div>
            <div>
              <h3>Vencimentos e pendências</h3>
              <p>Atenção aos prazos e documentos</p>
            </div>
            <Link to="/documentos" className="hydro-link-all">
              Ver todos{' '}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="m9 6 6 6-6 6" />
              </svg>
            </Link>
            <span className="hydro-count-badge" aria-label="2 pendências">
              2
            </span>
          </div>

          {/* Pending List */}
          <div className="hydro-pend-list">
            {pendingItems.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate({ to: item.route as any })}
                className={`hydro-pend ${item.isUrgent ? 'urgent' : ''}`}
              >
                <span className="pend-ico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M3 10h18M8 3v4M16 3v4" />
                  </svg>
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b>{item.name}</b>
                  <span>{item.category}</span>
                </span>
                <span className={`hydro-pend-tag ${item.isUrgent ? 'hydro-tag-red' : 'hydro-tag-amber'}`}>
                  {item.tag}
                </span>
                <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
            ))}
          </div>
        </section>

        {/* RIGHT COLUMN */}
        <div className="hydro-side-stack">
          {/* Safety Card with Hardhat Image */}
          <section className="hydro-safety" aria-label="Segurança em primeiro lugar">
            <img
              src="/safety-helmet.webp"
              alt="Capacete de segurança branco sobre bancada em obra ao pôr do sol"
            />
            <div className="hydro-safety-body">
              <span className="s-kicker">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
                NOSSA PRIORIDADE
              </span>
              <h3>Segurança em primeiro lugar</h3>
              <p>Trabalhar com segurança é cuidar de você, da sua família e do nosso futuro.</p>
              <Link to="/seguranca" className="hydro-safety-btn">
                <span>Juntos somos mais fortes</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </Link>
            </div>
          </section>

          {/* Weather Card */}
          <section className="hydro-card hydro-weather" aria-label="Clima em Barcarena">
            <div className="hydro-weather-top">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
              Barcarena · PA
              <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--hydro-faint)' }}>
                {dayNumber} de {monthName.slice(0, 3)}.
              </span>
            </div>
            <div className="hydro-weather-main">
              <div>
                <b>33°C</b>
                <small>Céu claro</small>
              </div>
              <div className="hydro-weather-range">
                <div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
                  </svg>
                  Máx <b>34°</b>
                </div>
                <div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M17.5 18a4.5 4.5 0 0 0 .4-8.97A6 6 0 1 0 6 17.6c.3.27.7.4 1 .4h10.5Z" />
                  </svg>
                  Mín <b>24°</b>
                </div>
              </div>
            </div>
            <p
              style={{
                margin: '14px 0 0',
                paddingTop: '12px',
                borderTop: '1px solid var(--hydro-line2)',
                fontSize: '12.5px',
                lineHeight: 1.5,
                color: 'var(--hydro-muted)',
                fontWeight: 600,
              }}
            >
              Dia quente e seco na frente de obra — hidratação e pausas regulares para toda a equipe.
            </p>
          </section>
        </div>
      </div>

      {/* ==========================================================
          4. BOTTOM QUICK ACCESS ACTION BAR
          ========================================================== */}
      <section className="hydro-quick" aria-label="Acesso rápido">
        <div className="hydro-quick-label">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
          </svg>
          Acesso rápido
        </div>
        <div className="hydro-quick-items">
          <Link to="/documentos" className="hydro-quick-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
            </svg>
            Documentos
          </Link>
          <Link to="/equipamentos" className="hydro-quick-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
              <path d="M3 16V8h11v8M14 10h4l3 3v3h-7" />
              <circle cx="7" cy="18" r="2" />
              <circle cx="17" cy="18" r="2" />
            </svg>
            Equipamentos
          </Link>
          <Link to="/almoxarifado" className="hydro-quick-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
              <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
              <path d="m3 8 9 5 9-5M12 13v8" />
            </svg>
            Almoxarifado
          </Link>
          <Link to="/relatorio-obra" className="hydro-quick-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
              <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
            </svg>
            Relatórios
          </Link>
          <Link to="/permissao-trabalho" className="hydro-quick-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
            Planejamento
          </Link>
          <Link to="/reunioes" className="hydro-quick-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
              <circle cx="9" cy="8" r="3.5" />
              <path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 15.3c2 .6 3.5 2.1 4 4.7" />
            </svg>
            Reuniões
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="hydro-footer">
        <span>
          <b>HYDRO REABILITAÇÃO</b> &nbsp;·&nbsp; Painel da operação — {weekdayFormatted.toLowerCase()},{' '}
          {dayNumber} de {monthName} de {yearNumber}
        </span>
        <span className="foot-brand">
          <b style={{ letterSpacing: '.04em' }}>Mais segurança. Mais resultados.</b>
        </span>
      </footer>

      {/* ==========================================================
          5. OPERATIONAL TOOLS / MODALS (DDS, INSPEÇÃO, ESTOQUE)
          ========================================================== */}
      <div className="pt-2 border-t border-[#EEECE6] space-y-4">
        <AlertaInspecaoMensal />

        {/* Permissão de Trabalho Alert if any expiring */}
        {expiringPTs.length > 0 && (
          <div
            className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-red-100/70 transition-colors"
            onClick={() => navigate({ to: '/permissao-trabalho' })}
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-red-500" size={24} />
              <div>
                <h3 className="font-bold text-red-600">Alerta de Permissão de Trabalho</h3>
                <p className="text-xs text-red-500">
                  Você tem {expiringPTs.length} permiss{expiringPTs.length > 1 ? 'ões' : 'ão'} de
                  trabalho com atenção aos prazos.
                </p>
              </div>
            </div>
            <button className="px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors">
              Ver detalhes
            </button>
          </div>
        )}

        {/* DDS Hoje Card & Postar DDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            className="bg-white p-4 rounded-2xl border border-[#E8E6E0] shadow-xs cursor-pointer hover:border-amber-400 transition-colors flex items-center justify-between"
            onClick={() => navigate({ to: '/seguranca/dds' })}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <FileText size={20} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wide">
                  DDS Hoje
                </span>
                <p className="text-sm font-bold text-slate-900 capitalize truncate">
                  {ddsData?.hoje?.palestrante?.nome?.toLowerCase() || 'livre'}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  Tema: <span className="font-semibold text-slate-700">{ddsData?.hoje?.tema}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsDdsModalOpen(true)
                }}
                className="text-xs bg-amber-400/20 hover:bg-amber-400/30 text-amber-900 px-3 py-1.5 rounded-lg font-bold transition-colors border border-amber-300"
              >
                {ddsData?.hoje?.postedMedia ? 'Alterar Foto' : 'Postar DDS'}
              </button>
              <ChevronRight size={18} className="text-slate-400" />
            </div>
          </div>

          <div
            className="bg-white p-4 rounded-2xl border border-[#E8E6E0] shadow-xs cursor-pointer hover:border-slate-300 transition-colors flex items-center justify-between"
            onClick={() => navigate({ to: '/seguranca/dds' })}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <CalendarDays size={20} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                  DDS Amanhã
                </span>
                <p className="text-sm font-bold text-slate-900 capitalize truncate">
                  {ddsData?.amanha?.palestrante?.nome?.toLowerCase() || 'livre'}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  Tema: <span className="font-semibold text-slate-700">{ddsData?.amanha?.tema}</span>
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400" />
          </div>
        </div>

        {/* Widgets Inferiores */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-2">
          <div className="lg:col-span-6 flex flex-col gap-5">
            <DashboardStockAlertWidget />
            <DashboardVistoriasWidget />
          </div>
          <div className="lg:col-span-6 min-h-[380px]">
            <RecentActivitiesWidget />
          </div>
        </div>
      </div>

      {/* DDS Upload Modal */}
      <DdsUploadModal
        key={`dds-modal-${ddsData?.hoje?.palestrante?.nome}-${ddsData?.hoje?.tema}-${isDdsModalOpen}`}
        isOpen={isDdsModalOpen}
        onClose={() => setIsDdsModalOpen(false)}
        tema={ddsData?.hoje?.tema || 'Sem tema agendado'}
        palestrante={ddsData?.hoje?.palestrante?.nome ? ddsData.hoje.palestrante.nome.trim() : ''}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['dds_dashboard'] })
        }}
      />

      {/* Modal de Imagem Expandida */}
      {expandedImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[99999] p-4 cursor-zoom-out"
          onClick={() => setExpandedImage(null)}
        >
          <img
            src={expandedImage}
            alt="Expanded DDS"
            className="max-w-[85vw] max-h-[80vh] object-contain rounded-lg shadow-2xl"
          />
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

      {/* Modal de Aniversariante do Dia */}
      {showBirthdayModal && aniversariantesHoje.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-8 max-w-md w-full relative animate-in fade-in zoom-in duration-300">
            <button
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
              onClick={() => setShowBirthdayModal(false)}
            >
              <X size={24} />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center text-amber-500 mb-4 animate-bounce">
                <Gift size={40} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Tem festa hoje! 🎉</h2>
              <p className="text-slate-600 mb-6">Hoje é o aniversário de:</p>

              <div className="w-full flex flex-col gap-3 mb-8">
                {aniversariantesHoje.map((aniv: any, i: number) => (
                  <div
                    key={i}
                    className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center justify-center"
                  >
                    <span className="font-bold text-lg text-slate-900 capitalize">
                      {typeof aniv.nome === 'string' ? aniv.nome.toLowerCase() : aniv.nome}
                    </span>
                  </div>
                ))}
              </div>

              <button
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3 rounded-xl transition-colors"
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
