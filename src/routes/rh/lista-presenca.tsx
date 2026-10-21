import Users from 'lucide-react/dist/esm/icons/users.js';
import Search from 'lucide-react/dist/esm/icons/search.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.js';
import XCircle from 'lucide-react/dist/esm/icons/circle-x.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import Save from 'lucide-react/dist/esm/icons/save.js';
import Eye from 'lucide-react/dist/esm/icons/eye.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import Check from 'lucide-react/dist/esm/icons/check.js';
import Lock from 'lucide-react/dist/esm/icons/lock.js';
import Unlock from 'lucide-react/dist/esm/icons/lock-open.js';
import Edit2 from 'lucide-react/dist/esm/icons/pen.js';
import Copy from 'lucide-react/dist/esm/icons/copy.js';
import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import UserPlus from 'lucide-react/dist/esm/icons/user-plus.js';
import ArrowRightLeft from 'lucide-react/dist/esm/icons/arrow-right-left.js';
import { createFileRoute, Link } from '@tanstack/react-router'
import { DateInput } from '@/components/ui/DateInput'
import { getWhatsappSettings } from '@/lib/settings'
import { sendWhatsappTextOnServer } from '@/lib/whatsapp-api'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { useTheme } from '../../contexts/ThemeContext'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export const Route = createFileRoute('/rh/lista-presenca')({
  component: RhListaPresencaPage,
})

type Efetivo = {
  id: string
  nome: string
  cargo: string | null
  setor: string | null
  matricula?: string | null
  status?: string
}

function AddCollaboratorModal({ 
  isOpen, 
  onClose, 
  onAdd, 
  currentArea,
  currentColaboradores
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onAdd: (colaborador: Efetivo) => void;
  currentArea: string;
  currentColaboradores: Colaborador[];
}) {
  const [search, setSearch] = useState('')
  const [efetivo, setEfetivo] = useState<Efetivo[]>([])
  const [loading, setLoading] = useState(false)
  const [filterTab, setFilterTab] = useState<'TODOS' | 'DISPONIVEIS' | 'OUTRA_ABA'>('TODOS')

  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setFilterTab('TODOS')
      fetchEfetivo()
    }
  }, [isOpen])

  const fetchEfetivo = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('rh_efetivo')
        .select('id, nome, cargo, setor, matricula, status')
        .order('nome', { ascending: true })

      if (error) throw error
      
      // Considera ativos todos os colaboradores cujo status não é INATIVO, DEMITIDO ou DESLIGADO
      const ativos = (data || []).filter((c: any) => {
        const s = (c.status || '').toUpperCase().trim()
        return s !== 'INATIVO' && s !== 'DEMITIDO' && s !== 'DESLIGADO'
      })

      setEfetivo(ativos)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar efetivo')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  // Colaboradores que já estão na área ATUAL (não precisam ser adicionados novamente)
  const currentAreaIds = new Set(
    currentColaboradores
      .filter(c => (c.setor || 'Sem Área') === currentArea)
      .map(c => c.id)
  )

  // Mapeia onde cada colaborador já está alocado caso esteja em outra aba/área
  const otherAreaMap = new Map<string, string>()
  currentColaboradores.forEach(c => {
    const area = c.setor || 'Sem Área'
    if (area !== currentArea) {
      otherAreaMap.set(c.id, area)
    }
  })

  // Colaboradores elegíveis (excluindo os que já estão na aba atual)
  const availableEfetivo = efetivo.filter(c => !currentAreaIds.has(c.id))

  const countDisponiveis = availableEfetivo.filter(c => !otherAreaMap.has(c.id)).length
  const countOutraAba = availableEfetivo.filter(c => otherAreaMap.has(c.id)).length

  // Aplica busca e filtro de abas
  const filteredEfetivo = availableEfetivo.filter(c => {
    const isOtherArea = otherAreaMap.has(c.id)
    if (filterTab === 'DISPONIVEIS' && isOtherArea) return false
    if (filterTab === 'OUTRA_ABA' && !isOtherArea) return false

    if (!search.trim()) return true
    const term = search.toLowerCase().trim()
    return (
      c.nome.toLowerCase().includes(term) || 
      (c.cargo && c.cargo.toLowerCase().includes(term)) ||
      (c.setor && c.setor.toLowerCase().includes(term)) ||
      (c.matricula && c.matricula.toLowerCase().includes(term))
    )
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1a1c20] border border-black/10 dark:border-white/10 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-black/10 dark:border-white/10 flex justify-between items-center bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-[#0866ff] flex items-center justify-center">
              <UserPlus size={18} />
            </div>
            <div>
              <h2 className="text-[#1c1d21] dark:text-white font-semibold text-base sm:text-lg flex items-center gap-2">
                Adicionar a {currentArea}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-xs">
                Selecione os colaboradores para compor a presença desta área
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search & Filter bar */}
        <div className="p-4 border-b border-black/10 dark:border-white/10 space-y-3 bg-black/[0.01] dark:bg-white/[0.01]">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por nome, cargo ou matrícula..." 
              className="w-full bg-black/5 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl pl-10 pr-9 py-2.5 outline-none focus:border-[#0866ff] focus:ring-2 focus:ring-[#0866ff]/20 transition-all text-[#1c1d21] dark:text-white text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setFilterTab('TODOS')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                filterTab === 'TODOS'
                  ? 'bg-[#0866ff] text-white shadow-sm'
                  : 'bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10'
              }`}
            >
              Todos
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterTab === 'TODOS' ? 'bg-white/25 text-white' : 'bg-black/10 dark:bg-white/10 text-gray-500 dark:text-gray-400'}`}>
                {availableEfetivo.length}
              </span>
            </button>

            <button
              onClick={() => setFilterTab('DISPONIVEIS')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                filterTab === 'DISPONIVEIS'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Disponíveis
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterTab === 'DISPONIVEIS' ? 'bg-white/25 text-white' : 'bg-black/10 dark:bg-white/10 text-gray-500 dark:text-gray-400'}`}>
                {countDisponiveis}
              </span>
            </button>

            <button
              onClick={() => setFilterTab('OUTRA_ABA')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                filterTab === 'OUTRA_ABA'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10'
              }`}
            >
              <ArrowRightLeft size={12} />
              Em outra aba
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterTab === 'OUTRA_ABA' ? 'bg-white/25 text-white' : 'bg-black/10 dark:bg-white/10 text-gray-500 dark:text-gray-400'}`}>
                {countOutraAba}
              </span>
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-[260px]">
          {loading ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-black/5 dark:border-white/5 animate-pulse bg-black/[0.02] dark:bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-black/10 dark:bg-white/10" />
                    <div className="space-y-1.5">
                      <div className="w-36 h-3.5 bg-black/10 dark:bg-white/10 rounded" />
                      <div className="w-24 h-2.5 bg-black/10 dark:bg-white/10 rounded" />
                    </div>
                  </div>
                  <div className="w-20 h-7 bg-black/10 dark:bg-white/10 rounded-lg" />
                </div>
              ))}
            </div>
          ) : filteredEfetivo.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-black/5 dark:bg-white/5 text-gray-400 dark:text-gray-500 mx-auto flex items-center justify-center mb-3">
                <Users size={22} />
              </div>
              <h4 className="text-sm font-semibold text-[#1c1d21] dark:text-white mb-1">
                Nenhum colaborador encontrado
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                {search 
                  ? 'Não encontramos nenhum colaborador com os termos pesquisados.' 
                  : filterTab !== 'TODOS'
                  ? 'Não há colaboradores para a categoria selecionada.'
                  : 'Todos os colaboradores ativos já foram alocados nesta área.'}
              </p>
            </div>
          ) : (
            filteredEfetivo.map(c => {
              const currentOtherArea = otherAreaMap.get(c.id)
              const initials = c.nome
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map(n => n[0])
                .join('')
                .toUpperCase()

              return (
                <div 
                  key={c.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-black/5 dark:border-white/5 hover:border-black/15 dark:hover:border-white/15 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 dark:from-blue-500/30 dark:to-purple-500/30 text-[#0866ff] dark:text-blue-400 font-bold text-xs flex items-center justify-center shrink-0">
                      {initials || <Users size={16} />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[#1c1d21] dark:text-white font-medium text-sm truncate">
                        {c.nome}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        <span className="truncate">{c.cargo || 'Sem cargo'}</span>
                        {c.matricula && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-[11px] text-gray-400">Matrícula: {c.matricula}</span>
                          </>
                        )}
                      </div>
                      <div className="mt-1">
                        {currentOtherArea ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <ArrowRightLeft size={10} />
                            Na aba: <strong>{currentOtherArea}</strong>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Disponível
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => onAdd(c)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      currentOtherArea
                        ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        : 'bg-[#0866ff] hover:bg-[#0756d6] text-white shadow-sm shadow-blue-500/20'
                    }`}
                    title={currentOtherArea ? `Mover da aba ${currentOtherArea} para ${currentArea}` : `Adicionar à ${currentArea}`}
                  >
                    {currentOtherArea ? (
                      <>
                        <ArrowRightLeft size={13} />
                        <span className="hidden sm:inline">Mover para cá</span>
                        <span className="sm:hidden">Mover</span>
                      </>
                    ) : (
                      <>
                        <Plus size={14} />
                        <span>Adicionar</span>
                      </>
                    )}
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 px-5 border-t border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{filteredEfetivo.length} de {availableEfetivo.length} colaboradores listados</span>
          <button 
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-[#1c1d21] dark:text-white font-medium transition-colors"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  )
}

