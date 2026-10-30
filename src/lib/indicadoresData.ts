import { supabase } from './supabase'

export interface IndicadorConfig {
  id: string
  nome: string
  desc: string
  casas: number
  dir: 'menor' | 'maior'
  metaPadrao: number
  unidade: string
  dica: string
}

export interface IndicadoresRegistro {
  valores: Record<string, number | null>
  metas: Record<string, number | null>
  salvoEm: string
}

export type IndicadoresStore = Record<string, IndicadoresRegistro> // key: "YYYY-MM"

export const INDICADORES_LISTA: IndicadorConfig[] = [
  {
    id: 'tf',
    nome: 'TF — Taxa de Frequência',
    desc: 'Acidentes com e sem afastamento por 1 milhão de horas trabalhadas.',
    casas: 2,
    dir: 'menor',
    metaPadrao: 5,
    unidade: '',
    dica: 'Fórmula: acidentes × 1.000.000 ÷ HHT. Meta: ≤ 5,00 (quanto menor, melhor).',
  },
  {
    id: 'tg',
    nome: 'TG — Taxa de Gravidade',
    desc: 'Dias perdidos por 1 milhão de horas trabalhadas.',
    casas: 2,
    dir: 'menor',
    metaPadrao: 100,
    unidade: '',
    dica: 'Fórmula: dias perdidos × 1.000.000 ÷ HHT. Meta: ≤ 100 (quanto menor, melhor).',
  },
  {
    id: 'acidentes',
    nome: 'Nº de acidentes',
    desc: 'Acidentes com e sem afastamento registrados no mês.',
    casas: 0,
    dir: 'menor',
    metaPadrao: 0,
    unidade: '',
    dica: 'Meta: 0 acidente (quanto menor, melhor).',
  },
  {
    id: 'quase',
    nome: 'Quase acidentes',
    desc: 'Registros de quase acidente no mês. Reportar é positivo.',
    casas: 0,
    dir: 'maior',
    metaPadrao: 3,
    unidade: '',
    dica: 'Meta: ≥ 3 registros (quanto maior, melhor — mostra que a equipe está reportando).',
  },
  {
    id: 'dds',
    nome: 'DDS realizadas',
    desc: 'Diálogos Diários de Segurança realizados no mês.',
    casas: 0,
    dir: 'maior',
    metaPadrao: 20,
    unidade: '',
    dica: 'Meta: ≥ 20 DDS no mês (quanto maior, melhor).',
  },
  {
    id: 'desvAbertos',
    nome: 'Desvios abertos',
    desc: 'Desvios de segurança abertos no mês.',
    casas: 0,
    dir: 'menor',
    metaPadrao: 5,
    unidade: '',
    dica: 'Meta: ≤ 5 desvios abertos (quanto menor, melhor).',
  },
  {
    id: 'desvFechados',
    nome: 'Desvios fechados',
    desc: 'Desvios corrigidos e fechados no mês.',
    casas: 0,
    dir: 'maior',
    metaPadrao: 10,
    unidade: '',
    dica: 'Meta: ≥ 10 desvios fechados (quanto maior, melhor).',
  },
  {
    id: 'treinVencidos',
    nome: 'Treinamentos vencidos',
    desc: 'Colaboradores com treinamento obrigatório vencido.',
    casas: 0,
    dir: 'menor',
    metaPadrao: 0,
    unidade: '',
    dica: 'Meta: 0 treinamento vencido (quanto menor, melhor).',
  },
  {
    id: 'inspecoes',
    nome: 'Inspeções realizadas',
    desc: 'Inspeções de canteiro e de área realizadas no mês.',
    casas: 0,
    dir: 'maior',
    metaPadrao: 4,
    unidade: '',
    dica: 'Meta: ≥ 4 inspeções no mês (quanto maior, melhor).',
  },
]

export const EXEMPLO_INDICADORES: Record<string, number> = {
  tf: 4.2,
  tg: 85,
  acidentes: 2,
  quase: 6,
  dds: 22,
  desvAbertos: 4,
  desvFechados: 12,
  treinVencidos: 1,
  inspecoes: 5,
}

export const LS_KEY_INDICADORES = 'hydro-indicadores-v1'

const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function fmtMes(m?: string): string {
  if (!m) return '—'
  const p = String(m).split('-')
  if (p.length !== 2) return m
  const mesIdx = parseInt(p[1], 10) - 1
  return `${MESES_PT[mesIdx] || p[1]}/${p[0]}`
}

export function prevMes(m: string): string {
  const p = String(m).split('-')
  let a = parseInt(p[0], 10)
  let b = parseInt(p[1], 10) - 1
  if (b === 0) {
    a--
    b = 12
  }
  return `${a}-${String(b).padStart(2, '0')}`
}

export function mesAtualISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function fmtNum(v: number | null | undefined, casas = 0): string {
  if (v === null || v === undefined || isNaN(v)) return '—'
  return Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })
}

export function statusDe(
  ind: IndicadorConfig,
  valor: number | null | undefined,
  meta: number | null | undefined
): { cls: 'dentro' | 'fora' | 'sem'; badge: string; dentro: boolean | null } {
  if (valor === null || valor === undefined || isNaN(valor)) {
    return { cls: 'sem', badge: 'Sem dados', dentro: null }
  }
  if (meta === null || meta === undefined || isNaN(meta)) {
    return { cls: 'sem', badge: 'Sem meta', dentro: null }
  }
  const dentro = ind.dir === 'menor' ? valor <= meta : valor >= meta
  return {
    cls: dentro ? 'dentro' : 'fora',
    badge: dentro ? '🟢 Dentro da meta' : '🔴 Fora da meta',
    dentro,
  }
}

