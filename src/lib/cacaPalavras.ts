/**
 * Camada de dados do Caça Palavras.
 *
 * Utiliza o Supabase (global_settings e canais Realtime) para persistência global
 * das partidas 1x1, rankings e presença de jogadores, funcionando sincronizado
 * entre todos os computadores com cache local de alta disponibilidade.
 */

import { supabase } from './supabase'

export type ModoJogo = 'busca' | 'cruzada' | 'online'

export interface Pontuacao {
  id?: number | string
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

export type StatusPartida = 'aberta' | 'em_andamento' | 'finalizada' | 'cancelada'

export interface Partida {
  id: string
  codigo: string
  host_id: string
  host_nome?: string
  adversario_id?: string | null
  adversario_nome?: string | null
  modo: ModoJogo
  fase_atual: number
  semente: number
  status: StatusPartida
  criado_em: string
  atualizado_em?: string
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

export const CHAVE_SETTINGS_PARTIDAS = 'caca_palavras_partidas'
export const CHAVE_SETTINGS_RANKING = 'caca_palavras_ranking'
export const CHAVE_SETTINGS_JOGADORES = 'caca_palavras_jogadores'

export const CHAVE_SCORES_LOCAL = 'caca_palavras_scores_local'
export const CHAVE_JOGADORES_LOCAL = 'caca_palavras_jogadores_local'
export const CHAVE_PARTIDAS_LOCAL = 'caca_palavras_partidas_local'
export const PREFIXO_PARTIDA_SOLO_SALVA = 'caca_palavras_partida_solo_'

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
    /* ignorado */
  }
}

// ---------------------------------------------------------------------
// Pontuação / ranking global e por mês
// ---------------------------------------------------------------------

/** Grava o resultado de uma partida no ranking global e local. */
export async function salvarPontuacao(pontuacao: Pontuacao): Promise<boolean> {
  const novoRegistro: Pontuacao = {
    ...pontuacao,
    id: pontuacao.id ?? Date.now(),
    created_at: pontuacao.created_at ?? new Date().toISOString(),
  }

  // 1. Atualiza cache local
  const locais = lerLocal<Pontuacao[]>(CHAVE_SCORES_LOCAL, [])
  const indexExistente = locais.findIndex(
    (p) =>
      p.user_id === pontuacao.user_id &&
      p.modo === pontuacao.modo &&
      p.created_at?.slice(0, 7) === novoRegistro.created_at?.slice(0, 7) &&
      !p.vitoria
  )
  if (indexExistente >= 0 && novoRegistro.score >= locais[indexExistente].score) {
    locais[indexExistente] = novoRegistro
  } else {
    locais.push(novoRegistro)
  }
  gravarLocal(CHAVE_SCORES_LOCAL, locais.slice(-300))

  // 2. Persiste em global_settings no Supabase
  try {
    const { data } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', CHAVE_SETTINGS_RANKING)
      .maybeSingle()

    const listaRemota = Array.isArray(data?.value) ? (data?.value as Pontuacao[]) : []
    const atualizada = [...listaRemota, novoRegistro]
      .sort((a, b) => b.score - a.score || a.tempo_ms - b.tempo_ms)
      .slice(0, 500)

    await supabase.from('global_settings').upsert({
      key: CHAVE_SETTINGS_RANKING,
      value: atualizada,
      updated_at: new Date().toISOString(),
    })
    return true
  } catch (err) {
    console.warn('[Caça Palavras] Erro ao sincronizar ranking com banco:', err)
    return false
  }
}

/**
 * Busca o ranking de pontuações ordenado por score descendente.
 * Suporta filtro por modo de jogo e por mês/ano (ex: '2026-11').
 */
