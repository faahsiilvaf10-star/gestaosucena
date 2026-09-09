import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../contexts/ThemeContext'
import { 
  Search, Filter, ArrowRightToLine, ArrowRightFromLine, RefreshCw, AlertCircle, 
  History, Clock, LogIn, LogOut, Info, Truck, FileDown, Calendar
} from 'lucide-react'
import { toast } from 'sonner' // Assuming sonner is the toast library used
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export const Route = createFileRoute('/equipamentos/entrada-saida')({
  component: EntradaSaidaPage,
})

interface Equipment {
  id: string
  name: string
  plate_tag: string
  category?: string
  location_status?: 'inside' | 'outside' // Added by schema
  last_exit_reason?: string
  last_exit_description?: string
  updated_at: string
}

interface Movement {
  id: string
  equipment_id: string
  movement_type: 'entry' | 'exit'
  exit_reason: string | null
  description: string | null
  created_at: string
  created_by: string | null
}

const EXIT_REASONS = [
  { value: 'preventive_maintenance', label: 'Manutenção Preventiva' },
  { value: 'corrective_maintenance', label: 'Manutenção Corretiva' },
  { value: 'inspection', label: 'Vistoria' },
  { value: 'external_service', label: 'Serviço Externo' },
  { value: 'other', label: 'Outro' },
]

