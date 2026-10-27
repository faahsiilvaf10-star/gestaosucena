import Menu from 'lucide-react/dist/esm/icons/menu.js'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.js'
import User from 'lucide-react/dist/esm/icons/user.js'
import Settings from 'lucide-react/dist/esm/icons/settings.js'
import Shield from 'lucide-react/dist/esm/icons/shield.js'
import LogOut from 'lucide-react/dist/esm/icons/log-out.js'
import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
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
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false)

  const notifRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)

  const fullName = currentUser.name || 'Fabrício'
  const firstName = fullName.split(' ')[0]
  const displayFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
  const initial = displayFirstName.charAt(0)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false)
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setIsUserDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="hydro-topbar">
      {/* Mobile Menu Button */}
      {onMenuToggle && (
        <button
          onClick={onMenuToggle}
          className="lg:hidden hydro-icon-btn shrink-0"
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Search Input Bar */}
      <label className="hydro-search cursor-pointer" onClick={onOpenSearch}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          id="searchInput"
          type="search"
          readOnly
          placeholder="Buscar colaboradores, documentos, equipamentos…"
          aria-label="Buscar no painel"
          className="cursor-pointer"
        />
      </label>

      {/* Top Actions */}
      <div className="hydro-top-actions">
        {/* Notifications Wrap */}
        <div className="hydro-notif-wrap" ref={notifRef}>
          <button
            className="hydro-icon-btn"
            id="bellBtn"
            aria-label="Notificações, 3 não lidas"
            aria-expanded={isNotifOpen}
            onClick={() => setIsNotifOpen(!isNotifOpen)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
              <path d="M10.3 21a2 2 0 0 0 3.4 0" />
            </svg>
            <span className="hydro-dot-badge">3</span>
          </button>

          {/* Notifications Panel */}
          <div
            className={`hydro-notif-panel ${isNotifOpen ? 'open' : ''}`}
            role="dialog"
            aria-label="Notificações"
          >
            <div className="flex items-center justify-between pb-1 border-b border-[#EEECE6] mb-1">
              <h3 className="m-0 text-[12px] font-extrabold uppercase tracking-wider text-[#7A8699]">
                Notificações
              </h3>
              <Link
                to="/lembretes"
                onClick={() => setIsNotifOpen(false)}
                className="text-[11.5px] font-bold text-[#E6A800] hover:underline"
              >
                Ver todos
              </Link>
            </div>

            <div className="flex flex-col gap-1 max-h-[340px] overflow-y-auto">
              <Link
                to="/reunioes"
                onClick={() => setIsNotifOpen(false)}
                className="hydro-notif-item text-inherit no-underline"
              >
                <div
                  className="n-ico"
                  style={{ background: 'var(--hydro-yellow-soft)', color: 'var(--hydro-yellow-dark)' }}
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
              </Link>

              <Link
                to="/documentos"
                onClick={() => setIsNotifOpen(false)}
                className="hydro-notif-item text-inherit no-underline"
              >
                <div
                  className="n-ico"
                  style={{ background: 'var(--hydro-red-bg)', color: 'var(--hydro-red)' }}
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
              </Link>

              <Link
                to="/documentos"
                onClick={() => setIsNotifOpen(false)}
                className="hydro-notif-item text-inherit no-underline"
              >
                <div
                  className="n-ico"
                  style={{ background: 'var(--hydro-amber-bg)', color: 'var(--hydro-amber)' }}
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
              </Link>
            </div>
          </div>
        </div>

        {/* Calendar Action Button */}
        <Link
          to="/rh/calendario-hydro"
          className="hydro-icon-btn hidden sm:grid"
          aria-label="Calendário"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
        </Link>

        {/* User Chip Capsule */}
        <div className="relative" ref={userRef}>
          <div
            className="hydro-user-chip"
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            role="button"
            tabIndex={0}
          >
            <div className="hydro-avatar-f" aria-hidden="true">
              {currentUser.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt={currentUser.name} />
              ) : (
                initial
              )}
            </div>
            <div>
              <b>Olá, {displayFirstName}</b>
              <span>Visão geral da operação</span>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-[#7A8699]">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>

          {/* User Menu Dropdown */}
          {isUserDropdownOpen && (
            <div className="absolute right-0 top-[52px] w-56 bg-white border border-[#E8E6E0] rounded-2xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-2 border-b border-[#EEECE6]">
                <p className="text-xs font-bold text-[#17233B] truncate">{currentUser.name}</p>
                <p className="text-[11px] text-[#7A8699] capitalize truncate">
                  {currentUser.role || 'Colaborador'}
                </p>
              </div>

              <div className="py-1">
                <Link
                  to="/rh"
                  onClick={() => setIsUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-[#17233B] hover:bg-[#FAFAF8] transition-colors"
                >
                  <User size={15} className="text-[#7A8699]" />
                  Meu Perfil / RH
                </Link>

                <Link
                  to="/configuracoes"
                  onClick={() => setIsUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-[#17233B] hover:bg-[#FAFAF8] transition-colors"
                >
                  <Settings size={15} className="text-[#7A8699]" />
                  Configurações
                </Link>

                {isAdmin(currentUser.role) && (
                  <Link
                    to="/admin"
                    onClick={() => setIsUserDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-[#17233B] hover:bg-[#FAFAF8] transition-colors"
                  >
                    <Shield size={15} className="text-[#E6A800]" />
                    Painel Administrador
                  </Link>
                )}
              </div>

              <div className="pt-1 border-t border-[#EEECE6]">
                <button
                  onClick={() => {
                    setIsUserDropdownOpen(false)
                    if (onLogoutRequest) onLogoutRequest()
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors text-left"
                >
                  <LogOut size={15} />
                  Sair do sistema
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
