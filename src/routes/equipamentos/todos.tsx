import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../contexts/ThemeContext'
import { 
  Search, Filter, Eye, Pencil, RefreshCw, AlertCircle, CheckCircle2,
  Settings, Car, Truck, Plus, Check
} from 'lucide-react'

export const Route = createFileRoute('/equipamentos/todos')({
  component: TodosEquipamentosPage,
})

interface Equipment {
  id: string
  name: string
  plate_tag: string
  type: string
  status: string
  created_at: string
  updated_at: string
}

function TodosEquipamentosPage() {
  const { isDark } = useTheme()
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('Todos')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Modals
  const [selectedEq, setSelectedEq] = useState<Equipment | null>(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  
  // Edit Form
  const [editStatus, setEditStatus] = useState('')
  const [editName, setEditName] = useState('')
  const [editPlate, setEditPlate] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Add Form
  const [newName, setNewName] = useState('')
  const [newPlate, setNewPlate] = useState('')
  const [newType, setNewType] = useState('Caminhão Pipa')

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
      .channel('eq_equipments_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eq_equipments' }, payload => {
        fetchEquipments() // Refetch to keep simple and consistent
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchEquipments()
  }

  const handleOpenView = (eq: Equipment) => {
    setSelectedEq(eq)
    setIsViewModalOpen(true)
  }

  const handleOpenEdit = (eq: Equipment) => {
    setSelectedEq(eq)
    setEditStatus(eq.status || 'Sem status')
    setEditName(eq.name || '')
    setEditPlate(eq.plate_tag || '')
    setIsEditModalOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedEq) return
    setIsSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('eq_equipments')
        .update({
          name: editName,
          plate_tag: editPlate,
          status: editStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedEq.id)

      if (updateError) throw updateError
      
      setIsEditModalOpen(false)
      fetchEquipments()
    } catch (err) {
      console.error('Error updating equipment:', err)
      alert('Erro ao atualizar equipamento.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveNew = async () => {
    if (!newName.trim() || !newPlate.trim()) {
      alert('Nome e Placa / Tag são obrigatórios.')
      return
    }
    setIsSaving(true)
    try {
      const { error: insertError } = await supabase
        .from('eq_equipments')
        .insert({
          name: newName.trim(),
          plate_tag: newPlate.trim(),
          type: newType.trim() || 'Caminhão Pipa',
          status: 'Sem status'
        })

      if (insertError) throw insertError
      
      setIsAddModalOpen(false)
      setNewName('')
      setNewPlate('')
      setNewType('Caminhão Pipa')
      fetchEquipments()
    } catch (err: any) {
      console.error('Error adding equipment:', err)
      alert('Erro ao cadastrar equipamento. Talvez a placa já exista?')
    } finally {
      setIsSaving(false)
    }
  }

  const filteredEquipments = useMemo(() => {
    return equipments.filter(eq => {
      if (filterStatus !== 'Todos' && eq.status !== filterStatus) {
        return false
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchName = eq.name?.toLowerCase().includes(query)
        const matchPlate = eq.plate_tag?.toLowerCase().includes(query)
        if (!matchName && !matchPlate) return false
      }
      return true
    })
  }, [equipments, filterStatus, searchQuery])

  // Derived Metrics
  const metrics = useMemo(() => {
    let operation = 0
    let maintenance = 0
    let stopped = 0

    equipments.forEach(eq => {
      if (eq.status === 'Em operação') operation++
      else if (eq.status === 'Manutenção') maintenance++
      else if (eq.status === 'Parado') stopped++
    })

    return {
      total: equipments.length,
      operation,
      maintenance,
      stopped
    }
  }, [equipments])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Em operação':
        return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400"><CheckCircle2 size={12} /> {status}</span>
      case 'Manutenção':
        return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400"><Settings size={12} /> {status}</span>
      case 'Parado':
        return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"><AlertCircle size={12} /> {status}</span>
      default:
        return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300">{status || 'Sem status'}</span>
    }
  }

  return (
    <div className={`flex flex-col min-h-screen ${isDark ? 'bg-transparent text-white' : 'bg-[#faf9f6] text-gray-900'}`}>
      {/* Header */}
      <div className="flex-none p-4 md:p-8 pb-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-display italic tracking-tight mb-2">Todos Equipamentos</h1>
            <p className="text-sm md:text-base opacity-70">Gerenciamento e acompanhamento da frota</p>
            <p className="text-xs opacity-50 mt-1">{equipments.length} equipamentos cadastrados</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 self-start md:self-auto w-full md:w-auto mt-4 md:mt-0">
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex justify-center items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus size={16} />
              Novo Equipamento
            </button>
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="flex justify-center items-center gap-2 px-4 py-2.5 bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-full text-sm font-medium hover:bg-white dark:hover:bg-white/10 transition-colors"
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <MetricCard title="Total" value={metrics.total} />
            <MetricCard title="Em Operação" value={metrics.operation} />
            <MetricCard title="Manutenção" value={metrics.maintenance} />
            <MetricCard title="Parados" value={metrics.stopped} />
          </div>

          {/* Controls */}
          <div className="flex gap-2">
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
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className={`border px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors ${filterStatus !== 'Todos' ? 'bg-[#0866ff] text-white border-[#0866ff]' : isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white/45 border-black/10 hover:bg-white'}`}
              >
                <Filter size={18} /> <span className="hidden md:inline">Filtros</span> {filterStatus !== 'Todos' && <span className="w-2 h-2 rounded-full bg-white ml-1"></span>}
              </button>
              {showFilterMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFilterMenu(false)} />
                  <div className={`absolute right-0 top-full mt-2 w-48 rounded-xl shadow-xl border z-50 overflow-hidden py-1 ${isDark ? 'bg-[#1a1a1b] border-white/10' : 'bg-white border-black/10'}`}>
                    {['Todos', 'Em operação', 'Manutenção', 'Parado', 'Sem status'].map(f => (
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
                        <th className="p-4">STATUS</th>
                        <th className="p-4">ÚLTIMA ATUALIZAÇÃO</th>
                        <th className="p-4 text-right">AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-black/5'}`}>
                      {filteredEquipments.map(eq => (
                        <tr key={eq.id} className={`transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}>
                          <td className="p-4 font-medium">{eq.name}</td>
                          <td className="p-4 font-mono text-xs tracking-wider uppercase">{eq.plate_tag}</td>
                          <td className="p-4">{getStatusBadge(eq.status)}</td>
                          <td className="p-4 opacity-60 text-xs">{new Date(eq.updated_at).toLocaleString('pt-BR')}</td>
                          <td className="p-4 text-right flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleOpenView(eq)}
                              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-white/70 hover:text-white' : 'hover:bg-black/10 text-black/70 hover:text-black'}`}
                            >
                              <Eye size={18} />
                            </button>
                            <button 
                              onClick={() => handleOpenEdit(eq)}
                              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-white/70 hover:text-white' : 'hover:bg-black/10 text-black/70 hover:text-black'}`}
                            >
                              <Pencil size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden flex flex-col gap-3 p-4">
                  {filteredEquipments.map(eq => (
                    <div key={eq.id} className={`w-full p-4 rounded-2xl border flex flex-col gap-3 ${isDark ? 'bg-[#1a1a1b] border-white/10' : 'bg-white border-black/10 shadow-sm'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-lg">{eq.name}</h3>
                          <div className="font-mono text-xs tracking-wider uppercase opacity-70 whitespace-nowrap tabular-nums mt-1">{eq.plate_tag}</div>
                        </div>
                        <div>{getStatusBadge(eq.status)}</div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-2 pt-3 border-t border-black/5 dark:border-white/5">
                        <div className="text-[10px] opacity-50">
                          {new Date(eq.updated_at).toLocaleString('pt-BR')}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleOpenView(eq)} className={`p-2 rounded-lg bg-black/5 dark:bg-white/5`}>
                            <Eye size={16} />
                          </button>
                          <button onClick={() => handleOpenEdit(eq)} className={`p-2 rounded-lg bg-black/5 dark:bg-white/5`}>
                            <Pencil size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* View Modal */}
      {isViewModalOpen && selectedEq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsViewModalOpen(false)} />
          <div className={`relative w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl ${isDark ? 'bg-[#101014] text-white border border-white/10' : 'bg-white text-black'}`}>
            <h2 className="text-3xl font-display italic mb-6">Detalhes</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest opacity-50 mb-2">Identificação</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-3 rounded-xl ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                    <div className="text-[10px] opacity-50 uppercase mb-1">Equipamento</div>
                    <div className="font-semibold">{selectedEq.name}</div>
                  </div>
                  <div className={`p-3 rounded-xl ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                    <div className="text-[10px] opacity-50 uppercase mb-1">Placa / Tag</div>
                    <div className="font-mono text-sm whitespace-nowrap tabular-nums">{selectedEq.plate_tag}</div>
                  </div>
                  <div className={`col-span-2 p-3 rounded-xl ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                    <div className="text-[10px] opacity-50 uppercase mb-1">Tipo</div>
                    <div className="font-semibold">{selectedEq.type || 'N/A'}</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest opacity-50 mb-2">Situação</h3>
                <div className={`p-4 rounded-xl space-y-3 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm opacity-70">Status Atual</span>
                    {getStatusBadge(selectedEq.status)}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm opacity-70">Última Atualização</span>
                    <span className="text-sm font-medium">{new Date(selectedEq.updated_at).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              </div>

            </div>
            
            <button 
              onClick={() => setIsViewModalOpen(false)}
              className="mt-8 w-full py-3 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold hover:opacity-90 transition-opacity"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && selectedEq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} />
          <div className={`relative w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl ${isDark ? 'bg-[#101014] text-white border border-white/10' : 'bg-white text-black'}`}>
            <h2 className="text-3xl font-display italic mb-6">Editar Equipamento</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold opacity-70 mb-1">Equipamento</label>
                <input 
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border outline-none ${isDark ? 'bg-black/20 border-white/20 focus:border-white/50' : 'bg-black/5 border-black/10 focus:border-black/30'}`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold opacity-70 mb-1">Placa / Tag</label>
                <input 
                  type="text"
                  value={editPlate}
                  onChange={e => setEditPlate(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border outline-none font-mono uppercase ${isDark ? 'bg-black/20 border-white/20 focus:border-white/50' : 'bg-black/5 border-black/10 focus:border-black/30'}`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold opacity-70 mb-1">Status</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border outline-none appearance-none ${isDark ? 'bg-black/20 border-white/20 focus:border-white/50' : 'bg-black/5 border-black/10 focus:border-black/30'}`}
                >
                  <option value="Sem status">Sem status</option>
                  <option value="Em operação">Em operação</option>
                  <option value="Manutenção">Manutenção</option>
                  <option value="Parado">Parado</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors flex justify-center items-center gap-2"
              >
                {isSaving ? <RefreshCw size={18} className="animate-spin" /> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
          <div className={`relative w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl ${isDark ? 'bg-[#101014] text-white border border-white/10' : 'bg-white text-black'}`}>
            <h2 className="text-3xl font-display italic mb-6">Novo Equipamento</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold opacity-70 mb-1">Equipamento (Ex: PIPA 09) <span className="text-red-500">*</span></label>
                <input 
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Nome do equipamento"
                  className={`w-full px-4 py-3 rounded-xl border outline-none ${isDark ? 'bg-black/20 border-white/20 focus:border-white/50' : 'bg-black/5 border-black/10 focus:border-black/30'}`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold opacity-70 mb-1">Placa / Tag <span className="text-red-500">*</span></label>
                <input 
                  type="text"
                  value={newPlate}
                  onChange={e => setNewPlate(e.target.value)}
                  placeholder="ABC1D23"
                  className={`w-full px-4 py-3 rounded-xl border outline-none font-mono uppercase ${isDark ? 'bg-black/20 border-white/20 focus:border-white/50' : 'bg-black/5 border-black/10 focus:border-black/30'}`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold opacity-70 mb-1">Tipo / Categoria</label>
                <input 
                  type="text"
                  value={newType}
                  onChange={e => setNewType(e.target.value)}
                  placeholder="Caminhão Pipa"
                  className={`w-full px-4 py-3 rounded-xl border outline-none ${isDark ? 'bg-black/20 border-white/20 focus:border-white/50' : 'bg-black/5 border-black/10 focus:border-black/30'}`}
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveNew}
                disabled={isSaving}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors flex justify-center items-center gap-2"
              >
                {isSaving ? <RefreshCw size={18} className="animate-spin" /> : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function MetricCard({ title, value }: { title: string, value: number }) {
  const { isDark } = useTheme()
  return (
    <div className={`p-4 md:p-6 rounded-2xl border transition-colors ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-black/5 shadow-sm'}`}>
      <div className="text-xs font-bold opacity-50 uppercase tracking-widest">{title}</div>
      <div className="text-4xl md:text-5xl font-display mt-2">{value}</div>
    </div>
  )
}
