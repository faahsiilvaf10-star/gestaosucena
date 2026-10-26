import { useEffect, useMemo, useRef } from 'react'
import type { Posicao, TabuleiroCruzadas } from './puzzle'

interface Props {
  tabuleiro: TabuleiroCruzadas
  /** Letras digitadas pelo jogador, indexadas por "r:c". */
  letras: Record<string, string>
  /** Casas já confirmadas (letra correta). */
  confirmadas: Set<string>
  /** Casa ativa. */
  ativa: Posicao | null
  aoEscolherCelula: (pos: Posicao) => void
  aoDigitar: (letra: string) => void
  aoApagar: () => void
  aoMover: (direcao: 'cima' | 'baixo' | 'esquerda' | 'direita') => void
}

/**
 * Tabuleiro de palavras cruzadas.
 *
 * A digitação acontece em um input invisível posicionado sobre o tabuleiro:
 * assim o teclado virtual do celular abre ao tocar numa casa, e o teclado
 * físico funciona igual.
 */
export function TabuleiroCruzadas({
  tabuleiro,
  letras,
  confirmadas,
  ativa,
  aoEscolherCelula,
  aoDigitar,
  aoApagar,
  aoMover,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Dicas agrupadas por direção, como em um jornal.
  const { horizontais, verticais } = useMemo(() => {
    const h = [...tabuleiro.slots].filter((s) => s.direcao === 'H').sort((a, b) => a.numero - b.numero)
    const v = [...tabuleiro.slots].filter((s) => s.direcao === 'V').sort((a, b) => a.numero - b.numero)
    return { horizontais: h, verticais: v }
  }, [tabuleiro.slots])

  // Slot que contém a casa ativa (para destacar a palavra ativa).
  const slotAtivo = useMemo(() => {
    if (!ativa) return null
    return (
      tabuleiro.slots.find((slot) =>
        slot.cells.some((cell) => cell.r === ativa.r && cell.c === ativa.c),
      ) ?? null
    )
  }, [ativa, tabuleiro.slots])

  const casasDoSlotAtivo = useMemo(() => {
    const set = new Set<string>()
    if (slotAtivo) {
      for (const cell of slotAtivo.cells) set.add(`${cell.r}:${cell.c}`)
    }
    return set
  }, [slotAtivo])

  useEffect(() => {
    if (ativa) inputRef.current?.focus({ preventScroll: true })
  }, [ativa])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const tecla = event.key
    if (/^[a-zA-Z]$/.test(tecla)) {
      event.preventDefault()
      aoDigitar(tecla.toUpperCase())
      return
    }
    if (tecla === 'Backspace' || tecla === 'Delete') {
      event.preventDefault()
      aoApagar()
      return
    }
    if (tecla === 'ArrowUp') {
      event.preventDefault()
      aoMover('cima')
      return
    }
    if (tecla === 'ArrowDown') {
      event.preventDefault()
      aoMover('baixo')
      return
    }
    if (tecla === 'ArrowLeft') {
      event.preventDefault()
      aoMover('esquerda')
      return
    }
    if (tecla === 'ArrowRight') {
      event.preventDefault()
      aoMover('direita')
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="relative">
        <input
          ref={inputRef}
          onKeyDown={handleKeyDown}
          className="pointer-events-none absolute h-px w-px opacity-0"
          aria-label="Digitar letras nas palavras cruzadas"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <div
          className="grid gap-[2px] sm:gap-1"
          style={{ gridTemplateColumns: `repeat(${tabuleiro.tamanho}, minmax(0, 1fr))` }}
        >
          {tabuleiro.grid.map((linha, r) =>
            linha.map((letra, c) => {
              const chave = `${r}:${c}`
              const preta = letra === null
              const numero = tabuleiro.numeros[chave]
              const digitada = letras[chave]
              const ativaCelula = ativa?.r === r && ativa?.c === c
              const naPalavraAtiva = casasDoSlotAtivo.has(chave)
              const confirmada = confirmadas.has(chave)

              if (preta) {
                return (
                  <div
                    key={chave}
                    className="aspect-square rounded-[6px] bg-[#0d0f14]/70 ring-1 ring-inset ring-black/40"
                  />
                )
              }

              return (
                <button
                  key={chave}
                  type="button"
                  onClick={() => aoEscolherCelula({ r, c })}
                  className={`relative aspect-square rounded-[6px] border transition-all duration-200 ${
                    ativaCelula
                      ? 'border-amber-400 bg-amber-400/30 shadow-[0_0_16px_rgba(245,158,11,0.5)] z-10'
                      : naPalavraAtiva
                        ? 'border-sky-400/60 bg-sky-400/20 text-white'
                        : 'border-white/10 bg-slate-900/80 hover:border-white/30'
                  }`}
                >
                  {numero ? (
                    <span className="absolute left-0.5 top-0 text-[0.5rem] font-bold leading-none text-slate-400 sm:text-[0.6rem]">
                      {numero}
                    </span>
                  ) : null}
                  <span
                    className={`flex h-full w-full items-center justify-center text-[clamp(0.65rem,2.3vw,1.15rem)] font-black uppercase ${
                      confirmada ? 'text-emerald-400' : digitada ? 'text-white' : 'text-transparent'
                    }`}
                  >
                    {digitada ?? ''}
                  </span>
                </button>
              )
            }),
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3.5 backdrop-blur-sm">
          <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-300">Horizontais</h4>
          <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {horizontais.map((slot) => {
              const completo = slot.cells.every((cell) => confirmadas.has(`${cell.r}:${cell.c}`))
              return (
                <li key={slot.id} className="flex gap-2 text-xs leading-snug">
                  <span className="font-bold text-amber-400">{slot.numero}.</span>
                  <span className={completo ? 'text-emerald-400 line-through opacity-70' : 'text-slate-300'}>{slot.clue}</span>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3.5 backdrop-blur-sm">
          <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-300">Verticais</h4>
          <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {verticais.map((slot) => {
              const completo = slot.cells.every((cell) => confirmadas.has(`${cell.r}:${cell.c}`))
              return (
                <li key={slot.id} className="flex gap-2 text-xs leading-snug">
                  <span className="font-bold text-amber-400">{slot.numero}.</span>
                  <span className={completo ? 'text-emerald-400 line-through opacity-70' : 'text-slate-300'}>{slot.clue}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </aside>
    </div>
  )
}
