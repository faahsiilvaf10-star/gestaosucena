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

  const firstName = currentUser.name ? currentUser.name.split(' ')[0] : 'Fabrício'
  const displayFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()

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
    <header className="sticky top-0 z-30 h-16 w-full bg-white dark:bg-[#111827] border-b border-slate-200/80 dark:border-white/10 px-4 sm:px-6 flex items-center justify-between transition-colors shadow-2xs">
      {/* Left side: Hamburger (Mobile) + Search Bar */}
      <div className="flex items-center gap-3 flex-1 max-w-2xl">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </button>

        {/* Search input field — Rounded-full Pill */}
        <div
          onClick={onOpenSearch}
          className="relative flex items-center w-full max-w-lg cursor-pointer group"
        >
          <Search
            size={16}
            className="absolute left-4 text-slate-400 group-hover:text-amber-500 transition-colors pointer-events-none"
          />
          <input
            type="text"
            readOnly
            placeholder="Buscar colaboradores, documentos, equipamentos..."
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 cursor-pointer focus:outline-none hover:border-slate-300 dark:hover:border-white/20 transition-all shadow-2xs"
          />
        </div>
      </div>

      {/* Right side: Actions (Notifications with RED 3 badge, Calendar, Theme, Profile) */}
      <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
        {/* Notifications (Lembretes) with Red Badge 3 */}
        <Link
          to="/lembretes"
          className="relative p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-all"
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
          className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-all hidden sm:flex"
          title="Calendário"
        >
          <Calendar size={18} strokeWidth={1.8} />
        </Link>

        {/* Theme Toggle Button (Sun icon) */}
        <div className="flex items-center">
          <ThemeToggle variant="ghost" className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full" />
        </div>

        {/* User Profile Capsule */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2.5 pl-1.5 pr-2 py-1 rounded-full hover:bg-slate-100/80 dark:hover:bg-white/10 transition-all"
          >
            {/* User Avatar Circle */}
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
              <img
                src={currentUser.avatarUrl || '/layout/avatar-fabricio.png'}
                alt={currentUser.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
              <User size={18} className="text-slate-600 dark:text-slate-300" />
            </div>

            {/* User Info Texts */}
            <div className="hidden md:flex flex-col text-left leading-tight">
              <span className="text-[13px] font-bold text-slate-900 dark:text-white">
                Olá, {displayFirstName}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                Visão geral da operação
              </span>
            </div>

            <ChevronDown
              size={14}
              className={`text-slate-400 transition-transform duration-200 ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Profile Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#1F2937] rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-2 border-b border-slate-100 dark:border-white/10">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {currentUser.name || 'Fabrício'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                  {currentUser.role || 'Visão geral da operação'}
                </p>
              </div>

              <div className="py-1 text-xs text-slate-700 dark:text-slate-200 font-medium">
                {isAdmin(currentUser.role, currentUser.name) && (
                  <Link
                    to="/admin"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-amber-600 dark:text-amber-400"
                  >
                    <Shield size={15} />
                    <span>Painel Administrativo</span>
                  </Link>
                )}

                <Link
                  to="/ambientes"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  <Building size={15} />
                  <span>Trocar Ambiente</span>
                </Link>

                <Link
                  to="/configuracoes"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  <Settings size={15} />
                  <span>Configurações</span>
                </Link>
              </div>

              <div className="pt-1 border-t border-slate-100 dark:border-white/10">
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
