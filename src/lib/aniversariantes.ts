import { rawSupabase } from './supabase'

export interface ColaboradorEfetivoRecord {
  id: string
  nome: string
  cargo?: string | null
  setor?: string | null
  status?: string | null
  environment?: string | null
  data_nascimento?: string | null
  raw_data?: Record<string, any> | null
}

export interface AniversarianteItem {
  id: string
  nome: string
  nomeFormatado: string
  cargo: string
  day: number
  month: number
}

export const BIRTHDAY_CONGRATS_MESSAGE =
  'Feliz aniversário! 🎂🎉\n\nQue seu dia seja repleto de alegria, saúde, conquistas e momentos especiais. Desejamos muito sucesso e felicidades! Parabéns!'

const INACTIVE_STATUSES = new Set(['REMOVIDO', 'INATIVO', 'DEMITIDO', 'DESLIGADO'])
const LOWERCASE_NAME_PARTICLES = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])

/**
 * Verifica se o colaborador está ativo (não desligado/inativo/demitido/removido).
 */
export function isColaboradorAtivo(emp: Pick<ColaboradorEfetivoRecord, 'status'>): boolean {
  const normalized = (emp.status || '').toUpperCase().trim()
  return !INACTIVE_STATUSES.has(normalized)
}

/**
 * Formata o nome completo do colaborador preservando preposições em minúsculas
 * sem truncar nem cortar partes do nome.
 */