function EntradaSaidaPage() {
  const { isDark } = useTheme()
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('Todos')
  const [filterCategory, setFilterCategory] = useState<string>('Todas as categorias')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Modals
  const [selectedEq, setSelectedEq] = useState<Equipment | null>(null)
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false)
  const [isExitModalOpen, setIsExitModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)

  // Report Modal
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [reportStartDate, setReportStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [reportEndDate, setReportEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  
  const [eqHistory, setEqHistory] = useState<Movement[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Exit Form
  const [exitReason, setExitReason] = useState('')
  const [exitDescription, setExitDescription] = useState('')
  const [actionDateTime, setActionDateTime] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const getLocalDatetime = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  }

  const fetchEquipments = async () => {
    try {
      setError(null)
      if (!isRefreshing) setLoading(true)
      
      const { data, error: sbError } = await supabase
        .from('eq_equipments')
        .select('*')
        .order('name', { ascending: true })

      if (sbError) throw sbError
      setEquipments(data || [])
    } catch (err: any) {
      console.error('Error fetching equipments:', err)
      setError('Não foi possível carregar os equipamentos.')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchEquipments()

    const subscription = supabase
      .channel('eq_equipments_changes_es')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'eq_equipments' }, payload => {
        fetchEquipments()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving && !isGeneratingReport) {
        setIsEntryModalOpen(false)
        setIsExitModalOpen(false)
        setIsHistoryModalOpen(false)
        setIsReportModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSaving, isGeneratingReport])

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchEquipments()
  }

  const handleOpenEntry = (eq: Equipment) => {
    setSelectedEq(eq)
    setActionDateTime(getLocalDatetime())
    setIsEntryModalOpen(true)
  }

  const handleOpenExit = (eq: Equipment) => {
    setSelectedEq(eq)
    setExitReason('')
    setExitDescription('')
    setActionDateTime(getLocalDatetime())
    setIsExitModalOpen(true)
  }

  const handleOpenHistory = async (eq: Equipment) => {
    setSelectedEq(eq)
    setIsHistoryModalOpen(true)
    setLoadingHistory(true)
    try {
      const { data, error } = await supabase
        .from('eq_movements')
        .select('*')
        .eq('equipment_id', eq.id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      setEqHistory(data || [])
    } catch (err) {
      console.error('Error fetching history:', err)
      toast.error('Erro ao carregar histórico')
    } finally {
      setLoadingHistory(false)
    }
  }

  const getUserName = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user?.email || 'Usuário Logado'
  }

  const handleConfirmEntry = async () => {
    if (!selectedEq) return
    setIsSaving(true)
    try {
      // Check current status
      const { data: currentEq } = await supabase
        .from('eq_equipments')
        .select('location_status')
        .eq('id', selectedEq.id)
        .single()

      if (currentEq?.location_status === 'inside') {
        toast.error('Este equipamento já está dentro da obra. Atualize a página.')
        setIsEntryModalOpen(false)
        fetchEquipments()
        return
      }

      const userName = await getUserName()

      // Record movement
      const { error: moveError } = await supabase
        .from('eq_movements')
        .insert({
          equipment_id: selectedEq.id,
          movement_type: 'entry',
          created_by: userName,
          created_at: new Date(actionDateTime).toISOString()
        })

      if (moveError) throw moveError

      // Update equipment
      const { error: updateError } = await supabase
        .from('eq_equipments')
        .update({
          location_status: 'inside',
          last_exit_reason: null,
          last_exit_description: null,
          updated_at: new Date(actionDateTime).toISOString()
        })
        .eq('id', selectedEq.id)

      if (updateError) throw updateError
      
      toast.success(`${selectedEq.name} registrada DENTRO da obra.`)
      setIsEntryModalOpen(false)
      fetchEquipments()
    } catch (err) {
      console.error('Error recording entry:', err)
      toast.error('Não foi possível registrar a movimentação.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmExit = async () => {
    if (!selectedEq) return
    if (!exitReason) {
      toast.error('Selecione um motivo para a saída.')
      return
    }
    if (exitReason === 'other' && !exitDescription.trim()) {
      toast.error('A descrição é obrigatória para o motivo selecionado.')
      return
    }

    setIsSaving(true)
    try {
      // Check current status
      const { data: currentEq } = await supabase
        .from('eq_equipments')
        .select('location_status')
        .eq('id', selectedEq.id)
        .single()

      if (currentEq?.location_status === 'outside') {
        toast.error('Este equipamento já está fora da obra. Atualize a página.')
        setIsExitModalOpen(false)
        fetchEquipments()
        return
      }

      const userName = await getUserName()

      // Record movement
      const { error: moveError } = await supabase
        .from('eq_movements')
        .insert({
          equipment_id: selectedEq.id,
          movement_type: 'exit',
          exit_reason: exitReason,
          description: exitDescription.trim() || null,
          created_by: userName,
          created_at: new Date(actionDateTime).toISOString()
        })

      if (moveError) throw moveError

      // Update equipment
      const { error: updateError } = await supabase
        .from('eq_equipments')
        .update({
          location_status: 'outside',
          last_exit_reason: exitReason,
          last_exit_description: exitDescription.trim() || null,
          updated_at: new Date(actionDateTime).toISOString()
        })
        .eq('id', selectedEq.id)

      if (updateError) throw updateError
      
      const reasonLabel = EXIT_REASONS.find(r => r.value === exitReason)?.label || 'Outro'
      toast.success(`${selectedEq.name} registrada FORA da obra — ${reasonLabel}.`)
      setIsExitModalOpen(false)
      fetchEquipments()
    } catch (err) {
      console.error('Error recording exit:', err)
      toast.error('Não foi possível registrar a movimentação.')
    } finally {
      setIsSaving(false)
    }
  }

  const generatePDFReport = async () => {
    if (!reportStartDate || !reportEndDate) {
      toast.error('Selecione as datas inicial e final.')
      return
    }

    setIsGeneratingReport(true)
    try {
      const startDate = new Date(`${reportStartDate}T00:00:00`)
      const endDate = new Date(`${reportEndDate}T23:59:59`)

      const { data: movements, error } = await supabase
        .from('eq_movements')
        .select(`
          *,
          eq_equipments (
            name,
            plate_tag,
            category
          )
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true })

      if (error) throw error

      if (!movements || movements.length === 0) {
        toast.info('Nenhuma movimentação encontrada neste período.')
        return
      }

      const doc = new jsPDF()

      try {
        const img = new Image()
        img.src = '/logo-relatorio.png'
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
        })
        const imgWidth = 30
        const imgHeight = imgWidth * (img.height / img.width)
        doc.addImage(img, 'PNG', 14, 10, imgWidth, imgHeight)
        
        doc.setFontSize(16)
        doc.text('Relatório de Entradas e Saídas', 14, 10 + imgHeight + 8)
        doc.setFontSize(10)
        doc.text(`Período: ${reportStartDate.split('-').reverse().join('/')} até ${reportEndDate.split('-').reverse().join('/')}`, 14, 10 + imgHeight + 14)
        
        autoTable(doc, {
          startY: 10 + imgHeight + 20,
          head: [['Data/Hora', 'Equipamento', 'Placa/Tag', 'Tipo', 'Motivo', 'Observações']],
          body: movements.map(m => [
            new Date(m.created_at).toLocaleString('pt-BR'),
            (m.eq_equipments as any)?.name || '-',
            (m.eq_equipments as any)?.plate_tag || '-',
            m.movement_type === 'entry' ? 'ENTRADA' : 'SAÍDA',
            m.movement_type === 'exit' ? (EXIT_REASONS.find(r => r.value === m.exit_reason)?.label || m.exit_reason || '-') : '-',
            m.description || '-'
          ]),
          theme: 'striped',
          headStyles: { fillColor: [8, 102, 255] },
          styles: { fontSize: 8 },
          columnStyles: { 5: { cellWidth: 'auto' } }
        })
      } catch (e) {
        doc.setFontSize(16)
        doc.text('Relatório de Entradas e Saídas', 14, 20)
        doc.setFontSize(10)
        doc.text(`Período: ${reportStartDate.split('-').reverse().join('/')} até ${reportEndDate.split('-').reverse().join('/')}`, 14, 28)
        
        autoTable(doc, {
          startY: 35,
          head: [['Data/Hora', 'Equipamento', 'Placa/Tag', 'Tipo', 'Motivo', 'Observações']],
          body: movements.map(m => [
            new Date(m.created_at).toLocaleString('pt-BR'),
            (m.eq_equipments as any)?.name || '-',
            (m.eq_equipments as any)?.plate_tag || '-',
            m.movement_type === 'entry' ? 'ENTRADA' : 'SAÍDA',
            m.movement_type === 'exit' ? (EXIT_REASONS.find(r => r.value === m.exit_reason)?.label || m.exit_reason || '-') : '-',
            m.description || '-'
          ]),
          theme: 'striped',
          headStyles: { fillColor: [8, 102, 255] },
          styles: { fontSize: 8 },
          columnStyles: { 5: { cellWidth: 'auto' } }
        })
      }

      doc.save(`relatorio_movimentacoes_${reportStartDate}_a_${reportEndDate}.pdf`)
      toast.success('Relatório gerado com sucesso!')
      setIsReportModalOpen(false)
    } catch (err) {
      console.error('Error generating report:', err)
      toast.error('Erro ao gerar relatório.')
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const filteredEquipments = useMemo(() => {
    return equipments.filter(eq => {
      const isInside = eq.location_status !== 'outside' // Default to inside if null
      
      if (filterStatus === 'Dentro da Obra' && !isInside) return false
      if (filterStatus === 'Fora da Obra' && isInside) return false
      if (filterCategory !== 'Todas as categorias' && eq.category !== filterCategory) return false
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchName = eq.name?.toLowerCase().includes(query)
        const matchPlate = eq.plate_tag?.toLowerCase().includes(query)
        if (!matchName && !matchPlate) return false
      }
      return true
    })
  }, [equipments, filterStatus, filterCategory, searchQuery])

  // Derived Metrics
  const metrics = useMemo(() => {
    let inside = 0
    let outside = 0

    equipments.forEach(eq => {
      if (eq.location_status === 'outside') outside++
      else inside++
    })

    return {
      total: equipments.length,
      inside,
      outside
    }
  }, [equipments])

  return (
    <div className={`flex flex-col min-h-screen ${isDark ? 'bg-transparent text-white' : 'bg-[#faf9f6] text-gray-900'}`}>
      {/* Header */}
      <div className="flex-none p-4 md:p-8 pb-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-display italic tracking-tight mb-2">Controle de Entrada e Saída</h1>
            <p className="text-sm md:text-base opacity-70">Controle dos equipamentos dentro e fora da obra</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 self-start md:self-auto">
            <button 
              onClick={() => setIsReportModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600/10 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-600/20 rounded-full text-sm font-semibold hover:bg-blue-600/20 transition-colors"
            >
              <FileDown size={16} />
              Relatório
            </button>
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-full text-sm font-medium hover:bg-white dark:hover:bg-white/10 transition-colors"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 md:px-8 pb-8">
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <MetricCard title="Dentro da Obra" value={metrics.inside} total={metrics.total} color="green" />
            <MetricCard title="Fora da Obra" value={metrics.outside} total={metrics.total} color="red" />
            <MetricCard title="Total Cadastrado" value={metrics.total} color="default" />
          </div>

          {/* Controls */}
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" size={18} />
              <input 
                type="text" 
                placeholder="Buscar equipamento ou placa/tag..." 
                className={`w-full border rounded-xl pl-10 pr-4 py-3 outline-none transition-all ${isDark ? 'bg-white/5 border-white/10 focus:border-white/30 placeholder:text-white/30' : 'bg-white/45 border-black/10 focus:border-black/30 placeholder:text-black/30'}`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="relative">
              <button 
                onClick={() => { setShowCategoryMenu(!showCategoryMenu); setShowFilterMenu(false); }}
                className={`border px-5 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors w-full md:w-auto ${filterCategory !== 'Todas as categorias' ? 'bg-[#0866ff] text-white border-[#0866ff]' : isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white/45 border-black/10 hover:bg-white'}`}
              >
                <Filter size={18} /> <span>{filterCategory === 'Todas as categorias' ? 'Categoria' : filterCategory}</span> {filterCategory !== 'Todas as categorias' && <span className="w-2 h-2 rounded-full bg-white ml-1"></span>}
              </button>
              {showCategoryMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowCategoryMenu(false)} />
                  <div className={`absolute right-0 top-full mt-2 w-48 rounded-xl shadow-xl border z-50 overflow-hidden py-1 ${isDark ? 'bg-[#1a1a1b] border-white/10' : 'bg-white border-black/10'}`}>
                    {['Todas as categorias', 'Equipamento Pesado', 'Leve', 'Jardinagem', 'Canteiro'].map(f => (
                      <button 
                        key={f}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${filterCategory === f ? 'font-bold bg-black/5 dark:bg-white/5' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                        onClick={() => { setFilterCategory(f); setShowCategoryMenu(false); }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="relative">
              <button 
                onClick={() => { setShowFilterMenu(!showFilterMenu); setShowCategoryMenu(false); }}
                className={`border px-5 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors w-full md:w-auto ${filterStatus !== 'Todos' ? 'bg-[#0866ff] text-white border-[#0866ff]' : isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white/45 border-black/10 hover:bg-white'}`}
              >
                <Filter size={18} /> <span>{filterStatus === 'Todos' ? 'Status' : filterStatus}</span> {filterStatus !== 'Todos' && <span className="w-2 h-2 rounded-full bg-white ml-1"></span>}
              </button>
              {showFilterMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFilterMenu(false)} />
                  <div className={`absolute right-0 top-full mt-2 w-48 rounded-xl shadow-xl border z-50 overflow-hidden py-1 ${isDark ? 'bg-[#1a1a1b] border-white/10' : 'bg-white border-black/10'}`}>
                    {['Todos', 'Dentro da Obra', 'Fora da Obra'].map(f => (
                      <button 
                        key={f}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${filterStatus === f ? 'font-bold bg-black/5 dark:bg-white/5' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                        onClick={() => { setFilterStatus(f); setShowFilterMenu(false); }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* List/Table Area */}
          <div className={`flex flex-col rounded-2xl border overflow-hidden transition-colors ${isDark ? 'bg-black/20 border-white/10' : 'bg-white/45 border-black/10 backdrop-blur-md'}`}>
            {loading && !equipments.length ? (
              <div className="flex-1 flex flex-col gap-4 p-6">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className={`h-16 rounded-xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-black/5'}`} />
                ))}
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <AlertCircle size={48} className="text-red-500 mb-4 opacity-80" />
                <h3 className="text-xl font-display mb-2">{error}</h3>
                <button onClick={handleRefresh} className="px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full font-medium text-sm">
                  Tentar novamente
                </button>
              </div>
            ) : filteredEquipments.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-50">
                <Truck size={48} className="mb-4" />
                <h3 className="text-xl font-display">Nenhum equipamento encontrado.</h3>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className={`border-b font-semibold ${isDark ? 'bg-white/5 border-white/10 text-white/50' : 'bg-black/5 border-black/10 text-black/50'}`}>
                      <tr>
                        <th className="p-4">EQUIPAMENTO</th>
                        <th className="p-4">PLACA / TAG</th>
                        <th className="p-4">CATEGORIA</th>
                        <th className="p-4">STATUS</th>
                        <th className="p-4">ÚLTIMA MOVIMENTAÇÃO</th>
                        <th className="p-4 text-right">AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-black/5'}`}>
                      {filteredEquipments.map(eq => {
                        const isInside = eq.location_status !== 'outside'
                        return (
                          <tr key={eq.id} className={`transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}>
                            <td className="p-4 font-bold text-base">{eq.name}</td>
                            <td className="p-4 font-mono text-xs tracking-wider uppercase">{eq.plate_tag}</td>
                            <td className="p-4">{eq.category || '-'}</td>
                            <td className="p-4">
                              <div className="relative group/tooltip inline-block">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                                  isInside 
                                    ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                                    : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 cursor-pointer'
                                }`}>
                                  {isInside ? 'Operando' : (EXIT_REASONS.find(r => r.value === eq.last_exit_reason)?.label || 'Fora da Obra')}
                                </span>
                                {!isInside && eq.last_exit_description && (
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black dark:bg-white text-white dark:text-black text-xs rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-10 shadow-xl pointer-events-none">
                                    <div className="font-bold mb-1 opacity-50 text-[10px] uppercase">Observação</div>
                                    {eq.last_exit_description}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black dark:border-t-white"></div>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-4 opacity-70 text-xs flex items-center gap-1">
                              <Clock size={12} /> {new Date(eq.updated_at).toLocaleString('pt-BR')}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => handleOpenHistory(eq)}
                                  className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-white/70 hover:text-white' : 'hover:bg-black/10 text-black/70 hover:text-black'}`}
                                  title="Histórico"
                                >
                                  <History size={18} />
                                </button>
                                {isInside ? (
                                  <button 
                                    onClick={() => handleOpenExit(eq)}
                                    className="flex items-center gap-2 px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-lg font-bold text-xs hover:opacity-90 transition-opacity"
                                  >
                                    <ArrowRightFromLine size={14} /> REGISTRAR SAÍDA
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => handleOpenEntry(eq)}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700 transition-colors"
                                  >
                                    <ArrowRightToLine size={14} /> REGISTRAR ENTRADA
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden flex flex-col gap-3 p-4">
                  {filteredEquipments.map(eq => {
                    const isInside = eq.location_status !== 'outside'
                    return (
                      <div key={eq.id} className={`w-full p-4 rounded-2xl border flex flex-col gap-3 ${isDark ? 'bg-[#1a1a1b] border-white/10' : 'bg-white border-black/10 shadow-sm'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-lg">{eq.name}</h3>
                            <div className="font-mono text-xs tracking-wider uppercase opacity-70 whitespace-nowrap tabular-nums mt-1">{eq.plate_tag}</div>
                            <div className="text-xs opacity-70 mt-1">{eq.category || 'Sem categoria'}</div>
                          </div>
                          <div>
                            <button onClick={() => handleOpenHistory(eq)} className="p-2 bg-black/5 dark:bg-white/5 rounded-lg opacity-70">
                              <History size={18} />
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex items-start justify-between mt-1">
                          <div className="relative group/tooltip">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                                  isInside 
                                    ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                                    : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 cursor-pointer'
                                }`}>
                              {isInside ? 'Operando' : (EXIT_REASONS.find(r => r.value === eq.last_exit_reason)?.label || 'Fora da Obra')}
                            </span>
                            {!isInside && eq.last_exit_description && (
                              <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-black dark:bg-white text-white dark:text-black text-xs rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-10 shadow-xl pointer-events-none">
                                <div className="font-bold mb-1 opacity-50 text-[10px] uppercase">Observação</div>
                                {eq.last_exit_description}
                                <div className="absolute top-full left-4 border-4 border-transparent border-t-black dark:border-t-white"></div>
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] opacity-50 flex items-center gap-1">
                             <Clock size={10} /> {new Date(eq.updated_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>

                        <div className="mt-2 pt-3 border-t border-black/5 dark:border-white/5 flex flex-col">
                           {isInside ? (
                              <button 
                                onClick={() => handleOpenExit(eq)}
                                className="w-full flex justify-center items-center gap-2 px-4 py-3 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold text-sm hover:opacity-90 transition-opacity min-h-[44px]"
                              >
                                <ArrowRightFromLine size={16} /> REGISTRAR SAÍDA
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleOpenEntry(eq)}
                                className="w-full flex justify-center items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors min-h-[44px]"
                              >
                                <ArrowRightToLine size={16} /> REGISTRAR ENTRADA
                              </button>
                            )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Entry Modal */}
      {isEntryModalOpen && selectedEq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isSaving && setIsEntryModalOpen(false)} />
          <div className={`relative w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl max-h-[calc(100dvh-24px)] overflow-y-auto ${isDark ? 'bg-[#101014] text-white border border-white/10' : 'bg-white text-black'}`}>
            <div className="flex items-center gap-3 mb-6 text-blue-500">
              <LogIn size={28} />
              <h2 className="text-2xl font-display italic">Registrar Entrada</h2>
            </div>
            
            <div className={`p-4 rounded-2xl mb-6 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
              <div className="text-sm opacity-60 uppercase tracking-wider mb-1">Equipamento</div>
              <div className="text-xl font-bold">{selectedEq.name}</div>
              <div className="font-mono text-sm opacity-70 uppercase mt-1">{selectedEq.plate_tag}</div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex flex-col gap-2 pb-3 border-b border-black/10 dark:border-white/10">
                <label className="text-sm opacity-70 font-semibold">Data / Hora da Entrada</label>
                <input 
                  type="datetime-local" 
                  value={actionDateTime}
                  onChange={e => setActionDateTime(e.target.value)}
                  className={`w-full p-3 rounded-xl border outline-none font-semibold ${isDark ? 'bg-black/20 border-white/20' : 'bg-black/5 border-black/10'}`}
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setIsEntryModalOpen(false)}
                disabled={isSaving}
                className={`flex-1 py-3 rounded-xl font-semibold transition-colors min-h-[44px] ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmEntry}
                disabled={isSaving}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors flex justify-center items-center gap-2 min-h-[44px]"
              >
                {isSaving ? <RefreshCw size={18} className="animate-spin" /> : 'CONFIRMAR ENTRADA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit Modal */}
      {isExitModalOpen && selectedEq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isSaving && setIsExitModalOpen(false)} />
          <div className={`relative w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl max-h-[calc(100dvh-24px)] overflow-y-auto ${isDark ? 'bg-[#101014] text-white border border-white/10' : 'bg-white text-black'}`}>
            <div className="flex items-center gap-3 mb-6 text-red-500">
              <LogOut size={28} />
              <h2 className="text-2xl font-display italic">Registrar Saída</h2>
            </div>
            
            <div className={`p-4 rounded-2xl mb-6 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
              <div className="text-sm opacity-60 uppercase tracking-wider mb-1">Equipamento</div>
              <div className="text-xl font-bold">{selectedEq.name}</div>
              <div className="font-mono text-sm opacity-70 uppercase mt-1">{selectedEq.plate_tag}</div>
            </div>

            <div className="mb-6 pb-4 border-b border-black/10 dark:border-white/10">
              <label className="block text-sm font-semibold mb-2">Data / Hora da Saída</label>
              <input 
                type="datetime-local" 
                value={actionDateTime}
                onChange={e => setActionDateTime(e.target.value)}
                className={`w-full p-3 rounded-xl border outline-none font-semibold ${isDark ? 'bg-black/20 border-white/20' : 'bg-black/5 border-black/10'}`}
              />
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2">Motivo da Saída <span className="text-red-500">*</span></label>
                <div className="space-y-2">
                  {EXIT_REASONS.map(reason => (
                    <label key={reason.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${exitReason === reason.value ? (isDark ? 'bg-white/10 border-white/30' : 'bg-black/5 border-black/20') : (isDark ? 'border-white/10 hover:bg-white/5' : 'border-black/10 hover:bg-black/5')}`}>
                      <input 
                        type="radio" 
                        name="exit_reason" 
                        value={reason.value}
                        checked={exitReason === reason.value}
                        onChange={(e) => setExitReason(e.target.value)}
                        className="w-4 h-4 accent-black dark:accent-white"
                      />
                      <span className="font-medium text-sm">{reason.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {exitReason && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="block text-sm font-semibold mb-2 flex justify-between items-end">
                    <span>Descrição / Detalhes</span>
                    {exitReason === 'other' && <span className="text-[10px] text-red-500 uppercase tracking-wider font-bold">Obrigatório</span>}
                  </label>
                  <textarea 
                    value={exitDescription}
                    onChange={e => setExitDescription(e.target.value)}
                    placeholder="Descreva por que o equipamento está saindo da obra..."
                    className={`w-full p-4 rounded-xl border outline-none min-h-[100px] resize-none ${isDark ? 'bg-black/20 border-white/20 focus:border-white/50' : 'bg-white border-black/10 focus:border-black/30'}`}
                  />
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-8 pt-4 border-t border-black/10 dark:border-white/10">
              <button 
                onClick={() => setIsExitModalOpen(false)}
                disabled={isSaving}
                className={`flex-1 py-3 rounded-xl font-semibold transition-colors min-h-[44px] ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmExit}
                disabled={isSaving || !exitReason}
                className={`flex-1 py-3 rounded-xl font-bold transition-colors flex justify-center items-center gap-2 min-h-[44px] ${!exitReason ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-white/10 dark:text-white/30' : 'bg-black text-white dark:bg-white dark:text-black hover:opacity-90'}`}
              >
                {isSaving ? <RefreshCw size={18} className="animate-spin" /> : 'CONFIRMAR SAÍDA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && selectedEq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsHistoryModalOpen(false)} />
          <div className={`relative w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl max-h-[calc(100dvh-24px)] flex flex-col ${isDark ? 'bg-[#101014] text-white border border-white/10' : 'bg-white text-black'}`}>
            <div className="flex-none flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-display italic">Histórico de Movimentação</h2>
                <div className="text-sm opacity-70 mt-1 font-bold">{selectedEq.name} <span className="font-mono text-xs opacity-70 uppercase ml-2">{selectedEq.plate_tag}</span></div>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className={`p-2 rounded-full ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-black/5 hover:bg-black/10'}`}>
                <ArrowRightFromLine size={20} className="rotate-180" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-[300px]">
              {loadingHistory ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw size={24} className="animate-spin opacity-50" />
                </div>
              ) : eqHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-50 py-12">
                  <Info size={48} className="mb-4" />
                  <p>Nenhuma movimentação registrada.</p>
                </div>
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-black/10 dark:before:via-white/10 before:to-transparent">
                  {eqHistory.map((mov, idx) => {
                    const isEntry = mov.movement_type === 'entry'
                    const reasonLabel = EXIT_REASONS.find(r => r.value === mov.exit_reason)?.label || 'Outro'
                    
                    return (
                      <div key={mov.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        {/* Icon */}
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 ${
                          isDark 
                            ? (isEntry ? 'bg-[#101014] border-green-500/30 text-green-400' : 'bg-[#101014] border-red-500/30 text-red-400')
                            : (isEntry ? 'bg-white border-green-200 text-green-600' : 'bg-white border-red-200 text-red-600')
                        }`}>
                          {isEntry ? <LogIn size={16} /> : <LogOut size={16} />}
                        </div>
                        
                        {/* Card */}
                        <div className={`w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl shadow-sm border ${
                          isDark ? 'bg-white/5 border-white/10' : 'bg-white border-black/5'
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`font-bold text-sm ${isEntry ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {isEntry ? 'ENTRADA' : 'SAÍDA'}
                            </span>
                            <span className="text-[10px] opacity-60 font-medium">
                              {new Date(mov.created_at).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                          
                          {!isEntry && mov.exit_reason && (
                            <div className="text-sm font-semibold opacity-90 mt-2">{reasonLabel}</div>
                          )}
                          {mov.description && (
                            <div className="text-xs opacity-70 mt-1 italic">"{mov.description}"</div>
                          )}
                          
                          <div className="text-[10px] opacity-40 mt-3 flex items-center gap-1">
                            Usuário: {mov.created_by || 'Desconhecido'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Report Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isGeneratingReport && setIsReportModalOpen(false)} />
          <div className={`relative w-full max-w-sm rounded-3xl p-6 md:p-8 shadow-2xl ${isDark ? 'bg-[#101014] text-white border border-white/10' : 'bg-white text-black'}`}>
            <h2 className="text-2xl font-display italic mb-2">Relatório PDF</h2>
            <p className="text-sm opacity-70 mb-6">Selecione o período das movimentações para baixar o relatório completo.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold opacity-70 mb-1 flex items-center gap-2"><Calendar size={14} /> Data Inicial</label>
                <input 
                  type="date"
                  value={reportStartDate}
                  onChange={e => setReportStartDate(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border outline-none ${isDark ? 'bg-black/20 border-white/20 focus:border-white/50 [color-scheme:dark]' : 'bg-black/5 border-black/10 focus:border-black/30'}`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold opacity-70 mb-1 flex items-center gap-2"><Calendar size={14} /> Data Final</label>
                <input 
                  type="date"
                  value={reportEndDate}
                  onChange={e => setReportEndDate(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border outline-none ${isDark ? 'bg-black/20 border-white/20 focus:border-white/50 [color-scheme:dark]' : 'bg-black/5 border-black/10 focus:border-black/30'}`}
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setIsReportModalOpen(false)}
                disabled={isGeneratingReport}
                className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}
              >
                Cancelar
              </button>
              <button 
                onClick={generatePDFReport}
                disabled={isGeneratingReport}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors flex justify-center items-center gap-2"
              >
                {isGeneratingReport ? <RefreshCw size={18} className="animate-spin" /> : <><FileDown size={18} /> Baixar PDF</>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function MetricCard({ title, value, total, color = 'default' }: { title: string, value: number, total?: number, color?: 'default' | 'green' | 'red' }) {
  const { isDark } = useTheme()
  
  let colorClass = isDark ? 'bg-white/5 border-white/10' : 'bg-white border-black/5 shadow-sm'
  if (color === 'green') {
    colorClass = isDark ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-green-50 border-green-100 text-green-800 shadow-sm'
  } else if (color === 'red') {
    colorClass = isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-100 text-red-800 shadow-sm'
  }
  
  return (
    <div className={`p-5 rounded-2xl border transition-colors flex flex-col justify-between ${colorClass}`}>
      <div className="text-xs font-bold opacity-60 uppercase tracking-widest">{title}</div>
      <div className="flex items-baseline gap-2 mt-3">
        <div className="text-4xl md:text-5xl font-display font-bold">{value}</div>
        {total !== undefined && <div className="text-lg opacity-50 font-display">/ {total}</div>}
      </div>
    </div>
  )
}
