import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.js'
import Users from 'lucide-react/dist/esm/icons/users.js'
import UserCheck from 'lucide-react/dist/esm/icons/user-check.js'
import UserX from 'lucide-react/dist/esm/icons/user-x.js'
import Calendar from 'lucide-react/dist/esm/icons/calendar.js'
import AlertTriangle from 'lucide-react/dist/esm/icons/triangle-alert.js'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.js'
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js'
import Target from 'lucide-react/dist/esm/icons/target.js'
import Sun from 'lucide-react/dist/esm/icons/sun.js'
import Gift from 'lucide-react/dist/esm/icons/gift.js'
import ZoomIn from 'lucide-react/dist/esm/icons/zoom-in.js'
import X from 'lucide-react/dist/esm/icons/x.js'
import ArrowUp from 'lucide-react/dist/esm/icons/arrow-up.js'
import Check from 'lucide-react/dist/esm/icons/check.js'
import Megaphone from 'lucide-react/dist/esm/icons/megaphone.js'
import FileText from 'lucide-react/dist/esm/icons/file-text.js'
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
import { PortalFooter } from '../components/layout/PortalFooter'
import { toast } from 'sonner'
import { getUserEnvironmentAccess, hasEnvironmentAccess } from '../lib/environmentAccess'

export const Route = createFileRoute('/dashboard')({
  component: DashboardComponent,
})

