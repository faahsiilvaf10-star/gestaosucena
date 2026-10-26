import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { gerarFase, lerSelecao, selecionarPalavra, type Posicao } from './puzzle'
import { configDaFase } from './wordBank'
import { TabuleiroBusca, ListaPalavras } from './TabuleiroBusca'
import { TabuleiroCruzadas } from './TabuleiroCruzadas'
import { useGameSounds } from './useGameSounds'
import Pause from 'lucide-react/dist/esm/icons/pause.js'
import Play from 'lucide-react/dist/esm/icons/play.js'
import Save from 'lucide-react/dist/esm/icons/save.js'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw.js'

export interface ResultadoFase {
  pontos: number
  palavrasEncontradas: number
  totalPalavras: number
  tempoRestante: number
  completo: boolean
}

export interface SnapshotFase {
  tempoRestante: number
  encontradas: string[]
  pontosFase: number
  letras?: Record<string, string>
  confirmadas?: string[]
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

  // Suporte a restauração de jogo salvo
  tempoInicial?: number
  palavrasIniciais?: string[]
  pontosIniciais?: number
  letrasIniciais?: Record<string, string>
  confirmadasIniciais?: string[]

  // Pausa e salvamento
  pausadoInicial?: boolean
  aoPausar?: () => void
  aoRetomar?: () => void
  aoSalvarSair?: (snapshot: SnapshotFase) => void
  aoReiniciar?: () => void
  aoAtualizarEstado?: (snapshot: SnapshotFase) => void
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
  tempoInicial,
  palavrasIniciais,
  pontosIniciais,
  letrasIniciais,
  confirmadasIniciais,
  pausadoInicial = false,
  aoPausar,
  aoRetomar,
  aoSalvarSair,
  aoReiniciar,
  aoAtualizarEstado,
}: Props) {
  const { som, mudo, alternarMudo } = useGameSounds()
  const config = useMemo(() => configDaFase(fase), [fase])

  const geracao = useMemo(
    () => gerarFase(modo, fase, config.tamanho, config.palavras, semente, categorias),
    [modo, fase, config.tamanho, config.palavras, semente, categorias],
  )

  const tabuleiroCruzadas = geracao.tabuleiroCruzadas
  const dicasIniciais = useMemo(
    () => tabuleiroCruzadas?.dicasIniciais ?? {},
    [tabuleiroCruzadas],
  )

  const [pontos, setPontos] = useState(pontosIniciais ?? 0)
  const [encontradas, setEncontradas] = useState<Set<string>>(new Set(palavrasIniciais ?? []))
  const [selecao, setSelecao] = useState<Posicao[]>([])
  const [erro, setErro] = useState(0)
  const [tempoRestante, setTempoRestante] = useState(tempoInicial ?? config.segundos)
  const [letras, setLetras] = useState<Record<string, string>>(() => ({
    ...(geracao.tabuleiroCruzadas?.dicasIniciais ?? {}),
    ...(letrasIniciais ?? {}),
  }))
  const [confirmadas, setConfirmadas] = useState<Set<string>>(() => {
    const dicas = Object.keys(geracao.tabuleiroCruzadas?.dicasIniciais ?? {})
    return new Set([...dicas, ...(confirmadasIniciais ?? [])])
  })
  const [ativa, setAtiva] = useState<Posicao | null>(() => {
    if (modo === 'cruzada' && geracao.tabuleiroCruzadas?.slots[0]) {
      const primeiroSlot = geracao.tabuleiroCruzadas.slots[0]
      const dicas = geracao.tabuleiroCruzadas.dicasIniciais ?? {}
      return primeiroSlot.cells.find((c) => !dicas[`${c.r}:${c.c}`]) ?? primeiroSlot.cells[0]
    }
    return null
  })
  const [terminou, setTerminou] = useState(false)
  const [pausado, setPausado] = useState(pausadoInicial)

  const tempoPausadoRef = useRef(tempoInicial ?? config.segundos)
  const inicioRef = useRef<number>(Date.now())
  const deadlineRef = useRef<number>(Date.now() + (tempoInicial ?? config.segundos) * 1000)
  const pontosRef = useRef(pontosIniciais ?? 0)
  const encontradosRef = useRef<Set<string>>(new Set(palavrasIniciais ?? []))
  const chamadaConclusao = useRef(false)

  const obterSnapshot = useCallback((): SnapshotFase => ({
    tempoRestante: Math.max(1, Math.round(tempoPausadoRef.current)),
    encontradas: Array.from(encontradosRef.current),
    pontosFase: pontosRef.current,
    letras: modo === 'cruzada' ? letras : undefined,
    confirmadas: modo === 'cruzada' ? Array.from(confirmadas) : undefined,
  }), [confirmadas, letras, modo])

  // Pausar o jogo (congelar cronômetro)
  const pausarJogo = useCallback(() => {
    if (terminou || pausado) return
    const restante = Math.max(0, (deadlineRef.current - Date.now()) / 1000)
    tempoPausadoRef.current = restante
    setTempoRestante(restante)
    setPausado(true)
    som('clique')
    aoPausar?.()
    aoAtualizarEstado?.(obterSnapshot())
  }, [aoAtualizarEstado, aoPausar, obterSnapshot, pausado, som, terminou])

  // Retomar o jogo (descongelar cronômetro)
  const retomarJogo = useCallback(() => {
    if (!pausado) return
    deadlineRef.current = Date.now() + tempoPausadoRef.current * 1000
    setPausado(false)
    som('clique')
    aoRetomar?.()
  }, [aoRetomar, pausado, som])

  // Reinicia ou ajusta o estado quando a fase/semente muda
  useEffect(() => {
    inicioRef.current = Date.now()
    const segundosFase = tempoInicial ?? config.segundos
    deadlineRef.current = prazoFinal ?? Date.now() + segundosFase * 1000
    tempoPausadoRef.current = segundosFase
    setTempoRestante(segundosFase)
    setPontos(pontosIniciais ?? 0)
    pontosRef.current = pontosIniciais ?? 0
    encontradosRef.current = new Set(palavrasIniciais ?? [])
    setEncontradas(new Set(palavrasIniciais ?? []))
    setSelecao([])

    const dicas = geracao.tabuleiroCruzadas?.dicasIniciais ?? {}
    setLetras({ ...dicas, ...(letrasIniciais ?? {}) })
    setConfirmadas(new Set([...Object.keys(dicas), ...(confirmadasIniciais ?? [])]))

    if (modo === 'cruzada' && geracao.tabuleiroCruzadas?.slots[0]) {
      const primeiroSlot = geracao.tabuleiroCruzadas.slots[0]
      const primeiraVazia = primeiroSlot.cells.find((c) => !dicas[`${c.r}:${c.c}`]) ?? primeiroSlot.cells[0]
      setAtiva(primeiraVazia)
    } else {
      setAtiva(null)
    }

    setTerminou(false)
    setPausado(pausadoInicial)
    chamadaConclusao.current = false
  }, [fase, config.segundos, prazoFinal, semente, geracao, modo, letrasIniciais, confirmadasIniciais, palavrasIniciais, pontosIniciais, tempoInicial, pausadoInicial])

  // Cronômetro com suporte a pausa
  useEffect(() => {
    if (terminou || pausado) return
    const intervalo = window.setInterval(() => {
      const restante = Math.max(0, (deadlineRef.current - Date.now()) / 1000)
      tempoPausadoRef.current = restante
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
  }, [terminou, pausado, aoPerderTempo, som])

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
      aoAtualizarEstado?.({
        tempoRestante: Math.max(1, Math.round(tempoPausadoRef.current)),
        encontradas: Array.from(novo),
        pontosFase: pontosRef.current,
      })
    },
    [aoAtualizarEstado, fase, som, tempoRestante],
  )

  const concluirSelecao = useCallback(
    (cells: Posicao[]) => {
      if (!tabuleiroBusca || bloqueado || pausado || (terminou || chamadaConclusao.current)) return
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
    [bloqueado, pausado, tabuleiroBusca, registrarAcertoBusca, som, terminou],
  )

  // ---------------------------------------------------------------
  // Palavras cruzadas
  // ---------------------------------------------------------------
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

  const proximaCasaVazia = useCallback(
    (pos: Posicao) => {
      const slot = slotDaCasa(pos)
      if (!slot) return pos
      const indice = slot.cells.findIndex((cell) => cell.r === pos.r && cell.c === pos.c)
      // 1. Procura a próxima casa no mesmo slot que não seja dica e não esteja confirmada
      for (let i = indice + 1; i < slot.cells.length; i++) {
        const c = slot.cells[i]
        const k = `${c.r}:${c.c}`
        if (!dicasIniciais[k] && !confirmadas.has(k)) {
          return c
        }
      }
      // 2. Se não encontrou depois do cursor, busca se há alguma casa anterior vazia
      for (let i = 0; i < indice; i++) {
        const c = slot.cells[i]
        const k = `${c.r}:${c.c}`
        if (!dicasIniciais[k] && !confirmadas.has(k)) {
          return c
        }
      }
      // 3. Se todas as casas deste slot já estão preenchidas/confirmadas, vai para a próxima casa normal do slot se existir
      if (indice + 1 < slot.cells.length) {
        return slot.cells[indice + 1]
      }
      return pos
    },
    [confirmadas, dicasIniciais, slotDaCasa],
  )

  const mover = useCallback(
    (direcao: 'cima' | 'baixo' | 'esquerda' | 'direita') => {
      if (!ativa || !tabuleiroCruzadas || pausado) return
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
    [ativa, slotDaCasa, avancarNaPalavra, tabuleiroCruzadas, pausado],
  )

  const digitar = useCallback(
    (letra: string) => {
      if (!ativa || !tabuleiroCruzadas || bloqueado || pausado || (terminou || chamadaConclusao.current)) return
      const chave = `${ativa.r}:${ativa.c}`
      const correta = tabuleiroCruzadas.grid[ativa.r][ativa.c]
      const ehDica = Boolean(dicasIniciais[chave])

      if (ehDica) {
        // Se a casa já é uma dica inicial, mantém intacta e avança para a próxima casa a preencher
        setAtiva(proximaCasaVazia(ativa))
        return
      }

      setLetras((prev) => ({ ...prev, [chave]: letra }))

      if (letra === correta) {
        setConfirmadas((prev) => new Set(prev).add(chave))
        som('acerto')
      } else {
        som('erro')
        setErro((v) => v + 1)
      }

      setAtiva(proximaCasaVazia(ativa))
    },
    [ativa, tabuleiroCruzadas, bloqueado, pausado, terminou, dicasIniciais, proximaCasaVazia, som],
  )

  const apagar = useCallback(() => {
    if (!ativa || pausado || (terminou || chamadaConclusao.current)) return
    const chave = `${ativa.r}:${ativa.c}`

    // Se a casa atual é uma dica inicial, não apaga a dica, apenas recua
    if (dicasIniciais[chave]) {
      const anterior = avancarNaPalavra(ativa, 'anterior')
      if (anterior.r !== ativa.r || anterior.c !== ativa.c) {
        setAtiva(anterior)
      }
      return
    }

    // Se tem letra digitada pelo jogador na casa atual, apaga ela
    if (letras[chave]) {
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
      return
    }

    // Se já estava vazia, recua para a anterior e apaga se não for dica
    const anterior = avancarNaPalavra(ativa, 'anterior')
    if (anterior.r !== ativa.r || anterior.c !== ativa.c) {
      const chaveAnt = `${anterior.r}:${anterior.c}`
      if (!dicasIniciais[chaveAnt]) {
        setLetras((prev) => {
          const novo = { ...prev }
          delete novo[chaveAnt]
          return novo
        })
        setConfirmadas((prev) => {
          const novo = new Set(prev)
          novo.delete(chaveAnt)
          return novo
        })
      }
      setAtiva(anterior)
    }
  }, [ativa, pausado, terminou, dicasIniciais, letras, avancarNaPalavra])

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
        aoAtualizarEstado?.({
          tempoRestante: Math.max(1, Math.round(tempoPausadoRef.current)),
          encontradas: Array.from(novo),
          pontosFase: pontosRef.current,
          letras,
          confirmadas: Array.from(confirmadas),
        })
      }
    }
    if (encontradosRef.current.size >= tabuleiroCruzadas.slots.length && tabuleiroCruzadas.slots.length > 0) {
      concluirFase(true)
    }
  }, [confirmadas, modo, tabuleiroCruzadas, fase, tempoRestante, som, aoAtualizarEstado, letras])

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
    <div className="relative space-y-4">
      {/* HUD Superior */}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 sm:gap-2">
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-2 sm:px-3 sm:py-2 shadow-inner">
          <span className="block text-[0.55rem] sm:text-[0.6rem] font-bold uppercase tracking-wider text-slate-400">Fase</span>
          <span className="text-sm sm:text-lg font-black text-white">{fase}</span>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-2 sm:px-3 sm:py-2 shadow-inner">
          <span className="block text-[0.55rem] sm:text-[0.6rem] font-bold uppercase tracking-wider text-slate-400">Nível</span>
          <span className="text-sm sm:text-lg font-black text-emerald-400">{config.nivel}</span>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-2 sm:px-3 sm:py-2 shadow-inner">
          <span className="block text-[0.55rem] sm:text-[0.6rem] font-bold uppercase tracking-wider text-slate-400">Pontos</span>
          <span className="text-sm sm:text-lg font-black tabular-nums text-amber-400">{pontos}</span>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-2 sm:px-3 sm:py-2 shadow-inner">
          <span className="block text-[0.55rem] sm:text-[0.6rem] font-bold uppercase tracking-wider text-slate-400">Palavras</span>
          <span className="text-sm sm:text-lg font-black tabular-nums text-white">
            {encontradas.size}/{modo === 'busca' ? tabuleiroBusca?.colocacoes.length : tabuleiroCruzadas?.slots.length}
          </span>
        </div>
        <div
          className={`rounded-xl border p-2 sm:px-3 sm:py-2 transition-colors shadow-inner ${
            tempoCritico
              ? 'border-red-500/70 bg-red-500/20 animate-pulse'
              : 'border-white/10 bg-slate-900/70'
          }`}
        >
          <span className="block text-[0.55rem] sm:text-[0.6rem] font-bold uppercase tracking-wider text-slate-400">Tempo</span>
          <span
            className={`text-sm sm:text-lg font-black tabular-nums ${tempoCritico ? 'text-red-400' : 'text-white'}`}
          >
            {String(Math.floor(tempo / 60)).padStart(2, '0')}:{String(tempo % 60).padStart(2, '0')}
          </span>
        </div>

        {/* Botão Pausar e Salvar */}
        <button
          type="button"
          onClick={pausarJogo}
          title="Pausar jogo e congelar tempo"
          className="flex flex-col justify-center rounded-xl border border-white/10 bg-slate-900/70 p-2 sm:px-3 sm:py-2 text-left transition-all hover:border-amber-400/50 hover:bg-amber-500/15 group shadow-inner"
        >
          <span className="block text-[0.55rem] sm:text-[0.6rem] font-bold uppercase tracking-wider text-slate-400 group-hover:text-amber-300">
            Controle
          </span>
          <span className="flex items-center gap-1 text-xs sm:text-sm font-black text-white group-hover:text-amber-300">
            <Pause className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            Pausar
          </span>
        </button>
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
              if (pausado) return
              setAtiva(pos)
              som('clique')
            }}
            aoDigitar={digitar}
            aoApagar={apagar}
            aoMover={mover}
          />
        </div>
      ) : null}

      {/* Modal / Overlay de Pausa */}
      {pausado && (
        <div className="absolute inset-0 z-40 flex items-center justify-center rounded-2xl bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-gradient-to-b from-[#141824] to-[#0c0e14] p-6 text-center shadow-2xl animate-[role-fade-in_0.25s_ease-out]">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/20 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
              <Pause className="h-7 w-7 fill-amber-400" />
            </div>

            <h3 className="text-xl font-black text-white">Jogo Pausado</h3>
            <p className="mt-1 text-xs text-slate-300 leading-relaxed">
              O cronômetro está congelado. Seu progresso e pontos estão seguros.
            </p>

            <div className="my-4 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left">
              <div>
                <span className="block text-[0.6rem] font-bold uppercase text-slate-400">Fase Atual</span>
                <span className="text-sm font-black text-white">Fase {fase}</span>
              </div>
              <div>
                <span className="block text-[0.6rem] font-bold uppercase text-slate-400">Tempo Congelado</span>
                <span className="text-sm font-black tabular-nums text-amber-400">
                  {String(Math.floor(tempo / 60)).padStart(2, '0')}:{String(tempo % 60).padStart(2, '0')}
                </span>
              </div>
              <div>
                <span className="block text-[0.6rem] font-bold uppercase text-slate-400">Palavras Feitas</span>
                <span className="text-sm font-black text-emerald-400">
                  {encontradas.size} / {modo === 'busca' ? tabuleiroBusca?.colocacoes.length : tabuleiroCruzadas?.slots.length}
                </span>
              </div>
              <div>
                <span className="block text-[0.6rem] font-bold uppercase text-slate-400">Pontos da Fase</span>
                <span className="text-sm font-black text-amber-400">+{pontos} pts</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={retomarJogo}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/30 transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Play className="h-4 w-4 fill-white" />
                Continuar Jogando
              </button>

              <button
                type="button"
                onClick={() => aoSalvarSair?.(obterSnapshot())}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] py-2.5 text-xs font-bold text-slate-200 transition-colors hover:bg-white/[0.12] hover:text-white"
              >
                <Save className="h-3.5 w-3.5 text-amber-400" />
                Salvar e Sair para o Menu
              </button>

              {aoReiniciar && (
                <button
                  type="button"
                  onClick={aoReiniciar}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 py-2 text-[0.72rem] font-semibold text-red-300 transition-colors hover:bg-red-500/20"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reiniciar Fase do Zero
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
