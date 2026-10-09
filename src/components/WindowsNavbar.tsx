import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import Home from 'lucide-react/dist/esm/icons/house.js';
import Bell from 'lucide-react/dist/esm/icons/bell.js';
import Instagram from 'lucide-react/dist/esm/icons/instagram.js';
import Package from 'lucide-react/dist/esm/icons/package.js';
import Truck from 'lucide-react/dist/esm/icons/truck.js';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js';
import Users from 'lucide-react/dist/esm/icons/users.js';
import BarChart2 from 'lucide-react/dist/esm/icons/chart-no-axes-column.js';
import Leaf from 'lucide-react/dist/esm/icons/leaf.js';
import Calendar from 'lucide-react/dist/esm/icons/calendar.js';
import TriangleAlert from 'lucide-react/dist/esm/icons/triangle-alert.js';
import Search from 'lucide-react/dist/esm/icons/search.js';
import Sun from 'lucide-react/dist/esm/icons/sun.js';
import Moon from 'lucide-react/dist/esm/icons/moon.js';
import Bot from 'lucide-react/dist/esm/icons/bot.js';
import Video from 'lucide-react/dist/esm/icons/video.js';
import Menu from 'lucide-react/dist/esm/icons/menu.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.js';
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import './WindowsNavbar.css'
import { useTheme } from '../contexts/ThemeContext'
import { GlobalSearchModal } from './GlobalSearchModal'
import SucenaAIModal from './SucenaAIModal'
import { VerifiedBadge, isAdmin } from './ui/VerifiedBadge'
import { LiquidMetalButton } from './ui/liquid-metal-button'
import { usePermissions } from '../hooks/usePermissions'
import { MODULES } from '../lib/permissions'

interface UserInfo {
  id: string
  name: string
  role: string
  avatarUrl: string
}

interface WindowsNavbarProps {
  currentUser: UserInfo
  onLogoutRequest?: () => void
}

export const MENU_ITEMS = [
  { id: 'dashboard', label: 'Destaques', href: '/dashboard', icon: Home, routeMatch: '/dashboard' },
  { id: 'lembretes', label: 'Lembretes', href: '/lembretes', icon: Bell, routeMatch: '/lembretes' },
  { id: 'instacena', label: 'Instacena', href: '/instacena', icon: Instagram, routeMatch: '/instacena' },
  { id: 'almoxarifado', label: 'Almoxarifado', href: '/almoxarifado', icon: Package, routeMatch: '/almoxarifado' },
  { id: 'documentos', label: 'Documentos', href: '/documentos', icon: FileText, routeMatch: '/documentos' },
  { id: 'equipamentos', label: 'Equipamentos', href: '/equipamentos', icon: Truck, routeMatch: '/equipamentos' },
  { id: 'seguranca', label: 'Segurança', href: '/seguranca', icon: ShieldCheck, routeMatch: '/seguranca' },
  { id: 'rh', label: 'RH', href: '/rh', icon: Users, routeMatch: '/rh' },
  { id: 'relatorio-obra', label: 'Relatório de Obra', href: '/relatorio-obra', icon: BarChart2, routeMatch: '/relatorio-obra' },
  { id: 'meio-ambiente', label: 'Meio Ambiente', href: '/meio-ambiente', icon: Leaf, routeMatch: '/meio-ambiente' },
  { id: 'planejamento', label: 'Planejamento', href: '#', icon: Calendar, routeMatch: '/planejamento' },
  { id: 'reunioes', label: 'Reuniões', href: '/reunioes', icon: Video, routeMatch: '/reunioes' },
  { id: 'emergencia', label: 'Emergência', href: '/emergencia', icon: TriangleAlert, routeMatch: '/emergencia', isEmergency: true },
]

