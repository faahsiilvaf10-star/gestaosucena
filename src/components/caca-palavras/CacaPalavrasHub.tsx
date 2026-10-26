import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Gamepad from 'lucide-react/dist/esm/icons/gamepad.js'
import Globe from 'lucide-react/dist/esm/icons/globe.js'
import Trophy from 'lucide-react/dist/esm/icons/trophy.js'
import Play from 'lucide-react/dist/esm/icons/play.js'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw.js'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js'
import Volume2 from 'lucide-react/dist/esm/icons/volume-2.js'
import VolumeX from 'lucide-react/dist/esm/icons/volume-x.js'
import X from 'lucide-react/dist/esm/icons/x.js'
import Check from 'lucide-react/dist/esm/icons/check.js'
import Zap from 'lucide-react/dist/esm/icons/zap.js'
import Flame from 'lucide-react/dist/esm/icons/flame.js'
import Medal from 'lucide-react/dist/esm/icons/medal.js'
import Save from 'lucide-react/dist/esm/icons/save.js'
import Pause from 'lucide-react/dist/esm/icons/pause.js'
import { supabase } from '../../lib/supabase'
import {
  salvarPontuacao,
  type ModoJogo,
  obterPartidaSoloSalva,
  salvarPartidaSolo,
  limparPartidaSoloSalva,
  type PartidaSoloSalva,
} from '../../lib/cacaPalavras'
import { ArenaDeJogo, type ResultadoFase, type SnapshotFase } from './ArenaDeJogo'
import { PainelOnline, type UsuarioOnline } from './PainelOnline'
import { PainelRanking } from './PainelRanking'
import { useGameSounds } from './useGameSounds'
import { CATEGORIAS, FASES_POR_PARTIDA, type Categoria } from './wordBank'

type Aba = 'solo' | 'online' | 'ranking'
type Modo = 'busca' | 'cruzada'

const CATEGORIA_EMOJIS: Record<Categoria, string> = {
  Mundo: '🌍',
  História: '🏛️',
  Trabalho: '💼',
  Entretenimento: '🎬',
  Ciência: '🔬',
  Natureza: '🌿',
  Culinária: '🍳',
  Esportes: '⚽',
}

