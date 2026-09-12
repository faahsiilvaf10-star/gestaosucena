import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { 
  FileText, Home, Bell, Instagram, Package, Truck, ShieldCheck, 
  Users, BarChart2, Leaf, Calendar, TriangleAlert, Search, Sun, Moon 
} from 'lucide-react'
import './WindowsNavbar.css'
import { useTheme } from '../contexts/ThemeContext'

interface UserInfo {
  id: string
  name: string
  role: string
  avatarUrl: string
}

interface WindowsNavbarProps {
  currentUser: UserInfo
}

export const MENU_ITEMS = [
  { id: 'destaques', label: 'Destaques', href: '/dashboard', icon: Home, routeMatch: '/dashboard' },
  { id: 'lembretes', label: 'Lembretes', href: '/lembretes', icon: Bell, routeMatch: '/lembretes' },
  { id: 'instacena', label: 'Instacena', href: '/instacena', icon: Instagram, routeMatch: '/instacena' },
  { id: 'almoxarifado', label: 'Almoxarifado', href: '/almoxarifado', icon: Package, routeMatch: '/almoxarifado' },
  { id: 'documentos', label: 'Documentos', href: '/documentos', icon: FileText, routeMatch: '/documentos' },
  { id: 'equipamentos', label: 'Equipamentos', href: '/equipamentos', icon: Truck, routeMatch: '/equipamentos' },
  { id: 'seguranca', label: 'Segurança', href: '#', icon: ShieldCheck, routeMatch: '/seguranca' },
  { id: 'rh', label: 'RH', href: '/rh', icon: Users, routeMatch: '/rh' },
  { id: 'relatorio', label: 'Relatório Diário Obra', href: '#', icon: BarChart2, routeMatch: '/relatorio' },
  { id: 'meio-ambiente', label: 'Meio Ambiente', href: '/meio-ambiente', icon: Leaf, routeMatch: '/meio-ambiente' },
  { id: 'planejamento', label: 'Planejamento', href: '#', icon: Calendar, routeMatch: '/planejamento' },
  { id: 'emergencia', label: 'Emergência', href: '#', icon: TriangleAlert, routeMatch: '/emergencia', isEmergency: true },
]

import { GlobalSearchModal } from './GlobalSearchModal'

export function WindowsNavbar({ currentUser }: WindowsNavbarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname
  const { isDark, toggleTheme } = useTheme()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  
  const menuRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const animationTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const updateIndicator = (item: HTMLAnchorElement, animate = true) => {
      if (!item || !menuRef.current || !indicatorRef.current) return

      const menuRect = menuRef.current.getBoundingClientRect()
      const itemRect = item.getBoundingClientRect()

      // Calculate relative x position accounting for scroll
      const x = itemRect.left - menuRect.left + menuRef.current.scrollLeft
      const width = itemRect.width

      if (animate) {
        indicatorRef.current.classList.remove('is-moving')
        // Force reflow
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

    // Find current active item
    let activeIndex = MENU_ITEMS.findIndex(m => currentPath === m.routeMatch || currentPath.startsWith(m.routeMatch + '/'))
    if (activeIndex === -1) activeIndex = 0 // Default to first

    const activeItem = itemRefs.current[activeIndex]
    
    if (activeItem) {
      updateIndicator(activeItem, false)
      // Scroll into view if needed
      activeItem.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }

    const handleResize = () => {
      if (activeItem) updateIndicator(activeItem, false)
    }

    const resizeObserver = new ResizeObserver(handleResize)
    if (menuRef.current) {
      resizeObserver.observe(menuRef.current)
    }
    window.addEventListener('resize', handleResize)

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

    // Navigate
    if (href !== '#') {
      navigate({ to: href as any })
    }
  }

  return (
    <div className="pt-3 px-3 md:px-6 w-full mb-8 relative z-50">
      <header className="sucena-navbar">
        {/* CONTRATO */}
        <div className="nav-contract">
          <div className="contract-top">
            <div className="contract-info">
              <span className="contract-label">Contrato</span>
              <strong className="contract-number">4600012690</strong>
            </div>
          </div>
          <div className="nav-avatar-area">
            <div className="nav-avatar cursor-pointer" onClick={() => navigate({ to: '/configuracoes' })}>
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
              <div className="liquid-indicator" id="liquidIndicator" ref={indicatorRef}></div>
              
              {MENU_ITEMS.map((item, idx) => {
                const isActive = currentPath === item.routeMatch || currentPath.startsWith(item.routeMatch + '/')
                const Icon = item.icon
                
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    ref={el => itemRefs.current[idx] = el}
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
            className="nav-action-btn primary" 
            aria-label="Alterar tema"
            onClick={toggleTheme}
          >
            {isDark ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
          </button>
        </div>

        <GlobalSearchModal 
          isOpen={isSearchOpen} 
          onClose={() => setIsSearchOpen(false)} 
        />
      </header>
    </div>
  )
}
