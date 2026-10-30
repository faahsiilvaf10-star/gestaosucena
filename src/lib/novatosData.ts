import { supabase } from './supabase'

export const ETAPAS_NOVATOS = [
  'Integração de segurança',
  'Uso de EPI',
  'DDS inicial',
  'Reconhecimento da área',
  'Treinamento NR-01',
  'Avaliação',
] as const

export interface NovatoItem {
  uid: string
  nome: string
  cargo: string
  matricula: string
  admissao: string // YYYY-MM-DD
  setor: string
  tutor: string
  prazo: string // YYYY-MM-DD
  obs?: string
  etapas: string[]
  dataConclusao?: string
  salvoEm: string
}

export interface ColaboradorEfetivoRH {
  id: string
  nome: string
  cargo: string
  matricula: string
  admissao?: string
  setor?: string
  status: string
}

export const LS_KEY_NOVATOS = 'hydro-programa-novatos'

export function fmtDate(v?: string): string {
  if (!v) return '—'
  const p = String(v).split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : v
}

export function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

export function diasAte(v?: string): number | null {
  if (!v) return null
  const a = new Date(hojeISO() + 'T12:00:00')
  const b = new Date(v + 'T12:00:00')
  if (isNaN(b.getTime())) return null
  return Math.round((b.getTime() - a.getTime()) / 864e5)
}

export function progresso(n: Pick<NovatoItem, 'etapas'>): number {
  const f = (n.etapas || []).length
  return Math.round((f / ETAPAS_NOVATOS.length) * 100)
}

export function statusDe(n: Pick<NovatoItem, 'etapas' | 'prazo'>): 'Concluído' | 'Atrasado' | 'Em integração' {
  if ((n.etapas || []).length >= ETAPAS_NOVATOS.length) return 'Concluído'
  const d = diasAte(n.prazo)
  if (d !== null && d < 0) return 'Atrasado'
  return 'Em integração'
}

export function prazoTxt(n: NovatoItem): string {
  const st = statusDe(n)
  if (st === 'Concluído') {
    return `✅ Concluído — prazo era ${fmtDate(n.prazo)}${
      n.dataConclusao ? ` • concluído em ${n.dataConclusao}` : ''
    }`
  }
  const d = diasAte(n.prazo)
  if (d === null) return 'Sem prazo de conclusão'
  if (d < 0) {
    return `🔴 Prazo: ${fmtDate(n.prazo)} — ATRASADO há ${Math.abs(d)} dia(s) sem concluir`
  }
  if (d === 0) return `⏰ Prazo: ${fmtDate(n.prazo)} — vence HOJE`
  return `⏰ Prazo para concluir: ${fmtDate(n.prazo)} — faltam ${d} dia(s)`
}

export function getDbKeyNovatos(env = 'barcarena'): string {
  return `programa_novatos_${env}`
}

/**
 * Carrega a lista de novatos do Supabase (global_settings) com fallback para localStorage
 */
export async function carregarNovatos(env = 'barcarena'): Promise<NovatoItem[]> {
  const dbKey = getDbKeyNovatos(env)
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', dbKey)
      .maybeSingle()

    if (!error && data?.value && Array.isArray(data.value)) {
      const lista = data.value as NovatoItem[]
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(LS_KEY_NOVATOS, JSON.stringify(lista))
        } catch (_) {}
      }
      return lista
    }
  } catch (err) {
    console.warn('[Programa Novatos] Erro ao carregar do Supabase:', err)
  }

  // Fallback LocalStorage
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LS_KEY_NOVATOS)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed
      }
    } catch (_) {}
  }

  return []
}

/**
 * Salva a lista de novatos no Supabase e no localStorage
 */
