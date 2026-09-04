import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react'

interface ChatContextData {
  isSidebarOpen: boolean
  setIsSidebarOpen: (isOpen: boolean) => void
  unreadCountGlobally: number
  setUnreadCountGlobally: (count: number) => void
  activeConversation: string | null
  setActiveConversation: (id: string | null) => void
  toggleSidebar: () => void
}

const ChatContext = createContext<ChatContextData>({} as ChatContextData)

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [unreadCountGlobally, setUnreadCountGlobally] = useState(0)
  const [activeConversation, setActiveConversation] = useState<string | null>(null)

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev)

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
        activeConversation,
        setActiveConversation,
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
