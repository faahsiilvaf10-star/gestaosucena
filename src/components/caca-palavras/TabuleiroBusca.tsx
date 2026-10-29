import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Colocacao, Posicao, TabuleiroBusca } from './puzzle'
import Check from 'lucide-react/dist/esm/icons/check.js'

interface Props {
  tabuleiro: TabuleiroBusca
  /** Palavras já encontradas (palavra normalizada). */
  encontradas: Set<string>
  /** Chamado a cada mudança da seleção (durante o arraste). */
  aoSelecionar: (cells: Posicao[]) => void
  /** Chamado quando o jogador solta a seleção. */
  aoConcluir: (cells: Posicao[]) => void
  /** Chamado quando o jogador clica numa casa sem arraste válido. */
  aoTocar?: (pos: Posicao) => void
}

/**
 * Calcula a linha reta entre dois pontos (horizontal, vertical ou diagonal).
 * Se o arraste for ligeiramente torto, faz snap para a direção mais próxima.
 */
function obterLinha(a: Posicao, b: Posicao, maxTamanho: number): Posicao[] {
  const dr = b.r - a.r
  const dc = b.c - a.c

  if (dr === 0 && dc === 0) return [a]

  const absR = Math.abs(dr)
  const absC = Math.abs(dc)

  let passoR = 0
  let passoC = 0
  let dist = 0

  if (dr === 0) {
    // Linha horizontal pura
    passoC = dc > 0 ? 1 : -1
    dist = absC
  } else if (dc === 0) {
    // Linha vertical pura
    passoR = dr > 0 ? 1 : -1
    dist = absR
  } else if (absR === absC) {
    // Diagonal perfeita
    passoR = dr > 0 ? 1 : -1
    passoC = dc > 0 ? 1 : -1
    dist = absR
  } else {
    // Snap inteligente para a direção dominante
    if (absR >= absC * 2) {
      passoR = dr > 0 ? 1 : -1
      dist = absR
    } else if (absC >= absR * 2) {
      passoC = dc > 0 ? 1 : -1
      dist = absC
    } else {
      passoR = dr > 0 ? 1 : -1
      passoC = dc > 0 ? 1 : -1
      dist = Math.min(absR, absC)
    }
  }

  const cells: Posicao[] = []
  for (let i = 0; i <= dist; i++) {
    const r = a.r + passoR * i
    const c = a.c + passoC * i
    if (r >= 0 && r < maxTamanho && c >= 0 && c < maxTamanho) {
      cells.push({ r, c })
    }
  }

  return cells.length > 0 ? cells : [a]
}

/**
 * Tabuleiro interativo de Caça-Palavras com suporte para:
 * 1. Arraste contínuo (mouse e touch em celulares/tablets)
 * 2. Clique duplo: primeiro clique marca a primeira letra, segundo clica na última letra
 */
