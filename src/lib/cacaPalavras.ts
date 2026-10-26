/**
 * Camada de dados do Caça Palavras.
 *
 * O jogo funciona 100% online usando Supabase (pontuação, jogadores online e
 * partidas 1x1). Se as tabelas ainda não existirem no banco — a migração
 * `supabase/migrations/*_create_caca_palavras.sql` precisa ser aplicada — o
 * módulo detecta o erro e passa a gravar localmente, para que nada quebre
 * enquanto a migração não é executada.
 */

import { supabase } from './supabase'

export type ModoJogo = 'busca' | 'cruzada' | 'online'

export interface Pontuacao {
  id?: number
  user_id: string
  user_name: string
  avatar_url?: string | null
  modo: ModoJogo
  fase: number
  nivel: number
  score: number
  tempo_ms: number
  palavras_found: number
  total_palavras: number
  vitoria: boolean
  created_at?: string
}

export interface JogadorOnline {
  user_id: string
  user_name: string
  avatar_url?: string | null
  online: boolean
  pontos: number
  updated_at?: string
}

export type StatusPartida = 'aberta' | 'em_andamento' | 'finalizada'

export interface Partida {
  id: string
  codigo: string
  host_id: string
  modo: ModoJogo
  fase_atual: number
  semente: number
  status: StatusPartida
  criado_em: string
}

export interface JogadorPartida {
  match_id: string
  user_id: string
  user_name: string
  score: number
  fase: number
  palavras_found: number
  terminou: boolean
  vitorioso: boolean
}

const CHAVE_SCORES_LOCAL = 'caca_palavras_scores_local'
const CHAVE_JOGADORES_LOCAL = 'caca_palavras_jogadores_local'
const PREFIXO_PARTIDA_SOLO_SALVA = 'caca_palavras_partida_solo_'

export interface EstadoFaseSolo {
  tempoRestante: number
  encontradas: string[]
  pontosFase: number
  letrasCruzadas?: Record<string, string>
  confirmadasCruzadas?: string[]
}

export interface PartidaSoloSalva {
  id: string
  userId: string
  userName: string
  modo: ModoJogo
  fase: number
  nivel: number
  sementeBase: number
  pontosTotais: number
  palavrasTotais: number
  categorias: string[]
  estadoFase: EstadoFaseSolo
  salvoEm: string
}

export function obterChavePartidaSalva(userId?: string): string {
  return `${PREFIXO_PARTIDA_SOLO_SALVA}${userId || 'anonimo'}`
}

export function obterPartidaSoloSalva(userId?: string): PartidaSoloSalva | null {
  const chave = obterChavePartidaSalva(userId)
  const salva = lerLocal<PartidaSoloSalva | null>(chave, null)
  if (!salva) return null
  if (!salva.fase || salva.fase < 1 || salva.fase > 5) return null
  return salva
}

export function salvarPartidaSolo(partida: PartidaSoloSalva): void {
  const chave = obterChavePartidaSalva(partida.userId)
  gravarLocal(chave, partida)
}

export function limparPartidaSoloSalva(userId?: string): void {
  if (typeof window === 'undefined') return
  const chave = obterChavePartidaSalva(userId)
  try {
    localStorage.removeItem(chave)
  } catch {
    /* ignorado */
  }
}

/** Erros de "tabela não existe" (42P01) e de permissão (42501). */
function erroDeBancoNaoPronto(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const codigo = error.code ?? ''
  const mensagem = (error.message ?? '').toLowerCase()
  return (
    codigo === '42P01' ||
    codigo === '42703' ||
    codigo === '42501' ||
    codigo === 'PGRST205' ||
    mensagem.includes('does not exist') ||
    mensagem.includes('não existe') ||
    mensagem.includes('not found') ||
    mensagem.includes('row-level security')
  )
}

function lerLocal<T>(chave: string, padrao: T): T {
  if (typeof window === 'undefined') return padrao
  try {
    const bruto = localStorage.getItem(chave)
    if (!bruto) return padrao
    return JSON.parse(bruto) as T
  } catch {
    return padrao
  }
}

function gravarLocal(chave: string, valor: unknown) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(chave, JSON.stringify(valor))
  } catch {
    /* cota cheia ou modo privado: ignorado */
  }
}

// ---------------------------------------------------------------------
// Pontuação / ranking
// ---------------------------------------------------------------------

