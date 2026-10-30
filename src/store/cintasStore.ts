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

const STORAGE_KEY = 'sucena_cintas_data'
const HIST_STORAGE_KEY = 'sucena_cintas_historico'

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
  if (typeof window === 'undefined') return DEFAULT_CINTAS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch (e) {
    // ignore
  }
  return DEFAULT_CINTAS
}

function getStoredHistorico(): HistoricoInspecao[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(HIST_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch (e) {
    // ignore
  }
  return []
}

interface CintasState {
  cintas: Cinta[]
  historico: HistoricoInspecao[]
  hasHydrated: boolean
  isLoading: boolean
  setHasHydrated: (hasHydrated: boolean) => void
  fetchCintas: () => Promise<void>
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
    try {
      const { data: cintasData, error: cintasError } = await supabase
        .from('seguranca_cintas')
        .select('*')
        .order('tag', { ascending: true })

      if (cintasError) throw cintasError

      const { data: historicoData, error: historicoError } = await supabase
        .from('seguranca_cintas_historico')
        .select('*')
        .order('created_at', { ascending: false })

      if (historicoError) throw historicoError

      if (cintasData && cintasData.length > 0) {
        const mappedCintas: Cinta[] = cintasData.map((c: any) => ({
          id: c.id,
          tag: c.tag,
          descricao: c.descricao,
          cor: c.cor,
          status: c.status,
          inspecionadaEm: c.inspecionada_em,
          foto: c.foto || null,
        }))

        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(mappedCintas))
          if (historicoData) {
            localStorage.setItem(HIST_STORAGE_KEY, JSON.stringify(historicoData))
          }
        }

        set({
          cintas: mappedCintas,
          historico: (historicoData || []) as HistoricoInspecao[],
          hasHydrated: true,
          isLoading: false,
        })
        return
      }

      // Se retornou vazio do banco, usa o fallback local
      const localCintas = getStoredCintas()
      const localHist = getStoredHistorico()
      set({
        cintas: localCintas,
        historico: localHist,
        hasHydrated: true,
        isLoading: false,
      })
    } catch (error) {
      console.warn('Usando armazenamento local para cintas:', error)
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

  inspecionarCinta: async (id, dataInspecao, observacoes, novoStatus, foto = null) => {
    const state = get()
    const cintaToEdit = state.cintas.find((c) => c.id === id)
    if (!cintaToEdit) return

    const novaDataFmt =
      novoStatus === 'Inspecionada' ? dataInspecao.split('-').reverse().join('/') : null
    const dataHoraFmt =
      dataInspecao.split('-').reverse().join('/') +
      ' ' +
      new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    // Get user from supabase (if logged in) or fallback to 'Você'
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

    // Always update local state & localStorage immediately
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCintas))
        localStorage.setItem(HIST_STORAGE_KEY, JSON.stringify(updatedHistorico))
      } catch (e) {
        console.warn('Erro ao salvar no localStorage:', e)
      }
    }

    set({
      cintas: updatedCintas,
      historico: updatedHistorico,
    })

    // Sync to Supabase in background
    try {
      await supabase.from('seguranca_cintas_historico').insert(novoHistorico)
      await supabase
        .from('seguranca_cintas')
        .update({
          status: novoStatus,
          inspecionada_em: novaDataFmt,
          foto: fotoFinal,
        })
        .eq('id', id)
    } catch (error) {
      console.warn('Erro ao sincronizar com supabase (salvo localmente):', error)
    }
  },
}))
