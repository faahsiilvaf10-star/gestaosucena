import { supabase } from './supabase'

export interface PlacarSegurancaConfig {
  dataUltimoAcidenteComAfastamento: string // 'YYYY-MM-DD'
  dataUltimoAcidenteSemAfastamento?: string // 'YYYY-MM-DD'
  metaDias: number // Padrão: 365
  recordeHistoricoDias: number // Padrão: 365
  observacao?: string
  atualizadoEm?: string
}

export interface FeitoSegurancaInfo {
  nivel: 'inicio' | 'bronze' | 'prata' | 'ouro' | 'diamante' | 'recorde'
  titulo: string
  subtitulo: string
  icone: string
  corHex: string
  badgeBg: string
  badgeTexto: string
  bordaHex: string
  gradienteBg: string
}

export function getLsKeyPlacarSeguranca(env = 'barcarena'): string {
  return `hydro-placar-seguranca-${env}-v1`
}

export const LS_KEY_PLACAR_SEGURANCA = 'hydro-placar-seguranca-v1'

export function getDataPadraoInicio(diasAtras = 145): string {
  const d = new Date()
  d.setDate(d.getDate() - diasAtras)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const CONFIG_PADRAO_PLACAR: PlacarSegurancaConfig = {
  dataUltimoAcidenteComAfastamento: getDataPadraoInicio(180),
  dataUltimoAcidenteSemAfastamento: getDataPadraoInicio(45),
  metaDias: 365,
  recordeHistoricoDias: 420,
  observacao: 'Foco contínuo em zero acidentes na frente de serviço.',
}

/**
 * Calcula a quantidade de dias corridos entre uma data de referência e hoje
 */
export function calcularDiasSemAcidente(dataStr?: string | null, hoje = new Date()): number {
  if (!dataStr) return 0
  const match = String(dataStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return 0

  const ano = Number(match[1])
  const mes = Number(match[2]) - 1
  const dia = Number(match[3])

  const inicio = new Date(ano, mes, dia)
  inicio.setHours(0, 0, 0, 0)

  const atual = new Date(hoje)
  atual.setHours(0, 0, 0, 0)

  const diffMs = atual.getTime() - inicio.getTime()
  if (diffMs < 0) return 0

  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Calcula o progresso percentual e dias restantes para a meta
 */
export function calcularProgressoMeta(
  diasAtuais: number,
  metaDias: number
): { porcentagem: number; diasRestantes: number; metaBatida: boolean } {
  const meta = metaDias > 0 ? metaDias : 1
  const porcentagem = Math.min(100, Math.round((diasAtuais / meta) * 100))
  const diasRestantes = Math.max(0, meta - diasAtuais)
  const metaBatida = diasAtuais >= meta

  return { porcentagem, diasRestantes, metaBatida }
}

/**
 * Determina o feito alcançado com base na quantidade de dias e metas
 */
export function obterFeitoSeguranca(
  dias: number,
  meta = 365,
  recorde = 365
): FeitoSegurancaInfo {
  if (dias >= recorde && recorde > 0) {
    return {
      nivel: 'recorde',
      titulo: 'Novo Recorde Histórico!',
      subtitulo: `Superamos a maior marca de segurança da obra com ${dias} dias!`,
      icone: '🏆',
      corHex: '#B45309',
      badgeBg: 'bg-amber-100 dark:bg-amber-950/70',
      badgeTexto: 'text-amber-900 dark:text-amber-200',
      bordaHex: '#F59E0B',
      gradienteBg: 'from-amber-500/10 via-yellow-500/5 to-transparent',
    }
  }

  if (dias >= 365) {
    return {
      nivel: 'diamante',
      titulo: 'Feito Diamante — Mais de 1 Ano!',
      subtitulo: `${Math.floor(dias / 365)} ano(s) de trabalho seguro com zero acidentes graves.`,
      icone: '💎',
      corHex: '#0284C7',
      badgeBg: 'bg-sky-100 dark:bg-sky-950/70',
      badgeTexto: 'text-sky-900 dark:text-sky-200',
      bordaHex: '#0EA5E9',
      gradienteBg: 'from-sky-500/10 via-blue-500/5 to-transparent',
    }
  }

  if (dias >= 100) {
    return {
      nivel: 'ouro',
      titulo: 'Feito Ouro — Mais de 100 Dias!',
      subtitulo: 'Compromisso diário e cultura de segurança consolidada na equipe.',
      icone: '🥇',
      corHex: '#D97706',
      badgeBg: 'bg-amber-100 dark:bg-amber-950/70',
      badgeTexto: 'text-amber-900 dark:text-amber-200',
      bordaHex: '#F59E0B',
      gradienteBg: 'from-amber-500/10 via-yellow-500/5 to-transparent',
    }
  }

  if (dias >= 60) {
    return {
      nivel: 'prata',
      titulo: 'Feito Prata — Mais de 60 Dias!',
      subtitulo: 'Dois meses ininterruptos sem acidentes com afastamento.',
      icone: '🥈',
      corHex: '#475569',
      badgeBg: 'bg-slate-100 dark:bg-slate-900/70',
      badgeTexto: 'text-slate-800 dark:text-slate-200',
      bordaHex: '#94A3B8',
      gradienteBg: 'from-slate-500/10 via-gray-500/5 to-transparent',
    }
  }

  if (dias >= 30) {
    return {
      nivel: 'bronze',
      titulo: 'Feito Bronze — Mais de 30 Dias!',
      subtitulo: 'Primeiro grande marco de 1 mês completo sem acidentes superado!',
      icone: '🥉',
      corHex: '#9A3412',
      badgeBg: 'bg-orange-100 dark:bg-orange-950/70',
      badgeTexto: 'text-orange-900 dark:text-orange-200',
      bordaHex: '#F97316',
      gradienteBg: 'from-orange-500/10 via-amber-500/5 to-transparent',
    }
  }

  return {
    nivel: 'inicio',
    titulo: 'Rumo à Meta de Segurança!',
    subtitulo: 'Cada dia seguro é uma conquista importante para toda a equipe.',
    icone: '🎯',
    corHex: '#16A34A',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-950/70',
    badgeTexto: 'text-emerald-900 dark:text-emerald-200',
    bordaHex: '#10B981',
    gradienteBg: 'from-emerald-500/10 via-green-500/5 to-transparent',
  }
}

export function getDbKeyPlacarSeguranca(env = 'barcarena'): string {
  return `placar_seguranca_${env}`
}

/**
 * Carrega a configuração do placar do Supabase com fallback para localStorage
 */
export async function carregarPlacarSeguranca(env = 'barcarena'): Promise<PlacarSegurancaConfig> {
  const dbKey = getDbKeyPlacarSeguranca(env)
  const lsKey = getLsKeyPlacarSeguranca(env)
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', dbKey)
      .maybeSingle()

    if (!error && data?.value && typeof data.value === 'object') {
      const cfg = { ...CONFIG_PADRAO_PLACAR, ...(data.value as Partial<PlacarSegurancaConfig>) }
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(lsKey, JSON.stringify(cfg))
        } catch (_) {}
      }
      return cfg
    }
  } catch (err) {
    console.warn('[PlacarSegurança] Erro ao carregar do Supabase:', err)
  }

  // Fallback LocalStorage específico do ambiente
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(lsKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') {
          return { ...CONFIG_PADRAO_PLACAR, ...parsed }
        }
      }
    } catch (_) {}
  }

  return CONFIG_PADRAO_PLACAR
}

/**
 * Salva a configuração do placar no Supabase e no localStorage
 */
export async function salvarPlacarSeguranca(
  config: PlacarSegurancaConfig,
  env = 'barcarena'
): Promise<boolean> {
  const dbKey = getDbKeyPlacarSeguranca(env)
  const lsKey = getLsKeyPlacarSeguranca(env)
  const payload = {
    ...config,
    atualizadoEm: new Date().toISOString(),
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(lsKey, JSON.stringify(payload))
      window.dispatchEvent(new CustomEvent('sucena_placar_seguranca_updated', { detail: { ...payload, env } }))
    } catch (e) {
      console.warn('[PlacarSegurança] Erro no LocalStorage:', e)
    }
  }

  try {
    const { error } = await supabase
      .from('global_settings')
      .upsert(
        { key: dbKey, value: payload, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
    return !error
  } catch (err) {
    console.warn('[PlacarSegurança] Erro ao persistir no Supabase:', err)
    return false
  }
}

