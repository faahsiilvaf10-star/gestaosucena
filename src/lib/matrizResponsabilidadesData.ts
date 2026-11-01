import { supabase } from './supabase'

export const FORMS_URL_MATRIZ =
  'https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=kYkdvChKUkWrwaznrhCCdO-80STG5SxAvb9Y_fx1cCNUQjVWRVRNSlE0Q08xNFhVNlFDSEFVTUJFNy4u'

export interface AtividadeMatriz {
  nome: string
  marks: number // 0 a total (padrão: 3)
  total?: number // caixinhas para marcar como concluído (padrão: 3)
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
  cargos?: CargoMatrizDef[]
  customColaboradores?: ColaboradorMatrizRH[]
  atribuicoesManual?: Record<string, string>
  atribuicoesAtividades?: Record<string, string[]>
  tituloMatriz?: string
  iconeMatriz?: string
  updatedAt?: string
  updatedBy?: string
}

export function getStorageKey(mesKey: string, env: string = 'barcarena'): string {
  return `matriz_responsabilidade_${mesKey}_${env}`
}

export function getMasterConfigKey(env: string = 'barcarena'): string {
  return `matriz_master_config_${env}`
}

/**
 * Busca a configuração mestre permanente da equipe (atribuições e cargos)
 */
export async function carregarMasterConfigMatriz(env: string = 'barcarena'): Promise<Partial<MatrizDbRecord> | null> {
  const masterKey = getMasterConfigKey(env)
  try {
    const { data } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', masterKey)
      .maybeSingle()

    if (data?.value && typeof data.value === 'object') {
      return data.value as Partial<MatrizDbRecord>
    }
  } catch (err) {
    console.warn('[Matriz] Erro ao carregar master config:', err)
  }

  // Fallback LocalStorage
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem(`hydro-matriz-master-${env}`)
      if (local) {
        return JSON.parse(local)
      }
    } catch (_) {}
  }

  return null
}

/**
 * Carrega os dados da Matriz para um determinado mês no Supabase (com cache local).
 * Se o mês mudou (dia 01 de cada mês), preserva automaticamente as atribuições da equipe,
 * cargos customizados e configurações, iniciando apenas as marcações zeradas para o novo ciclo.
 */
export async function carregarDadosMatriz(
  mesKey: string = getMesKey(),
  env: string = 'barcarena'
): Promise<MatrizDbRecord> {
  const key = getStorageKey(mesKey, env)
  const localKey = `hydro-matriz-v2-${mesKey}`

  let result: MatrizDbRecord | null = null

  try {
    const { data } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()

    if (data?.value && typeof data.value === 'object') {
      result = data.value as MatrizDbRecord
    }
  } catch (err) {
    console.warn('[Matriz] Erro ao carregar do Supabase:', err)
  }

  // Fallback LocalStorage se Supabase falhar
  if (!result && typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem(localKey)
      if (local) {
        const parsed = JSON.parse(local)
        if (parsed && typeof parsed === 'object') {
          result = parsed.atividadesPorCargo ? (parsed as MatrizDbRecord) : { atividadesPorCargo: parsed }
        }
      }
    } catch (_) {}
  }

  // Se não existir dados do mês, cria estado inicial
  if (!result) {
    result = {
      atividadesPorCargo: criarEstadoInicial(),
      customColaboradores: [],
    }
  }

  // =========================================================================
  // GARANTIA DE PERSISTÊNCIA DAS ATRIBUIÇÕES:
  // Se o mês não tem atribuições manuais ou cargos customizados, herda da
  // configuração mestre permanente ou do mês mais recente que contenha atribuições.
  // =========================================================================
  const temAtribuicoes = result.atribuicoesManual && Object.keys(result.atribuicoesManual).length > 0
  const temCargos = result.cargos && result.cargos.length > 0

  if (!temAtribuicoes || !temCargos) {
    // 1. Tenta carregar da configuração mestre
    const master = await carregarMasterConfigMatriz(env)
    let herdou = false

    if (master) {
      if (!temAtribuicoes && master.atribuicoesManual && Object.keys(master.atribuicoesManual).length > 0) {
        result.atribuicoesManual = { ...master.atribuicoesManual }
        herdou = true
      }
      if (!temCargos && master.cargos && master.cargos.length > 0) {
        result.cargos = master.cargos
        herdou = true
      }
      if (master.atribuicoesAtividades && (!result.atribuicoesAtividades || Object.keys(result.atribuicoesAtividades).length === 0)) {
        result.atribuicoesAtividades = { ...master.atribuicoesAtividades }
      }
      if (master.customColaboradores && (!result.customColaboradores || result.customColaboradores.length === 0)) {
        result.customColaboradores = master.customColaboradores
      }
      if (master.tituloMatriz && !result.tituloMatriz) result.tituloMatriz = master.tituloMatriz
      if (master.iconeMatriz && !result.iconeMatriz) result.iconeMatriz = master.iconeMatriz
    }

    // 2. Se a chave mestre ainda não tinha, tenta buscar do mês anterior ou histórico
    if (!herdou) {
      try {
        const { data: historico } = await supabase
          .from('global_settings')
          .select('key, value')
          .like('key', `matriz_responsabilidade_%_${env}`)
          .order('key', { ascending: false })
          .limit(5)

        if (historico && Array.isArray(historico)) {
          for (const item of historico) {
            if (item.value && typeof item.value === 'object') {
              const hVal = item.value as MatrizDbRecord
              if (hVal.atribuicoesManual && Object.keys(hVal.atribuicoesManual).length > 0) {
                result.atribuicoesManual = { ...hVal.atribuicoesManual }
                if (hVal.cargos && hVal.cargos.length > 0) result.cargos = hVal.cargos
                if (hVal.atribuicoesAtividades) result.atribuicoesAtividades = hVal.atribuicoesAtividades
                if (hVal.customColaboradores) result.customColaboradores = hVal.customColaboradores
                if (hVal.tituloMatriz) result.tituloMatriz = hVal.tituloMatriz
                if (hVal.iconeMatriz) result.iconeMatriz = hVal.iconeMatriz
                herdou = true
                break
              }
            }
          }
        }
      } catch (errHist) {
        console.warn('[Matriz] Erro ao buscar histórico para herança:', errHist)
      }
    }

    // Se herdou dados para o novo mês, persiste automaticamente para garantir consistência
    if (herdou) {
      salvarDadosMatriz(result, mesKey, env).catch(() => {})
    }
  }

  // Atualiza cache local
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(localKey, JSON.stringify(result))
    } catch (_) {}
  }

  return result
}

