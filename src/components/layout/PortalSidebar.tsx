import Home from 'lucide-react/dist/esm/icons/house.js'
import Star from 'lucide-react/dist/esm/icons/star.js'
import Bell from 'lucide-react/dist/esm/icons/bell.js'
import Instagram from 'lucide-react/dist/esm/icons/instagram.js'
import Package from 'lucide-react/dist/esm/icons/package.js'
import FileText from 'lucide-react/dist/esm/icons/file-text.js'
import Truck from 'lucide-react/dist/esm/icons/truck.js'
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js'
import Users from 'lucide-react/dist/esm/icons/users.js'
import BarChart2 from 'lucide-react/dist/esm/icons/chart-no-axes-column.js'
import Leaf from 'lucide-react/dist/esm/icons/leaf.js'
import Calendar from 'lucide-react/dist/esm/icons/calendar.js'
import Video from 'lucide-react/dist/esm/icons/video.js'
import Shield from 'lucide-react/dist/esm/icons/shield.js'
import X from 'lucide-react/dist/esm/icons/x.js'
import { Link, useLocation } from '@tanstack/react-router'
import { usePermissions } from '../../hooks/usePermissions'
import { MODULES } from '../../lib/permissions'

interface PortalSidebarProps {
  currentUserId?: string
  isOpen?: boolean
  onClose?: () => void
}

export const PORTAL_MENU_ITEMS = [
  { id: 'dashboard', label: 'Início', href: '/dashboard', icon: Home, routeMatch: '/dashboard' },
  { id: 'destaques', label: 'Destaques', href: '/dashboard', icon: Star, routeMatch: '/destaques' },
  { id: 'lembretes', label: 'Lembretes', href: '/lembretes', icon: Bell, routeMatch: '/lembretes', badge: '3' },
  { id: 'instacena', label: 'Instagram', href: '/instacena', icon: Instagram, routeMatch: '/instacena' },
  { id: 'almoxarifado', label: 'Almoxarifado', href: '/almoxarifado', icon: Package, routeMatch: '/almoxarifado' },
  { id: 'documentos', label: 'Documentos', href: '/documentos', icon: FileText, routeMatch: '/documentos' },
  { id: 'equipamentos', label: 'Equipamentos', href: '/equipamentos', icon: Truck, routeMatch: '/equipamentos' },
  { id: 'seguranca', label: 'Segurança', href: '/seguranca', icon: ShieldCheck, routeMatch: '/seguranca' },
  { id: 'rh', label: 'RH', href: '/rh', icon: Users, routeMatch: '/rh' },
  { id: 'relatorio-obra', label: 'Relatório de Obra', href: '/relatorio-obra', icon: BarChart2, routeMatch: '/relatorio-obra' },
  { id: 'meio-ambiente', label: 'Meio Ambiente', href: '/meio-ambiente', icon: Leaf, routeMatch: '/meio-ambiente' },
  { id: 'planejamento', label: 'Planejamento', href: '/permissao-trabalho', icon: Calendar, routeMatch: '/permissao-trabalho' },
  { id: 'reunioes', label: 'Reuniões', href: '/reunioes', icon: Video, routeMatch: '/reunioes' },
]

export function PortalSidebar({ currentUserId, isOpen = false, onClose }: PortalSidebarProps) {
  const location = useLocation()
  const currentPath = location.pathname
  const { canView } = usePermissions(currentUserId || '')

  const visibleItems = PORTAL_MENU_ITEMS.filter((item) => {
    const isControlled = MODULES.some((m) => m.id === item.id)
    if (isControlled) {
      return canView(item.id)
    }
    return true
  })

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container — Clean White Theme identical to the reference */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 flex flex-col w-[215px] bg-white dark:bg-[#111827] text-slate-700 dark:text-slate-200 transition-transform duration-300 ease-in-out border-r border-slate-200 dark:border-white/10 shadow-xs lg:shadow-none lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Logo Section — Yellow/Gold Wave Hydro Logo */}
        <div className="flex items-center justify-between h-[68px] px-4 border-b border-slate-100 dark:border-white/5">
          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            {/* Hydro Golden Yellow Wave Logo */}
            <div className="w-9 h-8 flex items-center justify-center shrink-0">
              <svg width="34" height="28" viewBox="0 0 40 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 22C12 28 24 26 36 12C28 22 18 24 6 22Z" fill="url(#hydro_gold2)" />
                <path d="M6 14C16 4 28 6 36 12C26 8 16 10 4 20C4 18 5 16 6 14Z" fill="url(#hydro_gold1)" />
                <defs>
                  <linearGradient id="hydro_gold1" x1="4" y1="4" x2="36" y2="16" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FBBF24" />
                    <stop offset="1" stopColor="#F59E0B" />
                  </linearGradient>
                  <linearGradient id="hydro_gold2" x1="4" y1="20" x2="36" y2="16" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FDE68A" />
                    <stop offset="1" stopColor="#D97706" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Logo Text */}
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-[16px] tracking-wider text-slate-900 dark:text-white">
                HYDRO
              </span>
              <span className="text-[8.5px] font-semibold tracking-[0.22em] text-slate-600 dark:text-slate-400 mt-0.5">
                REABILITAÇÃO
              </span>
            </div>
          </Link>

          {/* Close button on mobile */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"
              aria-label="Fechar menu"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Navigation Menu (Scrollable) */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-1 scrollbar-thin">
          {visibleItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.id === 'dashboard'
                ? currentPath === '/dashboard' || currentPath === '/dashboard/'
                : currentPath.startsWith(item.routeMatch)

            return (
              <Link
                key={item.id}
                to={item.href}
                onClick={onClose}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-medium transition-all group ${
                  isActive
                    ? 'bg-[#FBBF24] text-slate-900 font-bold shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    size={17}
                    strokeWidth={isActive ? 2.3 : 1.75}
                    className={`shrink-0 transition-colors ${
                      isActive ? 'text-slate-900' : 'text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none min-w-[17px] text-center ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'bg-[#FBBF24] text-slate-900'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom Sidebar Badge: "Juntos por um ambiente mais seguro" */}
        <div className="p-3 border-t border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0">
              <Shield size={14} strokeWidth={2} />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[10.5px] font-medium text-slate-600 dark:text-slate-400">
                Juntos por um
              </span>
              <span className="text-[10.5px] font-bold text-slate-800 dark:text-slate-200">
                ambiente mais seguro
              </span>
              {/* Yellow stylized curve stroke */}
              <div className="w-12 h-0.5 bg-[#FBBF24] rounded-full mt-1" />
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
