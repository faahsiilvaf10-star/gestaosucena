import { useEffect } from 'react'
import { CacaPalavrasHub } from './CacaPalavrasHub'

type Modo = 'busca' | 'cruzada'

interface Props {
  aberto: boolean
  aoFechar: () => void
  modoInicial?: Modo
}

/**
 * Bloco do Caça Palavras & Palavras Cruzadas: abre como sobreposição a partir do botão da
 * barra superior, no modo claro com fontes pretas de alta legibilidade.
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-0 backdrop-blur-md sm:p-4 text-slate-900">
      <div className="relative flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl sm:h-[92vh] sm:rounded-3xl">
        <CacaPalavrasHub aoFechar={aoFechar} modoInicial={modoInicial} />
      </div>
    </div>
  )
}
