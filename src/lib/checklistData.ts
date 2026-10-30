import { supabase } from './supabase'

export interface ChecklistItemModelo {
  uid: string
  texto: string
}

export interface ChecklistModelo {
  uid: string
  nome: string
  itens: ChecklistItemModelo[]
  criadoEm: string
}

export type StatusItemChecklist = 'C' | 'NC' | 'NA'

export interface ChecklistItemExec {
  itemUid: string
  texto: string
  status: StatusItemChecklist
  obs: string
  foto?: string
}

export interface ChecklistExecucao {
  uid: string
  modeloUid: string
  modeloNome: string
  data: string
  executor: string
  local: string
  obsGeral?: string
  itens: ChecklistItemExec[]
  conf: number
  nc: number
  na: number
  pct: number | null
  salvoEm: string
}

export interface ChecklistPendenciaItem {
  chave: string // execUid|itemUid
  execUid: string
  modeloNome: string
  data: string
  executor: string
  local: string
  item: ChecklistItemExec
  resolvida: boolean
  resolucao: { em: string } | null
}

export interface ChecklistAnexo {
  id?: string
  nome: string
  mime: string
  rotulo: string
  icone: string
  tamanho: number
  dataUrl: string
  anexadoEm: string
  titulo?: string
  local?: string
  dataChecklist?: string
}

export interface ChecklistStore {
  modelos: ChecklistModelo[]
  execucoes: ChecklistExecucao[]
  pendenciasResolvidas: Record<string, { em: string }>
  anexos: ChecklistAnexo[]
}

export const LS_KEY_MODELOS = 'hydro-checklist-modelos'
export const LS_KEY_EXECUCOES = 'hydro-checklist-execucoes'
export const LS_KEY_PENDENCIAS = 'hydro-checklist-pendencias'
export const LS_KEY_ANEXOS = 'hydro-checklist-anexados'

export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function fmtDate(iso?: string): string {
  if (!iso) return '—'
  const p = String(iso).split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso
}

export function uid(prefix = 'id'): string {
  return prefix + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36)
}

export function fmtTam(b?: number): string {
  if (b == null || isNaN(b)) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return (b / 1024).toFixed(1).replace('.', ',') + ' KB'
  return (b / (1024 * 1024)).toFixed(2).replace('.', ',') + ' MB'
}