export function TabuleiroBusca({
  tabuleiro,
  encontradas,
  aoSelecionar,
  aoConcluir,
}: Props) {
  const [selecao, setSelecaoState] = useState<Posicao[]>([])
  const [cliqueOrigem, setCliqueOrigem] = useState<Posicao | null>(null)

  const isDraggingRef = useRef(false)
  const origemDragRef = useRef<Posicao | null>(null)
  const selecaoRef = useRef<Posicao[]>([])

  const setSelecao = useCallback(
    (cells: Posicao[]) => {
      selecaoRef.current = cells
      setSelecaoState(cells)
      aoSelecionar(cells)
    },
    [aoSelecionar],
  )

  // Conjunto de chaves de palavras já encontradas para visual rápido
  const casasEncontradas = useMemo(() => {
    const map = new Map<string, string>()
    for (const colocacao of tabuleiro.colocacoes) {
      if (!encontradas.has(colocacao.word)) continue
      for (const cell of colocacao.cells) {
        map.set(`${cell.r}:${cell.c}`, colocacao.word)
      }
    }
    return map
  }, [tabuleiro.colocacoes, encontradas])

  // Conjunto de chaves das células atualmente selecionadas (SOMENTE a linha traçada!)
  const selecaoKeys = useMemo(() => {
    return new Set(selecao.map((p) => `${p.r}:${p.c}`))
  }, [selecao])

  // Finalização do arraste ao soltar o mouse ou levantar o dedo
  const finalizarArraste = useCallback(() => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false

    const cells = selecaoRef.current
    origemDragRef.current = null

    if (cells.length > 1) {
      aoConcluir(cells)
    }

    setSelecao([])
  }, [aoConcluir, setSelecao])

  // Event listener global para capturar soltura do mouse mesmo fora do grid
  useEffect(() => {
    const onWindowPointerUp = () => {
      if (isDraggingRef.current) {
        finalizarArraste()
      }
    }
    window.addEventListener('pointerup', onWindowPointerUp)
    window.addEventListener('pointercancel', onWindowPointerUp)
    return () => {
      window.removeEventListener('pointerup', onWindowPointerUp)
      window.removeEventListener('pointercancel', onWindowPointerUp)
    }
  }, [finalizarArraste])

  // Início do arraste
  const handlePointerDown = (r: number, c: number, e: React.PointerEvent) => {
    e.preventDefault()
    isDraggingRef.current = true
    origemDragRef.current = { r, c }
    setCliqueOrigem(null) // Reseta clique duplo se começou a arrastar
    setSelecao([{ r, c }])
  }

  // Passagem do mouse por outra célula durante arraste no desktop
  const handlePointerEnter = (r: number, c: number) => {
    if (!isDraggingRef.current || !origemDragRef.current) return
    const linha = obterLinha(origemDragRef.current, { r, c }, tabuleiro.tamanho)
    setSelecao(linha)
  }

  // Suporte a toque no celular / tablet (detecta célula sob o dedo)
  const handleContainerPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !origemDragRef.current) return
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-grid-cell]')
    if (el) {
      const r = Number(el.getAttribute('data-r'))
      const c = Number(el.getAttribute('data-c'))
      if (!isNaN(r) && !isNaN(c)) {
        const linha = obterLinha(origemDragRef.current, { r, c }, tabuleiro.tamanho)
        setSelecao(linha)
      }
    }
  }

  // Clique alternativo (marca início e fim sem arrastar)
  const handleClick = (r: number, c: number) => {
    // Se estava arrastando, o pointerUp já tratou
    if (isDraggingRef.current) return

    if (!cliqueOrigem) {
      // Primeiro clique: define início
      setCliqueOrigem({ r, c })
      setSelecao([{ r, c }])
    } else {
      // Segundo clique: tenta fechar a palavra
      if (cliqueOrigem.r === r && cliqueOrigem.c === c) {
        // Clicou na mesma letra: cancela
        setCliqueOrigem(null)
        setSelecao([])
      } else {
        const linha = obterLinha(cliqueOrigem, { r, c }, tabuleiro.tamanho)
        if (linha.length > 1) {
          aoConcluir(linha)
        }
        setCliqueOrigem(null)
        setSelecao([])
      }
    }
  }

  return (
    <div
      className="relative w-full max-w-[560px] mx-auto select-none touch-none"
      onPointerMove={handleContainerPointerMove}
      onPointerUp={finalizarArraste}
    >
      <div
        className="grid gap-0.5 sm:gap-1.5 p-1 sm:p-2 rounded-2xl border border-slate-200 bg-white shadow-lg"
        style={{ gridTemplateColumns: `repeat(${tabuleiro.tamanho}, minmax(0, 1fr))` }}
      >
        {tabuleiro.grid.map((linha, r) =>
          linha.map((letra, c) => {
            const key = `${r}:${c}`
            const isEncontrada = casasEncontradas.has(key)
            const isSelecionada = selecaoKeys.has(key)
            const isOrigemClique = cliqueOrigem?.r === r && cliqueOrigem?.c === c

            let estilo =
              'border-slate-700/60 bg-slate-900 text-slate-100 hover:border-amber-400/50 hover:bg-slate-800'

            if (isEncontrada) {
              estilo =
                'border-amber-400 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/80 text-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.7)] ring-1.5 ring-amber-400 z-0'
            } else if (isSelecionada || isOrigemClique) {
              estilo =
                'border-yellow-300 bg-slate-950 text-yellow-200 shadow-[0_0_20px_rgba(250,204,21,0.9)] scale-[1.08] z-10 ring-2 ring-yellow-400'
            }

            const neonStyle = isEncontrada
              ? { textShadow: '0 0 8px #fef08a, 0 0 16px #fbbf24, 0 0 24px #f59e0b, 0 0 32px #d97706' }
              : isSelecionada || isOrigemClique
                ? { textShadow: '0 0 8px #fef9c3, 0 0 14px #fde047, 0 0 20px #eab308' }
                : undefined

            return (
              <button
                key={key}
                type="button"
                data-grid-cell="true"
                data-r={r}
                data-c={c}
                onPointerDown={(e) => handlePointerDown(r, c, e)}
                onPointerEnter={() => handlePointerEnter(r, c)}
                onClick={() => handleClick(r, c)}
                style={neonStyle}
                className={`relative aspect-square flex items-center justify-center rounded-[4px] sm:rounded-lg border text-[clamp(0.65rem,2.8vw,1.15rem)] font-black uppercase transition-transform duration-100 cursor-pointer ${estilo}`}
                aria-label={`Linha ${r + 1}, Coluna ${c + 1}: Letra ${letra}`}
              >
                {letra}
                {isEncontrada && (
                  <span className="pointer-events-none absolute inset-0 rounded-[4px] sm:rounded-lg bg-amber-400/15 animate-[pulse-glow_2s_ease-in-out_infinite]" />
                )}
              </button>
            )
          }),
        )}
      </div>
    </div>
  )
}

/** Lista de palavras com o estado de cada uma (achada / pendente). */
export function ListaPalavras({
  colocacoes,
  encontradas,
}: {
  colocacoes: Colocacao[]
  encontradas: Set<string>
}) {
  return (
    <ul className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-col sm:gap-2.5">
      {colocacoes.map((colocacao) => {
        const achada = encontradas.has(colocacao.word)
        return (
          <li
            key={colocacao.word}
            className={`rounded-xl border p-2 sm:p-3 transition-all duration-300 ${
              achada
                ? 'border-amber-400/60 bg-amber-500/15 shadow-[0_0_14px_rgba(245,158,11,0.25)]'
                : 'border-slate-800 bg-slate-900 shadow-sm hover:border-slate-700 hover:bg-slate-850'
            }`}
          >
            <div className="flex items-center justify-between gap-1.5">
              <span
                className={`text-xs sm:text-sm font-black tracking-wider truncate ${
                  achada ? 'text-amber-300 line-through decoration-2' : 'text-white'
                }`}
                style={achada ? { textShadow: '0 0 8px rgba(251, 191, 36, 0.7)' } : undefined}
              >
                {colocacao.word}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <span className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[0.6rem] sm:text-[0.65rem] font-bold uppercase tracking-wider text-amber-200">
                  {colocacao.category}
                </span>
                {achada && <Check className="h-3.5 w-3.5 text-amber-400 stroke-[3]" />}
              </div>
            </div>
            <p className="mt-1.5 text-[0.72rem] sm:text-xs text-slate-200 font-medium leading-snug">
              {colocacao.clue}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