export async function buscarRanking(modo?: ModoJogo, mesAno?: string): Promise<Pontuacao[]> {
  let rankingCompleto: Pontuacao[] = []

  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', CHAVE_SETTINGS_RANKING)
      .maybeSingle()

    if (!error && Array.isArray(data?.value)) {
      rankingCompleto = data.value as Pontuacao[]
      gravarLocal(CHAVE_SCORES_LOCAL, rankingCompleto.slice(0, 300))
    } else {
      rankingCompleto = lerLocal<Pontuacao[]>(CHAVE_SCORES_LOCAL, [])
    }
  } catch {
    rankingCompleto = lerLocal<Pontuacao[]>(CHAVE_SCORES_LOCAL, [])
  }

  // Filtragem por modo e mês
  let filtradas = rankingCompleto

  if (modo && modo !== ('todos' as any)) {
    filtradas = filtradas.filter((p) => p.modo === modo)
  }

  if (mesAno && mesAno !== 'todos') {
    filtradas = filtradas.filter((p) => {
      const dataIso = p.created_at || ''
      return dataIso.startsWith(mesAno)
    })
  }

  // Ordena por maior pontuação e desempate por menor tempo
  return filtradas
    .sort((a, b) => b.score - a.score || a.tempo_ms - b.tempo_ms)
    .slice(0, 50)
}

/** Melhor pontuação do usuário no modo e período informados. */
export async function melhorPontuacao(
  userId: string,
  modo?: ModoJogo,
  mesAno?: string
): Promise<number> {
  const ranking = await buscarRanking(modo, mesAno)
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
  avatarUrl?: string | null
): Promise<boolean> {
  const jogador: JogadorOnline = {
    user_id: userId,
    user_name: userName,
    avatar_url: avatarUrl ?? null,
    online: true,
    pontos: 0,
    updated_at: new Date().toISOString(),
  }

  const locais = lerLocal<JogadorOnline[]>(CHAVE_JOGADORES_LOCAL, [])
  const semEle = locais.filter((j) => j.user_id !== userId)
  const novosLocais = [jogador, ...semEle].slice(0, 50)
  gravarLocal(CHAVE_JOGADORES_LOCAL, novosLocais)

  try {
    const { data } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', CHAVE_SETTINGS_JOGADORES)
      .maybeSingle()

    const listaRemota = Array.isArray(data?.value) ? (data?.value as JogadorOnline[]) : []
    const limite = Date.now() - 120_000 // 2 minutos
    const ativos = listaRemota.filter(
      (j) => j.user_id !== userId && j.updated_at && new Date(j.updated_at).getTime() > limite
    )
    const atualizada = [jogador, ...ativos].slice(0, 50)

    await supabase.from('global_settings').upsert({
      key: CHAVE_SETTINGS_JOGADORES,
      value: atualizada,
      updated_at: new Date().toISOString(),
    })
    return true
  } catch {
    return false
  }
}

/** Lista os jogadores que estão online agora. */
export async function listarJogadoresOnline(): Promise<JogadorOnline[]> {
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', CHAVE_SETTINGS_JOGADORES)
      .maybeSingle()

    if (!error && Array.isArray(data?.value)) {
      const limite = Date.now() - 120_000 // 2 minutos
      return (data.value as JogadorOnline[]).filter(
        (j) => j.online && j.updated_at && new Date(j.updated_at).getTime() > limite
      )
    }
  } catch {}

  const locais = lerLocal<JogadorOnline[]>(CHAVE_JOGADORES_LOCAL, [])
  const limite = Date.now() - 120_000
  return locais.filter(
    (j) => j.online && (!j.updated_at || new Date(j.updated_at).getTime() > limite)
  )
}

/** Marca o jogador como offline. */
export async function marcarOffline(userId: string): Promise<void> {
  const locais = lerLocal<JogadorOnline[]>(CHAVE_JOGADORES_LOCAL, [])
  const alvo = locais.find((j) => j.user_id === userId)
  if (alvo) {
    alvo.online = false
    gravarLocal(CHAVE_JOGADORES_LOCAL, locais)
  }

  try {
    const { data } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', CHAVE_SETTINGS_JOGADORES)
      .maybeSingle()

    if (Array.isArray(data?.value)) {
      const atualizados = (data.value as JogadorOnline[]).filter((j) => j.user_id !== userId)
      await supabase.from('global_settings').upsert({
        key: CHAVE_SETTINGS_JOGADORES,
        value: atualizados,
        updated_at: new Date().toISOString(),
      })
    }
  } catch {}
}

