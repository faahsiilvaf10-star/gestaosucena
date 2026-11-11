import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import X from 'lucide-react/dist/esm/icons/x.js'
import Download from 'lucide-react/dist/esm/icons/download.js'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link.js'
import FileText from 'lucide-react/dist/esm/icons/file-text.js'
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2.js'
import { toast } from 'sonner'

interface PdfViewerModalProps {
  isOpen: boolean
  onClose: () => void
  url: string | null
  title: string
  fileType?: string
}

export function PdfViewerModal({ isOpen, onClose, url, title, fileType = 'pdf' }: PdfViewerModalProps) {
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

  if (!isOpen || !url) return null
  if (typeof document === 'undefined') return null

  const handleDownload = async () => {
    try {
      toast.loading('Iniciando download do arquivo...', { id: 'download-pdf' })
      const res = await fetch(url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = title.endsWith('.pdf') ? title : `${title}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
      toast.success('Download concluído!', { id: 'download-pdf' })
    } catch (err) {
      console.warn('Erro no download via blob, fallback abrindo link:', err)
      window.open(url, '_blank')
      toast.info('Abrindo arquivo em nova aba para salvar.', { id: 'download-pdf' })
    }
  }

  const isImage = fileType === 'image' || /\.(png|jpe?g|webp|gif|svg)$/i.test(url)

  return createPortal(
    <div className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-md flex flex-col p-2 sm:p-4 animate-in fade-in duration-200">
      {/* Top Bar Controls */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-900/95 border border-white/10 rounded-t-2xl text-white shadow-xl">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-2 rounded-xl bg-red-500/20 text-red-400 shrink-0">
            <FileText size={20} />
          </div>
          <div className="truncate">
            <h3 className="text-sm sm:text-base font-bold truncate">{title}</h3>
            <p className="text-[11px] text-gray-400">Visualização em tela cheia do DDS</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
            title="Baixar arquivo / PDF"
          >
            <Download size={15} />
            <span className="hidden sm:inline">Baixar</span>
          </button>

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition cursor-pointer"
            title="Abrir em nova aba"
          >
            <ExternalLink size={15} />
            <span className="hidden sm:inline">Nova Aba</span>
          </a>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-red-500/80 text-white transition cursor-pointer"
            title="Fechar (Esc)"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full bg-neutral-950 border-x border-b border-white/10 rounded-b-2xl overflow-hidden relative flex items-center justify-center">
        {isImage ? (
          <img
            src={url}
            alt={title}
            className="max-w-full max-h-[85vh] object-contain rounded-lg p-2 shadow-2xl"
          />
        ) : (
          <iframe
            src={url}
            title={title}
            className="w-full h-full border-0 rounded-b-2xl bg-white"
          />
        )}
      </div>
    </div>,
    document.body
  )
}