export async function salvarNovatos(
  lista: NovatoItem[],
  env = 'barcarena'
): Promise<boolean> {
  const dbKey = getDbKeyNovatos(env)

  // Salvar no localStorage imediatamente
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LS_KEY_NOVATOS, JSON.stringify(lista))
    } catch (e) {
      console.warn('[Programa Novatos] Erro ao salvar no LocalStorage:', e)
    }
  }

  try {
    const { data: existing } = await supabase
      .from('global_settings')
      .select('id')
      .eq('key', dbKey)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('global_settings')
        .update({ value: lista, updated_at: new Date().toISOString() })
        .eq('key', dbKey)
      return !error
    } else {
      const { error } = await supabase
        .from('global_settings')
        .insert({ key: dbKey, value: lista, updated_at: new Date().toISOString() })
      return !error
    }
  } catch (err) {
    console.warn('[Programa Novatos] Erro ao persistir no Supabase:', err)
    return false
  }
}

/**
 * Carrega a lista do efetivo ativo no RH (rh_efetivo) para preenchimento de novatos e padrinhos
 */
export async function carregarColaboradoresAtivosRH(): Promise<ColaboradorEfetivoRH[]> {
  try {
    const { data, error } = await supabase
      .from('rh_efetivo')
      .select('id, nome, cargo, status, matricula, matricula_sucena, matricula_hydro, data_admissao, setor')
      .order('nome', { ascending: true })

    if (!error && Array.isArray(data)) {
      const list: ColaboradorEfetivoRH[] = []
      const ids = new Set<string>()

      for (const item of data) {
        const s = (item.status || '').toUpperCase().trim()
        if (s === 'INATIVO' || s === 'DEMITIDO' || s === 'DESLIGADO') continue
        if (!item.nome || !item.id || ids.has(item.id)) continue
        ids.add(item.id)

        // Formatar data de admissão para YYYY-MM-DD se vier em formato brasileiro ou ISO
        let adm = item.data_admissao || ''
        if (adm && adm.includes('/')) {
          const parts = adm.split('/')
          if (parts.length === 3) {
            adm = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
          }
        } else if (adm && adm.includes('T')) {
          adm = adm.split('T')[0]
        }

        list.push({
          id: item.id,
          nome: item.nome.trim(),
          cargo: item.cargo?.trim() || 'Colaborador',
          matricula: item.matricula || item.matricula_sucena || item.matricula_hydro || '',
          admissao: adm || undefined,
          setor: item.setor?.trim() || undefined,
          status: item.status,
        })
      }
      return list
    }
  } catch (err) {
    console.warn('[Programa Novatos] Erro ao carregar colaboradores do RH:', err)
  }

  return []
}

/**
 * Gera texto formatado do relatório do Programa de Novatos para cópia
 */
export function gerarTextoRelatorioNovatos(novatos: NovatoItem[]): string {
  if (!novatos.length) {
    return 'RELATÓRIO — PROGRAMA DE NOVATOS — Nenhum novato cadastrado.'
  }

  const conc = novatos.filter((n) => statusDe(n) === 'Concluído').length
  const em = novatos.filter((n) => statusDe(n) === 'Em integração').length
  const atr = novatos.filter((n) => statusDe(n) === 'Atrasado').length
  const pct = Math.round((conc / novatos.length) * 100)

  let s =
    'RELATÓRIO AUTOMÁTICO — PROGRAMA DE NOVATOS (Hydro Reabilitação)\n' +
    `Gerado em: ${new Date().toLocaleString('pt-BR')}\n` +
    `Resumo: ${novatos.length} novato(s) • ${conc} concluído(s) • ${em} em integração • ${atr} atrasado(s) • ${pct}% concluído\n\n`

  novatos.forEach((n, i) => {
    s +=
      `${i + 1}. ${n.nome} [${statusDe(n)} — ${progresso(n)}%]\n` +
      `   Cargo: ${n.cargo} • Matrícula: ${n.matricula} • Setor: ${n.setor} • Tutor/Padrinho: ${n.tutor}\n` +
      `   Admissão: ${fmtDate(n.admissao)} • ${prazoTxt(n).replace(/<[^>]+>/g, '')}\n` +
      `   Etapas concluídas (${(n.etapas || []).length} de ${ETAPAS_NOVATOS.length}): ${
        (n.etapas || []).length ? n.etapas.join(' • ') : 'nenhuma ainda'
      }\n` +
      (n.obs ? `   Observações: ${n.obs}\n` : '') +
      '\n'
  })

  return s
}
