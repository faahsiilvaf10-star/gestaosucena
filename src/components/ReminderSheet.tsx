import { useState, useEffect } from 'react'
import { X, Calendar, User as UserIcon, Tag, Clock, CheckCircle2, Circle } from 'lucide-react'
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
  const [assignedUserId, setAssignedUserId] = useState<string | undefined>(undefined)
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

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
      setAssignedUserId(reminder.assigned_user_id)
      setDueDate(reminder.due_date || '')
      setDueTime(reminder.due_time || '')
      setShowDeleteConfirm(false)
    } else {
      setTitle('')
      setDescription('')
      setPriority('Normal')
      setAssignedUserId(undefined)
      setDueDate('')
      setDueTime('')
    }
  }, [reminder, isOpen])

  const saveMutation = useMutation({
    mutationFn: (data: Partial<Reminder>) => {
      if (isEditing && reminder) {
        return updateReminder(reminder.id, data)
      } else {
        return createReminder({ ...data, status: 'Pendente', is_recurring: false })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      onClose()
    }
  })

  const handleSave = () => {
    if (!title.trim()) return
    
    saveMutation.mutate({
      title,
      description,
      priority,
      assigned_user_id: assignedUserId,
      due_date: dueDate || undefined,
      due_time: dueTime || undefined
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

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-[#121214] border-l border-white/10 z-50 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out translate-x-0">
        
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
            
            {/* Responsável */}
            <div className="flex items-center gap-4 group cursor-pointer">
              <div className="w-32 flex items-center gap-2 text-sm text-white/40 group-hover:text-white/70 transition-colors">
                <UserIcon size={16} />
                <span>Responsável</span>
              </div>
              <div className="flex-1">
                <select 
                  value={assignedUserId || ''} 
                  onChange={(e) => setAssignedUserId(e.target.value || undefined)}
                  className="w-full bg-transparent text-sm text-white focus:outline-none hover:bg-white/5 p-1.5 -ml-1.5 rounded-md transition-colors appearance-none cursor-pointer"
                >
                  <option value="" className="bg-[#121214] text-white/50">Nenhum responsável</option>
                  {users.map(u => (
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
    </>
  )
}
