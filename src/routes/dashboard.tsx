import React from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { subDays, addDays, format, getMonth, parseISO, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { getUserEnvironmentAccess, hasEnvironmentAccess } from '../lib/environmentAccess'
import { fetchReminders } from '../lib/api-reminders'
import {
  MAINTENANCE_REASONS,
  isUnderMaintenance,
  isOutside,
  MovementRecord,
} from '../lib/equipamentos/locationStatus'
import { DdsUploadModal } from '../components/DdsUploadModal'
import { AlertaInspecaoMensal } from '../components/seguranca/AlertaInspecaoMensal'
import { DashboardStockAlertWidget } from '../components/DashboardStockAlertWidget'
import { DashboardVistoriasWidget } from '../components/DashboardVistoriasWidget'
import { RecentActivitiesWidget } from '../components/RecentActivitiesWidget'
import '../hydro-panel.css'

export const Route = createFileRoute('/dashboard')({
  component: DashboardComponent,
})

const CIRC = 251.327
const bdayColors = ['#F472B6', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA', '#FB923C', '#F87171']

/** Equipamento lido de `eq_equipments` (cache materializado de `eq_movements`). */
interface DashboardEquipment {
  id: string
  name: string
  plate_tag: string
  category?: string | null
  location_status?: string | null
  last_exit_reason?: string | null
  last_exit_description?: string | null
}

function DashboardComponent() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const hojeDay = new Date().getDate()

  const [currentUser, setCurrentUser] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDdsModalOpen, setIsDdsModalOpen] = useState(false)
  const [expandedImage, setExpandedImage] = useState<string | null>(null)
  const [showBirthdayModal, setShowBirthdayModal] = useState(false)
  const [isMentionsOpen, setIsMentionsOpen] = useState(false)

  // Animation Refs
  const pipaArcRef = useRef<SVGCircleElement | null>(null)
  const pipaNeedleRef = useRef<SVGGElement | null>(null)
  const pipaTruckRef = useRef<SVGGElement | null>(null)

  const oficinaArcRef = useRef<SVGCircleElement | null>(null)
  const oficinaNeedleRef = useRef<SVGGElement | null>(null)
  const oficinaTruckRef = useRef<SVGGElement | null>(null)

  const donutPresencaRef = useRef<SVGCircleElement | null>(null)
  const donutAusenciaRef = useRef<SVGCircleElement | null>(null)
  const bdayCardRef = useRef<HTMLElement | null>(null)

  // Escape key handler for image modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedImage(null)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  // Listen to search events from Persistent Topbar
  useEffect(() => {
    const handleSearch = (e: any) => {
      setSearchQuery(e.detail || '')
      if (e.detail && e.detail.trim().length > 0) {
        setIsMentionsOpen(true)
      }
    }
    window.addEventListener('hydro_search', handleSearch)
    return () => window.removeEventListener('hydro_search', handleSearch)
  }, [])

  // Auth & Environment Access Check
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }: { data: any }) => {
      const isDevMock = typeof window !== 'undefined' && window.location.search.includes('mock=true')
      const user = data?.user || (isDevMock ? { id: 'mock-user', user_metadata: { full_name: 'Fabrício' } } : null)
      if (!user) {
        navigate({ to: '/' })
        return
      }
      setCurrentUser(user)
      if (isDevMock) return

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

  // Data de hoje formatada
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  // Presenças reais do banco (se hoje não tiver chamada feita ainda, herda o dia mais recente salvo com registros)
  const { data: attendanceInfo } = useQuery({
    queryKey: ['presencas_dashboard_real', todayStr],
    queryFn: async () => {
      const days = []
      for (let i = 6; i >= 0; i--) {
        days.push(format(subDays(new Date(), i), 'yyyy-MM-dd'))
      }

      const [weekRes, latestRes] = await Promise.all([
        supabase
          .from('rh_presencas')
          .select('data, status, funcionario_id, area')
          .in('data', days),
        supabase
          .from('rh_presencas')
          .select('data, status, funcionario_id, area')
          .order('data', { ascending: false })
          .limit(100),
      ])

      if (weekRes.error) throw weekRes.error

      const weekData = weekRes.data || []
      const latestData = latestRes.data || []

      // Registros de hoje
      const todayRecords = weekData.filter((r: any) => r.data === todayStr)
      const hasToday = todayRecords.length > 0

      // Se hoje tiver registros salvos usa hoje, senão usa a data mais recente registrada no banco
      const fallbackDate = latestData[0]?.data || todayStr
      const activeRecords = hasToday ? todayRecords : latestData.filter((r: any) => r.data === fallbackDate)
      const activeDate = hasToday ? todayStr : fallbackDate

      return {
        activeDate,
        isToday: hasToday,
        records: activeRecords,
      }
    },
    refetchInterval: 120000,
    staleTime: 60 * 1000,
  })

  // Buscar efetivo completo (Dados reais)
  const { data: efetivo = [] } = useQuery({
    queryKey: ['efetivo_dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_efetivo')
        .select(
          'id, nome, cargo, setor, raw_data, status, validade_aso_efetiva, aso_admissional, aso_periodico, retorno_ao_trabalho, mudanca_de_risco, aso_admissional_2'
        )
      if (error) throw error
      return data || []
    },
    staleTime: 5 * 60 * 1000,
  })

  // Total de colaboradores ativos reais
  const activeEmployees = useMemo(() => {
    return (efetivo || []).filter((e: any) => {
      const s = (e.status || '').toUpperCase().trim()
      return s !== 'REMOVIDO' && s !== 'INATIVO' && s !== 'DEMITIDO' && s !== 'DESLIGADO'
    })
  }, [efetivo])

  const totalFuncionarios = activeEmployees.length > 0 ? activeEmployees.length : (efetivo.length > 0 ? efetivo.length : 48)

  const { displayPresentes, displayAusencias, pctPresenca, pctAusencia } = useMemo(() => {
    const records = attendanceInfo?.records || []
    if (records.length === 0) {
      return { displayPresentes: 0, displayAusencias: 0, pctPresenca: 0, pctAusencia: 0 }
    }

    const presentes = records.filter((r: any) => (r.status || '').toUpperCase() === 'PRESENTE').length
    const explicitAusencias = records.filter((r: any) => {
      const st = (r.status || '').toUpperCase()
      return st === 'AUSENTE' || st === 'ATESTADO' || st === 'EXTERNO'
    }).length

    // Se houver ausências explicitamente marcadas, usa; caso contrário, a diferença entre o quadro total e os presentes é a ausência
    const ausencias = explicitAusencias > 0
      ? explicitAusencias
      : Math.max(0, totalFuncionarios - presentes)

    const pctP = totalFuncionarios > 0 ? Math.min(100, Math.round((presentes / totalFuncionarios) * 100)) : 0
    const pctA = totalFuncionarios > 0 ? Math.min(100, Math.max(0, 100 - pctP)) : 0

    return {
      displayPresentes: presentes,
      displayAusencias: ausencias,
      pctPresenca: pctP,
      pctAusencia: pctA,
    }
  }, [attendanceInfo, totalFuncionarios])

  const presencaTarget = CIRC - (CIRC * pctPresenca) / 100
  const ausenciaTarget = CIRC - (CIRC * pctAusencia) / 100

  // Permissões de Trabalho reais
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

  // DDS do dia real
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

      const todayDds = schedule?.find((s: any) => s.date === today)
      const tomorrowDds = schedule?.find((s: any) => s.date === tomorrow)

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

  // Frota de equipamentos da obra — dados reais de `eq_equipments`,
  // reconciliados com `eq_movements` (mesma fonte de verdade de
  // /equipamentos/todos: o último movimento de portaria decide).
  const { data: fleetData } = useQuery({
    queryKey: ['equipamentos_frota_dashboard'],
    queryFn: async () => {
      const [eqRes, movRes] = await Promise.all([
        supabase
          .from('eq_equipments')
          .select(
            'id, name, plate_tag, category, location_status, last_exit_reason, last_exit_description, updated_at'
          ),
        supabase
          .from('eq_movements')
          .select('id, equipment_id, movement_type, exit_reason, description, created_at')
          .order('created_at', { ascending: false }),
      ])

      if (eqRes.error) throw eqRes.error

      const movementsByEq = new Map<string, MovementRecord[]>()
      ;(movRes.data || []).forEach((m: any) => {
        if (!m?.equipment_id) return
        const list = movementsByEq.get(m.equipment_id) || []
        list.push({
          movement_type: m.movement_type,
          exit_reason: m.exit_reason ?? null,
          description: m.description ?? null,
          created_at: m.created_at ?? null,
        })
        movementsByEq.set(m.equipment_id, list)
      })

      const reconciled: DashboardEquipment[] = (eqRes.data || []).map((eq: any) => {
        const movements = movementsByEq.get(eq.id) || []
        const lastMov = movements[0]
        const outside = isOutside(eq, movements)
        return {
          id: eq.id,
          name: eq.name,
          plate_tag: eq.plate_tag,
          category: eq.category || null,
          location_status: outside ? 'outside' : 'inside',
          last_exit_reason: outside
            ? lastMov?.exit_reason || eq.last_exit_reason || null
            : null,
          last_exit_description: outside
            ? lastMov?.description || eq.last_exit_description || null
            : null,
        }
      })

      return reconciled
    },
    staleTime: 60 * 1000,
    refetchInterval: 300000,
  })

  // Lembretes do dia onde o usuário foi mencionado
  const { data: userMentionedReminders = [] } = useQuery({
    queryKey: ['user_mentioned_reminders', todayStr, currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return []
      const allReminders = await fetchReminders()
      // Filtrar: apenas lembretes de hoje onde o usuário foi mencionado
      return allReminders.filter((r: any) => {
        if (r.due_date !== todayStr) return false
        if (!r.reminder_mentions || r.reminder_mentions.length === 0) return false
        return r.reminder_mentions.some((m: any) => m.user_id === currentUser.id)
      })
    },
    enabled: !!currentUser?.id,
    staleTime: 30 * 1000,
    refetchInterval: 60000,
  })

  // Métricas da frota: somente equipamentos pesados em operação
  const fleetMetrics = useMemo(() => {
    const list = fleetData || []
    
    // Função para identificar equipamento pesado (exclui leves, jardinagem e canteiro)
    const isPesado = (eq: DashboardEquipment) => {
      const cat = (eq.category || '').toLowerCase().trim()
      if (!cat) return true
      if (cat.includes('pesado')) return true
      if (cat.includes('leve') || cat.includes('jardinagem') || cat.includes('canteiro')) return false
      return true
    }

    const heavyList = list.filter(isPesado)
    const total = heavyList.length
    let operation = 0
    let maintenance = 0

    heavyList.forEach((eq) => {
      if (isOutside(eq)) {
        if (MAINTENANCE_REASONS.includes(eq.last_exit_reason as any)) maintenance++
      } else {
        operation++
      }
    })

    const pctOperation = total > 0 ? Math.round((operation / total) * 100) : 0
    const pctMaintenance = total > 0 ? Math.round((maintenance / total) * 100) : 0

    // Pre-calculate gauge animation values for smooth rendering
    const CIRC = 251.327
    const gaugeOffsetOperation = CIRC - (CIRC * pctOperation) / 100
    const gaugeOffsetMaintenance = CIRC - (CIRC * pctMaintenance) / 100
    const needleRotationOperation = -90 + (pctOperation / 100) * 180
    const needleRotationMaintenance = -90 + (pctMaintenance / 100) * 180

    return {
      total,
      operation,
      maintenance,
      outOfOperation: total - operation,
      outOfMaintenance: total - maintenance,
      pctOperation,
      pctMaintenance,
      gaugeOffsetOperation,
      gaugeOffsetMaintenance,
      needleRotationOperation,
      needleRotationMaintenance,
    }
  }, [fleetData])

  // Aniversariantes reais
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

  useEffect(() => {
    if (aniversariantesHoje.length > 0) {
      setShowBirthdayModal(true)
    }
  }, [aniversariantesHoje])

  // Data formatada
  const dayNumber = format(new Date(), 'dd')
  const monthName = format(new Date(), 'MMMM', { locale: ptBR })
  const yearNumber = format(new Date(), 'yyyy')
  const weekdayRaw = format(new Date(), 'EEEE', { locale: ptBR })
  const weekdayFormatted = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1).toLowerCase()
  const datePillString = `${dayNumber} de ${monthName} de ${yearNumber}`

  // Nome do ambiente ativo (o seletor de ambiente fica no topo, no AppLayout)
  const environmentLabel =
    (typeof window !== 'undefined'
      ? localStorage.getItem('sucena_environment') || 'barcarena'
      : 'barcarena') === 'hydro-civil'
      ? 'Hydro Civil · PA'
      : 'Barcarena · PA'

  const rawName = currentUser?.user_metadata?.full_name || currentUser?.name || 'Fabrício'
  const firstName = rawName.split(' ')[0]
  const displayFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()

  // Participantes reais da Reunião / Presentes hoje
  const people = useMemo(() => {
    const presentRecords = (attendanceInfo?.records || []).filter(
      (r: any) => (r.status || '').toUpperCase() === 'PRESENTE'
    )
    const presentIds = new Set(presentRecords.map((r: any) => r.funcionario_id))

    let matched = activeEmployees.filter((e: any) => presentIds.has(e.id))
    if (matched.length === 0) {
      matched = activeEmployees.slice(0, 6)
    }

    const palette = ['#7C5C00', '#0E7490', '#14243E', '#15803D', '#B45309', '#6D28D9']

    return matched.slice(0, 6).map((emp: any, idx: number) => {
      const parts = (emp.nome || 'Colaborador').trim().split(' ')
      const initial =
        parts.length > 1
          ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
          : parts[0].slice(0, 2).toUpperCase()
      return {
        id: emp.id,
        name: emp.nome,
        initial,
        bg: palette[idx % palette.length],
        status: 'Presente',
      }
    })
  }, [attendanceInfo?.records, activeEmployees])

  // Vencimentos e pendências reais (ASOs do rh_efetivo + Permissões de Trabalho)
  const pendencias = useMemo(() => {
    const list: any[] = []
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    activeEmployees.forEach((emp: any) => {
      // Coleta todas as datas de exames disponíveis
      const dates = [
        emp.aso_admissional,
        emp.aso_periodico,
        emp.retorno_ao_trabalho,
        emp.mudanca_de_risco,
        emp.aso_admissional_2,
      ].filter(Boolean) as string[]

      // Se validade_aso_efetiva já existe, usa ela; senão calcula + 1 ano a partir do exame mais recente
      let validadeString = emp.validade_aso_efetiva
      if (dates.length > 0 && !validadeString) {
        const latestDate = dates.reduce((a: string, b: string) => (a > b ? a : b))
        const d = new Date(latestDate + 'T12:00:00')
        d.setFullYear(d.getFullYear() + 1)
        validadeString = d.toISOString().split('T')[0]
      }

      if (!validadeString) return

      let asoDate: Date | null = null
      if (typeof validadeString === 'string') {
        if (validadeString.includes('/')) {
          const parts = validadeString.split('/')
          if (parts.length === 3) asoDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]))
        } else {
          const parts = validadeString.split('-')
          if (parts.length === 3) asoDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
        }
      }

      if (asoDate && !isNaN(asoDate.getTime())) {
        asoDate.setHours(0, 0, 0, 0)
        const diff = Math.ceil((asoDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        // Inclui todos os Vencidos (diff < 0) e os Vencendo em até 30 dias (diff <= 30)
        if (diff < 0) {
          list.push({
            id: `aso-venc-${emp.id}`,
            name: emp.nome,
            detail: 'ASO / Documentação',
            tag: 'Vencido',
            urgent: true,
            href: '/rh/efetivo',
            diff,
          })
        } else if (diff <= 30) {
          list.push({
            id: `aso-warn-${emp.id}`,
            name: emp.nome,
            detail: 'ASO / Documentação',
            tag: diff === 0 ? 'Vence hoje' : `${diff} dias`,
            urgent: diff <= 5,
            href: '/rh/efetivo',
            diff,
          })
        }
      }
    })

    expiringPTs.forEach((pt: any) => {
      const vencDate = parseISO(pt.data_vencimento)
      vencDate.setHours(0, 0, 0, 0)
      const diff = Math.ceil((vencDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      list.push({
        id: `pt-${pt.id}`,
        name: pt.titulo || pt.atividade || `Permissão de Trabalho #${pt.numero || pt.id}`,
        detail: 'Permissão de Trabalho',
        tag: diff < 0 ? 'Vencido' : `${diff} dias`,
        urgent: diff <= 1,
        href: '/permissao-trabalho',
        diff,
      })
    })

    list.sort((a, b) => a.diff - b.diff)

    return list
  }, [activeEmployees, expiringPTs])

  // Confetti Burst Trigger
  const triggerBdayBurst = (clientX?: number, clientY?: number) => {
    if (!bdayCardRef.current) return
    const card = bdayCardRef.current
    const rect = card.getBoundingClientRect()
    const ox = typeof clientX === 'number' ? clientX - rect.left : rect.width / 2
    const oy = typeof clientY === 'number' ? clientY - rect.top : 40

    for (let bi = 0; bi < 42; bi++) {
      const p = document.createElement('i')
      const bs = 5 + Math.random() * 7
      p.className = 'bday-burst'
      p.style.left = `${ox}px`
      p.style.top = `${oy}px`
      p.style.width = `${bs}px`
      p.style.height = `${bs * (Math.random() < 0.5 ? 1 : 0.45)}px`
      p.style.background = bdayColors[bi % bdayColors.length]
      if (bi % 3 === 0) p.style.borderRadius = '50%'
      p.style.setProperty('--dx', `${(Math.random() * 2 - 1) * 190}px`)
      p.style.setProperty('--dy', `${90 + Math.random() * 190}px`)
      p.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`)
      p.style.setProperty('--dur', `${0.8 + Math.random() * 0.7}s`)
      card.appendChild(p)
      setTimeout(() => {
        p.remove()
      }, 1700)
    }
  }

  // Velocímetro Gauge Replay
  const replayGauge = (type: 'pipa' | 'oficina') => {
    const isPipa = type === 'pipa'
    const pct = isPipa ? fleetMetrics.pctOperation : fleetMetrics.pctMaintenance

    const arcEl = isPipa ? pipaArcRef.current : oficinaArcRef.current
    const needleEl = isPipa ? pipaNeedleRef.current : oficinaNeedleRef.current

    let start: number | null = null
    const dur = 1250

    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / dur, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      const cur = pct * eased

      if (arcEl) {
        arcEl.style.strokeDashoffset = String(CIRC - (CIRC * cur) / 100)
      }
      if (needleEl) {
        needleEl.setAttribute('transform', `rotate(${-90 + cur * 1.8} 100 100)`)
      }

      if (p < 1) {
        requestAnimationFrame(step)
      }
    }

    requestAnimationFrame(step)
  }

  // Play Donut Replay
  const handlePlayDonut = (type: 'presenca' | 'ausencia') => {
    const isPresenca = type === 'presenca'
    const pct = isPresenca ? pctPresenca : pctAusencia
    const target = CIRC - (CIRC * pct) / 100
    const arcEl = isPresenca ? donutPresencaRef.current : donutAusenciaRef.current

    if (!arcEl) return
    arcEl.style.transition = 'none'
    arcEl.style.strokeDashoffset = String(CIRC)
    void arcEl.getBoundingClientRect()
    arcEl.style.transition = 'stroke-dashoffset 1.15s cubic-bezier(.22,.9,.28,1)'
    arcEl.style.strokeDashoffset = String(target)
  }

  // Trigger animations on mount and when attendance metrics update
  useEffect(() => {
    const timer = setTimeout(() => {
      replayGauge('pipa')
      replayGauge('oficina')
      handlePlayDonut('presenca')
      handlePlayDonut('ausencia')
      triggerBdayBurst()
    }, 350)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    handlePlayDonut('presenca')
    handlePlayDonut('ausencia')
  }, [pctPresenca, pctAusencia])

  // Normalization for search filtering
  const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const q = norm(searchQuery.trim())

  const filteredPeople = useMemo(() => {
    if (!q) return people
    return people.filter((p: any) => norm(p.name).includes(q))
  }, [people, q])

  const filteredPendencias = useMemo(() => {
    if (!q) return pendencias
    return pendencias.filter((p: any) => norm(p.name).includes(q) || norm(p.detail).includes(q))
  }, [pendencias, q])

  return (
    <div className="hydro-dashboard-root">
      {/* SVG DEFS GLOBAIS PARA GRADIENTES DOS DONUTS E VELOCÍMETROS */}
      <svg style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden' }} aria-hidden="true">
        <defs>
          <linearGradient id="gradGreen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4ADE80" />
            <stop offset="100%" stopColor="#16A34A" />
          </linearGradient>
          <linearGradient id="gradRed" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F87171" />
            <stop offset="100%" stopColor="#DC2626" />
          </linearGradient>
          <linearGradient id="gradBlue" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <linearGradient id="gradOrange" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDBA74" />
            <stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
        </defs>
      </svg>

      {/* 1. HERO BANNER */}
      <section className="hero" aria-label="Boas-vindas">
        <img className="bg" src="/hero-excavator.webp" alt="Escavadeira amarela em frente de reabilitação às margens de um rio ao pôr do sol"/>
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <span className="hero-kicker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg> Operação em dia</span>
          <h1>Olá, {displayFirstName}!</h1>
          <p>Tudo certo na operação. Vamos juntos por mais segurança e resultados!</p>
          <div className="hero-meta">
            <span className="pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>{datePillString}</span>
            <span className="pill">{weekdayFormatted}</span>
            <span className="pill">{environmentLabel}</span>
          </div>
        </div>
        <div className="hero-script" aria-hidden="true">Segurança<br/>é o nosso maior<br/>resultado!</div>
      </section>

    
    

      {/* 2. CARDS DE KPIS COM DONUTS */}
      <section className="kpis" aria-label="Indicadores de hoje">
        <article className="kpi">
          <div className="kpi-head"><div className="kpi-ico" style={{ background: 'var(--yellow-soft)', color: 'var(--yellow-dark)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 15.3c2 .6 3.5 2.1 4 4.7"/></svg></div><span>Total de<br/>funcionários</span></div>
          <div><div className="kpi-big" data-count={totalFuncionarios}>{totalFuncionarios}</div><div className="kpi-sub">colaboradores no quadro</div><span className="trend"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>+2&nbsp;<span style={{ fontWeight: '600', color: 'var(--muted)' }}>vs. mês anterior</span></span></div>
        </article>

        <article className="kpi">
          <div className="kpi-head"><div className="kpi-ico" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 16l2 2 4-4"/></svg></div><span>Presentes<br/>hoje</span></div>
          <div className="kpi-body">
            <div className="donut arc-green" role="img" tabIndex={0} aria-label={`${displayPresentes} de ${totalFuncionarios} presentes, ${pctPresenca} por cento de presença. Clique para reanimar.`} title="Clique para reanimar" onClick={() => handlePlayDonut("presenca")}>
              <svg width="104" height="104" viewBox="0 0 96 96"><circle className="donut-track" cx="48" cy="48" r="40" fill="none" stroke="var(--line)" strokeWidth="10"/><circle ref={donutPresencaRef} className="donut-arc" cx="48" cy="48" r="40" fill="none" stroke="url(#gradGreen)" strokeWidth="10" strokeLinecap="round" strokeDasharray="251.327" strokeDashoffset={presencaTarget} data-pct={pctPresenca} /></svg>
              <div className="donut-center"><b data-count={displayPresentes}>{displayPresentes}</b><span>de {totalFuncionarios}</span></div>
              <span className="donut-tip">{pctPresenca}% de presença<small>{displayPresentes} de {totalFuncionarios} presentes hoje · clique para reanimar</small></span>
            </div>
            <div className="kpi-foot" style={{ flex: '1' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--green)' }}><circle cx="9" cy="8" r="3.5"/><path d="m15.5 11 2 2 4-4M2.5 20c.8-3.2 3.4-5 6.5-5 1.2 0 2.3.3 3.3.8"/></svg><div><b style={{ color: 'var(--green)' }} data-count-pct={pctPresenca}>{pctPresenca}%</b><br/><span>de presença</span></div></div>
          </div>
        </article>

        <article className="kpi">
          <div className="kpi-head"><div className="kpi-ico" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5M16 8h6M19 5v6"/></svg></div><span>Ausências<br/>hoje</span></div>
          <div className="kpi-body">
            <div className="donut arc-red" role="img" tabIndex={0} aria-label={`${displayAusencias} de ${totalFuncionarios} ausências, ${pctAusencia} por cento. Clique para reanimar.`} title="Clique para reanimar" onClick={() => handlePlayDonut("ausencia")}>
              <svg width="104" height="104" viewBox="0 0 96 96"><circle className="donut-track" cx="48" cy="48" r="40" fill="none" stroke="#FDE8E8" strokeWidth="10"/><circle ref={donutAusenciaRef} className="donut-arc" cx="48" cy="48" r="40" fill="none" stroke="url(#gradRed)" strokeWidth="10" strokeLinecap="round" strokeDasharray="251.327" strokeDashoffset={ausenciaTarget} data-pct={pctAusencia} /></svg>
              <div className="donut-center"><b data-count={displayAusencias}>{displayAusencias}</b><span>de {totalFuncionarios}</span></div>
              <span className="donut-tip">{pctAusencia}% de ausências<small>{displayAusencias} de {totalFuncionarios} ausências hoje · clique para reanimar</small></span>
            </div>
            <div className="kpi-foot red" style={{ flex: '1' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--red)' }}><circle cx="9" cy="8" r="3.5"/><path d="m16 16 5-5M21 16l-5-5M2.5 20c.8-3.2 3.4-5 6.5-5 1 0 2 .2 2.9.6"/></svg><div><b style={{ color: 'var(--red)' }} data-count-pct={pctAusencia}>{pctAusencia}%</b><br/><span>de ausências</span></div></div>
          </div>
        </article>
      </section>

    
    

      {/* 3. DDS CARD (Moved above Lembretes) */}
      <section className="dds-card-section" style={{ marginTop: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div
            className="card card-pad"
            style={{ cursor: 'pointer', transition: 'border-color .15s, box-shadow .15s' }}
            onClick={() => navigate({ to: '/seguranca/dds' })}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--yellow)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--line)'}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--amber-bg)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: '20px', height: '20px' }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                    <path d="M14 2v6h6" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--amber)' }}>
                    DDS Hoje
                  </span>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink)', marginTop: '2px', textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ddsData?.hoje?.palestrante?.nome?.toLowerCase() || 'Livre'}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Tema: <span style={{ fontWeight: 700, color: 'var(--ink2)' }}>{ddsData?.hoje?.tema}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsDdsModalOpen(true)
                  }}
                  style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 800, background: 'var(--amber-bg)', color: 'var(--amber)', border: '1px solid var(--amber)', borderRadius: '8px', cursor: 'pointer' }}
                >
                  {ddsData?.hoje?.postedMedia ? 'Alterar Foto' : 'Postar DDS'}
                </button>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ width: '16px', height: '16px', color: 'var(--faint)' }}>
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </div>
            </div>
          </div>

          <div
            className="card card-pad"
            style={{ cursor: 'pointer', transition: 'border-color .15s, box-shadow .15s' }}
            onClick={() => navigate({ to: '/seguranca/dds' })}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--line2)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--line)'}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--surface2)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: '20px', height: '20px' }}>
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M3 10h18M8 3v4M16 3v4" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)' }}>
                    DDS Amanhã
                  </span>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink)', marginTop: '2px', textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ddsData?.amanha?.palestrante?.nome?.toLowerCase() || 'Livre'}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Tema: <span style={{ fontWeight: 700, color: 'var(--ink2)' }}>{ddsData?.amanha?.tema}</span>
                  </p>
                </div>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ width: '16px', height: '16px', color: 'var(--faint)' }}>
                <path d="m9 6 6 6-6 6" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* 4. EQUIPAMENTOS EM OPERAÇÃO E MANUTENÇÃO (VELOCÍMETROS) - Moved after KPIs */}
      <section className="card card-pad" aria-label="Equipamentos em operação e em manutenção" style={{ marginTop: '24px' }}>
      <div className="fleet">
        <div className="fleet-half">
          <div className="fleet-head">
            <div className="ch-ico" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/></svg></div>
            <span>Em operação (Pesados)</span>
          </div>
          <div className="fleet-body">
            <div className="gauge" role="img" tabIndex={0} aria-label={`Velocímetro: ${fleetMetrics.operation} de ${fleetMetrics.total} em operação, ${fleetMetrics.pctOperation} por cento`} title="Clique para ver o velocímetro da frota de novo" onClick={() => replayGauge("pipa")}>
              <div className="gauge-dial">
              <svg width="184" height="118" viewBox="0 0 200 115" aria-hidden="true">
                <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#DCE9FD" strokeWidth="15" strokeLinecap="round"/>
                <path ref={pipaArcRef} className="gauge-arc" d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="url(#gradBlue)" strokeWidth="15" strokeLinecap="round" strokeDasharray="251.327" strokeDashoffset={fleetMetrics.gaugeOffsetOperation} data-pct={fleetMetrics.pctOperation}/>
                <g stroke="#A9B8CC" strokeWidth="2" strokeLinecap="round"><line x1="100" y1="7" x2="100" y2="16" transform="rotate(-90 100 100)"/><line x1="100" y1="7" x2="100" y2="16" transform="rotate(-72 100 100)"/><line x1="100" y1="7" x2="100" y2="16" transform="rotate(-54 100 100)"/><line x1="100" y1="7" x2="100" y2="16" transform="rotate(-36 100 100)"/><line x1="100" y1="7" x2="100" y2="16" transform="rotate(-18 100 100)"/><line x1="100" y1="7" x2="100" y2="16" transform="rotate(0 100 100)"/><line x1="100" y1="7" x2="100" y2="16" transform="rotate(18 100 100)"/><line x1="100" y1="7" x2="100" y2="16" transform="rotate(36 100 100)"/><line x1="100" y1="7" x2="100" y2="16" transform="rotate(54 100 100)"/><line x1="100" y1="7" x2="100" y2="16" transform="rotate(72 100 100)"/><line x1="100" y1="7" x2="100" y2="16" transform="rotate(90 100 100)"/></g>
                <g ref={pipaNeedleRef} className="gauge-needle" transform={`rotate(${fleetMetrics.needleRotationOperation} 100 100)`}><polygon points="97.4,100 102.6,100 100.9,38 99.1,38" fill="#17233B"/><circle cx="100" cy="100" r="10" fill="#17233B"/><circle cx="100" cy="100" r="4.5" fill="#2563EB"/></g>
              </svg>
              <span className="gauge-scale left">0</span><span className="gauge-scale right">{fleetMetrics.total}</span>
              </div>
              <div className="gauge-center"><b data-count={fleetMetrics.operation}>{fleetMetrics.operation}</b><span>de {fleetMetrics.total} pesados</span></div>
              <span className="gauge-tip">{fleetMetrics.pctOperation}% em operação<small>{fleetMetrics.operation} de {fleetMetrics.total} equipamentos · clique para reanimar</small></span>
            </div>
            <div><div className="pct-chip blue"><b data-count-pct={fleetMetrics.pctOperation}>{fleetMetrics.pctOperation}%</b><span>em operação</span></div><div className="gauge-label" style={{ marginTop: '10px' }}>Equipamentos<br/>Pesados</div></div>
          </div>
          <div className="fleet-legend" style={{ marginTop: '12px' }}><span className="hl-blue"><i className="d-blue"></i>{fleetMetrics.operation} pesados em operação</span><span className="hl-blue"><i className="d-blue-rest"></i>{fleetMetrics.outOfOperation} fora de operação</span></div>
        </div>
        <div className="fleet-half">
          <div className="fleet-head">
            <div className="ch-ico" style={{ background: '#FFF3E4', color: '#EA580C' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6L14 13l-3-3 3.7-3.7Z"/></svg></div>
            <span>Em manutenção</span>
          </div>
          <div className="fleet-body">
            <div className="gauge" role="img" tabIndex={0} aria-label={`Velocímetro: ${fleetMetrics.maintenance} de ${fleetMetrics.total} em manutenção, ${fleetMetrics.pctMaintenance} por cento`} title="Clique para ver o velocímetro de manutenção de novo" onClick={() => replayGauge("oficina")}>
              <div className="gauge-dial">
              <svg width="184" height="118" viewBox="0 0 200 115" aria-hidden="true">
                <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#FDEBD9" strokeWidth="15" strokeLinecap="round"/>
                <path ref={oficinaArcRef} className="gauge-arc" d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="url(#gradOrange)" strokeWidth="15" strokeLinecap="round" strokeDasharray="251.327" strokeDashoffset={fleetMetrics.gaugeOffsetMaintenance} data-pct={fleetMetrics.pctMaintenance}/>
                <g stroke="#C9B096" strokeWidth="2" strokeLinecap="round"><line x1="100" y1="7" x2="100" y2="16" transform="rotate(-90 100 100)"/><line x1="100" y1="7" x2="100" y2="16" transform="rotate(-72 100 100)"/><line x1="100" y1="7" x2="100" y2="16" transform="rotate(-54 100 100)"/><line x1="100" y1="7" x2="100" y2="16" transform="rotate(-36 100 100)"/><line x1="100" y1="7" x2="100" y2="16" transform="rotate(-18 100 100)"/><line x1="100" y1="7" x2="100" y2="16" transform="rotate(0 100 100)"/><line x1="100" y1="7" x2="100" y2="16" transform="rotate(18 100 100)"/><line x1="100" y1="7" x2="100" y2="16" transform="rotate(36 100 100)"/><line x1="100" y1="7" x2="100" y2="16" transform="rotate(54 100 100)"/><line x1="100" y1="7" x2="100" y2="16" transform="rotate(72 100 100)"/><line x1="100" y1="7" x2="100" y2="16" transform="rotate(90 100 100)"/></g>
                <g ref={oficinaNeedleRef} className="gauge-needle" transform={`rotate(${fleetMetrics.needleRotationMaintenance} 100 100)`}><polygon points="97.4,100 102.6,100 100.9,38 99.1,38" fill="#17233B"/><circle cx="100" cy="100" r="10" fill="#17233B"/><circle cx="100" cy="100" r="4.5" fill="#EA580C"/></g>
              </svg>
              <span className="gauge-scale left">0</span><span className="gauge-scale right">{fleetMetrics.total}</span>
              </div>
              <div className="gauge-center"><b data-count={fleetMetrics.maintenance}>{fleetMetrics.maintenance}</b><span>de {fleetMetrics.total}</span></div>
              <span className="gauge-tip">{fleetMetrics.pctMaintenance}% em manutenção<small>{fleetMetrics.maintenance} de {fleetMetrics.total} equipamentos · clique para reanimar</small></span>
            </div>
            <div><div className="pct-chip orange"><b data-count-pct={fleetMetrics.pctMaintenance}>{fleetMetrics.pctMaintenance}%</b><span>em manutenção</span></div><div className="gauge-label" style={{ marginTop: '10px' }}>Velocímetro<br/>da frota</div></div>
          </div>
          <div className="fleet-legend" style={{ marginTop: '12px' }}><span className="hl-orange"><i className="d-orange"></i>{fleetMetrics.maintenance} em manutenção</span><span className="hl-orange"><i className="d-orange-rest"></i>{fleetMetrics.outOfMaintenance} fora de manutenção</span></div>
        </div>
      </div>
    </section>

      {/* 5. CONTENT GRID (LEMBRETES + SEGURANÇA E CLIMA) */}
      <div className="content-grid" style={{ marginTop: '24px' }}>
        {userMentionedReminders.length > 0 && (
          <section className="card card-pad" aria-label="Lembretes para hoje">
            <div className="card-head">
              <div className="ch-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div>
              <div><h2>Lembretes para hoje</h2><p>{userMentionedReminders.length} lembrete{userMentionedReminders.length > 1 ? 's' : ''} onde você foi mencionado</p></div>
              <a className="link-all" href="/lembretes" onClick={(e) => e.preventDefault()}>Ver todos <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 6 6 6-6 6"/></svg></a>
            </div>

            <div className="space-y-3">
              {userMentionedReminders.map((reminder: any) => (
                <div key={reminder.id} className="pend" style={{ padding: '12px 16px', borderRadius: '12px', background: 'var(--surface2)', border: '1px solid var(--line)', transition: 'border-color .15s', cursor: 'pointer' }} onClick={() => navigate({ to: '/lembretes' })}>
                  <div className="flex items-center gap-3">
                    <div className={`pend-ico flex-shrink-0 ${reminder.priority === 'Urgente' ? 'tag-red' : reminder.priority === 'Alta' ? 'tag-orange' : reminder.priority === 'Baixa' ? 'tag-blue' : 'tag-amber'}`} style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px' }}>
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-2">
                        <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{reminder.title}</p>
                        {reminder.priority !== 'Normal' && (
                          <span className={`pend-tag ${reminder.priority === 'Urgente' ? 'tag-red' : reminder.priority === 'Alta' ? 'tag-orange' : reminder.priority === 'Baixa' ? 'tag-blue' : 'tag-amber'}`} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px' }}>
                            {reminder.priority}
                          </span>
                        )}
                        {reminder.is_recurring && (
                          <span className="tag-blue" style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px' }}>Recorrente</span>
                        )}
                      </div>
                      {reminder.description && (
                        <p style={{ marginTop: '4px', fontSize: '12.5px', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {reminder.description}
                        </p>
                      )}
                    </div>
                    <div style={{ color: 'var(--faint)' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '16px', height: '16px' }}>
                        <path d="m9 6 6 6-6 6"/>
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {pendencias.length > 0 && (
          <section className="card card-pad pendencias-alert" aria-label="Vencimentos e pendências">
            <div className="section-divider flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="ch-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17.5v.5"/></svg></div>
                <div><h3>Vencimentos e pendências</h3><p>Atenção aos prazos e documentos</p></div>
                <span className="pend-attention"><i></i>ATENÇÃO</span>
              </div>
              <div className="flex items-center gap-2">
                <a className="link-all" href="/rh/efetivo" onClick={(e) => { e.preventDefault(); navigate({ to: '/rh/efetivo' as any }); }}>Ver todos <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 6 6 6-6 6"/></svg></a>
                <span className="count-badge" aria-label={`${pendencias.length} pendências`}>{pendencias.length}</span>
              </div>
            </div>

            <div className="pend-list space-y-2" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              {filteredPendencias.map((item: any) => (
                <button
                  key={item.id}
                  className={`pend ${item.urgent ? 'urgent' : 'pend-expiring'}`}
                  data-name={norm(`${item.name} ${item.detail} ${item.tag}`)}
                  onClick={() => navigate({ to: item.href as any })}
                >
                  <span className="pend-ico">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <rect x="3" y="5" width="18" height="16" rx="2"/>
                      <path d="M3 10h18M8 3v4M16 3v4"/>
                    </svg>
                  </span>
                  <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <b>{item.name}</b>
                    {item.urgent ? (
                      <span>{item.detail}</span>
                    ) : (
                      <>
                        <span className="pend-cat">{item.detail}</span>
                        <span className="pend-days">Faltam {item.tag} para o vencimento</span>
                      </>
                    )}
                  </span>
                  <span className={`pend-tag ${item.urgent ? 'tag-red' : 'tag-amber'}`}>{item.tag}</span>
                  <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="m9 6 6 6-6 6"/>
                  </svg>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="side-stack">
          <section className="safety" aria-label="Segurança em primeiro lugar">
            <img src="/safety-helmet.webp" alt="Capacete de segurança branco sobre bancada em obra ao pôr do sol"/>
            <div className="safety-body">
              <span className="s-kicker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>Nossa prioridade</span>
              <h3>Segurança em primeiro lugar</h3>
              <p>Trabalhar com segurança é cuidar de você, da sua família e do nosso futuro.</p>
              <span className="safety-btn">Juntos somos mais fortes <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 6 6 6-6 6"/></svg></span>
            </div>
          </section>

          <section className="card weather" aria-label="Clima em Barcarena">
            <div className="weather-top"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>Barcarena · PA<span style={{ marginLeft: 'auto', fontWeight: '600', color: 'var(--faint)' }}>{dayNumber} de {monthName.slice(0, 3)}.</span></div>
            <div className="weather-main">
              <div><b>33°C</b><small>Céu claro</small></div>
              <div className="weather-range">
                <div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>Máx <b>34°</b></div>
                <div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.5 18a4.5 4.5 0 0 0 .4-8.97A6 6 0 1 0 6 17.6c.3.27.7.4 1 .4h10.5Z"/></svg>Mín <b>24°</b></div>
              </div>
            </div>
            <p style={{ margin: '14px 0 0', paddingTop: '12px', borderTop: '1px solid var(--line2)', fontSize: '12.5px', lineHeight: '1.5', color: 'var(--muted)', fontWeight: '600' }}>Dia quente e seco na frente de obra — hidratação e pausas regulares para toda a equipe.</p>
          </section>
        </div>
      </div>

    
    

      {/* 4. ANIVERSARIANTES DO MÊS */}
      <section ref={bdayCardRef} className="card card-pad bday-card" id="bdayCard" aria-label="Aniversariantes do mês" title="Clique para soltar confetes" onClick={(e) => triggerBdayBurst(e.clientX, e.clientY)} style={{ marginTop: '24px' }}>
        <div className="bday-bunting" aria-hidden="true">
          <svg className="b1" style={{ left: '6%' }} width="300" height="30" viewBox="0 0 300 30"><path d="M0 1 Q150 16 300 1" fill="none" stroke="#D8B4C8" strokeWidth="1.6"/><path d="M14 4 30 5 21 20Z" fill="#F472B6"/><path d="M52 7 68 8 59 23Z" fill="#FBBF24"/><path d="M90 9 106 9 97 24Z" fill="#34D399"/><path d="M128 10 144 10 135 25Z" fill="#60A5FA"/><path d="M166 10 182 9 173 24Z" fill="#A78BFA"/><path d="M204 9 220 8 211 23Z" fill="#FB923C"/><path d="M242 7 258 5 249 20Z" fill="#F472B6"/><path d="M272 4 288 3 279 18Z" fill="#34D399"/></svg>
          <svg className="b2" style={{ right: '4%' }} width="240" height="30" viewBox="0 0 240 30"><path d="M0 1 Q120 14 240 1" fill="none" stroke="#D8B4C8" strokeWidth="1.6"/><path d="M12 4 28 5 19 20Z" fill="#60A5FA"/><path d="M46 7 62 8 53 23Z" fill="#F472B6"/><path d="M80 9 96 9 87 24Z" fill="#FBBF24"/><path d="M114 10 130 10 121 25Z" fill="#FB923C"/><path d="M148 9 164 8 155 23Z" fill="#34D399"/><path d="M182 7 198 5 189 20Z" fill="#A78BFA"/><path d="M210 4 226 3 217 18Z" fill="#F472B6"/></svg>
        </div>
        <div className="bday-confetti" id="bdayConfetti" aria-hidden="true"></div>
        <svg className="bday-balloon b1" width="30" height="52" viewBox="0 0 30 52" aria-hidden="true"><ellipse cx="15" cy="14" rx="12" ry="14" fill="#F472B6"/><path d="M13 28h4l-2 4Z" fill="#DB2777"/><path d="M15 32c-3 5 3 7 0 12" fill="none" stroke="#9D4E6B" strokeWidth="1.4"/></svg>
        <svg className="bday-balloon b2" width="26" height="46" viewBox="0 0 30 52" aria-hidden="true"><ellipse cx="15" cy="14" rx="12" ry="14" fill="#60A5FA"/><path d="M13 28h4l-2 4Z" fill="#2563EB"/><path d="M15 32c-3 5 3 7 0 12" fill="none" stroke="#64748B" strokeWidth="1.4"/></svg>
        <svg className="bday-balloon b3" width="30" height="52" viewBox="0 0 30 52" aria-hidden="true"><ellipse cx="15" cy="14" rx="12" ry="14" fill="#FBBF24"/><path d="M13 28h4l-2 4Z" fill="#D97706"/><path d="M15 32c-3 5 3 7 0 12" fill="none" stroke="#92700C" strokeWidth="1.4"/></svg>
        <div className="card-head">
          <div className="ch-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="8" width="18" height="4"/><path d="M5 12v9h14v-9M12 8v13M12 8s-4.5.3-4.5-2.2C7.5 3.6 10.5 3.4 12 8ZM12 8s4.5.3 4.5-2.2C16.5 3.6 13.5 3.4 12 8Z"/></svg></div>
          <div><h2>Aniversariantes do mês</h2><p>Aniversários da equipe neste mês</p></div>
          <span className="bday-badge"><i></i>É festa!</span>
        </div>
        <div className="bday-list">
          {aniversariantesMes.length > 0 ? (
            aniversariantesMes.slice(0, 4).map((emp: any, idx: number) => (
              <div key={idx} className="bday">
                <span className="bday-cake" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M4 21h16M5 21v-5.5A1.5 1.5 0 0 1 6.5 14h11A1.5 1.5 0 0 1 19 15.5V21" stroke={idx % 2 === 0 ? "#DB2777" : "#7C3AED"} strokeWidth={1.8} />
                    <path d="M5 17.2c1.2 1.1 2.3 1.1 3.5 0 1.2 1.1 2.3 1.1 3.5 0 1.2 1.1 2.3 1.1 3.5 0" stroke={idx % 2 === 0 ? "#F472B6" : "#A78BFA"} strokeWidth={1.6} />
                    <path d="M12 11V8.6" stroke={idx % 2 === 0 ? "#7C3AED" : "#DB2777"} strokeWidth={1.8} strokeLinecap="round" />
                    <path className="flame" d="M12 3.4c.95 1.05 1.35 1.95 1.35 2.75a1.35 1.45 0 1 1-2.7 0c0-.8.4-1.7 1.35-2.75Z" fill="#F59E0B" />
                  </svg>
                </span>
                <div><b>{emp.nome}</b><small>Parabéns pelo seu dia!</small></div>
                <span className="bday-day">Dia {String(emp.day).padStart(2, '0')}</span>
              </div>
            ))
          ) : (
            <>
              <div className="bday">
                <span className="bday-cake" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 21h16M5 21v-5.5A1.5 1.5 0 0 1 6.5 14h11A1.5 1.5 0 0 1 19 15.5V21" stroke="#DB2777" strokeWidth={1.8}/><path d="M5 17.2c1.2 1.1 2.3 1.1 3.5 0 1.2 1.1 2.3 1.1 3.5 0 1.2 1.1 2.3 1.1 3.5 0" stroke="#F472B6" strokeWidth={1.6}/><path d="M12 11V8.6" stroke="#7C3AED" strokeWidth={1.8} strokeLinecap="round"/><path className="flame" d="M12 3.4c.95 1.05 1.35 1.95 1.35 2.75a1.35 1.45 0 1 1-2.7 0c0-.8.4-1.7 1.35-2.75Z" fill="#F59E0B"/></svg></span>
                <div><b>Carlos Andre Mourão Dos Reis</b><small>Parabéns pelo seu dia!</small></div>
                <span className="bday-day">Dia 01</span>
              </div>
              <div className="bday">
                <span className="bday-cake" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 21h16M5 21v-5.5A1.5 1.5 0 0 1 6.5 14h11A1.5 1.5 0 0 1 19 15.5V21" stroke="#7C3AED" strokeWidth={1.8}/><path d="M5 17.2c1.2 1.1 2.3 1.1 3.5 0 1.2 1.1 2.3 1.1 3.5 0 1.2 1.1 2.3 1.1 3.5 0" stroke="#A78BFA" strokeWidth={1.6}/><path d="M12 11V8.6" stroke="#DB2777" strokeWidth={1.8} strokeLinecap="round"/><path className="flame" d="M12 3.4c.95 1.05 1.35 1.95 1.35 2.75a1.35 1.45 0 1 1-2.7 0c0-.8.4-1.7 1.35-2.75Z" fill="#F59E0B"/></svg></span>
                <div><b>João Carlos Paixão Melo</b><small>Parabéns pelo seu dia!</small></div>
                <span className="bday-day">Dia 06</span>
              </div>
            </>
          )}</div>
      </section>

      {/* 5. ACESSO RÁPIDO */}
      <section className="quick" aria-label="Acesso rápido">
      <div className="quick-label"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>Acesso rápido</div>
      <div className="quick-items" id="quickItems">
        <button className="quick-item" data-name="documentos" onClick={() => navigate({ to: "/documentos" })}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>Documentos</button>
        <button className="quick-item" data-name="equipamentos" onClick={() => navigate({ to: "/equipamentos" })}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M3 16V8h11v8M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>Equipamentos</button>
        <button className="quick-item" data-name="almoxarifado" onClick={() => navigate({ to: "/almoxarifado" })}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>Almoxarifado</button>
        <button className="quick-item" data-name="relatorios relatorio de obra" onClick={() => navigate({ to: "/relatorio-obra" })}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>Relatórios</button>
        <button className="quick-item" data-name="planejamento" onClick={() => toast.info("Módulo de Planejamento em desenvolvimento.")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>Planejamento</button>
        <button className="quick-item" data-name="reunioes" onClick={() => navigate({ to: "/reunioes" })}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 15.3c2 .6 3.5 2.1 4 4.7"/></svg>Reuniões</button>
      </div>
    </section>

      {/* ==========================================================
          WIDGETS OPERACIONAIS REAIS DO SISTEMA
          ========================================================== */}
      <section className="card card-pad" aria-label="Widgets operacionais" style={{ marginTop: '32px' }}>
        <div className="card-head">
          <div className="ch-ico" style={{ background: 'var(--yellow-soft)', color: 'var(--yellow-dark)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10Z"/><path d="m9 11.5 2 2 4-4"/></svg>
          </div>
          <h2>Widgets Operacionais</h2>
        </div>

        {/* Permissão de Trabalho Alert */}
        {expiringPTs.length > 0 && (
          <div
            className="card card-pad"
            style={{ marginBottom: '16px', background: 'var(--red-bg)', borderColor: 'var(--red-ring)', cursor: 'pointer' }}
            onClick={() => navigate({ to: '/permissao-trabalho' })}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--red-bg)', display: 'grid', placeItems: 'center' }}>
                  <svg style={{ width: '20px', height: '20px', color: 'var(--red)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M12 3 2 20h20L12 3Z" />
                    <path d="M12 10v4M12 17.5v.5" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--red)' }}>Alerta de Permissão de Trabalho</h3>
                  <p style={{ fontSize: '12px', color: 'var(--red)', marginTop: '2px' }}>
                    Você tem {expiringPTs.length} permiss{expiringPTs.length > 1 ? 'ões' : 'ão'} de
                    trabalho com atenção aos prazos.
                  </p>
                </div>
              </div>
              <button style={{ padding: '6px 12px', background: 'var(--red)', color: '#fff', borderRadius: '10px', fontSize: '11px', fontWeight: 800 }}>
                Ver detalhes
              </button>
            </div>
          </div>
        )}

        {/* DDS Hoje Card & Postar DDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <div
            className="card card-pad"
            style={{ cursor: 'pointer', transition: 'border-color .15s, box-shadow .15s' }}
            onClick={() => navigate({ to: '/seguranca/dds' })}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--yellow)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--line)'}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--amber-bg)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: '20px', height: '20px' }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                    <path d="M14 2v6h6" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--amber)' }}>
                    DDS Hoje
                  </span>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink)', marginTop: '2px', textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ddsData?.hoje?.palestrante?.nome?.toLowerCase() || 'Livre'}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Tema: <span style={{ fontWeight: 700, color: 'var(--ink2)' }}>{ddsData?.hoje?.tema}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsDdsModalOpen(true)
                  }}
                  style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 800, background: 'var(--amber-bg)', color: 'var(--amber)', border: '1px solid var(--amber)', borderRadius: '8px', cursor: 'pointer' }}
                >
                  {ddsData?.hoje?.postedMedia ? 'Alterar Foto' : 'Postar DDS'}
                </button>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ width: '16px', height: '16px', color: 'var(--faint)' }}>
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </div>
            </div>
          </div>

          <div
            className="card card-pad"
            style={{ cursor: 'pointer', transition: 'border-color .15s, box-shadow .15s' }}
            onClick={() => navigate({ to: '/seguranca/dds' })}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--line2)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--line)'}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--surface2)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: '20px', height: '20px' }}>
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M3 10h18M8 3v4M16 3v4" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)' }}>
                    DDS Amanhã
                  </span>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink)', marginTop: '2px', textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ddsData?.amanha?.palestrante?.nome?.toLowerCase() || 'Livre'}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Tema: <span style={{ fontWeight: 700, color: 'var(--ink2)' }}>{ddsData?.amanha?.tema}</span>
                  </p>
                </div>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ width: '16px', height: '16px', color: 'var(--faint)' }}>
                <path d="m9 6 6 6-6 6" />
              </svg>
            </div>
          </div>
        </div>

        {/* Widgets Inferiores */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <DashboardStockAlertWidget />
            <DashboardVistoriasWidget />
          </div>
          <div style={{ minHeight: '380px' }}>
            <RecentActivitiesWidget />
          </div>
        </div>
      </section>

      {/* Rodapé da Operação */}
      <footer style={{ marginTop: '32px' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--muted)' }}>
          <b style={{ color: 'var(--ink)', letterSpacing: '.06em' }}>HYDRO REABILITAÇÃO</b> · Painel da operação · {weekdayFormatted.toLowerCase()},{' '}
          {dayNumber} de {monthName} de {yearNumber}
        </span>
        <span className="foot-brand" style={{ textAlign: 'right' }}>
          <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--muted)' }}>Mais segurança.</span>
          <span style={{ display: 'block', marginTop: '2px', fontSize: '12.5px', fontWeight: 600, color: 'var(--muted)' }}>Mais resultados.</span>
        </span>
      </footer>

      {/* Modais */}
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {showBirthdayModal && aniversariantesHoje.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-8 max-w-md w-full relative animate-in fade-in zoom-in duration-300">
            <button
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
              onClick={() => setShowBirthdayModal(false)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center text-amber-500 mb-4 animate-bounce">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-10 h-10 text-amber-500">
                  <rect x="3" y="8" width="18" height="14" rx="2" />
                  <path d="M12 8v14M8 8V4a2 2 0 0 1 4 0v4M12 4a2 2 0 0 1 4 0v4" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Tem festa hoje! 🎉</h2>
              <p className="text-gray-600 mb-6">Hoje é o aniversário de:</p>

              <div className="w-full flex flex-col gap-3 mb-8">
                {aniversariantesHoje.map((aniv: any, i: number) => (
                  <div
                    key={i}
                    className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex items-center justify-center"
                  >
                    <span className="font-bold text-lg text-gray-900 capitalize">
                      {typeof aniv.nome === 'string' ? aniv.nome.toLowerCase() : aniv.nome}
                    </span>
                  </div>
                ))}
              </div>

              <button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors"
                onClick={() => setShowBirthdayModal(false)}
              >
                Parabenizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
