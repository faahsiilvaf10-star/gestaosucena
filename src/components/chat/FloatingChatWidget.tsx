import { useEffect, useState, useCallback, useRef } from 'react'
import X from 'lucide-react/dist/esm/icons/x.js'
import Search from 'lucide-react/dist/esm/icons/search.js'
import User from 'lucide-react/dist/esm/icons/user.js'
import Users from 'lucide-react/dist/esm/icons/users.js'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js'
import Clock from 'lucide-react/dist/esm/icons/clock.js'
import { format, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { useChat } from '../../contexts/ChatContext'
import { useUsersPresence } from '../../hooks/useUsersPresence'
import {
  getConversations,
  getOrCreateDirectConversation,
  clearConversation,
  restoreConversation,
  getUnreadMessagesData,
  markConversationAsRead
} from '../../lib/api-chat'

const PRESET_COLORS: Record<string, string> = {
  CA: '#f26522', // Laranja do print
  AS: '#8a4af3', // Roxo do print
  PM: '#0084ff', // Azul do print
}

const COLOR_PALETTE = [
  '#f26522',
  '#8a4af3',
  '#0084ff',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
  '#6366f1',
  '#e11d48',
  '#14b8a6',
]

function getInitials(name: string): string {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function getAvatarColor(initials: string): string {
  if (PRESET_COLORS[initials]) return PRESET_COLORS[initials]
  let sum = 0
  for (let i = 0; i < initials.length; i++) {
    sum += initials.charCodeAt(i)
  }
  return COLOR_PALETTE[sum % COLOR_PALETTE.length]
}

function formatConvTime(dateStr?: string | null): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    if (isToday(d)) return format(d, 'HH:mm')
    if (isYesterday(d)) return 'Ontem'
    return format(d, 'dd/MM')
  } catch {
    return ''
  }
}

export function formatLastSeen(dateStr?: string | null): string {
  if (!dateStr) return 'Offline'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return 'Offline'
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    if (diffMs < 60_000) return 'Visto agora há pouco'
    if (diffMs < 3600_000) {
      const minutes = Math.floor(diffMs / 60_000)
      return `Visto há ${minutes} min`
    }
    if (isToday(d)) {
      return `Visto hoje às ${format(d, 'HH:mm')}`
    }
    if (isYesterday(d)) {
      return `Visto ontem às ${format(d, 'HH:mm')}`
    }
    return `Visto em ${format(d, "dd/MM 'às' HH:mm", { locale: ptBR })}`
  } catch {
    return 'Offline'
  }
}

interface FormattedConversation {
  id: string
  title: string
  initials: string
  avatarColor: string
  avatarUrl?: string
  isOnline: boolean
  lastMessageText: string
  lastMessageTime: string
  rawDate: string
  unreadCount: number
  targetUserId?: string
}

