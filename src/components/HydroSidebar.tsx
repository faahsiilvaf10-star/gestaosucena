import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { toast } from 'sonner'
import { AVAILABLE_ENVIRONMENTS } from '../lib/environmentAccess'
import '../hydro-panel.css'

export interface NavItemDef {
  id: string
  label: string
  href: string
  badge?: string
  icon: React.ReactNode
}

export const NAV_ITEMS: NavItemDef[] = [
  {
    id: 'destaques',
    label: 'DESTAQUES',
    href: '/dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </svg>
    ),
  },
  {
    id: 'lembretes',
    label: 'LEMBRETES',
    href: '/lembretes',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
        <path d="M10.3 21a2 2 0 0 0 3.4 0" />
      </svg>
    ),
  },
  {
    id: 'instacena',
    label: 'INSTACENA',
    href: '/instacena',
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
    label: 'ALMOXARIFADO',
    href: '/almoxarifado',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
        <path d="m3 8 9 5 9-5M12 13v8" />
      </svg>
    ),
  },
  {
    id: 'documentos',
    label: 'DOCUMENTOS',
    href: '/documentos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
      </svg>
    ),
  },
  {
    id: 'equipamentos',
    label: 'EQUIPAMENTOS',
    href: '/equipamentos',
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
    label: 'SEGURANÇA',
    href: '/seguranca',
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
    href: '/rh',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 15.3c2 .6 3.5 2.1 4 4.7" />
      </svg>
    ),
  },
  {
    id: 'relatorio-obra',
    label: 'RELATÓRIO DE OBRA',
    href: '/relatorio-obra',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
      </svg>
    ),
  },
  {
    id: 'meio-ambiente',
    label: 'MEIO AMBIENTE',
    href: '/meio-ambiente',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 21c-5 0-8-3-8-8 0-6 5-10 12-11-1 8-3 13-8 15 3 1 6 0 8-2-1 4-2 6-4 6Z" />
        <path d="M4 21c2-4 5-7 9-9" />
      </svg>
    ),
  },
  {
    id: 'planejamento',
    label: 'PLANEJAMENTO',
    href: '/relatorio-obra/rdo',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    id: 'reunioes',
    label: 'REUNIÕES',
    href: '/reunioes',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 15.3c2 .6 3.5 2.1 4 4.7" />
      </svg>
    ),
  },
  {
    id: 'emergencia',
    label: 'EMERGÊNCIA',
    href: '/emergencia',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    id: 'admin',
    label: 'ADMINISTRAÇÃO',
    href: '/admin',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
]

interface HydroSidebarProps {
  isSidebarCollapsed: boolean
  setIsSidebarCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void
}

