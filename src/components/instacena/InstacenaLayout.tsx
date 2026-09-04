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
    { label: 'Mensagens', icon: MessageCircle, href: '/instacena/mensagens' },
    { label: 'Notificações', icon: Heart, href: '/instacena/notificacoes' },
    { label: 'Criar', icon: PlusSquare, href: '/instacena/criar' },
    { label: 'Perfil', icon: User, href: '/instacena/perfil' },
  ]

  return (
    <div className={`w-full max-w-6xl mx-auto flex h-full ${isDark ? 'text-white' : 'text-gray-900'}`}>
      
      {/* Desktop Sidebar (Left) */}
      <aside className="hidden md:flex flex-col w-[240px] lg:w-[280px] h-full border-r border-white/10 px-4 py-8 shrink-0 sticky top-0">
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
            <Link to="/instacena/mensagens">
              <MessageCircle size={24} />
            </Link>
          </div>
        </header>

        <div className="flex-1 w-full max-w-[600px] mx-auto xl:mx-0">
          {children}
        </div>

        {/* Desktop Suggestions (Right) - Hidden on smaller screens */}
        <div className="hidden xl:block absolute right-0 top-8 w-[320px] px-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-full bg-gray-300 overflow-hidden">
               <img src="https://i.pravatar.cc/150?u=sucena" alt="Profile" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm">seu_usuario</span>
              <span className="text-sm opacity-60">Seu Nome</span>
            </div>
            <button className="ml-auto text-blue-500 font-bold text-xs hover:text-blue-400">Mudar</button>
          </div>

          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold opacity-60">Sugestões para você</span>
            <button className="text-xs font-bold hover:opacity-70">Ver tudo</button>
          </div>
          
          <div className="flex flex-col gap-4">
            {/* Example suggestion skeleton */}
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-300/50" />
                <div className="flex flex-col">
                  <span className="font-bold text-sm">usuario_{i}</span>
                  <span className="text-xs opacity-50">Novo no Instacena</span>
                </div>
                <button className="ml-auto text-blue-500 font-bold text-xs hover:text-blue-400">Seguir</button>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 h-[60px] border-t backdrop-blur-md flex items-center justify-around z-50 ${isDark ? 'bg-[#0a0a0c]/90 border-white/10' : 'bg-white/90 border-black/5'}`}>
        {[navItems[0], navItems[1], navItems[6], navItems[3], navItems[7]].map((item) => (
          <Link key={item.href} to={item.href} className="p-2 transition-transform active:scale-95">
            <item.icon size={26} className={`${currentPath === item.href ? 'stroke-[2.5px]' : ''}`} />
          </Link>
        ))}
      </nav>

    </div>
  )
}