function PreviewModal({ 
  isOpen, 
  onClose, 
  date, 
  area, 
  colaboradores 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  date: string;
  area: string;
  colaboradores: Colaborador[];
}) {
  if (!isOpen) return null

  const generatePreviewText = () => {
    // Check if the date is YYYY-MM-DD and format properly
    const parts = date.split('-');
    const dateFormatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date;
    
    const suporteCargos = ['ENC', 'ENCARREGADO', 'SUPERVISOR', 'LIDER', 'LÍDER', 'GERENTE', 'COORDENADOR', 'TECNICO', 'TÉCNICO', 'ENGENHEIRO'];
    
    const isSuporte = (cargo: string | null) => {
      if (!cargo) return false;
      const c = cargo.toUpperCase();
      return suporteCargos.some(sc => c.includes(sc));
    };
    
    const suporte = colaboradores.filter(c => isSuporte(c.cargo));
    const execucao = colaboradores.filter(c => !isSuporte(c.cargo));
    
    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'PRESENTE': return '✅';
        case 'AUSENTE': return '❌';
        case 'EXTERNO': return '🛠️';
        case 'ATESTADO': return '🏥';
        default: return '✅';
      }
    };
    
    let text = `📅 Data: ${dateFormatted}\n\n`;
    text += `✳️  ${area.toUpperCase()}  ✳️\n\n`;
    
    if (suporte.length > 0) {
      text += `✴️EQUIPE DE SUPORTE✴️\n\n`;
      suporte.forEach(c => {
        text += `🙋 ${c.cargo ? c.cargo.toUpperCase() : 'ENC'}: ${c.nome} ${getStatusIcon(c.status)}\n\n`;
      });
    }
    
    if (execucao.length > 0) {
      text += `✴️EQUIPE DE EXECUÇÃO✴️\n\n`;
      
      const byCargo = execucao.reduce((acc, c) => {
        const cargo = (c.cargo || 'SEM CARGO').toUpperCase();
        if (!acc[cargo]) acc[cargo] = [];
        acc[cargo].push(c);
        return acc;
      }, {} as Record<string, Colaborador[]>);
      
      Object.keys(byCargo).forEach(cargo => {
        text += `👷 ${cargo}:\n\n`;
        byCargo[cargo].forEach(c => {
          text += `${c.nome} ${getStatusIcon(c.status)}\n\n`;
        });
      });
    }
    
    const presentes = colaboradores.filter(c => c.status === 'PRESENTE').length;
    const ausentes = colaboradores.filter(c => c.status === 'AUSENTE').length;
    const externos = colaboradores.filter(c => c.status === 'EXTERNO').length;
    const atestados = colaboradores.filter(c => c.status === 'ATESTADO').length;
    const total = colaboradores.length;
    
    text += `───────────────────────────\n`;
    text += `✅ Presentes: ${presentes}  |  ❌ Ausentes: ${ausentes}  |  🛠️ Externo: ${externos}  |  👥 Total: ${total}\n`;
    if (atestados > 0) {
      text += `🏥 Atestados: ${atestados}\n`;
    }
    
    return text;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(generatePreviewText())
    toast.success('Texto copiado para a área de transferência!')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1e1e1e] border border-black/10 dark:border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="p-4 border-b border-black/10 dark:border-white/10 flex justify-between items-center bg-black/5 dark:bg-white/5">
          <h2 className="text-[#1c1d21] dark:text-white font-semibold flex items-center gap-2">
            <Eye size={18} /> 
            Pré-visualizar
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-black/5 dark:bg-black/20">
          <pre className="font-mono text-xs sm:text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
            {generatePreviewText()}
          </pre>
        </div>

        <div className="p-4 border-t border-black/10 dark:border-white/10 flex gap-2 justify-end bg-white dark:bg-[#1e1e1e]">
          <button onClick={onClose} className="px-4 py-2 rounded-full text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10 text-[#1c1d21] dark:text-white transition-colors">
            Fechar
          </button>
          <button onClick={handleCopy} className="px-4 py-2 rounded-full text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 transition-colors">
            <Copy size={16} /> Copiar para WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}

