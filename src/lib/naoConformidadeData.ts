import { supabase } from './supabase'

export type ClassificacaoNC = 'Menor' | 'Maior' | 'Crítica'
export type StatusNC = 'Aberta' | 'Em tratamento' | 'Verificada' | 'Fechada'

export interface VerificacaoNC {
  eficaz: 'sim' | 'nao'
  obs: string
  data: string
}

export interface NaoConformidadeItem {
  id: string
  numero: string
  data: string
  local: string
  norma?: string
  descricao: string
  foto?: string // base64
  classificacao: ClassificacaoNC
  prazo: string
  causa?: string
  acao?: string
  responsavel: string
  responsavelCargo?: string
  status: StatusNC
  verificacao?: VerificacaoNC | null
  criadoEm?: string
  atualizadoEm?: string
}

export const CLASSIFICACOES_NC: ClassificacaoNC[] = ['Menor', 'Maior', 'Crítica']
export const STATUS_NC_LISTA: StatusNC[] = ['Aberta', 'Em tratamento', 'Verificada', 'Fechada']

export const LS_KEY_NC = 'hydro_nc_relatorio_v1'

export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function fmtData(iso?: string): string {
  if (!iso) return '—'
  const p = iso.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso
}

export function contarPorCampo<T extends Record<string, any>>(itens: T[], campo: keyof T): Record<string, number> {
  const r: Record<string, number> = {}
  itens.forEach((item) => {
    const val = String(item[campo] || '—')
    r[val] = (r[val] || 0) + 1
  })
  return r
}

export function gerarTextoRelatorioNC(ncs: NaoConformidadeItem[]): string {
  const agora = new Date()
  const dataHora =
    agora.toLocaleDateString('pt-BR') +
    ' ' +
    agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const porClassif = contarPorCampo(ncs, 'classificacao')
  const porStatus = contarPorCampo(ncs, 'status')
  const fechadas = porStatus['Fechada'] || 0
  const pct = ncs.length ? Math.round((fechadas / ncs.length) * 100) : 0

  const linhas: string[] = []
  linhas.push('RELATÓRIO DE NÃO CONFORMIDADE — HYDRO REABILITAÇÃO (SEGURANÇA)')
  linhas.push(`Gerado em: ${dataHora}`)
  linhas.push('')
  linhas.push(`Total de NCs: ${ncs.length}`)
  linhas.push(`Fechadas: ${fechadas} (${pct}%)`)
  linhas.push('')
  linhas.push('Por classificação:')
  CLASSIFICACOES_NC.forEach((c) => {
    linhas.push(`  - ${c}: ${porClassif[c] || 0}`)
  })
  linhas.push('')
  linhas.push('Por status:')
  STATUS_NC_LISTA.forEach((s) => {
    linhas.push(`  - ${s}: ${porStatus[s] || 0}`)
  })
  linhas.push('')
  linhas.push('Não conformidades:')
  if (!ncs.length) linhas.push('  (nenhuma NC registrada)')
  ncs.forEach((n) => {
    const verifStr = n.verificacao
      ? ` | Verificação: ${n.verificacao.eficaz === 'sim' ? 'eficaz' : 'não eficaz'}`
      : ''
    linhas.push(
      `  - ${n.numero} | ${n.classificacao} | ${n.status} | ${fmtData(n.data)} | ${n.local} | Responsável: ${n.responsavel} | Prazo: ${fmtData(n.prazo)}${verifStr}`
    )
  })

  return linhas.join('\n')
}

export function getDbKeyNC(env = 'barcarena'): string {
  return `nao_conformidade_seguranca_${env}`
}

/**
 * Carrega a lista de não conformidades do Supabase com fallback para LocalStorage
 */
export async function carregarNCs(env = 'barcarena'): Promise<NaoConformidadeItem[]> {
  const dbKey = getDbKeyNC(env)
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', dbKey)
      .maybeSingle()

    if (!error && data) {
      const lista = Array.isArray(data.value) ? (data.value as NaoConformidadeItem[]) : []
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(LS_KEY_NAO_CONFORMIDADE, JSON.stringify(lista))
        } catch (_) {}
      }
      return lista
    }
  } catch (err) {
    console.warn('[NC] Erro ao carregar do Supabase:', err)
  }

  // Fallback LocalStorage
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LS_KEY_NC)
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) return arr
      }
    } catch (_) {}
  }

  return []
}

/**
 * Salva a lista de não conformidades no Supabase e no LocalStorage
 */
export async function salvarNCs(
  novos: NaoConformidadeItem[],
  env = 'barcarena'
): Promise<boolean> {
  const dbKey = getDbKeyNC(env)

  // Salvar no localStorage imediatamente
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LS_KEY_NC, JSON.stringify(novos))
    } catch (e) {
      console.warn('[NC] Erro ao salvar no LocalStorage:', e)
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
    console.warn('[NC] Erro ao persistir no Supabase:', err)
    return false
  }
}

