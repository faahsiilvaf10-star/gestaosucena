import { supabase } from './supabase'

export interface OcorrenciaArquivo {
  id?: string
  nome: string
  mime?: string
  rotulo: string
  icone: string
  tamanho?: number
  dataUrl?: string
  anexadoEm: string
  titulo?: string
}

export const LS_KEY_OCORRENCIAS = 'hydro-arquivos-ocorrencia'

export function fmtAnexadoEm(d: Date): string {
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const ano = d.getFullYear()
  const hora = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dia}/${mes}/${ano} às ${hora}:${min}`
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

export function getDbKeyOcorrencias(env = 'barcarena'): string {
  return `ocorrencias_arquivos_${env}`
}

/**
 * Carrega a lista de arquivos de ocorrência do Supabase (global_settings) com fallback para localStorage
 */
export async function carregarArquivosOcorrencia(env = 'barcarena'): Promise<OcorrenciaArquivo[]> {
  const dbKey = getDbKeyOcorrencias(env)
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', dbKey)
      .maybeSingle()

    if (!error && data) {
      const lista = Array.isArray(data.value) ? (data.value as OcorrenciaItem[]) : []
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(LS_KEY_OCORRENCIA, JSON.stringify(lista))
        } catch (_) {}
      }
      return lista
    }
  } catch (err) {
    console.warn('[Ocorrência] Erro ao carregar do Supabase:', err)
  }

  // Fallback LocalStorage
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LS_KEY_OCORRENCIAS)
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) return arr
      }
    } catch (_) {}
  }

  return []
}

/**
 * Salva a lista de arquivos de ocorrência no Supabase e no localStorage
 */
export async function salvarArquivosOcorrencia(
  novos: OcorrenciaArquivo[],
  env = 'barcarena'
): Promise<boolean> {
  const dbKey = getDbKeyOcorrencias(env)

  // Salvar no localStorage imediatamente
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LS_KEY_OCORRENCIAS, JSON.stringify(novos))
    } catch (e) {
      console.warn('[Ocorrência] Erro ao salvar no LocalStorage:', e)
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
    console.warn('[Ocorrência] Erro ao persistir no Supabase:', err)
    return false
  }
}

