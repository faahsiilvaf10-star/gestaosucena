import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
  tag: string
  descricao: string
  cor: 'Vermelho' | 'Azul' | 'Amarelo' | 'Verde'
  data: string
  status: 'Inspecionada' | 'Cancelada'
  inspetor: string
  observacoes: string | null
  foto: string | null
}

const initialCintas: Cinta[] = [
  { id: '1', cor: 'Vermelho', tag: 'E-SUC-001', descricao: 'CINTA 4T - 4M', status: 'Pendente', inspecionadaEm: null, foto: null },
  { id: '2', cor: 'Vermelho', tag: 'E-SUC-002', descricao: 'CINTA 4T - 4M', status: 'Inspecionada', inspecionadaEm: '08/09/2026', foto: null },
  { id: '3', cor: 'Azul', tag: 'E-SUC-003', descricao: 'CINTA 4T - 4M', status: 'Não é mês de inspeção', inspecionadaEm: null, foto: null },
  { id: '4', cor: 'Azul', tag: 'E-SUC-004', descricao: 'CINTA 4T - 4M', status: 'Não é mês de inspeção', inspecionadaEm: null, foto: null },
  { id: '5', cor: 'Amarelo', tag: 'E-SUC-005', descricao: 'CINTA 4T - 4M', status: 'Não é mês de inspeção', inspecionadaEm: null, foto: null },
  { id: '6', cor: 'Amarelo', tag: 'E-SUC-006', descricao: 'CINTA 4T - 4M', status: 'Não é mês de inspeção', inspecionadaEm: null, foto: null },
  { id: '8', cor: 'Verde', tag: 'E-SUC-008', descricao: 'CINTA 6T - 4M', status: 'Não é mês de inspeção', inspecionadaEm: null, foto: null },
  { id: '9', cor: 'Verde', tag: 'E-SUC-009', descricao: 'CINTA 6T - 4M', status: 'Não é mês de inspeção', inspecionadaEm: null, foto: null },
  { id: '10', cor: 'Vermelho', tag: 'E-SUC-010', descricao: 'CINTA 2T - 2M', status: 'Pendente', inspecionadaEm: null, foto: null },
  { id: '11', cor: 'Vermelho', tag: 'E-SUC-011', descricao: 'CINTA 2T - 2M', status: 'Inspecionada', inspecionadaEm: '08/09/2026', foto: null },
  { id: '12', cor: 'Azul', tag: 'E-SUC-012', descricao: 'CINTA 2T - 2M', status: 'Não é mês de inspeção', inspecionadaEm: null, foto: null },
  { id: '13', cor: 'Azul', tag: 'E-SUC-013', descricao: 'CINTA 2T - 2M', status: 'Não é mês de inspeção', inspecionadaEm: null, foto: null },
  { id: '14', cor: 'Amarelo', tag: 'E-SUC-014', descricao: 'CINTA 2T - 6M', status: 'Não é mês de inspeção', inspecionadaEm: null, foto: null },
  { id: '15', cor: 'Amarelo', tag: 'E-SUC-015', descricao: 'CINTA 2T - 6M', status: 'Não é mês de inspeção', inspecionadaEm: null, foto: null },
  { id: '16', cor: 'Verde', tag: 'E-SUC-016', descricao: 'CINTA 2T - 6M', status: 'Não é mês de inspeção', inspecionadaEm: null, foto: null },
  { id: '17', cor: 'Verde', tag: 'E-SUC-017', descricao: 'CINTA 2T - 6M', status: 'Não é mês de inspeção', inspecionadaEm: null, foto: null },
]

const initialHistory: HistoricoInspecao[] = [
  { id: 'h1', tag: 'E-SUC-002', descricao: 'CINTA 4T - 4M', cor: 'Vermelho', data: '08/09/2026 12:24', status: 'Inspecionada', inspetor: 'Itamar de souza pereira junior', observacoes: null, foto: null },
  { id: 'h2', tag: 'E-SUC-011', descricao: 'CINTA 2T - 2M', cor: 'Vermelho', data: '08/09/2026 12:24', status: 'Inspecionada', inspetor: 'Itamar de souza pereira junior', observacoes: null, foto: null },
]

interface CintasState {
  cintas: Cinta[]
  historico: HistoricoInspecao[]
  inspecionarCinta: (id: string, dataInspecao: string, observacoes: string, novoStatus: 'Inspecionada' | 'Não é mês de inspeção') => void
}

export const useCintasStore = create<CintasState>()(persist((set) => ({
  cintas: initialCintas,
  historico: initialHistory,
  inspecionarCinta: (id, dataInspecao, observacoes, novoStatus) => set((state) => {
    const cintaToEdit = state.cintas.find(c => c.id === id)
    if (!cintaToEdit) return state

    const novaDataFmt = novoStatus === 'Inspecionada' ? dataInspecao.split('-').reverse().join('/') : null

    const newCintas = state.cintas.map(c => {
      if (c.id === id) {
        return {
          ...c,
          status: novoStatus,
          inspecionadaEm: novaDataFmt,
          foto: null
        }
      }
      return c
    })

    const novoHistorico: HistoricoInspecao = {
      id: Math.random().toString(36).substr(2, 9),
      tag: cintaToEdit.tag,
      descricao: cintaToEdit.descricao,
      cor: cintaToEdit.cor,
      data: dataInspecao.split('-').reverse().join('/') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      status: novoStatus === 'Inspecionada' ? 'Inspecionada' : 'Cancelada',
      inspetor: 'Você',
      observacoes: observacoes || null,
      foto: null
    }

    return {
      cintas: newCintas,
      historico: [novoHistorico, ...state.historico]
    }
  })
}), {
  name: 'sucena-cintas-inspecoes',
}))
