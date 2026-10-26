import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { gerarFase, lerSelecao, selecionarPalavra, type Posicao } from './puzzle'
import { configDaFase } from './wordBank'
import { TabuleiroBusca, ListaPalavras } from './TabuleiroBusca'
import { TabuleiroCruzadas } from './TabuleiroCruzadas'
import { useGameSounds } from './useGameSounds'

export interface ResultadoFase {
  pontos: number
  palavrasEncontradas: number
  totalPalavras: number
  tempoRestante: number
  completo: boolean
}

interface Props {
  modo: 'busca' | 'cruzada'
  fase: number
  /** Semente do tabuleiro — igual nos dois jogadores no modo online. */
  semente: number
  /** Prazo final em ms (epoch). Se enviado, o cronômetro fica sincronizado. */
  prazoFinal?: number | null
  /** Quando true, o jogador não pontua mais (usado no online). */
  bloqueado?: boolean
  aoConcluirFase: (resultado: ResultadoFase) => void
  aoPerderTempo: () => void
  /** Notifica o progresso atual (usado no modo online). */
  aoProgresso?: (pontos: number, palavras: number) => void
  /** Categorias opcionalmente filtradas. */
  categorias?: string[]
}

/** Pontuação de uma palavra encontrada. */
function pontosDaPalavra(palavra: string, fase: number, tempoRestante: number): number {
  return 100 + fase * 15 + palavra.length * 8 + Math.max(0, Math.min(30, tempoRestante))
}