/** Grava o resultado de uma partida no ranking. */
export async function salvarPontuacao(pontuacao: Pontuacao): Promise<boolean> {
  // Atualiza também os pontos acumulados do jogador na tabela de presença/perfil
  if (pontuacao.user_id) {
    void supabase
      .from('caca_palavras_players')
      .upsert(
        {
          user_id: pontuacao.user_id,
          user_name: pontuacao.user_name,
          avatar_url: pontuacao.avatar_url ?? null,
          online: true,
          pontos: pontuacao.score,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: 'user_id' },
      )
  }

  const { error } = await supabase
    .from('caca_palavras_scores')
    .insert({
      user_id: pontuacao.user_id,
      user_name: pontuacao.user_name,
      avatar_url: pontuacao.avatar_url ?? null,
      modo: pontuacao.modo,
      fase: pontuacao.fase,
      nivel: pontuacao.nivel,
      score: pontuacao.score,
      tempo_ms: pontuacao.tempo_ms,
      palavras_found: pontuacao.palavras_found,
      total_palavras: pontuacao.total_palavras,
      vitoria: pontuacao.vitoria,
      created_at: new Date().toISOString(),
    } as never)

  if (error) {
    if (!erroDeBancoNaoPronto(error)) {
      console.warn('[Caça Palavras] falha ao salvar pontuação:', error.message)
    }
    const locais = lerLocal<Pontuacao[]>(CHAVE_SCORES_LOCAL, [])
    const indexExistente = locais.findIndex(
      (p) => p.user_id === pontuacao.user_id && p.modo === pontuacao.modo && !p.vitoria,
    )
    if (indexExistente >= 0 && pontuacao.score >= locais[indexExistente].score) {
      locais[indexExistente] = { ...pontuacao, id: locais[indexExistente].id, created_at: new Date().toISOString() }
    } else {
      locais.push({ ...pontuacao, id: Date.now(), created_at: new Date().toISOString() })
    }
    gravarLocal(CHAVE_SCORES_LOCAL, locais.slice(-200))
    return false
  }

  return true
}

/** Busca o ranking (top 50). Ordem: pontos, depois menos tempo. */
export async function buscarRanking(modo?: ModoJogo): Promise<Pontuacao[]> {
  let consulta = supabase
    .from('caca_palavras_scores')
    .select('*')
    .order('score', { ascending: false })
    .order('tempo_ms', { ascending: true })
    .limit(50)

  if (modo) consulta = consulta.eq('modo', modo)

  const { data, error } = await consulta

  if (error || !data) {
    if (error && !erroDeBancoNaoPronto(error)) {
      console.warn('[Caça Palavras] falha ao buscar ranking:', error.message)
    }
    const locais = lerLocal<Pontuacao[]>(CHAVE_SCORES_LOCAL, [])
    const filtradas = modo ? locais.filter((p) => p.modo === modo) : locais
    return [...filtradas]
      .sort((a, b) => b.score - a.score || a.tempo_ms - b.tempo_ms)
      .slice(0, 50)
  }

  return (data as unknown as Pontuacao[]) ?? []
}

/** Melhor pontuação do usuário no modo informado. */
export async function melhorPontuacao(userId: string, modo?: ModoJogo): Promise<number> {
  const ranking = await buscarRanking(modo)
  return ranking
    .filter((p) => p.user_id === userId)
    .reduce((max, p) => Math.max(max, p.score), 0)
}

// ---------------------------------------------------------------------
// Jogadores online (presença)
// ---------------------------------------------------------------------

/** Registra/heartbeat do jogador logado. */
export async function registrarPresenca(
  userId: string,
  userName: string,
  avatarUrl?: string | null,
): Promise<boolean> {
  const { error } = await supabase
    .from('caca_palavras_players')
    .upsert(
      {
        user_id: userId,
        user_name: userName,
        avatar_url: avatarUrl ?? null,
        online: true,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'user_id' },
    )

  if (error) {
    if (!erroDeBancoNaoPronto(error)) {
      console.warn('[Caça Palavras] falha ao registrar presença:', error.message)
    }
    const locais = lerLocal<JogadorOnline[]>(CHAVE_JOGADORES_LOCAL, [])
    const existente = locais.find((j) => j.user_id === userId)
    if (existente) {
      existente.user_name = userName
      existente.avatar_url = avatarUrl ?? existente.avatar_url
      existente.online = true
      existente.updated_at = new Date().toISOString()
    } else {
      locais.push({
        user_id: userId,
        user_name: userName,
        avatar_url: avatarUrl ?? null,
        online: true,
        pontos: 0,
        updated_at: new Date().toISOString(),
      })
    }
    gravarLocal(CHAVE_JOGADORES_LOCAL, locais.slice(-100))
    return false
  }

  return true
}

