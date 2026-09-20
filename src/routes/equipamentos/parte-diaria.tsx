import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getEquipmentActivities, setEquipmentActivities, EquipmentActivity } from '@/lib/settings'
import {
  MapPin, Calendar as CalendarIcon, RefreshCw, Maximize,
  Truck, Search, Filter, AlertTriangle, Clock, CheckCircle2,
  Undo2, MoreVertical, X, Image as ImageIcon, ChevronDown, ChevronUp, Download, Trash2, Edit,
  Waves, Droplet, Sprout, Fuel, CloudRain, Car, Plus, Save, Pencil
} from 'lucide-react'

export const ICON_MAP: Record<string, any> = {
  Waves, Droplet, Sprout, Fuel, CloudRain, Car, MapPin, Truck
}

export const ICON_NAMES_PT: Record<string, string> = {
  Waves: 'Ondas',
  Droplet: 'Gota',
  Sprout: 'Muda / Planta',
  Fuel: 'Combustível',
  CloudRain: 'Chuva',
  Car: 'Carro',
  MapPin: 'Localização',
  Truck: 'Caminhão'
}
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import * as htmlToImage from 'html-to-image'
import { jsPDF } from 'jspdf'
import { format, subDays, addDays, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DRIVERS } from '@/components/app-motorista/LoginStep'
import ParteDiariaReport from '@/components/app-motorista/ParteDiariaReport'

export const Route = createFileRoute('/equipamentos/parte-diaria')({
  component: ParteDiariaPage,
})

const translateStatus = (status: string | null | undefined): string => {
  if (!status) return 'Sem status'
  const rawStatusLower = status.toLowerCase().trim()
  if (rawStatusLower === 'waiting') return 'Aguardando'
  if (rawStatusLower === 'operating') return 'Em operação'
  if (rawStatusLower === 'paused') return 'Pausa / Almoço'
  if (rawStatusLower === 'raining') return 'Chuva'
  if (rawStatusLower === 'fueling') return 'Abastecendo'
  return status
}

