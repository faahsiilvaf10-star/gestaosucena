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

interface CintasState {
  cintas: Cinta[]
  historico: HistoricoInspecao[]
  hasHydrated: boolean
  isLoading: boolean
  setHasHydrated: (hasHydrated: boolean) => void
  fetchCintas: () => Promise<void>
  inspecionarCinta: (id: string, dataInspecao: string, observacoes: string, novoStatus: 'Inspecionada' | 'Não é mês de inspeção') => Promise<void>
}

export const useCintasStore = create<CintasState>()((set, get) => ({
  cintas: [],
  historico: [],
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

      const mappedCintas: Cinta[] = (cintasData || []).map((c: any) => ({
        id: c.id,
        tag: c.tag,
        descricao: c.descricao,
        cor: c.cor,
        status: c.status,
        inspecionadaEm: c.inspecionada_em,
        foto: c.foto
      }))

      set({
        cintas: mappedCintas,
        historico: historicoData as HistoricoInspecao[],
        hasHydrated: true,
        isLoading: false
      })
    } catch (error) {
      console.error('Erro ao buscar cintas do supabase:', error)
      set({ isLoading: false, hasHydrated: true })
    }
  },

  inspecionarCinta: async (id, dataInspecao, observacoes, novoStatus) => {
    const state = get()
    const cintaToEdit = state.cintas.find(c => c.id === id)
    if (!cintaToEdit) return

    const novaDataFmt = novoStatus === 'Inspecionada' ? dataInspecao.split('-').reverse().join('/') : null
    const dataHoraFmt = dataInspecao.split('-').reverse().join('/') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    
    // Get user from supabase (if logged in) or fallback to 'Você'
    let inspetor = 'Você'
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        inspetor = user.user_metadata?.nome || user.user_metadata?.full_name || 'Você'
      }
    } catch (e) {
      // ignore
    }

    const novoHistorico = {
      cinta_id: id,
      tag: cintaToEdit.tag,
      descricao: cintaToEdit.descricao,
      cor: cintaToEdit.cor,
      data: dataHoraFmt,
      status: novoStatus === 'Inspecionada' ? 'Inspecionada' : 'Cancelada',
      inspetor: inspetor,
      observacoes: observacoes || null,
      foto: null
    }

    try {
      // Insert Historico
      const { data: insertedHistorico, error: histError } = await supabase
        .from('seguranca_cintas_historico')
        .insert(novoHistorico)
        .select()
        .single()
      
      if (histError) throw histError

      // Update Cinta
      const { error: cintaError } = await supabase
        .from('seguranca_cintas')
        .update({ 
          status: novoStatus, 
          inspecionada_em: novaDataFmt 
        })
        .eq('id', id)
      
      if (cintaError) throw cintaError

      // Update Local State
      set((state) => ({
        cintas: state.cintas.map(c => c.id === id ? { ...c, status: novoStatus, inspecionadaEm: novaDataFmt } : c),
        historico: [insertedHistorico as HistoricoInspecao, ...state.historico]
      }))

    } catch (error) {
      console.error('Erro ao salvar inspeção:', error)
      throw error 
    }
  }
}))