export function FloatingChatWidget({ currentUserId }: { currentUserId: string }) {
  const { isSidebarOpen, setIsSidebarOpen, openChat, closeChat, unreadCountGlobally, setUnreadCountGlobally } = useChat()
  const { data: usersMap } = useUsersPresence()

  const [searchQuery, setSearchQuery] = useState('')
  const [conversations, setConversations] = useState<FormattedConversation[]>([])
  const [unreadConversationsCount, setUnreadConversationsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'conversas' | 'equipe'>('conversas')
  const [convToDelete, setConvToDelete] = useState<{ id: string; title: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const popupRef = useRef<HTMLDivElement>(null)

  // Carrega e formata as conversas com suas contagens reais de nao lidas
  const loadChatData = useCallback(async () => {
    if (!currentUserId) return

    try {
      // 1. Busca conversas e contagens de nao lidas em paralelo
      const [allConvs, unreadData] = await Promise.all([
        getConversations(),
        getUnreadMessagesData(currentUserId)
      ])

      // Atualiza contador global (apenas mensagens recebidas de outros)
      setUnreadCountGlobally(unreadData.totalUnread)
      setUnreadConversationsCount(unreadData.unreadConversationsCount)

      // Carrega registros locais de conversas apagadas para redundância instantânea
      let localDeletedMap: Record<string, string> = {}
      try {
        if (typeof window !== 'undefined') {
          const raw = localStorage.getItem('sucena_deleted_conversations_' + currentUserId)
          if (raw) localDeletedMap = JSON.parse(raw)
        }
      } catch (_) {}

      // 2. Filtra conversas pertencentes ao usuario atual
      const myConvs = allConvs.filter((conv: any) => {
        const myPart = conv.participants?.find((p: any) => p.user_id === currentUserId)
        if (!myPart) return false

        // Momento em que a conversa foi excluída/limpa (banco ou cache local)
        const dbClearedAt = myPart.cleared_at ? new Date(myPart.cleared_at).getTime() : 0
        const localClearedAt = localDeletedMap[conv.id] ? new Date(localDeletedMap[conv.id]).getTime() : 0
        const effectiveClearedAt = Math.max(dbClearedAt, localClearedAt)

        if (effectiveClearedAt > 0) {
          // Busca o timestamp da última mensagem (objeto joined ou campo da tabela)
          const lastMsgDate = conv.last_message?.created_at || conv.last_message_at
          const lastMsgTime = lastMsgDate ? new Date(lastMsgDate).getTime() : 0

          // Se não há mensagens após o momento em que foi apagada, a conversa não deve retornar
          if (!lastMsgTime || lastMsgTime <= effectiveClearedAt) {
            return false
          }
        }
        return true
      })

      // 3. Mapeia dados visuais
      const formatted: FormattedConversation[] = myConvs.map((conv: any) => {
        const otherParticipant = conv.participants?.find((p: any) => p.user_id !== currentUserId)
        const targetUser = otherParticipant && usersMap ? usersMap[otherParticipant.user_id] : null

        const title = conv.is_group
          ? conv.title || 'Grupo'
          : targetUser?.name || 'Colega de Equipe'

        const initials = getInitials(title)
        const avatarColor = getAvatarColor(initials)
        const isOnline = Boolean(targetUser?.isOnline)

        let lastMessageText = ''
        if (conv.last_message) {
          if (conv.last_message.type === 'text') {
            lastMessageText = conv.last_message.text
          } else if (conv.last_message.type === 'image') {
            lastMessageText = '📷 Imagem'
          } else if (conv.last_message.type === 'audio') {
            lastMessageText = '🎤 Áudio'
          } else {
            lastMessageText = '📎 Anexo'
          }
        }

        const rawDate = conv.last_message?.created_at || conv.updated_at || conv.created_at
        const lastMessageTime = formatConvTime(rawDate)
        const unreadCount = unreadData.unreadByConversation[conv.id] || 0

        return {
          id: conv.id,
          title,
          initials,
          avatarColor,
          avatarUrl: targetUser?.avatar_url,
          isOnline,
          lastMessageText,
          lastMessageTime,
          rawDate,
          unreadCount,
          targetUserId: targetUser?.id,
        }
      })

      // Ordena: primeiro conversas com mensagens nao lidas, depois por data mais recente
      formatted.sort((a, b) => {
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1
        if (b.unreadCount > 0 && a.unreadCount === 0) return 1
        return new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime()
      })

      setConversations(formatted)
    } catch (err) {
      console.error('Erro ao carregar dados do chat flutuante:', err)
    } finally {
      setLoading(false)
    }
  }, [currentUserId, usersMap, setUnreadCountGlobally])

  useEffect(() => {
    loadChatData()
  }, [loadChatData])

  // Ouvintes de eventos locais de leitura e novas mensagens
  useEffect(() => {
    const handleRefresh = () => {
      loadChatData()
    }

    window.addEventListener('hydro_chat_new_message', handleRefresh)
    window.addEventListener('hydro_chat_read', handleRefresh)

    return () => {
      window.removeEventListener('hydro_chat_new_message', handleRefresh)
      window.removeEventListener('hydro_chat_read', handleRefresh)
    }
  }, [loadChatData])

  // Fechar com a tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSidebarOpen) {
        setIsSidebarOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSidebarOpen, setIsSidebarOpen])

  // Ao clicar em uma conversa existente
  const handleOpenConversation = async (convId: string) => {
    openChat(convId)
    await markConversationAsRead(convId, currentUserId)
    window.dispatchEvent(new CustomEvent('hydro_chat_read', { detail: { conversationId: convId } }))

    // Zera contagem localmente de imediato
    setConversations(prev =>
      prev.map(c => (c.id === convId ? { ...c, unreadCount: 0 } : c))
    )

    if (window.innerWidth < 768) {
      setIsSidebarOpen(false)
    }
  }

  // Ao clicar em um colega para iniciar conversa direta
  const handleStartDirectChat = async (targetUserId: string) => {
    try {
      const convId = await getOrCreateDirectConversation(currentUserId, targetUserId)
      restoreConversation(convId, currentUserId)
      openChat(convId)
      await markConversationAsRead(convId, currentUserId)
      window.dispatchEvent(new CustomEvent('hydro_chat_read', { detail: { conversationId: convId } }))

      if (window.innerWidth < 768) {
        setIsSidebarOpen(false)
      }
      loadChatData()
    } catch (err: any) {
      console.error('Erro ao abrir conversa direta:', err)
    }
  }

  // Opção para solicitar confirmação in-page de exclusão
  const handlePromptDelete = (e: React.MouseEvent, conv: FormattedConversation) => {
    e.stopPropagation()
    setConvToDelete({ id: conv.id, title: conv.title })
  }

  // Executa exclusão permanente confirmada pelo usuário
  const handleConfirmDelete = async () => {
    if (!convToDelete) return
    setIsDeleting(true)
    const convId = convToDelete.id

    try {
      await clearConversation(convId, currentUserId)
      setConversations(prev => prev.filter(c => c.id !== convId))
      closeChat(convId)
      window.dispatchEvent(new CustomEvent('hydro_chat_read', { detail: { conversationId: convId } }))
      setConvToDelete(null)
      await loadChatData()
    } catch (err: any) {
      console.error('Erro ao excluir conversa:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  // Lista de colegas da equipe (para busca ou aba equipe)
  const teamUsers = usersMap
    ? Object.values(usersMap)
        .filter((u: any) => u.id !== currentUserId)
        .sort((a: any, b: any) => (a.isOnline === b.isOnline ? 0 : a.isOnline ? -1 : 1))
    : []

  // Filtragem pela busca
  const q = searchQuery.trim().toLowerCase()
  const filteredConversations = conversations.filter(c =>
    !q || c.title.toLowerCase().includes(q) || c.lastMessageText.toLowerCase().includes(q)
  )

  const filteredTeamUsers = teamUsers.filter((u: any) =>
    !q || u.name?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q)
  )

  return (
    <>
      {/* POPUP FLUTUANTE DE CONVERSAS (Ancorado acima do botao) */}
      {isSidebarOpen && (
        <div
          ref={popupRef}
          className="fixed bottom-[90px] right-6 z-[120] w-[360px] max-w-[calc(100vw-32px)] h-[520px] max-h-[calc(100vh-120px)] bg-white rounded-[26px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.35)] border border-gray-100 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200"
          style={{ fontFamily: 'inherit' }}
        >
          {/* CABECALHO AZUL MESSENGER - CHAT EQUIPE SUCENA */}
          <div className="bg-[#0084ff] px-4 py-3.5 flex items-center justify-between text-white shrink-0 select-none shadow-sm">
            <div className="flex items-center gap-3 overflow-hidden">
              {/* Avatar com circulo branco e bolinha verde online */}
              <div className="relative w-10 h-10 rounded-full border-2 border-white/80 bg-white/20 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                  <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.91 1.455 5.513 3.735 7.158V21.5a.75.75 0 0 0 1.157.632l2.67-1.602c.78.217 1.601.328 2.438.328 5.523 0 10-4.145 10-9.258C22 6.145 17.523 2 12 2z" />
                </svg>
                {/* Ponto verde de status */}
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#22c55e] border-2 border-white shadow-sm" />
              </div>

              <div className="min-w-0">
                <h3 className="font-bold text-[15px] leading-tight text-white tracking-tight truncate">
                  Chat — Equipe Sucena
                </h3>
                <p className="text-[12px] text-white/90 leading-tight mt-0.5 font-medium truncate">
                  {unreadConversationsCount > 0
                    ? `${unreadConversationsCount} conversa(s) não lida(s)`
                    : 'Nenhuma conversa pendente'}
                </p>
              </div>
            </div>

            {/* Botao circular Fechar (X) */}
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 flex items-center justify-center text-white transition-colors cursor-pointer shrink-0 ml-2"
              aria-label="Fechar chat"
            >
              <X size={18} strokeWidth={2.4} />
            </button>
          </div>

          {/* BARRA DE PESQUISA ESTILO PILULA */}
          <div className="px-4 pt-3 pb-2 shrink-0 bg-white">
            <div className="relative flex items-center bg-[#f0f2f5] rounded-full px-3.5 py-2 transition-colors focus-within:ring-2 focus-within:ring-[#0084ff]/30">
              <Search size={16} className="text-[#0084ff] mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Pesquisar no chat..."
                className="w-full bg-transparent text-[13.5px] text-gray-800 outline-none placeholder:text-gray-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Abas discretas: Conversas / Toda a Equipe */}
            <div className="flex gap-2 mt-2 border-b border-gray-100 pb-1.5 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('conversas')}
                className={`px-3 py-1 rounded-full transition-colors ${
                  activeTab === 'conversas'
                    ? 'bg-[#0084ff]/10 text-[#0084ff]'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Conversas ({conversations.length})
              </button>
              <button
                onClick={() => setActiveTab('equipe')}
                className={`px-3 py-1 rounded-full transition-colors ${
                  activeTab === 'equipe'
                    ? 'bg-[#0084ff]/10 text-[#0084ff]'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Equipe ({teamUsers.filter((u: any) => u.isOnline).length} online)
              </button>
            </div>
          </div>

          {/* LISTAGEM DE CONVERSAS */}
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 custom-scrollbar bg-white">
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-400">
                Carregando conversas...
              </div>
            ) : activeTab === 'conversas' ? (
              filteredConversations.length > 0 ? (
                filteredConversations.map(conv => {
                  const targetUser = conv.targetUserId && usersMap ? usersMap[conv.targetUserId] : null
                  const isOnline = Boolean(targetUser?.isOnline)
                  const lastSeenFormatted = targetUser ? formatLastSeen(targetUser.lastSeen || targetUser._presenceRaw?.last_heartbeat) : ''

                  return (
                    <div
                      key={conv.id}
                      onClick={() => handleOpenConversation(conv.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer group relative"
                    >
                      {/* Avatar colorido com iniciais ou foto */}
                      <div className="relative shrink-0">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base shadow-sm overflow-hidden"
                          style={{ backgroundColor: conv.avatarColor }}
                        >
                          {conv.avatarUrl ? (
                            <img
                              src={conv.avatarUrl}
                              alt={conv.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{conv.initials}</span>
                          )}
                        </div>
                        {isOnline && (
                          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#22c55e] border-2 border-white shadow-sm" />
                        )}
                      </div>

                      {/* Conteudo: Nome, Status em tempo real, Mensagem, Hora, Badge e Opcao Excluir */}
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0 pr-2">
                            <p className="font-semibold text-[14px] text-gray-900 truncate">
                              {conv.title}
                            </p>
                            {isOnline ? (
                              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Online
                              </span>
                            ) : lastSeenFormatted && lastSeenFormatted !== 'Offline' ? (
                              <span className="text-[10px] text-gray-400 font-normal shrink-0 truncate max-w-[120px]" title={lastSeenFormatted}>
                                • {lastSeenFormatted.replace('Visto ', '')}
                              </span>
                            ) : null}
                          </div>
                          <span className="text-[11.5px] text-gray-400 shrink-0">
                            {conv.lastMessageTime}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`text-[13px] truncate ${
                              conv.unreadCount > 0
                                ? 'text-gray-900 font-semibold'
                                : 'text-gray-500'
                            }`}
                          >
                            {conv.lastMessageText || 'Toque para conversar'}
                          </p>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Badge vermelha individual de nao lidas da conversa */}
                            {conv.unreadCount > 0 && (
                              <span className="w-5 h-5 rounded-full bg-[#fa3e3e] text-white text-[10.5px] font-bold flex items-center justify-center shrink-0 shadow-sm animate-in zoom-in-75">
                                {conv.unreadCount}
                              </span>
                            )}

                            {/* BOTAO PARA EXCLUIR CONVERSA */}
                            <button
                              onClick={(e) => handlePromptDelete(e, conv)}
                              className="p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                              title="Excluir conversa"
                              aria-label="Excluir conversa"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="p-8 text-center">
                  <p className="text-sm text-gray-500 mb-2">
                    {searchQuery
                      ? 'Nenhuma conversa encontrada na busca.'
                      : 'Nenhuma conversa recente iniciada.'}
                  </p>
                  <button
                    onClick={() => setActiveTab('equipe')}
                    className="text-xs text-[#0084ff] font-semibold hover:underline"
                  >
                    Ver colegas da equipe para conversar
                  </button>
                </div>
              )
            ) : (
              /* ABA DA EQUIPE / CONTATOS - MOSTRA ONLINE EM TEMPO REAL E ULTIMA VEZ VISTO */
              filteredTeamUsers.map((user: any) => {
                const initials = getInitials(user.name)
                const avatarColor = getAvatarColor(initials)
                const isOnline = Boolean(user.isOnline)
                const lastSeenFormatted = formatLastSeen(user.lastSeen || user._presenceRaw?.last_heartbeat)

                return (
                  <div
                    key={user.id}
                    onClick={() => handleStartDirectChat(user.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="relative shrink-0">
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm overflow-hidden"
                        style={{ backgroundColor: avatarColor }}
                      >
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{initials}</span>
                        )}
                      </div>
                      {isOnline && (
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#22c55e] border-2 border-white shadow-sm" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-[14px] text-gray-900 truncate">
                          {user.name}
                        </p>
                        {user.role && (
                          <span className="text-[11px] text-gray-400 truncate max-w-[120px] ml-2">
                            {user.role}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {isOnline ? (
                          <span className="text-[12px] text-emerald-600 font-semibold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Online agora
                          </span>
                        ) : (
                          <span className="text-[11.5px] text-gray-500 flex items-center gap-1">
                            <Clock size={12} className="text-gray-400 shrink-0" />
                            {lastSeenFormatted}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* BOTAO FLUTUANTE ESTILO MESSENGER (CANTO INFERIOR DIREITO) */}
      <div className="fixed bottom-6 right-6 z-[120]">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-[#0062ff] via-[#0084ff] to-[#00c6ff] border-2 border-black/80 shadow-[0_8px_25px_rgba(0,100,255,0.45)] flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none"
          aria-label="Chat — Equipe Sucena"
          title="Chat — Equipe Sucena"
        >
          {/* Logo do Messenger com o raio vazado */}
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-white drop-shadow-sm">
            <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.91 1.455 5.513 3.735 7.158V21.5a.75.75 0 0 0 1.157.632l2.67-1.602c.78.217 1.601.328 2.438.328 5.523 0 10-4.145 10-9.258C22 6.145 17.523 2 12 2zm1.09 12.385l-2.545-2.715-4.966 2.715 5.46-5.8 2.592 2.715 4.919-2.715-5.46 5.8z" />
          </svg>

          {/* Badge vermelha: SO APARECE SE HOUVER MENSAGENS RECEBIDAS DE OUTRAS PESSOAS */}
          {unreadCountGlobally > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#fa3e3e] border-2 border-white text-white text-[11px] font-extrabold flex items-center justify-center shadow-md animate-in zoom-in-75">
              {unreadCountGlobally > 99 ? '99+' : unreadCountGlobally}
            </span>
          )}
        </button>
      </div>
    </>
  )
}
