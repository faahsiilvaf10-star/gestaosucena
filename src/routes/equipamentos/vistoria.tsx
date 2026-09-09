import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../contexts/ThemeContext'
import { 
  Search, Filter, RefreshCw, AlertCircle, AlertTriangle, 
  CheckCircle, FileCheck, Save, X, Pencil, Clock, CalendarDays,
  ShieldAlert, ShieldCheck, Info
} from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/equipamentos/vistoria')({
  component: VistoriaPage,
})

interface EquipmentInspection {
  id: string
  opacity_report_expiry: string | null
  mechanical_report_expiry: string | null
  maintenance_plan_expiry: string | null
  tachograph_expiry: string | null
  updated_at: string | null
}

interface Equipment {
  id: string
  name: string
  plate_tag: string
  equipment_inspections?: EquipmentInspection | EquipmentInspection[] | null
}

// Local state for editing an equipment's inspections
interface EditState {
  opacity_report_expiry: string
  mechanical_report_expiry: string
  maintenance_plan_expiry: string
  tachograph_expiry: string
}

function getDaysRemaining(dateString: string | null | undefined): number | null {
  if (!dateString) return null
  // Create dates in local time
  const [year, month, day] = dateString.split('-').map(Number)
  if (!year || !month || !day) return null
  
  const target = new Date(year, month - 1, day)
  target.setHours(0, 0, 0, 0)
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const diffTime = target.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

function getStatusInfo(daysRemaining: number | null) {
  if (daysRemaining === null) return { status: 'Sem informação', color: 'default', text: 'Não informado', priority: 4 }
  if (daysRemaining > 10) return { status: 'Regular', color: 'green', text: 'Regular', priority: 3 }
  if (daysRemaining >= 1) return { status: 'Próximo', color: 'yellow', text: `Vence em ${daysRemaining} dia${daysRemaining > 1 ? 's' : ''}`, priority: 2 }
  if (daysRemaining === 0) return { status: 'Vence Hoje', color: 'orange', text: 'Vence hoje', priority: 1 }
  return { status: 'Vencido', color: 'red', text: `Vencido há ${Math.abs(daysRemaining)} dia${Math.abs(daysRemaining) > 1 ? 's' : ''}`, priority: 0 }
}

function formatDateBr(dateString: string | null | undefined): string {
  if (!dateString) return 'Selecionar'
  const [year, month, day] = dateString.split('-')
  if (!year || !month || !day) return 'Data Inválida'
  return `${day}/${month}/${year}`
}

function VistoriaPage() {
  const { isDark } = useTheme()
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('Todos')
  const [filterType, setFilterType] = useState<string>('Todas as vistorias')
  const [showStatusFilter, setShowStatusFilter] = useState(false)
  const [showTypeFilter, setShowTypeFilter] = useState(false)
  
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Edit states keyed by equipment id
  const [editingEqs, setEditingEqs] = useState<Record<string, EditState>>({})
  const [savingEqs, setSavingEqs] = useState<Record<string, boolean>>({})
  
  // Track if there are unsaved changes
  const hasUnsavedChanges = Object.keys(editingEqs).length > 0

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const fetchEquipments = async () => {
    try {
      setError(null)
      if (!isRefreshing) setLoading(true)
      
      const { data, error: sbError } = await supabase
        .from('eq_equipments')
        .select(`
          id, name, plate_tag,
          equipment_inspections (
            id, opacity_report_expiry, mechanical_report_expiry, maintenance_plan_expiry, tachograph_expiry, updated_at
          )
        `)
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
    
    // Subscribe to eq_equipments and equipment_inspections
    const subInspections = supabase
      .channel('equipment_inspections_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment_inspections' }, payload => {
        fetchEquipments()
      })
      .subscribe()

    return () => {
      subInspections.unsubscribe()
    }
  }, [])

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchEquipments()
  }

  const startEditing = (eq: Equipment) => {
    const ins = Array.isArray(eq.equipment_inspections) ? eq.equipment_inspections[0] : eq.equipment_inspections
    setEditingEqs(prev => ({
      ...prev,
      [eq.id]: {
        opacity_report_expiry: ins?.opacity_report_expiry || '',
        mechanical_report_expiry: ins?.mechanical_report_expiry || '',
        maintenance_plan_expiry: ins?.maintenance_plan_expiry || '',
        tachograph_expiry: ins?.tachograph_expiry || ''
      }
    }))
  }

  const cancelEditing = (eqId: string) => {
    setEditingEqs(prev => {
      const copy = { ...prev }
      delete copy[eqId]
      return copy
    })
  }

  const updateEditState = (eqId: string, field: keyof EditState, value: string) => {
    setEditingEqs(prev => ({
      ...prev,
      [eqId]: {
        ...prev[eqId],
        [field]: value
      }
    }))
  }

  const handleSave = async (eq: Equipment) => {
    const editData = editingEqs[eq.id]
    if (!editData) return

    setSavingEqs(prev => ({ ...prev, [eq.id]: true }))
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const userName = user?.email || 'Usuário Logado'

      const { error } = await supabase
        .from('equipment_inspections')
        .upsert({
          equipment_id: eq.id,
          opacity_report_expiry: editData.opacity_report_expiry || null,
          mechanical_report_expiry: editData.mechanical_report_expiry || null,
          maintenance_plan_expiry: editData.maintenance_plan_expiry || null,
          tachograph_expiry: editData.tachograph_expiry || null,
          updated_by: userName,
          updated_at: new Date().toISOString()
        }, { onConflict: 'equipment_id' })

      if (error) throw error

      toast.success(`Datas do equipamento ${eq.name} atualizadas com sucesso.`)
      cancelEditing(eq.id)
      fetchEquipments() // Refetch to get updated IDs if it was an insert
    } catch (err) {
      console.error('Error saving inspections:', err)
      toast.error(`Não foi possível salvar as alterações de ${eq.name}.`)
    } finally {
      setSavingEqs(prev => ({ ...prev, [eq.id]: false }))
    }
  }

  const filteredEquipments = useMemo(() => {
    return equipments.filter(eq => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchName = eq.name?.toLowerCase().includes(query)
        const matchPlate = eq.plate_tag?.toLowerCase().includes(query)
        if (!matchName && !matchPlate) return false
      }
      
      const ins = Array.isArray(eq.equipment_inspections) ? eq.equipment_inspections[0] : eq.equipment_inspections
      const docs = [
        { type: 'Laudo Opacidade', expiry: ins?.opacity_report_expiry },
        { type: 'Laudo Mecânico', expiry: ins?.mechanical_report_expiry },
        { type: 'Plano Manutenção', expiry: ins?.maintenance_plan_expiry },
        { type: 'Tacógrafo', expiry: ins?.tachograph_expiry }
      ]
      
      // Type filter
      let relevantDocs = docs
      if (filterType !== 'Todas as vistorias') {
        relevantDocs = docs.filter(d => d.type === filterType)
      }
      
      // Status filter (at least one document must match the status)
      if (filterStatus !== 'Todos') {
        let hasMatch = false
        for (const doc of relevantDocs) {
          const days = getDaysRemaining(doc.expiry)
          const info = getStatusInfo(days)
          
          if (filterStatus === 'Sem informação' && info.status === 'Sem informação') hasMatch = true
          if (filterStatus === 'Regular' && info.status === 'Regular') hasMatch = true
          if (filterStatus === 'Próximo do vencimento' && (info.status === 'Próximo' || info.status === 'Vence Hoje')) hasMatch = true
          if (filterStatus === 'Vencido' && info.status === 'Vencido') hasMatch = true
        }
        if (!hasMatch) return false
      }
      
      return true
    })
  }, [equipments, filterStatus, filterType, searchQuery])

  // Overall metrics
  const metrics = useMemo(() => {
    let regular = 0
    let toExpire = 0
    let expired = 0
    let totalDocs = 0

    equipments.forEach(eq => {
      const ins = Array.isArray(eq.equipment_inspections) ? eq.equipment_inspections[0] : eq.equipment_inspections
      const dates = [
        ins?.opacity_report_expiry,
        ins?.mechanical_report_expiry,
        ins?.maintenance_plan_expiry,
        ins?.tachograph_expiry
      ]
      
      dates.forEach(d => {
        if (!d) return
        totalDocs++
        const days = getDaysRemaining(d)
        if (days !== null) {
          if (days > 10) regular++
          else if (days >= 0) toExpire++
          else expired++
        }
      })
    })

    return { totalEqs: equipments.length, regular, toExpire, expired, totalDocs }
  }, [equipments])

  return (
    <div className={`flex flex-col min-h-screen ${isDark ? 'bg-transparent text-white' : 'bg-[#faf9f6] text-gray-900'}`}>
      
      {/* Header */}
      <div className="flex-none p-4 md:p-8 pb-4 relative z-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-display italic tracking-tight mb-2">Controle de Vistorias</h1>
            <p className="text-sm md:text-base opacity-70">Documentação, inspeções e vencimentos da frota</p>
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            {hasUnsavedChanges && (
              <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 rounded-full text-sm font-semibold animate-pulse">
                <AlertTriangle size={16} />
                Alterações não salvas
              </div>
            )}
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-full text-sm font-medium hover:bg-white dark:hover:bg-white/10 transition-colors"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 md:px-8 pb-12">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
            <MetricCard title="Equipamentos" value={metrics.totalEqs} color="default" />
            <MetricCard title="Regulares" value={metrics.regular} total={metrics.totalDocs} color="green" />
            <MetricCard title="A Vencer (≤ 10 dias)" value={metrics.toExpire} total={metrics.totalDocs} color="yellow" />
            <MetricCard title="Vencidos" value={metrics.expired} total={metrics.totalDocs} color="red" />
          </div>

          {/* Controls */}
          <div className="flex flex-col md:flex-row gap-3 relative z-30">
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
                onClick={() => { setShowTypeFilter(!showTypeFilter); setShowStatusFilter(false); }}
                className={`border px-5 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors w-full md:w-auto min-w-[200px] ${filterType !== 'Todas as vistorias' ? 'bg-[#0866ff] text-white border-[#0866ff]' : isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white/45 border-black/10 hover:bg-white'}`}
              >
                <FileCheck size={18} /> <span className="truncate">{filterType}</span> {filterType !== 'Todas as vistorias' && <span className="w-2 h-2 rounded-full bg-white ml-1 shrink-0"></span>}
              </button>
              {showTypeFilter && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowTypeFilter(false)} />
                  <div className={`absolute right-0 top-full mt-2 w-56 rounded-xl shadow-xl border z-50 overflow-hidden py-1 ${isDark ? 'bg-[#1a1a1b] border-white/10' : 'bg-white border-black/10'}`}>
                    {['Todas as vistorias', 'Laudo Opacidade', 'Laudo Mecânico', 'Plano Manutenção', 'Tacógrafo'].map(f => (
                      <button 
                        key={f}
                        className={`w-full text-left px-4 py-3 text-sm transition-colors ${filterType === f ? 'font-bold bg-black/5 dark:bg-white/5' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                        onClick={() => { setFilterType(f); setShowTypeFilter(false); }}
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
                onClick={() => { setShowStatusFilter(!showStatusFilter); setShowTypeFilter(false); }}
                className={`border px-5 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors w-full md:w-auto min-w-[220px] ${filterStatus !== 'Todos' ? 'bg-[#0866ff] text-white border-[#0866ff]' : isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white/45 border-black/10 hover:bg-white'}`}
              >
                <Filter size={18} /> <span>{filterStatus === 'Todos' ? 'Status' : filterStatus}</span> {filterStatus !== 'Todos' && <span className="w-2 h-2 rounded-full bg-white ml-1 shrink-0"></span>}
              </button>
              {showStatusFilter && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowStatusFilter(false)} />
                  <div className={`absolute right-0 top-full mt-2 w-56 rounded-xl shadow-xl border z-50 overflow-hidden py-1 ${isDark ? 'bg-[#1a1a1b] border-white/10' : 'bg-white border-black/10'}`}>
                    {['Todos', 'Regular', 'Próximo do vencimento', 'Vencido', 'Sem informação'].map(f => (
                      <button 
                        key={f}
                        className={`w-full text-left px-4 py-3 text-sm transition-colors ${filterStatus === f ? 'font-bold bg-black/5 dark:bg-white/5' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                        onClick={() => { setFilterStatus(f); setShowStatusFilter(false); }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Cards Grid */}
          <div className="relative z-10">
            {loading && !equipments.length ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[1,2,3,4].map(i => (
                  <div key={i} className={`h-80 rounded-2xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-black/5'}`} />
                ))}
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded-2xl border bg-white/50 dark:bg-white/5 backdrop-blur-md">
                <AlertCircle size={48} className="text-red-500 mb-4 opacity-80" />
                <h3 className="text-xl font-display mb-2">{error}</h3>
                <button onClick={handleRefresh} className="px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full font-medium text-sm">
                  Tentar novamente
                </button>
              </div>
            ) : filteredEquipments.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded-2xl border bg-white/50 dark:bg-white/5 backdrop-blur-md opacity-50">
                <ShieldCheck size={48} className="mb-4" />
                <h3 className="text-xl font-display">Nenhum equipamento encontrado com estes filtros.</h3>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredEquipments.map(eq => {
                  const ins = Array.isArray(eq.equipment_inspections) ? eq.equipment_inspections[0] : eq.equipment_inspections
                  const isEditing = !!editingEqs[eq.id]
                  const isSaving = savingEqs[eq.id]
                  const editData = editingEqs[eq.id]

                  const docsCount = [
                    ins?.opacity_report_expiry, 
                    ins?.mechanical_report_expiry, 
                    ins?.maintenance_plan_expiry, 
                    ins?.tachograph_expiry
                  ].filter(Boolean).length

                  return (
                    <div key={eq.id} className={`flex flex-col rounded-2xl border shadow-sm transition-colors overflow-hidden ${isDark ? 'bg-[#121214] border-white/10' : 'bg-white border-black/10'}`}>
                      
                      {/* Card Header */}
                      <div className="p-5 flex justify-between items-start border-b border-black/5 dark:border-white/5 relative">
                        {isEditing && (
                          <div className="absolute top-0 right-0 w-full h-1 bg-yellow-400"></div>
                        )}
                        <div>
                          <h3 className="font-bold text-2xl tracking-tight">{eq.name}</h3>
                          <div className="font-mono text-xs tracking-wider uppercase opacity-70 mt-1">{eq.plate_tag}</div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span className={`text-xs font-bold px-2 py-1 rounded-md ${isDark ? 'bg-white/10' : 'bg-black/5'}`}>
                            {docsCount} {docsCount === 1 ? 'documento' : 'documentos'}
                          </span>
                        </div>
                      </div>

                      {/* Documents List */}
                      <div className="p-5 space-y-4">
                        <DocRow 
                          label="Laudo Opacidade" 
                          currentDate={ins?.opacity_report_expiry} 
                          editValue={editData?.opacity_report_expiry}
                          isEditing={isEditing}
                          onChange={(val) => updateEditState(eq.id, 'opacity_report_expiry', val)}
                          isDark={isDark}
                        />
                        <div className="h-px bg-black/5 dark:bg-white/5 w-full"></div>
                        
                        <DocRow 
                          label="Laudo Mecânico" 
                          currentDate={ins?.mechanical_report_expiry} 
                          editValue={editData?.mechanical_report_expiry}
                          isEditing={isEditing}
                          onChange={(val) => updateEditState(eq.id, 'mechanical_report_expiry', val)}
                          isDark={isDark}
                        />
                        <div className="h-px bg-black/5 dark:bg-white/5 w-full"></div>
                        
                        <DocRow 
                          label="Plano Manutenção" 
                          currentDate={ins?.maintenance_plan_expiry} 
                          editValue={editData?.maintenance_plan_expiry}
                          isEditing={isEditing}
                          onChange={(val) => updateEditState(eq.id, 'maintenance_plan_expiry', val)}
                          isDark={isDark}
                        />
                        <div className="h-px bg-black/5 dark:bg-white/5 w-full"></div>
                        
                        <DocRow 
                          label="Tacógrafo" 
                          currentDate={ins?.tachograph_expiry} 
                          editValue={editData?.tachograph_expiry}
                          isEditing={isEditing}
                          onChange={(val) => updateEditState(eq.id, 'tachograph_expiry', val)}
                          isDark={isDark}
                        />
                      </div>

                      {/* Actions */}
                      <div className={`p-4 mt-auto border-t flex justify-end gap-2 ${isDark ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'}`}>
                        {isEditing ? (
                          <>
                            <button 
                              onClick={() => cancelEditing(eq.id)}
                              disabled={isSaving}
                              className="px-4 py-2 rounded-lg text-sm font-semibold hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                            >
                              Cancelar
                            </button>
                            <button 
                              onClick={() => handleSave(eq)}
                              disabled={isSaving}
                              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
                            >
                              {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                              Salvar Alterações
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => startEditing(eq)}
                            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-colors ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-black/10 hover:bg-black/15'}`}
                          >
                            <Pencil size={16} />
                            Editar
                          </button>
                        )}
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
  )
}

function DocRow({ 
  label, currentDate, editValue, isEditing, onChange, isDark 
}: { 
  label: string, currentDate: string | null | undefined, editValue: string | undefined, 
  isEditing: boolean, onChange: (v: string) => void, isDark: boolean 
}) {
  const daysRemaining = getDaysRemaining(currentDate)
  const info = getStatusInfo(daysRemaining)
  
  let statusColorClass = 'text-gray-500'
  let badgeClass = 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white/70'
  
  if (info.color === 'green') {
    statusColorClass = 'text-green-600 dark:text-green-400'
    badgeClass = isDark ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-green-50 text-green-700 border border-green-200'
  } else if (info.color === 'yellow') {
    statusColorClass = 'text-yellow-600 dark:text-yellow-400'
    badgeClass = isDark ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
  } else if (info.color === 'orange') {
    statusColorClass = 'text-orange-600 dark:text-orange-400'
    badgeClass = isDark ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-orange-50 text-orange-700 border border-orange-200'
  } else if (info.color === 'red') {
    statusColorClass = 'text-red-600 dark:text-red-400'
    badgeClass = isDark ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-red-50 text-red-700 border border-red-200'
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs uppercase tracking-wider font-semibold opacity-70 mb-1">{label}</div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-h-[32px]">
        {isEditing ? (
          <div className="w-full">
            <input 
              type="date"
              value={editValue || ''}
              onChange={(e) => onChange(e.target.value)}
              className={`w-full p-2.5 rounded-lg border outline-none text-sm font-semibold ${isDark ? 'bg-black/40 border-white/20 focus:border-white/50 color-scheme-dark' : 'bg-white border-black/20 focus:border-black/50'}`}
              style={isDark ? { colorScheme: 'dark' } : {}}
            />
          </div>
        ) : (
          <>
            <div className={`font-mono font-medium ${!currentDate ? 'opacity-50 italic text-sm' : 'text-base'}`}>
              {formatDateBr(currentDate)}
            </div>
            {currentDate && (
              <div className={`text-[10px] uppercase font-bold px-2 py-1 rounded whitespace-nowrap flex items-center gap-1.5 w-fit ${badgeClass}`}>
                {info.priority === 0 && <AlertTriangle size={12} />}
                {info.priority === 1 && <Clock size={12} />}
                {info.priority === 2 && <ShieldAlert size={12} />}
                {info.priority === 3 && <CheckCircle size={12} />}
                {info.text}
              </div>
            )}
            {!currentDate && (
               <div className={`text-[10px] uppercase font-bold px-2 py-1 rounded whitespace-nowrap flex items-center gap-1.5 w-fit ${badgeClass}`}>
                  Sem informação
               </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function MetricCard({ title, value, total, color = 'default' }: { title: string, value: number, total?: number, color?: 'default' | 'green' | 'yellow' | 'red' }) {
  const { isDark } = useTheme()
  
  let colorClass = isDark ? 'bg-white/5 border-white/10' : 'bg-white border-black/5 shadow-sm'
  if (color === 'green') {
    colorClass = isDark ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-green-50 border-green-100 text-green-800 shadow-sm'
  } else if (color === 'yellow') {
    colorClass = isDark ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' : 'bg-yellow-50 border-yellow-100 text-yellow-800 shadow-sm'
  } else if (color === 'red') {
    colorClass = isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-100 text-red-800 shadow-sm'
  }
  
  return (
    <div className={`p-4 md:p-5 rounded-2xl border transition-colors flex flex-col justify-between ${colorClass}`}>
      <div className="text-[10px] md:text-xs font-bold opacity-60 uppercase tracking-widest leading-tight">{title}</div>
      <div className="flex items-baseline gap-2 mt-3">
        <div className="text-3xl md:text-5xl font-display font-bold tabular-nums">{value}</div>
        {total !== undefined && <div className="text-sm md:text-lg opacity-50 font-display">/ {total}</div>}
      </div>
    </div>
  )
}
