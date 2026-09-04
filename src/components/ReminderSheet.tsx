import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Calendar, User as UserIcon, Tag, Clock, CheckCircle2, Circle, Repeat } from 'lucide-react'
import { Reminder, UserProfile, updateReminder, createReminder, deleteReminder } from '../lib/api-reminders'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

interface ReminderSheetProps {
  isOpen: boolean
  onClose: () => void
  reminder: Reminder | null
  users: UserProfile[]
}

export function ReminderSheet({ isOpen, onClose, reminder, users }: ReminderSheetProps) {
  const queryClient = useQueryClient()
  const isEditing = !!reminder

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Reminder['priority']>('Normal')
  const [mentions, setMentions] = useState<string[]>([])
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringDays, setRecurringDays] = useState<number[]>([])

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
      setIsRecurring(reminder.is_recurring || false)
      setRecurringDays(reminder.recurrence_config?.days || [])
    } else {
      setTitle('')
      setDescription('')
      setPriority('Normal')
      setMentions([])
      setDueDate('')
      setDueTime('')
      setIsRecurring(false)
      setRecurringDays([])
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
    
    let finalMentions = mentions
    if (mentions.includes('ALL')) {
      finalMentions = users.map(u => u.id)
      if (currentUserId && !finalMentions.includes(currentUserId)) {
        finalMentions.push(currentUserId)
      }
    }

    saveMutation.mutate({
      data: {
        title,
        description,
        priority,
        // Mantemos assigned_user_id pro primeiro apenas por compatibilidade legada se precisar
        assigned_user_id: finalMentions.length > 0 ? finalMentions[0] : null,
        due_date: dueDate || undefined,
        due_time: dueTime || undefined,
        is_recurring: isRecurring,
        recurrence_type: isRecurring ? 'weekly' : null,
        recurrence_config: isRecurring ? { days: recurringDays } : null
      },
      mentions: finalMentions
    })
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
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] transition-opacity"
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-[#121214] border-l border-white/10 z-[120] shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out translate-x-0">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <button 
              className="p-2 rounded-lg hover:bg-white/5 text-white/40 transition-colors"
            >
              {isEditing && reminder?.status === 'Concluído' ? (
                <CheckCircle2 size={24} className="text-indigo-500" />
              ) : (
                <Circle size={24} className="hover:text-indigo-400" />
              )}
            </button>
            <span className="text-sm font-medium text-white/50">
              {isEditing ? 'Detalhes do Lembrete' : 'Novo Lembrete'}
            </span>
          </div>
          
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
          {/* Title Input */}
          <div>
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nome da tarefa"
              className="w-full bg-transparent text-2xl font-semibold text-white placeholder:text-white/20 focus:outline-none"
              autoFocus
            />
          </div>

          {/* Properties Grid */}
          <div className="space-y-4">
            
            {/* Responsáveis (Múltiplos) */}
            <div className="flex items-start gap-4 group cursor-pointer">
              <div className="w-32 flex items-center gap-2 text-sm text-white/40 group-hover:text-white/70 transition-colors pt-1">
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
                          <button 
                            onClick={() => setMentions(prev => prev.filter(id => id !== userId))}
                            className="hover:text-white transition-colors ml-1"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
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
                  className="w-full bg-transparent text-sm text-white focus:outline-none hover:bg-white/5 p-1.5 -ml-1.5 rounded-md transition-colors appearance-none cursor-pointer"
                >
                  <option value="" className="bg-[#121214] text-white/50">+ Adicionar responsável</option>
                  <option value="ALL" className="bg-[#121214] text-indigo-300 font-medium">(Todos)</option>
                  {currentUserId && !mentions.includes(currentUserId) && (
                    <option value={currentUserId} className="bg-[#121214] text-indigo-400 font-medium">(Eu)</option>
                  )}
                  {users.filter(u => u.id !== currentUserId && !mentions.includes(u.id)).map(u => (
                    <option key={u.id} value={u.id} className="bg-[#121214]">{u.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Data e Hora de Vencimento */}
            <div className="flex items-center gap-4 group cursor-pointer">
              <div className="w-32 flex items-center gap-2 text-sm text-white/40 group-hover:text-white/70 transition-colors">
                <Calendar size={16} />
                <span>Data e Hora</span>
              </div>
              <div className="flex-1 flex items-center gap-2">
                <input 
                  type="date" 
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-transparent text-sm text-white focus:outline-none hover:bg-white/5 p-1.5 -ml-1.5 rounded-md transition-colors cursor-pointer [color-scheme:dark]"
                />
                <input 
                  type="time" 
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="bg-transparent text-sm text-white focus:outline-none hover:bg-white/5 p-1.5 rounded-md transition-colors cursor-pointer [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Recorrência */}
            <div className="flex items-start gap-4 group cursor-pointer">
              <div className="w-32 flex items-center gap-2 text-sm text-white/40 group-hover:text-white/70 transition-colors pt-2">
                <Repeat size={16} />
                <span>Recorrente</span>
              </div>
              <div className="flex-1">
                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-white">
                    <input 
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="rounded border-white/20 bg-black/50 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                    />
                    Repetir em dias específicos
                  </label>
                </div>
                {isRecurring && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setRecurringDays(prev => 
                            prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]
                          )
                        }}
                        className={`w-9 h-9 rounded-full text-xs font-medium flex items-center justify-center transition-colors ${
                          recurringDays.includes(idx) 
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                        }`}
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
              <div className="w-32 flex items-center gap-2 text-sm text-white/40 group-hover:text-white/70 transition-colors">
                <Tag size={16} />
                <span>Prioridade</span>
              </div>
              <div className="flex-1">
                <select 
                  value={priority} 
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="bg-transparent text-sm text-white focus:outline-none hover:bg-white/5 p-1.5 -ml-1.5 rounded-md transition-colors appearance-none cursor-pointer"
                >
                  <option value="Baixa" className="bg-[#121214]">Baixa</option>
                  <option value="Normal" className="bg-[#121214]">Normal</option>
                  <option value="Alta" className="bg-[#121214]">Alta</option>
                  <option value="Urgente" className="bg-[#121214]">Urgente</option>
                </select>
              </div>
            </div>

          </div>

          {/* Description */}
          <div className="pt-4 border-t border-white/5">
            <h3 className="text-sm font-medium text-white/70 mb-3">Descrição</h3>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="O que precisa ser feito?"
              className="w-full h-32 bg-white/[0.02] border border-white/10 rounded-xl p-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 resize-none transition-colors"
            />
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/5 flex items-center justify-between bg-[#0A0A0B]/50">
          <div>
            {isEditing && reminder?.creator_id === currentUserId && (
              <>
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/60">Tem certeza?</span>
                    <button 
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 text-xs font-medium text-white transition-colors"
                    >
                      Não
                    </button>
                    <button 
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending}
                      className="px-2 py-1.5 rounded bg-red-500/20 hover:bg-red-500/30 text-xs font-medium text-red-400 transition-colors"
                    >
                      {deleteMutation.isPending ? 'Excluindo...' : 'Sim, excluir'}
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
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
              className="px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave}
              disabled={!title.trim() || saveMutation.isPending}
              className="px-6 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 shadow-lg shadow-indigo-600/20"
            >
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>

      </div>
    </>,
    document.body
  )
}