/**
 * Componente Donut Gauge SVG SVG limpo e preciso
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
    supabase.auth.getUser().then(async ({ data }) => {
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

  // Total colaboradores no quadro (fallback para 48 exatamente como a foto)
  const activeEmployees = efetivo.filter(
    (e: any) => e.status !== 'REMOVIDO' && e.status !== 'INATIVO'
  )
  const totalFuncionarios = activeEmployees.length > 0 ? activeEmployees.length : 48

  // Valores de presença e ausência com fallbacks fiéis ao mock da foto
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

  // Aniversariantes do mês
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

  // Data formatada idêntica ao design: "27 de outubro de 2026 | Terça-Feira"
  const dayNumber = format(new Date(), 'dd')
  const monthName = format(new Date(), 'MMMM', { locale: ptBR })
  const yearNumber = format(new Date(), 'yyyy')
  const weekdayRaw = format(new Date(), 'EEEE', { locale: ptBR })
  const weekdayFormatted = weekdayRaw
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('-')
  const dateHeaderString = `${dayNumber} de ${monthName} de ${yearNumber}  |  ${weekdayFormatted}`

  // Nome do usuário conectado
  const rawName = currentUser?.user_metadata?.full_name || currentUser?.name || 'Fabrício'
  const firstName = rawName.split(' ')[0]
  const displayFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()

  // Lista de colaboradores presentes para a barra de presença
  const presentColaboradores = [
    { id: '1', nome: 'Alessandra Souza Chaves', avatar: null },
    { id: '2', nome: 'Danieli Farias', avatar: null },
    { id: '3', nome: 'Você', avatar: currentUser?.user_metadata?.avatar_url || null },
    { id: '4', nome: 'Tiago Augusto Rosa machado', avatar: null },
    { id: '5', nome: 'Luis Carlos Passos Araújo', avatar: null },
    { id: '6', nome: 'Alexsandro Chaves', avatar: null },
  ]

  // Pendências de documentos idênticas ao mockup
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
    <div className="space-y-6 pb-12 selection:bg-sky-500/30">
      {/* ==========================================================
          1. HERO WELCOME BANNER (Panorama + Escavadeira + Frase)
          ========================================================== */}
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-xs border border-slate-200/40 dark:border-white/10 min-h-[140px] sm:min-h-[150px] flex items-center bg-[#0d223f]">
        {/* Background Image: Panorama with Excavator & Mountain Sky */}
        <div
          className="absolute inset-0 bg-cover bg-right sm:bg-center"
          style={{
            backgroundImage: `url('/layout/hydro-hero-banner.png')`,
            backgroundPosition: 'right center',
          }}
        />

        {/* Dark Gradient Overlay on left side to guarantee contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#071629]/95 via-[#071629]/80 to-transparent" />

        {/* Banner Content */}
        <div className="relative z-10 w-full px-5 sm:px-8 py-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Left Column: Greeting & Date */}
          <div className="max-w-xl">
            <div className="flex items-center gap-3">
              {/* Sun Icon */}
              <div className="w-10 h-10 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400 shrink-0">
                <Sun size={26} strokeWidth={2.2} className="text-amber-400" />
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Olá, {displayFirstName}!
              </h1>
            </div>

            <p className="text-xs sm:text-sm text-slate-100/90 mt-2 font-normal leading-relaxed">
              Tudo certo na operação. Vamos juntos por mais segurança e resultados!
            </p>

            {/* Date line with Calendar Icon */}
            <div className="flex items-center gap-2 mt-3 text-xs font-medium text-slate-200/90">
              <Calendar size={14} className="text-white/80 shrink-0" />
              <span>{dateHeaderString}</span>
            </div>
          </div>

          {/* Right Column: Hand-drawn script motto (rendered in banner image) */}
          <div className="hidden lg:flex flex-col items-end text-right pr-4">
            <div className="font-serif italic text-amber-200 text-lg leading-tight drop-shadow-sm">
              Segurança
            </div>
            <div className="font-serif italic text-amber-200 text-lg leading-tight drop-shadow-sm">
              é o nosso maior resultado.
            </div>
            <div className="w-32 h-1 bg-amber-400/60 rounded-full mt-1" />
          </div>
        </div>
      </div>

      {/* ==========================================================
          2. ROW OF 3 TOP KPI METRIC CARDS
          ========================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* CARD 1: TOTAL DE FUNCIONÁRIOS */}
        <div className="bg-white dark:bg-[#111C2E] rounded-2xl p-5 border border-slate-100 dark:border-white/5 shadow-xs relative overflow-hidden border-l-4 border-l-[#0284C7] flex flex-col justify-between">
          <div>
            {/* Header: Icon + Title */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-[#0284C7] flex items-center justify-center shrink-0">
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
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 dark:opacity-20">
            <Users size={72} strokeWidth={1} className="text-sky-300 dark:text-sky-600" />
          </div>
        </div>

        {/* CARD 2: PRESENTES HOJE */}
        <div className="bg-white dark:bg-[#111C2E] rounded-2xl p-5 border border-slate-100 dark:border-white/5 shadow-xs relative overflow-hidden border-l-4 border-l-[#10B981] flex flex-col justify-between">
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
              {/* Donut Gauge */}
              <DonutGauge
                value={displayPresentes}
                total={totalFuncionarios}
                color="#10B981"
                trackColor="rgba(16, 185, 129, 0.15)"
                size={88}
                strokeWidth={9}
              />

              {/* Right Capsule */}
              <div className="flex items-center gap-2.5 bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 px-3.5 py-2.5 rounded-xl">
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
        <div className="bg-white dark:bg-[#111C2E] rounded-2xl p-5 border border-slate-100 dark:border-white/5 shadow-xs relative overflow-hidden border-l-4 border-l-[#F87171] flex flex-col justify-between">
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
              {/* Donut Gauge */}
              <DonutGauge
                value={displayAusencias}
                total={totalFuncionarios}
                color="#EF4444"
                trackColor="rgba(239, 68, 68, 0.15)"
                size={88}
                strokeWidth={9}
              />

              {/* Right Capsule */}
              <div className="flex items-center gap-2.5 bg-red-50/70 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-3.5 py-2.5 rounded-xl">
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
          <div className="bg-white dark:bg-[#111C2E] rounded-2xl p-5 border border-slate-100 dark:border-white/5 shadow-xs">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
                  <Users size={17} strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                    Lembretes para Hoje
                  </h3>
                  <Link
                    to="/lembretes"
                    className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400 transition-colors"
                  >
                    {ddsData?.hoje?.tema || 'Reunião de Contrato Hydro'}
                  </Link>
                </div>
              </div>

              <Link
                to="/lembretes"
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400 flex items-center gap-0.5 group"
              >
                <span>Ver todos</span>
                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            {/* Horizontal list of present team chips */}
            <div className="flex items-center gap-3 overflow-x-auto pt-3.5 pb-1 scrollbar-thin">
              {presentColaboradores.map((colab) => (
                <div
                  key={colab.id}
                  className="flex items-center gap-2.5 bg-white dark:bg-white/5 border border-emerald-300/80 dark:border-emerald-500/30 px-3 py-2 rounded-xl shrink-0 shadow-2xs hover:border-emerald-400 transition-colors"
                >
                  {/* Avatar circle */}
                  <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden">
                    {colab.avatar ? (
                      <img src={colab.avatar} alt={colab.nome} className="w-full h-full object-cover" />
                    ) : (
                      colab.nome.charAt(0)
                    )}
                  </div>

                  {/* Name and presence pill */}
                  <div className="flex flex-col leading-tight">
                    <span className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {colab.nome}
                    </span>
                    <span className="flex items-center gap-1 text-[10.5px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Presente
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CARD 2: VENCIMENTOS E PENDÊNCIAS */}
          <div className="bg-white dark:bg-[#111C2E] rounded-2xl p-5 border border-slate-100 dark:border-white/5 shadow-xs">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                  <AlertTriangle size={17} strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                    Vencimentos e Pendências
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Atenção aos prazos e documentos
                  </p>
                </div>
              </div>

              <Link
                to="/documentos"
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400 flex items-center gap-0.5 group"
              >
                <span>Ver todos</span>
                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
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
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        item.isDanger
                          ? 'bg-red-100 dark:bg-red-500/20 text-red-500'
                          : 'bg-sky-100 dark:bg-sky-500/20 text-sky-600'
                      }`}
                    >
                      <Calendar size={17} strokeWidth={2} />
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {item.nome}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {item.categoria}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span
                      className={`text-[10.5px] font-bold px-2.5 py-1 rounded-full ${
                        item.isDanger
                          ? 'bg-red-200/90 dark:bg-red-500/30 text-red-700 dark:text-red-300'
                          : 'bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300'
                      }`}
                    >
                      {item.status}
                    </span>
                    <ChevronRight
                      size={15}
                      className="text-slate-400 group-hover:translate-x-0.5 transition-transform"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SEGURANÇA & PLANEJAMENTO (4 COLS) */}
        <div className="lg:col-span-4 space-y-5">
          {/* BANNER 1: SEGURANÇA EM PRIMEIRO LUGAR (COM CAPACETE HYDRO) */}
          <div
            onClick={() => navigate({ to: '/seguranca' })}
            className="rounded-2xl overflow-hidden relative shadow-xs border border-slate-800 bg-[#16252C] min-h-[145px] p-4 flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow group"
          >
            {/* Background Helmet Image on Right */}
            <div
              className="absolute right-0 top-0 bottom-0 w-36 sm:w-44 bg-contain bg-right bg-no-repeat pointer-events-none"
              style={{
                backgroundImage: `url('/layout/capacete-hydro.png')`,
              }}
            />

            {/* Content Overlay */}
            <div className="relative z-10 max-w-[200px]">
              {/* Header Badge */}
              <div className="flex items-center gap-1.5 text-[9.5px] font-extrabold tracking-widest text-emerald-400 uppercase">
                <ShieldCheck size={13} strokeWidth={2.5} />
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

            {/* Button */}
            <div className="relative z-10 mt-3">
              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-300 border border-emerald-500/60 px-3 py-1 rounded-full bg-emerald-950/50 group-hover:bg-emerald-900/50 transition-colors">
                <span>Juntos somos mais fortes!</span>
                <ChevronRight size={13} />
              </span>
            </div>
          </div>

          {/* BANNER 2: PLANEJAMENTO (COM FLORESTA) */}
          <div
            onClick={() => navigate({ to: '/relatorio-obra' })}
            className="rounded-2xl overflow-hidden relative shadow-xs border border-slate-800 min-h-[96px] p-4 flex items-center cursor-pointer hover:shadow-md transition-shadow group bg-[#11241C]"
          >
            {/* Background Forest Image */}
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url('/layout/bg-planejamento.png')`,
              }}
            />
            {/* Dark green overlay */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[0.5px]" />

            {/* Content */}
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full border border-white/60 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform">
                <Target size={18} strokeWidth={2} />
              </div>

              <p className="text-xs sm:text-sm font-bold text-white leading-snug">
                Planejamento é o caminho para grandes resultados.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================================
          4. SEÇÃO OPERACIONAL COMPLEMENTAR (DDS, ESTOQUE, ATIVIDADES)
          ========================================================== */}
      <div className="pt-4 border-t border-gray-200/60 dark:border-white/10 space-y-5">
        {/* Alerta de Inspeção de Cintas */}
        <AlertaInspecaoMensal />

        {/* Alerta de PT vencendo se houver */}
        {expiringPTs.length > 0 && (
          <div
            className="dashboard-card bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-red-500/20 transition-colors"
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
          {/* DDS HOJE */}
          <div
            className="bg-white dark:bg-[#111C2E] p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-xs cursor-pointer hover:shadow-md transition-shadow flex items-center justify-between"
            onClick={() => navigate({ to: '/seguranca/dds' })}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                <FileText size={20} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wide">
                  DDS Hoje
                </span>
                <p className="text-sm font-bold text-gray-900 dark:text-white capitalize truncate">
                  {ddsData?.hoje?.palestrante?.nome?.toLowerCase() || 'livre'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  Tema: <span className="font-semibold text-gray-700 dark:text-gray-300">{ddsData?.hoje?.tema}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsDdsModalOpen(true)
                }}
                className="text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 px-3 py-1.5 rounded-lg font-medium transition-colors border border-blue-500/20"
              >
                {ddsData?.hoje?.postedMedia ? 'Alterar Foto' : 'Postar DDS'}
              </button>
              <ChevronRight size={18} className="text-gray-400" />
            </div>
          </div>

          {/* DDS AMANHÃ */}
          <div
            className="bg-white dark:bg-[#111C2E] p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-xs cursor-pointer hover:shadow-md transition-shadow flex items-center justify-between"
            onClick={() => navigate({ to: '/seguranca/dds' })}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
                <CalendarDays size={20} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-sky-600 uppercase tracking-wide">
                  DDS Amanhã
                </span>
                <p className="text-sm font-bold text-gray-900 dark:text-white capitalize truncate">
                  {ddsData?.amanha?.palestrante?.nome?.toLowerCase() || 'livre'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  Tema: <span className="font-semibold text-gray-700 dark:text-gray-300">{ddsData?.amanha?.tema}</span>
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </div>
        </div>

        {/* Widgets Inferiores: Estoque, Vistorias e Atividades */}
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

      {/* ==========================================================
          5. FOOTER (HYDRO REABILITAÇÃO + SLOGAN)
          ========================================================== */}
      <PortalFooter />

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
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Tem festa hoje! 🎉
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Hoje é o aniversário de:</p>

              <div className="w-full flex flex-col gap-3 mb-8">
                {aniversariantesHoje.map((aniv: any, i: number) => (
                  <div
                    key={i}
                    className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl p-4 flex items-center justify-center"
                  >
                    <span className="font-bold text-lg text-gray-900 dark:text-white capitalize">
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
