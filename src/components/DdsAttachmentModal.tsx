import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import X from 'lucide-react/dist/esm/icons/x.js'
import UploadCloud from 'lucide-react/dist/esm/icons/cloud-upload.js'
import FileText from 'lucide-react/dist/esm/icons/file-text.js'
import Loader2 from 'lucide-react/dist/esm/icons/loader-circle.js'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js'
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.js'
import Calendar from 'lucide-react/dist/esm/icons/calendar.js'
import AlertCircle from 'lucide-react/dist/esm/icons/circle-alert.js'
import { toast } from 'sonner'
import { uploadDdsFile, saveDdsAttachments, DdsAttachment } from '../lib/ddsAttachments'

interface DdsAttachmentModalProps {
  isOpen: boolean
  onClose: () => void
  currentDate?: string
  currentMonth?: string // YYYY-MM
  environment?: string
  onSuccess?: () => void
}

export function DdsAttachmentModal({
  isOpen,
  onClose,
  currentDate,
  currentMonth,
  environment,
  onSuccess
}: DdsAttachmentModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [targetDate, setTargetDate] = useState(
    currentDate || new Date().toISOString().split('T')[0]
  )
  const [description, setDescription] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen) {
      if (currentDate) {
        setTargetDate(currentDate)
      } else if (currentMonth) {
        // Se temos currentMonth mas não data específica, aponta pro dia 01 do mês ou hoje se for no mesmo mês
        const todayStr = new Date().toISOString().split('T')[0]
        if (todayStr.startsWith(currentMonth)) {
          setTargetDate(todayStr)
        } else {
          setTargetDate(`${currentMonth}-01`)
        }
      }
      setSelectedFiles([])
      setDescription('')
      setIsUploading(false)
      setUploadProgress(null)
    }
  }, [isOpen, currentDate, currentMonth])

  if (!isOpen) return null
  if (typeof document === 'undefined') return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
      setSelectedFiles(prev => [...prev, ...newFiles])
    }
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const handleUploadAll = async () => {
    if (selectedFiles.length === 0) {
      toast.warning('Selecione ao menos um arquivo ou PDF para anexar.')
      return
    }

    setIsUploading(true)
    setUploadProgress({ current: 0, total: selectedFiles.length })

    const uploadedList: DdsAttachment[] = []
    let failedCount = 0

    try {
      const userStr = typeof window !== 'undefined' ? localStorage.getItem('sucena_user_name') || 'Usuário' : 'Usuário'

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        setUploadProgress({ current: i + 1, total: selectedFiles.length })

        try {
          const res = await uploadDdsFile(file, targetDate, environment)
          const targetMonthStr = targetDate ? targetDate.slice(0, 7) : new Date().toISOString().slice(0, 7)
          uploadedList.push({
            id: `dds-att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: res.name,
            url: res.url,
            fileType: res.fileType,
            size: res.size,
            uploadedAt: new Date().toISOString(),
            uploadedBy: userStr,
            date: targetDate,
            month: targetMonthStr,
            description: description.trim() || undefined,
            environment: environment || 'barcarena'
          })
        } catch (fileErr) {
          console.error(`Erro ao fazer upload de ${file.name}:`, fileErr)
          failedCount++
        }
      }

      if (uploadedList.length > 0) {
        const saved = await saveDdsAttachments(uploadedList, environment)
        if (saved) {
          toast.success(
            `${uploadedList.length} arquivo(s)/PDF(s) salvos no banco com sucesso!`
          )
          onSuccess?.()
          onClose()
        } else {
          toast.error('Erro ao salvar os anexos no banco de dados.')
        }
      } else {
        toast.error('Não foi possível enviar os arquivos. Verifique os tamanhos ou tente novamente.')
      }
    } catch (err: any) {
      console.error('Falha no upload em lote:', err)
      toast.error('Erro inesperado no envio: ' + (err?.message || ''))
    } finally {
      setIsUploading(false)
      setUploadProgress(null)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white dark:bg-[#1a1a1b] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-blue-50/70 to-indigo-50/70 dark:from-white/5 dark:to-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-sm">
              <UploadCloud size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                Anexar Arquivos DDS Mensal
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Adicione múltiplos documentos, apresentações ou atas salvos no mês selecionado
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
          {/* Data e Mês de Vínculo do DDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5 flex items-center justify-between">
                <span>Data do DDS *</span>
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                disabled={isUploading}
                className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-white outline-none focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                Mês Salvo (Pasta Mensal)
              </label>
              <div className="flex items-center gap-2 h-[42px] px-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                <Calendar size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="capitalize">
                  {targetDate ? (() => {
                    try {
                      const [y, m] = targetDate.split('-')
                      const d = new Date(parseInt(y), parseInt(m) - 1, 1)
                      return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                    } catch {
                      return targetDate.slice(0, 7)
                    }
                  })() : 'Não definido'}
                </span>
              </div>
            </div>
          </div>

          {/* Descrição / Observação Opcional */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
              Descrição / Observação (Opcional)
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Ata assinada, Lista de presença, Slide da palestra..."
              disabled={isUploading}
              className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-white outline-none focus:border-blue-500 transition placeholder:text-gray-400"
            />
          </div>

          {/* Área de Seleção de Múltiplos Arquivos */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
              Arquivos / PDFs
            </label>
            <div
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-white/20 hover:border-blue-500 dark:hover:border-blue-400 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition bg-gray-50/50 dark:bg-black/20 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,application/pdf"
                onChange={handleFileChange}
                className="hidden"
                disabled={isUploading}
              />
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 group-hover:scale-110 transition">
                <FileText size={24} />
              </div>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                Clique para selecionar vários arquivos ou PDF
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Suporta PDF, Imagens, Documentos Word e Excel (múltipla seleção permitida)
              </p>
            </div>
          </div>

          {/* Lista de Arquivos Selecionados */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400 px-1">
                <span>{selectedFiles.length} arquivo(s) selecionado(s)</span>
                <button
                  type="button"
                  onClick={() => setSelectedFiles([])}
                  disabled={isUploading}
                  className="text-red-500 hover:text-red-600 cursor-pointer"
                >
                  Limpar todos
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {selectedFiles.map((file, idx) => {
                  const isPdf = file.name.toLowerCase().endsWith('.pdf')
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-200/80 dark:border-white/10 text-xs font-semibold"
                    >
                      <div className="flex items-center gap-2.5 truncate pr-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                            isPdf
                              ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                              : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          {isPdf ? 'PDF' : file.name.split('.').pop()?.toUpperCase() || 'FILE'}
                        </span>
                        <span className="truncate text-gray-800 dark:text-gray-200">
                          {file.name}
                        </span>
                        <span className="text-gray-400 shrink-0">
                          ({formatFileSize(file.size)})
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        disabled={isUploading}
                        className="text-gray-400 hover:text-red-500 p-1 rounded transition cursor-pointer"
                        title="Remover"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Progresso de Envio */}
          {isUploading && uploadProgress && (
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center gap-3">
              <Loader2 size={18} className="animate-spin text-blue-600" />
              <span>
                Salvando arquivos no banco de dados ({uploadProgress.current}/{uploadProgress.total})...
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleUploadAll}
            disabled={isUploading || selectedFiles.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            {isUploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <UploadCloud size={16} />
                <span>Salvar Anexos no Banco</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
