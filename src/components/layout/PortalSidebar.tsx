import { Link, useLocation } from '@tanstack/react-router'
import { usePermissions } from '../../hooks/usePermissions'
import { MODULES } from '../../lib/permissions'
import X from 'lucide-react/dist/esm/icons/x.js'

interface PortalSidebarProps {
  currentUserId?: string
  isOpen?: boolean
  onClose?: () => void
}

interface NavSection {
  title: string
  items: {
    id: string
    label: string
    href: string
    routeMatch: string
    badge?: string
    svgPath: React.ReactNode
  }[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Principal',
    items: [
      {
        id: 'dashboard',
        label: 'Início',
        href: '/dashboard',
        routeMatch: '/dashboard',
        svgPath: (
          <>
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V21h14V9.5" />
          </>
        ),
      },
      {
        id: 'lembretes',
        label: 'Lembretes',
        href: '/lembretes',
        routeMatch: '/lembretes',
        badge: '3',
        svgPath: (
          <>
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
            <path d="M10.3 21a2 2 0 0 0 3.4 0" />
          </>
        ),
      },
    ],
  },
  {
    title: 'Operação',
    items: [
      {
        id: 'instacena',
        label: 'Instagram',
        href: '/instacena',
        routeMatch: '/instacena',
        svgPath: (
          <>
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.2" cy="6.8" r=".6" fill="currentColor" />
          </>
        ),
      },
      {
        id: 'almoxarifado',
        label: 'Almoxarifado',
        href: '/almoxarifado',
        routeMatch: '/almoxarifado',
        svgPath: (
          <>
            <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
            <path d="m3 8 9 5 9-5M12 13v8" />
          </>
        ),
      },
      {
        id: 'documentos',
        label: 'Documentos',
        href: '/documentos',
        routeMatch: '/documentos',
        svgPath: (
          <>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
            <path d="M14 2v6h6" />
          </>
        ),
      },
      {
        id: 'equipamentos',
        label: 'Equipamentos',
        href: '/equipamentos',
        routeMatch: '/equipamentos',
        svgPath: (
          <>
            <path d="M3 16V8h11v8M14 10h4l3 3v3h-7" />
            <circle cx="7" cy="18" r="2" />
            <circle cx="17" cy="18" r="2" />
          </>
        ),
      },
      {
        id: 'seguranca',
        label: 'Segurança',
        href: '/seguranca',
        routeMatch: '/seguranca',
        svgPath: (
          <>
            <path d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10Z" />
            <path d="m9 11.5 2 2 4-4" />
          </>
        ),
      },
    ],
  },
  {
    title: 'Gestão',
    items: [
      {
        id: 'rh',
        label: 'RH',
        href: '/rh',
        routeMatch: '/rh',
        svgPath: (
          <>
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 15.3c2 .6 3.5 2.1 4 4.7" />
          </>
        ),
      },
      {
        id: 'relatorio-obra',
        label: 'Relatório de Obra',
        href: '/relatorio-obra',
        routeMatch: '/relatorio-obra',
        svgPath: (
          <>
            <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
          </>
        ),
      },
      {
        id: 'meio-ambiente',
        label: 'Meio Ambiente',
        href: '/meio-ambiente',
        routeMatch: '/meio-ambiente',
        svgPath: (
          <>
            <path d="M12 21c-5 0-8-3-8-8 0-6 5-10 12-11-1 8-3 13-8 15 3 1 6 0 8-2-1 4-2 6-4 6Z" />
            <path d="M4 21c2-4 5-7 9-9" />
          </>
        ),
      },
      {
        id: 'planejamento',
        label: 'Planejamento',
        href: '/permissao-trabalho',
        routeMatch: '/permissao-trabalho',
        svgPath: (
          <>
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </>
        ),
      },
      {
        id: 'reunioes',
        label: 'Reuniões',
        href: '/reunioes',
        routeMatch: '/reunioes',
        svgPath: (
          <>
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 15.3c2 .6 3.5 2.1 4 4.7" />
          </>
        ),
      },
    ],
  },
]

export function PortalSidebar({ currentUserId, isOpen = false, onClose }: PortalSidebarProps) {
  const location = useLocation()
  const currentPath = location.pathname
  const { canView } = usePermissions(currentUserId || '')

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Floating Dark Rounded Sidebar matching Painel Hydro Reabilitação (1).html */}
      <aside
        className={`hydro-sidebar ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } transition-transform duration-300`}
      >
        {/* Brand Header */}
        <div className="hydro-brand justify-between">
          <Link to="/dashboard" onClick={onClose} className="hydro-brand-name flex flex-col no-underline">
            <b>HYDRO</b>
            <span>REABILITAÇÃO</span>
          </Link>

          {/* Close button on mobile */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1 text-[#8A8A93] hover:text-white rounded-lg transition-colors border-0 bg-transparent cursor-pointer"
              aria-label="Fechar menu"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Navigation Sections */}
        <nav aria-label="Navegação principal" id="mainNav" className="flex flex-col gap-1 flex-1">
          {NAV_SECTIONS.map((section) => {
            const filteredItems = section.items.filter((item) => {
              const isControlled = MODULES.some((m) => m.id === item.id)
              return isControlled ? canView(item.id) : true
            })

            if (filteredItems.length === 0) return null

            return (
              <div key={section.title} className="flex flex-col">
                <div className="hydro-nav-label">{section.title}</div>
                {filteredItems.map((item) => {
                  const isActive =
                    item.id === 'dashboard'
                      ? currentPath === '/dashboard' || currentPath === '/dashboard/'
                      : currentPath.startsWith(item.routeMatch)

                  return (
                    <Link
                      key={item.id}
                      to={item.href}
                      onClick={onClose}
                      className={`hydro-nav-item ${isActive ? 'active' : ''}`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        {item.svgPath}
                      </svg>
                      <span>{item.label}</span>
                      {item.badge && <span className="hydro-nav-badge">{item.badge}</span>}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* Bottom Safety Box */}
        <div className="hydro-sidebar-foot">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
            <path d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10Z" />
            <path d="m9 11.5 2 2 4-4" />
          </svg>
          <p>Juntos por um ambiente mais seguro</p>
          <small>Segurança é responsabilidade de todos, todos os dias.</small>
        </div>
      </aside>
    </>
  )
}