export function variacaoTxt(
  ind: IndicadorConfig,
  cur: number | null | undefined,
  prev: number | null | undefined
): string {
  if (cur === null || cur === undefined || isNaN(cur)) return 'Sem valor neste mês.'
  if (prev === null || prev === undefined || isNaN(prev))
    return 'Sem mês anterior salvo para comparar.'
  const diff = cur - prev
  const seta = diff > 0 ? '▲' : diff < 0 ? '▼' : '—'
  const pct =
    prev !== 0
      ? ` (${seta} ${Math.abs((diff / prev) * 100).toLocaleString('pt-BR', {
          maximumFractionDigits: 1,
        })}%)`
      : ''
  const sentido =
    diff === 0 ? 'sem alteração' : (ind.dir === 'menor' ? diff < 0 : diff > 0) ? 'melhorou' : 'piorou'
  return `${seta} ${fmtNum(Math.abs(diff), ind.casas)} vs mês anterior${pct} — ${sentido}.`
}

export function calcularTFTG(
  hht: number,
  acidentes: number,
  diasPerdidos: number
): { tf: number; tg: number } {
  if (hht <= 0) return { tf: 0, tg: 0 }
  const tf = Number(((acidentes * 1000000) / hht).toFixed(2))
  const tg = Number(((diasPerdidos * 1000000) / hht).toFixed(2))
  return { tf, tg }
}

export function gerarTextoRelatorioIndicadores(store: IndicadoresStore, mes: string): string {
  const rec = store[mes]
  let s =
    'RELATÓRIO MENSAL — INDICADORES DE SEGURANÇA (Hydro Reabilitação)\n' +
    `Mês: ${fmtMes(mes)} • Gerado em: ${new Date().toLocaleString('pt-BR')}\n\n`

  if (!rec) return s + `Sem dados salvos para ${fmtMes(mes)}.`

  let dentro = 0
  let comDados = 0
  INDICADORES_LISTA.forEach((ind) => {
    const v = rec.valores ? rec.valores[ind.id] : null
    if (v === null || v === undefined) return
    comDados++
    const st = statusDe(ind, v, rec.metas ? rec.metas[ind.id] : null)
    if (st.dentro === true) dentro++
  })

  s += `Resumo: ${dentro} de ${comDados} indicador(es) com dados dentro da meta.\n\n`

  INDICADORES_LISTA.forEach((ind, i) => {
    const v = rec.valores ? rec.valores[ind.id] : null
    const meta = rec.metas ? rec.metas[ind.id] : ind.metaPadrao
    const st = statusDe(ind, v, meta)
    const prev = store[prevMes(mes)]
    const prevV = prev && prev.valores ? prev.valores[ind.id] : null

    s += `${i + 1}. ${ind.nome}: ${fmtNum(v, ind.casas)} • Meta: ${
      ind.dir === 'menor' ? '≤' : '≥'
    } ${fmtNum(meta, ind.casas)} • ${
      v === null
        ? 'SEM DADOS'
        : st.dentro === true
          ? 'DENTRO DA META'
          : st.dentro === false
            ? 'FORA DA META'
            : 'SEM META'
    }\n`
    s += `   Comparativo com ${fmtMes(prevMes(mes))}: ${
      v === null
        ? 'sem valor neste mês.'
        : prevV === null
          ? 'sem mês anterior salvo.'
          : variacaoTxt(ind, v, prevV)
    }\n`
  })

  return s
}

export function getDbKeyIndicadores(env = 'barcarena'): string {
  return `indicadores_seguranca_${env}`
}

/**
 * Carrega a store de indicadores do Supabase (global_settings) com fallback para localStorage
 */
export async function carregarIndicadoresStore(env = 'barcarena'): Promise<IndicadoresStore> {
  const dbKey = getDbKeyIndicadores(env)
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', dbKey)
      .maybeSingle()

    if (!error && data?.value && typeof data.value === 'object') {
      const store = data.value as IndicadoresStore
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(LS_KEY_INDICADORES, JSON.stringify(store))
        } catch (_) {}
      }
      return store
    }
  } catch (err) {
    console.warn('[Indicadores] Erro ao carregar do Supabase:', err)
  }

  // Fallback LocalStorage
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LS_KEY_INDICADORES)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') return parsed
      }
    } catch (_) {}
  }

  return {}
}

/**
 * Salva a store de indicadores no Supabase e no localStorage
 */
export async function salvarIndicadoresStore(
  store: IndicadoresStore,
  env = 'barcarena'
): Promise<boolean> {
  const dbKey = getDbKeyIndicadores(env)

  // Salvar no localStorage imediatamente
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LS_KEY_INDICADORES, JSON.stringify(store))
    } catch (e) {
      console.warn('[Indicadores] Erro ao salvar no LocalStorage:', e)
    }
  }

  try {
    const { error } = await supabase
      .from('global_settings')
      .upsert(
        { key: dbKey, value: lista, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
    return !error
  } catch (err) {
    console.warn('[Indicadores] Erro ao persistir no Supabase:', err)
    return false
  }
}

