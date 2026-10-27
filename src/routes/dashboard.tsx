import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { subDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { getUserEnvironmentAccess, hasEnvironmentAccess } from '../lib/environmentAccess'
import '../hydro-panel.css'

export const Route = createFileRoute('/dashboard')({
  component: DashboardComponent,
})

interface NavItemDef {
  id: string
  label: string
  badge?: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItemDef[] = [
  {
    id: 'inicio',
    label: 'Início',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </svg>
    ),
  },
  {
    id: 'lembretes',
    label: 'Lembretes',
    badge: '3',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
        <path d="M10.3 21a2 2 0 0 0 3.4 0" />
      </svg>
    ),
  },
  {
    id: 'instagram',
    label: 'Instagram',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r=".6" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'almoxarifado',
    label: 'Almoxarifado',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
        <path d="m3 8 9 5 9-5M12 13v8" />
      </svg>
    ),
  },
  {
    id: 'documentos',
    label: 'Documentos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
      </svg>
    ),
  },
  {
    id: 'equipamentos',
    label: 'Equipamentos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M3 16V8h11v8M14 10h4l3 3v3h-7" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="17" cy="18" r="2" />
      </svg>
    ),
  },
  {
    id: 'seguranca',
    label: 'Segurança',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10Z" />
        <path d="m9 11.5 2 2 4-4" />
      </svg>
    ),
  },
  {
    id: 'rh',
    label: 'RH',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 15.3c2 .6 3.5 2.1 4 4.7" />
      </svg>
    ),
  },
  {
    id: 'relatorio-obra',
    label: 'Relatório de Obra',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
      </svg>
    ),
  },
  {
    id: 'meio-ambiente',
    label: 'Meio Ambiente',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 21c-5 0-8-3-8-8 0-6 5-10 12-11-1 8-3 13-8 15 3 1 6 0 8-2-1 4-2 6-4 6Z" />
        <path d="M4 21c2-4 5-7 9-9" />
      </svg>
    ),
  },
  {
    id: 'planejamento',
    label: 'Planejamento',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    id: 'reunioes',
    label: 'Reuniões',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 15.3c2 .6 3.5 2.1 4 4.7" />
      </svg>
    ),
  },
]

