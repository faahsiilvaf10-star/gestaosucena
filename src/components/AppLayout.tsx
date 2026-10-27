import LogOut from 'lucide-react/dist/esm/icons/log-out.js'
import Shield from 'lucide-react/dist/esm/icons/shield.js'
import { useState, useEffect, ReactNode } from 'react'
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
import { ChatWindow } from './chat/ChatWindow'
import { DdsUploadModal } from './DdsUploadModal'
import { isAdmin } from './ui/VerifiedBadge'
import { toast } from 'sonner'
import { DailyPipasAlertModal } from './DailyPipasAlertModal'
import { DdsAlertManager } from './DdsAlertManager'
import { UserOnlineNotification } from './UserOnlineNotification'
import { NewMessageNotification } from './chat/NewMessageNotification'
import { InstacenaNotificationPopup } from './instacena/InstacenaNotificationPopup'
import { BackButton } from './BackButton'
import { AppUpdateNotification } from './AppUpdateNotification'
import { clearDailySessionExpiry } from '../lib/sessionManager'
import { PortalSidebar } from './layout/PortalSidebar'
import { PortalHeader } from './layout/PortalHeader'
import { GlobalSearchModal } from './GlobalSearchModal'

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isDark } = useTheme()

  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState({ id: '', name: '', role: '', avatarUrl: '' })

  const { toggleSidebar, unreadCountGlobally, activeChats, isSidebarOpen } = useChat()
  usePresence(currentUser.id)
  useChatRealtime(currentUser.id)
  useGlobalPresenceSync(currentUser.id)

  // Verifica atualização imediatamente ao carregar
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const serverVersion = data.version
        if (!serverVersion) return

        const CURRENT_VERSION = (window as any).__APP_VERSION__
        const STORAGE_KEY = 'app_acknowledged_version'
        const acknowledgedVersion = localStorage.getItem(STORAGE_KEY)

        if (
          serverVersion &&
          acknowledgedVersion &&
          serverVersion !== acknowledgedVersion &&
          CURRENT_VERSION &&
          serverVersion !== CURRENT_VERSION
        ) {
          console.log('[AppLayout] Nova versão detectada, limpando cache...')
          if ('caches' in window) {
            const names = await caches.keys()
            await Promise.all(names.map((n) => caches.delete(n)))
          }
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations()
            await Promise.all(regs.map((r) => r.unregister()))
          }
          localStorage.setItem(STORAGE_KEY, serverVersion)
          window.location.href = window.location.pathname + '?t=' + Date.now()
        }
      } catch (e) {
        console.warn('[AppLayout] Erro ao verificar update:', e)
      }
    }
    checkUpdate()
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: any }) => {
      if (!data?.user) {
        navigate({ to: '/' })
        return
      }
      const role = data.user.user_metadata?.role || ''
      const userName =
        data.user.user_metadata?.full_name ||
        data.user.user_metadata?.name ||
        data.user.email?.split('@')[0] ||
        'Usuário'
      if (userName && userName !== 'Usuário') {
        try {
          localStorage.setItem('sucena_user_name', userName)
        } catch (_) {}
      }
      setCurrentUser({
        id: data.user.id || '',
        name: userName,
        role: role || 'Usuário',
        avatarUrl: data.user.user_metadata?.avatar_url || '',
      })
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
        navigate({ to: '/' })
        return
      }
      if (session?.user) {
        const role = session.user.user_metadata?.role || ''
        const userName =
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          session.user.email?.split('@')[0] ||
          'Usuário'
        if (userName && userName !== 'Usuário') {
          try {
            localStorage.setItem('sucena_user_name', userName)
          } catch (_) {}
        }
        setCurrentUser({
          id: session.user.id || '',
          name: userName,
          role: role || 'Usuário',
          avatarUrl: session.user.user_metadata?.avatar_url || '',
        })
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  const handleLogoutConfirm = async () => {
    setShowLogoutConfirm(false)
    setIsLoggingOut(true)
    setTimeout(async () => {
      clearDailySessionExpiry()
      await supabase.auth.signOut()
      navigate({ to: '/' })
    }, 1500)
  }

  return (
    <div
      className={`min-h-screen font-sans selection:bg-amber-500/30 transition-colors duration-300 ${
        isDark ? 'bg-[#0F172A] text-white' : 'bg-[#F4F6F9] text-slate-900'
      }`}
    >
      <LogoutOverlay
        isVisible={isLoggingOut}
        userName={currentUser.name}
        userRole={currentUser.role}
      />
      <AppUpdateNotification />
      <DailyPipasAlertModal enabled={Boolean(currentUser.id)} />
      <DdsAlertManager />
      {currentUser.id && (
        <>
          <UserOnlineNotification currentUserId={currentUser.id} />
          <NewMessageNotification currentUserId={currentUser.id} />
          <InstacenaNotificationPopup currentUserId={currentUser.id} />
        </>
      )}

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      {/* Left Persistent Navigation Sidebar */}
      <PortalSidebar
        currentUserId={currentUser.id}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Layout Area (shifted right on desktop by sidebar width) */}
      <div className="lg:pl-[215px] flex flex-col min-h-screen">
        {/* Top Header Bar */}
        <PortalHeader
          currentUser={currentUser}
          onMenuToggle={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onLogoutRequest={() => setShowLogoutConfirm(true)}
        />

        {/* Scrollable Page Content */}
        <main className="flex-1 w-full p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
          {/* Back Button on subpages (depth >= 2) */}
          {location.pathname.split('/').filter(Boolean).length >= 2 && (
            <div className="mb-4">
              <BackButton />
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Chat Sidebar Overlay */}
      {currentUser.id && <ChatSidebar currentUserId={currentUser.id} />}

      {/* Floating Chat Windows */}
      <div
        className={`fixed bottom-[24px] z-[105] flex items-end gap-3 pointer-events-none transition-all duration-300 ${
          isSidebarOpen ? 'right-[324px] md:right-[374px]' : 'right-[24px]'
        }`}
      >
        {currentUser.id &&
          activeChats.map((chatId) => (
            <ChatWindow key={chatId} currentUserId={currentUser.id} conversationId={chatId} />
          ))}
      </div>

      {/* Confirm Logout Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111C2E] border border-gray-200 dark:border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/20 text-red-500 mx-auto flex items-center justify-center mb-4">
              <LogOut size={24} />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Encerrar Sessão</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-6">
              Deseja realmente sair do sistema de gestão?
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleLogoutConfirm}
                className="flex-1 py-2 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Sim, sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
