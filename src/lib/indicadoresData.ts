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
  origemTexto?: string
  origemRota?: string
}

export interface IndicadoresRegistro {
  valores: Record<string, number | null>
  metas: Record<string, number | null>
  salvoEm: string
  vinculadoAoMesmoSistema?: boolean
}

export type IndicadoresStore = Record<string, IndicadoresRegistro> // key: "YYYY-MM"

export interface IndicadorOrigemInfo {
  id: string
  valor: number | null
  origem: string
  rotulo: string
  link?: string
  descricaoDetalhada: string
}

export interface IndicadoresAutomaticos {
  mes: string
  valores: Record<string, number | null>
  detalhes: {
    ddsFotos: number
    acidentesAnexos: number
    quaseAnexos: number
    desviosAbertos: number
    desviosFechados: number
    treinamentosVencidos: number
    inspecoesCanteiro: number
    inspecoesCintas: number
    inspecoesTotal: number
  }
  origens: Record<string, IndicadorOrigemInfo>
}

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
    origemTexto: 'Calculada com base no Nº de Acidentes e Horas Trabalhadas (HHT)',
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
    origemTexto: 'Calculada com base nos Dias Perdidos e Horas Trabalhadas (HHT)',
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
    origemTexto: 'Vinculado aos anexos de acidentes no Relatório de Ocorrências',
    origemRota: '/seguranca/relatorio-ocorrencia',
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
    origemTexto: 'Vinculado aos registros de quase acidentes no Relatório de Ocorrências',
    origemRota: '/seguranca/relatorio-ocorrencia',
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
    origemTexto: 'Vinculado a cada foto de DDS adicionada no Instacena / DDS do Dia',
    origemRota: '/seguranca/dds',
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
    origemTexto: 'Vinculado aos desvios em aberto na página de Desvios de Segurança',
    origemRota: '/seguranca/desvios',
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
    origemTexto: 'Vinculado aos desvios corrigidos/fechados na página de Desvios',
    origemRota: '/seguranca/desvios',
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
    origemTexto: 'Vinculado aos treinamentos expirados no Controle de Treinamento',
    origemRota: '/seguranca/controle-treinamento',
  },
  {
    id: 'inspecoes',
    nome: 'Inspeções realizadas',
    desc: 'Inspeções de canteiro e de cintas de içamento realizadas no mês.',
    casas: 0,
    dir: 'maior',
    metaPadrao: 4,
    unidade: '',
    dica: 'Meta: ≥ 4 inspeções no mês (quanto maior, melhor).',
    origemTexto: 'Vinculado à soma de inspeções de canteiro e vistorias de cintas',
    origemRota: '/seguranca/inspecao-canteiro',
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

    s += `${i + 1}. ${ind.nome}: ${fmtNum(v, ind.casas)} • Meta: ${ind.dir === 'menor' ? '≤' : '≥'
      } ${fmtNum(meta, ind.casas)} • ${v === null
        ? 'SEM DADOS'
        : st.dentro === true
          ? 'DENTRO DA META'
          : st.dentro === false
            ? 'FORA DA META'
            : 'SEM META'
      }\n`
    s += `   Comparativo com ${fmtMes(prevMes(mes))}: ${v === null
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
 * Converte diferentes formatos de data (ISO ou DD/MM/AAAA) para YYYY-MM
 */
export function extrairMesDeDataStr(str?: string | null): string | null {
  if (!str) return null
  const limpo = String(str).trim()

  // Formato ISO: YYYY-MM ou YYYY-MM-DD...
  const matchIso = limpo.match(/^(\d{4})-(\d{2})/)
  if (matchIso) {
    return `${matchIso[1]}-${matchIso[2]}`
  }

  // Formato BR: DD/MM/YYYY...
  const matchBr = limpo.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (matchBr) {
    return `${matchBr[3]}-${matchBr[2]}`
  }

  return null
}

/**
 * Conta o número de postagens/fotos de DDS no mês especificado
 */
export function contarDdsMes(
  posts: Array<{ created_at?: string; caption?: string }>,
  mes: string
): number {
  if (!Array.isArray(posts)) return 0
  return posts.filter((p) => {
    if (!p) return false
    const mesPost = extrairMesDeDataStr(p.created_at)
    if (mesPost !== mes) return false
    const cap = String(p.caption || '').toLowerCase()
    return cap.includes('dds') || cap.includes('diálogo de segurança')
  }).length
}

/**
 * Conta ocorrências (acidentes e quase acidentes) do mês a partir dos anexos arquivados
 */
export function contarOcorrenciasMes(
  arquivos: Array<{ anexadoEm?: string; nome?: string; titulo?: string }>,
  mes: string
): { acidentes: number; quase: number } {
  let acidentes = 0
  let quase = 0

  if (!Array.isArray(arquivos)) return { acidentes: 0, quase: 0 }

  arquivos.forEach((arq) => {
    if (!arq) return
    const mesArq = extrairMesDeDataStr(arq.anexadoEm)
    if (mesArq !== mes) return

    const texto = `${arq.titulo || ''} ${arq.nome || ''}`.toLowerCase()
    if (texto.includes('quase')) {
      quase++
    } else {
      acidentes++
    }
  })

  return { acidentes, quase }
}

/**
 * Conta desvios abertos e desvios fechados
 */
export function contarDesviosMes(
  desvios: Array<any>,
  mes: string,
  mesAtual = mesAtualISO()
): { desvAbertos: number; desvFechados: number } {
  let desvAbertos = 0
  let desvFechados = 0

  if (!Array.isArray(desvios)) return { desvAbertos: 0, desvFechados: 0 }

  desvios.forEach((d) => {
    if (!d) return
    const status = String(d.statusFluxo || '').toLowerCase()
    const isCorrigido = d.corrigido === true || status === 'corrigido'
    const isCancelado = status === 'cancelado'

    if (isCancelado) return

    if (isCorrigido) {
      const mesCorrecao =
        extrairMesDeDataStr(d.dataCorrecao) ||
        extrairMesDeDataStr(d.dataRegistro) ||
        extrairMesDeDataStr(d.salvoEm)
      if (mesCorrecao === mes) {
        desvFechados++
      }
    } else {
      const mesReg = extrairMesDeDataStr(d.dataRegistro) || extrairMesDeDataStr(d.salvoEm)
      // Se for o mês corrente, conta todos os desvios abertos no sistema
      if (mes === mesAtual) {
        desvAbertos++
      } else if (mesReg === mes) {
        desvAbertos++
      }
    }
  })

  return { desvAbertos, desvFechados }
}

/**
 * Conta treinamentos obrigatórios vencidos
 */
export function contarTreinamentosVencidos(
  treinamentos: Array<{ expira?: string }>,
  dataRef = new Date()
): number {
  if (!Array.isArray(treinamentos)) return 0
  const ref = new Date(dataRef)
  ref.setHours(0, 0, 0, 0)

  return treinamentos.filter((t) => {
    if (!t || !t.expira) return false
    const match = String(t.expira).match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!match) return false
    const exp = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    exp.setHours(0, 0, 0, 0)
    return exp.getTime() < ref.getTime()
  }).length
}

/**
 * Conta inspeções realizadas no mês (canteiro + cintas)
 */
export function contarInspecoesMes(
  inspecoesCanteiro: Array<{ data?: string; salvoEm?: string }>,
  inspecoesCintas: Array<{ inspecionadaEm?: string; data_inspecao?: string; created_at?: string; status?: string }>,
  mes: string
): { canteiro: number; cintas: number; total: number } {
  let canteiro = 0
  let cintas = 0

  if (Array.isArray(inspecoesCanteiro)) {
    inspecoesCanteiro.forEach((i) => {
      if (!i) return
      const mesData = extrairMesDeDataStr(i.data) || extrairMesDeDataStr(i.salvoEm)
      if (mesData === mes) {
        canteiro++
      }
    })
  }

  if (Array.isArray(inspecoesCintas)) {
    inspecoesCintas.forEach((c) => {
      if (!c) return
      const st = String(c.status || '').toLowerCase()
      if (st && st !== 'inspecionada') return

      const mesCinta =
        extrairMesDeDataStr(c.data_inspecao) ||
        extrairMesDeDataStr(c.inspecionadaEm) ||
        extrairMesDeDataStr(c.created_at)

      if (mesCinta === mes) {
        cintas++
      }
    })
  }

  return { canteiro, cintas, total: canteiro + cintas }
}

/**
 * Busca dados em tempo real de todas as tabelas e módulos vinculados do sistema
 * e calcula os 9 indicadores para o mês informado.
 */
export async function obterIndicadoresAutomaticosDoMes(
  mes: string,
  env = 'barcarena'
): Promise<IndicadoresAutomaticos> {
  const mesAtual = mesAtualISO()

  // 1. Fotos de DDS (social_posts)
  let ddsPosts: Array<{ created_at?: string; caption?: string; location?: string }> = []
  try {
    const { data } = await supabase
      .from('social_posts')
      .select('id, created_at, caption, location')
      .ilike('caption', '%dds%')
    if (data && Array.isArray(data)) {
      const isCivil = env === 'hydro-civil'
      ddsPosts = data.filter((p: any) => {
        const loc = (p.location || '').toUpperCase()
        const cap = (p.caption || '').toUpperCase()
        const isCivilPost = loc.includes('CIVIL') || cap.includes('[HYDRO CIVIL]')
        return isCivil ? isCivilPost : !isCivilPost
      })
    }
  } catch (err) {
    console.warn('[Indicadores] Aviso ao consultar fotos de DDS no social_posts:', err)
  }

  // 2. Anexos de Ocorrências (Relatório de Ocorrências)
  let ocorrenciasArquivos: Array<any> = []
  const keyOcorr = `ocorrencias_arquivos_${env}`
  try {
    const { data } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', keyOcorr)
      .maybeSingle()
    if (data?.value && Array.isArray(data.value)) {
      ocorrenciasArquivos = data.value
    } else if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('hydro-arquivos-ocorrencia')
      if (raw) ocorrenciasArquivos = JSON.parse(raw)
    }
  } catch (err) {
    console.warn('[Indicadores] Aviso ao consultar ocorrências:', err)
  }

  // 3. Desvios de Segurança
  let desviosList: Array<any> = []
  const keyDesv = `desvios_seguranca_${env}`
  try {
    const { data } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', keyDesv)
      .maybeSingle()
    if (data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value
      if (Array.isArray(parsed)) desviosList = parsed
    } else if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(keyDesv)
      if (raw) desviosList = JSON.parse(raw)
    }
  } catch (err) {
    console.warn('[Indicadores] Aviso ao consultar desvios:', err)
  }

  // 4. Controle de Treinamento
  let treinamentosList: Array<any> = []
  const keyTrein = `controle_treinamento_${env}`
  try {
    const { data } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', keyTrein)
      .maybeSingle()
    if (data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value
      if (Array.isArray(parsed)) treinamentosList = parsed
    } else if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(keyTrein)
      if (raw) treinamentosList = JSON.parse(raw)
    }
  } catch (err) {
    console.warn('[Indicadores] Aviso ao consultar treinamentos:', err)
  }

  // 5. Inspeções de Canteiro
  let inspecoesCanteiroList: Array<any> = []
  const keyCanteiro = `canteiro_inspecoes_${env}`
  try {
    const { data } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', keyCanteiro)
      .maybeSingle()
    if (data?.value && Array.isArray(data.value)) {
      inspecoesCanteiroList = data.value
    } else if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(keyCanteiro)
      if (raw) inspecoesCanteiroList = JSON.parse(raw)
    }
  } catch (err) {
    console.warn('[Indicadores] Aviso ao consultar inspeções de canteiro:', err)
  }

  // 6. Inspeções de Cintas
  let inspecoesCintasList: Array<any> = []
  try {
    const [histRes, cintasRes] = await Promise.all([
      supabase.from('seguranca_cintas_historico').select('*'),
      supabase.from('seguranca_cintas').select('id, inspecionada_em, status, updated_at'),
    ])

    const cintasMap = new Map<string, any>()
    if (histRes.data && Array.isArray(histRes.data)) {
      histRes.data.forEach((h: any) => {
        cintasMap.set(`${h.cinta_id || h.id}-${h.data_inspecao}`, {
          data_inspecao: h.data_inspecao,
          status: h.status || 'Inspecionada',
        })
      })
    }

    if (cintasRes.data && Array.isArray(cintasRes.data)) {
      cintasRes.data.forEach((c: any) => {
        if (c.status === 'Inspecionada' && c.inspecionada_em) {
          cintasMap.set(`cinta-${c.id}-${c.inspecionada_em}`, {
            inspecionadaEm: c.inspecionada_em,
            status: c.status,
            created_at: c.updated_at,
          })
        }
      })
    }

    inspecoesCintasList = Array.from(cintasMap.values())
  } catch (err) {
    console.warn('[Indicadores] Aviso ao consultar inspeções de cintas:', err)
  }

  // Executar os cálculos
  const ddsCount = contarDdsMes(ddsPosts, mes)
  const ocorrencias = contarOcorrenciasMes(ocorrenciasArquivos, mes)
  const desvios = contarDesviosMes(desviosList, mes, mesAtual)
  const treinVencidos = contarTreinamentosVencidos(treinamentosList)
  const inspecoes = contarInspecoesMes(inspecoesCanteiroList, inspecoesCintasList, mes)

  const valores: Record<string, number | null> = {
    dds: ddsCount,
    acidentes: ocorrencias.acidentes,
    quase: ocorrencias.quase,
    desvAbertos: desvios.desvAbertos,
    desvFechados: desvios.desvFechados,
    treinVencidos: treinVencidos,
    inspecoes: inspecoes.total,
    tf: null,
    tg: null,
  }

  const origens: Record<string, IndicadorOrigemInfo> = {
    dds: {
      id: 'dds',
      valor: ddsCount,
      origem: 'Instacena & DDS',
      rotulo: `${ddsCount} foto(s) de DDS postada(s) no mês`,
      link: '/seguranca/dds',
      descricaoDetalhada: `${ddsCount} postagem(ns) de DDS com foto adicionada no mês ${fmtMes(mes)}`,
    },
    acidentes: {
      id: 'acidentes',
      valor: ocorrencias.acidentes,
      origem: 'Relatório de Ocorrências',
      rotulo: `${ocorrencias.acidentes} anexo(s) de acidente(s)`,
      link: '/seguranca/relatorio-ocorrencia',
      descricaoDetalhada: `${ocorrencias.acidentes} arquivo(s) de ocorrência de acidente anexados em ${fmtMes(mes)}`,
    },
    quase: {
      id: 'quase',
      valor: ocorrencias.quase,
      origem: 'Relatório de Ocorrências',
      rotulo: `${ocorrencias.quase} quase acidente(s) anexado(s)`,
      link: '/seguranca/relatorio-ocorrencia',
      descricaoDetalhada: `${ocorrencias.quase} quase acidente(s) identificados por anexos em ${fmtMes(mes)}`,
    },
    desvAbertos: {
      id: 'desvAbertos',
      valor: desvios.desvAbertos,
      origem: 'Desvios de Segurança',
      rotulo: `${desvios.desvAbertos} desvio(s) em aberto`,
      link: '/seguranca/desvios',
      descricaoDetalhada: `${desvios.desvAbertos} desvio(s) pendente(s) de correção no sistema`,
    },
    desvFechados: {
      id: 'desvFechados',
      valor: desvios.desvFechados,
      origem: 'Desvios de Segurança',
      rotulo: `${desvios.desvFechados} desvio(s) corrigido(s)/fechado(s)`,
      link: '/seguranca/desvios',
      descricaoDetalhada: `${desvios.desvFechados} desvio(s) com status corrigido em ${fmtMes(mes)}`,
    },
    treinVencidos: {
      id: 'treinVencidos',
      valor: treinVencidos,
      origem: 'Controle de Treinamento',
      rotulo: `${treinVencidos} treinamento(s) vencido(s)`,
      link: '/seguranca/controle-treinamento',
      descricaoDetalhada: `${treinVencidos} colaborador(es) com NR obrigatória com data expirada`,
    },
    inspecoes: {
      id: 'inspecoes',
      valor: inspecoes.total,
      origem: 'Inspeções de Canteiro & Cintas',
      rotulo: `${inspecoes.total} inspeção(ões) (${inspecoes.canteiro} canteiro + ${inspecoes.cintas} cintas)`,
      link: '/seguranca/inspecao-canteiro',
      descricaoDetalhada: `${inspecoes.canteiro} inspeções de canteiro e ${inspecoes.cintas} vistorias de cintas realizadas em ${fmtMes(mes)}`,
    },
  }

  return {
    mes,
    valores,
    detalhes: {
      ddsFotos: ddsCount,
      acidentesAnexos: ocorrencias.acidentes,
      quaseAnexos: ocorrencias.quase,
      desviosAbertos: desvios.desvAbertos,
      desviosFechados: desvios.desvFechados,
      treinamentosVencidos: treinVencidos,
      inspecoesCanteiro: inspecoes.canteiro,
      inspecoesCintas: inspecoes.cintas,
      inspecoesTotal: inspecoes.total,
    },
    origens,
  }
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
        } catch (_) { }
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
    } catch (_) { }
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
        { key: dbKey, value: store, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
    return !error
  } catch (err) {
    console.warn('[Indicadores] Erro ao persistir no Supabase:', err)
    return false
  }
}
