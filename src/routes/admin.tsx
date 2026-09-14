import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import { Shield, ShieldAlert, Edit2, Ban, Trash2, CheckCircle2, User as UserIcon, Search, AlertTriangle, ArrowLeft, Users, Lock, Unlock, Plus, X, MessageCircle, Save, Bell, Play, Megaphone } from 'lucide-react'
import { toast } from 'sonner'
import { isAdmin } from '../components/ui/VerifiedBadge'
import { useTheme } from '../contexts/ThemeContext'
import { getAvailableRoles, saveAvailableRoles } from '../lib/roles'
import { isRegistrationOpen, setRegistrationOpen, getWhatsappSettings, saveWhatsappSettings, WhatsappSettings } from '../lib/settings'
import { createServerFn } from '@tanstack/react-start'

// Proxy no servidor para evitar problemas de CORS com a W-API
export const testWhatsappOnServer = createServerFn({ method: 'POST' })
  .validator((data: { endpoint: string, token: string, number: string, text: string }) => data)
  .handler(async ({ data }) => {
    // Payload amplo para cobrir possíveis padrões da W-API
    const payload = {
      number: data.number,
      phone: data.number,
      text: data.text,
      message: data.text
    }

    // Tenta primeiro o endpoint exato que foi passado
    let response = await fetch(data.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`
      },
      body: JSON.stringify(payload)
    })

    // Se der 404 Cannot POST, pode ser que a API use 'messages' (plural) ou o usuário esqueceu o /v1
    if (response.status === 404) {
      const fallbackEndpoint = data.endpoint.includes('/message/') 
        ? data.endpoint.replace('/message/', '/messages/') 
        : data.endpoint.replace('/messages/', '/message/')
        
      response = await fetch(fallbackEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.token}`
        },
        body: JSON.stringify(payload)
      })
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => 'Erro desconhecido')
      throw new Error(`A API retornou um erro HTTP ${response.status}: ${errBody}`)
    }

    return await response.json()
  })

export const Route = createFileRoute('/admin')({
  component: AdminRoute,
})

type AdminUser = {
  id: string
  email: string
  name: string
  role: string
  avatar_url: string
  created_at: string
  last_sign_in_at: string
  banned_until: string | null
}

