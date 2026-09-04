import { useEffect } from 'react'
import { X, Search } from 'lucide-react'
import { useChat } from '../contexts/ChatContext'
import { useTheme } from '../contexts/ThemeContext'
import { ConversationList } from './chat/ConversationList'
import { ChatWindow } from './chat/ChatWindow'

export function ChatSidebar({ currentUserId }: { currentUserId: string }) {
  const { isSidebarOpen, setIsSidebarOpen, activeConversation } = useChat()
  const { isDark } = useTheme()

  // Fechar barra lateral ao pressionar Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSidebarOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setIsSidebarOpen])

  // Lógica de largura baseada em estar com conversa aberta ou não
  const isExpanded = !!activeConversation
  
  return (
    <>
      {/* Backdrop opcional (somente no mobile ou para escurecer fundo) */}
      <div 
        className={`fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[99] transition-opacity duration-300 md:hidden ${
          isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Container Principal */}
      <div 
        className={`fixed top-0 right-0 h-[100dvh] z-[100] transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] flex
          ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full'}
          ${isDark ? 'bg-[#090A0C] border-l border-white/5 text-white' : 'bg-gray-50 border-l border-black/5 text-gray-900'}
        `}
        style={{
          width: isSidebarOpen ? (isExpanded ? 'min(100vw, 850px)' : 'min(100vw, 400px)') : 'min(100vw, 400px)'
        }}
      >
        
        {/* Painel Esquerdo (Lista de Conversas) */}
        <div 
          className={`h-full flex flex-col transition-all duration-300 shrink-0
            ${isExpanded ? 'hidden md:flex md:w-[350px] border-r' : 'w-full'}
            ${isDark ? 'border-white/5' : 'border-black/5'}
          `}
        >
          {/* Cabeçalho da Lista */}
          <div className="h-16 shrink-0 flex items-center justify-between px-4">
            <h2 className="font-bold text-lg">Chat</h2>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Barra de Pesquisa */}
          <div className="px-4 pb-3 shrink-0">
            <div className={`relative flex items-center rounded-lg overflow-hidden ${isDark ? 'bg-[#15161A]' : 'bg-white border shadow-sm'}`}>
              <div className="absolute left-3">
                <Search size={16} className={isDark ? "text-white/40" : "text-gray-400"} />
              </div>
              <input 
                type="text"
                placeholder="Pesquisar usuário ou conversa..."
                className="w-full bg-transparent py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-gray-500"
              />
            </div>
          </div>

          {/* Listagem (Online + Recentes) */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <ConversationList currentUserId={currentUserId} />
          </div>
        </div>

        {/* Painel Direito (Conversa Aberta) */}
        {activeConversation && (
          <div className={`flex-1 h-full flex flex-col relative ${isDark ? 'bg-[#111216]' : 'bg-white'}`}>
            <ChatWindow currentUserId={currentUserId} conversationId={activeConversation} />
          </div>
        )}
      </div>
    </>
  )
}
