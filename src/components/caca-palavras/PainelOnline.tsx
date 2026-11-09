import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Users from 'lucide-react/dist/esm/icons/users.js'
import Swords from 'lucide-react/dist/esm/icons/swords.js'
import Hourglass from 'lucide-react/dist/esm/icons/hourglass.js'
import CircleCheck from 'lucide-react/dist/esm/icons/circle-check.js'
import Copy from 'lucide-react/dist/esm/icons/copy.js'
import Check from 'lucide-react/dist/esm/icons/check.js'
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js'
import { supabase } from '../../lib/supabase'
import {
  atualizarPartida,
  buscarPartidaPorCodigo,
  cancelarPartida,
  criarPartida,
  entrarPartida,
  listarJogadoresOnline,
  listarPartidasAbertas,
  marcarOffline,
  registrarPresenca,
  salvarPontuacao,
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
  const [copiado, setCopiado] = useState(false)
  const [conectando, setConectando] = useState(false)

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
          {
            user_id: dados.user_id,
            user_name: dados.nome,
            avatar_url: dados.avatar_url ?? null,
            online: true,
            pontos: 0,
          },
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

    const carregarLobby = async () => {
      const [lista, partidas] = await Promise.all([
        listarJogadoresOnline(),
        listarPartidasAbertas(),
      ])
      setJogadores(lista.filter((j) => j.user_id !== user.id))
      setPartidasAbertas(partidas.filter((p) => p.host_id !== user.id))
    }

    void carregarLobby()
    const intervalo = window.setInterval(carregarLobby, 4000)

    return () => {
      window.clearInterval(intervalo)
      void supabase.removeChannel(canal)
      void marcarOffline(user.id)
    }
  }, [user.id, user.nome, user.avatarUrl])

  // Presença anunciada no lobby
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
  const enviar = useCallback((event: string, payload: Record<string, unknown>) => {
    const canal = canalPartidaRef.current
    if (!canal) return
    void canal.send({ type: 'broadcast', event, payload })
  }, [])

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
    []
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
        palavras_found: meuProgresso.palavras,
        total_palavras: meuProgresso.palavras,
        vitoria: venceu,
      })
    },
    [meuProgresso.palavras, som, user.avatarUrl, user.id, user.nome]
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

        // Quem criou o desafio inicia a partida assim que o adversário entra
        if (partidaRef.current?.host_id === user.id && !iniciadoRef.current) {
          iniciadoRef.current = true
          const duracao = configDaFase(1).segundos
          const prazo = Date.now() + duracao * 1000
          canal.send({
            type: 'broadcast',
            event: 'inicio',
            payload: {
              prazo,
              semente: partidaRef.current?.semente ?? 0,
              fase: 1,
              host_nome: user.nome,
              adversario_nome: dados.nome,
            },
          })
          void atualizarPartida(partidaRef.current.codigo, { status: 'em_andamento' })
          iniciarFase(1, prazo, partidaRef.current?.semente ?? 0)
        }
      })

      canal.on('broadcast', { event: 'inicio' }, ({ payload }) => {
        const dados = payload as {
          prazo: number
          semente: number
          fase: number
          host_nome?: string
          adversario_nome?: string
        }
        if (dados.host_nome && dados.host_nome !== user.nome) {
          setOponente({ id: '', nome: dados.host_nome })
        }
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
    [finalizarPartida, iniciarFase, user.id, user.nome]
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
  // Criar / Entrar
  // ---------------------------------------------------------------
  const criarDesafio = useCallback(async () => {
    setMensagem(null)
    const semente = Math.floor(Math.random() * 1_000_000_000)
    const criada = await criarPartida(user.id, user.nome, modo, semente)
    setPartida(criada)
    subscreverPartida(criada.codigo)
    setTela('sala')
    som('entrada')
  }, [modo, som, subscreverPartida, user.id, user.nome])

  const entrarNoDesafio = useCallback(
    async (codigo: string) => {
      setMensagem(null)
      const codNormalizado = codigo.trim().toUpperCase()
      if (!codNormalizado) {
        setMensagem('Digite o código da sala para entrar.')
        return
      }

      setConectando(true)

      // 1. Busca no banco de dados Supabase global_settings
      let partidaEncontrada = await buscarPartidaPorCodigo(codNormalizado)

      // 2. Se não achou de imediato, busca nas abertas
      if (!partidaEncontrada) {
        const abertas = await listarPartidasAbertas()
        partidaEncontrada =
          abertas.find((p) => p.codigo.toUpperCase() === codNormalizado) ?? null
      }

      // 3. Fallback convite broadcast
      if (!partidaEncontrada) {
        const conv = convites.find((c) => c.codigo.toUpperCase() === codNormalizado)
        if (conv) {
          partidaEncontrada = {
            id: conv.codigo,
            codigo: conv.codigo,
            host_id: conv.hostId,
            host_nome: conv.hostNome,
            modo: conv.modo,
            fase_atual: 1,
            semente: conv.semente,
            status: 'aberta',
            criado_em: new Date().toISOString(),
          }
        }
      }

      setConectando(false)

      if (!partidaEncontrada) {
        setMensagem(`⚠️ Sala "${codNormalizado}" não encontrada ou expirada. Verifique o código.`)
        return
      }

      if (partidaEncontrada.host_id === user.id) {
        setMensagem('Você é o criador desta sala. Aguarde o outro jogador conectar.')
        setPartida(partidaEncontrada)
        setTela('sala')
        return
      }

      const partidaAtualizada = await entrarPartida(
        partidaEncontrada.codigo,
        user.id,
        user.nome
      )
      const partidaFinal = partidaAtualizada || partidaEncontrada
      setPartida(partidaFinal)
      setOponente({ id: partidaFinal.host_id, nome: partidaFinal.host_nome || 'Anfitrião' })
      subscreverPartida(partidaFinal.codigo)
      enviar('entrou', { user_id: user.id, nome: user.nome })
      setTela('sala')
      som('entrada')
    },
    [convites, enviar, som, subscreverPartida, user.id, user.nome]
  )

  const cancelarSala = useCallback(async () => {
    if (partida) {
      await cancelarPartida(partida.codigo)
    }
    setTela('lobby')
    setPartida(null)
    setOponente(null)
    setMensagem(null)
  }, [partida])

  const copiarCodigo = useCallback(() => {
    if (!partida?.codigo) return
    void navigator.clipboard.writeText(partida.codigo)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }, [partida?.codigo])

  // Anúncio contínuo do desafio enquanto se está na sala aguardando
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
    const intervalo = window.setInterval(anunciar, 3500)
    return () => window.clearInterval(intervalo)
  }, [modo, partida, tela, user.id, user.nome])

  // Verificação ativa de adversário na sala (banco e polling para 100% de estabilidade)
  useEffect(() => {
    if (tela !== 'sala' || !partida) return
    iniciadoRef.current = false

    const verificarAdversario = async () => {
      if (iniciadoRef.current) return
      const p = await buscarPartidaPorCodigo(partida.codigo)
      if (!p) return

      // Se for host e adversário entrou
      if (partida.host_id === user.id && p.adversario_id && p.adversario_id !== user.id) {
        setOponente({ id: p.adversario_id, nome: p.adversario_nome || 'Adversário' })
        if (!iniciadoRef.current) {
          iniciadoRef.current = true
          const duracao = configDaFase(1).segundos
          const prazo = Date.now() + duracao * 1000
          enviar('inicio', {
            prazo,
            semente: p.semente,
            fase: 1,
            host_nome: user.nome,
            adversario_nome: p.adversario_nome,
          })
          void atualizarPartida(p.codigo, { status: 'em_andamento' })
          iniciarFase(1, prazo, p.semente)
        }
      }

      // Se for convidado e o status mudou para em andamento
      if (partida.host_id !== user.id && p.status === 'em_andamento') {
        setOponente({ id: p.host_id, nome: p.host_nome || 'Anfitrião' })
        if (!iniciadoRef.current) {
          iniciadoRef.current = true
          const duracao = configDaFase(1).segundos
          const prazo = Date.now() + duracao * 1000
          iniciarFase(1, prazo, p.semente)
        }
      }
    }

    const intervalo = window.setInterval(verificarAdversario, 1200)
    void verificarAdversario()
    return () => window.clearInterval(intervalo)
  }, [enviar, iniciarFase, partida, tela, user.id, user.nome])

  // ---------------------------------------------------------------
  // Progresso e fim de fase
  // ---------------------------------------------------------------
  const aoProgresso = useCallback(
    (pontos: number, palavras: number) => {
      setMeuProgresso({ pontos, palavras })
      enviar('progresso', { pontos, palavras, fase: faseRef.current })
    },
    [enviar]
  )

  const avancarParaProximaFase = useCallback(
    (pontosEu: number, pontosOponente: number) => {
      const bonus = minhaFaseCompletaRef.current ? 20 * faseRef.current : 0
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
        enviar('proxima_fase', {
          fase: proxima,
          prazo,
          semente: partidaRef.current?.semente ?? 0,
        })
      }
      iniciarFase(proxima, prazo, partidaRef.current?.semente ?? 0)
    },
    [enviar, finalizarPartida, iniciarFase, user.id]
  )

  useEffect(() => {
    if (faseEu === null || faseOponente === null) return
    avancarParaProximaFase(faseEu, faseOponente)
  }, [avancarParaProximaFase, faseEu, faseOponente])

  const aoConcluirFase = useCallback(
    (resultado: ResultadoFase) => {
      setMinhaFaseCompleta(resultado.completo)
      setFaseEu(resultado.pontos)
      enviar('fase_fim', {
        pontos: resultado.pontos,
        fase: faseRef.current,
        user_id: user.id,
      })
    },
    [enviar, user.id]
  )

  const aoPerderTempo = useCallback(() => {
    setMinhaFaseCompleta(false)
    setFaseEu(0)
    enviar('fase_fim', { pontos: 0, fase: faseRef.current, user_id: user.id })
  }, [enviar, user.id])

  const jogadoresOnline = useMemo(() => {
    const mapa = new Map<string, JogadorOnline>()
    for (const j of jogadores) mapa.set(j.user_id, j)
    for (const p of presentes) mapa.set(p.user_id, p)
    mapa.delete(user.id)
    return Array.from(mapa.values())
  }, [jogadores, presentes, user.id])

  // ---------------------------------------------------------------
  // Renderização
  // ---------------------------------------------------------------

  if (tela === 'jogo') {
    return (
      <div className="space-y-3">
        {/* Placar ao vivo */}
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-black text-emerald-700">
              {user.nome.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <p className="text-xs font-bold text-slate-900 leading-tight">Você</p>
              <p className="text-[0.7rem] text-slate-500 font-semibold">
                {meuProgresso.pontos} pts · {meuProgresso.palavras} palavras
              </p>
            </div>
          </div>

          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
            Fase {fase}/{FASES_POR_PARTIDA_ONLINE}
          </div>

          <div className="flex items-center gap-2 text-right">
            <div>
              <p className="text-xs font-bold text-slate-900 leading-tight">
                {oponente?.nome ?? 'Adversário'}
              </p>
              <p className="text-[0.7rem] text-slate-500 font-semibold">
                {oponenteProgresso.pontos} pts · {oponenteProgresso.palavras} palavras
              </p>
            </div>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500/20 text-xs font-black text-rose-700">
              {(oponente?.nome ?? 'AD').slice(0, 2).toUpperCase()}
            </span>
          </div>
        </div>

        <ArenaDeJogo
          modo={modo}
          fase={fase}
          semente={(partida?.semente ?? 0) + fase * 1337}
          prazoFinal={prazoFinal}
          aoConcluirFase={aoConcluirFase}
          aoPerderTempo={aoPerderTempo}
          aoProgresso={aoProgresso}
        />
      </div>
    )
  }

  if (tela === 'resultado') {
    const empate = vencedor === 'empate'
    const euVenci = vencedor === 'eu'

    return (
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs">
        <div className="space-y-2">
          {empate ? (
            <div className="text-4xl">🤝</div>
          ) : euVenci ? (
            <div className="text-4xl">🏆</div>
          ) : (
            <div className="text-4xl">🥈</div>
          )}
          <h3 className="text-xl font-black text-slate-900">
            {empate ? 'Empate!' : euVenci ? 'Você Venceu o Desafio!' : 'Você Perdeu!'}
          </h3>
          <p className="text-sm text-slate-600 font-medium">
            {meuTotal} pontos contra {oponenteTotal} de {oponente?.nome ?? 'adversário'}.
          </p>
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
          className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-sm font-black text-white shadow-lg transition-transform hover:scale-105 cursor-pointer"
        >
          Voltar ao Lobby
        </button>
      </div>
    )
  }

  // Tela da Sala de Espera (Aguardando Adversário)
  if (tela === 'sala') {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs">
          <Hourglass className="mx-auto mb-2 h-9 w-9 text-amber-500 animate-pulse" />
          <h3 className="text-xl font-black text-slate-900">
            {partida?.host_id === user.id ? 'Aguardando adversário' : 'Conectando ao adversário'}
          </h3>
          <p className="mt-1 text-sm text-slate-600 font-medium">
            {partida?.host_id === user.id
              ? 'Compartilhe o código abaixo com o colega que deseja desafiar.'
              : 'O jogo começa em instantes...'}
          </p>

          {partida ? (
            <div className="mx-auto mt-4 w-fit rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50 px-8 py-3.5">
              <p className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-600">
                CÓDIGO DA SALA
              </p>
              <div className="flex items-center gap-3 justify-center mt-1">
                <p className="text-3xl font-black tracking-[0.25em] text-emerald-800">
                  {partida.codigo}
                </p>
                <button
                  type="button"
                  onClick={copiarCodigo}
                  className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 font-bold shadow-xs transition-colors cursor-pointer"
                  title="Copiar código da sala"
                >
                  {copiado ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copiar
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : null}

          {oponente ? (
            <p className="mt-4 text-sm font-bold text-emerald-700 animate-bounce">
              ✓ {oponente.nome} entrou na sala! Iniciando partida...
            </p>
          ) : (
            <p className="mt-3 text-xs text-slate-500 font-semibold animate-pulse">
              Aguardando o adversário digitar o código e entrar...
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => void cancelarSala()}
          className="w-full rounded-xl border border-slate-300 bg-white py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 shadow-xs cursor-pointer"
        >
          Cancelar e voltar ao lobby
        </button>
      </div>
    )
  }

  // Tela de Lobby Online
  return (
    <div className="space-y-5">
      {mensagem && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 shadow-xs">
          {mensagem}
        </div>
      )}

      {/* Ações principais: Criar Desafio ou Digitar Código */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <button
          type="button"
          onClick={() => void criarDesafio()}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
        >
          <Swords className="h-4 w-4" /> Criar Desafio 1x1
        </button>

        <div className="flex flex-1 items-center gap-2">
          <input
            value={codigoDigitado}
            onChange={(e) => setCodigoDigitado(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void entrarNoDesafio(codigoDigitado)
            }}
            placeholder="CÓDIGO DA SALA (EX: 38GD5W)"
            maxLength={6}
            className="flex-1 min-w-[160px] rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold uppercase tracking-widest text-slate-900 outline-none focus:border-emerald-500 placeholder:text-slate-400 shadow-xs placeholder:tracking-normal"
          />
          <button
            type="button"
            disabled={conectando}
            onClick={() => void entrarNoDesafio(codigoDigitado)}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 text-sm font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            {conectando ? 'Buscando...' : 'Entrar'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Convites Recebidos */}
      {convites.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Convites Recebidos
          </h4>
          {convites.map((convite) => (
            <div
              key={convite.codigo}
              className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 shadow-xs"
            >
              <p className="text-sm font-semibold text-slate-900">
                <b>{convite.hostNome}</b> está esperando você
                <span className="ml-2 rounded bg-emerald-600 px-2 py-0.5 text-xs uppercase font-bold text-white">
                  {convite.modo}
                </span>
              </p>
              <button
                type="button"
                onClick={() => void entrarNoDesafio(convite.codigo)}
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-bold text-white shadow-xs transition-transform hover:scale-105 cursor-pointer"
              >
                Aceitar Desafio
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Desafios Abertos no Momento */}
      {partidasAbertas.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Salas Abertas Aguardando Oponente ({partidasAbertas.length})
          </h4>
          <div className="grid gap-2">
            {partidasAbertas.map((aberta) => (
              <div
                key={aberta.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xs"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Sala de <b>{aberta.host_nome || 'Colega'}</b>
                  </p>
                  <p className="text-xs text-slate-500 font-semibold flex items-center gap-2 mt-0.5">
                    Código:{' '}
                    <span className="font-black tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {aberta.codigo}
                    </span>
                    <span className="uppercase">{aberta.modo}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void entrarNoDesafio(aberta.codigo)}
                  className="rounded-xl border border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-600 hover:text-white px-4 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Entrar na Sala
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de Usuários Online */}
      <div className="space-y-2">
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
          <Users className="h-3.5 w-3.5 text-emerald-600" /> Colegas Online ({jogadoresOnline.length})
        </h4>
        {jogadoresOnline.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-600 font-medium">
            Nenhum outro jogador online no momento. Compartilhe o código da sala com um colega para jogar 1x1!
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {jogadoresOnline.map((jogador) => (
              <li
                key={jogador.user_id}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-xs"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-800">
                  {jogador.user_name.slice(0, 2).toUpperCase()}
                </span>
                <span className="truncate text-sm font-semibold text-slate-900">
                  {jogador.user_name}
                </span>
                <span className="ml-auto flex items-center gap-1.5 text-[0.7rem] font-bold text-emerald-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
