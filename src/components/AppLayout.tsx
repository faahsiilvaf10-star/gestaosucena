import { useState, useEffect, ReactNode } from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import {
  FileText,
  LogOut,
  PlusCircle
} from 'lucide-react'
import { LogoutOverlay } from './LogoutOverlay'
import { useTheme } from '../contexts/ThemeContext'

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
  const [currentPath, setCurrentPath] = useState(window.location.pathname)
  const { isDark } = useTheme()

  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [currentUser, setCurrentUser] = useState({ name: '', role: '' })
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const role = data.user?.user_metadata?.role || ''
      setCurrentUser({
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
      <header className="min-h-[64px] py-2 shrink-0 flex items-center px-4 z-50 sticky top-0 bg-transparent">
        
        {/* Left Section: Contrato & Profile Badge */}
        <div className="flex items-center h-full shrink-0">
          <div className="flex items-center justify-center gap-1.5 mr-4 md:mr-6 relative h-full px-2">
            <FileText size={12} className={isDark ? "text-white/60" : "text-gray-500"} />
            <div className="flex flex-col justify-center leading-none">
              <span className={`text-[7px] uppercase tracking-wider font-semibold ${isDark ? 'text-white/50' : 'text-gray-500'} mb-[2px]`}>Contrato</span>
              <span className={`text-[11px] md:text-xs font-bold tracking-wide ${isDark ? 'text-white' : 'text-gray-900'}`}>460001269</span>
            </div>
            
            {/* Hanging Profile Badge - Seamlessly merged */}
            <div className="absolute top-[47px] left-0 w-full h-[76px] rounded-b-full flex flex-col items-center justify-center z-10 bg-transparent">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden shadow-inner">
                <img src="https://i.pravatar.cc/150?u=sucena" alt="Profile" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </div>

        {/* Center Section: Navigation Links */}
        <nav className="flex-1 flex items-center justify-between gap-1 px-2 py-4 w-full overflow-x-auto hide-scrollbar">
          {headerLinks.map((link, idx) => {
            const isActive = currentPath === link.href
            
            if (link.isHighlight) {
              return (
                <button
                  key={idx}
                  onClick={() => link.href && navigate({ to: link.href as any })}
                  className={`transition-all whitespace-nowrap inline-block ${
                    isActive
                      ? "font-tarmiles text-[clamp(14px,1.5vw,24px)] text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.5)] tracking-wide"
                      : `font-sans font-bold uppercase text-[clamp(7px,0.7vw,13px)] tracking-widest scale-y-[1.3] origin-bottom ${isDark ? 'text-white/70 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`
                  }`}
                >
                  {link.label}
                </button>
              )
            }
            
            if (link.isEmergency) {
              return (
                <button
                  key={idx}
                  onClick={() => link.href && navigate({ to: link.href as any })}
                  className="font-sans font-bold uppercase text-[clamp(7px,0.7vw,13px)] tracking-widest text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)] hover:text-red-400 transition-all whitespace-nowrap inline-block scale-y-[1.3] origin-bottom"
                >
                  {link.label}
                </button>
              )
            }
            
            return (
              <button
                key={idx}
                onClick={() => link.href && navigate({ to: link.href as any })}
                className={`transition-all whitespace-nowrap inline-block ${
                  isActive 
                    ? `font-tarmiles tracking-wide text-[clamp(14px,1.5vw,24px)] text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.4)]` 
                    : `font-sans font-bold uppercase text-[clamp(7px,0.7vw,13px)] tracking-widest scale-y-[1.3] origin-bottom ${isDark ? 'text-white/70 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`
                }`}
              >
                {link.label}
              </button>
            )
          })}
          
          {/* CIPA Icon */}
          <button className="flex items-center justify-center w-5 h-5 xl:w-6 xl:h-6 rounded-full bg-green-600 text-white hover:bg-green-500 transition-colors shadow-[0_0_10px_rgba(22,163,74,0.5)] shrink-0 ml-1">
            <PlusCircle size={14} strokeWidth={3} />
          </button>
        </nav>
      </header>

      {/* Main Scrollable Content */}
      <main className="vt-main flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar relative z-0 mb-14 px-4 md:px-12 lg:px-24 xl:px-32">
        {children}
      </main>

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
          <button className={`relative transition-colors ${isDark ? 'text-white/80 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <span className="absolute -top-1.5 -right-1.5 bg-gray-500 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">0</span>
          </button>

          {/* Status Dot */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <span className={`text-[11px] font-medium tracking-wide ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
              Cor proibida: Vermelha
            </span>
          </div>
        </div>

        {/* Bottom Right: Background SVG Element */}
        <div className="absolute right-0 bottom-0 pointer-events-none opacity-20 transition-opacity duration-300">
          <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M200 200V0C89.543 0 0 89.543 0 200H200Z" fill={isDark ? "url(#corner-gradient-dark)" : "url(#corner-gradient-light)"} />
            <defs>
              <linearGradient id="corner-gradient-dark" x1="200" y1="0" x2="0" y2="200" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6366f1" stopOpacity="0.4" />
                <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="corner-gradient-light" x1="200" y1="0" x2="0" y2="200" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6366f1" stopOpacity="0.15" />
                <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
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

    </div>
  )
}