export function formatEmployeeDisplayName(nome?: string | null): string {
  const cleaned = (nome || '').trim().replace(/\s+/g, ' ')
  if (!cleaned) return 'Colaborador'

  return cleaned
    .split(' ')
    .map((word, index) => {
      const lower = word.toLowerCase()
      if (index > 0 && LOWERCASE_NAME_PARTICLES.has(lower)) {
        return lower
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

/**
 * Extrai dia (1-31) e mês (0-11) de datas em formatos:
 * - Número serial do Excel (ex: 33082)
 * - String numérica serial do Excel (ex: "33082")
 * - DD/MM/AAAA ou DD/MM
 * - AAAA-MM-DD ou ISO timestamp (ignorando o ano)
 */
export function parseBirthDayMonth(value: unknown): { day: number; month: number } | null {
  if (value === null || value === undefined || value === '') return null

  let numericSerial: number | null = null
  if (typeof value === 'number' && Number.isFinite(value)) {
    numericSerial = value
  } else if (typeof value === 'string' && /^\d{4,6}$/.test(value.trim())) {
    numericSerial = Number(value.trim())
  }

  if (numericSerial !== null && numericSerial > 0) {
    const utcMs = Math.round((numericSerial - 25569) * 86400 * 1000)
    const d = new Date(utcMs)
    if (!Number.isNaN(d.getTime())) {
      const day = d.getUTCDate()
      const month = d.getUTCMonth()
      if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
        return { day, month }
      }
    }
    return null
  }

  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  // DD/MM/AAAA ou DD/MM
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/')
    if (parts.length >= 2 && parts.length <= 3) {
      const day = Number(parts[0])
      const month = Number(parts[1]) - 1
      if (
        Number.isInteger(day) &&
        Number.isInteger(month) &&
        day >= 1 &&
        day <= 31 &&
        month >= 0 &&
        month <= 11
      ) {
        return { day, month }
      }
    }
    return null
  }

  // AAAA-MM-DD ou ISO timestamp
  const isoDatePart = trimmed.split('T')[0].split(' ')[0]
  if (isoDatePart.includes('-')) {
    const parts = isoDatePart.split('-')
    if (parts.length === 3) {
      let day: number
      let month: number
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        month = Number(parts[1]) - 1
        day = Number(parts[2])
      } else {
        // DD-MM-YYYY
        day = Number(parts[0])
        month = Number(parts[1]) - 1
      }
      if (
        Number.isInteger(day) &&
        Number.isInteger(month) &&
        day >= 1 &&
        day <= 31 &&
        month >= 0 &&
        month <= 11
      ) {
        return { day, month }
      }
    }
  }

  return null
}

/**
 * Localiza o campo de data de nascimento no registro de colaborador (raw_data ou coluna direta).
 */
export function extrairDiaMesNascimento(
  emp: ColaboradorEfetivoRecord
): { day: number; month: number } | null {
  if (emp.data_nascimento) {
    const direct = parseBirthDayMonth(emp.data_nascimento)
    if (direct) return direct
  }

  if (!emp.raw_data || typeof emp.raw_data !== 'object') return null

  const nascKey = Object.keys(emp.raw_data).find((k) => {
    const upper = k.toUpperCase()
    return (
      upper.includes('NASCIMENTO') ||
      upper.includes('NASC') ||
      upper.includes('ANIVERSARIO') ||
      upper.includes('ANIVERSÁRIO')
    )
  })

  if (!nascKey) return null
  return parseBirthDayMonth(emp.raw_data[nascKey])
}

/**
 * Retorna os colaboradores ativos que fazem aniversário no mês de referência, ordenados por dia.
 */
export function filtrarAniversariantesDoMes(
  colaboradores: ColaboradorEfetivoRecord[],
  referenceDate: Date = new Date()
): AniversarianteItem[] {
  const targetMonth = referenceDate.getMonth()
  const result: AniversarianteItem[] = []

  for (const emp of colaboradores || []) {
    if (!emp || !isColaboradorAtivo(emp)) continue
    const birth = extrairDiaMesNascimento(emp)
    if (!birth || birth.month !== targetMonth) continue

    result.push({
      id: emp.id,
      nome: (emp.nome || '').trim(),
      nomeFormatado: formatEmployeeDisplayName(emp.nome),
      cargo: (emp.cargo || '').trim(),
      day: birth.day,
      month: birth.month,
    })
  }

  return result.sort((a, b) => a.day - b.day || a.nomeFormatado.localeCompare(b.nomeFormatado, 'pt-BR'))
}

/**
 * Retorna os colaboradores ativos que fazem aniversário exatamente no dia e mês de referência (ignora ano).
 */
export function filtrarAniversariantesDoDia(
  colaboradores: ColaboradorEfetivoRecord[],
  referenceDate: Date = new Date()
): AniversarianteItem[] {
  const targetDay = referenceDate.getDate()
  return filtrarAniversariantesDoMes(colaboradores, referenceDate)
    .filter((item) => item.day === targetDay)
    .sort((a, b) => a.nomeFormatado.localeCompare(b.nomeFormatado, 'pt-BR'))
}

/**
 * Retorna a chave de data local YYYY-MM-DD para controle de sessão e atualização diária.
 */
export function getLocalDateKey(referenceDate: Date = new Date()): string {
  const y = referenceDate.getFullYear()
  const m = String(referenceDate.getMonth() + 1).padStart(2, '0')
  const d = String(referenceDate.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getBirthdayDismissedStorageKey(userId: string, env: string, dateKey: string): string {
  return `sucena_birthday_modal_dismissed_${userId}_${env}_${dateKey}`
}

export function wasBirthdayModalDismissedInSession(userId: string, env: string, dateKey: string): boolean {
  if (typeof window === 'undefined' || !userId) return false
  try {
    return sessionStorage.getItem(getBirthdayDismissedStorageKey(userId, env, dateKey)) === 'true'
  } catch {
    return false
  }
}

export function markBirthdayModalDismissedInSession(userId: string, env: string, dateKey: string): void {
  if (typeof window === 'undefined' || !userId) return
  try {
    sessionStorage.setItem(getBirthdayDismissedStorageKey(userId, env, dateKey), 'true')
  } catch {
    // Ignora falhas de storage em modo restrito
  }
}

/**
 * Consulta a tabela real `rh_efetivo` respeitando o isolamento de ambiente do sistema.
 */
export async function fetchColaboradoresAniversario(env: string): Promise<ColaboradorEfetivoRecord[]> {
  let query = rawSupabase
    .from('rh_efetivo')
    .select('id, nome, cargo, setor, raw_data, status, environment')

  if (env === 'hydro-civil') {
    query = query.eq('environment', 'hydro-civil')
  } else {
    query = query.or('environment.eq.barcarena,environment.is.null')
  }

  const { data, error } = await query
  if (error) {
    console.warn('[Aniversariantes] Erro ao consultar colaboradores em rh_efetivo:', error)
    throw error
  }

  return (data || []) as ColaboradorEfetivoRecord[]
}
