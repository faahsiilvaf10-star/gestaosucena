import { useState, useEffect, ReactNode } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import {
  LogOut,
} from 'lucide-react'
import { LogoutOverlay } from './LogoutOverlay'
import { useTheme } from '../contexts/ThemeContext'
import { MonthlyColorsModal } from './MonthlyColorsModal'
import { useMonthlyColors } from '../hooks/useMonthlyColors'
import { useChat } from '../contexts/ChatContext'
import { usePresence } from '../hooks/usePresence'
import { useChatRealtime } from '../hooks/useChatRealtime'
import { ChatSidebar } from './ChatSidebar'
import { WindowsNavbar } from './WindowsNavbar'

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isDark } = useTheme()

  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showMonthlyColorsModal, setShowMonthlyColorsModal] = useState(false)
  const [currentUser, setCurrentUser] = useState({ id: '', name: '', role: '', avatarUrl: '' })
  
  const { toggleSidebar, unreadCountGlobally } = useChat()
  usePresence(currentUser.id)
  useChatRealtime(currentUser.id)
  
  const { currentColor } = useMonthlyColors()

  const colorStyles = {
    red: { dot: 'bg-red-500', ping: 'bg-red-400' },
    blue: { dot: 'bg-blue-500', ping: 'bg-blue-400' },
    yellow: { dot: 'bg-yellow-500', ping: 'bg-yellow-400' },
    green: { dot: 'bg-green-500', ping: 'bg-green-400' }
  }
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const role = data.user.user_metadata?.role || ''
        setCurrentUser({
          id: data.user.id || '',
          name: data.user.user_metadata?.full_name || data.user.email || 'Usuário',
          role: role || 'Usuário',
          avatarUrl: data.user.user_metadata?.avatar_url || ''
        })
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const role = session.user.user_metadata?.role || ''
        setCurrentUser({
          id: session.user.id || '',
          name: session.user.user_metadata?.full_name || session.user.email || 'Usuário',
          role: role || 'Usuário',
          avatarUrl: session.user.user_metadata?.avatar_url || ''
        })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogoutConfirm = async () => {
    setShowLogoutConfirm(false)
    setIsLoggingOut(true)
    setTimeout(async () => {
      await supabase.auth.signOut()
      navigate({ to: '/' })
    }, 5000)
  }

  return (
    <div className={`
      flex flex-col overflow-hidden font-sans selection:bg-purple-500/30 transition-colors duration-300
      ${isDark ? 'bg-[#000] text-gray-900 dark:text-white' : 'bg-[#f4f3f0] text-gray-900'}
    `}
    style={{ height: '100dvh', maxHeight: '100dvh' }}
    >
      <LogoutOverlay isVisible={isLoggingOut} userName={currentUser.name} userRole={currentUser.role} />

      {/* Universal Top Gradient Backdrop */}
      <div className={`absolute top-0 left-0 right-0 h-32 pointer-events-none z-40 transition-colors duration-300 ${isDark ? 'bg-gradient-to-b from-[#0a0a0c] via-[#0a0a0c]/80 to-transparent' : 'bg-gradient-to-b from-[#f4f3f0] via-[#f4f3f0]/80 to-transparent'}`} />
      
      {/* Top Navigation Bar — Windows 11 Liquid Glass */}
      <WindowsNavbar currentUser={currentUser} onLogoutRequest={() => setShowLogoutConfirm(true)} />

      {/* Main Scrollable Content */}
      <main 
        className="vt-main flex-1 overflow-y-auto overflow-x-hidden relative z-0"
        style={{ 
          /* Em mobile: sem padding lateral excessivo */
          paddingBottom: 'max(56px, calc(56px + env(safe-area-inset-bottom, 0px)))'
        }}
      >
        <div className="px-3 sm:px-6 md:px-12 lg:px-24 xl:px-32">
          {children}
        </div>
      </main>

      {/* Chat Sidebar Overlay */}
      {currentUser.id && <ChatSidebar currentUserId={currentUser.id} />}

      {/* Bottom Status Bar */}
      <footer 
        className={`fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between transition-colors duration-300 ${isDark ? 'bg-[#0a0a0c]/80 backdrop-blur-md border-t border-white/5' : 'bg-[#faf9f6]/90 backdrop-blur-md border-t border-black/5 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]'}`}
        style={{
          height: 'max(36px, calc(36px + env(safe-area-inset-bottom, 0px)))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingLeft: 'max(16px, env(safe-area-inset-left, 16px))',
          paddingRight: 'max(16px, env(safe-area-inset-right, 16px))',
        }}
      >
        
        {/* Bottom Left: Logout — escondido em mobile pequeno para economizar espaço */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button 
            onClick={() => setShowLogoutConfirm(true)}
            className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors touch-target ${isDark ? 'text-gray-900 dark:text-white hover:text-yellow-400' : 'text-gray-900 hover:text-yellow-500'}`}
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">SAIR</span>
          </button>
          
          <button 
            className={`flex items-center justify-center rounded-lg transition-colors ${isDark ? 'text-gray-900 dark:text-white/80 hover:text-gray-900 dark:text-white hover:bg-white/10' : 'text-gray-700 hover:text-gray-900 hover:bg-black/5'}`}
            title="Recarregar"
            onClick={() => window.location.reload()}
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
          </button>
        </div>

        {/* Bottom Center: Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 flex justify-center pointer-events-none">
          <img src={isDark ? "/logo.png" : "/logo-light-theme.png"} alt="Sucena Logo" className={`h-5 w-auto object-contain transition-all duration-300 opacity-60 ${isDark ? 'filter brightness-0 invert' : ''}`} />
        </div>

        {/* Bottom Right: Chat + Status */}
        <div className="flex items-center gap-3 sm:gap-6">

          {/* Chat Icon with Badge */}
          <button 
            onClick={toggleSidebar}
            className={`relative transition-colors ${isDark ? 'text-gray-900 dark:text-white/80 hover:text-gray-900 dark:text-white' : 'text-gray-700 hover:text-gray-900'}`}
            style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            {unreadCountGlobally > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#D6A72B] text-gray-900 dark:text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                {unreadCountGlobally > 99 ? '99+' : unreadCountGlobally}
              </span>
            )}
          </button>

          {/* Status Dot */}
          <button 
            className={`flex items-center gap-2 rounded-xl transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'} relative z-10`}
            onClick={() => {
              setShowMonthlyColorsModal(true)
            }}
            title="Configurar cores mensais"
            style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${colorStyles[currentColor as keyof typeof colorStyles]?.ping || 'bg-red-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colorStyles[currentColor as keyof typeof colorStyles]?.dot || 'bg-red-500'}`}></span>
            </span>
          </button>
        </div>

      </footer>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`p-6 rounded-2xl w-full max-w-sm border shadow-2xl ${isDark ? 'bg-[#121214] border-white/10' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-gray-900 dark:text-white' : 'text-gray-900'}`}>Confirmar saída</h3>
            <p className={`text-sm mb-6 ${isDark ? 'text-gray-900 dark:text-white/70' : 'text-gray-600'}`}>Tem certeza que deseja sair do sistema?</p>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isDark ? 'bg-white/10 hover:bg-white/20 text-gray-900 dark:text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}
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

      {/* Monthly Colors Modal */}
      <MonthlyColorsModal 
        isOpen={showMonthlyColorsModal} 
        onClose={() => setShowMonthlyColorsModal(false)} 
      />

    </div>
  )
}
