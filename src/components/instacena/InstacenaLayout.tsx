import { ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useTheme } from '../../contexts/ThemeContext'
import { Home, Search, Compass, Film, MessageCircle, Heart, PlusSquare, User } from 'lucide-react'

interface InstacenaLayoutProps {
  children: ReactNode
}

export function InstacenaLayout({ children }: InstacenaLayoutProps) {
  const { isDark } = useTheme()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  const navItems = [
    { label: 'Início', icon: Home, href: '/instacena' },
    { label: 'Pesquisar', icon: Search, href: '/instacena/pesquisa' },
    { label: 'Explorar', icon: Compass, href: '/instacena/explorar' },
    { label: 'Reels', icon: Film, href: '/instacena/reels' },
    { label: 'Notificações', icon: Heart, href: '/instacena/notificacoes' },
    { label: 'Perfil', icon: User, href: '/instacena/perfil' },
  ]

  return (
    <div className={`w-full flex h-full ${isDark ? 'text-white' : 'text-gray-900'}`}>
      
      {/* Desktop Sidebar (Left) */}
      <aside className="hidden md:flex flex-col w-[200px] lg:w-[244px] h-full border-r border-black/10 dark:border-white/10 px-4 py-8 shrink-0 sticky top-0">
        <h1 className="text-2xl font-bold italic tracking-tighter px-2 mb-8" style={{ fontFamily: 'var(--font-tarmiles, sans-serif)' }}>
          INSTACENA
        </h1>

        <nav className="flex flex-col gap-2">
          {navItems.map((item) => (
            <Link 
              key={item.href} 
              to={item.href}
              className={`flex items-center gap-4 px-3 py-3 rounded-lg transition-all group ${currentPath === item.href ? 'font-bold' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            >
              <item.icon size={24} className={`group-hover:scale-105 transition-transform ${currentPath === item.href ? 'stroke-[2.5px]' : ''}`} />
              <span className="text-[15px]">{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar relative bg-transparent pb-16 md:pb-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-white/10 sticky top-0 z-10 backdrop-blur-md bg-transparent">
          <h1 className="text-xl font-bold italic tracking-tighter" style={{ fontFamily: 'var(--font-tarmiles, sans-serif)' }}>
            INSTACENA
          </h1>
          <div className="flex items-center gap-4">
            <Link to="/instacena/notificacoes">
              <Heart size={24} />
            </Link>
          </div>
        </header>

        <div className="flex-1 w-full max-w-[600px] mx-auto">
          {children}
        </div>


      </main>

      {/* Mobile Bottom Navigation */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 h-[60px] border-t backdrop-blur-md flex items-center justify-around z-50 ${isDark ? 'bg-[#0a0a0c]/90 border-white/10' : 'bg-white/90 border-black/5'}`}>
        {navItems.filter(item => ['Início', 'Pesquisar', 'Explorar', 'Reels', 'Perfil'].includes(item.label)).map((item) => (
          <Link key={item.href} to={item.href} className="p-2 transition-transform active:scale-95">
            <item.icon size={26} className={`${currentPath === item.href ? 'stroke-[2.5px]' : ''}`} />
          </Link>
        ))}
      </nav>

    </div>
  )
}
