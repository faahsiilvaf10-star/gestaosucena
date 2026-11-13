import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export type Cinta = {
  id: string
  tag: string
  descricao: string
  status: 'Inspecionada' | 'Não é mês de inspeção' | 'Pendente'
  inspecionadaEm: string | null
  foto: string | null
  cor: 'Vermelho' | 'Azul' | 'Amarelo' | 'Verde'
}

export type HistoricoInspecao = {
  id: string
  cinta_id?: string
  tag: string
  descricao: string
  cor: 'Vermelho' | 'Azul' | 'Amarelo' | 'Verde'
  data: string
  status: 'Inspecionada' | 'Cancelada'
  inspetor: string
  observacoes: string | null
  foto: string | null
}

function getCurrentEnv(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('sucena_environment') || 'barcarena'
  }
  return 'barcarena'
}

function getStorageKey(): string {
  return `sucena_cintas_data_${getCurrentEnv()}`
}

function getHistStorageKey(): string {
  return `sucena_cintas_historico_${getCurrentEnv()}`
}

const DEFAULT_CINTAS: Cinta[] = [
  { id: '00000000-0000-0000-0000-000000000001', tag: 'E-SUC-001', descricao: 'CINTA 4T - 4M', cor: 'Vermelho', status: 'Inspecionada', inspecionadaEm: '09/10/2026', foto: null },
  { id: '00000000-0000-0000-0000-000000000002', tag: 'E-SUC-002', descricao: 'CINTA 4T - 4M', cor: 'Vermelho', status: 'Inspecionada', inspecionadaEm: '09/10/2026', foto: null },
  { id: '00000000-0000-0000-0000-000000000003', tag: 'E-SUC-003', descricao: 'CINTA 4T - 4M', cor: 'Azul', status: 'Inspecionada', inspecionadaEm: '10/10/2026', foto: null },
  { id: '00000000-0000-0000-0000-000000000004', tag: 'E-SUC-004', descricao: 'CINTA 4T - 4M', cor: 'Azul', status: 'Inspecionada', inspecionadaEm: '10/10/2026', foto: null },
  { id: '00000000-0000-0000-0000-000000000005', tag: 'E-SUC-005', descricao: 'CINTA 4T - 4M', cor: 'Amarelo', status: 'Não é mês de inspeção', inspecionadaEm: null, foto: null },
  { id: '00000000-0000-0000-0000-000000000006', tag: 'E-SUC-006', descricao: 'CINTA 4T - 4M', cor: 'Amarelo', status: 'Não é mês de inspeção', inspecionadaEm: null, foto: null },
  { id: '00000000-0000-0000-0000-000000000008', tag: 'E-SUC-008', descricao: 'CINTA 6T - 4M', cor: 'Verde', status: 'Não é mês de inspeção', inspecionadaEm: null, foto: null },
  { id: '00000000-0000-0000-0000-000000000009', tag: 'E-SUC-009', descricao: 'CINTA 6T - 4M', cor: 'Verde', status: 'Não é mês de inspeção', inspecionadaEm: null, foto: null },
  { id: '00000000-0000-0000-0000-000000000010', tag: 'E-SUC-010', descricao: 'CINTA 2T - 2M', cor: 'Vermelho', status: 'Inspecionada', inspecionadaEm: '09/10/2026', foto: null },
  { id: '00000000-0000-0000-0000-000000000011', tag: 'E-SUC-011', descricao: 'CINTA 2T - 2M', cor: 'Vermelho', status: 'Inspecionada', inspecionadaEm: '09/10/2026', foto: null },
  { id: '00000000-0000-0000-0000-000000000012', tag: 'E-SUC-012', descricao: 'CINTA 2T - 2M', cor: 'Azul', status: 'Pendente', inspecionadaEm: null, foto: null },
  { id: '00000000-0000-0000-0000-000000000013', tag: 'E-SUC-013', descricao: 'CINTA 2T - 2M', cor: 'Azul', status: 'Pendente', inspecionadaEm: null, foto: null },
  { id: '00000000-0000-0000-0000-000000000014', tag: 'E-SUC-014', descricao: 'CINTA 2T - 6M', cor: 'Amarelo', status: 'Não é mês de inspeção', inspecionadaEm: null, foto: null },
  { id: '00000000-0000-0000-0000-000000000015', tag: 'E-SUC-015', descricao: 'CINTA 2T - 6M', cor: 'Amarelo', status: 'Não é mês de inspeção', inspecionadaEm: null, foto: null },
  { id: '00000000-0000-0000-0000-000000000016', tag: 'E-SUC-016', descricao: 'CINTA 2T - 6M', cor: 'Verde', status: 'Não é mês de inspeção', inspecionadaEm: null, foto: null },
  { id: '00000000-0000-0000-0000-000000000017', tag: 'E-SUC-017', descricao: 'CINTA 2T - 6M', cor: 'Verde', status: 'Não é mês de inspeção', inspecionadaEm: null, foto: null },
]