function ParteDiariaPage() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshCountdown, setRefreshCountdown] = useState(15)
  const [groupMode, setGroupMode] = useState<'motorista' | 'veiculo'>('veiculo')
  const [searchQuery, setSearchQuery] = useState('')

  // Data states
  const [emTrabalhoCount, setEmTrabalhoCount] = useState(0)
  const [turnosFinalizadosCount, setTurnosFinalizadosCount] = useState(0)
  const [anomaliesCount, setAnomaliesCount] = useState(0)
  const [manutencaoCount, setManutencaoCount] = useState(0)
  const [totalPesadosCount, setTotalPesadosCount] = useState(0)
  const [activeVehicles, setActiveVehicles] = useState<any[]>([])
  const [vehicleHistories, setVehicleHistories] = useState<Record<string, any[]>>({})
  const [vehicleDispatches, setVehicleDispatches] = useState<Record<string, any>>({})
  const [isActivitiesModalOpen, setIsActivitiesModalOpen] = useState(false)
  const [activities, setActivities] = useState<EquipmentActivity[]>([])
  const [equipmentTypes, setEquipmentTypes] = useState<string[]>([])
  const [isEditingActivity, setIsEditingActivity] = useState<boolean>(false)
  const [editingActivity, setEditingActivity] = useState<Partial<EquipmentActivity>>({})

  useEffect(() => {
    const loadActivitiesAndTypes = async () => {
      const data = await getEquipmentActivities()
      setActivities(data)
      const { data: types } = await supabase.from('eq_equipments').select('type')
      if (types) {
        const distinct = Array.from(new Set(types.map(t => t.type).filter(Boolean))) as string[]
        setEquipmentTypes(distinct.sort())
      }
    }
    loadActivitiesAndTypes()
  }, [])

  const handleSaveActivity = async () => {
    if (!editingActivity.name || !editingActivity.icon || !editingActivity.color) return;
    
    let newList = [...activities]
    if (editingActivity.id) {
      newList = newList.map(a => a.id === editingActivity.id ? editingActivity as EquipmentActivity : a)
    } else {
      newList.push({
        ...editingActivity,
        id: crypto.randomUUID(),
        categories: editingActivity.categories || []
      } as EquipmentActivity)
    }
    
    const { success } = await setEquipmentActivities(newList)
    if (success) {
      setActivities(newList)
      setIsEditingActivity(false)
      setEditingActivity({})
    } else {
      alert("Erro ao salvar atividade")
    }
  }

  const handleDeleteActivity = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta atividade?")) return;
    const newList = activities.filter(a => a.id !== id)
    const { success } = await setEquipmentActivities(newList)
    if (success) {
      setActivities(newList)
    }
  }

  // Fullscreen handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`)
      })
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
        setIsFullscreen(false)
      }
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const fetchDashboardData = async () => {
    try {
      // 1. Busca todos os Equipamentos Pesados
      const { data: pesados, error: pesadosError } = await supabase
        .from('eq_equipments').select('id, name, plate_tag, category, type, location_status, environment, updated_at, last_exit_reason, last_exit_description, status').eq('environment', typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena')
        .eq('category', 'Equipamento Pesado')
        .order('name', { ascending: true })

      if (pesadosError) throw pesadosError
      
      const total = pesados?.length || 0
      // Mostrar todos os equipamentos pesados na lista, mantendo o status apontado pelo motorista
      const operandoList = pesados || []
      
      setTotalPesadosCount(total)
      setActiveVehicles(operandoList)

      // 2. Busca dispatches (do dia OU em atividade - para cobrir turnos da noite)
      const todayStart = startOfDay(new Date()).toISOString()
      const { data: dispatches } = await supabase
        .from('eq_driver_dispatch')
        .select('*')
        .or(`shift_start_time.gte.${todayStart},status.eq.Em atividade`)
        .order('shift_start_time', { ascending: true })

      const dMap: Record<string, any> = {}
      let countTurnos = 0
      const activeDispatchIds: string[] = []
      
      if (dispatches) {
        dispatches.forEach(d => {
          // Guarda sempre o último dispatch relevante para o equipamento
          dMap[d.equipment_id] = d
          activeDispatchIds.push(d.id)
        })
      }
      
      setVehicleDispatches(dMap)

      // 3. Busca histórico do dia OU dos dispatches ativos (em 2 queries para evitar problema de formato UUID no PostgREST)
      const todayHistoryRes = await supabase
        .from('eq_status_history')
        .select('*')
        .gte('created_at', todayStart)
        .order('created_at', { ascending: true })

      const allHistories: any[] = todayHistoryRes.data || []

      // Se existem dispatches com IDs que iniciaram antes de hoje (turnos da noite), busca separadamente
      const nightShiftDispatchIds = activeDispatchIds.filter(id => {
        const d = dispatches?.find((d: any) => d.id === id)
        return d && new Date(d.shift_start_time) < new Date(todayStart)
      })

      if (nightShiftDispatchIds.length > 0) {
        for (const did of nightShiftDispatchIds) {
          const { data: nightHistory } = await supabase
            .from('eq_status_history')
            .select('*')
            .eq('dispatch_id', did)
            .lt('created_at', todayStart)
            .order('created_at', { ascending: true })
          if (nightHistory) {
            allHistories.push(...nightHistory)
          }
        }
      }

      // Deduplicar por id
      const seenIds = new Set<string>()
      const histories = allHistories.filter(h => {
        if (seenIds.has(h.id)) return false
        seenIds.add(h.id)
        return true
      }).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

      if (histories) {
        const hMap: Record<string, any[]> = {}
        histories.forEach(h => {
          if (!hMap[h.equipment_id]) hMap[h.equipment_id] = []
          hMap[h.equipment_id].push(h)
        })
        setVehicleHistories(hMap)

        let countAtividade = 0
        let countManutencao = 0
        let countParados = 0
        operandoList.forEach(vehicle => {
          const vHistory = hMap[vehicle.id] || []
          const dispatch = dMap[vehicle.id]
          const lastH = vHistory.length > 0 ? vHistory[vHistory.length - 1] : null
          let currentStatus = translateStatus(lastH ? lastH.new_status : (vehicle.status || 'Sem status'))

          if (!dispatch) {
            const s = currentStatus.toLowerCase();
            if (s.includes('em operação') || s.includes('em atividade') || s === 'operating' || s.includes('aguardando')) {
              currentStatus = 'Sem status';
            }
          }

          const statusLower = currentStatus.toLowerCase()
          
          let isAtividade = false
          let isManutencao = false

          if (statusLower.includes('em operação') || statusLower.includes('em atividade') || statusLower === 'operating') {
            if (dMap[vehicle.id]) {
              countAtividade++
              isAtividade = true
            }
          }
          if (
            statusLower.includes('manuten') || 
            (vehicle.location_status === 'outside' && 
             (vehicle.last_exit_reason === 'corrective_maintenance' || vehicle.last_exit_reason === 'preventive_maintenance'))
          ) {
            countManutencao++
            isManutencao = true
          }

          if (!isAtividade && !isManutencao && !dMap[vehicle.id]) {
            countParados++
          }
        })
        
        setEmTrabalhoCount(countAtividade)
        setManutencaoCount(countManutencao)
        setTurnosFinalizadosCount(countParados)
      } else {
        setEmTrabalhoCount(0)
        setManutencaoCount(0)
        setTurnosFinalizadosCount(0)
      }

      if (activeDispatchIds.length > 0) {
        const { count: anomaliasDataCount } = await supabase
          .from('eq_anomalies')
          .select('*', { count: 'exact', head: true })
          .in('dispatch_id', activeDispatchIds)
        setAnomaliesCount(anomaliasDataCount || 0)
      } else {
        setAnomaliesCount(0)
      }

    } catch (error) {
      console.error('Erro ao buscar dados do painel do motorista:', error)
    }
  }

  // Initial fetch and Realtime subscription
  useEffect(() => {
    fetchDashboardData()

    const subscription = supabase
      .channel('parte_diaria_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eq_equipments' }, () => {
        fetchDashboardData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eq_status_history' }, () => {
        fetchDashboardData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eq_driver_dispatch' }, () => {
        fetchDashboardData()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleClearJourney = async (vehicleId: string) => {
    try {
      // 1. Fetch active dispatches for this equipment
      const { data: dispatchesToDelete } = await supabase
        .from('eq_driver_dispatch')
        .select('id')
        .eq('equipment_id', vehicleId)
        .in('status', ['Em atividade', 'waiting', 'Aguardando'])

      if (dispatchesToDelete && dispatchesToDelete.length > 0) {
        const dispatchIds = dispatchesToDelete.map(d => d.id)

        // 2. Explicitly delete related status history and anomalies
        await supabase.from('eq_status_history').delete().in('dispatch_id', dispatchIds)
        await supabase.from('eq_anomalies').delete().in('dispatch_id', dispatchIds)

        // 3. Delete the dispatches
        const { error } = await supabase
          .from('eq_driver_dispatch')
          .delete()
          .in('id', dispatchIds)

        if (error) throw error
      }

      // Limpa dados do turno no localStorage do dispositivo (caso seja o mesmo)
      const storedEquipmentId = localStorage.getItem('app_motorista_equipment_id')
      if (storedEquipmentId === vehicleId) {
        localStorage.removeItem('app_motorista_timeline')
        localStorage.removeItem('app_motorista_active_status')
        localStorage.removeItem('app_motorista_active_status_color')
        localStorage.removeItem('app_motorista_status_start')
        localStorage.removeItem('app_motorista_water_point')
        localStorage.removeItem('app_motorista_water_start')
        localStorage.removeItem('app_motorista_current_dispatch')
        localStorage.removeItem('app_motorista_equipment_id')
        localStorage.removeItem('app_motorista_current_step')
        localStorage.removeItem('app_motorista_fuel_level')
      }
      
      fetchDashboardData()
    } catch (err) {
      console.error('Failed to clear journey', err)
      alert('Erro ao apagar jornada do dia.')
    }
  }


  // Countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (autoRefresh) {
      interval = setInterval(() => {
        setRefreshCountdown((prev) => {
          if (prev <= 1) {
            fetchDashboardData()
            return 15
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [autoRefresh])

  // Mocks para o restante
  const MOCK_METRICS = {
    locais: 7,
    pendentes: 2,
    devolucoes: 0,
    anomalias: 4,
    emAtraso: 2,
    concluidos: 5,
  }

  return (
    <div className="flex flex-col h-full bg-[#f4f3f0] dark:bg-[#000] p-2 sm:p-4 md:p-6 lg:p-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-sm p-4 sm:p-6 mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              Parte Diária
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Acompanhamento operacional de veículos, motoristas e atividades em campo
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors">
            <CalendarIcon size={16} className="mr-2 text-gray-400" />
            <span>{format(new Date(), 'dd/MM/yyyy')} até {format(new Date(), 'dd/MM/yyyy')}</span>
          </div>
          <button className="p-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors" title="Atualizar">
            <RefreshCw size={18} />
          </button>
          <button 
            className="p-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors" 
            title="Tela Cheia"
            onClick={toggleFullscreen}
          >
            <Maximize size={18} />
          </button>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <MetricCard title="Veículos em trabalho" value={emTrabalhoCount} total={totalPesadosCount} color="bg-amber-800 dark:bg-amber-900/80" />
        <MetricCard 
          title="Locais de execução" 
          value={activities.length} 
          total={0} 
          color="bg-blue-600 dark:bg-blue-700/80" 
          onClick={() => setIsActivitiesModalOpen(true)}
        />
        <MetricCard title="Anomalias" value={anomaliesCount} total={0} color="bg-orange-500 dark:bg-orange-600/80" />
        <MetricCard 
          title="Manutenção" 
          value={manutencaoCount} 
          total={0} 
          color="bg-red-600 dark:bg-red-700/80" 
          onClick={() => window.location.href = '/equipamentos/entrada-saida'}
        />
        <MetricCard title="Turno finalizado" value={turnosFinalizadosCount} total={0} color="bg-emerald-500 dark:bg-emerald-600/80" />
      </div>

      {/* DADOS GERAIS HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
          Dados Gerais
        </h2>
        
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Pesquisar..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input 
              type="checkbox" 
              id="autoRefresh" 
              checked={autoRefresh} 
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="autoRefresh" className="cursor-pointer">
              Atualiza em <strong className="text-gray-900 dark:text-white">{refreshCountdown} segundos</strong>
            </label>
          </div>

          <div className="flex bg-gray-200/50 dark:bg-zinc-800/50 p-1 rounded-lg">
            <button 
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${groupMode === 'motorista' ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              onClick={() => setGroupMode('motorista')}
            >
              Motoristas
            </button>
            <button 
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${groupMode === 'veiculo' ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              onClick={() => setGroupMode('veiculo')}
            >
              Veículos
            </button>
          </div>
        </div>
      </div>

      {/* VEHICLE LIST */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
        {activeVehicles.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            Nenhum equipamento pesado operando no momento.
          </div>
        ) : (
          activeVehicles.map(vehicle => (
            <VehicleCard 
              key={vehicle.id} 
              vehicle={vehicle} 
              history={vehicleHistories[vehicle.id] || []} 
              dispatch={vehicleDispatches[vehicle.id]}
              onClearJourney={() => handleClearJourney(vehicle.id)} 
              onRefresh={fetchDashboardData}
            />
          ))
        )}
      </div>

      {/* Modal de Locais de Execução (Atividades) */}
      <Dialog open={isActivitiesModalOpen} onOpenChange={setIsActivitiesModalOpen}>
        <DialogContent className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-xl sm:max-w-md">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <MapPin className="text-blue-500" size={20} />
              {isEditingActivity ? 'Editar Atividade' : 'Locais de Execução'}
            </DialogTitle>
            {!isEditingActivity && (
              <button 
                onClick={() => { setEditingActivity({ categories: [], color: 'bg-zinc-900 border border-zinc-800 text-white', icon: 'MapPin' }); setIsEditingActivity(true); }} 
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
              >
                <Plus size={16} /> Nova
              </button>
            )}
          </DialogHeader>
          
          <div className="py-2">
            {isEditingActivity ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome da Atividade</label>
                  <input 
                    type="text" 
                    value={editingActivity.name || ''} 
                    onChange={e => setEditingActivity({...editingActivity, name: e.target.value})}
                    className="w-full bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md p-2 text-sm text-gray-900 dark:text-gray-100"
                    placeholder="Ex: Lavagem Mirante"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ícone</label>
                    <select 
                      value={editingActivity.icon || ''}
                      onChange={e => setEditingActivity({...editingActivity, icon: e.target.value})}
                      className="w-full bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md p-2 text-sm text-gray-900 dark:text-gray-100"
                    >
                      {Object.keys(ICON_MAP).map(iconName => (
                        <option key={iconName} value={iconName}>{ICON_NAMES_PT[iconName] || iconName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cor</label>
                    <select 
                      value={editingActivity.color || ''}
                      onChange={e => setEditingActivity({...editingActivity, color: e.target.value})}
                      className="w-full bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md p-2 text-sm text-gray-900 dark:text-gray-100"
                    >
                      <option value="bg-zinc-900 border border-zinc-800 text-white">Escura (Dark)</option>
                      <option value="bg-white border border-gray-200 text-gray-900">Clara (Light)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categorias (vazio = todas)</label>
                  <div className="max-h-32 overflow-y-auto border border-gray-300 dark:border-zinc-700 rounded-md p-2 bg-gray-50 dark:bg-zinc-800/50">
                    {equipmentTypes.map(type => (
                      <label key={type} className="flex items-center gap-2 mb-1 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={(editingActivity.categories || []).includes(type)}
                          onChange={e => {
                            const cats = editingActivity.categories || [];
                            if (e.target.checked) setEditingActivity({...editingActivity, categories: [...cats, type]})
                            else setEditingActivity({...editingActivity, categories: cats.filter(c => c !== type)})
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button onClick={() => setIsEditingActivity(false)} className="px-4 py-2 text-sm bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-md">Cancelar</button>
                  <button onClick={handleSaveActivity} className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 rounded-md"><Save size={16}/> Salvar</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {activities.map((act) => {
                  const Icon = ICON_MAP[act.icon] || MapPin;
                  return (
                    <div key={act.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 group hover:border-blue-200 dark:hover:border-blue-900/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-black/5 dark:bg-white/10 rounded-lg text-gray-900 dark:text-white">
                          <Icon size={18} />
                        </div>
                        <div>
                          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 block">{act.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {act.categories && act.categories.length > 0 ? act.categories.join(', ') : 'Todas as Categorias'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingActivity(act); setIsEditingActivity(true); }} className="p-1.5 text-gray-500 hover:text-blue-600 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDeleteActivity(act.id)} className="p-1.5 text-gray-500 hover:text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )
                })}
                {activities.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Nenhuma atividade cadastrada.</p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}

function MetricCard({ title, value, total, color, onClick }: { title: string, value: number, total: number, color: string, onClick?: () => void }) {
  const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0
  
  return (
    <div 
      className={`${color} text-white p-4 rounded-2xl relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[110px] ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
      onClick={onClick}
    >
      <div className="relative z-10">
        <h3 className="text-3xl font-bold leading-none">{value}</h3>
        <p className="text-sm font-medium opacity-90 mt-1">{title}</p>
      </div>
      {total > 0 && (
        <div className="relative z-10 text-xs opacity-70 mt-2 font-medium">
          ({percentage}%)
        </div>
      )}
    </div>
  )
}

function VehicleCard({ vehicle, history = [], dispatch, onClearJourney, onRefresh }: { vehicle: any, history?: any[], dispatch?: any, onClearJourney: () => void, onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const reportRef = useRef<HTMLDivElement>(null)
  
  const [selectedAnomalies, setSelectedAnomalies] = useState<any[]>([])
  const [isAnomaliesModalOpen, setIsAnomaliesModalOpen] = useState(false)
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editKmInicial, setEditKmInicial] = useState('')
  const [editKmFinal, setEditKmFinal] = useState('')
  const [editHoriInicial, setEditHoriInicial] = useState('')
  const [editHoriFinal, setEditHoriFinal] = useState('')
  const [editFuelInicial, setEditFuelInicial] = useState('')
  const [editFuelFinal, setEditFuelFinal] = useState('')

  const openEditModal = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditKmInicial(dispatch?.odometer_start?.toString() || '')
    setEditKmFinal(dispatch?.odometer_end?.toString() || vehicle.current_km?.toString() || '')
    setEditHoriInicial(dispatch?.horimeter_start?.toString() || '')
    setEditHoriFinal(dispatch?.horimeter_end?.toString() || vehicle.current_horimeter?.toString() || '')
    setEditFuelInicial(dispatch?.fuel_start_percent?.toString() || '')
    setEditFuelFinal(dispatch?.fuel_end_percent?.toString() || '')
    setIsEditModalOpen(true)
  }

  const handleSaveCorrection = async () => {
    try {
      await supabase.from('eq_equipments').update({
        current_km: editKmFinal ? parseFloat(editKmFinal) : null,
        current_horimeter: editHoriFinal ? parseFloat(editHoriFinal) : null
      }).eq('id', vehicle.id)

      if (dispatch?.id) {
        await supabase.from('eq_driver_dispatch').update({
          odometer_start: editKmInicial ? parseFloat(editKmInicial) : null,
          odometer_end: editKmFinal ? parseFloat(editKmFinal) : null,
          horimeter_start: editHoriInicial ? parseFloat(editHoriInicial) : null,
          horimeter_end: editHoriFinal ? parseFloat(editHoriFinal) : null,
          fuel_start_percent: editFuelInicial ? parseInt(editFuelInicial) : null,
          fuel_end_percent: editFuelFinal ? parseInt(editFuelFinal) : null
        }).eq('id', dispatch.id)
      }
      
      setIsEditModalOpen(false)
      onRefresh()
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar correções')
    }
  }

  const downloadPNG = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!reportRef.current) return
    
    try {
      await new Promise(r => setTimeout(r, 500))
      const dataUrl = await htmlToImage.toPng(reportRef.current, { pixelRatio: 2 })
      const link = document.createElement('a')
      link.download = `parte-diaria-${vehicle.plate_tag || vehicle.name}.png`
      link.href = dataUrl
      link.click()
    } catch (err: any) {
      console.error('Failed to download PNG', err)
      alert(`Erro ao gerar PNG: ${err.message || err}`)
    }
  }

  const downloadPDF = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!reportRef.current) return
    
    try {
      await new Promise(r => setTimeout(r, 500))
      const dataUrl = await htmlToImage.toPng(reportRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' })
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4'
      })
      const pdfWidth = pdf.internal.pageSize.getWidth()
      
      // Calculate height maintaining aspect ratio
      const imgProps = pdf.getImageProperties(dataUrl)
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight)
      pdf.save(`parte-diaria-${vehicle.plate_tag || vehicle.name}.pdf`)
    } catch (err: any) {
      console.error('Failed to download PDF', err)
      alert(`Erro ao gerar PDF: ${err.message || err}`)
    }
  }

  const lastHistory = history.length > 0 ? history[history.length - 1] : null
  let currentStatus = translateStatus(lastHistory ? lastHistory.new_status : (vehicle.status || 'Sem status'))

  if (!dispatch) {
    const s = currentStatus.toLowerCase();
    if (s.includes('em operação') || s.includes('em atividade') || s === 'operating' || s.includes('aguardando')) {
      currentStatus = 'Sem status';
    }
  }

  // Deriva o motorista: primeiro do histórico, depois do dispatch, para evitar "Motorista não atribuído"
  const driverId = lastHistory?.driver_id || dispatch?.driver_id || null
  const driverName = dispatch?.driver_name
    || (driverId ? DRIVERS.find(d => d.id === driverId)?.name || `Motorista (${driverId})` : null)
    || (dispatch ? 'Motorista em turno' : 'Motorista não atribuído')

  let statusColor = 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-gray-400 border-gray-200 dark:border-zinc-700'
  let statusDot = 'bg-gray-500'
  let statusLabel = 'Parado'
  
  const statusLower = currentStatus.toLowerCase()

  // Se turno ativo mas sem histórico ainda, mostra "Aguardando"
  if (dispatch && !dispatch.shift_end_time && history.length === 0) {
    currentStatus = 'Aguardando'
  }

  // Se for finalizada ou sem status, fica cinza
  if (!dispatch && (statusLower === 'sem status' || statusLower.includes('finalizada') || statusLower.includes('offline'))) {
    statusLabel = 'Sem status'
  }
  // Status de Pausa / Parado -> Laranja
  else if (
    statusLower.includes('chuva') || 
    statusLower.includes('abastec') || 
    statusLower.includes('aguardando') || 
    statusLower.includes('pausa')
  ) {
    statusColor = 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 border-orange-200 dark:border-orange-500/30'
    statusDot = 'bg-orange-500'
    statusLabel = 'Aguardando'
  } 
  // Qualquer outra atividade (Operando, Irrigação, Nova atividade, etc) -> Verde
  else if (dispatch) {
    statusColor = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
    statusDot = 'bg-emerald-500'
    statusLabel = 'Em atividade'
  }

  return (
    <div ref={cardRef} className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-sm transition-all duration-300 overflow-hidden">
      {/* Header Row */}
      <div 
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-5 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors gap-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center border-2 border-emerald-500/20">
            <Truck className="text-emerald-600 dark:text-emerald-400" size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{vehicle.name || vehicle.plate_tag}</h3>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColor}`}>
                <span className={`w-1.5 h-1.5 inline-block rounded-full mr-1.5 mb-0.5 ${statusDot}`}></span>
                {statusLabel}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">{driverName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Status: <span className="text-gray-700 dark:text-gray-300 font-semibold">{currentStatus}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-6 w-full sm:w-auto justify-end">
          
          <div className="hidden sm:flex items-center gap-2">
            
            {(() => {
              const anomalies = history.filter((h: any) => 
                (h.new_status?.startsWith('Anomalia Pneus:') || h.new_status?.startsWith('Anomalia Checklist:'))
                && (!dispatch?.id || h.dispatch_id === dispatch.id)
              );
              
              if (anomalies.length === 0) {
                return (
                  <button 
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-xs font-semibold text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-zinc-700 cursor-not-allowed mr-2"
                    title="Nenhuma anomalia registrada hoje"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <AlertTriangle size={14} /> Anomalias
                  </button>
                )
              }
              
              return (
                <button 
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors mr-2 cursor-pointer"
                  title="Ver anomalias reportadas"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAnomalies(anomalies);
                    setIsAnomaliesModalOpen(true);
                  }}
                >
                  <AlertTriangle size={14} /> Anomalias ({anomalies.length})
                </button>
              )
            })()}

            <button 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-zinc-800 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-gray-200 dark:border-zinc-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors mr-2"
              title="Corrigir KM/Horímetro"
              onClick={openEditModal}
            >
              <Edit size={14} /> Corrigir
            </button>
            
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
              <DialogContent className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-xl sm:max-w-[425px]" onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                  <DialogTitle className="text-gray-900 dark:text-gray-100">Corrigir KM e Horímetro</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label className="text-right text-sm text-gray-700 dark:text-gray-300">KM Inicial</label>
                    <input type="number" value={editKmInicial} onChange={e => setEditKmInicial(e.target.value)} className="col-span-3 p-2 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label className="text-right text-sm text-gray-700 dark:text-gray-300">KM Final</label>
                    <input type="number" value={editKmFinal} onChange={e => setEditKmFinal(e.target.value)} className="col-span-3 p-2 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label className="text-right text-sm text-gray-700 dark:text-gray-300">Hori. Inicial</label>
                    <input type="number" value={editHoriInicial} onChange={e => setEditHoriInicial(e.target.value)} className="col-span-3 p-2 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label className="text-right text-sm text-gray-700 dark:text-gray-300">Hori. Final</label>
                    <input type="number" value={editHoriFinal} onChange={e => setEditHoriFinal(e.target.value)} className="col-span-3 p-2 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label className="text-right text-sm text-gray-700 dark:text-gray-300">Comb. Inicial (%)</label>
                    <input type="number" value={editFuelInicial} onChange={e => setEditFuelInicial(e.target.value)} className="col-span-3 p-2 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label className="text-right text-sm text-gray-700 dark:text-gray-300">Comb. Final (%)</label>
                    <input type="number" value={editFuelFinal} onChange={e => setEditFuelFinal(e.target.value)} className="col-span-3 p-2 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100" />
                  </div>
                </div>
                <DialogFooter>
                  <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800">Cancelar</button>
                  <button onClick={handleSaveCorrection} className="px-4 py-2 rounded-md text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700">Salvar</button>
                </DialogFooter>
              </DialogContent>
            </Dialog>



            {/* Modal de Anomalias */}
            <Dialog open={isAnomaliesModalOpen} onOpenChange={setIsAnomaliesModalOpen}>
              <DialogContent className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-xl sm:max-w-[425px]" onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                  <DialogTitle className="text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <AlertTriangle className="text-red-500" size={20} />
                    Anomalias Reportadas
                  </DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                  {selectedAnomalies.length > 0 ? selectedAnomalies.map((a: any) => (
                    <div key={a.id} className="p-3 rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                          {new Date(a.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                        {a.new_status.replace('Anomalia Pneus: ', 'Pneus (').replace('Anomalia Checklist: ', '')}{a.new_status.startsWith('Anomalia Pneus') ? ')' : ''}
                      </p>
                    </div>
                  )) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Nenhuma anomalia selecionada.</p>
                  )}
                </div>
                <DialogFooter>
                  <button onClick={() => setIsAnomaliesModalOpen(false)} className="px-4 py-2 w-full rounded-md text-sm font-medium bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">
                    Fechar
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <button 
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors mr-2 ${ vehicle.latitude && vehicle.longitude ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 cursor-pointer' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-zinc-700 cursor-not-allowed' }`}
              title={vehicle.latitude && vehicle.longitude ? `Atualizado em: ${new Date(vehicle.last_location_update).toLocaleString()}` : 'Localização não disponível para este equipamento'}
              onClick={(e) => {
                e.stopPropagation()
                if (vehicle.latitude && vehicle.longitude) {
                  window.open(`https://www.google.com/maps?q=${vehicle.latitude},${vehicle.longitude}`, '_blank')
                } else {
                  alert('A localização deste equipamento ainda não foi atualizada pelo app do motorista.')
                }
              }}
            >
              <MapPin size={14} /> GPS
            </button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button 
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-zinc-800 text-xs font-semibold text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors mr-2"
                  title="Limpar jornada do dia"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Trash2 size={14} />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-gray-900 dark:text-gray-100 text-lg font-bold">Limpar Jornada do Dia</AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
                    Tem certeza que deseja apagar toda a jornada de hoje deste equipamento? Isso removerá o histórico e não pode ser desfeito.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800" onClick={(e) => e.stopPropagation()}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    className="bg-red-600 text-white hover:bg-red-700 border-none" 
                    onClick={(e) => {
                      e.stopPropagation()
                      onClearJourney()
                    }}
                  >
                    Sim, apagar jornada
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <button 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-zinc-800 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-gray-200 dark:border-zinc-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
              onClick={downloadPNG}
              title="Baixar como PNG"
            >
              <Download size={14} /> PNG
            </button>
            <button 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-zinc-800 text-xs font-semibold text-red-600 dark:text-red-400 border border-gray-200 dark:border-zinc-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              onClick={downloadPDF}
              title="Baixar como PDF"
            >
              <Download size={14} /> PDF
            </button>
          </div>

          <button 
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-zinc-800 text-xs font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
          >
            {expanded ? (
              <><ChevronUp size={14} /> Recolher</>
            ) : (
              <><ChevronDown size={14} /> Detalhes</>
            )}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      <div className={`transition-all duration-300 ease-in-out ${expanded ? 'max-h-[1000px] opacity-100 border-t border-gray-100 dark:border-zinc-800' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="p-5 flex flex-col md:flex-row gap-8">
          
          {/* Info Panel */}
          <div className="md:w-1/3 space-y-4">
            <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-xl text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs">Placa</p>
                <p className="font-semibold text-gray-900 dark:text-white uppercase">{vehicle.plate_tag || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs">Tipo</p>
                <p className="font-semibold text-gray-900 dark:text-white">{vehicle.type || 'Equipamento'}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs">Horímetro</p>
                <p className="font-semibold text-gray-900 dark:text-white">{vehicle.current_horimeter || dispatch?.horimeter_start || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs">KM Atual</p>
                <p className="font-semibold text-gray-900 dark:text-white">{vehicle.current_km || dispatch?.odometer_start || '-'}</p>
              </div>
            </div>
            
            {/* Determinar configurações da imagem baseado no tipo */}
            {(() => {
              const vehicleName = (vehicle.name || '').toUpperCase();
              const isMunck = vehicleName.startsWith('CM');
              const isOnibus = vehicleName.startsWith('OB');
              
              const truckImage = isMunck ? '/logomunk.png?v=1' : (isOnibus ? '/logoonibus.png?v=1' : '/logopipa.png?v=2');
              
              // Coordenadas da Placa (Pipa vs Munck vs Onibus)
              const plateTop = isMunck ? '71.0%' : (isOnibus ? '74.5%' : '72.8%');
              const plateLeft = isMunck ? '87.2%' : (isOnibus ? '84.5%' : '85.5%');
              const plateScale = 'scale(1.0, 1.4)';
              
              // Coordenadas da Tag (Pipa vs Munck vs Onibus)
              const tagTop = isMunck ? '57.4%' : (isOnibus ? '49.3%' : '57.2%');
              const tagLeft = isMunck ? '61.3%' : (isOnibus ? '45.8%' : '57.4%');

              return (
                <div className="w-full rounded-xl overflow-hidden border border-gray-100 dark:border-zinc-800 shadow-sm mt-4 bg-gray-50 dark:bg-zinc-800/50 flex items-center justify-center relative">
                  <img 
                    src={truckImage} 
                    alt={vehicle.name || "Caminhão"} 
                    className="w-full h-auto object-cover"
                  />
                  
                  {/* Placa na imagem */}
                  {vehicle.plate_tag && (
                    <div 
                      id="plate-overlay"
                      className="absolute flex items-center justify-center font-bold text-black uppercase"
                      style={{
                        top: plateTop,
                        left: plateLeft,
                        width: '11%',
                        height: '4%',
                        fontSize: 'clamp(0.2rem, 0.4vw, 0.5rem)',
                        transform: `translate(-50%, -50%) skewX(-2deg) rotate(-2deg) ${plateScale}`
                      }}
                    >
                      {vehicle.plate_tag}
                    </div>
                  )}

                  {/* Tag na Porta */}
                  {vehicle.name && (
                    <div 
                      id="tag-overlay"
                      className="absolute font-black text-black opacity-90 text-center"
                      style={{
                        top: tagTop,
                        left: tagLeft,
                        fontSize: 'clamp(0.4rem, 0.9vw, 0.9rem)',
                        transform: 'translate(-50%, -50%) rotate(-2deg)'
                      }}
                    >
                      {vehicle.name}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Timeline Panel */}
          <div className="md:w-2/3">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-4 uppercase tracking-wider opacity-80">Linha do Tempo</h4>
            {history.length === 0 && dispatch ? (
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 dark:before:via-zinc-700 before:to-transparent">
                  <TimelineItem
                    key="dispatch-start"
                    time={format(new Date(dispatch.shift_start_time), 'HH:mm')}
                    title="Jornada Iniciada"
                    subtitle={`Motorista: ${driverName}`}
                    status="in-progress"
                    isLast={true}
                  />
                  <TimelineItem
                    key="dispatch-waiting"
                    time={format(new Date(dispatch.shift_start_time), 'HH:mm')}
                    title="Aguardando"
                    subtitle="Status inicial"
                    status="pending"
                    isLast={true}
                  />
                </div>
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma atividade registrada para hoje.</p>
            ) : (
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 dark:before:via-zinc-700 before:to-transparent">
                  {dispatch && (
                    <TimelineItem
                      key="dispatch-start"
                      time={format(new Date(dispatch.shift_start_time), 'HH:mm')}
                      title="Jornada Iniciada"
                      subtitle={`Motorista: ${driverName}`}
                      status="in-progress"
                      isLast={false}
                    />
                  )}
                  {history.map((h, i) => {
                    const translatedNewStatus = translateStatus(h.new_status)
                    const translatedPrevStatus = translateStatus(h.previous_status)
                    let mappedStatus: 'completed' | 'in-progress' | 'pending' | 'anomaly' = 'completed'
                    if (translatedNewStatus === 'Aguardando' || translatedNewStatus === 'Pausa / Almoço') mappedStatus = 'pending'
                    if (translatedNewStatus === 'Chuva' || translatedNewStatus.includes('Abastecendo')) mappedStatus = 'anomaly'
                    if (translatedNewStatus.includes('Operação')) mappedStatus = 'in-progress'

                    return (
                      <TimelineItem 
                        key={h.id}
                        time={format(new Date(h.created_at), 'HH:mm')} 
                        title={translatedNewStatus} 
                        subtitle={translatedPrevStatus && translatedPrevStatus !== translatedNewStatus ? `Anterior: ${translatedPrevStatus}` : undefined} 
                        status={mappedStatus} 
                        isLast={i === history.length - 1} 
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      <div style={{ position: 'fixed', top: '-10000px', left: 0, zIndex: -1000 }}>
        <ParteDiariaReport
          ref={reportRef}
          motorista={driverName}
          ajudante={dispatch?.helper_name || '-'}
          data={new Date()}
          equipamentoNome={vehicle.type || 'Equipamento'}
          placa={vehicle.plate_tag || '-'}
          obra={vehicle.brand ? `OBRA: ${vehicle.brand}` : '4600012690'}
          kmInicial={dispatch?.odometer_start || '-'}
          kmFinal={dispatch?.odometer_end || dispatch?.odometer_start || vehicle.current_km || '-'}
          horimetroInicial={dispatch?.horimeter_start || '-'}
          horimetroFinal={dispatch?.horimeter_end || dispatch?.horimeter_start || vehicle.current_horimeter || '-'}
          abastecimentoInicial={dispatch?.fuel_start_percent ?? '-'}
          abastecimentoFinal={dispatch?.fuel_end_percent ?? dispatch?.fuel_start_percent ?? '-'}
          timeline={history.map((h: any) => ({
            time: h.created_at,
            name: h.new_status,
            type: 'Status Alterado'
          }))}
        />
      </div>
    </div>
  )
}

function TimelineItem({ time, title, subtitle, status, isLast = false }: { time: string, title: string, subtitle?: string, status: 'completed' | 'in-progress' | 'pending' | 'anomaly', isLast?: boolean }) {
  const getStatusColor = () => {
    switch(status) {
      case 'completed': return 'bg-emerald-500 border-emerald-200'
      case 'in-progress': return 'bg-blue-500 border-blue-200'
      case 'anomaly': return 'bg-orange-500 border-orange-200'
      case 'pending': default: return 'bg-gray-300 dark:bg-zinc-600 border-gray-100 dark:border-zinc-800'
    }
  }

  return (
    <div className="relative flex items-start">
      <div className={`absolute -left-[27px] w-3 h-3 rounded-full border-2 bg-white dark:bg-black mt-1 z-10 ${getStatusColor()}`}></div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900 dark:text-white">{title}</span>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{time}</span>
        </div>
        {subtitle && <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}