function AdminRoute() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'users' | 'whatsapp'>('users')

  // WhatsApp Settings
  const [whatsappSettings, setWhatsappSettings] = useState<WhatsappSettings>({
    url: '',
    instanceId: '',
    token: '',
    groupId: '',
    interval: 30
  })
  const [savingWhatsapp, setSavingWhatsapp] = useState(false)
  const [isWhatsappLocked, setIsWhatsappLocked] = useState(true)
  const [unlockCodeModal, setUnlockCodeModal] = useState(false)
  const [unlockCodeInput, setUnlockCodeInput] = useState('')

  // Test API Modal
  const [testApiModal, setTestApiModal] = useState(false)
  const [testNumber, setTestNumber] = useState('')
  const [isTestingApi, setIsTestingApi] = useState(false)

  // Edit Modal
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Roles Management
  const [availableRoles, setAvailableRoles] = useState<string[]>([])
  const [newRole, setNewRole] = useState('')
  const [savingRoles, setSavingRoles] = useState(false)

  // Registration Settings
  const [registrationOpen, setRegistrationOpenState] = useState(true)
  const [savingRegistration, setSavingRegistration] = useState(false)

  // Modals for Confirmation
  const [removeRoleModal, setRemoveRoleModal] = useState<string | null>(null)
  const [blockUserModal, setBlockUserModal] = useState<AdminUser | null>(null)
  const [deleteUserModal, setDeleteUserModal] = useState<AdminUser | null>(null)
  const [deleteEmailInput, setDeleteEmailInput] = useState('')

  useEffect(() => {
    checkAdminAndLoad()
  }, [])

  async function checkAdminAndLoad() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate({ to: '/' })
        return
      }

      const role = user.user_metadata?.role || ''
      const name = user.user_metadata?.full_name || ''
      
      if (!isAdmin(name, role)) {
        navigate({ to: '/' })
        return
      }

      loadUsers()
    } catch (err) {
      console.error(err)
      navigate({ to: '/' })
    }
  }

  async function loadUsers() {
    setLoading(true)
    setError('')
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_list_users')
      if (rpcError) throw rpcError
      
      setUsers(data || [])
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Erro ao carregar usuários. Verifique se você rodou o script SQL no Supabase.')
    } finally {
      setLoading(false)
    }

    try {
      const isOpen = await isRegistrationOpen()
      setRegistrationOpenState(isOpen)
    } catch (e) {
      console.error(e)
    }

    try {
      const roles = await getAvailableRoles()
      setAvailableRoles(roles)
    } catch (e) {
      console.error("Erro ao carregar cargos", e)
    }

    try {
      const waSettings = await getWhatsappSettings()
      setWhatsappSettings(waSettings)
      if (!waSettings.url && !waSettings.instanceId) {
        setIsWhatsappLocked(false)
      } else {
        setIsWhatsappLocked(true)
      }
    } catch (e) {
      console.error("Erro ao carregar configurações do whatsapp", e)
    }
  }

  const executeToggleBlock = async () => {
    if (!blockUserModal) return
    const isBlocked = !!blockUserModal.banned_until
    
    try {
      const { error: rpcError } = await supabase.rpc('admin_toggle_block_user', {
        target_user_id: blockUserModal.id,
        should_block: !isBlocked
      })
      if (rpcError) throw rpcError
      
      toast.success(isBlocked ? 'Usuário desbloqueado!' : 'Usuário bloqueado!')
      loadUsers()
    } catch (err: any) {
      toast.error('Erro ao alterar status: ' + err.message)
    } finally {
      setBlockUserModal(null)
    }
  }

  const executeDelete = async () => {
    if (!deleteUserModal) return
    if (deleteEmailInput !== deleteUserModal.email) {
      toast.error('Email incorreto. Exclusão cancelada.')
      return
    }

    try {
      const { error: rpcError } = await supabase.rpc('admin_delete_user', {
        target_user_id: deleteUserModal.id
      })
      if (rpcError) throw rpcError
      
      toast.success('Usuário excluído permanentemente.')
      loadUsers()
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + err.message)
    } finally {
      setDeleteUserModal(null)
      setDeleteEmailInput('')
    }
  }

  const handleSaveEdit = async () => {
    if (!editingUser) return
    setSavingEdit(true)
    try {
      // 1. Atualizar Nome e Cargo
      const { error: rpcError } = await supabase.rpc('admin_edit_user', {
        target_user_id: editingUser.id,
        new_name: editName,
        new_role: editRole
      })
      if (rpcError) throw rpcError
      
      // 2. Se informou nova senha, atualizar
      if (editPassword.trim()) {
        const { error: pwdError } = await supabase.rpc('admin_change_user_password', {
          target_user_id: editingUser.id,
          new_password: editPassword.trim()
        })
        if (pwdError) throw pwdError
      }
      
      toast.success('Usuário editado com sucesso.')
      setEditingUser(null)
      loadUsers()
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message)
    } finally {
      setSavingEdit(false)
    }
  }

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAddRole = async () => {
    const trimmed = newRole.trim()
    if (!trimmed) return
    if (availableRoles.includes(trimmed)) {
      toast.error("Este cargo já existe.")
      return
    }

    setSavingRoles(true)
    const newRoles = [...availableRoles, trimmed]
    const success = await saveAvailableRoles(newRoles)
    if (success) {
      setAvailableRoles(newRoles)
      setNewRole('')
      toast.success("Cargo adicionado.")
    } else {
      toast.error("Erro ao salvar o cargo.")
    }
    setSavingRoles(false)
  }

  const executeRemoveRole = async () => {
    if (!removeRoleModal) return
    
    setSavingRoles(true)
    const newRoles = availableRoles.filter(r => r !== removeRoleModal)
    const success = await saveAvailableRoles(newRoles)
    if (success) {
      setAvailableRoles(newRoles)
      toast.success("Cargo removido.")
    } else {
      toast.error("Erro ao remover o cargo.")
    }
    setSavingRoles(false)
    setRemoveRoleModal(null)
  }

  const handleToggleRegistration = async () => {
    setSavingRegistration(true)
    const newStatus = !registrationOpen
    const success = await setRegistrationOpen(newStatus)
    if (success) {
      setRegistrationOpenState(newStatus)
      toast.success(newStatus ? 'Formulário de cadastro liberado.' : 'Formulário de cadastro bloqueado.')
    } else {
      toast.error('Erro ao alterar status do cadastro.')
    }
    setSavingRegistration(false)
  }

  const handleSaveWhatsapp = async () => {
    setSavingWhatsapp(true)
    const success = await saveWhatsappSettings(whatsappSettings)
    if (success) {
      toast.success('Configurações do WhatsApp salvas com sucesso!')
      setIsWhatsappLocked(true)
    } else {
      toast.error('Erro ao salvar as configurações do WhatsApp.')
    }
    setSavingWhatsapp(false)
  }

  const handleUnlockWhatsapp = () => {
    if (unlockCodeInput === '966639') {
      setIsWhatsappLocked(false)
      setUnlockCodeModal(false)
      setUnlockCodeInput('')
      toast.success('Configurações liberadas para edição.')
    } else {
      toast.error('Código incorreto.')
    }
  }

  const handleTestDds = async (isToday: boolean) => {
    // Valida se o grupo está configurado (específico ou padrão)
    const targetGroup = whatsappSettings.ddsReminders?.specificGroupId || whatsappSettings.groupId
    if (!targetGroup) {
      toast.error('Você precisa configurar o ID do Grupo (específico ou padrão) antes de testar.')
      return
    }

    const toastId = toast.loading('Enviando lembrete de teste...')
    
    // Tenta montar a URL de forma segura.
    let baseUrl = whatsappSettings.url.trim()
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)
    
    if (baseUrl.includes('painel.w-api.app')) {
      baseUrl = 'https://api.w-api.app/v1'
    } else if (baseUrl.includes('api.w-api.app') && !baseUrl.includes('/v1')) {
      baseUrl = baseUrl + '/v1'
    }

    const endpoint = `${baseUrl}/messages/send-text?instanceId=${whatsappSettings.instanceId}`
    
    const message = isToday 
      ? `🟢 *Gestão Sucena - Lembrete Automático*\n\nBom dia! Passando para lembrar que *hoje é o seu dia* de ministrar o DDS.\nTema: *Teste de Lembrete Automático*`
      : `🟢 *Gestão Sucena - Aviso Prévio*\n\nBoa tarde! Passando para lembrar que *amanhã* é você quem irá ministrar o DDS.\nTema: *Teste de Aviso Prévio*`

    try {
      await testWhatsappOnServer({
        data: {
          endpoint,
          token: whatsappSettings.token,
          number: targetGroup, // Mandando para o grupo configurado
          text: message
        }
      })
      
      toast.success('Lembrete de teste enviado com sucesso ao grupo!', { id: toastId })
    } catch (err: any) {
      console.error("Erro da API no teste DDS:", err)
      toast.error(err.message || 'Erro de conexão no teste do DDS.', { id: toastId })
    }
  }

  // Handle general API test
  const handleTestApi = async () => {
    if (!testNumber.trim()) {
      toast.error('Digite um número de WhatsApp válido.')
      return
    }

    setIsTestingApi(true)
    
    // Tenta montar a URL de forma segura.
    let baseUrl = whatsappSettings.url.trim()
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)
    
    // Se o usuário colou a URL do painel (https://painel.w-api.app...), convertemos para a API real
    if (baseUrl.includes('painel.w-api.app')) {
      baseUrl = 'https://api.w-api.app/v1'
    } else if (baseUrl.includes('api.w-api.app') && !baseUrl.includes('/v1')) {
      // Se ele trocou manualmente para api.w-api mas esqueceu o /v1
      baseUrl = baseUrl + '/v1'
    }

    // Pela documentação da W-API:
    const endpoint = `${baseUrl}/messages/send-text?instanceId=${whatsappSettings.instanceId}`
    
    try {
      // Usa proxy pelo servidor para não dar erro de CORS no navegador
      const data = await testWhatsappOnServer({
        data: {
          endpoint,
          token: whatsappSettings.token,
          number: testNumber.replace(/\D/g, ''),
          text: "🟢 *Gestão Sucena* - Teste de integração do WhatsApp concluído com sucesso!"
        }
      })
      
      toast.success('Mensagem enviada com sucesso! Verifique o celular.')
      setTestApiModal(false)
      setTestNumber('')
    } catch (err: any) {
      console.error("Erro da API:", err)
      toast.error(err.message || 'Erro de conexão. Verifique a URL e se a API está rodando.')
    } finally {
      setIsTestingApi(false)
    }
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#090A0C] text-white' : 'bg-[#faf9f6] text-gray-900'} p-4 md:p-8 pb-32`}>
      
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 text-[#D6A72B] mb-2">
              <Shield size={32} />
              <h1 className="text-3xl md:text-4xl font-light italic" style={{ fontFamily: 'TarmilesAction, serif' }}>
                Administração
              </h1>
            </div>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Gerencie os usuários do sistema, permissões e acessos.
            </p>
          </div>
          
          <button 
            onClick={() => navigate({ to: '/dashboard' })}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-black/5 hover:bg-black/10 text-black'}`}
          >
            <ArrowLeft size={18} />
            Voltar
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-500">
            <AlertTriangle className="shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold">Erro ao carregar painel admin.</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Tabs Navigation */}
        <div className={`flex items-center gap-2 border-b ${isDark ? 'border-white/10' : 'border-black/10'} pb-4`}>
          <button 
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'users' 
                ? (isDark ? 'bg-white/10 text-white' : 'bg-black text-white') 
                : (isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-black hover:bg-black/5')
            }`}
          >
            <Users size={18} />
            Usuários e Acessos
          </button>
          
          <button 
            onClick={() => setActiveTab('whatsapp')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'whatsapp' 
                ? 'bg-[#25D366]/20 text-[#25D366]' 
                : (isDark ? 'text-gray-400 hover:text-[#25D366] hover:bg-[#25D366]/10' : 'text-gray-600 hover:text-[#25D366] hover:bg-[#25D366]/10')
            }`}
          >
            <MessageCircle size={18} />
            WhatsApp API
          </button>
        </div>

        {activeTab === 'users' && (
          <div className={`rounded-2xl p-1 shadow-sm border ${isDark ? 'bg-[#15161A] border-white/5' : 'bg-white border-black/5'}`}>
          
          <div className="p-4 border-b border-gray-200 dark:border-white/5 flex flex-col md:flex-row gap-4 justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <UserIcon className="text-[#D6A72B]" size={20} />
              Usuários Cadastrados ({users.length})
            </h2>
            
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isDark ? 'bg-[#0a0a0c] border-white/10 focus-within:border-[#D6A72B]' : 'bg-gray-50 border-gray-200 focus-within:border-[#D6A72B]'}`}>
              <Search size={16} className="text-gray-400" />
              <input 
                type="text" 
                placeholder="Buscar usuário..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-transparent outline-none text-sm w-full md:w-64"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className={`text-xs uppercase bg-black/5 dark:bg-white/5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <tr>
                  <th className="px-6 py-4 font-medium">Usuário</th>
                  <th className="px-6 py-4 font-medium">Contato</th>
                  <th className="px-6 py-4 font-medium">Cargo / Role</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      Carregando usuários...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => (
                    <tr key={user.id} className={`${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'} transition-colors`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon size={20} className="text-gray-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium flex items-center gap-1">
                              {user.name}
                            </div>
                            <div className="text-xs text-gray-500 truncate w-32 md:w-auto" title={user.id}>
                              ID: {user.id.substring(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-600 dark:text-gray-300">{user.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${user.role?.toLowerCase().includes('admin') || user.role?.toLowerCase().includes('diretor') ? 'bg-yellow-500/20 text-[#D6A72B]' : 'bg-blue-500/10 text-blue-500 dark:text-blue-400'}`}>
                          {user.role || 'Usuário'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {user.banned_until ? (
                          <div className="flex items-center gap-1.5 text-red-500 font-medium">
                            <Ban size={14} /> Bloqueado
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-green-500 font-medium">
                            <CheckCircle2 size={14} /> Ativo
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => {
                              setEditingUser(user)
                              setEditName(user.name)
                              setEditRole(user.role)
                              setEditPassword('')
                            }}
                            className="p-2 rounded-lg text-blue-500 hover:bg-blue-500/10 transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                          
                          <button 
                            onClick={() => setBlockUserModal(user)}
                            className={`p-2 rounded-lg transition-colors ${user.banned_until ? 'text-green-500 hover:bg-green-500/10' : 'text-orange-500 hover:bg-orange-500/10'}`}
                            title={user.banned_until ? "Desbloquear" : "Bloquear"}
                          >
                            {user.banned_until ? <ShieldAlert size={18} /> : <Ban size={18} />}
                          </button>
                          
                          <button 
                            onClick={() => {
                              setDeleteUserModal(user)
                              setDeleteEmailInput('')
                            }}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}

      </div>

      {activeTab === 'users' && (
        <div className="max-w-6xl mx-auto mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Registration Toggle */}
        <div className={`rounded-2xl p-6 shadow-sm border flex flex-col justify-between ${isDark ? 'bg-[#15161A] border-white/5' : 'bg-white border-black/5'}`}>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              {registrationOpen ? (
                <Unlock className="text-green-500" size={20} />
              ) : (
                <Lock className="text-red-500" size={20} />
              )}
              Status do Cadastro
            </h2>
            <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Determine se a opção de <strong>Criar Nova Conta</strong> deve aparecer na tela de login inicial. Ideal para bloquear cadastros quando não forem necessários.
            </p>
          </div>
          
          <button 
            onClick={handleToggleRegistration}
            disabled={savingRegistration}
            className={`w-full py-3 px-4 font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2
              ${registrationOpen 
                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' 
                : 'bg-green-500 text-white hover:bg-green-600'
              }
            `}
          >
            {registrationOpen ? 'Desativar Cadastros' : 'Ativar Cadastros'}
          </button>
        </div>

        {/* Roles Manager */}
        <div className={`rounded-2xl p-6 shadow-sm border ${isDark ? 'bg-[#15161A] border-white/5' : 'bg-white border-black/5'}`}>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Shield className="text-[#D6A72B]" size={20} />
            Gerenciar Cargos Disponíveis
          </h2>
          <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Esses cargos aparecerão como opções na tela de cadastro e na edição de perfil.
          </p>

          <div className="flex flex-wrap gap-2 mb-6">
            {availableRoles.map(role => (
              <div key={role} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${isDark ? 'bg-white/5 border-white/10 text-gray-200' : 'bg-black/5 border-black/10 text-gray-700'}`}>
                {role}
                <button 
                  onClick={() => setRemoveRoleModal(role)}
                  disabled={savingRoles}
                  className="p-0.5 rounded-full hover:bg-red-500/20 hover:text-red-500 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <input 
              type="text" 
              value={newRole}
              onChange={e => setNewRole(e.target.value)}
              placeholder="Digite um novo cargo..."
              className={`px-4 py-2 rounded-xl text-sm border outline-none transition-colors w-64 ${isDark ? 'bg-[#0a0a0c] border-white/10 focus:border-[#D6A72B]' : 'bg-gray-50 border-gray-200 focus:border-[#D6A72B]'}`}
              onKeyDown={e => e.key === 'Enter' && handleAddRole()}
            />
            <button 
              onClick={handleAddRole}
              disabled={savingRoles || !newRole.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-[#D6A72B] hover:bg-[#E2BB57] text-black font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              <Plus size={16} />
              Adicionar
            </button>
          </div>
        </div>
      </div>
      )}

      {activeTab === 'whatsapp' && (
        /* WhatsApp API Tab */
        <div className={`max-w-6xl mx-auto mt-8 rounded-2xl p-6 shadow-sm border ${isDark ? 'bg-[#15161A] border-white/5' : 'bg-white border-black/5'}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-[#25D366]/20 flex items-center justify-center text-[#25D366]">
              <MessageCircle size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">WhatsApp API (W-API)</h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Configure a instância e envie mensagens automáticas</p>
            </div>
          </div>

          <div className="mt-8 space-y-6">
            <h3 className="text-lg font-bold">Configuração da Instância</h3>
            <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Informe a URL base da instância W-API, o ID da instância e o Token de autenticação.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">URL da Instância</label>
                <input 
                  type="text" 
                  value={whatsappSettings.url}
                  onChange={e => setWhatsappSettings({...whatsappSettings, url: e.target.value})}
                  disabled={isWhatsappLocked}
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-colors ${isDark ? 'bg-[#0a0a0c] border-white/10 focus:border-[#25D366]' : 'bg-gray-50 border-gray-200 focus:border-[#25D366]'} ${isWhatsappLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                  placeholder="Ex: https://painel.w-api.app/app/instances"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-2">Instance ID</label>
                <input 
                  type="text" 
                  value={whatsappSettings.instanceId}
                  onChange={e => setWhatsappSettings({...whatsappSettings, instanceId: e.target.value})}
                  disabled={isWhatsappLocked}
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-colors ${isDark ? 'bg-[#0a0a0c] border-white/10 focus:border-[#25D366]' : 'bg-gray-50 border-gray-200 focus:border-[#25D366]'} ${isWhatsappLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                  placeholder="Ex: LITE-GU764..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Token</label>
              <input 
                type="password" 
                value={whatsappSettings.token}
                onChange={e => setWhatsappSettings({...whatsappSettings, token: e.target.value})}
                disabled={isWhatsappLocked}
                className={`w-full px-4 py-3 rounded-xl border outline-none transition-colors ${isDark ? 'bg-[#0a0a0c] border-white/10 focus:border-[#25D366]' : 'bg-gray-50 border-gray-200 focus:border-[#25D366]'} ${isWhatsappLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                placeholder="••••••••••••••••••••••"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">ID do Grupo (opcional)</label>
              <input 
                type="text" 
                value={whatsappSettings.groupId}
                onChange={e => setWhatsappSettings({...whatsappSettings, groupId: e.target.value})}
                disabled={isWhatsappLocked}
                className={`w-full px-4 py-3 rounded-xl border outline-none transition-colors ${isDark ? 'bg-[#0a0a0c] border-white/10 focus:border-[#25D366]' : 'bg-gray-50 border-gray-200 focus:border-[#25D366]'} ${isWhatsappLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                placeholder="Ex: 120363374999567363@g.us"
              />
              <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Informe o ID do grupo do WhatsApp (formato: ...@g.us). Será usado quando a opção "Enviar para grupo" estiver ativa.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Intervalo entre envios (segundos)</label>
              <input 
                type="number" 
                value={whatsappSettings.interval}
                onChange={e => setWhatsappSettings({...whatsappSettings, interval: parseInt(e.target.value) || 30})}
                min="5"
                disabled={isWhatsappLocked}
                className={`w-full max-w-[200px] px-4 py-3 rounded-xl border outline-none transition-colors ${isDark ? 'bg-[#0a0a0c] border-white/10 focus:border-[#25D366]' : 'bg-gray-50 border-gray-200 focus:border-[#25D366]'} ${isWhatsappLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
              <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'} leading-relaxed`}>
                Aguarda esse tempo entre cada mensagem para evitar bloqueio/banimento do número no WhatsApp. Recomendado: 5–15s.<br/>
                <span className="text-[#25D366]">✧ Todas as mensagens automáticas entram em uma fila global e respeitam este intervalo — mesmo quando disparadas no mesmo horário.</span>
              </p>
            </div>

            {/* Nova Seção: Lembrete Automático do DDS */}
            <div className="mt-12 pt-8 border-t border-white/10">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
                <Bell size={22} className={isDark ? "text-gray-100" : "text-gray-800"} />
                Lembrete Automático do DDS
              </h2>
              <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Envia mensagens automáticas no WhatsApp do palestrante agendado, com base no horário do Pará.
              </p>

              <div className="space-y-4">
                {/* Lembrete 06h */}
                <div className={`flex items-center justify-between p-4 rounded-xl border ${isDark ? 'border-white/10 bg-black/20' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => !isWhatsappLocked && setWhatsappSettings(prev => ({ ...prev, ddsReminders: { ...prev.ddsReminders!, enabled_0600: !prev.ddsReminders?.enabled_0600 } }))}
                      disabled={isWhatsappLocked}
                      className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${whatsappSettings.ddsReminders?.enabled_0600 ? 'bg-[#D6A72B]' : isDark ? 'bg-white/20' : 'bg-gray-300'} ${isWhatsappLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${whatsappSettings.ddsReminders?.enabled_0600 ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                    <div>
                      <span className="font-semibold text-sm block">Lembrete às 06:00h do dia do DDS (hoje é o seu dia)</span>
                      <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>↳ Envia somente no grupo do DDS</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${whatsappSettings.ddsReminders?.enabled_0600 ? (isDark ? 'bg-white/10 text-white' : 'bg-black/5 text-black') : (isDark ? 'bg-white/5 text-gray-500' : 'bg-black/5 text-gray-400')}`}>
                      {whatsappSettings.ddsReminders?.enabled_0600 ? 'Ativo' : 'Inativo'}
                    </span>
                    <button 
                      onClick={() => handleTestDds(true)}
                      disabled={!isWhatsappLocked && !whatsappSettings.url}
                      className={`flex items-center gap-2 px-4 py-2 border rounded-full text-sm font-medium transition-colors ${isDark ? 'border-white/20 hover:bg-white/5 text-white' : 'border-gray-300 hover:bg-black/5 text-black'} ${(!isWhatsappLocked && !whatsappSettings.url) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Play size={14} /> Testar
                    </button>
                  </div>
                </div>

                {/* Aviso 16h */}
                <div className={`flex items-center justify-between p-4 rounded-xl border ${isDark ? 'border-white/10 bg-black/20' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => !isWhatsappLocked && setWhatsappSettings(prev => ({ ...prev, ddsReminders: { ...prev.ddsReminders!, enabled_1600: !prev.ddsReminders?.enabled_1600 } }))}
                      disabled={isWhatsappLocked}
                      className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${whatsappSettings.ddsReminders?.enabled_1600 ? 'bg-[#D6A72B]' : isDark ? 'bg-white/20' : 'bg-gray-300'} ${isWhatsappLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${whatsappSettings.ddsReminders?.enabled_1600 ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                    <div>
                      <span className="font-semibold text-sm block">Aviso 1 dia antes às 16:00h (você palestra amanhã)</span>
                      <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>↳ Envia somente no WhatsApp privado do palestrante</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${whatsappSettings.ddsReminders?.enabled_1600 ? (isDark ? 'bg-white/10 text-white' : 'bg-black/5 text-black') : (isDark ? 'bg-white/5 text-gray-500' : 'bg-black/5 text-gray-400')}`}>
                      {whatsappSettings.ddsReminders?.enabled_1600 ? 'Ativo' : 'Inativo'}
                    </span>
                    <button 
                      onClick={() => handleTestDds(false)}
                      disabled={!isWhatsappLocked && !whatsappSettings.url}
                      className={`flex items-center gap-2 px-4 py-2 border rounded-full text-sm font-medium transition-colors ${isDark ? 'border-white/20 hover:bg-white/5 text-white' : 'border-gray-300 hover:bg-black/5 text-black'} ${(!isWhatsappLocked && !whatsappSettings.url) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Play size={14} /> Testar
                    </button>
                  </div>
                </div>

                {/* ID do grupo específico */}
                <div className={`p-6 rounded-xl border mt-6 ${isDark ? 'border-white/10 bg-black/20' : 'border-gray-200 bg-gray-50'}`}>
                  <h4 className="flex items-center gap-2 font-bold mb-3 text-sm">
                    <Megaphone size={16} className="text-[#D6A72B]" />
                    ID do grupo para mensagens do DDS
                  </h4>
                  <p className={`text-sm mb-4 leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Este grupo receberá <strong>todas as mensagens automáticas relacionadas ao DDS</strong>: lembretes do palestrante, aviso 1 dia antes e a <strong>foto da Lista de Presença</strong> postada no dia. Se deixar em branco, será usado o grupo padrão configurado acima.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold mb-2">ID do grupo específico para este alerta (opcional)</label>
                    <input 
                      type="text"
                      value={whatsappSettings.ddsReminders?.specificGroupId || ''}
                      onChange={e => setWhatsappSettings(prev => ({ ...prev, ddsReminders: { ...prev.ddsReminders!, specificGroupId: e.target.value } }))}
                      disabled={isWhatsappLocked}
                      className={`w-full px-4 py-3 rounded-lg border outline-none transition-colors text-sm ${isDark ? 'bg-[#0a0a0c] border-white/10 focus:border-[#D6A72B]' : 'bg-white border-gray-300 focus:border-[#D6A72B]'} ${isWhatsappLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                      placeholder="Ex: 120363408136247156@g.us"
                    />
                    <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      Quando preenchido, este alerta será enviado para este grupo específico em vez do grupo padrão configurado acima.
                    </p>
                  </div>
                </div>
                
                <p className={`text-xs mt-4 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  Requisitos: integração W-API habilitada, palestrante com usuário interno cadastrado e número de WhatsApp preenchido no perfil. Lembre-se de salvar a configuração após alterar estes botões.
                </p>
              </div>
            </div>

            <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row gap-3">
              {isWhatsappLocked ? (
                <button 
                  onClick={() => setUnlockCodeModal(true)}
                  className="flex items-center justify-center gap-2 w-full md:w-auto px-8 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors"
                >
                  <Unlock size={18} />
                  Editar Configurações
                </button>
              ) : (
                <button 
                  onClick={handleSaveWhatsapp}
                  disabled={savingWhatsapp}
                  className="flex items-center justify-center gap-2 w-full md:w-auto px-8 py-3 bg-[#25D366] hover:bg-[#1DA851] text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  <Save size={18} />
                  {savingWhatsapp ? 'Salvando...' : 'Salvar Configurações'}
                </button>
              )}
              
              <button 
                onClick={() => setTestApiModal(true)}
                className={`flex items-center justify-center gap-2 w-full md:w-auto px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-colors ${!isWhatsappLocked && !whatsappSettings.url ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!isWhatsappLocked && !whatsappSettings.url}
              >
                <MessageCircle size={18} />
                Testar W-API
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlock WhatsApp Modal */}
      {unlockCodeModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-6 ${isDark ? 'bg-[#15161A] border border-white/10' : 'bg-white'}`}>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                <Lock className="text-blue-500" size={32} />
              </div>
              <h2 className="text-xl font-bold mb-2">Desbloquear Edição</h2>
              <p className={`mb-6 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Digite o código de autorização do administrador para editar as chaves da API.
              </p>
              
              <input
                type="password"
                placeholder="Código de 6 dígitos..."
                maxLength={6}
                value={unlockCodeInput}
                onChange={e => setUnlockCodeInput(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border outline-none text-center tracking-[0.5em] text-lg mb-6 transition-colors ${isDark ? 'bg-[#0a0a0c] border-white/10 focus:border-blue-500' : 'bg-gray-50 border-gray-200 focus:border-blue-500'}`}
                onKeyDown={e => e.key === 'Enter' && handleUnlockWhatsapp()}
              />

              <div className="flex gap-3 justify-center w-full">
                <button 
                  onClick={() => {
                    setUnlockCodeModal(false)
                    setUnlockCodeInput('')
                  }}
                  className="px-4 py-2 font-medium rounded-lg flex-1 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleUnlockWhatsapp}
                  disabled={unlockCodeInput.length !== 6}
                  className="px-6 py-2 font-bold text-white bg-blue-500 hover:bg-blue-600 flex-1 rounded-lg transition-colors disabled:opacity-50"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${isDark ? 'bg-[#15161A] border border-white/10' : 'bg-white'}`}>
            <div className={`px-6 py-4 border-b ${isDark ? 'border-white/10' : 'border-gray-100'} flex items-center gap-3`}>
              <Edit2 className="text-[#D6A72B]" size={24} />
              <h2 className="text-xl font-semibold">Editar Usuário</h2>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nome Completo</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-colors ${isDark ? 'bg-[#0a0a0c] border-white/10 focus:border-[#D6A72B]' : 'bg-gray-50 border-gray-200 focus:border-[#D6A72B]'}`}
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cargo / Permissão</label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-colors appearance-none ${isDark ? 'bg-[#0a0a0c] border-white/10 focus:border-[#D6A72B]' : 'bg-gray-50 border-gray-200 focus:border-[#D6A72B]'}`}
                >
                  <option value="" disabled hidden>Selecione um Cargo</option>
                  
                  <optgroup label="Acesso Administrativo">
                    <option value="Administrador">Administrador</option>
                    <option value="Diretor">Diretor</option>
                  </optgroup>
                  
                  <optgroup label="Cargos Comuns (Membro)">
                    {availableRoles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </optgroup>
                </select>
                <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Selecione "Administrador" ou "Diretor" para promover o usuário e conceder acesso total ao sistema.
                </p>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Redefinir Senha (Opcional)</label>
                <input 
                  type="text" 
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-colors ${isDark ? 'bg-[#0a0a0c] border-white/10 focus:border-[#D6A72B]' : 'bg-gray-50 border-gray-200 focus:border-[#D6A72B]'}`}
                  placeholder="Deixe em branco para não alterar"
                />
                <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Mínimo de 6 caracteres. A senha original do usuário não pode ser exibida por motivos de segurança.
                </p>
              </div>
            </div>

            <div className={`px-6 py-4 border-t flex justify-end gap-3 ${isDark ? 'bg-black/20 border-white/10' : 'bg-gray-50 border-gray-100'}`}>
              <button 
                onClick={() => setEditingUser(null)}
                disabled={savingEdit}
                className="px-4 py-2 font-medium rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-6 py-2 font-bold text-black bg-[#D6A72B] hover:bg-[#E2BB57] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals de Confirmação */}
      {removeRoleModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 text-center ${isDark ? 'bg-[#15161A] border border-white/10' : 'bg-white'}`}>
            <AlertTriangle className="text-orange-500 mx-auto mb-4" size={40} />
            <h2 className="text-xl font-bold mb-2">Remover Cargo</h2>
            <p className={`mb-6 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              Deseja realmente remover o cargo <strong>"{removeRoleModal}"</strong> das opções?
            </p>
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => setRemoveRoleModal(null)}
                className="px-4 py-2 font-medium rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={executeRemoveRole}
                disabled={savingRoles}
                className="px-6 py-2 font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {blockUserModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 text-center ${isDark ? 'bg-[#15161A] border border-white/10' : 'bg-white'}`}>
            {blockUserModal.banned_until ? (
              <CheckCircle2 className="text-green-500 mx-auto mb-4" size={40} />
            ) : (
              <Ban className="text-orange-500 mx-auto mb-4" size={40} />
            )}
            <h2 className="text-xl font-bold mb-2">
              {blockUserModal.banned_until ? 'Desbloquear Usuário' : 'Bloquear Usuário'}
            </h2>
            <p className={`mb-6 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              Tem certeza que deseja {blockUserModal.banned_until ? 'desbloquear' : 'bloquear'} o usuário <strong>{blockUserModal.name}</strong>?
            </p>
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => setBlockUserModal(null)}
                className="px-4 py-2 font-medium rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={executeToggleBlock}
                className={`px-6 py-2 font-bold text-white rounded-lg transition-colors ${blockUserModal.banned_until ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600'}`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteUserModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 ${isDark ? 'bg-[#15161A] border border-white/10' : 'bg-white'}`}>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <Trash2 className="text-red-500" size={32} />
              </div>
              <h2 className="text-xl font-bold mb-2 text-red-500">Atenção: Ação Irreversível</h2>
              <p className={`mb-4 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                Todas as referências a este usuário podem ser afetadas.<br/><br/>
                Para excluir permanentemente o usuário <strong>{deleteUserModal.name}</strong>, digite o email dele abaixo:
              </p>
              
              <div className="font-mono text-sm bg-black/5 dark:bg-white/5 px-3 py-1.5 rounded mb-4 select-all">
                {deleteUserModal.email}
              </div>

              <input
                type="text"
                placeholder="Digite o email exato..."
                value={deleteEmailInput}
                onChange={e => setDeleteEmailInput(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border outline-none text-center mb-6 transition-colors ${isDark ? 'bg-[#0a0a0c] border-white/10 focus:border-red-500' : 'bg-gray-50 border-gray-200 focus:border-red-500'}`}
              />

              <div className="flex gap-3 justify-center w-full">
                <button 
                  onClick={() => {
                    setDeleteUserModal(null)
                    setDeleteEmailInput('')
                  }}
                  className="px-4 py-2 font-medium rounded-lg flex-1 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={executeDelete}
                  disabled={deleteEmailInput !== deleteUserModal.email}
                  className="px-6 py-2 font-bold text-white bg-red-500 hover:bg-red-600 flex-1 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test API Modal */}
      {testApiModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-6 ${isDark ? 'bg-[#15161A] border border-white/10' : 'bg-white'}`}>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-[#25D366]/10 flex items-center justify-center mb-4">
                <MessageCircle className="text-[#25D366]" size={32} />
              </div>
              <h2 className="text-xl font-bold mb-2">Testar Conexão WhatsApp</h2>
              <p className={`mb-6 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Digite um número de WhatsApp (com DDI e DDD) para receber uma mensagem de teste.
              </p>
              
              <input
                type="text"
                placeholder="Ex: 5511999999999"
                value={testNumber}
                onChange={e => setTestNumber(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border outline-none text-center text-lg mb-6 transition-colors ${isDark ? 'bg-[#0a0a0c] border-white/10 focus:border-[#25D366]' : 'bg-gray-50 border-gray-200 focus:border-[#25D366]'}`}
                onKeyDown={e => e.key === 'Enter' && handleTestApi()}
              />

              <div className="flex gap-3 justify-center w-full">
                <button 
                  onClick={() => {
                    setTestApiModal(false)
                    setTestNumber('')
                  }}
                  className="px-4 py-2 font-medium rounded-lg flex-1 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleTestApi}
                  disabled={!testNumber.trim() || isTestingApi}
                  className="px-6 py-2 font-bold text-white bg-[#25D366] hover:bg-[#1DA851] flex-1 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isTestingApi ? 'Enviando...' : 'Enviar Teste'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
