import { supabase } from './supabase'

export type PrioridadePlano = 'Baixa' | 'Média' | 'Alta' | 'Crítica'
export type StatusPlano = 'Pendente' | 'Em andamento' | 'Concluído' | 'Atrasado'
export type OrigemPlano = 'Desvio' | 'Inspeção' | 'Ocorrência' | 'Auditoria' | 'DDS' | 'Outro'

export interface PlanoAcaoItem {
  id: string
  origem: OrigemPlano | string
  referencia?: string
  acao: string
  responsavel: string
  responsavelCargo?: string
  dataAbertura: string // YYYY-MM-DD
  prazo: string // YYYY-MM-DD
  prioridade: PrioridadePlano
  status: StatusPlano
  observacoes?: string
  feito?: string
  evidenciaFoto?: string // Data URL base64
  concluidoEm?: string // YYYY-MM-DD
  criadoEm?: string
  atualizadoEm?: string
}

export interface ColaboradorRH {
  id: string
  nome: string
  cargo: string
  matricula?: string
  status?: string
}

export const ORIGENS_PLANO: OrigemPlano[] = [
  'Desvio',
  'Inspeção',
  'Ocorrência',
  'Auditoria',
  'DDS',
  'Outro',
]

export const PRIORIDADES_PLANO: PrioridadePlano[] = [
  'Baixa',
  'Média',
  'Alta',
  'Crítica',
]

export const STATUS_LISTA: StatusPlano[] = [
  'Pendente',
  'Em andamento',
  'Concluído',
  'Atrasado',
]

export const LS_KEY_PLANO_ACAO = 'planoAcaoHydroV1'

export function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function parseData(iso?: string): Date | null {
  if (!iso) return null
  const p = String(iso).split('-')
  if (p.length !== 3) return null
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
  return isNaN(d.getTime()) ? null : d
}

export function fmtData(iso?: string): string {
  const d = parseData(iso)
  if (!d) return '—'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export function diasParaPrazo(iso?: string): number | null {
  const d = parseData(iso)
  if (!d) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - hoje.getTime()) / 86400000)
}

export function isVencido(r: Pick<PlanoAcaoItem, 'status' | 'prazo'>): boolean {
  if (r.status === 'Concluído') return false
  const dias = diasParaPrazo(r.prazo)
  return dias !== null && dias < 0
}

export function statusEfetivo(r: Pick<PlanoAcaoItem, 'status' | 'prazo'>): StatusPlano {
  if (r.status === 'Concluído') return 'Concluído'
  if (isVencido(r)) return 'Atrasado'
  return r.status
}

export function prazoInfo(r: Pick<PlanoAcaoItem, 'status' | 'prazo' | 'concluidoEm'>): {
  texto: string
  classe: 'ok' | 'vencido' | 'hoje' | ''
  dias: number | null
} {
  const dias = diasParaPrazo(r.prazo)
  if (dias === null) return { texto: 'Prazo não informado', classe: '', dias: null }
  if (r.status === 'Concluído') {
    return {
      texto: `Concluída em ${fmtData(r.concluidoEm || hojeISO())}`,
      classe: 'ok',
      dias,
    }
  }
  if (dias < 0) {
    const diff = Math.abs(dias)
    return {
      texto: `VENCIDO há ${diff} ${diff === 1 ? 'dia' : 'dias'} — prazo era ${fmtData(r.prazo)}`,
      classe: 'vencido',
      dias,
    }
  }
  if (dias === 0) {
    return { texto: `Vence hoje — ${fmtData(r.prazo)}`, classe: 'hoje', dias }
  }
  if (dias === 1) {
    return { texto: `Falta 1 dia para o vencimento — ${fmtData(r.prazo)}`, classe: 'ok', dias }
  }
  return { texto: `Faltam ${dias} dias para o vencimento — ${fmtData(r.prazo)}`, classe: 'ok', dias }
}