type Colaborador = {
  id: string
  nome: string
  cargo: string | null
  setor: string | null
  status: string // PRESENTE, AUSENTE, EXTERNO, ATESTADO
}

function RhListaPresencaPage() {
  const { isDark } = useTheme()
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<string>('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [lockedAreas, setLockedAreas] = useState<string[]>([])
  const [isAddingArea, setIsAddingArea] = useState(false)
  const [newAreaName, setNewAreaName] = useState('')
  const [customAreas, setCustomAreas] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('rh_custom_areas')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [deletedAreas, setDeletedAreas] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('rh_deleted_areas')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [areaToDelete, setAreaToDelete] = useState<string | null>(null)
  
  // To track date for the attendance (using local date, not UTC)
  const getLocalDate = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }
  const [attendanceDate, setAttendanceDate] = useState<string>(getLocalDate())

  // Ref to track when initial data loading is done (prevents overwriting drafts during load)
  const initialLoadDone = useRef(false)

  useEffect(() => {
    initialLoadDone.current = false
    fetchDados()
  }, [attendanceDate])

  const fetchDados = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('rh_efetivo')
        .select('id, nome, cargo, setor')
        .order('nome', { ascending: true })
      
      if (error) throw error
      
      // Map efetivo data (used as lookup in fetchPresencas)
      const mappedData: Colaborador[] = (data || []).map(d => ({
        ...d,
        setor: (!d.setor || d.setor.toUpperCase().includes('BARCARENA')) ? 'Área Gabião' : d.setor,
        status: 'PRESENTE'
      }))
        
      // Fetch saved attendance for today if any (this is what actually sets colaboradores)
      await fetchPresencas(mappedData)
      
    } catch (err) {
      console.error('Erro ao buscar efetivo:', err)
      toast.error('Erro ao buscar colaboradores')
    } finally {
      setLoading(false)
    }
  }

  const fetchPresencas = async (currentColaboradores: Colaborador[]) => {
    try {
      const efetivoMap = new Map(currentColaboradores.map(c => [c.id, c]))
      const defaultAreas = ['Área Gabião', 'Área Jardinagem', 'Área ADM', 'Área Transporte']

      const normalizeArea = (areaName?: string | null) => {
        if (!areaName || areaName.toUpperCase().includes('BARCARENA')) return 'Área Gabião'
        return areaName
      }

      // 1. Buscar registros salvos para a data selecionada
      const { data: todayData, error: todayError } = await supabase
        .from('rh_presencas')
        .select('*')
        .eq('data', attendanceDate)

      if (todayError) throw todayError

      // Agrupa por área o que já está salvo no banco para a data atual
      const savedTodayByArea = new Map<string, any[]>()
      todayData?.forEach(d => {
        if (d.status !== 'REMOVIDO') {
          const normArea = normalizeArea(d.area)
          if (!savedTodayByArea.has(normArea)) {
            savedTodayByArea.set(normArea, [])
          }
          savedTodayByArea.get(normArea)!.push(d)
        }
      })

      // 2. Buscar presenças anteriores a esta data para herdar os mesmos funcionários do dia anterior
      const { data: pastData, error: pastError } = await supabase
        .from('rh_presencas')
        .select('*')
        .lt('data', attendanceDate)
        .order('data', { ascending: false })
        .limit(500)

      if (pastError) {
        console.error('Erro ao buscar presenças anteriores:', pastError)
      }

      // Para cada área, identifica qual foi a data mais recente salva
      const latestDateByArea = new Map<string, string>()
      pastData?.forEach(d => {
        const normArea = normalizeArea(d.area)
        if (!latestDateByArea.has(normArea)) {
          latestDateByArea.set(normArea, d.data)
        }
      })

      // Para cada área, coleta os funcionários da data mais recente
      const previousEmployeesByArea = new Map<string, any[]>()
      pastData?.forEach(d => {
        const normArea = normalizeArea(d.area)
        if (d.data === latestDateByArea.get(normArea) && d.status !== 'REMOVIDO') {
          if (!previousEmployeesByArea.has(normArea)) {
            previousEmployeesByArea.set(normArea, [])
          }
          previousEmployeesByArea.get(normArea)!.push(d)
        }
      })

      // Rascunho do localStorage (se houver modificações ativas não salvas)
      let draftColaboradores: Colaborador[] = []
      const draftStr = localStorage.getItem(`rh_draft_${attendanceDate}`)
      if (draftStr) {
        try {
          const parsed = JSON.parse(draftStr)
          if (Array.isArray(parsed)) draftColaboradores = parsed
        } catch (_) {}
      }

      // Todas as áreas conhecidas
      const allKnownAreas = Array.from(new Set([
        ...defaultAreas,
        ...customAreas,
        ...Array.from(savedTodayByArea.keys()),
        ...Array.from(latestDateByArea.keys()),
        ...draftColaboradores.map(c => c.setor).filter(Boolean) as string[]
      ]))

      let nextColaboradores: Colaborador[] = []
      let newLockedAreas: string[] = []

      // Montar a lista área por área
      for (const area of allKnownAreas) {
        if (savedTodayByArea.has(area)) {
          // ÁREA JÁ SALVA NO BANCO PARA A DATA ATUAL:
          const rows = savedTodayByArea.get(area) || []
          rows.forEach(d => {
            const emp = efetivoMap.get(d.funcionario_id)
            nextColaboradores.push({
              id: d.funcionario_id,
              nome: emp ? emp.nome : (d.nome || 'Desconhecido'),
              cargo: emp ? emp.cargo : null,
              setor: area,
              status: d.status
            })
          })

          // Bloqueia a área caso não tenha sido explicitamente desbloqueada pelo usuário
          if (localStorage.getItem(`rh_unlocked_${attendanceDate}_${area}`) !== 'true') {
            newLockedAreas.push(area)
          }
        } else {
          // ÁREA NÃO SALVA AINDA PARA A DATA ATUAL:
          const isCleared = sessionStorage.getItem(`rh_cleared_${attendanceDate}_${area}`) === 'true'
          const draftForArea = draftColaboradores.filter(c => (c.setor || 'Sem Área') === area)

          if (!isCleared && draftForArea.length > 0) {
            draftForArea.forEach(c => nextColaboradores.push(c))
          } else if (!isCleared) {
            // HERDA DO DIA ANTERIOR SALVO:
            const prevRows = previousEmployeesByArea.get(area) || []
            prevRows.forEach(d => {
              const emp = efetivoMap.get(d.funcionario_id)
              nextColaboradores.push({
                id: d.funcionario_id,
                nome: emp ? emp.nome : (d.nome || 'Desconhecido'),
                cargo: emp ? emp.cargo : null,
                setor: area,
                status: 'PRESENTE' // Já pré-definidos como presentes para o novo dia
              })
            })
          }
        }
      }

      setLockedAreas(newLockedAreas)
      setColaboradores(nextColaboradores)

      // Atualiza tabs disponíveis
      const areasFromColabs = Array.from(new Set(nextColaboradores.map(c => c.setor).filter(Boolean) as string[]))
      const allAreasSet = new Set([...defaultAreas, ...areasFromColabs, ...customAreas])
      deletedAreas.forEach(a => {
        if (!areasFromColabs.includes(a)) {
          allAreasSet.delete(a)
        }
      })
      const availableAreas = Array.from(allAreasSet)
      
      const firstAreaWithEmployees = availableAreas.find(a => nextColaboradores.some(c => (c.setor || 'Sem Área') === a))
      
      // Mantém a aba ativa se ela ainda for válida, senão seleciona a primeira com funcionários
      setActiveTab(prev => (prev && availableAreas.includes(prev)) ? prev : (firstAreaWithEmployees || availableAreas[0] || 'Sem Área'))

      initialLoadDone.current = true
    } catch (err) {
      console.error('Erro ao carregar presenças:', err)
    }
  }

  // Save to draft whenever there are changes (only after initial load)
  useEffect(() => {
    if (initialLoadDone.current) {
      localStorage.setItem(`rh_draft_${attendanceDate}`, JSON.stringify(colaboradores))
    }
  }, [colaboradores, attendanceDate])

  const handleStatusChange = (id: string, newStatus: 'PRESENTE' | 'AUSENTE' | 'EXTERNO' | 'ATESTADO') => {
    if (lockedAreas.includes(activeTab)) return;
    setColaboradores(prev => prev.map(c => {
      if (c.id === id) {
        // Se clicar no mesmo status que já está marcado, desmarca e volta a ser PRESENTE
        return { ...c, status: c.status === newStatus ? 'PRESENTE' : newStatus }
      }
      return c
    }))
  }

  const handleRemoveColaborador = (id: string) => {
    if (lockedAreas.includes(activeTab)) return;
    
    setColaboradores(prev => prev.filter(c => c.id !== id))
    toast.success('Colaborador removido da lista')
  }

  const handleAddColaborador = (efetivo: Efetivo) => {
    setColaboradores(prev => {
      const existingIndex = prev.findIndex(c => c.id === efetivo.id)
      
      if (existingIndex >= 0) {
        // Se já existe no estado local (estava em outra área), move para a área atual
        const updated = [...prev]
        updated[existingIndex] = {
          ...updated[existingIndex],
          setor: activeTab,
          status: 'PRESENTE'
        }
        return updated
      }

      // Adiciona um novo na área atual
      const novoColaborador: Colaborador = {
        ...efetivo,
        setor: activeTab,
        status: 'PRESENTE'
      }
      return [...prev, novoColaborador]
    })
    
    toast.success(`${efetivo.nome} adicionado(a) à ${activeTab}`)
  }

  const handleSalvar = async () => {
    const toastId = toast.loading(`Salvando ${activeTab}...`)
    try {
      // Deletar registros APENAS da área atual e data atual
      const { error: delError } = await supabase
        .from('rh_presencas')
        .delete()
        .eq('data', attendanceDate)
        .eq('area', activeTab)

      if (delError) throw delError;

      // Prepare records for the active tab only
      const recordsToInsert = colaboradores
        .filter(c => (c.setor || 'Sem Área') === activeTab)
        .map(c => ({
          data: attendanceDate,
          area: c.setor || 'Sem Área',
          funcionario_id: c.id,
          status: c.status
        }))
      
      if (recordsToInsert.length > 0) {
        // Se algum colaborador salvo aqui estava registrado em outra área nesta mesma data, remove da outra área para evitar duplicidade
        const funcIds = recordsToInsert.map(r => r.funcionario_id)
        await supabase
          .from('rh_presencas')
          .delete()
          .eq('data', attendanceDate)
          .neq('area', activeTab)
          .in('funcionario_id', funcIds)

        const { error } = await supabase
          .from('rh_presencas')
          .insert(recordsToInsert)
          
        if (error) throw error;
      }
      
      setLockedAreas(prev => [...prev, activeTab])
      localStorage.removeItem(`rh_unlocked_${attendanceDate}_${activeTab}`)
      sessionStorage.removeItem(`rh_cleared_${attendanceDate}_${activeTab}`)
      
      const { logActivity } = await import('../../lib/logActivity');
      const dateObj = new Date(attendanceDate + 'T12:00:00');
      await logActivity({
        module: 'RH',
        action: `Lista de presença salva para a data ${dateObj.toLocaleDateString('pt-BR')} (Área: ${activeTab})`
      });

      // Dispara envio automático no WhatsApp se estiver habilitado
      try {
        const settings = await getWhatsappSettings();
        if (settings.attendanceAlerts?.enabled && settings.url && settings.token) {
          const groupId = settings.attendanceAlerts.specificGroupId || settings.groupId;
          if (groupId) {
            const listArea = colaboradores.filter(c => (c.setor || 'Sem Área') === activeTab && c.status !== 'REMOVIDO');
            const presentes = listArea.filter(c => c.status === 'PRESENTE').length;
            const ausentes = listArea.filter(c => c.status === 'AUSENTE').length;
            const externos = listArea.filter(c => c.status === 'EXTERNO').length;
            const atestados = listArea.filter(c => c.status === 'ATESTADO').length;
            const total = listArea.length;
            
            // Build names list
            const suporteCargos = ['ENC', 'ENCARREGADO', 'SUPERVISOR', 'LIDER', 'LÍDER', 'GERENTE', 'COORDENADOR', 'TECNICO', 'TÉCNICO', 'ENGENHEIRO'];
            const isSuporte = (cargo: string | null) => {
              if (!cargo) return false;
              const c = cargo.toUpperCase();
              return suporteCargos.some(sc => c.includes(sc));
            };
            
            const getStatusIcon = (status: string) => {
              switch (status) {
                case 'PRESENTE': return '✅';
                case 'AUSENTE': return '❌';
                case 'EXTERNO': return '🛠️';
                case 'ATESTADO': return '🏥';
                default: return '✅';
              }
            };

            const suporte = listArea.filter(c => isSuporte(c.cargo));
            const execucao = listArea.filter(c => !isSuporte(c.cargo));
            
            let listaNomesStr = '';
            if (suporte.length > 0) {
              listaNomesStr += `✴️EQUIPE DE SUPORTE✴️\n\n`;
              suporte.forEach(c => {
                listaNomesStr += `🙋 ${c.cargo ? c.cargo.toUpperCase() : 'ENC'}: ${c.nome} ${getStatusIcon(c.status)}\n\n`;
              });
            }
            if (execucao.length > 0) {
              listaNomesStr += `✴️EQUIPE DE EXECUÇÃO✴️\n\n`;
              const byCargo = execucao.reduce((acc: any, c: any) => {
                const cargo = (c.cargo || 'SEM CARGO').toUpperCase();
                if (!acc[cargo]) acc[cargo] = [];
                acc[cargo].push(c);
                return acc;
              }, {});
              
              Object.keys(byCargo).forEach(cargo => {
                listaNomesStr += `👷 ${cargo}:\n\n`;
                byCargo[cargo].forEach((c: any) => {
                  listaNomesStr += `${c.nome} ${getStatusIcon(c.status)}\n\n`;
                });
              });
            }

            let resumoStr = `✅ Presentes: ${presentes}  |  ❌ Ausentes: ${ausentes}  |  🛠️ Externo: ${externos}  |  👥 Total: ${total}`;
            if (atestados > 0) {
              resumoStr += `\n🏥 Atestados: ${atestados}`;
            }
            
            const dataStr = dateObj.toLocaleDateString('pt-BR');
            let text = settings.messageTemplates?.listaPresenca || '📅 Data: {data}\n\n✳️  {area}  ✳️\n\n{lista_nomes}\n───────────────────────────\n{resumo}';
            text = text.replace('{data}', dataStr)
                       .replace('{area}', activeTab.toUpperCase())
                       .replace('{presentes}', presentes.toString())
                       .replace('{ausentes}', ausentes.toString())
                       .replace('{total}', total.toString())
                       .replace('{lista_nomes}', listaNomesStr.trimEnd())
                       .replace('{resumo}', resumoStr);
            
            await sendWhatsappTextOnServer({
              data: {
                url: settings.url,
                token: settings.token,
                instanceId: settings.instanceId,
                phone: groupId,
                text: text
              }
            });
          }
        }
      } catch (err) {
        console.error("Erro ao enviar whatsapp automático (lista de presença)", err);
      }

      toast.success(`${activeTab} salva com sucesso!`, { id: toastId })
    } catch (err: any) {
      console.error('ERRO AO SALVAR:', err)
      toast.error(err.message || 'Erro desconhecido ao salvar lista', { id: toastId })
    }
  }

  const handleGeneratePDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF()
    
    doc.setFontSize(18)
    doc.text('Relatório de Presença - Sucena', 14, 20)
    
    doc.setFontSize(12)
    const dataFormatada = attendanceDate.split('-').reverse().join('/')
    doc.text(`Data: ${dataFormatada}`, 14, 28)
    
    const tableData = colaboradores
      .filter(c => c.status !== 'REMOVIDO')
      .map(c => [
        c.nome,
        c.cargo || '-',
        c.setor || 'Sem Área',
        c.status
      ])
      
    // Ordenar por Status -> Área -> Nome
    tableData.sort((a, b) => {
      if (a[3] !== b[3]) return a[3].localeCompare(b[3])
      if (a[2] !== b[2]) return a[2].localeCompare(b[2])
      return a[0].localeCompare(b[0])
    })
    
    autoTable(doc, {
      startY: 35,
      head: [['Nome', 'Cargo', 'Área', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: [240, 240, 240] }
    })
    
    doc.save(`Relatorio_Presenca_${attendanceDate}.pdf`)
    toast.success('PDF gerado com sucesso!')
  }

  const markAll = (statusToSet: string) => {
    setColaboradores(prev => prev.map(c => {
      // Only modify employees in the currently active tab
      const area = c.setor || 'Sem Área'
      if (area === activeTab) {
        return { ...c, status: statusToSet }
      }
      return c
    }))
  }

  // Compute all unique areas (defaults + from data + custom added in session)
  const defaultAreas = ['Área Gabião', 'Área Jardinagem', 'Área ADM', 'Área Transporte']
  const areasFromColaboradores = Array.from(new Set(colaboradores.map(c => c.setor).filter(Boolean) as string[]))
  const allAreasSet = new Set([...defaultAreas, ...areasFromColaboradores, ...customAreas])
  
  // Remove deleted areas ONLY if they don't have employees
  deletedAreas.forEach(a => {
    if (!areasFromColaboradores.includes(a)) {
      allAreasSet.delete(a)
    }
  })
  
  const areas = Array.from(allAreasSet)
  
  const confirmDeleteArea = () => {
    if (!areaToDelete) return;
    
    // Add to deleted
    setDeletedAreas(prev => {
      const next = [...prev, areaToDelete]
      localStorage.setItem('rh_deleted_areas', JSON.stringify(next))
      return next
    })
    
    // Remove from custom if it was custom
    setCustomAreas(prev => {
      const next = prev.filter(a => a !== areaToDelete)
      localStorage.setItem('rh_custom_areas', JSON.stringify(next))
      return next
    })
    
    // Remove anyone in that area
    setColaboradores(prev => prev.filter(c => (c.setor || 'Sem Área') !== areaToDelete))
    
    // Select first available tab
    const nextAreasSet = new Set([...defaultAreas, ...areasFromColaboradores, ...customAreas])
    deletedAreas.forEach(a => nextAreasSet.delete(a))
    nextAreasSet.delete(areaToDelete)
    
    const remainingAreas = Array.from(nextAreasSet)
    if (activeTab === areaToDelete) {
      if (remainingAreas.length > 0) {
        setActiveTab(remainingAreas[0])
      } else {
        setActiveTab('')
      }
    }
    
    setAreaToDelete(null)
  }
  
  // Filter for active tab
  const activeAreaColaboradores = colaboradores.filter(c => (c.setor || 'Sem Área') === activeTab)
  
  // Search filter
  const filteredColaboradores = activeAreaColaboradores.filter(c => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return c.nome.toLowerCase().includes(q) || (c.cargo && c.cargo.toLowerCase().includes(q))
  })

  // Stats for the active tab
  const total = activeAreaColaboradores.length
  const presentes = activeAreaColaboradores.filter(c => c.status === 'PRESENTE').length
  const ausentes = activeAreaColaboradores.filter(c => c.status === 'AUSENTE').length
  // Externos and Atestados aren't explicitly counted in the top bar according to the image, but ausentes is marked in red.

  return (
    <div className={`flex flex-col min-h-screen ${isDark ? 'bg-[#111111] text-[#1c1d21] dark:text-white' : 'bg-[#faf9f6] text-gray-900'}`}>
      <div className="flex flex-col gap-6 p-4 md:p-8 w-full max-w-7xl mx-auto flex-1">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link to="/rh" className="text-gray-500 hover:text-black dark:hover:text-white transition-colors">
                <ArrowLeft size={24} />
              </Link>
              <h1 className="text-[42px] tracking-tight" style={{ lineHeight: '1' }}>Lista de Presença</h1>
            </div>
          </div>
          
          <div className="flex gap-2 items-center">
            <DateInput 
              value={attendanceDate}
              onChange={(val) => setAttendanceDate(val)}
              className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 outline-none"
            />
          </div>
        </div>

        {/* Content Area - Designed to match image */}
        <div className="flex-1 flex flex-col mt-4">
          
          {/* Tabs */}
          <div className="flex flex-wrap gap-2 pb-2">
            {areas.map(area => {
              const count = colaboradores.filter(c => (c.setor || 'Sem Área') === area).length
              const isActive = activeTab === area
              return (
                <div 
                  key={area}
                  className={`shrink-0 flex items-center rounded-full transition-colors whitespace-nowrap pl-4 pr-1 py-1.5 ${isActive ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-black/5 hover:bg-black/10 text-gray-600 dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-300'}`}
                >
                  <button onClick={() => setActiveTab(area)} className="text-sm font-semibold flex items-center gap-2 pr-2 border-r border-current border-opacity-20">
                    {area} <span className="opacity-50 text-xs">({count})</span>
                  </button>
                  <button onClick={() => setAreaToDelete(area)} className="pl-2 pr-1 opacity-50 hover:opacity-100 hover:text-red-500 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              )
            })}
            
            {isAddingArea ? (
              <div className="shrink-0 flex items-center bg-black/10 dark:bg-white/10 rounded-full px-4 py-1">
                <input 
                  type="text" 
                  value={newAreaName}
                  onChange={e => setNewAreaName(e.target.value)}
                  placeholder="Nome da área"
                  className="bg-transparent border-none outline-none text-sm w-32 text-[#1c1d21] dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newAreaName.trim()) {
                      const finalName = newAreaName.trim();
                      setCustomAreas(prev => {
                        const next = [...prev, finalName];
                        localStorage.setItem('rh_custom_areas', JSON.stringify(next));
                        return next;
                      });
                      setActiveTab(finalName)
                      setNewAreaName('')
                      setIsAddingArea(false)
                    } else if (e.key === 'Escape') {
                      setIsAddingArea(false)
                    }
                  }}
                  onBlur={() => {
                    if (newAreaName.trim()) {
                      const finalName = newAreaName.trim();
                      setCustomAreas(prev => {
                        const next = [...prev, finalName];
                        localStorage.setItem('rh_custom_areas', JSON.stringify(next));
                        return next;
                      });
                      setActiveTab(finalName)
                    }
                    setNewAreaName('')
                    setIsAddingArea(false)
                  }}
                />
              </div>
            ) : (
              <button onClick={() => setIsAddingArea(true)} className="shrink-0 px-4 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 bg-black/5 hover:bg-black/10 text-gray-600 dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-300 whitespace-nowrap transition-colors">
                <Plus size={16} /> Nova Área
              </button>
            )}
          </div>

          <div className="flex flex-col gap-4 md:gap-6 mt-4">
              {/* Dashboard Stats */}
              <div className="grid grid-cols-3 gap-2 md:gap-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 md:p-4 flex flex-col md:flex-row items-center md:justify-between text-center md:text-left">
                  <div className="flex flex-col items-center md:items-start">
                    <p className="text-gray-500 dark:text-gray-400 text-[10px] md:text-xs font-medium uppercase tracking-wider mb-0.5 md:mb-1">Total</p>
                    <p className="text-[#1c1d21] dark:text-white text-xl md:text-3xl font-bold">{total}</p>
                  </div>
                  <Users className="text-gray-400 dark:text-gray-500 hidden md:block" size={32} />
                </div>
                
                <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 md:p-4 flex flex-col md:flex-row items-center md:justify-between text-center md:text-left">
                  <div className="flex flex-col items-center md:items-start">
                    <p className="text-gray-500 dark:text-gray-400 text-[10px] md:text-xs font-medium uppercase tracking-wider mb-0.5 md:mb-1">Presentes</p>
                    <p className="text-[#1c1d21] dark:text-white text-xl md:text-3xl font-bold">{presentes}</p>
                  </div>
                  <CheckCircle2 className="text-gray-400 dark:text-gray-500 hidden md:block" size={32} />
                </div>
                
                <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 md:p-4 flex flex-col md:flex-row items-center md:justify-between text-center md:text-left">
                  <div className="flex flex-col items-center md:items-start">
                    <p className="text-red-400/70 text-[10px] md:text-xs font-medium uppercase tracking-wider mb-0.5 md:mb-1">Ausentes</p>
                    <p className="text-red-500 text-xl md:text-3xl font-bold">{ausentes}</p>
                  </div>
                  <XCircle className="text-red-500/20 hidden md:block" size={32} />
                </div>
              </div>

              {/* Toolbar */}
              <div className="flex flex-col md:flex-row gap-3 justify-between items-center">
                <div className="relative w-full md:w-56">
                  <input 
                    type="text" 
                    placeholder="Buscar por nome ou função..." 
                    className="w-full bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-full pl-4 pr-10 py-2.5 outline-none focus:border-[#0866ff] transition-colors text-[#1c1d21] dark:text-white text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery ? (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-white">
                      <X size={16} />
                    </button>
                  ) : (
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2 w-full md:w-auto pb-2 md:pb-0">
                  <button onClick={() => markAll('PRESENTE')} disabled={lockedAreas.includes(activeTab)} className="shrink-0 px-4 py-2.5 rounded-full text-xs font-semibold bg-black/5 dark:bg-black/40 hover:bg-black/10 dark:hover:bg-black/60 text-[#1c1d21] dark:text-white border border-black/10 dark:border-white/10 whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    Todos presentes
                  </button>
                  <button onClick={() => markAll('AUSENTE')} disabled={lockedAreas.includes(activeTab)} className="shrink-0 px-4 py-2.5 rounded-full text-xs font-semibold bg-black/5 dark:bg-black/40 hover:bg-black/10 dark:hover:bg-black/60 text-[#1c1d21] dark:text-white border border-black/10 dark:border-white/10 whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    Todos ausentes
                  </button>
                  <button 
                    onClick={() => {
                      if (window.confirm(`Deseja limpar os colaboradores de ${activeTab}?`)) {
                        sessionStorage.setItem(`rh_cleared_${attendanceDate}_${activeTab}`, 'true');
                        setColaboradores(prev => {
                          const updated = prev.filter(c => (c.setor || 'Sem Área') !== activeTab);
                          localStorage.setItem(`rh_draft_${attendanceDate}`, JSON.stringify(updated));
                          return updated;
                        });
                        toast.success(`Lista de ${activeTab} limpa com sucesso!`);
                      }
                    }} 
                    disabled={lockedAreas.includes(activeTab) || colaboradores.filter(c => (c.setor || 'Sem Área') === activeTab).length === 0} 
                    className="shrink-0 px-4 py-2.5 rounded-full text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Limpar Lista
                  </button>
                  <button onClick={() => setIsAddModalOpen(true)} disabled={lockedAreas.includes(activeTab)} className="shrink-0 px-4 py-2.5 rounded-full text-xs font-semibold bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-[#1c1d21] dark:text-white border border-black/10 dark:border-white/10 flex items-center gap-2 whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <Plus size={14} /> Adicionar
                  </button>
                  
                  {lockedAreas.includes(activeTab) ? (
                    <button 
                      onClick={() => {
                        setLockedAreas(prev => prev.filter(a => a !== activeTab))
                        localStorage.setItem(`rh_unlocked_${attendanceDate}_${activeTab}`, 'true')
                      }} 
                      className="shrink-0 px-4 py-2.5 rounded-full text-xs font-bold bg-amber-500 text-black hover:bg-amber-400 flex items-center gap-2 whitespace-nowrap ml-2 transition-colors"
                    >
                      <Unlock size={14} /> Editar
                    </button>
                  ) : (
                    <button onClick={handleSalvar} className="shrink-0 px-4 py-2.5 rounded-full text-xs font-bold bg-black text-white dark:bg-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 flex items-center gap-2 whitespace-nowrap ml-2 transition-colors">
                      <Save size={14} /> Salvar {activeTab}
                    </button>
                  )}
                  
                  <button onClick={() => setIsPreviewOpen(true)} className="shrink-0 px-4 py-2.5 rounded-full text-xs font-semibold bg-black/5 dark:bg-black/40 hover:bg-black/10 dark:hover:bg-black/60 text-[#1c1d21] dark:text-white border border-black/10 dark:border-white/10 flex items-center gap-2 whitespace-nowrap transition-colors">
                    <Eye size={14} /> Pré-visualizar
                  </button>
                  <button onClick={handleGeneratePDF} className="shrink-0 px-4 py-2.5 rounded-full text-xs font-semibold bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-2 whitespace-nowrap transition-colors">
                    <FileText size={14} /> Baixar PDF
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="mt-4">
                <h3 className="text-[#1c1d21] dark:text-white text-lg mb-4">{activeTab} — {total} funcionário(s)</h3>
                
                {loading ? (
                  <div className="py-10 text-center text-white/70">Carregando...</div>
                ) : filteredColaboradores.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-4 text-white/70 mt-4">
                    <p>Nenhum colaborador nesta área.</p>
                    <button onClick={() => setIsAddModalOpen(true)} disabled={lockedAreas.includes(activeTab)} className="px-5 py-2.5 rounded-full text-sm font-semibold bg-white/10 hover:bg-white/20 text-[#1c1d21] dark:text-white flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      <Plus size={16} /> Adicionar colaborador
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {filteredColaboradores.map(c => {
                      const isStriked = c.status === 'AUSENTE' || c.status === 'ATESTADO'
                      
                      return (
                        <div key={c.id} className="group border-b border-white/10 py-3 flex items-center justify-between hover:bg-white/5 transition-colors px-2 -mx-2 rounded-lg">
                          
                          <div className="flex items-center gap-4 flex-1">
                            {/* Radio Options */}
                            <div className="flex flex-col gap-1 w-24 flex-shrink-0">
                              <label className="flex items-center gap-2 cursor-pointer group/opt">
                                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors ${c.status === 'AUSENTE' ? 'border-amber-400 bg-amber-400' : 'border-black/30 dark:border-white/30 group-hover/opt:border-black/60 dark:group-hover/opt:border-white/60'}`}>
                                  {c.status === 'AUSENTE' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                </div>
                                <span className="text-[9px] font-bold tracking-wider text-gray-700 dark:text-gray-300">AUSENTE</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer group/opt">
                                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors ${c.status === 'EXTERNO' ? 'border-amber-400 bg-amber-400' : 'border-black/30 dark:border-white/30 group-hover/opt:border-black/60 dark:group-hover/opt:border-white/60'}`}>
                                  {c.status === 'EXTERNO' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                </div>
                                <span className="text-[9px] font-bold tracking-wider text-gray-700 dark:text-gray-300">EXTERNO</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer group/opt">
                                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors ${c.status === 'ATESTADO' ? 'border-amber-400 bg-amber-400' : 'border-black/30 dark:border-white/30 group-hover/opt:border-black/60 dark:group-hover/opt:border-white/60'}`}>
                                  {c.status === 'ATESTADO' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                </div>
                                <span className="text-[9px] font-bold tracking-wider text-gray-700 dark:text-gray-300">ATESTADO</span>
                              </label>
                              
                              {/* Invisible clickable overlays to handle the logic easily without messing with native inputs */}
                              <div className="absolute opacity-0">
                                <input type="radio" checked={c.status === 'AUSENTE'} onChange={() => !lockedAreas.includes(activeTab) && handleStatusChange(c.id, 'AUSENTE')} disabled={lockedAreas.includes(activeTab)} />
                                <input type="radio" checked={c.status === 'EXTERNO'} onChange={() => !lockedAreas.includes(activeTab) && handleStatusChange(c.id, 'EXTERNO')} disabled={lockedAreas.includes(activeTab)} />
                                <input type="radio" checked={c.status === 'ATESTADO'} onChange={() => !lockedAreas.includes(activeTab) && handleStatusChange(c.id, 'ATESTADO')} disabled={lockedAreas.includes(activeTab)} />
                              </div>
                            </div>

                            {/* Transparent click areas over the custom radios for better UX */}
                            <div className="absolute w-24 h-14 z-10 flex flex-col">
                               <div className={`flex-1 ${lockedAreas.includes(activeTab) ? 'cursor-not-allowed' : 'cursor-pointer'}`} onClick={() => handleStatusChange(c.id, 'AUSENTE')}></div>
                               <div className={`flex-1 ${lockedAreas.includes(activeTab) ? 'cursor-not-allowed' : 'cursor-pointer'}`} onClick={() => handleStatusChange(c.id, 'EXTERNO')}></div>
                               <div className={`flex-1 ${lockedAreas.includes(activeTab) ? 'cursor-not-allowed' : 'cursor-pointer'}`} onClick={() => handleStatusChange(c.id, 'ATESTADO')}></div>
                            </div>

                            <div className="flex flex-col pl-4">
                              <span className={`text-[#1c1d21] dark:text-white font-bold transition-all ${isStriked ? 'line-through text-gray-400 dark:text-white/50' : ''}`}>
                                {c.nome}
                              </span>
                              <span className={`text-xs text-gray-500 dark:text-gray-400 tracking-wider uppercase ${isStriked ? 'opacity-50' : ''}`}>
                                {c.cargo || 'SEM CARGO'}
                              </span>
                            </div>
                          </div>

                          {/* Status Icons on the right */}
                          <div className="flex items-center gap-4">
                            {c.status === 'AUSENTE' ? (
                              <div className="w-6 h-6 rounded-md bg-red-500/20 text-red-500 flex items-center justify-center">
                                <X size={14} strokeWidth={3} />
                              </div>
                            ) : c.status === 'EXTERNO' || c.status === 'ATESTADO' ? (
                              <div className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-[10px]">
                                {c.status === 'EXTERNO' ? 'EXT' : 'ATE'}
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-md bg-green-500/20 text-green-500 flex items-center justify-center">
                                <Check size={14} strokeWidth={3} />
                              </div>
                            )}
                            
                            <button onClick={() => handleRemoveColaborador(c.id)} disabled={lockedAreas.includes(activeTab)} className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Remover da lista">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

          </div>
        </div>
      </div>
      
      <AddCollaboratorModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onAdd={handleAddColaborador} 
        currentArea={activeTab}
        currentColaboradores={colaboradores}
      />
      
      <PreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        date={attendanceDate}
        area={activeTab}
        colaboradores={activeAreaColaboradores}
      />
      
      {/* Delete Area Modal */}
      {areaToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1e1e1e] border border-black/10 dark:border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col p-6 text-center">
            <Trash2 className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-[#1c1d21] dark:text-white font-bold text-xl mb-2">Excluir Área?</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">
              Tem certeza que deseja remover a aba <strong>{areaToDelete}</strong>? Os colaboradores não serão excluídos do sistema.
            </p>
            <div className="flex gap-2 w-full">
              <button onClick={() => setAreaToDelete(null)} className="flex-1 px-4 py-2.5 rounded-full text-sm font-semibold bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-[#1c1d21] dark:text-white transition-colors">
                Cancelar
              </button>
              <button onClick={confirmDeleteArea} className="flex-1 px-4 py-2.5 rounded-full text-sm font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors">
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