export function CacaPalavrasHub({ aoFechar }: { aoFechar?: () => void }) {
  const { som, mudo, alternarMudo } = useGameSounds()

  const [aba, setAba] = useState<Aba>('solo')
  const [usuario, setUsuario] = useState<UsuarioOnline | null>(null)
  const [modo, setModo] = useState<Modo>('busca')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [rankingModo, setRankingModo] = useState<ModoJogo | undefined>(undefined)

  // Estado da partida solo
  const [jogando, setJogando] = useState(false)
  const [fase, setFase] = useState(1)
  const [sementeBase, setSementeBase] = useState(0)
  const [pontosTotais, setPontosTotais] = useState(0)
  const [palavrasTotais, setPalavrasTotais] = useState(0)
  const [modalFase, setModalFase] = useState<{ pontos: number; proxima: boolean } | null>(null)
  const [fimDeJogo, setFimDeJogo] = useState<{ pontos: number; venceu: boolean; motivo: string } | null>(null)
  const [atualizarRanking, setAtualizarRanking] = useState(0)

  // Salvamento e restauração solo
  const [partidaSalva, setPartidaSalva] = useState<PartidaSoloSalva | null>(null)
  const [tempoRestaurado, setTempoRestaurado] = useState<number | undefined>(undefined)
  const [palavrasRestauradas, setPalavrasRestauradas] = useState<string[] | undefined>(undefined)
  const [pontosRestaurados, setPontosRestaurados] = useState<number | undefined>(undefined)
  const [letrasRestauradas, setLetrasRestauradas] = useState<Record<string, string> | undefined>(undefined)
  const [confirmadasRestauradas, setConfirmadasRestauradas] = useState<string[] | undefined>(undefined)
  const ultimoSnapshotRef = useRef<SnapshotFase | null>(null)

  // Usuário logado e leitura do jogo salvo
  useEffect(() => {
    let ativo = true
    void supabase.auth.getUser().then(({ data }) => {
      if (!ativo) return
      if (!data?.user) {
        setPartidaSalva(obterPartidaSoloSalva(undefined))
        return
      }
      const user = data.user
      setUsuario({
        id: user.id,
        nome:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'Usuário',
        avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
      })
      setPartidaSalva(obterPartidaSoloSalva(user.id))
    })
    return () => {
      ativo = false
    }
  }, [])

  const salvarResultado = useCallback(
    async (pontos: number, venceu: boolean) => {
      if (!usuario) return
      await salvarPontuacao({
        user_id: usuario.id,
        user_name: usuario.nome,
        avatar_url: usuario.avatarUrl ?? null,
        modo,
        fase,
        nivel: Math.min(5, 1 + Math.floor((fase - 1) / 2)),
        score: pontos,
        tempo_ms: 0,
        palavras_found: palavrasTotais,
        total_palavras: palavrasTotais,
        vitoria: venceu,
      })
      setAtualizarRanking((v) => v + 1)
    },
    [fase, modo, palavrasTotais, usuario],
  )

  const iniciarJogo = useCallback(() => {
    limparPartidaSoloSalva(usuario?.id)
    setPartidaSalva(null)
    setTempoRestaurado(undefined)
    setPalavrasRestauradas(undefined)
    setPontosRestaurados(undefined)
    setLetrasRestauradas(undefined)
    setConfirmadasRestauradas(undefined)
    ultimoSnapshotRef.current = null

    setSementeBase(Math.floor(Math.random() * 1_000_000_000))
    setFase(1)
    setPontosTotais(0)
    setPalavrasTotais(0)
    setJogando(true)
    setFimDeJogo(null)
    setModalFase(null)
    som('entrada')
  }, [som, usuario?.id])

  const continuarJogoSalvo = useCallback(() => {
    if (!partidaSalva) return
    setModo(partidaSalva.modo as Modo)
    setFase(partidaSalva.fase)
    setSementeBase(partidaSalva.sementeBase)
    setPontosTotais(partidaSalva.pontosTotais)
    setPalavrasTotais(partidaSalva.palavrasTotais)
    if (partidaSalva.categorias?.length) {
      setCategorias(partidaSalva.categorias as Categoria[])
    }
    if (partidaSalva.estadoFase) {
      setTempoRestaurado(
        partidaSalva.estadoFase.tempoRestante > 0 ? partidaSalva.estadoFase.tempoRestante : undefined,
      )
      setPalavrasRestauradas(partidaSalva.estadoFase.encontradas)
      setPontosRestaurados(partidaSalva.estadoFase.pontosFase)
      setLetrasRestauradas(partidaSalva.estadoFase.letrasCruzadas)
      setConfirmadasRestauradas(partidaSalva.estadoFase.confirmadasCruzadas)
    }
    setJogando(true)
    setFimDeJogo(null)
    setModalFase(null)
    som('entrada')
  }, [partidaSalva, som])

  const salvarESair = useCallback(
    (snapshotCustom?: SnapshotFase) => {
      const snap = snapshotCustom ?? ultimoSnapshotRef.current
      const pontosFase = snap?.pontosFase ?? 0
      const pontosTotalComFase = pontosTotais + pontosFase

      const dadosParaSalvar: PartidaSoloSalva = {
        id: `solo_${sementeBase}_${usuario?.id || 'anonimo'}`,
        userId: usuario?.id || 'anonimo',
        userName: usuario?.nome || 'Jogador',
        modo,
        fase,
        nivel: Math.min(5, 1 + Math.floor((fase - 1) / 2)),
        sementeBase,
        pontosTotais,
        palavrasTotais,
        categorias,
        estadoFase: {
          tempoRestante: snap?.tempoRestante ?? 120,
          encontradas: snap?.encontradas ?? [],
          pontosFase,
          letrasCruzadas: snap?.letras,
          confirmadasCruzadas: snap?.confirmadas,
        },
        salvoEm: new Date().toISOString(),
      }

      salvarPartidaSolo(dadosParaSalvar)
      setPartidaSalva(dadosParaSalvar)

      // Pontos acumulados são enviados imediatamente para o ranking
      if (pontosTotalComFase > 0) {
        void salvarResultado(pontosTotalComFase, false)
      }

      setJogando(false)
      setFimDeJogo(null)
      setModalFase(null)
      som('clique')
    },
    [categorias, fase, modo, palavrasTotais, pontosTotais, salvarResultado, sementeBase, som, usuario?.id, usuario?.nome],
  )

  const fecharComSalvamento = useCallback(() => {
    if (jogando) {
      salvarESair()
    }
    aoFechar?.()
  }, [aoFechar, jogando, salvarESair])

  // Captura tecla Escape com prioridade para salvar jogo antes de fechar modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && jogando) {
        salvarESair()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [jogando, salvarESair])

  // Salva automaticamente se a aba ou janela for fechada/recarregada
  useEffect(() => {
    if (!jogando) return
    const onBeforeUnload = () => {
      salvarESair()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [jogando, salvarESair])

  const aoConcluirFase = useCallback(
    (resultado: ResultadoFase) => {
      const bonus = resultado.completo ? 200 * fase : 0
      const total = pontosTotais + resultado.pontos + bonus
      const totalPalavras = palavrasTotais + resultado.palavrasEncontradas
      setPontosTotais(total)
      setPalavrasTotais(totalPalavras)
      som(resultado.completo ? 'vitoria' : 'derrota')

      // Sincroniza os pontos conquistados no ranking
      void salvarResultado(total, resultado.completo)

      if (fase >= FASES_POR_PARTIDA) {
        setFimDeJogo({
          pontos: total,
          venceu: resultado.completo,
          motivo: resultado.completo
            ? 'Sensacional! Você completou todas as 5 fases com sucesso!'
            : 'O tempo limite da fase final expirou.',
        })
        limparPartidaSoloSalva(usuario?.id)
        setPartidaSalva(null)
        return
      }

      // Salva o avanço para a próxima fase
      const proximaSalva: PartidaSoloSalva = {
        id: `solo_${sementeBase}_${usuario?.id || 'anonimo'}`,
        userId: usuario?.id || 'anonimo',
        userName: usuario?.nome || 'Jogador',
        modo,
        fase: fase + 1,
        nivel: Math.min(5, 1 + Math.floor(fase / 2)),
        sementeBase,
        pontosTotais: total,
        palavrasTotais: totalPalavras,
        categorias,
        estadoFase: {
          tempoRestante: 0,
          encontradas: [],
          pontosFase: 0,
        },
        salvoEm: new Date().toISOString(),
      }
      salvarPartidaSolo(proximaSalva)
      setPartidaSalva(proximaSalva)
      setTempoRestaurado(undefined)
      setPalavrasRestauradas(undefined)
      setPontosRestaurados(undefined)
      setLetrasRestauradas(undefined)
      setConfirmadasRestauradas(undefined)

      setModalFase({ pontos: resultado.pontos + bonus, proxima: true })
    },
    [categorias, fase, modo, palavrasTotais, pontosTotais, salvarResultado, sementeBase, som, usuario?.id, usuario?.nome],
  )

  const aoPerderTempo = useCallback(() => {
    setFimDeJogo({
      pontos: pontosTotais,
      venceu: false,
      motivo: 'O tempo da fase acabou. Tente novamente para alcançar o topo do pódio!',
    })
    void salvarResultado(pontosTotais, false)
    limparPartidaSoloSalva(usuario?.id)
    setPartidaSalva(null)
  }, [pontosTotais, salvarResultado, usuario?.id])

  const alternarCategoria = (categoria: Categoria) => {
    som('clique')
    setCategorias((atuais) =>
      atuais.includes(categoria)
        ? atuais.filter((c) => c !== categoria)
        : [...atuais, categoria],
    )
  }

  const abas = useMemo(
    () => [
      { id: 'solo' as const, label: 'Solo', Icone: Gamepad },
      { id: 'online' as const, label: 'Online 1x1', Icone: Globe },
      { id: 'ranking' as const, label: 'Ranking', Icone: Trophy },
    ],
    [],
  )

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0b0e14] text-white select-none">
      {/* Cabeçalho Gaming */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-950/60 px-4 py-3 sm:px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500/20 to-emerald-500/20 border border-white/15 shadow-inner">
            <Sparkles className="h-5 w-5 text-amber-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-tight text-white">Caça Palavras & Cruzadas</h2>
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[0.65rem] font-bold text-emerald-400">
                PRO
              </span>
            </div>
            <p className="text-[0.7rem] text-slate-400">
              {FASES_POR_PARTIDA} fases progressivas · multiplayer online 1x1 · ranking geral
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Navegação entre Abas */}
          <nav className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
            {abas.map(({ id, label, Icone }) => {
              const ativa = aba === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    som('clique')
                    setAba(id)
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    ativa
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 ring-1 ring-white/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <Icone className="h-3.5 w-3.5" />
                  {label}
                </button>
              )
            })}
          </nav>

          {/* Botão de Som Mudo / Ativo */}
          <button
            type="button"
            onClick={alternarMudo}
            title={mudo ? 'Ativar som' : 'Desativar som'}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            {mudo ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
          </button>

          {/* Botão Fechar Modal */}
          {aoFechar && (
            <button
              type="button"
              onClick={fecharComSalvamento}
              title="Fechar (Esc) - Salva partida automaticamente"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* Conteúdo Principal */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {aba === 'solo' && (
          <div className="mx-auto max-w-4xl space-y-6">
            {!jogando ? (
              <div className="space-y-6 animate-[role-fade-in_0.3s_ease-out]">
                {/* Banner de Partida Salva em Andamento */}
                {partidaSalva && (
                  <div className="relative overflow-hidden rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 via-slate-900/90 to-slate-950 p-5 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                          <Play className="h-6 w-6 fill-emerald-400" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wider text-emerald-300">
                              Partida Salva
                            </span>
                            <span className="text-[0.7rem] text-slate-400">
                              Salvo às {new Date(partidaSalva.salvoEm).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <h3 className="text-base font-black text-white mt-1">
                            Continuar de onde parou ({partidaSalva.modo === 'busca' ? 'Caça Palavras' : 'Palavras Cruzadas'})
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                            <span className="font-bold text-emerald-400">
                              Fase {partidaSalva.fase} de {FASES_POR_PARTIDA} (Nível {partidaSalva.nivel})
                            </span>
                            <span>·</span>
                            <span className="font-bold text-amber-400">
                              {partidaSalva.pontosTotais + (partidaSalva.estadoFase?.pontosFase ?? 0)} pontos acumulados
                            </span>
                            {partidaSalva.estadoFase?.encontradas?.length ? (
                              <>
                                <span>·</span>
                                <span className="text-slate-300">
                                  {partidaSalva.estadoFase.encontradas.length} palavras feitas
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Deseja iniciar do zero? O progresso da partida salva será apagado.')) {
                              iniciarJogo()
                            }
                          }}
                          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-xs font-bold text-slate-400 transition-colors hover:border-red-500/40 hover:bg-red-500/15 hover:text-red-300"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Novo Jogo (Do Zero)
                        </button>

                        <button
                          type="button"
                          onClick={continuarJogoSalvo}
                          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] active:scale-[0.98]"
                        >
                          <Play className="h-4 w-4 fill-white" />
                          Continuar Fase {partidaSalva.fase}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Seletor de Modo de Jogo */}
                <div>
                  <label className="mb-2.5 block text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    1. Escolha a Modalidade
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Modo Caça Palavras */}
                    <button
                      type="button"
                      onClick={() => {
                        som('clique')
                        setModo('busca')
                      }}
                      className={`relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 ${
                        modo === 'busca'
                          ? 'border-emerald-500/80 bg-gradient-to-br from-emerald-500/20 via-emerald-950/30 to-slate-900/90 shadow-[0_0_25px_-5px_rgba(16,185,129,0.3)] ring-1 ring-emerald-500/40'
                          : 'border-white/10 bg-slate-900/50 hover:border-white/25 hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="inline-block rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-emerald-300 mb-1.5">
                            Grade de Busca
                          </span>
                          <h3 className="text-base font-black text-white">Caça Palavras</h3>
                        </div>
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-full border transition-all ${
                            modo === 'busca'
                              ? 'border-emerald-400 bg-emerald-500 text-white'
                              : 'border-white/20 bg-white/5 text-transparent'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-300">
                        Arraste sobre as letras para encontrar palavras ocultas na horizontal, vertical e diagonal.
                      </p>
                    </button>

                    {/* Modo Palavras Cruzadas */}
                    <button
                      type="button"
                      onClick={() => {
                        som('clique')
                        setModo('cruzada')
                      }}
                      className={`relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 ${
                        modo === 'cruzada'
                          ? 'border-amber-400/80 bg-gradient-to-br from-amber-500/20 via-amber-950/30 to-slate-900/90 shadow-[0_0_25px_-5px_rgba(245,158,11,0.3)] ring-1 ring-amber-400/40'
                          : 'border-white/10 bg-slate-900/50 hover:border-white/25 hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="inline-block rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-amber-300 mb-1.5">
                            Grade Cruzada
                          </span>
                          <h3 className="text-base font-black text-white">Palavras Cruzadas</h3>
                        </div>
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-full border transition-all ${
                            modo === 'cruzada'
                              ? 'border-amber-400 bg-amber-500 text-white'
                              : 'border-white/20 bg-white/5 text-transparent'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-300">
                        Preencha as casas cruzando palavras a partir de dicas com teclado físico ou virtual.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Seletor de Categorias Temáticas */}
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">
                        2. Categorias Temáticas (Opcional)
                      </h4>
                      <p className="text-[0.72rem] text-slate-400">
                        {categorias.length === 0
                          ? 'Todas as categorias ativas (sorteio geral aleatório)'
                          : `${categorias.length} categoria${categorias.length > 1 ? 's' : ''} filtrada${categorias.length > 1 ? 's' : ''}`}
                      </p>
                    </div>
                    {categorias.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          som('clique')
                          setCategorias([])
                        }}
                        className="text-xs font-bold text-amber-400 hover:text-amber-300 hover:underline"
                      >
                        Limpar filtro
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {CATEGORIAS.map((categoria) => {
                      const ativa = categorias.includes(categoria)
                      const emoji = CATEGORIA_EMOJIS[categoria] || '📌'
                      return (
                        <button
                          key={categoria}
                          type="button"
                          onClick={() => alternarCategoria(categoria)}
                          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                            ativa
                              ? 'border-emerald-400/80 bg-emerald-500/25 text-emerald-100 shadow-[0_0_15px_-3px_rgba(16,185,129,0.35)] scale-[1.02]'
                              : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/25 hover:bg-white/[0.08] hover:text-white'
                          }`}
                        >
                          <span className="text-sm">{emoji}</span>
                          <span>{categoria}</span>
                          {ativa && <Check className="ml-0.5 h-3 w-3 stroke-[3] text-emerald-400" />}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Botão de Iniciar Jogo */}
                <button
                  type="button"
                  onClick={iniciarJogo}
                  className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 py-4 text-base font-black text-white shadow-[0_0_35px_-5px_rgba(16,185,129,0.45)] transition-all hover:scale-[1.01] hover:shadow-[0_0_45px_-2px_rgba(16,185,129,0.65)] active:scale-[0.99]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm group-hover:scale-110 transition-transform">
                    <Play className="h-4 w-4 fill-white text-white translate-x-0.5" />
                  </span>
                  <span>Iniciar Jogo Solo ({FASES_POR_PARTIDA} Fases)</span>
                </button>

                {/* Seção Informativa e Dicas (Preenchendo a área inferior) */}
                <div className="grid gap-3 pt-2 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 transition-colors hover:bg-slate-900/60">
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                      <Zap className="h-4 w-4" />
                    </div>
                    <h5 className="text-xs font-bold text-white">Velocidade & Bônus</h5>
                    <p className="mt-1 text-[0.72rem] leading-relaxed text-slate-400">
                      Encontre as palavras rapidamente para ganhar pontos extras de tempo. Completar cada fase rende até +1.000 pts de bônus!
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 transition-colors hover:bg-slate-900/60">
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
                      <Flame className="h-4 w-4" />
                    </div>
                    <h5 className="text-xs font-bold text-white">Dificuldade Progressiva</h5>
                    <p className="mt-1 text-[0.72rem] leading-relaxed text-slate-400">
                      As 5 fases aumentam gradualmente o tamanho da grade e introduzem palavras na diagonal e invertidas.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 transition-colors hover:bg-slate-900/60">
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                      <Medal className="h-4 w-4" />
                    </div>
                    <h5 className="text-xs font-bold text-white">Pódio & Ranking</h5>
                    <p className="mt-1 text-[0.72rem] leading-relaxed text-slate-400">
                      Suas pontuações entram no mural dos 3 melhores da Sucena. Desafie colegas no modo 1x1 online em tempo real!
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-[role-fade-in_0.3s_ease-out]">
                {/* Barra de controle da partida em andamento */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-900/60 p-3 backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-slate-300">
                      Pontos Acumulados: <span className="text-amber-400 font-black">{pontosTotais}</span>
                    </span>
                    <span className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-slate-300">
                      Fase <span className="text-emerald-400 font-black">{fase}</span> de {FASES_POR_PARTIDA}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => salvarESair()}
                      title="Salva nível, tempo e envia pontos ao ranking"
                      className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-3.5 py-1.5 text-xs font-bold text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/30"
                    >
                      <Save className="h-3.5 w-3.5 text-emerald-400" />
                      Salvar & Sair
                    </button>

                    <button
                      type="button"
                      onClick={() => salvarESair()}
                      title="Sai do jogo salvando automaticamente o progresso"
                      className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-bold text-slate-300 transition-colors hover:border-red-500/40 hover:bg-red-500/20 hover:text-red-300"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Sair do jogo
                    </button>
                  </div>
                </div>

                <ArenaDeJogo
                  key={`${modo}-${fase}-${sementeBase}-${tempoRestaurado ? 'restaurado' : 'novo'}`}
                  modo={modo}
                  fase={fase}
                  semente={sementeBase + fase * 7919}
                  categorias={categorias.length ? categorias : undefined}
                  tempoInicial={tempoRestaurado}
                  palavrasIniciais={palavrasRestauradas}
                  pontosIniciais={pontosRestaurados}
                  letrasIniciais={letrasRestauradas}
                  confirmadasIniciais={confirmadasRestauradas}
                  aoSalvarSair={(snap) => salvarESair(snap)}
                  aoReiniciar={iniciarJogo}
                  aoAtualizarEstado={(snap) => {
                    ultimoSnapshotRef.current = snap
                  }}
                  aoConcluirFase={aoConcluirFase}
                  aoPerderTempo={aoPerderTempo}
                />
              </div>
            )}
          </div>
        )}

        {aba === 'online' && (
          <div className="mx-auto max-w-4xl space-y-4">
            {!usuario ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/50 p-8 text-center">
                <Globe className="mx-auto mb-3 h-10 w-10 text-slate-500" />
                <p className="text-base font-bold text-white">Você precisa estar logado</p>
                <p className="mt-1 text-xs text-slate-400">
                  O modo online é exclusivo para usuários cadastrados no sistema. Entre com sua conta para
                  desafiar outro jogador em tempo real.
                </p>
              </div>
            ) : (
              <PainelOnline
                key={modo}
                user={usuario}
                modo={modo}
                aoSair={() => setAba('solo')}
              />
            )}

            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Modalidade da partida online
              </p>
              <div className="mt-2.5 flex gap-2">
                {(['busca', 'cruzada'] as Modo[]).map((valor) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => {
                      som('clique')
                      setModo(valor)
                    }}
                    className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                      modo === valor
                        ? 'border-emerald-400/80 bg-emerald-500/20 text-emerald-200 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]'
                        : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08]'
                    }`}
                  >
                    {valor === 'busca' ? 'Caça Palavras' : 'Palavras Cruzadas'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {aba === 'ranking' && (
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="flex flex-wrap gap-2">
              {([
                { id: undefined, label: 'Geral (Todos)' },
                { id: 'busca' as ModoJogo, label: 'Caça Palavras' },
                { id: 'cruzada' as ModoJogo, label: 'Palavras Cruzadas' },
                { id: 'online' as ModoJogo, label: 'Online 1x1' },
              ]).map((filtro) => (
                <button
                  key={filtro.label}
                  type="button"
                  onClick={() => {
                    som('clique')
                    setRankingModo(filtro.id)
                  }}
                  className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                    rankingModo === filtro.id
                      ? 'border-amber-400/80 bg-amber-500/20 text-amber-200 shadow-[0_0_15px_-3px_rgba(245,158,11,0.3)]'
                      : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08]'
                  }`}
                >
                  {filtro.label}
                </button>
              ))}
            </div>
            <PainelRanking
              key={`${rankingModo}-${atualizarRanking}`}
              modo={rankingModo}
              userId={usuario?.id}
              atualizarEm={atualizarRanking}
            />
          </div>
        )}
      </div>

      {/* Modal de fase concluída */}
      {modalFase && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="animate-[role-fade-in_0.35s_ease-out] w-full max-w-sm rounded-3xl border border-emerald-400/40 bg-gradient-to-b from-[#141824] to-[#0c0e14] p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 border border-amber-400/30 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
              <Trophy className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-black text-white">Fase {fase} Concluída!</h3>
            <p className="mt-1 text-sm font-semibold text-emerald-400">
              +{modalFase.pontos} pontos conquistados
            </p>
            <div className="my-4 rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-xs text-slate-400">Total acumulado na partida</p>
              <p className="text-2xl font-black text-amber-400">{pontosTotais} pts</p>
            </div>
            <button
              type="button"
              onClick={() => {
                som('clique')
                setModalFase(null)
                setFase((f) => f + 1)
              }}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-sm font-black text-white shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Iniciar Fase {fase + 1} ({FASES_POR_PARTIDA} no total)
            </button>
          </div>
        </div>
      )}

      {/* Modal de fim de jogo */}
      {fimDeJogo && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="animate-[role-fade-in_0.35s_ease-out] w-full max-w-sm rounded-3xl border border-white/15 bg-gradient-to-b from-[#141824] to-[#0c0e14] p-6 text-center shadow-2xl">
            <div
              className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border ${
                fimDeJogo.venceu
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                  : 'bg-red-500/20 border-red-400/40 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
              }`}
            >
              <Trophy className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-black text-white">
              {fimDeJogo.venceu ? 'Vitória Completa!' : 'Fim de Jogo'}
            </h3>
            <p className="mt-1 text-xs text-slate-300 leading-relaxed">{fimDeJogo.motivo}</p>
            <div className="my-4 rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-3xl font-black tabular-nums text-amber-400">{fimDeJogo.pontos}</p>
              <p className="text-[0.7rem] text-slate-400">pontos registrados no ranking</p>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  som('clique')
                  setFimDeJogo(null)
                  setJogando(false)
                }}
                className="flex-1 rounded-xl border border-white/15 bg-white/[0.04] py-3 text-xs font-bold text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                Menu Principal
              </button>
              <button
                type="button"
                onClick={iniciarJogo}
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-xs font-black text-white shadow-lg shadow-emerald-500/30 transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Jogar Novamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