export function ArenaDeJogo({
  modo,
  fase,
  semente,
  prazoFinal = null,
  bloqueado = false,
  aoConcluirFase,
  aoPerderTempo,
  aoProgresso,
  categorias,
}: Props) {
  const { som, mudo, alternarMudo } = useGameSounds()
  const config = useMemo(() => configDaFase(fase), [fase])

  const geracao = useMemo(
    () => gerarFase(modo, fase, config.tamanho, config.palavras, semente, categorias),
    [modo, fase, config.tamanho, config.palavras, semente, categorias],
  )

  const [pontos, setPontos] = useState(0)
  const [encontradas, setEncontradas] = useState<Set<string>>(new Set())
  const [selecao, setSelecao] = useState<Posicao[]>([])
  const [erro, setErro] = useState(0)
  const [tempoRestante, setTempoRestante] = useState(config.segundos)
  const [letras, setLetras] = useState<Record<string, string>>({})
  const [confirmadas, setConfirmadas] = useState<Set<string>>(new Set())
  const [ativa, setAtiva] = useState<Posicao | null>(null)
  const [terminou, setTerminou] = useState(false)

  const inicioRef = useRef<number>(Date.now())
  const deadlineRef = useRef<number>(Date.now() + config.segundos * 1000)
  const pontosRef = useRef(0)
  const encontradosRef = useRef<Set<string>>(new Set())
  const chamadaConclusao = useRef(false)

  // Reinicia o estado quando a fase muda.
  useEffect(() => {
    inicioRef.current = Date.now()
    deadlineRef.current = prazoFinal ?? Date.now() + config.segundos * 1000
    setPontos(0)
    pontosRef.current = 0
    encontradosRef.current = new Set()
    setEncontradas(new Set())
    setSelecao([])
    setLetras({})
    setConfirmadas(new Set())
    setAtiva(null)
    setTerminou(false)
    chamadaConclusao.current = false
  }, [fase, config.segundos, prazoFinal, semente])

  // Cronômetro.
  useEffect(() => {
    if (terminou) return
    const intervalo = window.setInterval(() => {
      const restante = Math.max(0, (deadlineRef.current - Date.now()) / 1000)
      setTempoRestante(restante)
      if (restante <= 0 && !chamadaConclusao.current) {
        chamadaConclusao.current = true
        setTerminou(true)
        som('derrota')
        aoPerderTempo()
      } else if (restante <= 10 && restante % 1 < 0.25) {
        som('tique')
      }
    }, 250)
    return () => window.clearInterval(intervalo)
  }, [terminou, aoPerderTempo, som])

  // Notifica o progresso (modo online).
  useEffect(() => {
    aoProgresso?.(pontos, encontradas.size)
  }, [aoProgresso, encontradas.size, pontos])

  // ---------------------------------------------------------------
  // Caça-palavras
  // ---------------------------------------------------------------
  const tabuleiroBusca = geracao.tabuleiroBusca

  const registrarAcertoBusca = useCallback(
    (palavra: string) => {
      const ganho = pontosDaPalavra(palavra, fase, Math.floor(tempoRestante))
      pontosRef.current += ganho
      setPontos(pontosRef.current)
      const novo = new Set(encontradosRef.current)
      novo.add(palavra)
      encontradosRef.current = novo
      setEncontradas(novo)
      som('acerto')
    },
    [fase, som, tempoRestante],
  )

  const concluirSelecao = useCallback(
    (cells: Posicao[]) => {
      if (!tabuleiroBusca || bloqueado || (terminou || chamadaConclusao.current)) return
      if (cells.length <= 1) return

      const texto = cells.map((p) => tabuleiroBusca.grid[p.r]?.[p.c] ?? '').join('')
      const restantes = tabuleiroBusca.colocacoes.filter(
        (colocacao) => !encontradosRef.current.has(colocacao.word),
      )
      const resultado = selecionarPalavra({ texto, cells }, restantes)

      if (resultado.correta && resultado.colocacao) {
        registrarAcertoBusca(resultado.colocacao.word)
        setSelecao([])
        if (encontradosRef.current.size >= tabuleiroBusca.colocacoes.length) {
          concluirFase(true)
        }
      } else {
        setErro((v) => v + 1)
        som('erro')
        window.setTimeout(() => setSelecao([]), 350)
      }
    },
    [bloqueado, tabuleiroBusca, registrarAcertoBusca, som, terminou],
  )

  // ---------------------------------------------------------------
  // Palavras cruzadas
  // ---------------------------------------------------------------
  const tabuleiroCruzadas = geracao.tabuleiroCruzadas

  const slotDaCasa = useCallback(
    (pos: Posicao) =>
      tabuleiroCruzadas?.slots.find((slot) =>
        slot.cells.some((cell) => cell.r === pos.r && cell.c === pos.c),
      ) ?? null,
    [tabuleiroCruzadas],
  )

  const avancarNaPalavra = useCallback(
    (pos: Posicao, direcao: 'proximo' | 'anterior') => {
      const slot = slotDaCasa(pos)
      if (!slot) return pos
      const indice = slot.cells.findIndex((cell) => cell.r === pos.r && cell.c === pos.c)
      const novoIndice = direcao === 'proximo' ? indice + 1 : indice - 1
      if (novoIndice < 0 || novoIndice >= slot.cells.length) return pos
      return slot.cells[novoIndice]
    },
    [slotDaCasa],
  )

  const mover = useCallback(
    (direcao: 'cima' | 'baixo' | 'esquerda' | 'direita') => {
      if (!ativa || !tabuleiroCruzadas) return
      const dentroDaPalavra =
        direcao === 'cima' ||
        direcao === 'baixo'
          ? slotDaCasa(ativa)?.direcao === 'V'
          : slotDaCasa(ativa)?.direcao === 'H'

      if (dentroDaPalavra) {
        setAtiva(avancarNaPalavra(ativa, direcao === 'baixo' || direcao === 'direita' ? 'proximo' : 'anterior'))
        return
      }

      // Fora da palavra ativa: anda uma casa no tabuleiro, pulando casas pretas.
      const passos =
        direcao === 'cima' ? [-1, 0] : direcao === 'baixo' ? [1, 0] : direcao === 'esquerda' ? [0, -1] : [0, 1]
      let r = ativa.r + passos[0]
      let c = ativa.c + passos[1]
      for (let i = 0; i < tabuleiroCruzadas.tamanho; i++) {
        if (r < 0 || r >= tabuleiroCruzadas.tamanho || c < 0 || c >= tabuleiroCruzadas.tamanho) break
        if (tabuleiroCruzadas.grid[r][c] !== null) {
          setAtiva({ r, c })
          break
        }
        r += passos[0]
        c += passos[1]
      }
    },
    [ativa, slotDaCasa, avancarNaPalavra, tabuleiroCruzadas],
  )

  const digitar = useCallback(
    (letra: string) => {
      if (!ativa || !tabuleiroCruzadas || bloqueado || terminou) return
      const chave = `${ativa.r}:${ativa.c}`
      const correta = tabuleiroCruzadas.grid[ativa.r][ativa.c]
      setLetras((prev) => ({ ...prev, [chave]: letra }))

      if (letra === correta) {
        setConfirmadas((prev) => new Set(prev).add(chave))
        som('acerto')
      } else {
        som('erro')
        setErro((v) => v + 1)
      }
      setAtiva(avancarNaPalavra(ativa, 'proximo'))
    },
    [ativa, avancarNaPalavra, bloqueado, som, tabuleiroCruzadas, terminou],
  )

  const apagar = useCallback(() => {
    if (!ativa) return
    const chave = `${ativa.r}:${ativa.c}`
    setLetras((prev) => {
      const novo = { ...prev }
      delete novo[chave]
      return novo
    })
    setConfirmadas((prev) => {
      const novo = new Set(prev)
      novo.delete(chave)
      return novo
    })
  }, [ativa])

  // Detecta slots completos (palavras cruzadas resolvidas).
  useEffect(() => {
    if (modo !== 'cruzada' || !tabuleiroCruzadas || terminou) return
    const completos = tabuleiroCruzadas.slots.filter((slot) =>
      slot.cells.every((cell) => confirmadas.has(`${cell.r}:${cell.c}`)),
    )
    for (const slot of completos) {
      if (!encontradosRef.current.has(slot.word)) {
        const ganho = pontosDaPalavra(slot.word, fase, Math.floor(tempoRestante))
        pontosRef.current += ganho
        setPontos(pontosRef.current)
        const novo = new Set(encontradosRef.current)
        novo.add(slot.word)
        encontradosRef.current = novo
        setEncontradas(novo)
        som('acerto')
      }
    }
    if (encontradosRef.current.size >= tabuleiroCruzadas.slots.length && tabuleiroCruzadas.slots.length > 0) {
      concluirFase(true)
    }
  }, [confirmadas, modo, tabuleiroCruzadas, fase, tempoRestante, som])

  // ---------------------------------------------------------------
  function terminatedGuard() {
    return terminou || chamadaConclusao.current
  }

  function concluirFase(completo: boolean) {
    if (chamadaConclusao.current) return
    chamadaConclusao.current = true
    setTerminou(true)
    aoConcluirFase({
      pontos: pontosRef.current,
      palavrasEncontradas: encontradosRef.current.size,
      totalPalavras:
        modo === 'busca' ? tabuleiroBusca?.colocacoes.length ?? 0 : tabuleiroCruzadas?.slots.length ?? 0,
      tempoRestante: Math.floor(tempoRestante),
      completo,
    })
  }

  const tempo = Math.ceil(tempoRestante)
  const tempoCritico = tempo <= 10

  return (
    <div className="space-y-4">
      {/* HUD */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 shadow-inner">
          <span className="block text-[0.6rem] font-bold uppercase tracking-wider text-slate-400">Fase</span>
          <span className="text-lg font-black text-white">{fase}</span>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 shadow-inner">
          <span className="block text-[0.6rem] font-bold uppercase tracking-wider text-slate-400">Nível</span>
          <span className="text-lg font-black text-emerald-400">{config.nivel}</span>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 shadow-inner">
          <span className="block text-[0.6rem] font-bold uppercase tracking-wider text-slate-400">Pontos</span>
          <span className="text-lg font-black tabular-nums text-amber-400">{pontos}</span>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 shadow-inner">
          <span className="block text-[0.6rem] font-bold uppercase tracking-wider text-slate-400">Palavras</span>
          <span className="text-lg font-black tabular-nums text-white">
            {encontradas.size}/{modo === 'busca' ? tabuleiroBusca?.colocacoes.length : tabuleiroCruzadas?.slots.length}
          </span>
        </div>
        <div
          className={`rounded-xl border px-3 py-2 transition-colors shadow-inner ${
            tempoCritico
              ? 'border-red-500/70 bg-red-500/20 animate-pulse'
              : 'border-white/10 bg-slate-900/70'
          }`}
        >
          <span className="block text-[0.6rem] font-bold uppercase tracking-wider text-slate-400">Tempo</span>
          <span
            className={`text-lg font-black tabular-nums ${tempoCritico ? 'text-red-400' : 'text-white'}`}
          >
            {String(Math.floor(tempo / 60)).padStart(2, '0')}:{String(tempo % 60).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Barra de progresso das palavras */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-stroke/40">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-500"
          style={{
            width: `${
              ((modo === 'busca' ? tabuleiroBusca?.colocacoes.length : tabuleiroCruzadas?.slots.length) ?? 1) > 0
                ? (encontradas.size /
                    ((modo === 'busca' ? tabuleiroBusca?.colocacoes.length : tabuleiroCruzadas?.slots.length) ?? 1)) *
                  100
                : 0
            }%`,
          }}
        />
      </div>

      {modo === 'busca' && tabuleiroBusca ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div key={`${fase}-${semente}`} className={erro ? 'animate-[shake_0.4s_ease-in-out]' : ''}>
            <TabuleiroBusca
              tabuleiro={tabuleiroBusca}
              encontradas={encontradas}
              aoSelecionar={setSelecao}
              aoConcluir={concluirSelecao}
            />
          </div>
          <aside className="space-y-3">
            <div className="max-h-[26rem] overflow-y-auto pr-1">
              <ListaPalavras colocacoes={tabuleiroBusca.colocacoes} encontradas={encontradas} />
            </div>
          </aside>
        </div>
      ) : null}

      {modo === 'cruzada' && tabuleiroCruzadas ? (
        <div key={`${fase}-${semente}`} className={erro ? 'animate-[shake_0.4s_ease-in-out]' : ''}>
          <TabuleiroCruzadas
            tabuleiro={tabuleiroCruzadas}
            letras={letras}
            confirmadas={confirmadas}
            ativa={ativa}
            aoEscolherCelula={(pos) => {
              setAtiva(pos)
              som('clique')
            }}
            aoDigitar={digitar}
            aoApagar={apagar}
            aoMover={mover}
          />
        </div>
      ) : null}
    </div>
  )
}
