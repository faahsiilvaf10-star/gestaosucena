import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Users from 'lucide-react/dist/esm/icons/users.js'
import Swords from 'lucide-react/dist/esm/icons/swords.js'
import Hourglass from 'lucide-react/dist/esm/icons/hourglass.js'
import CircleCheck from 'lucide-react/dist/esm/icons/circle-check.js'
import { supabase } from '../../lib/supabase'
import {
  atualizarPartida,
  criarPartida,
  entrarPartida,
  listarJogadoresOnline,
  listarJogadoresPartida,
  listarPartidasAbertas,
  marcarOffline,
  registrarPresenca,
  salvarPontuacao,
  salvarProgressoPartida,
  type JogadorOnline,
  type Partida,
} from '../../lib/cacaPalavras'
import { FASES_POR_PARTIDA_ONLINE, configDaFase } from './wordBank'
import { ArenaDeJogo, type ResultadoFase } from './ArenaDeJogo'
import { useGameSounds } from './useGameSounds'

export interface UsuarioOnline {
  id: string
  nome: string
  avatarUrl?: string | null
}

interface Props {
  user: UsuarioOnline
  modo: 'busca' | 'cruzada'
  aoSair: () => void
}

type Tela = 'lobby' | 'sala' | 'jogo' | 'resultado'

interface Convite {
  codigo: string
  hostId: string
  hostNome: string
  semente: number
  modo: 'busca' | 'cruzada'
}

interface Progresso {
  pontos: number
  palavras: number
}

const CANAL_LOBBY = 'caca_palavras_lobby'

function canalDaPartida(codigo: string) {
  return supabase.channel(`caca_palavras_partida_${codigo}`, {
    config: { broadcast: { self: false } },
  })
}