/** Lista os jogadores cadastrados que estão online agora. */
export async function listarJogadoresOnline(): Promise<JogadorOnline[]> {
  const { data, error } = await supabase
    .from('caca_palavras_players')
    .select('*')
    .eq('online', true)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error || !data) {
    const locais = lerLocal<JogadorOnline[]>(CHAVE_JOGADORES_LOCAL, [])
    const limite = Date.now() - 60_000
    return locais.filter(
      (j) => j.online && (!j.updated_at || new Date(j.updated_at).getTime() > limite),
    )
  }

  return (data as unknown as JogadorOnline[]) ?? []
}

/** Marca o jogador como offline. */
export async function marcarOffline(userId: string): Promise<void> {
  await supabase
    .from('caca_palavras_players')
    .update({ online: false, updated_at: new Date().toISOString() } as never)
    .eq('user_id', userId)

  const locais = lerLocal<JogadorOnline[]>(CHAVE_JOGADORES_LOCAL, [])
  const alvo = locais.find((j) => j.user_id === userId)
  if (alvo) {
    alvo.online = false
    gravarLocal(CHAVE_JOGADORES_LOCAL, locais)
  }
}

// ---------------------------------------------------------------------
// Partidas 1x1
// ---------------------------------------------------------------------

function gerarCodigo(): string {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let codigo = ''
  for (let i = 0; i < 6; i++) {
    codigo += letras[Math.floor(Math.random() * letras.length)]
  }
  return codigo
}

/** Cria uma partida aberta para outro jogador entrar. */
export async function criarPartida(
  hostId: string,
  modo: ModoJogo,
  semente: number,
): Promise<Partida> {
  const codigo = gerarCodigo()
  const { data, error } = await supabase
    .from('caca_palavras_matches')
    .insert({
      codigo,
      host_id: hostId,
      modo,
      fase_atual: 1,
      semente,
      status: 'aberta',
      criado_em: new Date().toISOString(),
    } as never)
    .select()
    .single()

  if (error || !data) {
    if (error && !erroDeBancoNaoPronto(error)) {
      console.warn('[Caça Palavras] falha ao criar partida:', error.message)
    }
    return {
      id: codigo,
      codigo,
      host_id: hostId,
      modo,
      fase_atual: 1,
      semente,
      status: 'aberta',
      criado_em: new Date().toISOString(),
    }
  }

  return data as unknown as Partida
}

/** Lista partidas abertas (aguardando adversário). */
export async function listarPartidasAbertas(): Promise<Partida[]> {
  const { data, error } = await supabase
    .from('caca_palavras_matches')
    .select('*')
    .eq('status', 'aberta')
    .order('criado_em', { ascending: false })
    .limit(20)

  if (error || !data) return []
  return (data as unknown as Partida[]) ?? []
}

/** Entra em uma partida pelo código. */
export async function entrarPartida(
  partida: Partida,
  userId: string,
  userName: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('caca_palavras_match_players')
    .upsert(
      {
        match_id: partida.id,
        user_id: userId,
        user_name: userName,
        score: 0,
        fase: 1,
        palavras_found: 0,
        terminou: false,
        vitorioso: false,
      } as never,
      { onConflict: 'match_id,user_id' },
    )

  if (error) {
    if (!erroDeBancoNaoPronto(error)) {
      console.warn('[Caça Palavras] falha ao entrar na partida:', error.message)
    }
    return false
  }

  return true
}

/** Salva o progresso do jogador dentro da partida. */
export async function salvarProgressoPartida(
  dados: Omit<JogadorPartida, 'match_id'> & { match_id: string },
): Promise<void> {
  const { error } = await supabase
    .from('caca_palavras_match_players')
    .upsert(dados as never, { onConflict: 'match_id,user_id' })

  if (error && !erroDeBancoNaoPronto(error)) {
    console.warn('[Caça Palavras] falha ao salvar progresso:', error.message)
  }
}

/** Atualiza o estado da partida (fase, status, vencedor). */
export async function atualizarPartida(
  partidaId: string,
  campos: Partial<Pick<Partida, 'status' | 'fase_atual'>>,
): Promise<void> {
  const { error } = await supabase
    .from('caca_palavras_matches')
    .update(campos as never)
    .eq('id', partidaId)

  if (error && !erroDeBancoNaoPronto(error)) {
    console.warn('[Caça Palavras] falha ao atualizar partida:', error.message)
  }
}

/** Jogadores de uma partida. */
export async function listarJogadoresPartida(partidaId: string): Promise<JogadorPartida[]> {
  const { data, error } = await supabase
    .from('caca_palavras_match_players')
    .select('*')
    .eq('match_id', partidaId)

  if (error || !data) return []
  return (data as unknown as JogadorPartida[]) ?? []
}
