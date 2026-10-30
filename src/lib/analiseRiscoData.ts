import { supabase } from './supabase'

export interface AnaliseRiscoItem {
  id: string
  titulo: string
  nome: string
  mime?: string
  rotulo: string
  icone: string
  tamanho?: number
  dataUrl?: string
  anexadoEm: string
  atividadeLocal?: string
  status: 'Em aberto' | 'Fechada'
  validaAte?: string // YYYY-MM-DD
  fechadaEm?: string
  fechadaPor?: string
  fechadaObs?: string
}

export const LS_KEY_ANALISE_RISCO = 'hydro-analise-risco-anexados'

export function fmtAnexadoEm(d: Date = new Date()): string {
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const ano = d.getFullYear()
  const hora = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dia}/${mes}/${ano} às ${hora}:${min}`
}

export function fmtValidade(v?: string): string {
  if (!v) return ''
  const p = String(v).split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(v)
}

export function diasAteValidade(v?: string): number | null {
  if (!v) return null
  const hj = new Date()
  hj.setHours(12, 0, 0, 0)
  const b = new Date(String(v) + 'T12:00:00')
  if (isNaN(b.getTime())) return null
  return Math.round((b.getTime() - hj.getTime()) / 864e5)
}

export function fmtTamanho(b?: number): string {
  if (b == null || isNaN(b)) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return (b / 1024).toFixed(1).replace('.', ',') + ' KB'
  return (b / (1024 * 1024)).toFixed(2).replace('.', ',') + ' MB'
}

export function tipoAnexo(nome?: string, mime?: string): { rotulo: string; icone: string } {
  const n = String(nome || '').toLowerCase()
  const m = String(mime || '').toLowerCase()
  const ext = (e: string) => n.endsWith(e)

  if (ext('.pdf') || m === 'application/pdf') return { rotulo: 'PDF', icone: '📕' }
  if (
    ext('.xls') ||
    ext('.xlsx') ||
    ext('.csv') ||
    m.includes('spreadsheet') ||
    m.includes('excel') ||
    m === 'text/csv'
  )
    return { rotulo: 'Excel', icone: '📗' }
  if (ext('.doc') || ext('.docx') || m.includes('word') || m.includes('msword'))
    return { rotulo: 'Word', icone: '📘' }
  if (
    m.startsWith('image/') ||
    ext('.png') ||
    ext('.jpg') ||
    ext('.jpeg') ||
    ext('.gif') ||
    ext('.webp')
  )
    return { rotulo: 'Imagem', icone: '🖼️' }
  return { rotulo: 'Arquivo', icone: '📄' }
}

export function getDbKeyAnaliseRisco(env = 'barcarena'): string {
  return `analise_risco_${env}`
}

/**
 * Carrega as análises de risco salvas no Supabase (global_settings) com fallback para localStorage
 */
export async function carregarAnalisesRisco(env = 'barcarena'): Promise<AnaliseRiscoItem[]> {
  const dbKey = getDbKeyAnaliseRisco(env)
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', dbKey)
      .maybeSingle()

    if (!error && data) {
      const lista = Array.isArray(data.value) ? (data.value as AnaliseRiscoItem[]) : []
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(LS_KEY_ANALISE_RISCO, JSON.stringify(lista))
        } catch (_) {}
      }
      return lista
    }
  } catch (err) {
    console.warn('[Análise de Risco] Erro ao carregar do Supabase:', err)
  }

  // Fallback LocalStorage
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LS_KEY_ANALISE_RISCO)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed
      }
    } catch (_) {}
  }

  return []
}

/**
 * Salva a lista de análises de risco no Supabase e no localStorage
 */
export async function salvarAnalisesRisco(
  lista: AnaliseRiscoItem[],
  env = 'barcarena'
): Promise<boolean> {
  const dbKey = getDbKeyAnaliseRisco(env)

  // Salvar no localStorage imediatamente
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LS_KEY_ANALISE_RISCO, JSON.stringify(lista))
    } catch (e) {
      console.warn('[Análise de Risco] Erro ao salvar no LocalStorage:', e)
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
    console.warn('[Análise de Risco] Erro ao persistir no Supabase:', err)
    return false
  }
}
