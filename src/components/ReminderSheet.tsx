import X from 'lucide-react/dist/esm/icons/x.js';
import Calendar from 'lucide-react/dist/esm/icons/calendar.js';
import UserIcon from 'lucide-react/dist/esm/icons/user.js';
import Tag from 'lucide-react/dist/esm/icons/tag.js';
import Clock from 'lucide-react/dist/esm/icons/clock.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.js';
import Circle from 'lucide-react/dist/esm/icons/circle.js';
import Repeat from 'lucide-react/dist/esm/icons/repeat.js';
import ImagePlus from 'lucide-react/dist/esm/icons/image-plus.js';
import Palette from 'lucide-react/dist/esm/icons/palette.js';
import Check from 'lucide-react/dist/esm/icons/check.js';
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Reminder, UserProfile, updateReminder, createReminder, deleteReminder, uploadReminderImage } from '../lib/api-reminders'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { DateInput } from './ui/DateInput'
import { useTheme } from '../contexts/ThemeContext'

export const REMINDER_COLOR_PRESETS = [
  { name: 'Padrão', value: '', hex: '', isDarkText: false },
  { name: 'Azul', value: '#2563eb', hex: '#2563eb', isDarkText: false },
  { name: 'Verde', value: '#059669', hex: '#059669', isDarkText: false },
  { name: 'Amarelo', value: '#d97706', hex: '#d97706', isDarkText: false },
  { name: 'Vermelho', value: '#dc2626', hex: '#dc2626', isDarkText: false },
  { name: 'Roxo', value: '#7c3aed', hex: '#7c3aed', isDarkText: false },
  { name: 'Rosa', value: '#db2777', hex: '#db2777', isDarkText: false },
  { name: 'Laranja', value: '#ea580c', hex: '#ea580c', isDarkText: false },
  { name: 'Ciano', value: '#0891b2', hex: '#0891b2', isDarkText: false },
  { name: 'Grafite', value: '#334155', hex: '#334155', isDarkText: false },
]

interface ReminderSheetProps {
  isOpen: boolean
  onClose: () => void
  reminder: Reminder | null
  users: UserProfile[]
}

