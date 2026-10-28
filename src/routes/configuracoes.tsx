import Camera from 'lucide-react/dist/esm/icons/camera.js';
import Loader2 from 'lucide-react/dist/esm/icons/loader-circle.js';
import Save from 'lucide-react/dist/esm/icons/save.js';
import AlertCircle from 'lucide-react/dist/esm/icons/circle-alert.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.js';
import Building2 from 'lucide-react/dist/esm/icons/building-2.js';
import Check from 'lucide-react/dist/esm/icons/check.js';
import Lock from 'lucide-react/dist/esm/icons/lock.js';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import { useState, useEffect, useRef } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import { supabase } from '../lib/supabase'
import { AvatarCropperModal } from '../components/profile/AvatarCropperModal'
import { getCroppedImg } from '../lib/cropImage'
import { Area } from 'react-easy-crop'
import { VerifiedBadge, isAdmin } from '../components/ui/VerifiedBadge'
import { 
  AVAILABLE_ENVIRONMENTS, 
  getUserEnvironmentAccess, 
  hasEnvironmentAccess, 
  UserEnvironmentAccessMap,
  EnvironmentInfo 
} from '../lib/environmentAccess'

export const Route = createFileRoute('/configuracoes')({
  component: ConfiguracoesRoute,
})

function ConfiguracoesRoute() {
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // User Data
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [originalEmail, setOriginalEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [password, setPassword] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [role, setRole] = useState('')
  
  // Environment Data
  const [activeEnv, setActiveEnv] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sucena_environment') || 'barcarena'
    }
    return 'barcarena'
  })
  const [accessMap, setAccessMap] = useState<UserEnvironmentAccessMap>({})
  const [loadingEnvAccess, setLoadingEnvAccess] = useState(true)

  // Image Cropping
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [isCropperOpen, setIsCropperOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getValidUser = async () => {
    try {
      // 1. Sessão ativa (executa refresh automático no cliente se o token estiver expirado)
      const { data: sessionData } = await supabase.auth.getSession()
      let user = sessionData?.session?.user

      // 2. Se não encontrou, tenta getUser()
      if (!user) {
        const userRes = await supabase.auth.getUser()
        user = userRes.data?.user
      }

      // 3. Força renovação de token se necessário
      if (!user) {
        const { data: refreshData } = await supabase.auth.refreshSession()
        user = refreshData?.user || refreshData?.session?.user
      }

      // 4. Fallback para o usuário já mantido em memória no componente
      if (!user && currentUser) {
        user = currentUser
      }

      return user || null
    } catch (e) {
      console.warn('Erro ao obter usuário válido:', e)
      return currentUser || null
    }
  }

  useEffect(() => {
    async function loadProfile() {
      try {
        const [user, envAccess] = await Promise.all([
          getValidUser(),
          getUserEnvironmentAccess().catch(() => ({} as UserEnvironmentAccessMap))
        ])

        if (user) {
          setCurrentUser(user)
          setName(user.user_metadata?.full_name || '')
          setEmail(user.email || '')
          setOriginalEmail(user.email || '')
          setWhatsapp(user.user_metadata?.whatsapp || '')
          setAvatarUrl(user.user_metadata?.avatar_url || '')
          setRole(user.user_metadata?.role || '')
        } else {
          // Se não há sessão válida, redireciona para login
          navigate({ to: '/' })
          return
        }

        if (envAccess) {
          setAccessMap(envAccess)
        }
      } catch (err) {
        console.error('Erro ao carregar perfil:', err)
      } finally {
        setLoading(false)
        setLoadingEnvAccess(false)
      }
    }
    loadProfile()
  }, [])

  const isEnvAccessible = (envId: string) => {
    if (!currentUser) return false
    return hasEnvironmentAccess(
      currentUser.id,
      envId,
      accessMap,
      name || currentUser.user_metadata?.full_name,
      role || currentUser.user_metadata?.role
    )
  }

  const handleSelectEnv = (env: EnvironmentInfo) => {
    if (env.id === activeEnv) return

    if (!isEnvAccessible(env.id)) {
      toast.error(`Acesso restrito ao ambiente ${env.name}.`, {
        description: 'Solicite a liberação a um administrador do sistema no painel de administração.'
      })
      return
    }

    try {
      localStorage.setItem('sucena_environment', env.id)
      setActiveEnv(env.id)
      toast.success(`Ambiente alterado para ${env.name}!`, {
        description: 'Os dados do sistema agora refletem a unidade selecionada.'
      })
      window.dispatchEvent(new CustomEvent('sucena_environment_change', { detail: env.id }))
    } catch (err) {
      console.error('Erro ao alternar ambiente:', err)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      const reader = new FileReader()
      reader.addEventListener('load', () => {
        setImageSrc(reader.result?.toString() || null)
        setIsCropperOpen(true)
      })
      reader.readAsDataURL(file)
    }
  }

  const handleCropComplete = async (croppedAreaPixels: Area) => {
    setIsCropperOpen(false)
    if (!imageSrc) return

    try {
      setSaving(true)
      setMessage({ type: 'success', text: 'Cortando e fazendo upload da imagem...' })
      
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels)
      if (!croppedImageBlob) throw new Error('Falha ao processar imagem')

      const user = await getValidUser()
      if (!user) throw new Error('Sua sessão expirou. Por favor, recarregue a página ou faça login novamente.')

      const fileExt = 'jpeg'
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      // Upload to supabase storage (avatars bucket)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedImageBlob, { 
          upsert: true,
          contentType: 'image/jpeg'
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      })

      if (updateError) throw updateError

      // Sincronizar também no social_profiles se existir
      try {
        await supabase
          .from('social_profiles')
          .update({ avatar_url: publicUrl })
          .eq('user_id', user.id)
      } catch (_) {}

      setAvatarUrl(publicUrl)
      setCurrentUser((prev: any) => ({
        ...prev,
        user_metadata: {
          ...(prev?.user_metadata || {}),
          avatar_url: publicUrl
        }
      }))
      setMessage({ type: 'success', text: 'Foto de perfil atualizada com sucesso!' })
    } catch (error: any) {
      console.error(error)
      setMessage({ type: 'error', text: 'Erro ao atualizar foto: ' + (error.message || 'Erro desconhecido') })
    } finally {
      setSaving(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    
    try {
      const user = await getValidUser()
      if (!user) throw new Error('Sua sessão expirou. Por favor, recarregue a página ou faça login novamente.')

      // Auto-format WhatsApp number (remove non-digits and ensure 55 prefix)
      let formattedWhatsapp = whatsapp.replace(/\D/g, '')
      if (formattedWhatsapp && !formattedWhatsapp.startsWith('55')) {
        formattedWhatsapp = '55' + formattedWhatsapp
      }
      
      // Update the input visually so the user sees the correction
      setWhatsapp(formattedWhatsapp)

      // Build update payload
      const updatePayload: any = {
        data: {
          full_name: name,
          whatsapp: formattedWhatsapp,
          avatar_url: avatarUrl
        }
      }

      // Only send email if it was actually changed to avoid Supabase errors
      if (email && email !== originalEmail) updatePayload.email = email
      if (password) updatePayload.password = password

      const { error } = await supabase.auth.updateUser(updatePayload)
      if (error) throw error

      // Sincronizar nome no social_profiles
      try {
        await supabase
          .from('social_profiles')
          .update({ display_name: name })
          .eq('user_id', user.id)
      } catch (_) {}

      setOriginalEmail(email) // update original email reference
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' })
      setPassword('') // Clear password field after success
    } catch (error: any) {
      console.error(error)
      setMessage({ type: 'error', text: 'Erro ao atualizar: ' + (error.message || 'Erro desconhecido') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="max-w-4xl mx-auto py-4 sm:py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <div className="mb-8">
          <h1 className="tracking-tight" style={{ fontSize: 'clamp(24px, 7vw, 54px)', lineHeight: '1' }}>Configurações de Perfil</h1>
          <p className="text-gray-600 dark:text-white/70 text-sm">Gerencie suas informações pessoais, e-mail, senha e ambiente de trabalho.</p>
        </div>

        {message && (
          <div className={`p-4 rounded-xl mb-6 flex items-start gap-3 border ${ message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400' }`}>
            {message.type === 'success' ? <CheckCircle2 size={20} className="shrink-0 mt-0.5" /> : <AlertCircle size={20} className="shrink-0 mt-0.5" />}
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Avatar & Ambiente Section */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 p-6 rounded-2xl flex flex-col items-center text-center">
              <div className="relative group mb-4">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-gray-100 dark:border-[#1a1a1c] bg-gray-100 dark:bg-[#1a1a1c]">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-yellow-500/10 text-yellow-500 text-3xl font-bold">
                      {name ? name.charAt(0).toUpperCase() : '?'}
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={saving}
                  className="absolute bottom-0 right-0 bg-yellow-500 text-black p-2.5 rounded-full shadow-lg hover:bg-yellow-400 hover:scale-105 transition-all disabled:opacity-50"
                  title="Alterar foto"
                >
                  <Camera size={18} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
              
              <h3 className="font-bold text-lg flex items-center justify-center gap-1">
                {name || 'Usuário'}
                {isAdmin(name, role) && <VerifiedBadge />}
              </h3>
              <p className="text-sm text-gray-500 dark:text-white/70 break-all">{email}</p>
            </div>

            {/* Card de Ambiente Operacional */}
            <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#1c1d21] dark:text-white">Ambiente Operacional</h3>
                    <p className="text-[11px] text-gray-500 dark:text-white/60">Unidade ativa no sistema</p>
                  </div>
                </div>
              </div>

              {/* Lista dos ambientes com feedback visual premium */}
              <div className="space-y-2">
                {AVAILABLE_ENVIRONMENTS.map(env => {
                  const isActive = activeEnv === env.id
                  const hasAccess = isEnvAccessible(env.id)

                  return (
                    <div
                      key={env.id}
                      onClick={() => handleSelectEnv(env)}
                      role="button"
                      tabIndex={0}
                      className={`group relative p-3.5 rounded-xl border transition-all text-left flex items-start justify-between gap-3 ${
                        isActive
                          ? 'border-yellow-500/60 bg-yellow-500/[0.08] dark:bg-yellow-500/[0.12] shadow-sm'
                          : hasAccess
                            ? 'border-gray-200 dark:border-white/10 hover:border-yellow-500/30 hover:bg-gray-50 dark:hover:bg-white/[0.02] cursor-pointer'
                            : 'border-gray-200/60 dark:border-white/5 opacity-60 bg-gray-50/50 dark:bg-black/20 cursor-not-allowed'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs tracking-tight text-[#1c1d21] dark:text-white">
                            {env.name}
                          </span>
                          {isActive && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-yellow-500 text-black">
                              <Check size={11} strokeWidth={3} />
                              Ativo
                            </span>
                          )}
                          {!hasAccess && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">
                              <Lock size={10} />
                              Bloqueado
                            </span>
                          )}
                        </div>
                        {env.contract && (
                          <p className="text-[11px] text-gray-500 dark:text-white/60 mt-0.5 font-medium">
                            {env.contract}
                          </p>
                        )}
                        <p className="text-[11px] text-gray-400 dark:text-white/50 mt-1 line-clamp-2">
                          {env.description}
                        </p>
                      </div>

                      {hasAccess && !isActive && (
                        <span className="text-[11px] font-semibold text-yellow-600 dark:text-yellow-400 shrink-0 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 mt-0.5">
                          Trocar
                          <ArrowRight size={12} />
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Botão rápido para o portal de seleção */}
              <button
                type="button"
                onClick={() => navigate({ to: '/ambientes' as any })}
                className="w-full text-center text-xs font-semibold text-gray-600 dark:text-white/70 hover:text-yellow-500 dark:hover:text-yellow-400 pt-2 border-t border-gray-100 dark:border-white/5 flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Ver portal completo de ambientes</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>

          {/* Form Section */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSaveProfile} className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-2xl p-6 md:p-8 space-y-8">
              
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-yellow-500" size={32} />
                </div>
              ) : (
                <>
                  {/* Dados Pessoais */}
                  <div className="space-y-4">
                    <h2 className="text-sm font-semibold text-yellow-500 uppercase tracking-wider mb-4">Dados Pessoais</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-700 dark:text-white/70 pl-1">Nome Completo</label>
                        <input
                          type="text"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-[#1c1d21] dark:text-white text-sm focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all"
                          placeholder="Seu nome"
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-700 dark:text-white/70 pl-1">WhatsApp <span className="text-yellow-500">*</span></label>
                        <input
                          type="tel"
                          value={whatsapp}
                          onChange={e => setWhatsapp(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-[#1c1d21] dark:text-white text-sm focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all"
                          placeholder="Ex: 5591999999999"
                        />
                        {!whatsapp && (
                          <p className="text-xs text-amber-500 pl-1 flex items-center gap-1">
                            ⚠️ Obrigatório para receber lembretes no WhatsApp. Formato: DDI+DDD+Número (ex: <strong>5591999998888</strong>)
                          </p>
                        )}
                        {whatsapp && (
                          <p className="text-xs text-green-500 pl-1">
                            ✅ WhatsApp cadastrado. Você receberá lembretes neste número.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <hr className="border-gray-200 dark:border-white/5" />

                  {/* Segurança e Acesso */}
                  <div className="space-y-4">
                    <h2 className="text-sm font-semibold text-yellow-500 uppercase tracking-wider mb-4">Acesso</h2>
                    
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-700 dark:text-white/70 pl-1">E-mail de Login</label>
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-[#1c1d21] dark:text-white text-sm focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all"
                          placeholder="seu@email.com"
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-700 dark:text-white/70 pl-1">Nova Senha</label>
                        <input
                          type="password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-[#1c1d21] dark:text-white text-sm focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all"
                          placeholder="Deixe em branco para não alterar"
                        />
                        <p className="text-[11px] text-gray-500 dark:text-white/70 pl-1">Apenas preencha se desejar trocar sua senha atual.</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex flex-col sm:flex-row sm:justify-end gap-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 px-8 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ minHeight: 44 }}
                    >
                      {saving ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save size={18} />
                          Salvar Alterações
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Cropper Modal */}
      {imageSrc && (
        <AvatarCropperModal
          isOpen={isCropperOpen}
          onClose={() => setIsCropperOpen(false)}
          imageSrc={imageSrc}
          onCropComplete={handleCropComplete}
        />
      )}
    </>
  )
}
