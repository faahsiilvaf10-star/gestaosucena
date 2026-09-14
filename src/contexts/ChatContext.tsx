import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react'

interface ChatContextData {
  isSidebarOpen: boolean
  setIsSidebarOpen: (isOpen: boolean) => void
  unreadCountGlobally: number
  setUnreadCountGlobally: React.Dispatch<React.SetStateAction<number>>
  activeChats: string[]
  openChat: (id: string) => void
  closeChat: (id: string) => void
  toggleSidebar: () => void
}

const ChatContext = createContext<ChatContextData>({} as ChatContextData)

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [unreadCountGlobally, setUnreadCountGlobally] = useState(0)
  const [activeChats, setActiveChats] = useState<string[]>([])

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev)

  const openChat = (id: string) => {
    setActiveChats(prev => {
      // Se já está aberto, traz para frente se necessário, mas como é array lado a lado, apenas garante que está lá.
      if (prev.includes(id)) return prev;
      // Adiciona o novo ID. Limita a, por exemplo, 3 conversas simultâneas na tela? 
      // Por simplicidade de Facebook, vamos manter até 3 abertas, removendo a mais antiga.
      const newChats = [...prev, id];
      if (newChats.length > 3) newChats.shift();
      return newChats;
    })
  }

  const closeChat = (id: string) => {
    setActiveChats(prev => prev.filter(chatId => chatId !== id))
  }

  // Ocultar barra de rolagem do body quando o chat está aberto no mobile (opcional)
  useEffect(() => {
    if (isSidebarOpen && window.innerWidth < 768) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isSidebarOpen])

  return (
    <ChatContext.Provider
      value={{
        isSidebarOpen,
        setIsSidebarOpen,
        unreadCountGlobally,
        setUnreadCountGlobally,
        activeChats,
        openChat,
        closeChat,
        toggleSidebar,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
}
