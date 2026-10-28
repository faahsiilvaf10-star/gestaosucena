import { useEffect } from 'react'
import X from 'lucide-react/dist/esm/icons/x.js'
import { CacaPalavrasHub } from './CacaPalavrasHub'

interface Props {
  aberto: boolean
  aoFechar: () => void
}

/**
 * Bloco do Caça Palavras: abre como sobreposição a partir do botão da
 * barra superior.
 */
export function ModalCacaPalavras({ aberto, aoFechar, modoInicial = 'cruzada' }: Props) {
  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key === 'Escape') aoFechar()
    }
    window.addEventListener('keydown', aoTeclar)
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = overflowAnterior
    }
  }, [aberto, aoFechar])

  if (!aberto) return null

  return (
    <div className="dark fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-0 backdrop-blur-md sm:p-4 text-white">
      <div className="relative flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden border border-white/10 bg-[#0c0e14] shadow-2xl sm:h-[92vh] sm:rounded-3xl">
        <CacaPalavrasHub aoFechar={aoFechar} modoInicial={modoInicial} />
      </div>
    </div>
  )
}
