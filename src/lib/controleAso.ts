import { isAdmin } from '../components/ui/VerifiedBadge'

export interface ColaboradorAso {
  id: string
  nome: string
  cargo?: string | null
  status?: string | null
  matricula?: string | null
  matricula_hydro?: string | null
  matricula_sucena?: string | null
  data_admissao?: string | null
  setor?: string | null
  aso_admissional?: string | null
  aso_admissional_2?: string | null
  aso_periodico?: string | null
  retorno_ao_trabalho?: string | null
  mudanca_de_risco?: string | null
  observacao?: string | null
  validade_aso_efetiva?: string | null
}

export interface StatusAsoInfo {
  k: 'valido' | 'vencendo' | 'vencido' | 'sem'
  label: string
  txt: string
  badgeClass: string
}

/**
 * Formata data no formato ISO (YYYY-MM-DD) para PT-BR (DD/MM/AAAA)
 */
export function fmtDate(v?: string | null): string {
  if (!v) return '—'
  const clean = String(v).slice(0, 10)
  const parts = clean.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return v
}

/**
 * Retorna data atual no formato YYYY-MM-DD
 */
export function hojeISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

/**
 * Adiciona exatamente 1 ano a uma data ISO (YYYY-MM-DD).
 * Trata o caso bissexto: 29 de fevereiro cai em 28 de fevereiro no ano não-bissexto subsequente.
 */
export function addUmAno(iso?: string | null): string {
  if (!iso) return ''
  const clean = String(iso).slice(0, 10)
  const parts = clean.split('-')
  if (parts.length !== 3) return ''

  const y = parseInt(parts[0], 10) + 1
  const m = parts[1]
  let d = parts[2]

  if (m === '02' && d === '29') {
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
    if (!isLeap) d = '28'
  }

  return `${y}-${m}-${d}`
}

/**
 * Calcula a quantidade de dias entre hoje e a data fornecida.
 * Retorna número positivo se no futuro, 0 se hoje, negativo se no passado.
 */