/**
 * Salva os dados da Matriz para o mês no Supabase e LocalStorage,
 * sincronizando também com a configuração mestre permanente da equipe.
 */
export async function salvarDadosMatriz(
  dados: MatrizDbRecord,
  mesKey: string = getMesKey(),
  env: string = 'barcarena'
): Promise<boolean> {
  const key = getStorageKey(mesKey, env)
  const masterKey = getMasterConfigKey(env)
  const localKey = `hydro-matriz-v2-${mesKey}`
  const localMasterKey = `hydro-matriz-master-${env}`

  // Salvar localmente primeiro para resposta instantânea
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(localKey, JSON.stringify(dados))
      if (dados.atribuicoesManual || dados.cargos) {
        localStorage.setItem(localMasterKey, JSON.stringify({
          atribuicoesManual: dados.atribuicoesManual,
          atribuicoesAtividades: dados.atribuicoesAtividades,
          cargos: dados.cargos,
          customColaboradores: dados.customColaboradores,
          tituloMatriz: dados.tituloMatriz,
          iconeMatriz: dados.iconeMatriz,
          updatedAt: new Date().toISOString()
        }))
      }
    } catch (_) {}
  }

  try {
    const payload = {
      ...dados,
      updatedAt: new Date().toISOString(),
    }

    // 1. Salva o mês atual
    const { error } = await supabase
      .from('global_settings')
      .upsert({ key, value: payload })

    // 2. Salva na chave Mestre permanente se contiver atribuições ou cargos
    if (dados.atribuicoesManual || dados.cargos) {
      const masterPayload = {
        atribuicoesManual: dados.atribuicoesManual || {},
        atribuicoesAtividades: dados.atribuicoesAtividades || {},
        cargos: dados.cargos,
        customColaboradores: dados.customColaboradores || [],
        tituloMatriz: dados.tituloMatriz,
        iconeMatriz: dados.iconeMatriz,
        updatedAt: new Date().toISOString()
      }
      await supabase
        .from('global_settings')
        .upsert({ key: masterKey, value: masterPayload })
    }

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
  const list = atividades.length > 0 ? atividades : cargo.atividades.map((n, i) => ({ nome: n, marks: 0, total: 3, pers: ehPersonalizada(cargo.id, i) }))
  const totalAtividades = list.length
  const totalMarcacoesPossiveis = list.reduce((acc, a) => acc + (a.total ?? 3), 0)
  const marcacoesFeitas = list.reduce((acc, a) => {
    const t = a.total ?? 3
    return acc + Math.max(0, Math.min(t, a.marks || 0))
  }, 0)
  const concluidas = list.filter((a) => (a.marks || 0) >= (a.total ?? 3)).length
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
  atividadesPorCargo: Record<string, AtividadeMatriz[]>,
  cargosList: CargoMatrizDef[] = CARGOS_MATRIZ
) {
  let ativTotal = 0
  let marcTotal = 0
  let marcMax = 0
  let feitasTotal = 0
  let cargosConcluidos = 0

  for (const cargo of cargosList) {
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
    totalCargos: cargosList.length,
    cargosConcluidos,
    cargosPendentes: cargosList.length - cargosConcluidos,
    ativTotal,
    marcTotal,
    marcMax,
    feitasTotal,
    pctGeral,
  }
}
