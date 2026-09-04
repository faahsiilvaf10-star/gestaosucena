import { useState, useEffect, ReactNode } from 'react'
import { useNavigate, useRouter, useLocation } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import {
  FileText,
  LogOut,
  PlusCircle
} from 'lucide-react'
import { LogoutOverlay } from './LogoutOverlay'
import { useTheme } from '../contexts/ThemeContext'
import { MonthlyColorsModal } from './MonthlyColorsModal'
import { useMonthlyColors } from '../hooks/useMonthlyColors'
import { useChat } from '../contexts/ChatContext'
import { usePresence } from '../hooks/usePresence'
import { useChatRealtime } from '../hooks/useChatRealtime'
import { ChatSidebar } from './ChatSidebar'

const headerLinks = [
  { label: 'Destaques', href: '/dashboard', isHighlight: true },
  { label: 'Lembretes', href: '/lembretes' },
  { label: 'InstaCena', href: '#' },
  { label: 'Almoxarifado', href: '#' },
  { label: 'Documentos', href: '#' },
  { label: 'Equipamentos', href: '#' },
  { label: 'Segurança', href: '#' },
  { label: 'RH', href: '#' },
  { label: 'Relatório Diário Obra', href: '#' },
  { label: 'Meio Ambiente', href: '#' },
  { label: 'Planejamento', href: '#' },
  { label: 'Emergência', href: '#', isEmergency: true },
]

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const router = useRouter()
  const location = useLocation()
  const currentPath = location.pathname
  const { isDark } = useTheme()

  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showMonthlyColorsModal, setShowMonthlyColorsModal] = useState(false)
  const [currentUser, setCurrentUser] = useState({ id: '', name: '', role: '' })
  
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
      const role = data.user?.user_metadata?.role || ''
      setCurrentUser({
        id: data.user?.id || '',
        name: data.user?.user_metadata?.full_name || data.user?.email || 'Usuário',
        role: role || 'Usuário'
      })
    })
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
    <div className={`h-screen max-h-[100dvh] flex flex-col overflow-hidden font-sans selection:bg-purple-500/30 transition-colors duration-300 ${isDark ? 'bg-transparent text-white' : 'bg-transparent text-black'}`}>
      <LogoutOverlay isVisible={isLoggingOut} userName={currentUser.name} userRole={currentUser.role} />

      {/* Universal Top Gradient Backdrop */}
      <div className={`absolute top-0 left-0 right-0 h-32 pointer-events-none z-40 transition-colors duration-300 ${isDark ? 'bg-gradient-to-b from-[#0a0a0c] via-[#0a0a0c]/80 to-transparent' : 'bg-gradient-to-b from-white via-white/80 to-transparent'}`} />
      
      {/* Top Navigation Bar — Fixed */}
      <div className="pt-3 px-3 md:px-6 sticky top-0 z-50 w-full mb-8">
        <div className="w-full relative filter drop-shadow-[0_0_1px_rgba(250,204,21,0.8)] drop-shadow-[0_0_6px_rgba(250,204,21,0.4)]">
          <header className={`h-[38px] rounded-[19px] flex items-stretch pl-3 pr-4 transition-colors duration-300 ${isDark ? 'bg-[#0a0a0c]' : 'bg-white'}`}>
                  {/* Left Section: Contrato Text & Hanging Profile */}
            <div className="flex flex-col items-center justify-center relative h-full shrink-0 mr-4 md:mr-6 min-w-[96px]">
              
              {/* Text Container */}
              <div className="flex items-center justify-center gap-1.5 h-full z-20 relative">
                <FileText size={12} className={isDark ? "text-white/60" : "text-gray-500"} />
                <div className="flex flex-col justify-center leading-none">
                  <span className={`text-[7px] uppercase tracking-wider font-semibold ${isDark ? 'text-white/50' : 'text-gray-500'} mb-[2px]`}>Contrato</span>
                  <span className={`text-[11px] md:text-xs font-bold tracking-wide ${isDark ? 'text-white' : 'text-gray-900'}`}>460001269</span>
                </div>
              </div>
              
              {/* Hanging Profile U-Shape Tab with Seam-Free Outward Curves */}
              <div className="absolute top-[38px] left-1/2 -translate-x-1/2 w-[56px] h-[53px] z-10">
                
                {/* Main U-shape background - Overlaps bar by 1px to prevent drop-shadow seams */}
                <div className={`absolute top-[-1px] left-0 right-0 bottom-0 rounded-b-[28px] -z-10 ${isDark ? 'bg-[#0a0a0c]' : 'bg-white'}`} />
                
                {/* Left inverted corner - Overlaps bar and U-shape by 1px */}
                <svg className={`absolute top-[-1px] -left-[13px] w-[14px] h-[14px] -z-10 ${isDark ? 'text-[#0a0a0c]' : 'text-white'}`} fill="currentColor" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d="M100,0 L0,0 C55.23,0 100,44.77 100,100 Z" />
                </svg>
                
                {/* Right inverted corner - Overlaps bar and U-shape by 1px */}
                <svg className={`absolute top-[-1px] -right-[13px] w-[14px] h-[14px] -z-10 ${isDark ? 'text-[#0a0a0c]' : 'text-white'}`} fill="currentColor" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d="M0,0 L100,0 C44.77,0 0,44.77 0,100 Z" />
                </svg>

                {/* Profile Image - Centered and Concentric */}
                <div className="absolute top-[3px] left-[6px] w-[44px] h-[44px] rounded-full overflow-hidden border border-[#1a1a1c] z-20">
                  <img src="https://i.pravatar.cc/150?u=sucena" alt="Profile" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>

        {/* Center Section: Navigation Links */}
        <nav className="flex-1 flex items-center justify-between gap-1 md:gap-1.5 px-2 py-2 w-full overflow-x-auto hide-scrollbar">
          {headerLinks.map((link, idx) => {
            const isActive = currentPath === link.href
            
            const renderLink = () => {
              if (link.isHighlight) {
                return (
                  <button
                    onClick={() => link.href && navigate({ to: link.href as any })}
                    className={`transition-all whitespace-nowrap inline-block font-sans font-bold uppercase text-[clamp(7px,0.75vw,10px)] tracking-wide scale-y-[1.15] origin-bottom ${
                      isActive
                        ? "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
                        : `${isDark ? 'text-white/70 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`
                    }`}
                  >
                    {link.label}
                  </button>
                )
              }
              
              if (link.isEmergency) {
                return (
                  <button
                    onClick={() => link.href && navigate({ to: link.href as any })}
                    className="font-sans font-bold uppercase text-[clamp(7px,0.75vw,10px)] tracking-wide text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)] hover:text-red-400 transition-all whitespace-nowrap inline-block scale-y-[1.15] origin-bottom"
                  >
                    {link.label}
                  </button>
                )
              }
              
              return (
                <button
                  onClick={() => link.href && navigate({ to: link.href as any })}
                  className={`transition-all whitespace-nowrap inline-block font-sans font-bold uppercase text-[clamp(7px,0.75vw,10px)] tracking-wide scale-y-[1.15] origin-bottom ${
                    isActive 
                      ? `text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]` 
                      : `${isDark ? 'text-white/70 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`
                  }`}
                >
                  {link.label}
                </button>
              )
            }

            return (
              <div key={idx} className="flex items-center gap-1 md:gap-1.5 shrink-0">
                {renderLink()}
                {idx < headerLinks.length - 1 && (
                  <span className={`text-[9px] scale-y-[0.8] mb-[2px] ${isDark ? 'text-white/20' : 'text-gray-400/40'}`}>-</span>
                )}
              </div>
            )
          })}
          
          {/* CIPA Icon */}
          <button className="flex items-center justify-center w-5 h-5 xl:w-6 xl:h-6 rounded-full bg-green-600 text-white hover:bg-green-500 transition-colors shadow-[0_0_10px_rgba(22,163,74,0.5)] shrink-0 ml-1">
            <PlusCircle size={14} strokeWidth={3} />
          </button>
          </nav>
          </header>
        </div>
      </div>

      {/* Main Scrollable Content */}
      <main className="vt-main flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar relative z-0 mb-14 px-4 md:px-12 lg:px-24 xl:px-32">
        {children}
      </main>

      {/* Chat Sidebar Overlay */}
      {currentUser.id && <ChatSidebar currentUserId={currentUser.id} />}

      {/* Bottom Status Bar */}
      <footer className={`fixed bottom-0 left-0 right-0 h-9 z-50 flex items-center justify-between px-6 transition-colors duration-300 ${isDark ? 'bg-[#0a0a0c]/80 backdrop-blur-md border-t border-white/5' : 'bg-white/90 backdrop-blur-md border-t border-black/5 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]'}`}>
        
        {/* Bottom Left: Logout and Action Icons */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowLogoutConfirm(true)}
            className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${isDark ? 'text-white hover:text-yellow-400' : 'text-gray-900 hover:text-yellow-500'}`}
          >
            <LogOut size={13} />
            SAIR
          </button>
          

          <button 
            className={`flex items-center justify-center p-1.5 rounded-lg transition-colors ${isDark ? 'text-white/80 hover:text-white hover:bg-white/10' : 'text-gray-700 hover:text-gray-900 hover:bg-black/5'}`}
            title="Recarregar"
            onClick={() => window.location.reload()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
          </button>
        </div>

        {/* Bottom Center: Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 flex justify-center pointer-events-none">
          <img src={isDark ? "/logo.png" : "/logo-light-theme.png"} alt="Sucena Logo" className={`h-5 w-auto object-contain transition-all duration-300 opacity-60 ${isDark ? 'filter brightness-0 invert' : ''}`} />
        </div>

        {/* Bottom Right: Actions and Status */}
        <div className="flex items-center gap-6">
          
          {/* Chat Icon with Badge */}
          <button 
            onClick={toggleSidebar}
            className={`relative transition-colors ${isDark ? 'text-white/80 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            {unreadCountGlobally > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#D6A72B] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                {unreadCountGlobally > 99 ? '99+' : unreadCountGlobally}
              </span>
            )}
          </button>

          {/* Status Dot */}
          <button 
            className={`flex items-center gap-2 p-3 -m-3 rounded-xl transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'} relative z-10`}
            onClick={() => {
              console.log("Status dot clicked. Opening MonthlyColorsModal...")
              setShowMonthlyColorsModal(true)
            }}
            title="Configurar cores mensais"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className={`p-6 rounded-2xl w-full max-w-sm border shadow-2xl ${isDark ? 'bg-[#121214] border-white/10' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Confirmar saída</h3>
            <p className={`text-sm mb-6 ${isDark ? 'text-white/70' : 'text-gray-600'}`}>Tem certeza que deseja sair do sistema?</p>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}
              >
                Cancelar
              </button>
              <button 
                onClick={handleLogoutConfirm}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
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