export function diasAte(iso?: string | null): number | null {
  if (!iso) return null
  const clean = String(iso).slice(0, 10)
  if (!clean || clean.split('-').length !== 3) return null

  const a = new Date(`${hojeISO()}T12:00:00`)
  const b = new Date(`${clean}T12:00:00`)
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null

  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

/**
 * Retorna a data mais recente entre os 4 exames médicos ocupacionais (PCMSO / NR-7):
 * - aso_admissional (ou aso inicial)
 * - aso_periodico
 * - retorno_ao_trabalho
 * - mudanca_de_risco
 */
export function baseValidade(c: {
  aso_admissional?: string | null
  aso_periodico?: string | null
  retorno_ao_trabalho?: string | null
  mudanca_de_risco?: string | null
}): string {
  const dates = [
    c.aso_admissional,
    c.aso_periodico,
    c.retorno_ao_trabalho,
    c.mudanca_de_risco,
  ]
    .filter(Boolean)
    .map((d) => String(d).slice(0, 10))
    .sort()

  return dates.length > 0 ? dates[dates.length - 1] : ''
}

/**
 * Calcula a Validade ASO (Efetiva) = data mais recente do exame + 1 ano.
 * Se o registro já tiver validade_aso_efetiva no banco de dados e não houver datas individuais, utiliza-a como fallback.
 */
export function validadeDe(c: {
  aso_admissional?: string | null
  aso_periodico?: string | null
  retorno_ao_trabalho?: string | null
  mudanca_de_risco?: string | null
  validade_aso_efetiva?: string | null
}): string {
  const base = baseValidade(c)
  if (base) {
    return addUmAno(base)
  }
  if (c.validade_aso_efetiva) {
    return String(c.validade_aso_efetiva).slice(0, 10)
  }
  return ''
}

/**
 * Retorna o nome amigável do exame que serviu de base para a validade mais recente.
 */
export function nomeBase(c: {
  aso_admissional?: string | null
  aso_periodico?: string | null
  retorno_ao_trabalho?: string | null
  mudanca_de_risco?: string | null
}): string {
  const itens: Array<{ nome: string; data: string }> = [
    { nome: 'ASO', data: c.aso_admissional ? String(c.aso_admissional).slice(0, 10) : '' },
    { nome: 'Periódico', data: c.aso_periodico ? String(c.aso_periodico).slice(0, 10) : '' },
    { nome: 'Retorno ao Trab.', data: c.retorno_ao_trabalho ? String(c.retorno_ao_trabalho).slice(0, 10) : '' },
    { nome: 'Mudança de Risco', data: c.mudanca_de_risco ? String(c.mudanca_de_risco).slice(0, 10) : '' },
  ].filter((x) => Boolean(x.data))

  if (itens.length === 0) return ''

  itens.sort((a, b) => (a.data < b.data ? -1 : 1))
  return itens[itens.length - 1].nome
}

/**
 * Retorna o status detalhado da situação do ASO:
 * - sem: Sem data de ASO cadastrada
 * - vencido: Data de validade menor que hoje (dias < 0)
 * - vencendo: Vence hoje ou faltam até 30 dias (dias <= 30)
 * - valido: Válido por mais de 30 dias (dias > 30)
 */
export function statusASO(c: {
  aso_admissional?: string | null
  aso_periodico?: string | null
  retorno_ao_trabalho?: string | null
  mudanca_de_risco?: string | null
  validade_aso_efetiva?: string | null
}): StatusAsoInfo {
  const v = validadeDe(c)
  if (!v) {
    return {
      k: 'sem',
      label: '⚪ SEM ASO',
      txt: 'Nenhuma data de ASO informada',
      badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    }
  }

  const n = diasAte(v)
  if (n === null) {
    return {
      k: 'sem',
      label: '⚪ SEM ASO',
      txt: 'Data inválida',
      badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    }
  }

  if (n < 0) {
    return {
      k: 'vencido',
      label: '🔴 VENCIDO',
      txt: `Validade venceu em ${fmtDate(v)} — há ${Math.abs(n)} dia(s) • Faltam 0 dias para o vencimento (já venceu)`,
      badgeClass: 'bg-red-600 text-white font-bold',
    }
  }

  if (n === 0) {
    return {
      k: 'vencendo',
      label: '⏰ VENCE HOJE',
      txt: `Validade vence hoje, ${fmtDate(v)}`,
      badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300 font-bold',
    }
  }

  if (n <= 30) {
    return {
      k: 'vencendo',
      label: '⚠️ A VENCER',
      txt: `Faltam ${n} dias para o vencimento — validade em ${fmtDate(v)}`,
      badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300 font-bold',
    }
  }

  return {
    k: 'valido',
    label: '✅ VÁLIDO',
    txt: `Faltam ${n} dias para o vencimento — validade em ${fmtDate(v)}`,
    badgeClass: 'bg-emerald-100 text-emerald-800 font-bold dark:bg-emerald-950 dark:text-emerald-300',
  }
}

/**
 * Frase amigável de contagem regressiva da validade
 */
export function frasesValidade(c: {
  aso_admissional?: string | null
  aso_periodico?: string | null
  retorno_ao_trabalho?: string | null
  mudanca_de_risco?: string | null
  validade_aso_efetiva?: string | null
}): string {
  const v = validadeDe(c)
  if (!v) return 'Sem validade — nenhuma data de ASO informada'
  const n = diasAte(v)
  if (n === null) return 'Data de validade inválida'
  if (n < 0) return `Vencido — validade era ${fmtDate(v)}`
  if (n === 0) return `Vence hoje — ${fmtDate(v)}`
  if (n === 1) return `Falta 1 dia para o vencimento — ${fmtDate(v)}`
  return `Faltam ${n} dias para o vencimento — ${fmtDate(v)}`
}

/**
 * Checa se o colaborador está ativo
 */
export function isAtivo(status?: string | null): boolean {
  if (!status) return false
  const s = String(status).trim().toLowerCase()
  return s.startsWith('ativo') || s === 'em efetivo'
}

/**
 * Verifica se o usuário atual tem permissão de editar as datas de ASO.
 * Requisito estrito:
 * "Somente Cargos como Auxiliar Administrativo e Tecnico de Segurança poderam editar as datas."
 * (Além de Administradores/Diretoria)
 */
export function canEditControleAso(name?: string | null, role?: string | null, email?: string | null): boolean {
  if (email === 'ffaahsiilva@gmail.com') return true
  if (isAdmin(name || undefined, role || undefined)) return true

  const r = (role || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const n = (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (n.includes('fabricio silva')) return true

  // Auxiliar Administrativo
  const isAuxAdm = r.includes('aux') && (r.includes('administrativ') || r.includes('administracao'))
  
  // Técnico de Segurança / TST
  const isTecSeg =
    r === 'tst' ||
    r.includes('tst') ||
    ((r.includes('tecnic') || r.includes('tec')) &&
      (r.includes('seguran') || r.includes('seg') || r.includes('trabalho')))

  return isAuxAdm || isTecSeg
}
