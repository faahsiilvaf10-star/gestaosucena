import X from 'lucide-react/dist/esm/icons/x.js';
import ImageIcon from 'lucide-react/dist/esm/icons/image.js';
import UploadCloud from 'lucide-react/dist/esm/icons/cloud-upload.js';
import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useMonthlyColors } from '../hooks/useMonthlyColors'
import { useTheme } from '../contexts/ThemeContext'
import { broadcastInstacenaActivity } from '../lib/instacenaEvents'

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
  const [colaboradores, setColaboradores] = useState<Array<{ id: string; nome: string; cargo?: string; source: 'system' | 'rh' }>>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Carregar todos os colaboradores (usuários do sistema e efetivo do RH)
  useEffect(() => {
    Promise.all([
      supabase.rpc('get_system_users'),
      supabase.from('rh_efetivo').select('id, nome, cargo, status')
    ]).then(([sysRes, rhRes]) => {
      const list: Array<{ id: string; nome: string; cargo?: string; source: 'system' | 'rh' }> = []
      const ids = new Set<string>()

      ;(sysRes.data || []).forEach((u: any) => {
        if (u.id && u.nome) {
          ids.add(u.id)
          list.push({
            id: u.id,
            nome: u.nome.trim(),
            cargo: u.cargo || 'Usuário do Sistema',
            source: 'system'
          })
        }
      })

      ;(rhRes.data || []).forEach((e: any) => {
        const s = (e.status || '').toUpperCase().trim()
        if (s === 'INATIVO' || s === 'DEMITIDO' || s === 'DESLIGADO') return
        if (e.id && e.nome && !ids.has(e.id)) {
          list.push({
            id: e.id,
            nome: e.nome.trim(),
            cargo: e.cargo || 'Efetivo RH',
            source: 'rh'
          })
        }
      })

      list.sort((a, b) => a.nome.localeCompare(b.nome))
      setColaboradores(list)
    }).catch(err => {
      console.error('Erro ao buscar colaboradores no modal de DDS:', err)
    })
  }, [])

  // Sincronizar dados e buscar agendamento do banco se palestrante for 'Livre' ou vazio
  useEffect(() => {
    if (!isOpen) return

    setFile(null)
    setPreview(null)
    setNotes('')

    const resolveTodayDds = async () => {
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

      let initialTema = tema && tema !== 'Sem tema agendado' ? tema.trim() : ''
      let initialPalestrante = palestrante && palestrante !== 'Livre' && palestrante !== 'Desconhecido' ? palestrante.trim() : ''

      // Se palestrante for 'Livre' ou vazio, busca direto no agendamento de hoje
      if (!initialPalestrante || initialPalestrante.toLowerCase() === 'livre' || !initialTema || initialTema === 'A DEFINIR') {
        try {
          const { data: ddsRow } = await supabase
            .from('seguranca_dds')
            .select('tema, palestrante_id')
            .eq('date', todayStr)
            .maybeSingle()

          if (ddsRow) {
            if (ddsRow.tema && (!initialTema || initialTema === 'Sem tema agendado')) {
              initialTema = ddsRow.tema.trim()
            }
            if (ddsRow.palestrante_id && (!initialPalestrante || initialPalestrante.toLowerCase() === 'livre')) {
              const { data: users } = await supabase.rpc('get_system_users')
              const matchedUser = users?.find((u: any) => u.id === ddsRow.palestrante_id)
              if (matchedUser?.nome) {
                initialPalestrante = matchedUser.nome.trim()
              } else {
                const { data: rhEmp } = await supabase
                  .from('rh_efetivo')
                  .select('nome')
                  .eq('id', ddsRow.palestrante_id)
                  .maybeSingle()
                if (rhEmp?.nome) {
                  initialPalestrante = rhEmp.nome.trim()
                }
              }
            }
          }
        } catch (err) {
          console.error('Erro ao resolver DDS do dia no modal:', err)
        }
      }

      setEditableTema(initialTema || tema || '')
      setEditablePalestrante(initialPalestrante || (palestrante && palestrante !== 'Livre' ? palestrante.trim() : '') || '')
    }

    resolveTodayDds()
  }, [isOpen, tema, palestrante])

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

      // Garantir que não envie 'Livre' se houver palestrante selecionado ou agendado
      let speaker = editablePalestrante?.trim()
      if (!speaker || speaker.toLowerCase() === 'livre') {
        speaker = palestrante && palestrante !== 'Livre' ? palestrante.trim() : ''
      }

      // Se ainda for vazio/Livre, tenta uma última consulta no banco para a data de hoje
      if (!speaker || speaker.toLowerCase() === 'livre') {
        const todayDdsDate = new Date()
        const todayStr = `${todayDdsDate.getFullYear()}-${String(todayDdsDate.getMonth() + 1).padStart(2, '0')}-${String(todayDdsDate.getDate()).padStart(2, '0')}`
        const { data: lastCheck } = await supabase
          .from('seguranca_dds')
          .select('palestrante_id')
          .eq('date', todayStr)
          .maybeSingle()
        if (lastCheck?.palestrante_id) {
          const matched = colaboradores.find(c => c.id === lastCheck.palestrante_id)
          if (matched?.nome) {
            speaker = matched.nome.trim()
          } else {
            const { data: rhPerson } = await supabase
              .from('rh_efetivo')
              .select('nome')
              .eq('id', lastCheck.palestrante_id)
              .maybeSingle()
            if (rhPerson?.nome) {
              speaker = rhPerson.nome.trim()
            } else {
              const { data: sysUsers } = await supabase.rpc('get_system_users')
              const sysUser = sysUsers?.find((u: any) => u.id === lastCheck.palestrante_id)
              if (sysUser?.nome) {
                speaker = sysUser.nome.trim()
              }
            }
          }
        }
      }

      // Estruturar legenda
      const caption = `🎤 **DDS Realizado!**\n**Tema:** ${editableTema?.trim() || 'Sem tema agendado'}\n**Palestrante:** ${speaker || 'Livre'}\n**Data:** ${today}\n**Cor Proibida do Mês:** ${colorName}\n\n${notes}`

      const envName = (typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') : null) === 'hydro-civil' ? 'HYDRO CIVIL' : 'HYDRO REABILITAÇÃO'

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

      broadcastInstacenaActivity({
        type: 'post',
        actorId: user.id,
        actorName: user.user_metadata?.full_name || user.user_metadata?.name || 'Segurança do Trabalho',
        actorAvatar: user.user_metadata?.avatar_url,
        content: `DDS Realizado • ${editableTema?.trim() || 'Foto do Dia'}`,
        mediaUrl: publicUrl,
        targetPostId: post.id
      })

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
                  <UploadCloud className="w-10 h-10 mb-3 text-[#5f6472] dark:text-gray-400" />
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
                className={`w-full p-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none ${isDark ? 'bg-black/20 border-white/10 text-white' : 'bg-white border-gray-200 text-black'}`}
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
                  className={`w-full p-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none ${isDark ? 'bg-black/20 border-white/10 text-white' : 'bg-white border-gray-200 text-black'}`}
                  value={editablePalestrante}
                  onChange={e => setEditablePalestrante(e.target.value)}
                >
                  <option value="" disabled>Selecione um colaborador...</option>
                  <optgroup label="Usuários do Sistema">
                    {colaboradores.filter(c => c.source === 'system').map(c => (
                      <option key={c.id} value={c.nome}>
                        {c.nome} {c.cargo ? `• ${c.cargo}` : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Efetivo do RH">
                    {colaboradores.filter(c => c.source === 'rh').map(c => (
                      <option key={c.id} value={c.nome}>
                        {c.nome} {c.cargo ? `• ${c.cargo}` : ''}
                      </option>
                    ))}
                  </optgroup>
                  {/* Fallback caso o nome atual não esteja na lista */}
                  {editablePalestrante && !colaboradores.some(c => c.nome.toLowerCase() === editablePalestrante.toLowerCase()) && (
                    <option value={editablePalestrante}>{editablePalestrante}</option>
                  )}
                </select>
              ) : (
                <input 
                  type="text"
                  className={`w-full p-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none ${isDark ? 'bg-black/20 border-white/10 text-white' : 'bg-white border-gray-200 text-black'}`}
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
              className={`w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow resize-none h-28 ${isDark ? 'bg-black/20 border-white/10 text-white' : 'bg-white border-gray-200 text-black'}`}
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