export function ReminderSheet({ isOpen, onClose, reminder, users }: ReminderSheetProps) {
  const { isDark } = useTheme()
  const queryClient = useQueryClient()
  const isEditing = !!reminder
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const canEdit = !isEditing || reminder?.creator_id === currentUserId

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Reminder['priority']>('Normal')
  const [mentions, setMentions] = useState<string[]>([])
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const [advanceNotice, setAdvanceNotice] = useState<number>(0)
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringDays, setRecurringDays] = useState<number[]>([])
  
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)

  const [cardColor, setCardColor] = useState<string>('')
  const [isPulsing, setIsPulsing] = useState<boolean>(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])

  useEffect(() => {
    if (reminder) {
      setTitle(reminder.title)
      setDescription(reminder.description || '')
      setPriority(reminder.priority)
      setMentions(reminder.reminder_mentions?.map(m => m.user_id) || (reminder.assigned_user_id ? [reminder.assigned_user_id] : []))
      setDueDate(reminder.due_date || '')
      setDueTime(reminder.due_time || '')
      setShowDeleteConfirm(false)
      setAdvanceNotice(reminder.recurrence_config?.advanceNotice || 0)
      setIsRecurring(reminder.is_recurring || false)
      setRecurringDays(reminder.recurrence_config?.days || [])
      setImageUrl(reminder.image_url || '')
      setImageFile(null)
      setCardColor(reminder.recurrence_config?.cardColor || reminder.card_color || '')
      setIsPulsing(!!(reminder.recurrence_config?.isPulsing ?? reminder.is_pulsing ?? false))
    } else {
      setTitle('')
      setDescription('')
      setPriority('Normal')
      setMentions([])
      setDueDate('')
      setDueTime('')
      setAdvanceNotice(0)
      setIsRecurring(false)
      setRecurringDays([])
      setImageUrl('')
      setImageFile(null)
      setCardColor('')
      setIsPulsing(false)
    }
  }, [reminder, isOpen])

  const saveMutation = useMutation({
    mutationFn: ({ data, mentions }: { data: Partial<Reminder>, mentions: string[] }) => {
      if (isEditing && reminder) {
        return updateReminder(reminder.id, data, mentions)
      } else {
        return createReminder({ ...data, status: 'Pendente', is_recurring: data.is_recurring || false }, mentions)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      onClose()
    },
    onError: (err: any) => {
      console.error("Erro ao salvar:", err)
      alert("Erro ao salvar o lembrete: " + (err.message || "Erro desconhecido. Verifique as permissões do banco de dados."))
    }
  })

  const handleSave = () => {
    if (!title.trim()) return
    
    // Se "ALL" está selecionado, salvar 'ALL' como string literal para identificar grupo
    // Caso contrário, salvar IDs individuais dos usuários mencionados
    let finalMentions = mentions
    if (mentions.includes('ALL')) {
      // Manter 'ALL' como está - será detectado pelo cron para enviar ao grupo
      // Não expandir para IDs individuais
    }

    const triggerSave = (uploadedUrl: string) => {
      saveMutation.mutate({
        data: {
          title,
          description,
          priority,
          // Se ALL, não definir assigned_user_id (ou deixar o primeiro)
          assigned_user_id: finalMentions.length > 0 && !finalMentions.includes('ALL') ? finalMentions[0] : undefined,
          due_date: dueDate || undefined,
          due_time: dueTime || undefined,
          is_recurring: isRecurring,
          recurrence_type: isRecurring ? 'weekly' : undefined,
          recurrence_config: {
            days: isRecurring ? recurringDays : undefined,
            advanceNotice: advanceNotice > 0 ? advanceNotice : undefined,
            cardColor: cardColor || undefined,
            isPulsing: isPulsing || false
          },
          image_url: uploadedUrl || undefined
        },
        mentions: finalMentions
      })
    }

    if (imageFile) {
      setIsUploading(true)
      uploadReminderImage(imageFile).then(url => {
        setIsUploading(false)
        setImageUrl(url)
        triggerSave(url)
      }).catch(err => {
        setIsUploading(false)
        alert('Erro ao fazer upload da imagem')
        console.error(err)
      })
    } else {
      triggerSave(imageUrl)
    }
  }

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (reminder) return deleteReminder(reminder.id)
      return Promise.resolve()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      onClose()
    }
  })

  const handleDelete = () => {
    deleteMutation.mutate()
  }

  if (!isOpen) return null

  return createPortal(
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4 sm:p-6 transition-opacity"
      onClick={onClose}
    >
      {/* Modal Window */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-3xl max-h-[90vh] ${isDark ? 'bg-[#121214] border-white/10' : 'bg-white border-gray-200'} border rounded-2xl shadow-2xl flex flex-col transform transition-all relative overflow-hidden`}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-3">
            <button 
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 dark:text-white/40 transition-colors"
            >
              {isEditing && reminder?.status === 'Concluído' ? (
                <CheckCircle2 size={24} className="text-indigo-500" />
              ) : (
                <Circle size={24} className="hover:text-indigo-400" />
              )}
            </button>
            <span className="text-sm font-medium text-gray-600 dark:text-white/50">
              {isEditing ? 'Detalhes do Lembrete' : 'Novo Lembrete'}
            </span>
          </div>
          
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-white/60 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar flex flex-col">
          
          {/* Title Input */}
          <div>
            <textarea 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nome da tarefa"
              className="w-full bg-transparent text-2xl font-semibold text-[#1c1d21] dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none resize-none overflow-y-auto min-h-[60px] disabled:opacity-70 disabled:cursor-not-allowed"
              rows={2}
              autoFocus
              disabled={!canEdit}
            />
          </div>

          {/* Properties Grid */}
          <div className="space-y-2">
            
            {/* Responsáveis (Múltiplos) */}
            <div className="flex items-start gap-4 group cursor-pointer">
              <div className="w-32 flex items-center gap-2 text-sm text-gray-500 dark:text-white/40 group-hover:text-gray-900 dark:group-hover:text-white transition-colors pt-1">
                <UserIcon size={16} />
                <span>Responsáveis</span>
              </div>
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex flex-wrap gap-2 mb-1">
                  {mentions.includes('ALL') ? (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-500/20 text-indigo-400 text-xs font-medium border border-indigo-500/20">
                      (Todos)
                      <button 
                        onClick={() => setMentions([])}
                        className="hover:text-white transition-colors ml-1"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    mentions.map(userId => {
                      const u = users.find(x => x.id === userId)
                      const isMe = userId === currentUserId
                      return (
                        <div key={userId} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-500/20 text-indigo-400 text-xs font-medium border border-indigo-500/20">
                          {isMe ? '(Eu)' : (u?.name || 'Desconhecido')}
                          {canEdit && (
                            <button 
                              onClick={() => setMentions(prev => prev.filter(id => id !== userId))}
                              className="hover:text-white transition-colors ml-1"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
                {canEdit && (
                  <select 
                    value="" 
                    onChange={(e) => {
                      const val = e.target.value
                      if (!val) return
                      if (val === 'ALL') {
                        setMentions(['ALL'])
                      } else if (!mentions.includes(val)) {
                        setMentions(prev => [...prev.filter(id => id !== 'ALL'), val])
                      }
                    }}
                    className="w-full bg-transparent text-sm text-[#1c1d21] dark:text-white focus:outline-none hover:bg-gray-100 dark:hover:bg-white/5 p-1.5 -ml-1.5 rounded-md transition-colors appearance-none cursor-pointer"
                  >
                    <option value="" className={isDark ? "bg-[#121214] text-white/50" : "bg-white text-gray-500"}>+ Adicionar responsável</option>
                    <option value="ALL" className={isDark ? "bg-[#121214] text-indigo-300 font-medium" : "bg-white text-indigo-600 font-medium"}>(Todos)</option>
                    {currentUserId && !mentions.includes(currentUserId) && (
                      <option value={currentUserId} className={isDark ? "bg-[#121214] text-indigo-400 font-medium" : "bg-white text-indigo-600 font-medium"}>(Eu)</option>
                    )}
                    {users.filter(u => u.id !== currentUserId && !mentions.includes(u.id)).map(u => (
                      <option key={u.id} value={u.id} className={isDark ? "bg-[#121214] text-white" : "bg-white text-gray-900"}>{u.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Data e Hora de Vencimento */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 group cursor-pointer">
              <div className="w-auto sm:w-32 flex items-center gap-2 text-sm text-gray-500 dark:text-white/40 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                <Calendar size={16} />
                <span>Data e Hora</span>
              </div>
              <div className="flex-1 flex flex-wrap items-center gap-2 w-full">
                <DateInput 
                  value={dueDate}
                  onChange={(val) => setDueDate(val)}
                  className="bg-transparent text-sm text-[#1c1d21] dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/40 focus:outline-none hover:bg-gray-100 dark:hover:bg-white/5 p-1.5 -ml-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={!canEdit}
                />
                <input 
                  type="time" 
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className={`bg-transparent text-sm text-[#1c1d21] dark:text-white focus:outline-none hover:bg-gray-100 dark:hover:bg-white/5 p-1.5 rounded-md transition-colors cursor-pointer ${isDark ? '[color-scheme:dark]' : '[color-scheme:light]'} disabled:opacity-70 disabled:cursor-not-allowed`}
                  disabled={!canEdit}
                />
              </div>
            </div>

            {/* Aviso Antecipado */}
            <div className="flex items-center gap-4 group cursor-pointer">
              <div className="w-32 flex items-center gap-2 text-sm text-gray-500 dark:text-white/40 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                <Clock size={16} />
                <span>Aviso Prévio</span>
              </div>
              <div className="flex-1">
                <select 
                  value={advanceNotice} 
                  onChange={(e) => setAdvanceNotice(Number(e.target.value))}
                  className="bg-transparent text-sm text-[#1c1d21] dark:text-white focus:outline-none hover:bg-gray-100 dark:hover:bg-white/5 p-1.5 -ml-1.5 rounded-md transition-colors appearance-none cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={!canEdit}
                >
                  <option value={0} className={isDark ? "bg-[#121214] text-white" : "bg-white text-gray-900"}>No momento</option>
                  <option value={1} className={isDark ? "bg-[#121214] text-white" : "bg-white text-gray-900"}>1 dia antes</option>
                  <option value={2} className={isDark ? "bg-[#121214] text-white" : "bg-white text-gray-900"}>2 dias antes</option>
                  <option value={3} className={isDark ? "bg-[#121214] text-white" : "bg-white text-gray-900"}>3 dias antes</option>
                  <option value={7} className={isDark ? "bg-[#121214] text-white" : "bg-white text-gray-900"}>1 semana antes</option>
                </select>
              </div>
            </div>

            {/* Recorrência */}
            <div className="flex items-start gap-4 group cursor-pointer">
              <div className="w-32 flex items-center gap-2 text-sm text-gray-500 dark:text-white/40 group-hover:text-gray-900 dark:group-hover:text-white transition-colors pt-0.5">
                <Repeat size={16} />
                <span>Recorrente</span>
              </div>
              <div className="flex-1">
                <div className="pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-[#1c1d21] dark:text-white">
                    <input 
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="rounded border-gray-300 dark:border-white/20 bg-white dark:bg-black/50 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 w-4 h-4 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                      disabled={!canEdit}
                    />
                    Repetir em dias específicos
                  </label>
                </div>
                {isRecurring && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, idx) => (
                      <button
                        key={idx}
                        disabled={!canEdit}
                        onClick={() => {
                          setRecurringDays(prev => 
                            prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]
                          )
                        }}
                        className={`w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center transition-colors disabled:opacity-70 disabled:cursor-not-allowed ${ recurringDays.includes(idx) ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white' }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Prioridade */}
            <div className="flex items-center gap-4 group cursor-pointer">
              <div className="w-32 flex items-center gap-2 text-sm text-gray-500 dark:text-white/40 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                <Tag size={16} />
                <span>Prioridade</span>
              </div>
              <div className="flex-1">
                <select 
                  value={priority} 
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="bg-transparent text-sm text-[#1c1d21] dark:text-white focus:outline-none hover:bg-gray-100 dark:hover:bg-white/5 p-1.5 -ml-1.5 rounded-md transition-colors appearance-none cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={!canEdit}
                >
                  <option value="Baixa" className={isDark ? "bg-[#121214] text-white" : "bg-white text-gray-900"}>Baixa</option>
                  <option value="Normal" className={isDark ? "bg-[#121214] text-white" : "bg-white text-gray-900"}>Normal</option>
                  <option value="Alta" className={isDark ? "bg-[#121214] text-white" : "bg-white text-gray-900"}>Alta</option>
                  <option value="Urgente" className={isDark ? "bg-[#121214] text-white" : "bg-white text-gray-900"}>Urgente</option>
                </select>
              </div>
            </div>

            {/* Cor do Card Completo */}
            <div className="flex items-start gap-4 group cursor-pointer pt-2">
              <div className="w-32 flex items-center gap-2 text-sm text-gray-500 dark:text-white/40 group-hover:text-gray-900 dark:group-hover:text-white transition-colors pt-1">
                <Palette size={16} />
                <span>Cor do card</span>
              </div>
              <div className="flex-1 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  {REMINDER_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setCardColor(preset.value)}
                      className={`relative w-7 h-7 rounded-full transition-all flex items-center justify-center cursor-pointer ${
                        cardColor === preset.value
                          ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110 shadow-sm'
                          : 'hover:scale-105 opacity-80 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: preset.hex || (isDark ? '#27272a' : '#f4f4f5'),
                        border: preset.hex ? '1px solid rgba(0,0,0,0.1)' : (isDark ? '1px dashed #52525b' : '1px dashed #a1a1aa')
                      }}
                      title={preset.name}
                    >
                      {cardColor === preset.value && (
                        <Check size={14} className={preset.isDarkText ? 'text-gray-900' : 'text-white'} />
                      )}
                      {!preset.hex && cardColor !== preset.value && (
                        <span className="text-[10px] text-gray-400">×</span>
                      )}
                    </button>
                  ))}

                  {/* Input de cor livre */}
                  <label 
                    className="relative w-7 h-7 rounded-full overflow-hidden border border-gray-300 dark:border-white/20 hover:scale-105 transition-all cursor-pointer flex items-center justify-center bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 shadow-xs"
                    title="Escolher cor personalizada"
                  >
                    <input
                      type="color"
                      disabled={!canEdit}
                      value={cardColor && cardColor.startsWith('#') ? cardColor : '#2563eb'}
                      onChange={(e) => setCardColor(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </label>

                  {cardColor && (
                    <button
                      type="button"
                      onClick={() => setCardColor('')}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-1 cursor-pointer"
                      title="Restaurar cor padrão"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {/* Efeito Pulsante no Dashboard */}
                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-[#1c1d21] dark:text-white">
                    <input 
                      type="checkbox"
                      checked={isPulsing}
                      onChange={(e) => setIsPulsing(e.target.checked)}
                      className="rounded border-gray-300 dark:border-white/20 bg-white dark:bg-black/50 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 w-4 h-4 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                      disabled={!canEdit}
                    />
                    <span className="flex items-center gap-2">
                      <span>Efeito pulsante no Dashboard</span>
                      {isPulsing && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                          Pulsando ativo
                        </span>
                      )}
                    </span>
                  </label>
                </div>

                {/* Prévia visual */}
                {(cardColor || isPulsing) && (
                  <div 
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
                      isPulsing ? 'reminder-card-pulse' : ''
                    }`}
                    style={{
                      backgroundColor: cardColor 
                        ? (isDark ? `color-mix(in srgb, ${cardColor} 22%, rgba(18, 18, 20, 0.95))` : `color-mix(in srgb, ${cardColor} 18%, #ffffff)`)
                        : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                      borderColor: cardColor || (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                      '--reminder-pulse-shadow': cardColor || (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'),
                      color: isDark ? '#ffffff' : '#111827'
                    } as React.CSSProperties}
                  >
                    <div className="flex items-center gap-2">
                      {isPulsing && (
                        <span className="relative flex h-2 w-2">
                          <span 
                            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                            style={{ backgroundColor: cardColor || '#6366f1' }}
                          />
                          <span 
                            className="relative inline-flex rounded-full h-2 w-2"
                            style={{ backgroundColor: cardColor || '#6366f1' }}
                          />
                        </span>
                      )}
                      <span className="font-semibold">
                        Prévia: O card completo ficará nesta cor no Dashboard {isPulsing ? '(com animação pulsante)' : ''}
                      </span>
                    </div>
                    {cardColor && (
                      <span 
                        className="w-3.5 h-3.5 rounded-full shadow-xs shrink-0" 
                        style={{ backgroundColor: cardColor }} 
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Foto/Anexo */}
            <div className="flex items-start gap-4 group cursor-pointer pt-2">
              <div className="w-32 flex items-center gap-2 text-sm text-gray-500 dark:text-white/40 group-hover:text-gray-900 dark:group-hover:text-white transition-colors pt-1">
                <ImagePlus size={16} />
                <span>Foto anexa</span>
              </div>
              <div className="flex-1">
                {imageUrl || imageFile ? (
                  <div className="relative inline-block mt-1">
                    <img 
                      src={imageFile ? URL.createObjectURL(imageFile) : imageUrl} 
                      alt="Anexo" 
                      className="h-32 w-auto object-cover rounded-xl border border-gray-200 dark:border-white/10"
                    />
                    {canEdit && (
                      <button 
                        onClick={() => {
                          setImageFile(null)
                          setImageUrl('')
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-lg"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ) : canEdit && (
                  <div className="mt-1">
                    <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer">
                      <div className="flex flex-col items-center gap-1 text-gray-500 dark:text-white/70">
                        <ImagePlus size={20} />
                        <span className="text-xs font-medium">Clique para adicionar foto</span>
                      </div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setImageFile(e.target.files[0])
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Description */}
          <div className="pt-3 border-t border-gray-100 dark:border-white/5 flex-1 flex flex-col">
            <h3 className="text-sm font-medium text-gray-700 dark:text-white/70 mb-2">Descrição</h3>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="O que precisa ser feito?"
              className="w-full flex-1 min-h-[160px] bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-xl p-4 text-sm text-[#1c1d21] dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:border-indigo-500 resize-none transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={!canEdit}
            />
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50 dark:bg-[#0A0A0B]/50">
          <div>
            {isEditing && canEdit && (
              <>
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 dark:text-white/60">Tem certeza?</span>
                    <button 
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-2 py-1.5 rounded bg-gray-200 dark:bg-white/5 hover:bg-gray-300 dark:hover:bg-white/10 text-xs font-medium text-[#1c1d21] dark:text-white transition-colors"
                    >
                      Não
                    </button>
                    <button 
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending}
                      className="px-2 py-1.5 rounded bg-red-500/20 hover:bg-red-500/30 text-xs font-medium text-red-500 dark:text-red-400 transition-colors"
                    >
                      {deleteMutation.isPending ? 'Excluindo...' : 'Sim, excluir'}
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-500/10 transition-colors"
                  >
                    Excluir
                  </button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              {canEdit ? 'Cancelar' : 'Fechar'}
            </button>
            {canEdit && (
              <button 
                onClick={handleSave}
                disabled={!title.trim() || saveMutation.isPending || isUploading}
                className="px-6 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 shadow-lg shadow-indigo-600/20"
              >
                {saveMutation.isPending || isUploading ? 'Salvando...' : 'Salvar'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>,
    document.body
  )
}