// ---------------------------------------------------------------------
// Partidas 1x1 Online via global_settings e Realtime
// ---------------------------------------------------------------------

export function gerarCodigo(): string {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let codigo = ''
  for (let i = 0; i < 6; i++) {
    codigo += letras[Math.floor(Math.random() * letras.length)]
  }
  return codigo
}

/** Cria uma nova partida 1x1 aberta para outro jogador entrar com o código. */
export async function criarPartida(
  hostId: string,
  hostNome: string,
  modo: ModoJogo,
  semente: number
): Promise<Partida> {
  const codigo = gerarCodigo()
  const novaPartida: Partida = {
    id: codigo,
    codigo,
    host_id: hostId,
    host_nome: hostNome,
    modo,
    fase_atual: 1,
    semente,
    status: 'aberta',
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  }

  // 1. Grava no cache local
  const partidasLocais = lerLocal<Partida[]>(CHAVE_PARTIDAS_LOCAL, [])
  gravarLocal(CHAVE_PARTIDAS_LOCAL, [novaPartida, ...partidasLocais].slice(0, 20))

  // 2. Grava no Supabase (global_settings)
  try {
    const { data } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', CHAVE_SETTINGS_PARTIDAS)
      .maybeSingle()

    const listaRemota = Array.isArray(data?.value) ? (data?.value as Partida[]) : []
    // Remove partidas com mais de 30 minutos (expiradas)
    const limite = Date.now() - 30 * 60 * 1000
    const ativas = listaRemota.filter((p) => {
      const criado = new Date(p.criado_em).getTime()
      return criado > limite && p.codigo !== codigo
    })

    const atualizadas = [novaPartida, ...ativas].slice(0, 50)
    await supabase.from('global_settings').upsert({
      key: CHAVE_SETTINGS_PARTIDAS,
      value: atualizadas,
      updated_at: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('[Caça Palavras] Erro ao gravar partida no banco:', err)
  }

  return novaPartida
}

/** Lista partidas abertas (aguardando adversário) nos últimos 30 minutos. */
export async function listarPartidasAbertas(): Promise<Partida[]> {
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', CHAVE_SETTINGS_PARTIDAS)
      .maybeSingle()

    if (!error && Array.isArray(data?.value)) {
      const limite = Date.now() - 30 * 60 * 1000
      return (data.value as Partida[]).filter((p) => {
        const criado = new Date(p.criado_em).getTime()
        return p.status === 'aberta' && criado > limite
      })
    }
  } catch {}

  const locais = lerLocal<Partida[]>(CHAVE_PARTIDAS_LOCAL, [])
  const limite = Date.now() - 30 * 60 * 1000
  return locais.filter((p) => p.status === 'aberta' && new Date(p.criado_em).getTime() > limite)
}

/** Busca uma partida ativa pelo código (case-insensitive). */
export async function buscarPartidaPorCodigo(codigo: string): Promise<Partida | null> {
  const codNormalizado = codigo.trim().toUpperCase()
  if (!codNormalizado) return null

  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', CHAVE_SETTINGS_PARTIDAS)
      .maybeSingle()

    if (!error && Array.isArray(data?.value)) {
      const lista = data.value as Partida[]
      const achou = lista.find(
        (p) =>
          p.codigo.toUpperCase() === codNormalizado &&
          p.status !== 'cancelada'
      )
      if (achou) return achou
    }
  } catch {}

  const locais = lerLocal<Partida[]>(CHAVE_PARTIDAS_LOCAL, [])
  const achouLocal = locais.find(
    (p) =>
      p.codigo.toUpperCase() === codNormalizado &&
      p.status !== 'cancelada'
  )
  return achouLocal ?? null
}