function getStoredCintas(): Cinta[] {
  const env = getCurrentEnv()
  if (typeof window === 'undefined') {
    return env === 'hydro-civil' ? [] : DEFAULT_CINTAS
  }
  try {
    const raw = localStorage.getItem(getStorageKey())
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        if (env === 'hydro-civil') {
          return parsed.filter((c: any) => !c.tag?.startsWith('E-SUC-'))
        }
        return parsed
      }
    }
  } catch (e) {
    // ignore
  }
  return env === 'hydro-civil' ? [] : DEFAULT_CINTAS
}

function getStoredHistorico(): HistoricoInspecao[] {
  const env = getCurrentEnv()
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(getHistStorageKey())
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        if (env === 'hydro-civil') {
          return parsed.filter((h: any) => !h.tag?.startsWith('E-SUC-'))
        }
        return parsed
      }
    }
  } catch (e) {
    // ignore
  }
  return []
}

interface NovaCintaInput {
  tag: string
  descricao: string
  cor: 'Vermelho' | 'Azul' | 'Amarelo' | 'Verde'
  status?: 'Inspecionada' | 'Não é mês de inspeção' | 'Pendente'
}

interface CintasState {
  cintas: Cinta[]
  historico: HistoricoInspecao[]
  hasHydrated: boolean
  isLoading: boolean
  setHasHydrated: (hasHydrated: boolean) => void
  fetchCintas: () => Promise<void>
  adicionarCinta: (nova: NovaCintaInput) => Promise<Cinta>
  removerCinta: (id: string) => Promise<void>
  inspecionarCinta: (
    id: string,
    dataInspecao: string,
    observacoes: string,
    novoStatus: 'Inspecionada' | 'Não é mês de inspeção',
    foto?: string | null
  ) => Promise<void>
}

