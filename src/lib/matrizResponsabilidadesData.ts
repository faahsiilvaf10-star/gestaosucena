import { supabase } from './supabase'

export const FORMS_URL_MATRIZ =
  'https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=kYkdvChKUkWrwaznrhCCdO-80STG5SxAvb9Y_fx1cCNUQjVWRVRNSlE0Q08xNFhVNlFDSEFVTUJFNy4u'

export interface AtividadeMatriz {
  nome: string
  marks: number // 0 a 3
  pers?: boolean
}

export interface CargoMatrizDef {
  id: string
  nome: string
  total: number
  cor: string
  icone: string
  atividades: string[]
}

export interface ColaboradorMatrizRH {
  id: string
  nome: string
  cargo: string
  status?: string
}

export const CARGOS_MATRIZ: CargoMatrizDef[] = [
  {
    id: 'preposto',
    nome: 'Preposto',
    total: 5,
    cor: '#3b82f6',
    icone: '🏛️',
    atividades: [
      'DDS de Liderança',
      'WOC - Caminhar, Observar e Conversar',
      'Observação de Tarefas',
      'Inspeção em HSE',
      'Roda de Conversa',
    ],
  },
  {
    id: 'enc-geral',
    nome: 'Encarregado Geral',
    total: 3,
    cor: '#a855f7',
    icone: '⚛️',
    atividades: [
      'Evento sem Lesão / Condição de Risco',
      'Observação de Tarefa',
      'Inspeção de HSE',
    ],
  },
  {
    id: 'enc-1',
    nome: 'Encarregado I',
    total: 3,
    cor: '#f97316',
    icone: '⛑️',
    atividades: [
      'Evento sem Lesão / Condição de Risco',
      'Observação de Tarefa',
      'Inspeção de HSE',
    ],
  },
  {
    id: 'enc-2',
    nome: 'Encarregado II',
    total: 3,
    cor: '#22c55e',
    icone: '🪖',
    atividades: [
      'Evento sem Lesão / Condição de Risco',
      'Observação de Tarefa',
      'Inspeção de HSE',
    ],
  },
  {
    id: 'tec-1',
    nome: 'Téc. Segurança I',
    total: 7,
    cor: '#f43f5e',
    icone: '🛡️',
    atividades: [
      'DDS da Liderança',
      'WOC - Caminhar, Observar e Conversar',
      'Inspeção de HSE',
      'Evento sem Lesão / Condição de Risco (ALTO RISCO)',
      'Coach em HSE',
      'Observação de Tarefa',
      'Evento sem Lesão / Condição de Risco',
    ],
  },
  {
    id: 'tec-2',
    nome: 'Téc. Segurança II',
    total: 7,
    cor: '#ec4899',
    icone: '🛡️',
    atividades: [
      'DDS da Liderança',
      'WOC - Caminhar, Observar e Conversar',
      'Inspeção de HSE',
      'Evento sem Lesão / Condição de Risco (ALTO RISCO)',
      'Coach em HSE',
      'Observação de Tarefa',
      'Evento sem Lesão / Condição de Risco',
    ],
  },
]

export function ehPersonalizada(cargoId: string, index: number): boolean {
  return (cargoId === 'tec-1' || cargoId === 'tec-2') && index === 6
}

export function getMesKey(d: Date = new Date()): string {
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  return `${ano}-${mes}`
}

export function getMesNome(d: Date = new Date()): string {
  const meses = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ]
  return meses[d.getMonth()]
}

export function getMesLabel(d: Date = new Date()): string {
  return `${getMesNome(d).toLowerCase()} de ${d.getFullYear()}`
}

export function criarEstadoInicial(): Record<string, AtividadeMatriz[]> {
  const init: Record<string, AtividadeMatriz[]> = {}
  for (const cargo of CARGOS_MATRIZ) {
    init[cargo.id] = cargo.atividades.map((nome, i) => ({
      nome,
      marks: 0,
      pers: ehPersonalizada(cargo.id, i),
    }))
  }
  return init
}

export interface MatrizDbRecord {
  atividadesPorCargo: Record<string, AtividadeMatriz[]>
  customColaboradores?: ColaboradorMatrizRH[]
  updatedAt?: string
  updatedBy?: string
}

export function getStorageKey(mesKey: string, env: string = 'barcarena'): string {
  return `matriz_responsabilidade_${mesKey}_${env}`
}