export function gerarTextoRelatorio(registros: PlanoAcaoItem[]): string {
  const total = registros.length
  const concl = registros.filter((r) => r.status === 'Concluído').length
  const venc = registros.filter(isVencido).length
  const perc = total ? Math.round((concl / total) * 100) : 0
  const linhas: string[] = []

  linhas.push('RELATÓRIO — PLANO DE AÇÃO — SEGURANÇA — HYDRO REABILITAÇÃO (SUCENA)')
  linhas.push(`Data do relatório: ${fmtData(hojeISO())}`)
  linhas.push('')
  linhas.push(`Total de ações: ${total} | Concluídas: ${concl} (${perc}%) | Vencidas: ${venc}`)
  linhas.push('')

  PRIORIDADES_PLANO.forEach((p) => {
    linhas.push(`Prioridade ${p}: ${registros.filter((r) => r.prioridade === p).length}`)
  })
  linhas.push('')

  ORIGENS_PLANO.forEach((o) => {
    linhas.push(`Origem ${o}: ${registros.filter((r) => r.origem === o).length}`)
  })
  linhas.push('')

  linhas.push('AÇÕES:')
  if (!registros.length) {
    linhas.push('(nenhuma ação registrada)')
  }
  registros.forEach((r, i) => {
    const st = statusEfetivo(r)
    const pi = prazoInfo(r)
    const concStr =
      r.status === 'Concluído'
        ? ` — Concluída em ${fmtData(r.concluidoEm)}. O que foi feito: ${r.feito || ''}`
        : ''
    linhas.push(
      `${i + 1}. [${st}] [${r.prioridade}] [${r.origem}] ${r.acao} — Responsável: ${r.responsavel}${r.responsavelCargo ? ` (${r.responsavelCargo})` : ''} — Prazo: ${fmtData(r.prazo)} (${pi.texto})${concStr}`
    )
  })

  return linhas.join('\n')
}

/**
 * Redimensiona e comprime uma imagem para base64 JPEG com qualidade otimizada
 */
export function comprimirImagem(file: File, maxDim = 1200, qualidade = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        let width = img.width
        let height = img.height

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(e.target?.result as string)
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', qualidade)
        resolve(dataUrl)
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

export function getDbKeyPlano(env = 'barcarena'): string {
  return `plano_acao_seguranca_${env}`
}

/**
 * Carrega a lista de planos de ação do Supabase (global_settings) com fallback para localStorage
 */
export async function carregarPlanosAcao(env = 'barcarena'): Promise<PlanoAcaoItem[]> {
  const dbKey = getDbKeyPlano(env)
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', dbKey)
      .maybeSingle()

    if (!error && data) {
      const lista = Array.isArray(data.value) ? (data.value as PlanoAcaoItem[]) : []
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(LS_KEY_PLANO_ACAO, JSON.stringify(lista))
        } catch (_) {}
      }
      return lista
    }
  } catch (err) {
    console.warn('[PlanoAcao] Erro ao carregar do Supabase:', err)
  }

  // Fallback LocalStorage
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LS_KEY_PLANO_ACAO)
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) return arr
      }
    } catch (_) {}
  }

  return []
}

/**
 * Salva a lista de planos de ação no Supabase (global_settings) e no localStorage
 */
export async function salvarPlanosAcao(
  novos: PlanoAcaoItem[],
  env = 'barcarena'
): Promise<boolean> {
  const dbKey = getDbKeyPlano(env)

  // Salvar no localStorage imediatamente
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LS_KEY_PLANO_ACAO, JSON.stringify(novos))
    } catch (e) {
      console.warn('[PlanoAcao] Erro ao salvar no LocalStorage:', e)
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
    console.warn('[PlanoAcao] Erro ao persistir no Supabase:', err)
    return false
  }
}

/**
 * Carrega a lista do efetivo ativo no RH (rh_efetivo) para seleção de responsáveis
 */
export async function carregarColaboradoresAtivosRH(): Promise<ColaboradorRH[]> {
  try {
    const { data, error } = await supabase
      .from('rh_efetivo')
      .select('id, nome, cargo, status, matricula')
      .order('nome', { ascending: true })

    if (!error && Array.isArray(data)) {
      const list: ColaboradorRH[] = []
      const ids = new Set<string>()

      for (const item of data) {
        const s = (item.status || '').toUpperCase().trim()
        if (s === 'INATIVO' || s === 'DEMITIDO' || s === 'DESLIGADO') continue
        if (!item.nome || !item.id || ids.has(item.id)) continue
        ids.add(item.id)
        list.push({
          id: item.id,
          nome: item.nome.trim(),
          cargo: item.cargo?.trim() || 'Colaborador',
          matricula: item.matricula,
          status: item.status,
        })
      }
      return list
    }
  } catch (err) {
    console.warn('[PlanoAcao] Erro ao carregar colaboradores do RH:', err)
  }
  return []
}