export const useCintasStore = create<CintasState>()((set, get) => ({
  cintas: getStoredCintas(),
  historico: getStoredHistorico(),
  hasHydrated: false,
  isLoading: false,
  setHasHydrated: (hasHydrated) => set({ hasHydrated }),

  fetchCintas: async () => {
    set({ isLoading: true })
    const env = getCurrentEnv()
    const storageKey = getStorageKey()
    const histKey = getHistStorageKey()

    try {
      // 1. Tentar ler do global_settings (sincronização na nuvem por ambiente)
      const [cintasRes, histRes] = await Promise.all([
        supabase
          .from('global_settings')
          .select('value')
          .eq('key', storageKey)
          .maybeSingle(),
        supabase
          .from('global_settings')
          .select('value')
          .eq('key', histKey)
          .maybeSingle(),
      ])

      if (cintasRes.data?.value && Array.isArray(cintasRes.data.value)) {
        let cloudCintas = cintasRes.data.value as Cinta[]
        let cloudHist = (histRes.data?.value && Array.isArray(histRes.data.value) ? histRes.data.value : []) as HistoricoInspecao[]

        if (env === 'hydro-civil') {
          cloudCintas = cloudCintas.filter((c: any) => !c.tag?.startsWith('E-SUC-'))
          cloudHist = cloudHist.filter((h: any) => !h.tag?.startsWith('E-SUC-'))
        }

        if (typeof window !== 'undefined') {
          localStorage.setItem(storageKey, JSON.stringify(cloudCintas))
          localStorage.setItem(histKey, JSON.stringify(cloudHist))
        }

        set({
          cintas: cloudCintas,
          historico: cloudHist,
          hasHydrated: true,
          isLoading: false,
        })
        return
      }

      // 2. Fallback localStorage / padrão do ambiente
      let localCintas = getStoredCintas()
      let localHist = getStoredHistorico()

      if (env === 'hydro-civil') {
        localCintas = localCintas.filter((c: any) => !c.tag?.startsWith('E-SUC-'))
        localHist = localHist.filter((h: any) => !h.tag?.startsWith('E-SUC-'))
        if (typeof window !== 'undefined') {
          localStorage.setItem(storageKey, JSON.stringify(localCintas))
          localStorage.setItem(histKey, JSON.stringify(localHist))
        }
      } else if (env === 'barcarena' && localCintas.length > 0) {
        supabase.from('global_settings').upsert({ key: storageKey, value: localCintas }).catch(() => {})
      }

      set({
        cintas: localCintas,
        historico: localHist,
        hasHydrated: true,
        isLoading: false,
      })
    } catch (error) {
      console.warn('[Cintas] Usando armazenamento local para cintas:', error)
      const localCintas = getStoredCintas()
      const localHist = getStoredHistorico()
      set({
        cintas: localCintas,
        historico: localHist,
        isLoading: false,
        hasHydrated: true,
      })
    }
  },

  adicionarCinta: async (nova: NovaCintaInput) => {
    const env = getCurrentEnv()
    const state = get()
    const storageKey = getStorageKey()

    const novaCinta: Cinta = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cinta-${Date.now()}`,
      tag: nova.tag.trim().toUpperCase(),
      descricao: nova.descricao.trim(),
      cor: nova.cor,
      status: nova.status || 'Pendente',
      inspecionadaEm: nova.status === 'Inspecionada' ? new Date().toLocaleDateString('pt-BR') : null,
      foto: null,
    }

    const updatedCintas = [...state.cintas, novaCinta]

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(updatedCintas))
      } catch (e) {
        console.warn('Erro ao salvar cinta no localStorage:', e)
      }
    }

    set({ cintas: updatedCintas })

    // Sincronizar com a nuvem (global_settings do ambiente ativo)
    try {
      await supabase
        .from('global_settings')
        .upsert({ key: storageKey, value: updatedCintas })
    } catch (err) {
      console.warn('Erro ao sincronizar nova cinta com global_settings:', err)
    }

    return novaCinta
  },

  removerCinta: async (id: string) => {
    const env = getCurrentEnv()
    const state = get()
    const storageKey = getStorageKey()
    const histKey = getHistStorageKey()

    const updatedCintas = state.cintas.filter((c) => c.id !== id)
    const updatedHistorico = state.historico.filter((h) => h.cinta_id !== id)

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(updatedCintas))
        localStorage.setItem(histKey, JSON.stringify(updatedHistorico))
      } catch (e) {
        console.warn('Erro ao atualizar localStorage após remoção:', e)
      }
    }

    set({
      cintas: updatedCintas,
      historico: updatedHistorico,
    })

    try {
      await Promise.all([
        supabase.from('global_settings').upsert({ key: storageKey, value: updatedCintas }),
        supabase.from('global_settings').upsert({ key: histKey, value: updatedHistorico }),
      ])
    } catch (err) {
      console.warn('Erro ao sincronizar remoção com global_settings:', err)
    }
  },

  inspecionarCinta: async (id, dataInspecao, observacoes, novoStatus, foto = null) => {
    const env = getCurrentEnv()
    const state = get()
    const storageKey = getStorageKey()
    const histKey = getHistStorageKey()

    const cintaToEdit = state.cintas.find((c) => c.id === id)
    if (!cintaToEdit) return

    const novaDataFmt =
      novoStatus === 'Inspecionada' ? dataInspecao.split('-').reverse().join('/') : null
    const dataHoraFmt =
      dataInspecao.split('-').reverse().join('/') +
      ' ' +
      new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    // Obter nome do usuário inspetor
    let inspetor = 'Você'
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        inspetor = user.user_metadata?.nome || user.user_metadata?.full_name || 'Você'
      }
    } catch (e) {
      // ignore
    }

    const fotoFinal = foto !== undefined ? foto : cintaToEdit.foto || null

    const novoHistorico: HistoricoInspecao = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      cinta_id: id,
      tag: cintaToEdit.tag,
      descricao: cintaToEdit.descricao,
      cor: cintaToEdit.cor,
      data: dataHoraFmt,
      status: novoStatus === 'Inspecionada' ? 'Inspecionada' : 'Cancelada',
      inspetor: inspetor,
      observacoes: observacoes || null,
      foto: fotoFinal,
    }

    const updatedCintas = state.cintas.map((c) =>
      c.id === id
        ? {
            ...c,
            status: novoStatus,
            inspecionadaEm: novaDataFmt,
            foto: fotoFinal,
          }
        : c
    )
    const updatedHistorico = [novoHistorico, ...state.historico]

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(updatedCintas))
        localStorage.setItem(histKey, JSON.stringify(updatedHistorico))
      } catch (e) {
        console.warn('Erro ao salvar no localStorage:', e)
      }
    }

    set({
      cintas: updatedCintas,
      historico: updatedHistorico,
    })

    // Sincronizar na nuvem
    try {
      await Promise.all([
        supabase.from('global_settings').upsert({ key: storageKey, value: updatedCintas }),
        supabase.from('global_settings').upsert({ key: histKey, value: updatedHistorico }),
      ])
    } catch (error) {
      console.warn('Erro ao sincronizar histórico e cinta com global_settings:', error)
    }
  },
}))