export function HydroSidebar({ isSidebarCollapsed, setIsSidebarCollapsed }: HydroSidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const path = location.pathname

  // Determine active item by current URL path
  const activeIdx = useMemo(() => {
    if (path === '/dashboard' || path === '/dashboard/') {
      return 0
    }
    // Specific match for Planejamento -> /relatorio-obra/rdo
    if (path.startsWith('/relatorio-obra/rdo')) {
      const planIdx = NAV_ITEMS.findIndex((item) => item.id === 'planejamento')
      if (planIdx !== -1) return planIdx
    }
    const foundIdx = NAV_ITEMS.findIndex((item) => {
      if (item.href === '#' || item.href === '/dashboard' || item.id === 'planejamento') return false
      return path.startsWith(item.href)
    })
    return foundIdx !== -1 ? foundIdx : 0
  }, [path])

  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [pageStyle, setPageStyle] = useState<React.CSSProperties>({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  })
  const [isPageReady, setIsPageReady] = useState(false)

  // Update sliding white page layer position
  const updatePagePosition = (targetEl: HTMLElement | null) => {
    if (!targetEl) return
    const mobile = typeof window !== 'undefined' && window.innerWidth <= 900
    if (mobile) {
      setPageStyle({
        top: targetEl.offsetTop,
        left: targetEl.offsetLeft,
        width: targetEl.offsetWidth,
        height: targetEl.offsetHeight,
      })
      try {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } catch (_) {}
    } else {
      const extra = 3
      const inset = 8
      const sidePad = typeof window !== 'undefined' && window.innerWidth <= 1100 ? 12 : 16
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
    const el = itemRefs.current[activeIdx] || itemRefs.current[0]
    updatePagePosition(el)

    const handleResize = () => {
      const currentEl = itemRefs.current[activeIdx] || itemRefs.current[0]
      updatePagePosition(currentEl)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [activeIdx, isSidebarCollapsed])

  const handleNavClick = (item: NavItemDef, idx: number) => {
    const el = itemRefs.current[idx]
    updatePagePosition(el)

    if (item.href === '#') {
      toast.info('Módulo de Planejamento em desenvolvimento.')
      return
    }

    if (item.href && path !== item.href) {
      navigate({ to: item.href as any })
    }
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      setIsSidebarCollapsed(true)
    }
  }

  // Ambiente selecionado
  const [currentEnv, setCurrentEnv] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sucena_environment') || 'barcarena'
    }
    return 'barcarena'
  })

  useEffect(() => {
    const handleEnvChange = (e: any) => {
      const newEnv = e?.detail || localStorage.getItem('sucena_environment') || 'barcarena'
      setCurrentEnv(newEnv)
    }

    window.addEventListener('sucena_environment_change', handleEnvChange)
    window.addEventListener('storage', handleEnvChange)
    return () => {
      window.removeEventListener('sucena_environment_change', handleEnvChange)
      window.removeEventListener('storage', handleEnvChange)
    }
  }, [])

  const { brandTitle, brandSubtitle } = useMemo(() => {
    const envObj = AVAILABLE_ENVIRONMENTS.find((e) => e.id === currentEnv)
    const envName = envObj?.name || (currentEnv === 'hydro-civil' ? 'HYDRO CIVIL' : 'HYDRO REABILITAÇÃO')
    const parts = envName.split(' ')
    const title = parts[0] || 'HYDRO'
    const subtitle = parts.slice(1).join(' ') || (currentEnv === 'hydro-civil' ? 'CIVIL' : 'REABILITAÇÃO')
    return { brandTitle: title, brandSubtitle: subtitle }
  }, [currentEnv])

  return (
    <>
      {/* ==========================================================
          SIDEBAR — FIXA, PRETA #0B0B0C, OMBROS CONVEXOS EM SVG
          ========================================================== */}
      {/* Backdrop overlay para fechar o menu no celular */}
      {!isSidebarCollapsed && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={() => setIsSidebarCollapsed(true)}
          aria-hidden="true"
        />
      )}

      <aside className="sidebar" id="sidebar">
        {/* Marca dinâmica conforme o ambiente selecionado */}
        <div className="brand cursor-pointer" onClick={() => navigate({ to: '/dashboard' as any })}>
          <div className="brand-name">
            <b>{brandTitle}</b>
            <span>{brandSubtitle}</span>
          </div>
        </div>

        {/* Lista contínua de 14 itens com faixa branca estreita deslizante */}
        <nav aria-label="Navegação principal" id="mainNav">
          <div
            className={`nav-page ${isPageReady ? 'ready' : ''}`}
            id="navPage"
            style={pageStyle}
            aria-hidden="true"
          />
          {NAV_ITEMS.map((item, idx) => {
            const isActive = activeIdx === idx
            return (
              <button
                key={item.id}
                ref={(el) => {
                  itemRefs.current[idx] = el
                }}
                type="button"
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavClick(item, idx)}
              >
                {item.icon}
                {item.label}
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </button>
            )
          })}
        </nav>

        {/* Rodapé da sidebar: cartão amarelo com cantos arredondados */}
        <div className="sidebar-foot">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
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
        onClick={() => {
          setIsSidebarCollapsed((prev) => {
            const next = !prev
            try {
              localStorage.setItem('hydro_sidebar_collapsed', String(next))
            } catch {}
            return next
          })
        }}
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
    </>
  )
}
