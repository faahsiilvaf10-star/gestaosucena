import LogOut from 'lucide-react/dist/esm/icons/log-out.js';
import Shield from 'lucide-react/dist/esm/icons/shield.js';
import { useState, useEffect, useRef, ReactNode } from 'react'
import { useNavigate, useLocation, Link } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import { LogoutOverlay } from './LogoutOverlay'
import { useTheme } from '../contexts/ThemeContext'
import { MonthlyColorsModal } from './MonthlyColorsModal'
import { useMonthlyColors } from '../hooks/useMonthlyColors'
import { useChat } from '../contexts/ChatContext'
import { usePresence } from '../hooks/usePresence'
import { useChatRealtime } from '../hooks/useChatRealtime'
import { useGlobalPresenceSync } from '../hooks/useGlobalPresenceSync'
import { ChatSidebar } from './ChatSidebar'
import { HydroSidebar } from './HydroSidebar'
import '../hydro-panel.css'
import { ChatWindow } from './chat/ChatWindow'
import { DdsUploadModal } from './DdsUploadModal'
import { isAdmin } from './ui/VerifiedBadge'
import { toast } from 'sonner'
import { EquipmentAnnouncementModal } from './EquipmentAnnouncementModal'
import { DailyPipasAlertModal } from './DailyPipasAlertModal'
import { DdsAlertManager } from './DdsAlertManager'
import { CanteiroAlertManager } from './CanteiroAlertManager'
import { UserOnlineNotification } from './UserOnlineNotification'
import { NewMessageNotification } from './chat/NewMessageNotification'
import { InstacenaNotificationPopup } from './instacena/InstacenaNotificationPopup'
import { MiniWeatherWidget } from './MiniWeatherWidget'
import { BackButton } from './BackButton'
import { AppUpdateNotification } from './AppUpdateNotification'
import { clearDailySessionExpiry } from '../lib/sessionManager'
import { useNotifications } from '../context/NotificationContext'

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isDark } = useTheme()

  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showMonthlyColorsModal, setShowMonthlyColorsModal] = useState(false)
  const [announcement, setAnnouncement] = useState<{ type: 'entry'|'exit', eq: any, move: any } | null>(null)
  const [currentUser, setCurrentUser] = useState({ id: '', name: '', role: '', avatarUrl: '' })
  
  const { toggleSidebar, unreadCountGlobally, activeChats, isSidebarOpen } = useChat()
  usePresence(currentUser.id)
  useChatRealtime(currentUser.id)
  useGlobalPresenceSync(currentUser.id)
  
  const { currentColor } = useMonthlyColors()

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem('hydro_sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })
  const isDashboard = location.pathname === '/dashboard' || location.pathname === '/dashboard/'
  const [searchQuery, setSearchQuery] = useState('')
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const { state, markAsRead, markAllAsRead } = useNotifications()

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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setSearchQuery(q)
    window.dispatchEvent(new CustomEvent('hydro_search', { detail: q }))
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (location.pathname !== '/dashboard' && location.pathname !== '/dashboard/') {
        navigate({ to: '/dashboard' as any })
      }
    }
  }

  const rawName = currentUser.name || 'Fabrício'
  const firstName = rawName.split(' ')[0]
  const displayFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
  const avatarLetter = displayFirstName.charAt(0).toUpperCase() || 'F'


  // Verifica atualização imediatamente ao carregar
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        const serverVersion = data.version
        if (!serverVersion) return

        const CURRENT_VERSION = (window as any).__APP_VERSION__
        const STORAGE_KEY = 'app_acknowledged_version'
        const acknowledgedVersion = localStorage.getItem(STORAGE_KEY)

        // Se há nova versão, limpa cache e recarrega
        if (serverVersion && acknowledgedVersion && serverVersion !== acknowledgedVersion && CURRENT_VERSION && serverVersion !== CURRENT_VERSION) {
          console.log('[AppLayout] Nova versao detectada, limpando cache...')

          // Limpa todos os caches
          if ("caches" in window) {
            const names = await caches.keys()
            await Promise.all(names.map(n => caches.delete(n)))
          }

          // Desregistra service workers
          if ("serviceWorker" in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations()
            await Promise.all(regs.map(r => r.unregister()))
          }

          // Atualiza versão reconhecida
          localStorage.setItem(STORAGE_KEY, serverVersion)

          // Recarrega
          window.location.href = window.location.pathname + '?t=' + Date.now()
        }
      } catch (e) {
        console.warn('[AppLayout] Erro ao verificar update:', e)
      }
    }

    // Executa imediatamente
    checkUpdate()
  }, [])

  const colorStyles = {
    red: { dot: 'bg-red-500', ping: 'bg-red-400' },
    blue: { dot: 'bg-blue-500', ping: 'bg-blue-400' },
    yellow: { dot: 'bg-yellow-500', ping: 'bg-yellow-400' },
    green: { dot: 'bg-green-500', ping: 'bg-green-400' }
  }
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const isDevMock = typeof window !== 'undefined' && window.location.search.includes('mock=true')
      const user = data?.user || (isDevMock ? { id: 'mock-user', email: 'fabricio@hydro.com', user_metadata: { full_name: 'Fabrício', role: 'Visão geral da operação' } } : null)
      if (!user) {
        navigate({ to: '/' })
        return
      }
      const role = user.user_metadata?.role || ''
      const userName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário'
      if (userName && userName !== 'Usuário') {
        try { localStorage.setItem('sucena_user_name', userName) } catch (_) {}
      }
      setCurrentUser({
        id: user.id || '',
        name: userName,
        role: role || 'Usuário',
        avatarUrl: user.user_metadata?.avatar_url || ''
      })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (typeof window !== 'undefined' && window.location.search.includes('mock=true')) return
      if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
        navigate({ to: '/' })
        return
      }
      if (session?.user) {
        const role = session.user.user_metadata?.role || ''
        const userName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário'
        if (userName && userName !== 'Usuário') {
          try { localStorage.setItem('sucena_user_name', userName) } catch (_) {}
        }
        setCurrentUser({
          id: session.user.id || '',
          name: userName,
          role: role || 'Usuário',
          avatarUrl: session.user.user_metadata?.avatar_url || ''
        })
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  useEffect(() => {
    // Solicita permissão de localização no Android (Capacitor) ao abrir o app
    const requestLocation = async () => {
      try {
        if (typeof window !== 'undefined' && window.Capacitor?.isNative) {
          const { Geolocation } = await import('@capacitor/geolocation')
          const permissions = await Geolocation.checkPermissions()
          if (permissions.location !== 'granted') {
            await Geolocation.requestPermissions()
          }
        }
      } catch (error) {
        console.log('Erro ao solicitar localização:', error)
      }
    }
    requestLocation()
  }, [])

  useEffect(() => {
    // Global listener for Equipment Movements (Entry/Exit announcements)
    const handleMovement = async (move: any) => {
      const { data: eq } = await supabase.from('eq_equipments').select('id, name, plate_tag, category').eq('environment', typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena').eq('id', move.equipment_id).single()
      
      setAnnouncement({
        type: move.movement_type as 'entry'|'exit',
        eq: eq,
        move: move
      })
    }

    const channel = supabase.channel('global_eq_movements')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'eq_movements' }, async (payload) => {
        handleMovement(payload.new)
      })
      .on('broadcast', { event: 'eq_moved' }, async ({ payload }) => {
        handleMovement(payload)
      })
      .subscribe()

    const localListener = (e: any) => handleMovement(e.detail)
    window.addEventListener('eq_moved_local', localListener)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('eq_moved_local', localListener)
    }
  }, [])

  const handleDirectLogout = async () => {
    setShowLogoutConfirm(false)
    try {
      localStorage.removeItem('sucena_saved_password')
      clearDailySessionExpiry()
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Erro ao sair:', err)
    } finally {
      navigate({ to: '/' })
    }
  }

  const handleLogoutConfirm = async () => {
    await handleDirectLogout()
  }

  const handleHardRefresh = async () => {
    const toastId = toast.loading('Baixando atualizações e limpando cache...')
    
    try {
      // 1. Limpa os arquivos cacheados pelo PWA / Service Worker (CSS, JS, Imagens antigos)
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map(name => caches.delete(name)))
      }

      // 2. Desregistra e força atualização do Service Worker
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        for (const registration of registrations) {
          await registration.unregister()
        }
      }

      toast.success('Atualização concluída! Reiniciando...', { id: toastId })
      
      // Pequeno delay para ler a mensagem antes de forçar o refresh e aplicar o novo código
      setTimeout(() => {
        window.location.href = window.location.pathname + '?t=' + Date.now()
      }, 1000)
      
    } catch (error) {
      console.error('Erro ao atualizar:', error)
      window.location.href = window.location.pathname + '?t=' + Date.now()
    }
  }

  // Helper functions for notifications
  const getNotificationIconStyle = (type: string) => {
    switch (type) {
      case 'mention':
        return { background: 'var(--yellow-soft)', color: 'var(--yellow-dark)' }
      case 'instacena_post':
        return { background: 'linear-gradient(135deg, var(--amber), var(--rose))', color: 'white' }
      case 'instacena_like':
        return { background: 'var(--rose-bg)', color: 'var(--rose)' }
      case 'instacena_comment':
        return { background: 'var(--indigo-bg)', color: 'var(--indigo)' }
      case 'instacena_story':
        return { background: 'linear-gradient(135deg, var(--purple), var(--pink))', color: 'white' }
      case 'system':
      default:
        return { background: 'var(--red-bg)', color: 'var(--red)' }
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'mention':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )
      case 'instacena_post':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.2" cy="6.8" r=".6" fill="currentColor" />
          </svg>
        )
      case 'instacena_like':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M20.84 4.61a5.5 5.5 0 0 1-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 1-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 1 0-7.78z" />
          </svg>
        )
      case 'instacena_comment':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )
      case 'instacena_story':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        )
      case 'system':
      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M12 3 2 20h20L12 3Z" />
            <path d="M12 10v4M12 17.5v.5" />
          </svg>
        )
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Agora mesmo'
    if (diffMins < 60) return `${diffMins}min atrás`
    if (diffHours < 24) return `${diffHours}h atrás`
    if (diffDays < 7) return `${diffDays}d atrás`
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  return (
    <div className={`overflow-y-auto overflow-x-hidden font-sans ${isSidebarCollapsed ? 'sidebar-collapsed' : ''} app hydro-dashboard-root selection:bg-purple-500/30 transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'}`}
    style={{ height: '100dvh', maxHeight: '100dvh' }}
    >
      <LogoutOverlay isVisible={isLoggingOut} userName={currentUser.name} userRole={currentUser.role} />
      <AppUpdateNotification />
      <DailyPipasAlertModal enabled={Boolean(currentUser.id)} />
      <DdsAlertManager />
      <CanteiroAlertManager />
      {currentUser.id && (
        <>
          <UserOnlineNotification currentUserId={currentUser.id} />
          <NewMessageNotification currentUserId={currentUser.id} />
          <InstacenaNotificationPopup currentUserId={currentUser.id} />
        </>
      )}

      
      {/* Draggable title bar for Electron .exe — allows moving the window */}
      <div 
        className="electron-titlebar" 
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          height: 24, 
          backgroundColor: '#0B0B0C',
          border: 'none',
          zIndex: 9998,
          // @ts-ignore — Electron-specific CSS property
          WebkitAppRegion: 'drag',
          pointerEvents: 'auto',
        }} 
      />

      {/* Top Navigation Bar — Windows 11 Liquid Glass */}


      <HydroSidebar isSidebarCollapsed={isSidebarCollapsed} setIsSidebarCollapsed={setIsSidebarCollapsed} />

      {/* Main Scrollable Content */}
      <main 
        className={`vt-main relative z-0 flex flex-col min-h-full ${isDashboard ? 'p-0' : 'pt-0'}`}
        style={{ 
          marginLeft: typeof window !== 'undefined' && window.innerWidth <= 900 ? 0 : (isSidebarCollapsed ? 0 : 'var(--sbw)'),
          width: typeof window !== 'undefined' && window.innerWidth <= 900 ? '100%' : (isSidebarCollapsed ? '100%' : 'calc(100% - var(--sbw))'),
          paddingLeft: isSidebarCollapsed ? (typeof window !== 'undefined' && window.innerWidth <= 900 ? '14px' : '58px') : undefined,
          paddingBottom: 'max(32px, calc(32px + env(safe-area-inset-bottom, 0px)))',
          transition: 'margin-left .48s cubic-bezier(.45,0,.15,1), width .48s cubic-bezier(.45,0,.15,1), padding-left .48s cubic-bezier(.45,0,.15,1)',
        }}
      >
        {/* Barra superior persistente em todo o sistema */}
        <div className="topbar-container" style={{ width: '100%' }}>
          <header className="topbar">
            {/* Botão Requisição Rápida (visível exclusivamente no mobile / celular) */}
            <button
              type="button"
              className="btn-requisicao-rapida-mobile"
              onClick={() => navigate({ to: '/almoxarifado/requisicoes/nova' as any })}
              title="Nova Requisição Rápida"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
              </svg>
              <span>Requisição Rápida</span>
            </button>
            <label className="search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                id="globalSearchInput"
                type="search"
                placeholder="Buscar colaboradores, documentos, equipamentos…"
                aria-label="Buscar no painel"
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
              />
            </label>

            <div className="top-actions" ref={notifRef}>
              <div className="notif-wrap">
                <button
                  className="icon-btn"
                  id="bellBtn"
                  type="button"
                  aria-label={`Notificações, ${state.unreadCount} não lidas`}
                  aria-expanded={isNotifOpen}
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsNotifOpen((prev) => !prev)
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
                    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
                    <path d="M10.3 21a2 2 0 0 0 3.4 0" />
                  </svg>
                  {state.unreadCount > 0 && (
                    <span className="dot-badge">{state.unreadCount > 99 ? '99+' : state.unreadCount}</span>
                  )}
                </button>

                <div
                  className={`notif-panel ${isNotifOpen ? 'open' : ''}`}
                  id="notifPanel"
                  role="dialog"
                  aria-label="Notificações"
                >
                  <div className="notif-header">
                    <h3>Notificações</h3>
                    {state.unreadCount > 0 && (
                      <button
                        className="mark-all-read-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          markAllAsRead()
                        }}
                        title="Marcar todas como lidas"
                      >
                        Marcar todas como lidas
                      </button>
                    )}
                  </div>
                  {state.notifications.length === 0 ? (
                    <div className="notif-empty">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
                        <path d="M10.3 21a2 2 0 0 0 3.4 0" />
                      </svg>
                      <p>Nenhuma notificação</p>
                    </div>
                  ) : (
                    state.notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`notif-item cursor-pointer ${!notif.read ? 'unread' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!notif.read) {
                            markAsRead(notif.id)
                          }
                          setIsNotifOpen(false)
                          if (notif.targetUrl) {
                            navigate({ to: notif.targetUrl as any })
                          }
                        }}
                      >
                        <div
                          className="n-ico"
                          style={getNotificationIconStyle(notif.type)}
                        >
                          {getNotificationIcon(notif.type)}
                        </div>
                        <div className="notif-content">
                          <div className="notif-title-row">
                            <b>{notif.title}</b>
                            {!notif.read && <span className="unread-dot" />}
                          </div>
                          <p>{notif.message}</p>
                          <small className="notif-time">{formatTimeAgo(notif.createdAt)}</small>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div
                className="forbidden-note"
                role="button"
                tabIndex={0}
                title="Cor proibida do mês: Azul"
                onClick={() => setShowMonthlyColorsModal(true)}
              >
                <button
                  className="icon-btn forbidden-color"
                  type="button"
                  aria-label="Cor proibida do mês: azul"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="8.2" />
                    <path d="M6.2 6.2 17.8 17.8" />
                  </svg>
                </button>
                <div className="forbidden-label" aria-hidden="true">
                  <small>Cor proibida do mês</small>
                  <b>Azul</b>
                </div>
              </div>

              <div
                className="user-chip cursor-pointer"
                role="button"
                tabIndex={0}
                title="Abrir perfil / configurações"
                onClick={() => navigate({ to: '/configuracoes' as any })}
              >
                <div className="avatar-f" aria-hidden="true">
                  {currentUser.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    avatarLetter
                  )}
                </div>
                <div>
                  <b>Olá, {displayFirstName}</b>
                  <span>{currentUser.role || 'Visão geral da operação'}</span>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>

              
              <button
                className="logout-top-btn"
                type="button"
                title="Sair do sistema"
                onClick={handleDirectLogout}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>SAIR</span>
              </button>
            </div>
          </header>
        </div>

        {/* Conteúdo da página */}
        {isDashboard ? (
          children
        ) : (
          <div className="px-3 sm:px-6 md:px-10 lg:px-14 w-full max-w-7xl mx-auto">
            {location.pathname.split('/').filter(Boolean).length >= 2 && (
              <div className="pt-2 pb-4">
                <BackButton />
              </div>
            )}
            {children}
          </div>
        )}
      </main>

      {/* Chat Sidebar Overlay */}
      {currentUser.id && <ChatSidebar currentUserId={currentUser.id} />}

            {/* Floating Chat Windows */}
      <div 
        className={`fixed bottom-6 z-[105] flex items-end gap-3 pointer-events-none transition-all duration-300 ${ isSidebarOpen ? 'right-[392px]' : 'right-[92px]' } max-md:right-3 max-md:bottom-24`}
      >
        {currentUser.id && activeChats.map(chatId => (
          <ChatWindow key={chatId} currentUserId={currentUser.id} conversationId={chatId} />
        ))}
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`p-6 rounded-2xl w-full max-w-sm border shadow-2xl ${isDark ? 'bg-[#121214] border-white/10' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Confirmar saída</h3>
            <p className={`text-sm mb-6 ${isDark ? 'text-white/70' : 'text-gray-600'}`}>Tem certeza que deseja sair do sistema?</p>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}
                style={{ minHeight: 44 }}
              >
                Cancelar
              </button>
              <button 
                onClick={handleLogoutConfirm}
                className="px-4 py-2.5 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
                style={{ minHeight: 44 }}
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Equipment Announcement Modal */}
      {announcement && (
        <EquipmentAnnouncementModal 
          announcement={announcement}
          isDark={isDark}
          onClose={() => setAnnouncement(null)}
        />
      )}

      {/* Monthly Colors Modal */}
      <MonthlyColorsModal 
        isOpen={showMonthlyColorsModal} 
        onClose={() => setShowMonthlyColorsModal(false)} 
      />

    </div>
  )
}