export function PainelOnline({ user, modo, aoSair }: Props) {
  const { som } = useGameSounds()

  const [tela, setTela] = useState<Tela>('lobby')
  const [jogadores, setJogadores] = useState<JogadorOnline[]>([])
  const [presentes, setPresentes] = useState<JogadorOnline[]>([])
  const [partidasAbertas, setPartidasAbertas] = useState<Partida[]>([])
  const [convites, setConvites] = useState<Convite[]>([])
  const [partida, setPartida] = useState<Partida | null>(null)
  const [codigoDigitado, setCodigoDigitado] = useState('')
  const [mensagem, setMensagem] = useState<string | null>(null)

  // Estado da partida em andamento
  const [fase, setFase] = useState(1)
  const [prazoFinal, setPrazoFinal] = useState<number | null>(null)
  const [meuProgresso, setMeuProgresso] = useState<Progresso>({ pontos: 0, palavras: 0 })
  const [oponenteProgresso, setOponenteProgresso] = useState<Progresso>({ pontos: 0, palavras: 0 })
  const [meuTotal, setMeuTotal] = useState(0)
  const [oponenteTotal, setOponenteTotal] = useState(0)
  const [minhaFaseCompleta, setMinhaFaseCompleta] = useState(false)
  const [faseEu, setFaseEu] = useState<number | null>(null)
  const [faseOponente, setFaseOponente] = useState<number | null>(null)
  const [oponente, setOponente] = useState<{ id: string; nome: string } | null>(null)
  const [vencedor, setVencedor] = useState<'eu' | 'oponente' | 'empate' | null>(null)

  const canalPartidaRef = useRef<ReturnType<typeof canalDaPartida> | null>(null)
  const partidaRef = useRef<Partida | null>(null)
  const faseRef = useRef(1)
  const euFinalRef = useRef(0)
  const oponenteFinalRef = useRef(0)
  const minhaFaseCompletaRef = useRef(false)
  const salvoRef = useRef(false)
  const iniciadoRef = useRef(false)

  useEffect(() => {
    partidaRef.current = partida
  }, [partida])
  useEffect(() => {
    faseRef.current = fase
  }, [fase])
  useEffect(() => {
    minhaFaseCompletaRef.current = minhaFaseCompleta
  }, [minhaFaseCompleta])

  // ---------------------------------------------------------------
  // Presença e lobby
  // ---------------------------------------------------------------
  useEffect(() => {
    void registrarPresenca(user.id, user.nome, user.avatarUrl)

    const canal = supabase.channel(CANAL_LOBBY, { config: { broadcast: { self: false } } })
    canal.on('broadcast', { event: 'presenca' }, ({ payload }) => {
      const dados = payload as { user_id: string; nome: string; avatar_url?: string | null }
      setPresentes((atuais) => {
        const semEle = atuais.filter((j) => j.user_id !== dados.user_id)
        return [
          { user_id: dados.user_id, user_name: dados.nome, avatar_url: dados.avatar_url ?? null, online: true, pontos: 0 },
          ...semEle,
        ]
      })
    })
    canal.on('broadcast', { event: 'convite' }, ({ payload }) => {
      const dados = payload as Convite
      if (dados.hostId === user.id) return
      setConvites((atuais) => {
        if (atuais.some((c) => c.codigo === dados.codigo)) return atuais
        return [...atuais, dados]
      })
    })
    void canal.subscribe()

    const intervalo = window.setInterval(async () => {
      const [lista, partidas] = await Promise.all([listarJogadoresOnline(), listarPartidasAbertas()])
      setJogadores(lista.filter((j) => j.user_id !== user.id))
      setPartidasAbertas(partidas.filter((p) => p.host_id !== user.id))
    }, 5000)

    return () => {
      window.clearInterval(intervalo)
      void supabase.removeChannel(canal)
      void marcarOffline(user.id)
    }
  }, [user.id, user.nome, user.avatarUrl])

  // Presença anunciada no lobby.
  useEffect(() => {
    const canal = supabase.channel(CANAL_LOBBY)
    canal.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void canal.send({
          type: 'broadcast',
          event: 'presenca',
          payload: { user_id: user.id, nome: user.nome, avatar_url: user.avatarUrl ?? null },
        })
      }
    })
    return () => {
      void supabase.removeChannel(canal)
    }
  }, [user.id, user.nome, user.avatarUrl])

  // ---------------------------------------------------------------
  // Canal da partida
  // ---------------------------------------------------------------
  const enviar = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      const canal = canalPartidaRef.current
      if (!canal) return
      void canal.send({ type: 'broadcast', event, payload })
    },
    [],
  )

  const iniciarFase = useCallback(
    (novaFase: number, prazo: number, semente: number) => {
      setFase(novaFase)
      setPrazoFinal(prazo)
      setMeuProgresso({ pontos: 0, palavras: 0 })
      setOponenteProgresso({ pontos: 0, palavras: 0 })
      setFaseEu(null)
      setFaseOponente(null)
      setMinhaFaseCompleta(false)
      minhaFaseCompletaRef.current = false
      setTela('jogo')
      void semente
    },
    [],
  )

  const finalizarPartida = useCallback(
    (meu: number, dele: number) => {
      if (salvoRef.current) return
      salvoRef.current = true
      const venceu = meu > dele
      setVencedor(venceu ? 'eu' : dele > meu ? 'oponente' : 'empate')
      setMeuTotal(meu)
      setOponenteTotal(dele)
      setTela('resultado')
      som(venceu ? 'vitoriaFinal' : 'derrota')

      void salvarPontuacao({
        user_id: user.id,
        user_name: user.nome,
        avatar_url: user.avatarUrl ?? null,
        modo: 'online',
        fase: FASES_POR_PARTIDA_ONLINE,
        nivel: FASES_POR_PARTIDA_ONLINE,
        score: meu,
        tempo_ms: 0,
        palavras_found: 0,
        total_palavras: 0,
        vitoria: venceu,
      })
    },
    [som, user.avatarUrl, user.id, user.nome],
  )

  const subscreverPartida = useCallback(
    (codigo: string) => {
      if (canalPartidaRef.current) {
        void supabase.removeChannel(canalPartidaRef.current)
      }
      const canal = canalDaPartida(codigo)
      canalPartidaRef.current = canal

      canal.on('broadcast', { event: 'entrou' }, ({ payload }) => {
        const dados = payload as { user_id: string; nome: string }
        if (dados.user_id === user.id) return
        setOponente({ id: dados.user_id, nome: dados.nome })
        // Quem criou o desafio começa a partida assim que o outro entra.
        if (partidaRef.current?.host_id === user.id && !iniciadoRef.current) {
          iniciadoRef.current = true
          const duracao = configDaFase(1).segundos
          const prazo = Date.now() + duracao * 1000
          canal.send({
            type: 'broadcast',
            event: 'inicio',
            payload: { prazo, semente: partidaRef.current?.semente ?? 0, fase: 1, host_nome: user.nome },
          })
          iniciarFase(1, prazo, partidaRef.current?.semente ?? 0)
        }
      })

      canal.on('broadcast', { event: 'inicio' }, ({ payload }) => {
        const dados = payload as { prazo: number; semente: number; fase: number; host_nome?: string }
        if (dados.host_nome) setOponente({ id: '', nome: dados.host_nome })
        iniciadoRef.current = true
        iniciarFase(dados.fase ?? 1, dados.prazo, dados.semente)
      })

      canal.on('broadcast', { event: 'proxima_fase' }, ({ payload }) => {
        const dados = payload as { prazo: number; semente: number; fase: number }
        iniciarFase(dados.fase, dados.prazo, dados.semente)
      })

      canal.on('broadcast', { event: 'progresso' }, ({ payload }) => {
        const dados = payload as { pontos: number; palavras: number }
        setOponenteProgresso({ pontos: dados.pontos, palavras: dados.palavras })
      })

      canal.on('broadcast', { event: 'fase_fim' }, ({ payload }) => {
        const dados = payload as { pontos: number; fase: number }
        if (dados.fase !== faseRef.current) return
        setFaseOponente(dados.pontos)
        // Se eu ainda não terminei a fase, encerro com o que já conquistei.
        if (!minhaFaseCompletaRef.current) {
          setMinhaFaseCompleta(false)
          setFaseEu((valorAtual) => valorAtual)
        }
      })

      canal.on('broadcast', { event: 'fim' }, ({ payload }) => {
        const dados = payload as { pontos_eu: number; pontos_oponente: number }
        finalizarPartida(dados.pontos_eu, dados.pontos_oponente)
      })

      void canal.subscribe()
    },
    [finalizarPartida, iniciarFase, user.id],
  )

  useEffect(() => {
    return () => {
      if (canalPartidaRef.current) {
        void supabase.removeChannel(canalPartidaRef.current)
        canalPartidaRef.current = null
      }
    }
  }, [])

  // ---------------------------------------------------------------
  // Criar / entrar
  // ---------------------------------------------------------------
  const criarDesafio = useCallback(async () => {
    setMensagem(null)
    const semente = Math.floor(Math.random() * 1_000_000_000)
    const criada = await criarPartida(user.id, modo, semente)
    setPartida(criada)
    subscreverPartida(criada.codigo)
    setTela('sala')
    som('entrada')
  }, [modo, som, subscreverPartida, user.id])

  const entrarNoDesafio = useCallback(
    async (codigo: string, dados?: Partial<Convite>) => {
      setMensagem(null)
      let partidaAtual = partidaRef.current
      if (!partidaAtual) {
        const existentes = await listarPartidasAbertas()
        const encontrada = existentes.find((p) => p.codigo.toUpperCase() === codigo.toUpperCase())
        partidaAtual = encontrada ?? null
      }

      if (partidaAtual) {
        await entrarPartida(partidaAtual, user.id, user.nome)
        setPartida(partidaAtual)
        subscreverPartida(partidaAtual.codigo)
        enviar('entrou', { user_id: user.id, nome: user.nome })
        setTela('sala')
        // Avisa o criador do desafio.
        const canalLobby = supabase.channel(CANAL_LOBBY)
        canalLobby.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            void canalLobby.send({
              type: 'broadcast',
              event: 'presenca',
              payload: { user_id: user.id, nome: user.nome, aceite: partidaAtual?.codigo },
            })
            setTimeout(() => void supabase.removeChannel(canalLobby), 2000)
          }
        })
      } else if (dados) {
        // Partida criada só via broadcast (sem tabela no banco).
        const virtual: Partida = {
          id: dados.codigo,
          codigo: dados.codigo,
          host_id: dados.hostId,
          modo: dados.modo,
          fase_atual: 1,
          semente: dados.semente,
          status: 'em_andamento',
          criado_em: new Date().toISOString(),
        }
        setPartida(virtual)
        subscreverPartida(virtual.codigo)
        enviar('entrou', { user_id: user.id, nome: user.nome })
        setTela('sala')
      } else {
        setMensagem('Código de partida não encontrado.')
      }
      som('entrada')
    },
    [enviar, som, subscreverPartida, user.id, user.nome],
  )

  // Anúncio contínuo do desafio enquanto se está na sala.
  useEffect(() => {
    if (tela !== 'sala' || !partida) return
    if (partida.host_id !== user.id) return

    const anunciar = () => {
      const canal = supabase.channel(CANAL_LOBBY)
      canal.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void canal.send({
            type: 'broadcast',
            event: 'convite',
            payload: {
              codigo: partida.codigo,
              hostId: user.id,
              hostNome: user.nome,
              semente: partida.semente,
              modo,
            } satisfies Convite,
          })
          setTimeout(() => void supabase.removeChannel(canal), 1500)
        }
      })
    }

    anunciar()
    const intervalo = window.setInterval(anunciar, 4000)
    return () => window.clearInterval(intervalo)
  }, [modo, partida, tela, user.id, user.nome])

  // Detecta a chegada do adversário (via canal da partida ou via banco).
  useEffect(() => {
    if (tela !== 'sala' || !partida) return
    iniciadoRef.current = false

    const verificar = async () => {
      if (iniciadoRef.current) return
      const jogadores = await listarJogadoresPartida(partida.id)
      const outro = jogadores.find((j) => j.user_id !== user.id)
      if (outro) {
        setOponente({ id: outro.user_id, nome: outro.user_name })
        if (partida.host_id === user.id) {
          iniciadoRef.current = true
          const duracao = configDaFase(1).segundos
          const prazo = Date.now() + duracao * 1000
          enviar('inicio', { prazo, semente: partida.semente, fase: 1, host_nome: user.nome })
          void atualizarPartida(partida.id, { status: 'em_andamento' })
          iniciarFase(1, prazo, partida.semente)
        }
      }
    }

    const intervalo = window.setInterval(() => void verificar(), 2000)
    void verificar()
    return () => window.clearInterval(intervalo)
  }, [enviar, iniciarFase, partida, tela, user.id, user.nome])

  // O convidado espera o aviso de início; se não vier, começa sozinho.
  useEffect(() => {
    if (tela !== 'sala' || !partida) return
    if (partida.host_id === user.id) return
    const duracao = configDaFase(1).segundos
    const prazo = Date.now() + duracao * 1000
    const tempo = window.setTimeout(() => {
      if (iniciadoRef.current) return
      iniciadoRef.current = true
      setOponente({ id: partida.host_id, nome: 'Anfitrião' })
      iniciarFase(1, prazo, partida.semente)
    }, 6000)
    return () => window.clearTimeout(tempo)
  }, [iniciarFase, partida, tela, user.id])

  // ---------------------------------------------------------------
  // Progresso e fim de fase
  // ---------------------------------------------------------------
  const aoProgresso = useCallback(
    (pontos: number, palavras: number) => {
      setMeuProgresso({ pontos, palavras })
      enviar('progresso', { pontos, palavras, fase: faseRef.current })
      void salvarProgressoPartida({
        match_id: partidaRef.current?.id ?? '',
        user_id: user.id,
        user_name: user.nome,
        score: pontos,
        fase: faseRef.current,
        palavras_found: palavras,
        terminou: false,
        vitorioso: false,
      })
    },
    [enviar, user.id, user.nome],
  )

  const avancarParaProximaFase = useCallback(
    (pontosEu: number, pontosOponente: number) => {
      const bonus = minhaFaseCompletaRef.current ? Math.round(pontosEu * 0.5) : 0
      const meu = euFinalRef.current + pontosEu + bonus
      const dele = oponenteFinalRef.current + pontosOponente
      euFinalRef.current = meu
      oponenteFinalRef.current = dele
      setMeuTotal(meu)
      setOponenteTotal(dele)

      if (faseRef.current >= FASES_POR_PARTIDA_ONLINE) {
        enviar('fim', { pontos_eu: meu, pontos_oponente: dele })
        finalizarPartida(meu, dele)
        return
      }

      const proxima = faseRef.current + 1
      const duracao = configDaFase(proxima).segundos
      const prazo = Date.now() + duracao * 1000
      if (partidaRef.current?.host_id === user.id) {
        enviar('proxima_fase', { fase: proxima, prazo, semente: partidaRef.current?.semente ?? 0 })
      }
      iniciarFase(proxima, prazo, partidaRef.current?.semente ?? 0)
    },
    [enviar, finalizarPartida, iniciarFase, user.id],
  )

  // Quando as duas pontuações da fase chegam, avança.
  useEffect(() => {
    if (tela !== 'jogo') return
    if (faseEu === null || faseOponente === null) return
    avancarParaProximaFase(faseEu, faseOponente)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faseEu, faseOponente, tela])

  // Se o adversário não fechar a fase em 30s, ele recebe 0.
  useEffect(() => {
    if (tela !== 'jogo') return
    if (faseOponente !== null) return
    if (faseEu === null) return
    const tempo = window.setTimeout(() => {
      setFaseOponente(0)
    }, 30000)
    return () => window.clearTimeout(tempo)
  }, [faseEu, faseOponente, tela])

  const aoConcluirFase = useCallback(
    (resultado: ResultadoFase) => {
      setMinhaFaseCompleta(true)
      minhaFaseCompletaRef.current = true
      setFaseEu(resultado.pontos)
      enviar('fase_fim', { pontos: resultado.pontos, fase: faseRef.current, user_id: user.id })
      void salvarProgressoPartida({
        match_id: partidaRef.current?.id ?? '',
        user_id: user.id,
        user_name: user.nome,
        score: euFinalRef.current + resultado.pontos,
        fase: faseRef.current,
        palavras_found: resultado.palavrasEncontradas,
        terminou: true,
        vitorioso: false,
      })
    },
    [enviar, user.id, user.nome],
  )

  const aoPerderTempo = useCallback(() => {
    // Tempo esgotado: encerra a fase com 0 e espera o adversário.
    setFaseEu(0)
    enviar('fase_fim', { pontos: 0, fase: faseRef.current, user_id: user.id })
  }, [enviar, user.id])

  const sementeAtual = useMemo(
    () => (partida?.semente ?? 0) + fase * 7919,
    [fase, partida?.semente],
  )

  /** Jogadores online vindos do banco e da presença em tempo real. */
  const jogadoresOnline = useMemo(() => {
    const mapa = new Map<string, JogadorOnline>()
    for (const jogador of [...jogadores, ...presentes]) {
      if (jogador.user_id === user.id) continue
      mapa.set(jogador.user_id, jogador)
    }
    return [...mapa.values()]
  }, [jogadores, presentes, user.id])

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  if (tela === 'jogo') {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 shadow-inner">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Você</p>
            <p className="text-lg font-black text-white">
              {meuProgresso.pontos} pts · {meuProgresso.palavras} palavras
            </p>
          </div>
          <div className="rounded-2xl border border-sky-400/40 bg-sky-400/10 p-3 shadow-inner">
            <p className="text-xs font-bold uppercase tracking-wider text-sky-300">
              {oponente?.nome ?? 'Adversário'}
            </p>
            <p className="text-lg font-black text-white">
              {oponenteProgresso.pontos} pts · {oponenteProgresso.palavras} palavras
            </p>
          </div>
        </div>

        {faseEu !== null && faseOponente === null && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/15 px-3 py-2 text-sm font-semibold text-emerald-300">
            <Hourglass className="h-4 w-4 animate-spin" /> Você fechou a fase! Aguardando o adversário…
          </div>
        )}

        <ArenaDeJogo
          key={`${fase}-${sementeAtual}`}
          modo={modo}
          fase={fase}
          semente={sementeAtual}
          prazoFinal={prazoFinal}
          bloqueado={faseEu !== null}
          aoConcluirFase={aoConcluirFase}
          aoPerderTempo={aoPerderTempo}
          aoProgresso={aoProgresso}
        />
      </div>
    )
  }

  if (tela === 'resultado') {
    const venci = vencedor === 'eu'
    return (
      <div className="space-y-4 text-center">
        <div
          className={`rounded-3xl border p-8 ${
            venci
              ? 'border-emerald-400/50 bg-emerald-400/15 shadow-[0_0_30px_rgba(16,185,129,0.2)]'
              : vencedor === 'empate'
                ? 'border-amber-400/50 bg-amber-400/15 shadow-[0_0_30px_rgba(245,158,11,0.2)]'
                : 'border-red-500/50 bg-red-500/15 shadow-[0_0_30px_rgba(239,68,68,0.2)]'
          }`}
        >
          <CircleCheck className="mx-auto mb-3 h-12 w-12 text-white" />
          <h3 className="text-2xl font-black text-white">
            {venci ? 'Você venceu o duelo!' : vencedor === 'empate' ? 'Empate!' : 'Vitória do Adversário'}
          </h3>
          <p className="mt-2 text-sm text-slate-300">
            {meuTotal} pontos contra {oponenteTotal} de {oponente?.nome ?? 'adversário'}.
          </p>
          <p className="mt-4 text-xs text-slate-400">Sua pontuação já foi registrada no ranking geral.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            salvoRef.current = false
            setTela('lobby')
            setPartida(null)
            setOponente(null)
            setMeuTotal(0)
            setOponenteTotal(0)
            euFinalRef.current = 0
            oponenteFinalRef.current = 0
            setFase(1)
          }}
          className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-sm font-black text-white shadow-lg transition-transform hover:scale-105"
        >
          Voltar ao lobby
        </button>
      </div>
    )
  }

  if (tela === 'sala') {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 text-center backdrop-blur-sm">
          <Hourglass className="mx-auto mb-2 h-8 w-8 text-amber-400 animate-pulse" />
          <h3 className="text-lg font-black text-white">
            {partida?.host_id === user.id ? 'Aguardando adversário' : 'Conectando ao adversário'}
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            {partida?.host_id === user.id
              ? 'Compartilhe o código abaixo com o colega que deseja desafiar.'
              : 'O jogo começa em instantes.'}
          </p>
          {partida ? (
            <div className="mx-auto mt-4 w-fit rounded-2xl border-2 border-dashed border-emerald-400/60 bg-emerald-500/10 px-8 py-3">
              <p className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Código da Sala</p>
              <p className="text-3xl font-black tracking-[0.25em] text-emerald-300">{partida.codigo}</p>
            </div>
          ) : null}
          {oponente ? (
            <p className="mt-3 text-sm font-semibold text-emerald-400 animate-bounce">
              {oponente.nome} entrou na partida! Iniciando…
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => {
            setTela('lobby')
            setPartida(null)
            setOponente(null)
          }}
          className="w-full rounded-xl border border-white/10 bg-slate-900/60 py-3 text-sm font-bold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          Cancelar e voltar ao lobby
        </button>
      </div>
    )
  }

  // Lobby
  return (
    <div className="space-y-5">
      {mensagem && (
        <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300">
          {mensagem}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void criarDesafio()}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-transform hover:scale-105 active:scale-95"
        >
          <Swords className="h-4 w-4" /> Criar desafio 1x1
        </button>
        <div className="flex flex-1 items-center gap-2">
          <input
            value={codigoDigitado}
            onChange={(e) => setCodigoDigitado(e.target.value.toUpperCase())}
            placeholder="Código da partida"
            maxLength={6}
            className="w-44 rounded-xl border border-white/10 bg-slate-900/60 px-3.5 py-2.5 text-sm font-bold uppercase tracking-widest text-white outline-none focus:border-emerald-500 placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={() => void entrarNoDesafio(codigoDigitado)}
            className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:border-emerald-400 hover:bg-slate-800"
          >
            Entrar
          </button>
        </div>
      </div>

      {convites.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Convites recebidos</h4>
          {convites.map((convite) => (
            <div
              key={convite.codigo}
              className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 shadow"
            >
              <p className="text-sm font-semibold text-white">
                {convite.hostNome} está esperando você
                <span className="ml-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs uppercase font-bold text-emerald-300">{convite.modo}</span>
              </p>
              <button
                type="button"
                onClick={() => void entrarNoDesafio(convite.codigo, convite)}
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow transition-transform hover:scale-105"
              >
                Aceitar
              </button>
            </div>
          ))}
        </div>
      )}

      {partidasAbertas.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Desafios abertos</h4>
          {partidasAbertas.map((aberta) => (
            <div
              key={aberta.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3"
            >
              <p className="text-sm font-semibold text-white">
                Código <span className="font-black tracking-widest text-emerald-400">{aberta.codigo}</span>
                <span className="ml-2 text-xs uppercase text-slate-400 font-bold">{aberta.modo}</span>
              </p>
              <button
                type="button"
                onClick={() => void entrarNoDesafio(aberta.codigo)}
                className="rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:border-emerald-400"
              >
                Entrar
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
          <Users className="h-3.5 w-3.5 text-emerald-400" /> Usuários cadastrados online ({jogadoresOnline.length})
        </h4>
        {jogadoresOnline.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 px-4 py-6 text-center text-xs text-slate-400">
            Nenhum outro jogador online no momento. Compartilhe o código com alguém para jogar 1x1!
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {jogadoresOnline.map((jogador) => (
              <li
                key={jogador.user_id}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2.5"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-black text-emerald-300">
                  {jogador.user_name.slice(0, 2).toUpperCase()}
                </span>
                <span className="truncate text-sm font-semibold text-white">
                  {jogador.user_name}
                </span>
                <span className="ml-auto h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
