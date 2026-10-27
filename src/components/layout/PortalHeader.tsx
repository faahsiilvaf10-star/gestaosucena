import Search from 'lucide-react/dist/esm/icons/search.js'
import Bell from 'lucide-react/dist/esm/icons/bell.js'
import Calendar from 'lucide-react/dist/esm/icons/calendar.js'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.js'
import Menu from 'lucide-react/dist/esm/icons/menu.js'
import User from 'lucide-react/dist/esm/icons/user.js'
import LogOut from 'lucide-react/dist/esm/icons/log-out.js'
import Settings from 'lucide-react/dist/esm/icons/settings.js'
import Shield from 'lucide-react/dist/esm/icons/shield.js'
import Building from 'lucide-react/dist/esm/icons/building.js'
import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ThemeToggle } from '../ThemeToggle'
import { isAdmin } from '../ui/VerifiedBadge'

interface UserInfo {
  id: string
  name: string
  role: string
  avatarUrl?: string
}

interface PortalHeaderProps {
  currentUser: UserInfo
  onMenuToggle?: () => void
  onOpenSearch?: () => void
  onLogoutRequest?: () => void
}

export function PortalHeader({
  currentUser,
  onMenuToggle,
  onOpenSearch,
  onLogoutRequest,
}: PortalHeaderProps) {
  const navigate = useNavigate()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Extrai primeiro nome
  const firstName = currentUser.name ? currentUser.name.split(' ')[0] : 'Fabrício'
  const displayFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="sticky top-0 z-30 h-16 w-full bg-white dark:bg-[#0B1524] border-b border-gray-200/80 dark:border-white/10 px-4 sm:px-6 flex items-center justify-between transition-colors shadow-xs">
      {/* Left side: Hamburger (Mobile) + Search Bar */}
      <div className="flex items-center gap-3 flex-1 max-w-2xl">
        {/* Mobile menu toggle */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </button>

        {/* Search input field */}
        <div
          onClick={onOpenSearch}
          className="relative flex items-center w-full max-w-lg cursor-pointer group"
        >
          <Search
            size={17}
            className="absolute left-3.5 text-gray-400 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors pointer-events-none"
          />
          <input
            type="text"
            readOnly
            placeholder="Buscar colaboradores, documentos, equipamentos..."
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 cursor-pointer focus:outline-none hover:border-gray-300 dark:hover:border-white/20 transition-all shadow-2xs"
          />
        </div>
      </div>

      {/* Right side: Actions (Notifications, Calendar, Theme, Profile) */}
      <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
        {/* Notifications (Lembretes) */}
        <Link
          to="/lembretes"
          className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-all"
          title="Lembretes e Notificações"
        >
          <Bell size={18} strokeWidth={1.8} />
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#EF4444] text-[9.5px] font-bold text-white shadow-xs">
            3
          </span>
        </Link>

        {/* Calendar shortcut */}
        <Link
          to="/rh/calendario-hydro"
          className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-all hidden sm:flex"
          title="Calendário Hydro"
        >
          <Calendar size={18} strokeWidth={1.8} />
        </Link>

        {/* Theme Toggle Button */}
        <div className="flex items-center">
          <ThemeToggle variant="ghost" className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl" />
        </div>

        {/* User Profile Capsule with Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2.5 pl-1.5 pr-2 py-1 rounded-xl hover:bg-gray-100/80 dark:hover:bg-white/10 transition-all"
          >
            {/* User Avatar Circle */}
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-sky-100 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-500/30 flex items-center justify-center overflow-hidden shrink-0 text-sky-700 dark:text-sky-300 shadow-2xs">
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={18} strokeWidth={2} />
              )}
            </div>

            {/* User Info Texts */}
            <div className="hidden md:flex flex-col text-left leading-tight">
              <span className="text-[13px] font-bold text-gray-900 dark:text-white">
                Olá, {displayFirstName}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-normal">
                Visão geral da operação
              </span>
            </div>

            <ChevronDown
              size={15}
              className={`text-gray-400 transition-transform duration-200 ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Profile Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#111C2E] rounded-2xl shadow-xl border border-gray-200 dark:border-white/10 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-2 border-b border-gray-100 dark:border-white/10">
                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                  {currentUser.name || 'Usuário'}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 capitalize">
                  {currentUser.role || 'Operação'}
                </p>
              </div>

              <div className="py-1 text-xs text-gray-700 dark:text-gray-200 font-medium">
                {isAdmin(currentUser.role, currentUser.name) && (
                  <Link
                    to="/admin"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-amber-600 dark:text-amber-400"
                  >
                    <Shield size={15} />
                    <span>Painel Administrativo</span>
                  </Link>
                )}

                <Link
                  to="/ambientes"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  <Building size={15} />
                  <span>Trocar Ambiente</span>
                </Link>

                <Link
                  to="/configuracoes"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  <Settings size={15} />
                  <span>Configurações</span>
                </Link>
              </div>

              <div className="pt-1 border-t border-gray-100 dark:border-white/10">
                <button
                  onClick={() => {
                    setIsDropdownOpen(false)
                    onLogoutRequest?.()
                  }}
                  className="flex items-center gap-2.5 w-full text-left px-4 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={15} />
                  <span>Encerrar Sessão</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