export function WindowsNavbar({ currentUser, onLogoutRequest }: WindowsNavbarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname
  const { isDark, toggleTheme } = useTheme()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isAiOpen, setIsAiOpen] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  
  const { canView } = usePermissions(currentUser.id)
  const currentEnv = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') : null
  const envDisplayName = currentEnv === 'hydro-civil' ? 'HYDRO CIVIL' : 'HYDRO REABILITAÇÃO'

  const visibleMenuItems = MENU_ITEMS.filter(item => {
    // Se a página está sob controle de acesso, checamos a permissão
    const isControlled = MODULES.some(m => m.id === item.id)
    if (isControlled) {
      return canView(item.id)
    }
    return true // Se não, é liberado por padrão
  })
  
  const menuRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLElement | null)[]>([])
  const animationTimerRef = useRef<number | null>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Detectar o nome da página atual
  const currentPageLabel = visibleMenuItems.find(m => 
    currentPath === m.routeMatch || currentPath.startsWith(m.routeMatch + '/')
  )?.label || 'Sucena'



  // Desktop: liquid indicator
  useEffect(() => {
    const updateIndicator = (item: HTMLElement, animate = true) => {
      if (!item || !menuRef.current || !indicatorRef.current) return

      const menuRect = menuRef.current.getBoundingClientRect()
      const itemRect = item.getBoundingClientRect()

      const x = itemRect.left - menuRect.left + menuRef.current.scrollLeft
      const width = itemRect.width

      if (animate) {
        indicatorRef.current.classList.remove('is-moving')
        void indicatorRef.current.offsetWidth
        indicatorRef.current.classList.add('is-moving')
      }

      indicatorRef.current.style.width = `${width}px`
      indicatorRef.current.style.transform = `translate3d(${x}px, 0, 0)`

      const emergency = item.classList.contains('emergency')
      indicatorRef.current.classList.toggle('emergency-mode', emergency)

      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current)
      }

      animationTimerRef.current = window.setTimeout(() => {
        if (indicatorRef.current) {
          indicatorRef.current.classList.remove('is-moving')
        }
      }, 650)
    }

    let activeIndex = visibleMenuItems.findIndex(m => currentPath === m.routeMatch || currentPath.startsWith(m.routeMatch + '/'))
    if (activeIndex === -1) activeIndex = 0

    const activeItem = itemRefs.current[activeIndex]
    
    if (activeItem) {
      updateIndicator(activeItem, false)
      activeItem.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }

    const handleResize = () => {
      if (activeItem) updateIndicator(activeItem, false)
    }

    const resizeObserver = new ResizeObserver(handleResize)
    if (menuRef.current) {
      resizeObserver.observe(menuRef.current)
    }
    window.addEventListener('resize', handleResize, { passive: true })

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current)
    }
  }, [currentPath])

  const handleItemClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string, index: number) => {
    e.preventDefault()
    
    // Ripple effect
    const button = e.currentTarget
    const rect = button.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height)
    const x = e.clientX - rect.left - size / 2
    const y = e.clientY - rect.top - size / 2

    const ripple = document.createElement('span')
    ripple.className = 'ripple'
    ripple.style.width = `${size}px`
    ripple.style.height = `${size}px`
    ripple.style.left = `${x}px`
    ripple.style.top = `${y}px`

    const existingRipple = button.querySelector('.ripple')
    if (existingRipple) existingRipple.remove()
    
    button.appendChild(ripple)
    setTimeout(() => {
      ripple.remove()
    }, 550)

    if (href !== '#') {
      navigate({ to: href as any })
    }
  }



  return (
    <>
      {/* ============================================================
          MOBILE HEADER — visible only on < 1024px
          ============================================================ */}
      <div className="lg:hidden">
        {/* Backdrop */}
        <div
          className={`sucena-drawer-backdrop ${isDrawerOpen ? 'sucena-drawer-backdrop--open' : ''}`}
          onClick={() => setIsDrawerOpen(false)}
          aria-hidden="true"
        />

        {/* Drawer lateral */}
        <aside className={`sucena-drawer ${isDrawerOpen ? 'sucena-drawer--open' : ''} ${isDark ? 'sucena-drawer--dark' : 'sucena-drawer--light'}`}>
          {/* Drawer Header */}
          <div className="sucena-drawer-header">
            <div className="sucena-drawer-logo">
              <img
                src={isDark ? '/logo.png' : '/logo-light-theme.png'}
                alt="Sucena"
                style={{ height: 28, width: 'auto', objectFit: 'contain' }}
              />
              <div className="sucena-drawer-contract">
                <span className="sucena-drawer-contract-label">Ambiente</span>
                <span className="sucena-drawer-contract-number">{envDisplayName}</span>
              </div>
            </div>
            <button
              className="sucena-drawer-close"
              onClick={() => setIsDrawerOpen(false)}
              aria-label="Fechar menu"
            >
              <X size={20} />
            </button>
          </div>

          {/* Usuário */}
          <div
            className="sucena-drawer-user"
            onClick={() => { navigate({ to: '/configuracoes' as any }); setIsDrawerOpen(false) }}
          >
            <div className="sucena-drawer-avatar">
              {currentUser.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt="Avatar" />
              ) : (
                <div className="sucena-drawer-avatar-placeholder">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : '?'}
                </div>
              )}
              <span className="sucena-drawer-avatar-online" />
            </div>
            <div className="sucena-drawer-user-info">
              <span className="sucena-drawer-user-name">{currentUser.name || 'Usuário'}</span>
              <span className="sucena-drawer-user-role">{currentUser.role || 'Colaborador'}</span>
            </div>
            <ChevronRight size={16} className="sucena-drawer-user-chevron" />
          </div>

          <div className="sucena-drawer-divider" />

          {/* Nav items */}
          <nav className="sucena-drawer-nav">
            {visibleMenuItems.map((item) => {
              const isActive = currentPath === item.routeMatch || currentPath.startsWith(item.routeMatch + '/')
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  className={`sucena-drawer-item ${isActive ? 'sucena-drawer-item--active' : ''} ${item.isEmergency ? 'sucena-drawer-item--emergency' : ''}`}
                  onClick={() => {
                    if (item.href !== '#') {
                      navigate({ to: item.href as any })
                    }
                    setIsDrawerOpen(false)
                  }}
                >
                  <span className="sucena-drawer-item-icon">
                    <Icon size={20} strokeWidth={1.8} />
                  </span>
                  <span className="sucena-drawer-item-label">{item.label}</span>
                  {isActive && <span className="sucena-drawer-item-active-dot" />}
                </button>
              )
            })}
          </nav>

          {/* Footer drawer removido */}
        </aside>

        {/* Mobile top bar */}
        <div className="sucena-mobile-header">
          <button
            className="sucena-mobile-hamburger"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={22} />
          </button>

          <span className="sucena-mobile-title">{currentPageLabel}</span>

          <div className="sucena-mobile-actions">
            <button
              className="sucena-mobile-action-btn"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Pesquisar"
            >
              <Search size={20} strokeWidth={1.8} />
            </button>
            <button
              className="sucena-mobile-action-btn"
              onClick={() => setIsAiOpen(true)}
              aria-label="IA Sucena"
            >
              <Bot size={20} strokeWidth={1.8} />
            </button>
            {/* Botão tema mobile removido */}
          </div>
        </div>
      </div>

      {/* ============================================================
          NAVBAR PRINCIPAL (LIQUID GLASS) — hidden on mobile, visible on desktop (lg+)
          ============================================================ */}
      <div className="hidden lg:block pt-2 sm:pt-3 px-2 sm:px-3 md:px-6 w-full mb-6 sm:mb-8 relative z-50">


        <header className="sucena-navbar">
          {/* CONTRATO */}
          <div className="nav-contract">
            <div className="contract-top">
              <div className="contract-info">
                <span className="contract-label">Ambiente</span>
                <strong className="contract-number">{envDisplayName}</strong>
              </div>
            </div>
            <div className="nav-avatar-area">
              <div className="nav-avatar cursor-pointer" onClick={() => navigate({ to: '/configuracoes' as any })}>
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="Usuário" />
                ) : (
                  <div className="w-full h-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 font-bold text-lg rounded-full border border-white/20">
                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : '?'}
                  </div>
                )}
                <span className="avatar-online"></span>
              </div>
            </div>
          </div>

          {/* MENU */}
          <div className="nav-menu-wrapper">
            <div className="nav-menu-scroll">
              <nav className="nav-menu" id="mainNavigation" ref={menuRef}>
                
                {visibleMenuItems.map((item, idx) => {
                  const isActive = currentPath === item.routeMatch || currentPath.startsWith(item.routeMatch + '/')
                  const Icon = item.icon
                  
                  if (isActive) {
                    return (
                      <div
                        key={item.id}
                        ref={el => itemRefs.current[idx] = el}
                        style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: '0 4px', background: 'transparent', zIndex: 5 }}
                      >
                         <LiquidMetalButton 
                           label={item.label} 
                           onClick={() => {
                             if (item.href !== '#') {
                               navigate({ to: item.href as any })
                             }
                           }}
                           viewMode="text" 
                         />
                      </div>
                    )
                  }

                  return (
                    <a
                      key={item.id}
                      href={item.href}
                      ref={el => itemRefs.current[idx] = el as HTMLAnchorElement}
                      className={`nav-item ${isActive ? 'active' : ''} ${item.isEmergency ? 'emergency' : ''}`}
                      onClick={(e) => handleItemClick(e, item.href, idx)}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className="nav-item-icon">
                        <Icon size={16} strokeWidth={1.8} />
                      </span>
                      <span className="nav-item-text">
                        {item.label}
                      </span>
                    </a>
                  )
                })}
              </nav>
            </div>
          </div>

          {/* AÇÕES */}
          <div className="nav-actions">
            <button 
              className="nav-action-btn" 
              aria-label="Pesquisar"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search size={16} strokeWidth={1.8} />
            </button>
            <button 
              className="nav-action-btn" 
              aria-label="IA Sucena"
              onClick={() => setIsAiOpen(true)}
            >
              <Bot size={16} strokeWidth={1.8} />
            </button>
            {/* Botão tema desktop removido */}
          </div>

          <GlobalSearchModal 
            isOpen={isSearchOpen} 
            onClose={() => setIsSearchOpen(false)} 
          />
        </header>
      </div>

      {/* Search modal (mobile também usa) */}
      <GlobalSearchModal 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
      />
      
      <SucenaAIModal 
        isOpen={isAiOpen} 
        onClose={() => setIsAiOpen(false)} 
      />
    </>
  )
}
