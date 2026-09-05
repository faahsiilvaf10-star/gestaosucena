import { useState, useEffect, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { supabase } from '../lib/supabase'
import { AvatarCropperModal } from '../components/profile/AvatarCropperModal'
import { getCroppedImg } from '../lib/cropImage'
import { Area } from 'react-easy-crop/types'
import { Camera, Loader2, Save, AlertCircle, CheckCircle2 } from 'lucide-react'

export const Route = createFileRoute('/configuracoes')({
  component: ConfiguracoesRoute,
})

function ConfiguracoesRoute() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // User Data
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [password, setPassword] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  
  // Image Cropping
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [isCropperOpen, setIsCropperOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setName(user.user_metadata?.full_name || '')
        setEmail(user.email || '')
        setWhatsapp(user.user_metadata?.whatsapp || '')
        setAvatarUrl(user.user_metadata?.avatar_url || '')
      }
      setLoading(false)
    }
    loadProfile()
  }, [])

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

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')

      const fileExt = 'jpeg'
      const fileName = `${user.id}-${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      // Upload to supabase storage (avatars bucket)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedImageBlob, { upsert: true })

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

      setAvatarUrl(publicUrl)
      setMessage({ type: 'success', text: 'Foto de perfil atualizada com sucesso!' })
    } catch (error: any) {
      console.error(error)
      setMessage({ type: 'error', text: 'Erro ao atualizar foto: ' + error.message })
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
      // Build update payload
      const updatePayload: any = {
        data: {
          full_name: name,
          whatsapp: whatsapp,
          avatar_url: avatarUrl
        }
      }

      if (email) updatePayload.email = email
      if (password) updatePayload.password = password

      const { error } = await supabase.auth.updateUser(updatePayload)
      if (error) throw error

      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' })
      setPassword('') // Clear password field after success
    } catch (error: any) {
      console.error(error)
      setMessage({ type: 'error', text: 'Erro ao atualizar: ' + error.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Configurações de Perfil</h1>
          <p className="text-white/60 text-sm">Gerencie suas informações pessoais, e-mail e senha de acesso.</p>
        </div>

        {message && (
          <div className={`p-4 rounded-xl mb-6 flex items-start gap-3 border ${
            message.type === 'success' 
              ? 'bg-green-500/10 border-green-500/20 text-green-400' 
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {message.type === 'success' ? <CheckCircle2 size={20} className="shrink-0 mt-0.5" /> : <AlertCircle size={20} className="shrink-0 mt-0.5" />}
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Avatar Section */}
          <div className="lg:col-span-1">
            <div className="bg-[#121214] border border-white/5 p-6 rounded-2xl flex flex-col items-center text-center">
              <div className="relative group mb-4">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-[#1a1a1c] bg-[#1a1a1c]">
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
              
              <h3 className="font-bold text-lg">{name || 'Usuário'}</h3>
              <p className="text-sm text-white/50 break-all">{email}</p>
            </div>
          </div>

          {/* Form Section */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSaveProfile} className="bg-[#121214] border border-white/5 rounded-2xl p-6 md:p-8 space-y-8">
              
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
                        <label className="text-xs font-medium text-white/60 pl-1">Nome Completo</label>
                        <input
                          type="text"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all"
                          placeholder="Seu nome"
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-white/60 pl-1">WhatsApp</label>
                        <input
                          type="tel"
                          value={whatsapp}
                          onChange={e => setWhatsapp(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all"
                          placeholder="(11) 99999-9999"
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-white/5" />

                  {/* Segurança e Acesso */}
                  <div className="space-y-4">
                    <h2 className="text-sm font-semibold text-yellow-500 uppercase tracking-wider mb-4">Acesso</h2>
                    
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-white/60 pl-1">E-mail de Login</label>
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all"
                          placeholder="seu@email.com"
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-white/60 pl-1">Nova Senha</label>
                        <input
                          type="password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all"
                          placeholder="Deixe em branco para não alterar"
                        />
                        <p className="text-[11px] text-white/40 pl-1">Apenas preencha se desejar trocar sua senha atual.</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 px-8 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
    </AppLayout>
  )
}