/**
 * Carrega os dados da Matriz para um determinado mês no Supabase (com cache local).
 * Se o mês mudou (dia 01 de cada mês), a chave é outra e começa zerado, preservando o histórico.
 */
export async function carregarDadosMatriz(
  mesKey: string = getMesKey(),
  env: string = 'barcarena'
): Promise<MatrizDbRecord> {
  const key = getStorageKey(mesKey, env)
  const localKey = `hydro-matriz-v2-${mesKey}`

  try {
    const { data } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()

    if (data?.value && typeof data.value === 'object') {
      const val = data.value as MatrizDbRecord
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(localKey, JSON.stringify(val.atividadesPorCargo))
        } catch (_) {}
      }
      return val
    }
  } catch (err) {
    console.warn('[Matriz] Erro ao carregar do Supabase:', err)
  }

  // Fallback LocalStorage
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem(localKey)
      if (local) {
        const parsed = JSON.parse(local)
        return {
          atividadesPorCargo: parsed,
        }
      }
    } catch (_) {}
  }

  return {
    atividadesPorCargo: criarEstadoInicial(),
    customColaboradores: [],
  }
}

/**
 * Salva os dados da Matriz para o mês no Supabase e LocalStorage.
 */
export async function salvarDadosMatriz(
  dados: MatrizDbRecord,
  mesKey: string = getMesKey(),
  env: string = 'barcarena'
): Promise<boolean> {
  const key = getStorageKey(mesKey, env)
  const localKey = `hydro-matriz-v2-${mesKey}`

  // Salvar localmente primeiro para resposta instantânea
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(localKey, JSON.stringify(dados.atividadesPorCargo))
    } catch (_) {}
  }

  try {
    const payload = {
      ...dados,
      updatedAt: new Date().toISOString(),
    }
    const { error } = await supabase
      .from('global_settings')
      .upsert({ key, value: payload })

    return !error
  } catch (err) {
    console.warn('[Matriz] Erro ao salvar no Supabase:', err)
    return false
  }
}

/**
 * Métricas de um Cargo
 */
export function getMetricasCargo(
  cargo: CargoMatrizDef,
  atividades: AtividadeMatriz[] = []
) {
  const list = atividades.length > 0 ? atividades : cargo.atividades.map((n, i) => ({ nome: n, marks: 0, pers: ehPersonalizada(cargo.id, i) }))
  const totalAtividades = list.length
  const totalMarcacoesPossiveis = totalAtividades * 3
  const marcacoesFeitas = list.reduce((acc, a) => acc + Math.max(0, Math.min(3, a.marks || 0)), 0)
  const concluidas = list.filter((a) => (a.marks || 0) >= 3).length
  const porcentagem = totalMarcacoesPossiveis > 0 ? Math.round((marcacoesFeitas / totalMarcacoesPossiveis) * 100) : 0
  const isConcluidoTotal = totalAtividades > 0 && concluidas === totalAtividades

  return {
    totalAtividades,
    totalMarcacoesPossiveis,
    marcacoesFeitas,
    concluidas,
    porcentagem,
    isConcluidoTotal,
  }
}

/**
 * Métricas Gerais de todos os Cargos
 */
export function getMetricasGerais(
  atividadesPorCargo: Record<string, AtividadeMatriz[]>
) {
  let ativTotal = 0
  let marcTotal = 0
  let marcMax = 0
  let feitasTotal = 0
  let cargosConcluidos = 0

  for (const cargo of CARGOS_MATRIZ) {
    const m = getMetricasCargo(cargo, atividadesPorCargo[cargo.id])
    ativTotal += m.totalAtividades
    marcTotal += m.marcacoesFeitas
    marcMax += m.totalMarcacoesPossiveis
    feitasTotal += m.concluidas
    if (m.isConcluidoTotal) {
      cargosConcluidos++
    }
  }

  const pctGeral = marcMax > 0 ? Math.round((marcTotal / marcMax) * 100) : 0

  return {
    totalCargos: CARGOS_MATRIZ.length,
    cargosConcluidos,
    cargosPendentes: CARGOS_MATRIZ.length - cargosConcluidos,
    ativTotal,
    marcTotal,
    marcMax,
    feitasTotal,
    pctGeral,
  }
}