/** Entra em uma partida pelo código e define o adversário. */
export async function entrarPartida(
  codigo: string,
  userId: string,
  userName: string
): Promise<Partida | null> {
  const codNormalizado = codigo.trim().toUpperCase()

  try {
    const { data } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', CHAVE_SETTINGS_PARTIDAS)
      .maybeSingle()

    const lista = Array.isArray(data?.value) ? (data?.value as Partida[]) : []
    let partidaAtualizada: Partida | null = null

    const novas = lista.map((p) => {
      if (p.codigo.toUpperCase() === codNormalizado) {
        partidaAtualizada = {
          ...p,
          adversario_id: userId,
          adversario_nome: userName,
          status: 'em_andamento',
          atualizado_em: new Date().toISOString(),
        }
        return partidaAtualizada
      }
      return p
    })

    if (partidaAtualizada) {
      await supabase.from('global_settings').upsert({
        key: CHAVE_SETTINGS_PARTIDAS,
        value: novas,
        updated_at: new Date().toISOString(),
      })
      return partidaAtualizada
    }
  } catch (err) {
    console.warn('[Caça Palavras] Erro ao entrar na partida:', err)
  }

  // Fallback local
  const locais = lerLocal<Partida[]>(CHAVE_PARTIDAS_LOCAL, [])
  let achouLocal: Partida | null = null
  const novasLocais = locais.map((p) => {
    if (p.codigo.toUpperCase() === codNormalizado) {
      achouLocal = {
        ...p,
        adversario_id: userId,
        adversario_nome: userName,
        status: 'em_andamento',
        atualizado_em: new Date().toISOString(),
      }
      return achouLocal
    }
    return p
  })
  if (achouLocal) {
    gravarLocal(CHAVE_PARTIDAS_LOCAL, novasLocais)
    return achouLocal
  }

  return null
}

/** Atualiza campos da partida (status, fase). */
export async function atualizarPartida(
  codigo: string,
  campos: Partial<Pick<Partida, 'status' | 'fase_atual'>>
): Promise<void> {
  const codNormalizado = codigo.trim().toUpperCase()

  try {
    const { data } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', CHAVE_SETTINGS_PARTIDAS)
      .maybeSingle()

    if (Array.isArray(data?.value)) {
      const atualizadas = (data.value as Partida[]).map((p) => {
        if (p.codigo.toUpperCase() === codNormalizado) {
          return { ...p, ...campos, atualizado_em: new Date().toISOString() }
        }
        return p
      })
      await supabase.from('global_settings').upsert({
        key: CHAVE_SETTINGS_PARTIDAS,
        value: atualizadas,
        updated_at: new Date().toISOString(),
      })
    }
  } catch {}
}

/** Cancela uma partida e remove do lobby. */
export async function cancelarPartida(codigo: string): Promise<void> {
  const codNormalizado = codigo.trim().toUpperCase()

  try {
    const { data } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', CHAVE_SETTINGS_PARTIDAS)
      .maybeSingle()

    if (Array.isArray(data?.value)) {
      const filtradas = (data.value as Partida[]).filter(
        (p) => p.codigo.toUpperCase() !== codNormalizado
      )
      await supabase.from('global_settings').upsert({
        key: CHAVE_SETTINGS_PARTIDAS,
        value: filtradas,
        updated_at: new Date().toISOString(),
      })
    }
  } catch {}
}

/** Salva o progresso do jogador dentro da partida. */
export async function salvarProgressoPartida(
  dados: Omit<JogadorPartida, 'match_id'> & { match_id: string }
): Promise<void> {
  void dados
}

/** Jogadores de uma partida (retorna lista se adversário presente). */
export async function listarJogadoresPartida(partidaId: string): Promise<JogadorPartida[]> {
  const p = await buscarPartidaPorCodigo(partidaId)
  if (!p) return []

  const resultado: JogadorPartida[] = [
    {
      match_id: p.id,
      user_id: p.host_id,
      user_name: p.host_nome || 'Anfitrião',
      score: 0,
      fase: p.fase_atual,
      palavras_found: 0,
      terminou: false,
      vitorioso: false,
    },
  ]

  if (p.adversario_id) {
    resultado.push({
      match_id: p.id,
      user_id: p.adversario_id,
      user_name: p.adversario_nome || 'Adversário',
      score: 0,
      fase: p.fase_atual,
      palavras_found: 0,
      terminou: false,
      vitorioso: false,
    })
  }

  return resultado
}