export function tipoArq(nome?: string, mime?: string): { rotulo: string; icone: string } {
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

export function calcConformidade(itens: { status: StatusItemChecklist }[]): {
  conf: number
  nc: number
  na: number
  aval: number
  pct: number | null
} {
  let conf = 0
  let nc = 0
  itens.forEach((it) => {
    if (it.status === 'C') conf++
    else if (it.status === 'NC') nc++
  })
  const aval = conf + nc
  return {
    conf,
    nc,
    na: itens.length - aval,
    aval,
    pct: aval ? Math.round((conf / aval) * 100) : null,
  }
}

export function listarPendencias(
  execucoes: ChecklistExecucao[],
  pendenciasResolvidas: Record<string, { em: string }>
): ChecklistPendenciaItem[] {
  const out: ChecklistPendenciaItem[] = []
  execucoes.forEach((e) => {
    e.itens.forEach((it) => {
      if (it.status === 'NC') {
        const chave = `${e.uid}|${it.itemUid}`
        const res = pendenciasResolvidas[chave] || null
        out.push({
          chave,
          execUid: e.uid,
          modeloNome: e.modeloNome,
          data: e.data,
          executor: e.executor,
          local: e.local,
          item: it,
          resolvida: !!res,
          resolucao: res,
        })
      }
    })
  })
  return out
}

export function gerarTextoRelatorioChecklist(
  execucoes: ChecklistExecucao[],
  pendenciasResolvidas: Record<string, { em: string }>
): string {
  let conf = 0
  let nc = 0
  let na = 0
  const porModelo: Record<
    string,
    { exec: number; conf: number; nc: number; na: number }
  > = {}

  execucoes.forEach((e) => {
    conf += e.conf
    nc += e.nc
    na += e.na
    const pm = (porModelo[e.modeloNome] = porModelo[e.modeloNome] || {
      exec: 0,
      conf: 0,
      nc: 0,
      na: 0,
    })
    pm.exec++
    pm.conf += e.conf
    pm.nc += e.nc
    pm.na += e.na
  })

  const aval = conf + nc
  const pct = aval ? Math.round((conf / aval) * 100) : null
  const pends = listarPendencias(execucoes, pendenciasResolvidas)
  const abertas = pends.filter((p) => !p.resolvida).length

  let s =
    'RELATÓRIO AUTOMÁTICO — CHECK LIST DE SEGURANÇA (Hydro Reabilitação)\n' +
    'Gerado em: ' +
    new Date().toLocaleString('pt-BR') +
    '\n'

  if (!execucoes.length) return s + 'Nenhuma execução registrada.'

  s += `Resumo: ${execucoes.length} execução(ões) • ${aval} item(ns) avaliado(s) • Conformidade geral: ${
    pct === null ? '—' : pct + '%'
  } (${conf} conforme / ${nc} não conforme / ${na} não se aplica)\n`
  s += `Pendências: ${pends.length} gerada(s) • ${abertas} aberta(s) • ${
    pends.length - abertas
  } resolvida(s)\n\nCONFORMIDADE POR MODELO:\n`

  Object.keys(porModelo).forEach((nome) => {
    const pm = porModelo[nome]
    const av = pm.conf + pm.nc
    const pc = av ? Math.round((pm.conf / av) * 100) : null
    s += `- ${nome}: ${pm.exec} execução(ões) • ${
      pc === null ? '—' : pc + '%'
    } (${pm.conf} conforme / ${pm.nc} não conforme / ${pm.na} não se aplica)\n`
  })

  s += '\nEXECUÇÕES:\n'
  execucoes.forEach((e, i) => {
    s += `${i + 1}. ${e.modeloNome} [${e.pct === null ? '—' : e.pct + '%'}]\n`
    s += `   Data: ${fmtDate(e.data)} • Executor: ${e.executor} • Local: ${e.local}\n`
    s += `   ${e.conf} conforme • ${e.nc} não conforme • ${e.na} não se aplica\n`
    e.itens.forEach((it) => {
      s += `   - ${it.texto}: ${
        it.status === 'C' ? 'Conforme' : it.status === 'NC' ? 'Não conforme' : 'Não se aplica'
      }${it.obs ? ' — ' + it.obs : ''}${it.foto ? ' (foto anexada)' : ''}\n`
    })
    s += '\n'
  })

  s += 'PENDÊNCIAS (ITENS NÃO CONFORME):\n'
  if (!pends.length) {
    s += '- Nenhuma pendência gerada.\n'
  } else {
    pends.forEach((p, i) => {
      s += `${i + 1}. ${p.item.texto} [${p.resolvida ? 'RESOLVIDA' : 'PENDENTE'}] — ${
        p.modeloNome
      } • ${fmtDate(p.data)} • ${p.executor} • ${p.local}${
        p.item.obs ? ' • Obs.: ' + p.item.obs : ''
      }\n`
    })
  }

  return s
}

export function getDbKeyChecklist(env = 'barcarena'): string {
  return `checklist_seguranca_${env}`
}

/**
 * Carrega os dados de Check List do Supabase (global_settings) com fallback para localStorage
 */
export async function carregarChecklistStore(env = 'barcarena'): Promise<ChecklistStore> {
  const dbKey = getDbKeyChecklist(env)
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', dbKey)
      .maybeSingle()

    if (!error && data?.value && typeof data.value === 'object') {
      const val = data.value as Partial<ChecklistStore>
      const store: ChecklistStore = {
        modelos: Array.isArray(val.modelos) ? val.modelos : [],
        execucoes: Array.isArray(val.execucoes) ? val.execucoes : [],
        pendenciasResolvidas:
          val.pendenciasResolvidas && typeof val.pendenciasResolvidas === 'object'
            ? val.pendenciasResolvidas
            : {},
        anexos: Array.isArray(val.anexos) ? val.anexos : [],
      }

      // Atualiza o localStorage local
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(LS_KEY_MODELOS, JSON.stringify(store.modelos))
          localStorage.setItem(LS_KEY_EXECUCOES, JSON.stringify(store.execucoes))
          localStorage.setItem(LS_KEY_PENDENCIAS, JSON.stringify(store.pendenciasResolvidas))
          localStorage.setItem(LS_KEY_ANEXOS, JSON.stringify(store.anexos))
        } catch (_) {}
      }

      return store
    }
  } catch (err) {
    console.warn('[Checklist] Erro ao carregar do Supabase:', err)
  }

  // Fallback LocalStorage
  if (typeof window !== 'undefined') {
    try {
      const mod = JSON.parse(localStorage.getItem(LS_KEY_MODELOS) || '[]')
      const exe = JSON.parse(localStorage.getItem(LS_KEY_EXECUCOES) || '[]')
      const pen = JSON.parse(localStorage.getItem(LS_KEY_PENDENCIAS) || '{}')
      const ane = JSON.parse(localStorage.getItem(LS_KEY_ANEXOS) || '[]')

      return {
        modelos: Array.isArray(mod) ? mod : [],
        execucoes: Array.isArray(exe) ? exe : [],
        pendenciasResolvidas: pen && typeof pen === 'object' ? pen : {},
        anexos: Array.isArray(ane) ? ane : [],
      }
    } catch (_) {}
  }

  return {
    modelos: [],
    execucoes: [],
    pendenciasResolvidas: {},
    anexos: [],
  }
}

/**
 * Salva a store de Check List no Supabase e no localStorage
 */
export async function salvarChecklistStore(
  store: ChecklistStore,
  env = 'barcarena'
): Promise<boolean> {
  const dbKey = getDbKeyChecklist(env)

  // Salvar no localStorage imediatamente
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LS_KEY_MODELOS, JSON.stringify(store.modelos))
      localStorage.setItem(LS_KEY_EXECUCOES, JSON.stringify(store.execucoes))
      localStorage.setItem(LS_KEY_PENDENCIAS, JSON.stringify(store.pendenciasResolvidas))
      localStorage.setItem(LS_KEY_ANEXOS, JSON.stringify(store.anexos))
    } catch (e) {
      console.warn('[Checklist] Erro ao salvar no LocalStorage:', e)
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
        .update({ value: store })
        .eq('key', dbKey)
      return !error
    } else {
      const { error } = await supabase
        .from('global_settings')
        .insert({ key: dbKey, value: store })
      return !error
    }
  } catch (err) {
    console.warn('[Checklist] Erro ao persistir no Supabase:', err)
    return false
  }
}

