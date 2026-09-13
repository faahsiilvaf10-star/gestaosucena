import React, { useState, useEffect } from 'react'
import { X, Image as ImageIcon, UploadCloud } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMonthlyColors } from '../hooks/useMonthlyColors'
import { useTheme } from '../contexts/ThemeContext'

const COLOR_NAMES: Record<string, string> = {
  red: 'Vermelha',
  blue: 'Azul',
  yellow: 'Amarela',
  green: 'Verde'
}

interface DdsUploadModalProps {
  isOpen: boolean
  onClose: () => void
  tema: string
  palestrante: string
  onSuccess?: () => void
}

export function DdsUploadModal({ isOpen, onClose, tema, palestrante, onSuccess }: DdsUploadModalProps) {
  const { isDark } = useTheme()
  const { colors } = useMonthlyColors()
  
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [editableTema, setEditableTema] = useState(tema || '')
  const [editablePalestrante, setEditablePalestrante] = useState(palestrante || '')
  const [palestranteType, setPalestranteType] = useState<'interno' | 'externo'>('interno')
  const [users, setUsers] = useState<any[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    supabase.rpc('get_system_users').then(({ data }) => {
      setUsers(data || [])
    })
  }, [])

  if (!isOpen) return null

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0]
      setFile(selected)
      setPreview(URL.createObjectURL(selected))
    }
  }

  const handleSubmit = async () => {
    if (!file) {
      alert('Selecione uma foto do DDS.')
      return
    }
    
    setIsSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado.')

      // Determinar cor proibida atual
      const currentMonthIndex = new Date().getMonth()
      const activeColor = colors[currentMonthIndex] || 'red'
      const colorName = COLOR_NAMES[activeColor] || 'Vermelha'
      
      const today = new Date().toLocaleDateString('pt-BR')

      // Estruturar legenda
      const caption = `🎤 **DDS Realizado!**\n**Tema:** ${editableTema || 'Sem tema agendado'}\n**Palestrante:** ${editablePalestrante || 'Livre'}\n**Data:** ${today}\n**Cor Proibida do Mês:** ${colorName}\n\n${notes}`

      const envName = (typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') : null) === 'paragominas' ? 'PARAGOMINAS' : 'BARCARENA'

      // 1. Criar post no banco
      const { data: post, error: postError } = await supabase
        .from('social_posts')
        .insert({
          user_id: user.id,
          caption: caption,
          post_type: 'post',
          location: envName
        })
        .select()
        .single()

      if (postError) throw postError

      // 2. Fazer upload da imagem
      const fileExt = file.name.split('.').pop()
      const fileName = `${post.id}-${Math.random()}.${fileExt}`
      const filePath = `posts/${fileName}`
      
      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(filePath, file)
        
      if (uploadError) throw uploadError

      // 3. Pegar URL e salvar na tabela de media
      const { data: { publicUrl } } = supabase.storage
        .from('posts')
        .getPublicUrl(filePath)
        
      const { error: mediaError } = await supabase
        .from('social_post_media')
        .insert({
          post_id: post.id,
          media_url: publicUrl,
          media_type: 'image'
        })
        
      if (mediaError) throw mediaError

      alert('DDS postado no Instacena com sucesso!')
      onSuccess?.()
      onClose()
      
    } catch (err: any) {
      console.error(err)
      alert('Erro ao postar DDS: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm z-[99999]" onClick={onClose}>
      <div 
        className={`relative w-full max-w-lg overflow-y-auto rounded-3xl p-5 md:p-6 ${isDark ? 'bg-[#0f1014] text-white' : 'bg-white text-black'}`}
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-full transition-colors z-50 cursor-pointer ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
        >
          <X size={20} />
        </button>

        <div className="text-center mb-6 mt-2">
          <h2 className="text-2xl font-bold font-sans tracking-tight mb-2">Registrar DDS</h2>
          <p className="text-sm text-gray-500">Faça o upload da foto e os dados irão direto para o Instacena!</p>
        </div>

        <div className="flex flex-col gap-5">
          
          {/* Seção Foto */}
          <div>
            <label className="block text-sm font-semibold mb-2">Foto do DDS</label>
            {!preview ? (
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <UploadCloud className="w-10 h-10 mb-3 text-gray-400" />
                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold">Clique para enviar</span></p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG (Max. 10MB)</p>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
              </label>
            ) : (
              <div className="relative w-full h-48 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                <button 
                  onClick={() => { setFile(null); setPreview(null) }}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Seção Detalhes */}
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex flex-col gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-900 dark:text-gray-200">Tema do DDS</label>
              <input 
                type="text"
                className={`w-full p-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none ${isDark ? 'bg-black/20 border-white/10' : 'bg-white border-gray-200'}`}
                value={editableTema}
                onChange={e => setEditableTema(e.target.value)}
                placeholder="Ex: Prevenção de acidentes..."
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-200">Palestrante</label>
                <div className="flex gap-2">
                  <button 
                    className={`text-xs px-2 py-1 rounded-md transition-colors ${palestranteType === 'interno' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 font-medium' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                    onClick={() => setPalestranteType('interno')}
                  >
                    Interno
                  </button>
                  <button 
                    className={`text-xs px-2 py-1 rounded-md transition-colors ${palestranteType === 'externo' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 font-medium' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                    onClick={() => {
                      setPalestranteType('externo');
                      setEditablePalestrante('');
                    }}
                  >
                    Externo
                  </button>
                </div>
              </div>

              {palestranteType === 'interno' ? (
                <select
                  className={`w-full p-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none ${isDark ? 'bg-black/20 border-white/10' : 'bg-white border-gray-200'}`}
                  value={editablePalestrante}
                  onChange={e => setEditablePalestrante(e.target.value)}
                >
                  <option value="" disabled>Selecione um colaborador...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.nome}>{u.nome}</option>
                  ))}
                  {/* Fallback caso o nome atual não esteja na lista, ex: 'Livre' */}
                  {editablePalestrante && !users.find(u => u.nome === editablePalestrante) && (
                    <option value={editablePalestrante} className="hidden">{editablePalestrante}</option>
                  )}
                </select>
              ) : (
                <input 
                  type="text"
                  className={`w-full p-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none ${isDark ? 'bg-black/20 border-white/10' : 'bg-white border-gray-200'}`}
                  value={editablePalestrante}
                  onChange={e => setEditablePalestrante(e.target.value)}
                  placeholder="Ex: João Silva"
                />
              )}
            </div>
          </div>

          {/* Seção Anotações */}
          <div>
            <label className="block text-sm font-semibold mb-2">Anotações Adicionais</label>
            <textarea
              className={`w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow resize-none h-28 ${isDark ? 'bg-black/20 border-white/10' : 'bg-white border-gray-200'}`}
              placeholder="Adicione observações ou comentários sobre o que foi discutido..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button 
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            onClick={handleSubmit}
            disabled={isSubmitting || !file}
          >
            {isSubmitting ? (
              <span>Publicando...</span>
            ) : (
              <>
                <ImageIcon size={20} />
                Postar no Instacena
              </>
            )}
          </button>
          
        </div>
      </div>
    </div>
  )
}
