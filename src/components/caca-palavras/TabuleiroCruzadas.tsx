import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [abaMobile, setAbaMobile] = useState<'H' | 'V'>('H')
  const [mostrarTeclado, setMostrarTeclado] = useState(true)

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

  // Atualiza automaticamente a aba mobile de acordo com a palavra selecionada
  useEffect(() => {
    if (slotAtivo) {
      setAbaMobile(slotAtivo.direcao)
    }
  }, [slotAtivo])

  const casasDoSlotAtivo = useMemo(() => {
    const set = new Set<string>()
    if (slotAtivo) {
      for (const cell of slotAtivo.cells) set.add(`${cell.r}:${cell.c}`)
    }
    return set
  }, [slotAtivo])

  // Navegar para o slot anterior ou próximo
  const alternarSlot = (direcao: 'anterior' | 'proximo') => {
    if (!tabuleiro.slots.length) return
    const lista = [...tabuleiro.slots].sort((a, b) => a.numero - b.numero || a.direcao.localeCompare(b.direcao))
    const indexAtual = slotAtivo ? lista.findIndex((s) => s.id === slotAtivo.id) : -1
    let novoIndex = direcao === 'proximo' ? indexAtual + 1 : indexAtual - 1
    if (novoIndex >= lista.length) novoIndex = 0
    if (novoIndex < 0) novoIndex = lista.length - 1
    const alvo = lista[novoIndex]
    if (alvo) {
      const primeiraVazia = alvo.cells.find((c) => !confirmadas.has(`${c.r}:${c.c}`)) ?? alvo.cells[0]
      aoEscolherCelula(primeiraVazia)
    }
  }

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

  // Fileiras do teclado virtual integrado para celular
  const TECLADO_LINHAS = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ]

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_290px]">
      <div className="relative flex flex-col">
        {/* Input invisível para capturar teclado físico */}
        <input
          ref={inputRef}
          onKeyDown={handleKeyDown}
          className="pointer-events-none absolute h-px w-px opacity-0"
          aria-label="Digitar letras nas palavras cruzadas"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />

        {/* Barra Fixa da Dica Ativa (Fundamental para Mobile) */}
        <div className="mb-2 flex items-center justify-between gap-1.5 rounded-xl border border-sky-400/30 bg-sky-950/70 p-2 sm:p-2.5 backdrop-blur-md shadow-lg">
          <button
            type="button"
            onClick={() => alternarSlot('anterior')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 active:scale-95 hover:bg-white/10"
            title="Palavra anterior"
          >
            ◀
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
            {slotAtivo ? (
              <>
                <span className="shrink-0 rounded-md bg-amber-400/20 border border-amber-400/40 px-1.5 py-0.5 text-[0.65rem] font-black text-amber-700">
                  {slotAtivo.numero} {slotAtivo.direcao === 'H' ? 'HOR' : 'VERT'}
                </span>
                <p className="truncate text-xs font-bold text-white sm:text-sm">
                  {slotAtivo.clue}
                </p>
                <span className="ml-auto shrink-0 text-[10px] font-mono font-bold text-sky-300">
                  {slotAtivo.word.length}L
                </span>
              </>
            ) : (
              <p className="truncate text-xs text-slate-400">
                Toque em qualquer casa para ver a dica e digitar
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => alternarSlot('proximo')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 active:scale-95 hover:bg-white/10"
            title="Próxima palavra"
          >
            ▶
          </button>
        </div>

        {/* Grade do Tabuleiro de Cruzadas */}
        <div className="mx-auto w-full max-w-[540px]">
          <div
            className="grid gap-[1.5px] sm:gap-1 p-1 sm:p-1.5 rounded-xl border border-white/10 bg-slate-950/80 shadow-2xl backdrop-blur-md"
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
                const isDica = Boolean(tabuleiro.dicasIniciais?.[chave])

                if (preta) {
                  return (
                    <div
                      key={chave}
                      className="aspect-square rounded-[4px] sm:rounded-[6px] bg-[#0d0f14]/80 ring-1 ring-inset ring-black/50"
                    />
                  )
                }

                return (
                  <button
                    key={chave}
                    type="button"
                    onClick={() => aoEscolherCelula({ r, c })}
                    className={`relative aspect-square rounded-[4px] sm:rounded-[6px] border transition-all duration-150 select-none ${
                      ativaCelula
                        ? 'border-amber-400 bg-amber-400/35 shadow-[0_0_16px_rgba(245,158,11,0.6)] z-10 scale-[1.02]'
                        : isDica
                          ? naPalavraAtiva
                            ? 'border-emerald-400/80 bg-emerald-500/25 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                            : 'border-emerald-500/40 bg-emerald-500/15'
                          : naPalavraAtiva
                            ? 'border-sky-400/60 bg-sky-400/20 text-white'
                            : 'border-white/10 bg-slate-900/80 hover:border-white/30'
                    }`}
                  >
                    {numero ? (
                      <span className="absolute left-0.5 top-0 text-[0.45rem] font-black leading-none text-slate-500 sm:text-[0.55rem]">
                        {numero}
                      </span>
                    ) : null}
                    {isDica ? (
                      <span
                        className="absolute right-0.5 top-0 text-[0.4rem] font-black leading-none text-emerald-700 sm:text-[0.5rem]"
                        title="Dica inicial"
                      >
                        ★
                      </span>
                    ) : null}
                    <span
                      className={`flex h-full w-full items-center justify-center text-[clamp(0.65rem,2.8vw,1.15rem)] font-black uppercase ${
                        isDica
                          ? 'text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                          : confirmada
                            ? 'text-emerald-400'
                            : digitada
                              ? 'text-white'
                              : 'text-transparent'
                      }`}
                    >
                      {digitada ?? (isDica ? tabuleiro.dicasIniciais[chave] : '')}
                    </span>
                  </button>
                )
              }),
            )}
          </div>
        </div>

        {/* Teclado Virtual Integrado para Mobile / Tablets */}
        <div className="mt-3 block">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-[11px] font-bold text-slate-700">Teclado na Tela</span>
            <button
              type="button"
              onClick={() => setMostrarTeclado((v) => !v)}
              className="text-[11px] text-sky-600 font-bold hover:underline"
            >
              {mostrarTeclado ? 'Ocultar teclado' : 'Mostrar teclado'}
            </button>
          </div>

          {mostrarTeclado && (
            <div className="rounded-2xl border border-slate-200 bg-slate-100 p-1.5 sm:p-2.5 shadow-md">
              <div className="flex flex-col gap-1 sm:gap-1.5">
                {/* Linha 1 */}
                <div className="flex justify-center gap-1 sm:gap-1.5">
                  {TECLADO_LINHAS[0].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => aoDigitar(k)}
                      className="flex h-10 flex-1 max-w-[42px] items-center justify-center rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-black text-slate-900 shadow-xs transition-transform active:scale-95 active:bg-amber-100 hover:bg-slate-50"
                    >
                      {k}
                    </button>
                  ))}
                </div>

                {/* Linha 2 */}
                <div className="flex justify-center gap-1 sm:gap-1.5 px-2">
                  {TECLADO_LINHAS[1].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => aoDigitar(k)}
                      className="flex h-10 flex-1 max-w-[42px] items-center justify-center rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-black text-slate-900 shadow-xs transition-transform active:scale-95 active:bg-amber-100 hover:bg-slate-50"
                    >
                      {k}
                    </button>
                  ))}
                </div>

                {/* Linha 3 com Apagar e Próxima */}
                <div className="flex justify-center gap-1 sm:gap-1.5">
                  <button
                    type="button"
                    onClick={aoApagar}
                    className="flex h-10 flex-[1.4] max-w-[58px] items-center justify-center rounded-lg border border-red-300 bg-red-50 text-xs font-black text-red-700 shadow-xs transition-transform active:scale-95 active:bg-red-100 hover:bg-red-100"
                    title="Apagar letra (Backspace)"
                  >
                    ⌫
                  </button>

                  {TECLADO_LINHAS[2].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => aoDigitar(k)}
                      className="flex h-10 flex-1 max-w-[42px] items-center justify-center rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-black text-slate-900 shadow-xs transition-transform active:scale-95 active:bg-amber-100 hover:bg-slate-50"
                    >
                      {k}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => alternarSlot('proximo')}
                    className="flex h-10 flex-[1.4] max-w-[58px] items-center justify-center rounded-lg border border-sky-300 bg-sky-50 text-xs font-black text-sky-700 shadow-xs transition-transform active:scale-95 active:bg-sky-100 hover:bg-sky-100"
                    title="Avançar para a próxima palavra"
                  >
                    ➜
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Painel de Dicas: Abas no Mobile, Colunas no Desktop */}
      <aside className="space-y-3">
        {/* Banner de Dicas Iniciais */}
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 shadow-xs">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-black text-emerald-400">
            ★
          </span>
          <span className="leading-tight text-[11px] sm:text-xs">
            Letras em verde com <strong className="text-emerald-700">★</strong> são <strong>dicas iniciais</strong>!
          </span>
        </div>

        {/* Abas no Mobile (< lg) */}
        <div className="block lg:hidden">
          <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 mb-2">
            <button
              type="button"
              onClick={() => setAbaMobile('H')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                abaMobile === 'H'
                  ? 'bg-white text-amber-800 font-extrabold shadow-xs border border-amber-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Horizontais ({horizontais.length})
            </button>
            <button
              type="button"
              onClick={() => setAbaMobile('V')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                abaMobile === 'V'
                  ? 'bg-white text-amber-800 font-extrabold shadow-xs border border-amber-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Verticais ({verticais.length})
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
            <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {(abaMobile === 'H' ? horizontais : verticais).map((slot) => {
                const completo = slot.cells.every((cell) => confirmadas.has(`${cell.r}:${cell.c}`))
                const isSlotAtivo = slotAtivo?.id === slot.id
                return (
                  <li
                    key={slot.id}
                    onClick={() => {
                      const primeiraVazia =
                        slot.cells.find((c) => !confirmadas.has(`${c.r}:${c.c}`)) ?? slot.cells[0]
                      aoEscolherCelula(primeiraVazia)
                    }}
                    className={`flex cursor-pointer gap-2 rounded-lg p-1.5 text-xs leading-snug transition-colors ${
                      isSlotAtivo ? 'bg-sky-100 text-sky-950 font-bold ring-1 ring-sky-300' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <span className="font-black text-amber-700">{slot.numero}.</span>
                    <span className={completo ? 'text-emerald-700 line-through opacity-70' : 'text-slate-900'}>
                      {slot.clue}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {/* Layout Desktop (>= lg) */}
        <div className="hidden lg:block space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <h4 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-900">
              Horizontais ({horizontais.length})
            </h4>
            <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {horizontais.map((slot) => {
                const completo = slot.cells.every((cell) => confirmadas.has(`${cell.r}:${cell.c}`))
                const isSlotAtivo = slotAtivo?.id === slot.id
                return (
                  <li
                    key={slot.id}
                    onClick={() => {
                      const primeiraVazia =
                        slot.cells.find((c) => !confirmadas.has(`${c.r}:${c.c}`)) ?? slot.cells[0]
                      aoEscolherCelula(primeiraVazia)
                    }}
                    className={`flex cursor-pointer gap-2 rounded-lg p-1 text-xs leading-snug transition-colors ${
                      isSlotAtivo ? 'bg-sky-100 text-sky-950 font-bold ring-1 ring-sky-300' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <span className="font-bold text-amber-700">{slot.numero}.</span>
                    <span className={completo ? 'text-emerald-700 line-through opacity-70' : 'text-slate-900'}>
                      {slot.clue}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <h4 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-900">
              Verticais ({verticais.length})
            </h4>
            <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {verticais.map((slot) => {
                const completo = slot.cells.every((cell) => confirmadas.has(`${cell.r}:${cell.c}`))
                const isSlotAtivo = slotAtivo?.id === slot.id
                return (
                  <li
                    key={slot.id}
                    onClick={() => {
                      const primeiraVazia =
                        slot.cells.find((c) => !confirmadas.has(`${c.r}:${c.c}`)) ?? slot.cells[0]
                      aoEscolherCelula(primeiraVazia)
                    }}
                    className={`flex cursor-pointer gap-2 rounded-lg p-1 text-xs leading-snug transition-colors ${
                      isSlotAtivo ? 'bg-sky-100 text-sky-950 font-bold ring-1 ring-sky-300' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <span className="font-bold text-amber-700">{slot.numero}.</span>
                    <span className={completo ? 'text-emerald-700 line-through opacity-70' : 'text-slate-900'}>
                      {slot.clue}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  )
}
