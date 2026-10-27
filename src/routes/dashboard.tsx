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

/**
 * Donut Gauge SVG circular limpo e sem distorções
 */
function DonutGauge({
  value,
  total,
  color,
  trackColor,
  size = 88,
  strokeWidth = 9,
}: {
  value: number
  total: number
  color: string
  trackColor: string
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const percentage = total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
        <span className="text-[22px] font-extrabold text-slate-900 dark:text-white tracking-tight">
          {value}
        </span>
        <span className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
          de {total}
        </span>
      </div>
    </div>
  )
}

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

      if (error) return []

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      return data.filter((pt: any) => {
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

  // Data formatada exata: "27 de outubro de 2026 | Terça-Feira"
  const dayNumber = format(new Date(), 'dd')
  const monthName = format(new Date(), 'MMMM', { locale: ptBR })
  const yearNumber = format(new Date(), 'yyyy')
  const weekdayRaw = format(new Date(), 'EEEE', { locale: ptBR })
  const weekdayFormatted = weekdayRaw
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('-')
  const dateHeaderString = `${dayNumber} de ${monthName} de ${yearNumber}  |  ${weekdayFormatted}`

  const rawName = currentUser?.user_metadata?.full_name || currentUser?.name || 'Fabrício'
  const firstName = rawName.split(' ')[0]
  const displayFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()

  // Lista de colaboradores do carrossel da foto
  const presentColaboradores = [
    { id: '1', nome: 'Alessandra Souza Chaves' },
    { id: '2', nome: 'Danieli Farias' },
    { id: '3', nome: 'Você' },
    { id: '4', nome: 'Tiago Augusto Rosa machado' },
    { id: '5', nome: 'Luis Carlos Passos Araújo' },
    { id: '6', nome: 'Alexsandro Chaves' },
  ]

  // Pendências
  const pendenciasMock = [
    {
      id: 'p1',
      nome: 'Fabio Genilson Fernandes Dos Remedios',
      categoria: 'Contrato / Documentação',
      status: 'Vencido',
      isDanger: true,
      route: '/documentos',
    },
    {
      id: 'p2',
      nome: 'Creiane Alcantara Navegantes',
      categoria: 'ASO / Documentação',
      status: '10 dias',
      isDanger: false,
      route: '/rh',
    },
  ]

  return (
    <div className="space-y-6 pb-12 selection:bg-amber-500/30">
      {/* ==========================================================
          1. HERO BANNER CLARO (PANORAMA + ESCAVADEIRA + LEMA)
          ========================================================== */}
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-xs border border-slate-200/70 dark:border-white/10 min-h-[145px] sm:min-h-[155px] flex items-center bg-[#FAF9F5] dark:bg-[#111827]">
        {/* Background Image: Panorama with Excavator & Mountain Sky */}
        <div
          className="absolute inset-0 bg-cover bg-right sm:bg-center"
          style={{
            backgroundImage: `url('/layout/hydro-hero-banner-light.png')`,
            backgroundPosition: 'right center',
          }}
        />

        {/* Subtle soft white gradient on left for crisp readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-transparent dark:from-[#111827]/95 dark:via-[#111827]/80 dark:to-transparent" />

        {/* Banner Content */}
        <div className="relative z-10 w-full px-5 sm:px-8 py-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Left Column: Greeting & Date */}
          <div className="max-w-xl">
            <div className="flex items-center gap-3">
              {/* Sun Icon with Rays in Golden Yellow */}
              <div className="w-10 h-10 rounded-full bg-amber-400/15 flex items-center justify-center text-amber-500 shrink-0">
                <Sun size={26} strokeWidth={2.2} className="text-amber-500" />
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white tracking-tight">
                Olá, {displayFirstName}!
              </h1>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2 font-medium leading-relaxed">
              Tudo certo na operação. Vamos juntos por mais segurança e resultados!
            </p>

            {/* Date line with Calendar Icon */}
            <div className="flex items-center gap-2 mt-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Calendar size={14} className="text-slate-500 dark:text-slate-400 shrink-0" />
              <span>{dateHeaderString}</span>
            </div>
          </div>

          {/* Right Column: Hand-drawn script motto (rendered in banner image) */}
          <div className="hidden lg:flex flex-col items-end text-right pr-4">
            <div className="font-serif italic text-slate-800 dark:text-amber-200 text-lg leading-tight drop-shadow-2xs">
              Segurança
            </div>
            <div className="font-serif italic text-slate-800 dark:text-amber-200 text-lg leading-tight drop-shadow-2xs">
              é o nosso maior
            </div>
            <div className="font-serif italic text-slate-800 dark:text-amber-200 text-lg leading-tight drop-shadow-2xs">
              resultado!
            </div>
            <div className="w-28 h-1 bg-[#FBBF24] rounded-full mt-1" />
          </div>
        </div>
      </div>

      {/* ==========================================================
          2. ROW OF 3 TOP KPI METRIC CARDS
          ========================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* CARD 1: TOTAL DE FUNCIONÁRIOS */}
        <div className="bg-white dark:bg-[#1F2937] rounded-2xl p-5 border border-slate-200/70 dark:border-white/10 shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div>
            {/* Header: Icon + Title */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <Users size={17} strokeWidth={2} />
              </div>
              <h3 className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                TOTAL DE FUNCIONÁRIOS
              </h3>
            </div>

            {/* Big Number */}
            <div className="mt-3">
              <span className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {totalFuncionarios}
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                colaboradores no quadro
              </p>
            </div>
          </div>

          {/* Bottom Badge: +2 vs mês anterior */}
          <div className="flex items-center gap-2 mt-4 pt-2">
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-500/20">
              <ArrowUp size={12} strokeWidth={2.5} />
              +2
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              vs. mês anterior
            </span>
          </div>

          {/* Watermark silhouette on the right */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-30 dark:opacity-10">
            <Users size={72} strokeWidth={1} className="text-slate-400" />
          </div>
        </div>

        {/* CARD 2: PRESENTES HOJE */}
        <div className="bg-white dark:bg-[#1F2937] rounded-2xl p-5 border border-slate-200/70 dark:border-white/10 shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div>
            {/* Header: Icon + Title */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <Calendar size={17} strokeWidth={2} />
              </div>
              <h3 className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                PRESENTES HOJE
              </h3>
            </div>

            {/* Donut Chart + Percent Box */}
            <div className="flex items-center justify-between mt-3 gap-3">
              <DonutGauge
                value={displayPresentes}
                total={totalFuncionarios}
                color="#10B981"
                trackColor="#E2E8F0"
                size={88}
                strokeWidth={9}
              />

              <div className="flex items-center gap-2.5 bg-emerald-50/80 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 px-3.5 py-2.5 rounded-xl">
                <UserCheck size={20} className="text-emerald-600 shrink-0" strokeWidth={2.2} />
                <div className="flex flex-col leading-tight">
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {pctPresenca}%
                  </span>
                  <span className="text-[10.5px] text-emerald-700/80 dark:text-emerald-300 font-medium">
                    de presença
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: AUSÊNCIAS */}
        <div className="bg-white dark:bg-[#1F2937] rounded-2xl p-5 border border-slate-200/70 dark:border-white/10 shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div>
            {/* Header: Icon + Title */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                <Megaphone size={17} strokeWidth={2} />
              </div>
              <h3 className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                AUSÊNCIAS
              </h3>
            </div>

            {/* Donut Chart + Percent Box */}
            <div className="flex items-center justify-between mt-3 gap-3">
              <DonutGauge
                value={displayAusencias}
                total={totalFuncionarios}
                color="#EF4444"
                trackColor="#FEE2E2"
                size={88}
                strokeWidth={9}
              />

              <div className="flex items-center gap-2.5 bg-red-50/80 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-3.5 py-2.5 rounded-xl">
                <UserX size={20} className="text-red-500 shrink-0" strokeWidth={2.2} />
                <div className="flex flex-col leading-tight">
                  <span className="text-lg font-bold text-red-500">
                    {pctAusencia}%
                  </span>
                  <span className="text-[10.5px] text-red-600/80 dark:text-red-300 font-medium">
                    de ausências
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================================
          3. MIDDLE SECTION (2 COLUMNS: LEFT 70%, RIGHT 30%)
          ========================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: LEMBRETES & VENCIMENTOS (8 COLS) */}
        <div className="lg:col-span-8 space-y-5">
          {/* CARD 1: LEMBRETES PARA HOJE */}
          <div className="bg-white dark:bg-[#1F2937] rounded-2xl p-5 border border-slate-200/70 dark:border-white/10 shadow-2xs">
            {/* Header with Yellow Round Clock Icon */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#FBBF24] text-slate-900 flex items-center justify-center shrink-0 shadow-2xs">
                  <Clock size={15} strokeWidth={2.3} />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Lembretes para Hoje
                </h3>
              </div>

              <Link
                to="/lembretes"
                className="text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-1 group"
              >
                <span>Ver todos</span>
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            {/* Yellow Alert Container with Reunião de Contrato Hydro & Employee Chips */}
            <div className="bg-[#FFFBEB] dark:bg-amber-950/20 border border-[#FDE68A] dark:border-amber-500/20 rounded-2xl p-3.5 sm:p-4 mt-3.5">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                  {ddsData?.hoje?.tema || 'Reunião de Contrato Hydro'}
                </span>
              </div>

              {/* Horizontal list of present team chips on clean white */}
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
                {presentColaboradores.map((colab) => (
                  <div
                    key={colab.id}
                    className="flex items-center gap-2 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/10 px-3 py-1.5 rounded-xl shrink-0 shadow-2xs"
                  >
                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {colab.nome.charAt(0)}
                    </div>

                    <div className="flex flex-col leading-tight">
                      <span className="text-[11.5px] font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {colab.nome}
                      </span>
                      <span className="flex items-center gap-1 text-[9.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Presente
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CARD 2: VENCIMENTOS E PENDÊNCIAS */}
          <div className="bg-white dark:bg-[#1F2937] rounded-2xl p-5 border border-slate-200/70 dark:border-white/10 shadow-2xs">
            {/* Header with Red Alert Icon and Badge 2 */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 flex items-center justify-center shrink-0">
                  <AlertTriangle size={15} strokeWidth={2.2} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                    Vencimentos e Pendências
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Atenção aos prazos e documentos
                  </p>
                </div>
              </div>

              <Link
                to="/documentos"
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 flex items-center gap-1.5 group"
              >
                <span>Ver todos</span>
                <ChevronRight size={13} />
                <span className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 text-[10px] font-bold flex items-center justify-center">
                  2
                </span>
              </Link>
            </div>

            {/* List of 2 pending cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3.5">
              {pendenciasMock.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate({ to: item.route as any })}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-colors cursor-pointer group ${
                    item.isDanger
                      ? 'bg-red-50/70 dark:bg-red-500/10 border-red-100 dark:border-red-500/20 hover:bg-red-50'
                      : 'bg-sky-50/60 dark:bg-sky-500/10 border-sky-100 dark:border-sky-500/20 hover:bg-sky-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        item.isDanger
                          ? 'bg-red-100 dark:bg-red-500/20 text-red-500'
                          : 'bg-sky-100 dark:bg-sky-500/20 text-sky-600'
                      }`}
                    >
                      <Calendar size={16} strokeWidth={2} />
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {item.nome}
                      </p>
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {item.categoria}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span
                      className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full ${
                        item.isDanger
                          ? 'bg-red-200/90 dark:bg-red-500/30 text-red-700 dark:text-red-300'
                          : 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300'
                      }`}
                    >
                      {item.status}
                    </span>
                    <ChevronRight
                      size={14}
                      className="text-slate-400 group-hover:translate-x-0.5 transition-transform"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SEGURANÇA & CLIMA (4 COLS) */}
        <div className="lg:col-span-4 space-y-5">
          {/* BANNER 1: SEGURANÇA EM PRIMEIRO LUGAR (COM CAPACETE HYDRO) */}
          <div
            onClick={() => navigate({ to: '/seguranca' })}
            className="rounded-2xl overflow-hidden relative shadow-xs border border-slate-800 bg-[#1A222B] min-h-[145px] p-4 flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow group"
          >
            {/* Background Helmet Image on Right */}
            <div
              className="absolute right-0 top-0 bottom-0 w-36 sm:w-44 bg-contain bg-right bg-no-repeat pointer-events-none"
              style={{
                backgroundImage: `url('/layout/capacete-hydro-card.png')`,
              }}
            />

            {/* Content Overlay */}
            <div className="relative z-10 max-w-[200px]">
              {/* Header Badge */}
              <div className="flex items-center gap-1.5 text-[9.5px] font-extrabold tracking-widest text-amber-400 uppercase">
                <Sun size={12} strokeWidth={2.5} />
                <span>NOSSA PRIORIDADE</span>
              </div>

              {/* Title */}
              <h4 className="text-sm sm:text-base font-bold text-white mt-1 leading-snug">
                Segurança em primeiro lugar
              </h4>

              {/* Description */}
              <p className="text-[10.5px] text-slate-300 mt-1 leading-relaxed">
                Trabalhar com segurança é cuidar de você, da sua família e do nosso futuro.
              </p>
            </div>

            {/* Golden Yellow Button */}
            <div className="relative z-10 mt-3">
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-900 px-3.5 py-1.5 rounded-full bg-[#FBBF24] hover:bg-[#F59E0B] shadow-xs transition-colors">
                <span>Juntos somos mais fortes!</span>
                <ChevronRight size={13} />
              </span>
            </div>
          </div>

          {/* BANNER 2: CLIMA / WEATHER WIDGET (BARCARENA - PA) */}
          <div className="bg-white dark:bg-[#1F2937] rounded-2xl p-5 border border-slate-200/70 dark:border-white/10 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sun size={18} className="text-amber-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Barcarena - PA
                </span>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                <CloudSun size={18} className="text-amber-500" />
                <div className="flex flex-col text-right leading-none">
                  <span>Máx 34°</span>
                  <span className="mt-0.5">Mín 24°</span>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                33°C
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Céu claro
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================================
          4. BOTTOM ACTION BAR: "ACESSO RÁPIDO"
          ========================================================== */}
      <div className="bg-white dark:bg-[#1F2937] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-2xs overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4 p-1 md:p-0">
        {/* Left Yellow Tab: ⚡ Acesso rápido */}
        <div className="bg-[#FBBF24] text-slate-900 font-extrabold text-xs sm:text-sm px-5 py-3 flex items-center gap-2 rounded-xl md:rounded-none md:rounded-l-2xl w-full md:w-auto shrink-0 justify-center">
          <Zap size={16} className="fill-slate-900 text-slate-900" />
          <span>Acesso rápido</span>
        </div>

        {/* Middle Links List */}
        <div className="flex items-center gap-4 sm:gap-6 px-4 py-2 flex-wrap justify-center text-xs font-semibold text-slate-700 dark:text-slate-200">
          <Link
            to="/documentos"
            className="flex items-center gap-1.5 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          >
            <FileText size={15} />
            <span>Documentos</span>
          </Link>

          <Link
            to="/equipamentos"
            className="flex items-center gap-1.5 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          >
            <Truck size={15} />
            <span>Equipamentos</span>
          </Link>

          <Link
            to="/almoxarifado"
            className="flex items-center gap-1.5 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          >
            <Package size={15} />
            <span>Almoxarifado</span>
          </Link>

          <Link
            to="/relatorio-obra"
            className="flex items-center gap-1.5 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          >
            <BarChart2 size={15} />
            <span>Relatórios</span>
          </Link>

          <Link
            to="/permissao-trabalho"
            className="flex items-center gap-1.5 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          >
            <Calendar size={15} />
            <span>Planejamento</span>
          </Link>

          <Link
            to="/reunioes"
            className="flex items-center gap-1.5 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          >
            <Users size={15} />
            <span>Reuniões</span>
          </Link>
        </div>

        {/* Right Signature Motto */}
        <div className="flex flex-col items-center md:items-end px-5 py-2 text-center md:text-right shrink-0">
          <span className="font-extrabold text-[11px] tracking-wider text-slate-800 dark:text-slate-100">
            HYDRO REABILITAÇÃO
          </span>
          <span className="text-[10px] font-semibold text-amber-500 italic mt-0.5">
            Mais segurança. Mais resultados.
          </span>
        </div>
      </div>

      {/* ==========================================================
          5. SEÇÃO OPERACIONAL COMPLEMENTAR (DDS, ESTOQUE, ATIVIDADES)
          ========================================================== */}
      <div className="pt-4 border-t border-slate-200/60 dark:border-white/10 space-y-5">
        <AlertaInspecaoMensal />

        {/* Alerta PT vencendo */}
        {expiringPTs.length > 0 && (
          <div
            className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-red-500/20 transition-colors"
            onClick={() => navigate({ to: '/permissao-trabalho' })}
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-red-500" size={24} />
              <div>
                <h3 className="font-bold text-red-500 dark:text-red-400">
                  Alerta de Permissão de Trabalho
                </h3>
                <p className="text-sm text-red-600 dark:text-red-300">
                  Você tem {expiringPTs.length} permiss
                  {expiringPTs.length > 1 ? 'ões' : 'ão'} de trabalho vencendo nos próximos 5 dias ou já vencida(s).
                </p>
              </div>
            </div>
            <button className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors">
              Ver detalhes
            </button>
          </div>
        )}

        {/* DDS Hoje & DDS Amanhã */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            className="bg-white dark:bg-[#1F2937] p-4 rounded-2xl border border-slate-200/70 dark:border-white/10 shadow-2xs cursor-pointer hover:shadow-md transition-shadow flex items-center justify-between"
            onClick={() => navigate({ to: '/seguranca/dds' })}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <FileText size={20} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wide">
                  DDS Hoje
                </span>
                <p className="text-sm font-bold text-slate-900 dark:text-white capitalize truncate">
                  {ddsData?.hoje?.palestrante?.nome?.toLowerCase() || 'livre'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  Tema: <span className="font-semibold text-slate-700 dark:text-slate-300">{ddsData?.hoje?.tema}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsDdsModalOpen(true)
                }}
                className="text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 px-3 py-1.5 rounded-lg font-medium transition-colors border border-amber-500/20"
              >
                {ddsData?.hoje?.postedMedia ? 'Alterar Foto' : 'Postar DDS'}
              </button>
              <ChevronRight size={18} className="text-slate-400" />
            </div>
          </div>

          <div
            className="bg-white dark:bg-[#1F2937] p-4 rounded-2xl border border-slate-200/70 dark:border-white/10 shadow-2xs cursor-pointer hover:shadow-md transition-shadow flex items-center justify-between"
            onClick={() => navigate({ to: '/seguranca/dds' })}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                <CalendarDays size={20} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                  DDS Amanhã
                </span>
                <p className="text-sm font-bold text-slate-900 dark:text-white capitalize truncate">
                  {ddsData?.amanha?.palestrante?.nome?.toLowerCase() || 'livre'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  Tema: <span className="font-semibold text-slate-700 dark:text-slate-300">{ddsData?.amanha?.tema}</span>
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400" />
          </div>
        </div>

        {/* Widgets Inferiores */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-4">
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
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-8 max-w-md w-full relative animate-in fade-in zoom-in duration-300">
            <button
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
              onClick={() => setShowBirthdayModal(false)}
            >
              <X size={24} />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-amber-100 dark:bg-amber-500/20 rounded-full flex items-center justify-center text-amber-500 mb-4 animate-bounce">
                <Gift size={40} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Tem festa hoje! 🎉
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6">Hoje é o aniversário de:</p>

              <div className="w-full flex flex-col gap-3 mb-8">
                {aniversariantesHoje.map((aniv: any, i: number) => (
                  <div
                    key={i}
                    className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl p-4 flex items-center justify-center"
                  >
                    <span className="font-bold text-lg text-slate-900 dark:text-white capitalize">
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