function DashboardComponent() {
  const navigate = useNavigate()

  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [activeItem, setActiveItem] = useState('inicio')
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Nav sliding page layer
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [pageStyle, setPageStyle] = useState<React.CSSProperties>({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  })
  const [isPageReady, setIsPageReady] = useState(false)

  // Auth & Environment Check
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
        .select('id, nome, avatar_url, raw_data, status')
      if (error) throw error
      return data || []
    },
    staleTime: 5 * 60 * 1000,
  })

  const activeEmployees = efetivo.filter(
    (e: any) => e.status !== 'REMOVIDO' && e.status !== 'INATIVO'
  )
  const totalFuncionarios = activeEmployees.length > 0 ? activeEmployees.length : 48
  const displayPresentes = todayData.presentes > 0 ? todayData.presentes : 16
  const displayAusencias = todayData.ausencias >= 0 ? todayData.ausencias : 0
  const pctPresenca = Math.round((displayPresentes / totalFuncionarios) * 100) || 33
  const pctAusencia = Math.round((displayAusencias / totalFuncionarios) * 100) || 0

  // Donut arc lengths
  const c = 251.3
  const presencaTarget = c - (c * pctPresenca) / 100
  const ausenciaTarget = c - (c * pctAusencia) / 100

  // Date formatted strings matching reference "27 de outubro de 2026, Terça-feira, Barcarena - PA"
  const dayNumber = format(new Date(), 'dd')
  const monthName = format(new Date(), 'MMMM', { locale: ptBR })
  const yearNumber = format(new Date(), 'yyyy')
  const weekdayRaw = format(new Date(), 'EEEE', { locale: ptBR })
  const weekdayFormatted = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1).toLowerCase()
  const datePillString = `${dayNumber} de ${monthName} de ${yearNumber}`

  const rawName = currentUser?.user_metadata?.full_name || currentUser?.name || 'Fabrício'
  const firstName = rawName.split(' ')[0]
  const displayFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
  const avatarLetter = displayFirstName.charAt(0).toUpperCase() || 'F'

  // Update sliding white page layer position
  const updatePagePosition = (targetEl: HTMLElement | null) => {
    if (!targetEl) return
    const mobile = window.innerWidth <= 900
    if (mobile) {
      setPageStyle({
        top: targetEl.offsetTop,
        left: targetEl.offsetLeft,
        width: targetEl.offsetWidth,
        height: targetEl.offsetHeight,
      })
    } else {
      const extra = 3
      const inset = 8
      const sidePad = window.innerWidth <= 1100 ? 12 : 16
      setPageStyle({
        top: targetEl.offsetTop - extra,
        left: targetEl.offsetLeft + inset,
        width: targetEl.offsetWidth - inset + sidePad,
        height: targetEl.offsetHeight + extra * 2,
      })
    }
    setIsPageReady(true)
  }

  useEffect(() => {
    const activeIdx = NAV_ITEMS.findIndex((item) => item.id === activeItem)
    const el = itemRefs.current[activeIdx] || itemRefs.current[0]
    updatePagePosition(el)

    const handleResize = () => {
      const currentIdx = NAV_ITEMS.findIndex((item) => item.id === activeItem)
      const currentEl = itemRefs.current[currentIdx] || itemRefs.current[0]
      updatePagePosition(currentEl)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [activeItem, isSidebarCollapsed])

  // Click on nav item: moves the white selection without changing content
  const handleNavClick = (id: string, idx: number) => {
    setActiveItem(id)
    const el = itemRefs.current[idx]
    updatePagePosition(el)
  }

  // Close notifications on Esc or outside click
  const notifRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsNotifOpen(false)
    }
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [])

  // 6 Participantes da Reunião
  const people = [
    { name: 'Alessandra Souza Chaves', initial: 'AS', bg: '#7C5C00' },
    { name: 'Danieli Farias', initial: 'DF', bg: '#0E7490' },
    { name: `Você (${displayFirstName})`, initial: avatarLetter, bg: '#14243E' },
    { name: 'Tiago Augusto Rosa Machado', initial: 'TM', bg: '#15803D' },
    { name: 'Luis Carlos Passos Araujo', initial: 'LA', bg: '#B45309' },
    { name: 'Alexssandro Chaves', initial: 'AC', bg: '#6D28D9' },
  ]

  // Pendências
  const pendencias = [
    {
      id: 'pend-1',
      name: 'Fabio Genilson Fernandes Dos Remedios',
      detail: 'Contrato / Documentação',
      tag: 'Vencido',
      urgent: true,
    },
    {
      id: 'pend-2',
      name: 'Creiane Alcantara Navegantes',
      detail: 'ASO / Documentação',
      tag: '10 dias',
      urgent: false,
    },
  ]

  // Quick access items
  const quickItems = [
    {
      id: 'documentos',
      name: 'documentos',
      label: 'Documentos',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6" />
        </svg>
      ),
    },
    {
      id: 'equipamentos',
      name: 'equipamentos',
      label: 'Equipamentos',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 16V8h11v8M14 10h4l3 3v3h-7" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="17" cy="18" r="2" />
        </svg>
      ),
    },
    {
      id: 'almoxarifado',
      name: 'almoxarifado',
      label: 'Almoxarifado',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
          <path d="m3 8 9 5 9-5M12 13v8" />
        </svg>
      ),
    },
    {
      id: 'relatorio-obra',
      name: 'relatorios relatorio de obra',
      label: 'Relatórios',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
        </svg>
      ),
    },
    {
      id: 'planejamento',
      name: 'planejamento',
      label: 'Planejamento',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      ),
    },
    {
      id: 'reunioes',
      name: 'reunioes',
      label: 'Reuniões',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 15.3c2 .6 3.5 2.1 4 4.7" />
        </svg>
      ),
    },
  ]

  // Normalization for search filtering
  const norm = (s: string) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  const q = norm(searchQuery.trim())

  const filteredPeople = people.filter((p) => !q || norm(p.name).includes(q))
  const filteredPend = pendencias.filter((p) => !q || norm(p.name).includes(q) || norm(p.detail).includes(q))
  const filteredQuick = quickItems.filter((item) => !q || norm(item.name).includes(q) || norm(item.label).includes(q))
  const hasSearchResults = filteredPeople.length > 0 || filteredPend.length > 0 || filteredQuick.length > 0

  return (
    <div className={`app hydro-dashboard-root ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* ==========================================================
          SIDEBAR — FIXA, PRETA #0B0B0C, OMBROS CONVEXOS EM SVG
          ========================================================== */}
      <aside className="sidebar" id="sidebar">
        {/* Marca: HYDRO em branco, REABILITAÇÃO em amarelo, sem ícone de folha */}
        <div className="brand">
          <div className="brand-name">
            <b>HYDRO</b>
            <span>REABILITAÇÃO</span>
          </div>
        </div>

        {/* Lista contínua de navegação com faixa branca estreita deslizante */}
        <nav aria-label="Navegação principal" id="mainNav">
          <div
            className={`nav-page ${isPageReady ? 'ready' : ''}`}
            id="navPage"
            style={pageStyle}
            aria-hidden="true"
          />
          {NAV_ITEMS.map((item, idx) => {
            const isActive = activeItem === item.id
            return (
              <button
                key={item.id}
                ref={(el) => {
                  itemRefs.current[idx] = el
                }}
                type="button"
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavClick(item.id, idx)}
              >
                {item.icon}
                {item.label}
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </button>
            )
          })}
        </nav>

        {/* Cartão de rodapé amarelo com escudo */}
        <div className="sidebar-foot">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
            <path d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10Z" />
            <path d="m9 11.5 2 2 4-4" />
          </svg>
          <p>Juntos por um ambiente mais seguro</p>
          <small>Segurança é responsabilidade de todos, todos os dias.</small>
        </div>
      </aside>

      {/* ==========================================================
          BOTÃO REDONDO AMARELO DE ESCONDER / EXPANDIR A BARRA
          ========================================================== */}
      <button
        className="sidebar-toggle"
        id="sidebarToggle"
        type="button"
        aria-label={isSidebarCollapsed ? 'Expandir barra lateral' : 'Ocultar barra lateral'}
        aria-expanded={!isSidebarCollapsed}
        aria-controls="sidebar"
        title={isSidebarCollapsed ? 'Expandir barra lateral' : 'Ocultar barra lateral'}
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
        </svg>
      </button>

      {/* ==========================================================
          CONTEÚDO PRINCIPAL (MAIN)
          ========================================================== */}
      <div className="main">
        {/* Topbar: busca, sino com selo 3, calendário e perfil */}
        <header className="topbar">
          <label className="search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              id="searchInput"
              type="search"
              placeholder="Buscar colaboradores, documentos, equipamentos…"
              aria-label="Buscar no painel"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>

          <div className="top-actions" ref={notifRef}>
            <div className="notif-wrap">
              <button
                className="icon-btn"
                id="bellBtn"
                type="button"
                aria-label="Notificações, 3 não lidas"
                aria-expanded={isNotifOpen}
                onClick={(e) => {
                  e.stopPropagation()
                  setIsNotifOpen(!isNotifOpen)
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
                  <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
                  <path d="M10.3 21a2 2 0 0 0 3.4 0" />
                </svg>
                <span className="dot-badge">3</span>
              </button>

              <div
                className={`notif-panel ${isNotifOpen ? 'open' : ''}`}
                id="notifPanel"
                role="dialog"
                aria-label="Notificações"
              >
                <h3>Notificações</h3>
                <div className="notif-item">
                  <div
                    className="n-ico"
                    style={{ background: 'var(--yellow-soft)', color: 'var(--yellow-dark)' }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 2" />
                    </svg>
                  </div>
                  <div>
                    <b>Reunião de Contrato Hydro</b>
                    <p>6 participantes confirmados como presentes hoje.</p>
                  </div>
                </div>

                <div className="notif-item">
                  <div
                    className="n-ico"
                    style={{ background: 'var(--red-bg)', color: 'var(--red)' }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 3 2 20h20L12 3Z" />
                      <path d="M12 10v4M12 17.5v.5" />
                    </svg>
                  </div>
                  <div>
                    <b>Documento vencido</b>
                    <p>Fabio Genilson Fernandes Dos Remedios — Contrato / Documentação.</p>
                  </div>
                </div>

                <div className="notif-item">
                  <div
                    className="n-ico"
                    style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <rect x="3" y="5" width="18" height="16" rx="2" />
                      <path d="M3 10h18M8 3v4M16 3v4" />
                    </svg>
                  </div>
                  <div>
                    <b>Vence em 10 dias</b>
                    <p>Creiane Alcantara Navegantes — ASO / Documentação.</p>
                  </div>
                </div>
              </div>
            </div>

            <button className="icon-btn" aria-label="Calendário" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18M8 3v4M16 3v4" />
              </svg>
            </button>

            <div className="user-chip">
              <div className="avatar-f" aria-hidden="true">
                {avatarLetter}
              </div>
              <div>
                <b>Olá, {displayFirstName}</b>
                <span>Visão geral da operação</span>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>
        </header>

        {/* ==========================================================
            HERO BANNER
            ========================================================== */}
        <section className="hero" aria-label="Boas-vindas">
          <img
            className="bg"
            src="/hero-excavator.webp"
            alt="Operação Hydro Reabilitação com escavadeira"
          />
          <div className="hero-overlay" />
          <div className="hero-content">
            <span className="hero-kicker">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
              </svg>
              OPERAÇÃO EM DIA
            </span>
            <h1>Olá, {displayFirstName}!</h1>
            <p>Tudo certo na operação. Vamos juntos por mais segurança e resultados!</p>
            <div className="hero-meta">
              <span className="pill">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                {datePillString}
              </span>
              <span className="pill">{weekdayFormatted}</span>
              <span className="pill">Barcarena · PA</span>
            </div>
          </div>
          <div className="hero-script" aria-hidden="true">
            Segurança
            <br />
            é o nosso maior
            <br />
            resultado!
          </div>
        </section>

        {/* ==========================================================
            KPIS
            ========================================================== */}
        <section className="kpis" aria-label="Indicadores de hoje">
          {/* Card 1: Total Funcionários */}
          <article className="kpi">
            <div className="kpi-head">
              <div
                className="kpi-ico"
                style={{ background: 'var(--yellow-soft)', color: 'var(--yellow-dark)' }}
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
              <div className="kpi-big">{totalFuncionarios}</div>
              <div className="kpi-sub">colaboradores no quadro</div>
              <span className="trend">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="m5 12 7-7 7 7M12 5v14" />
                </svg>
                +2 vs. mês anterior
              </span>
            </div>
          </article>

          {/* Card 2: Presentes hoje */}
          <article className="kpi">
            <div className="kpi-head">
              <div
                className="kpi-ico"
                style={{ background: 'var(--green-bg)', color: 'var(--green)' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="m16 11 2 2 4-4" />
                </svg>
              </div>
              <span>
                Presentes
                <br />
                hoje
              </span>
            </div>
            <div className="kpi-body">
              <div
                className="donut"
                role="img"
                aria-label={`${displayPresentes} de ${totalFuncionarios} presentes, ${pctPresenca} por cento de presença`}
              >
                <svg width="96" height="96" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="40" fill="none" stroke="#EAF7EE" strokeWidth={8} />
                  <circle
                    className="donut-arc"
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke="var(--green-ring)"
                    strokeWidth={8}
                    strokeDasharray="251.3"
                    strokeDashoffset={presencaTarget}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                  />
                </svg>
                <div className="donut-center">
                  <b>{displayPresentes}</b>
                  <span>de {totalFuncionarios}</span>
                </div>
              </div>
              <div className="kpi-foot" style={{ flex: 1 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <path d="m9 11 3 3L22 4" />
                </svg>
                <div>
                  <b>{displayPresentes} presentes</b>
                  <span> · {pctPresenca}% de presença</span>
                </div>
              </div>
            </div>
          </article>

          {/* Card 3: Ausências */}
          <article className="kpi">
            <div className="kpi-head">
              <div className="kpi-ico" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="m17 8 5 5M22 8l-5 5" />
                </svg>
              </div>
              <span>
                Ausências
                <br />
                hoje
              </span>
            </div>
            <div className="kpi-body">
              <div
                className="donut"
                role="img"
                aria-label={`${displayAusencias} de ${totalFuncionarios} ausências, ${pctAusencia} por cento`}
              >
                <svg width="96" height="96" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="40" fill="none" stroke="#FEF2F2" strokeWidth={8} />
                  <circle
                    className="donut-arc"
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke="var(--red-ring)"
                    strokeWidth={8}
                    strokeDasharray="251.3"
                    strokeDashoffset={ausenciaTarget}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                  />
                </svg>
                <div className="donut-center">
                  <b>{displayAusencias}</b>
                  <span>de {totalFuncionarios}</span>
                </div>
              </div>
              <div className="kpi-foot red" style={{ flex: 1 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="m15 9-6 6M9 9l6 6" />
                </svg>
                <div>
                  <b>{displayAusencias} ausências</b>
                  <span> · {pctAusencia}% de ausências</span>
                </div>
              </div>
            </div>
          </article>
        </section>

        {/* ==========================================================
            CONTENT GRID
            ========================================================== */}
        <div className="content-grid">
          {/* Coluna da esquerda: Lembretes, Reunião e Pendências */}
          <section className="card card-pad" aria-label="Lembretes para hoje">
            <div className="card-head">
              <div className="ch-ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M3 10h18M8 3v4M16 3v4" />
                </svg>
              </div>
              <div>
                <h2>Lembretes para hoje</h2>
                <p>Reunião, vencimentos e pendências em um só lugar</p>
              </div>
              <button
                type="button"
                className="link-all"
                onClick={() => handleNavClick('lembretes', 1)}
              >
                Ver todos{' '}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Reunião de Contrato Hydro */}
            <div className="meeting">
              <div className="meeting-top">
                <span className="m-dot" />
                <h3>Reunião de Contrato Hydro</h3>
                <time>08:00 – 09:30</time>
              </div>
              <div className="people" id="peopleList">
                {filteredPeople.map((p, i) => (
                  <div key={i} className="person" data-name={norm(p.name)}>
                    <div className="p-ava" style={{ background: p.bg }}>
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

            {/* Seção Vencimentos e pendências */}
            <div className="section-divider">
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
              <button
                type="button"
                className="link-all"
                onClick={() => handleNavClick('documentos', 4)}
              >
                Ver todos{' '}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </button>
              <span className="count-badge" aria-label="2 pendências">
                2
              </span>
            </div>

            <div className="pend-list" id="pendList">
              {filteredPend.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`pend ${p.urgent ? 'urgent' : ''}`}
                  data-name={norm(p.name)}
                >
                  <span className="pend-ico">
                    {p.urgent ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M12 3 2 20h20L12 3Z" />
                        <path d="M12 10v4M12 17.5v.5" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                        <path d="M14 2v6h6" />
                      </svg>
                    )}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b>{p.name}</b>
                    <span>{p.detail}</span>
                  </span>
                  <span className={`pend-tag ${p.urgent ? 'tag-red' : 'tag-amber'}`}>{p.tag}</span>
                  <svg
                    className="chev"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.4}
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              ))}
            </div>

            {!hasSearchResults && (
              <p
                id="searchEmpty"
                style={{
                  margin: '14px 0 0',
                  fontSize: '13.5px',
                  color: 'var(--muted)',
                  fontStyle: 'italic',
                }}
              >
                Nenhum colaborador, documento ou item encontrado para "{searchQuery}".
              </p>
            )}
          </section>

          {/* Coluna da direita: Cartão de segurança e Clima */}
          <div className="side-stack">
            <section className="safety" aria-label="Segurança em primeiro lugar">
              <img src="/safety-helmet.webp" alt="Capacete de segurança na obra" />
              <div className="safety-body">
                <span className="s-kicker">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10Z" />
                    <path d="m9 11.5 2 2 4-4" />
                  </svg>
                  SEGURANÇA DO TRABALHO
                </span>
                <h3>Segurança em primeiro lugar</h3>
                <p>Trabalhar com segurança é cuidar de você, da sua família e do nosso futuro.</p>
                <button
                  type="button"
                  className="safety-btn"
                  onClick={() => handleNavClick('seguranca', 6)}
                >
                  Juntos somos mais fortes{' '}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </section>

            <section className="card weather" aria-label="Clima em Barcarena">
              <div className="weather-top">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
                Previsão do tempo · Barcarena
              </div>
              <div className="weather-main">
                <div>
                  <b>33°C</b>
                  <small>Céu claro</small>
                </div>
                <div className="weather-range">
                  <div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="5" />
                      <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2" />
                    </svg>
                    Máx: <b>34°</b>
                  </div>
                  <div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 9a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0v-8a3 3 0 0 0-3-3Z" />
                      <path d="M12 3v3" />
                    </svg>
                    Mín: <b>24°</b>
                  </div>
                </div>
              </div>
              <p
                style={{
                  margin: '14px 0 0',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--line2)',
                  fontSize: '12.5px',
                  color: 'var(--muted)',
                  fontWeight: 600,
                }}
              >
                Umidade: 68% · Vento: 11 km/h
              </p>
            </section>
          </div>
        </div>

        {/* ==========================================================
            QUICK ACCESS NO RODAPÉ
            ========================================================== */}
        <section className="quick" aria-label="Acesso rápido">
          <div className="quick-label">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
            </svg>
            Acesso rápido
          </div>
          <div className="quick-items" id="quickItems">
            {filteredQuick.map((item) => (
              <button
                key={item.id}
                type="button"
                className="quick-item"
                data-name={item.name}
                onClick={() => {
                  const targetIdx = NAV_ITEMS.findIndex((n) => n.id === item.id)
                  if (targetIdx !== -1) {
                    handleNavClick(item.id, targetIdx)
                  }
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </section>

        {/* ==========================================================
            FOOTER
            ========================================================== */}
        <footer>
          <span>
            <b>HYDRO REABILITAÇÃO</b> &nbsp;·&nbsp; Painel da operação — {weekdayFormatted.toLowerCase()},{' '}
            {datePillString}
          </span>
          <span className="foot-brand">
            <b style={{ letterSpacing: '.04em' }}>Mais segurança. Mais resultados.</b>
          </span>
        </footer>
      </div>
    </div>
  )
}
