import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { 
  Users,
  Search,
  X,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Plus,
  Save,
  Eye,
  Trash2,
  Check,
  Lock,
  Unlock,
  Edit2,
  Copy,
  FileText
} from 'lucide-react'
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

  useEffect(() => {
    if (isOpen) {
      fetchEfetivo()
    }
  }, [isOpen])

  const fetchEfetivo = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('rh_efetivo')
        .select('id, nome, cargo, setor')
        .order('nome', { ascending: true })

      if (error) throw error
      setEfetivo(data || [])
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar efetivo')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  // Filtra efetivo baseado na busca e remove os que já estão na lista (em QUALQUER área)
  const currentAreaIds = new Set(
    currentColaboradores.map(c => c.id)
  )
  
  const filteredEfetivo = efetivo.filter(c => {
    if (currentAreaIds.has(c.id)) return false // Já está nesta área
    if (!search) return true
    return c.nome.toLowerCase().includes(search.toLowerCase()) || 
           (c.cargo && c.cargo.toLowerCase().includes(search.toLowerCase()))
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Plus size={18} /> 
            Adicionar a {currentArea}
          </h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
            <input 
              type="text" 
              placeholder="Buscar colaborador no efetivo..." 
              className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 outline-none focus:border-[#0866ff] transition-colors text-white text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="py-10 text-center text-white/50">Carregando efetivo...</div>
          ) : filteredEfetivo.length === 0 ? (
            <div className="py-10 text-center text-white/50">Nenhum colaborador encontrado.</div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredEfetivo.map(c => (
                <button 
                  key={c.id}
                  onClick={() => onAdd(c)}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors text-left group"
                >
                  <div>
                    <div className="text-white font-medium text-sm">{c.nome}</div>
                    <div className="text-white/50 text-xs mt-0.5">{c.cargo || 'Sem cargo'} • {c.setor || 'Sem setor'}</div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 group-hover:bg-white/10 group-hover:text-white transition-all">
                    <Plus size={16} />
                  </div>
                </button>
              ))}
            </div>
          )}
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
      <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Eye size={18} /> 
            Pré-visualizar
          </h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-black/20">
          <pre className="text-white/90 font-mono text-sm whitespace-pre-wrap font-sans">
            {generatePreviewText()}
          </pre>
        </div>

        <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end">
          <button onClick={handleCopy} className="px-5 py-2.5 rounded-full text-sm font-semibold bg-[#0866ff] hover:bg-[#0866ff]/90 text-white flex items-center gap-2 transition-colors">
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
      console.error('Error fetching efetivo:', err)
      toast.error('Erro ao buscar colaboradores')
    } finally {
      setLoading(false)
    }
  }

  const fetchPresencas = async (currentColaboradores: Colaborador[]) => {
    try {
      const { data, error } = await supabase
        .from('rh_presencas')
        .select('*')
        .eq('data', attendanceDate)
        
      if (error) throw error
      
      let nextColaboradores: Colaborador[] = []
      let draftLoaded = false
      const defaultAreas = ['Área Gabião', 'Área Jardinagem', 'Área ADM', 'Área Transporte']
      
      let newLockedAreas: string[] = []
      const draftStr = localStorage.getItem(`rh_draft_${attendanceDate}`)

      if (draftStr !== null) {
        try {
          nextColaboradores = JSON.parse(draftStr)
          draftLoaded = true
        } catch (e) {
          console.error("Erro ao ler rascunho:", e)
        }
      }

      if (!draftLoaded) {
        if (data && data.length > 0) {
          // Lista já salva para esta data no banco — mostrar SOMENTE os funcionários salvos
          const efetivoMap = new Map(currentColaboradores.map(c => [c.id, c]))
          
          nextColaboradores = data
            .filter(d => d.status !== 'REMOVIDO')
            .map(d => {
              const emp = efetivoMap.get(d.funcionario_id)
              let finalArea = d.area
              if (!finalArea || finalArea.toUpperCase().includes('BARCARENA')) finalArea = 'Área Gabião'
              return {
                id: d.funcionario_id,
                nome: emp ? emp.nome : 'Desconhecido',
                cargo: emp ? emp.cargo : null,
                setor: finalArea,
                status: d.status
              }
            })
        } else {
          // Nenhuma lista para hoje — começar VAZIA
          // O usuário adiciona os colaboradores manualmente
          nextColaboradores = []
        }
      }

      // Bloqueia as áreas que vieram do banco (exceto as que o usuário desbloqueou manualmente no cache)
      if (data && data.length > 0) {
        const dbAreas = Array.from(new Set(data.map(d => d.area || 'Sem Área')))
        newLockedAreas = dbAreas.filter(area => localStorage.getItem(`rh_unlocked_${attendanceDate}_${area}`) !== 'true')
      }

      setLockedAreas(newLockedAreas)

      setColaboradores(nextColaboradores)

      // Auto-select first tab that has employees
      const areasFromColabs = Array.from(new Set(nextColaboradores.map(c => c.setor).filter(Boolean) as string[]))
      const allAreasSet = new Set([...defaultAreas, ...areasFromColabs, ...customAreas])
      deletedAreas.forEach(a => {
        if (!areasFromColabs.includes(a)) {
          allAreasSet.delete(a)
        }
      })
      const availableAreas = Array.from(allAreasSet)
      
      const firstAreaWithEmployees = availableAreas.find(a => nextColaboradores.some(c => (c.setor || 'Sem Área') === a))
      setActiveTab(firstAreaWithEmployees || availableAreas[0] || 'Sem Área')

      // Mark initial load as done so draft saving can begin
      initialLoadDone.current = true

    } catch (err) {
      console.error(err)
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
    setIsAddModalOpen(false)
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
        const { error } = await supabase
          .from('rh_presencas')
          .insert(recordsToInsert)
          
        if (error) throw error;
      }
      
      setLockedAreas(prev => [...prev, activeTab])
      localStorage.removeItem(`rh_unlocked_${attendanceDate}_${activeTab}`)
      toast.success(`${activeTab} salva com sucesso!`, { id: toastId })
    } catch (err: any) {
      console.error('ERRO AO SALVAR:', err)
      toast.error(err.message || 'Erro desconhecido ao salvar lista', { id: toastId })
    }
  }

  const handleGeneratePDF = () => {
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
    <div className={`flex flex-col min-h-screen ${isDark ? 'bg-[#111111] text-white' : 'bg-[#faf9f6] text-gray-900'}`}>
      <div className="flex flex-col gap-6 p-4 md:p-8 w-full max-w-7xl mx-auto flex-1">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link to="/rh" className="text-gray-500 hover:text-black dark:hover:text-white transition-colors">
                <ArrowLeft size={24} />
              </Link>
              <h1 className="text-[42px] font-display italic tracking-tight" style={{ lineHeight: '1' }}>Lista de Presença</h1>
            </div>
          </div>
          
          <div className="flex gap-2 items-center">
            <input 
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
              className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 outline-none"
            />
          </div>
        </div>

        {/* Content Area - Designed to match image */}
        <div className="flex-1 flex flex-col mt-4">
          
          {/* Tabs */}
          <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
            {areas.map(area => {
              const count = colaboradores.filter(c => (c.setor || 'Sem Área') === area).length
              const isActive = activeTab === area
              return (
                <div 
                  key={area}
                  className={`flex items-center rounded-full transition-colors whitespace-nowrap pl-4 pr-1 py-1.5
                    ${isActive 
                      ? 'bg-black text-white dark:bg-white dark:text-black' 
                      : 'bg-black/5 hover:bg-black/10 text-gray-600 dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-300'}`}
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
              <div className="flex items-center bg-black/10 dark:bg-white/10 rounded-full px-4 py-1">
                <input 
                  type="text" 
                  value={newAreaName}
                  onChange={e => setNewAreaName(e.target.value)}
                  placeholder="Nome da área"
                  className="bg-transparent border-none outline-none text-sm w-32 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
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
              <button onClick={() => setIsAddingArea(true)} className="px-4 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 bg-black/5 hover:bg-black/10 text-gray-600 dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-300 whitespace-nowrap transition-colors">
                <Plus size={16} /> Nova Área
              </button>
            )}
          </div>

          <div className="flex flex-col gap-6 mt-4">
              {/* Dashboard Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-1">Total</p>
                    <p className="text-white text-3xl font-bold">{total}</p>
                  </div>
                  <Users className="text-white/20" size={32} />
                </div>
                
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-1">Presentes</p>
                    <p className="text-white text-3xl font-bold">{presentes}</p>
                  </div>
                  <CheckCircle2 className="text-white/20" size={32} />
                </div>
                
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-red-400/70 text-xs font-medium uppercase tracking-wider mb-1">Ausentes</p>
                    <p className="text-red-500 text-3xl font-bold">{ausentes}</p>
                  </div>
                  <XCircle className="text-red-500/20" size={32} />
                </div>
              </div>

              {/* Toolbar */}
              <div className="flex flex-col md:flex-row gap-3 justify-between items-center">
                <div className="relative w-full md:w-80">
                  <input 
                    type="text" 
                    placeholder="Buscar por nome ou função..." 
                    className="w-full bg-black/40 border border-white/10 rounded-full pl-4 pr-10 py-2.5 outline-none focus:border-[#0866ff] transition-colors text-white text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery ? (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                      <X size={16} />
                    </button>
                  ) : (
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                  )}
                </div>
                
                <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
                  <button onClick={() => markAll('PRESENTE')} disabled={lockedAreas.includes(activeTab)} className="px-4 py-2.5 rounded-full text-xs font-semibold bg-black/40 hover:bg-black/60 text-white border border-white/10 whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    Todos presentes
                  </button>
                  <button onClick={() => markAll('AUSENTE')} disabled={lockedAreas.includes(activeTab)} className="px-4 py-2.5 rounded-full text-xs font-semibold bg-black/40 hover:bg-black/60 text-white border border-white/10 whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    Todos ausentes
                  </button>
                  <button onClick={() => setIsAddModalOpen(true)} disabled={lockedAreas.includes(activeTab)} className="px-4 py-2.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/10 flex items-center gap-2 whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <Plus size={14} /> Adicionar colaborador
                  </button>
                  
                  {lockedAreas.includes(activeTab) ? (
                    <button 
                      onClick={() => {
                        setLockedAreas(prev => prev.filter(a => a !== activeTab))
                        localStorage.setItem(`rh_unlocked_${attendanceDate}_${activeTab}`, 'true')
                      }} 
                      className="px-4 py-2.5 rounded-full text-xs font-bold bg-amber-500 text-black hover:bg-amber-400 flex items-center gap-2 whitespace-nowrap ml-2 transition-colors"
                    >
                      <Unlock size={14} /> Editar
                    </button>
                  ) : (
                    <button onClick={handleSalvar} className="px-4 py-2.5 rounded-full text-xs font-bold bg-white text-black hover:bg-gray-200 flex items-center gap-2 whitespace-nowrap ml-2 transition-colors">
                      <Save size={14} /> Salvar {activeTab}
                    </button>
                  )}
                  
                  <button onClick={() => setIsPreviewOpen(true)} className="px-4 py-2.5 rounded-full text-xs font-semibold bg-black/40 hover:bg-black/60 text-white border border-white/10 flex items-center gap-2 whitespace-nowrap transition-colors">
                    <Eye size={14} /> Pré-visualizar
                  </button>
                  <button onClick={handleGeneratePDF} className="px-4 py-2.5 rounded-full text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/20 flex items-center gap-2 whitespace-nowrap transition-colors">
                    <FileText size={14} /> Baixar PDF
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="mt-4">
                <h3 className="text-white font-serif text-lg mb-4">{activeTab} — {total} funcionário(s)</h3>
                
                {loading ? (
                  <div className="py-10 text-center text-white/50">Carregando...</div>
                ) : filteredColaboradores.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-4 text-white/50 mt-4">
                    <p>Nenhum colaborador nesta área.</p>
                    <button onClick={() => setIsAddModalOpen(true)} disabled={lockedAreas.includes(activeTab)} className="px-5 py-2.5 rounded-full text-sm font-semibold bg-white/10 hover:bg-white/20 text-white flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
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
                                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors
                                  ${c.status === 'AUSENTE' ? 'border-amber-400 bg-amber-400' : 'border-white/30 group-hover/opt:border-white/60'}`}>
                                  {c.status === 'AUSENTE' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                </div>
                                <span className="text-[9px] font-bold tracking-wider text-white/70">AUSENTE</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer group/opt">
                                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors
                                  ${c.status === 'EXTERNO' ? 'border-amber-400 bg-amber-400' : 'border-white/30 group-hover/opt:border-white/60'}`}>
                                  {c.status === 'EXTERNO' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                </div>
                                <span className="text-[9px] font-bold tracking-wider text-white/70">EXTERNO</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer group/opt">
                                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors
                                  ${c.status === 'ATESTADO' ? 'border-amber-400 bg-amber-400' : 'border-white/30 group-hover/opt:border-white/60'}`}>
                                  {c.status === 'ATESTADO' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                </div>
                                <span className="text-[9px] font-bold tracking-wider text-white/70">ATESTADO</span>
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
                              <span className={`text-white font-bold transition-all ${isStriked ? 'line-through text-white/40' : ''}`}>
                                {c.nome}
                              </span>
                              <span className={`text-xs text-white/50 tracking-wider uppercase ${isStriked ? 'opacity-50' : ''}`}>
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
                            
                            <button onClick={() => handleRemoveColaborador(c.id)} disabled={lockedAreas.includes(activeTab)} className="text-white/20 hover:text-white/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Remover da lista">
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
          <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden p-6">
            <h2 className="text-xl text-white font-bold mb-4">Excluir Área?</h2>
            <p className="text-white/70 mb-6 text-sm">
              Tem certeza que deseja excluir a <strong>{areaToDelete}</strong>? 
              Todos os colaboradores associados a ela na lista de hoje serão removidos da presença.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setAreaToDelete(null)} className="px-4 py-2 rounded-full text-white/70 hover:bg-white/10 hover:text-white transition-colors text-sm font-medium">
                Cancelar
              </button>
              <button onClick={confirmDeleteArea} className="px-4 py-2 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors text-sm font-medium">
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
