import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import {
  MapPin, Calendar as CalendarIcon, RefreshCw, Maximize,
  Truck, Search, Filter, AlertTriangle, Clock, CheckCircle2,
  Undo2, MoreVertical, X, Image as ImageIcon, ChevronDown, ChevronUp, Download, Trash2, Edit
} from 'lucide-react'
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
  const [totalPesadosCount, setTotalPesadosCount] = useState(0)
  const [activeVehicles, setActiveVehicles] = useState<any[]>([])
  const [vehicleHistories, setVehicleHistories] = useState<Record<string, any[]>>({})
  const [vehicleDispatches, setVehicleDispatches] = useState<Record<string, any>>({})

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
        .from('eq_equipments')
        .select('*')
        .eq('category', 'Equipamento Pesado')
        .order('name', { ascending: true })

      if (pesadosError) throw pesadosError
      
      const total = pesados?.length || 0
      // Mostrar todos os equipamentos pesados na lista, mantendo o status apontado pelo motorista
      const operandoList = pesados || []
      
      setTotalPesadosCount(total)
      setActiveVehicles(operandoList)

      // 2. Busca histórico do dia
      const todayStart = startOfDay(new Date()).toISOString()
      const { data: histories, error: hError } = await supabase
        .from('eq_status_history')
        .select('*')
        .gte('created_at', todayStart)
        .order('created_at', { ascending: true })

      if (!hError && histories) {
        const hMap: Record<string, any[]> = {}
        histories.forEach(h => {
          if (!hMap[h.equipment_id]) hMap[h.equipment_id] = []
          hMap[h.equipment_id].push(h)
        })
        setVehicleHistories(hMap)

        // Busca dispatches do dia (para km e combustível inicial)
        const { data: dispatches } = await supabase
          .from('eq_driver_dispatch')
          .select('*')
          .gte('shift_start_time', todayStart)
          .order('shift_start_time', { ascending: true })

        const dMap: Record<string, any> = {}
        if (dispatches) {
          dispatches.forEach(d => {
            // Guarda sempre o último dispatch do dia para o equipamento
            dMap[d.equipment_id] = d
          })
        }
        setVehicleDispatches(dMap)

        let countAtividade = 0
        operandoList.forEach(vehicle => {
          const vHistory = hMap[vehicle.id] || []
          const lastH = vHistory.length > 0 ? vHistory[vHistory.length - 1] : null
          let currentStatus = translateStatus(lastH ? lastH.new_status : (vehicle.status || 'Sem status'))

          const statusLower = currentStatus.toLowerCase()
          
          let isAtividade = false
          if (statusLower.includes('em operação') || statusLower.includes('em atividade') || statusLower === 'operating') {
            isAtividade = true
          }
          
          if (isAtividade) countAtividade++
        })
        
        setEmTrabalhoCount(countAtividade)
      } else {
        setEmTrabalhoCount(0)
      }

    } catch (error) {
      console.error('Erro ao buscar dados do painel do motorista:', error)
    }
  }

  // Initial fetch and Realtime subscription
  useEffect(() => {
    fetchDashboardData()

    const subscription = supabase
      .channel('eq_equipments_changes_painel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eq_equipments' }, () => {
        fetchDashboardData()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleClearJourney = async (vehicleId: string) => {
    try {
      const todayStart = startOfDay(new Date()).toISOString()
      const { error } = await supabase
        .from('eq_status_history')
        .delete()
        .eq('equipment_id', vehicleId)
        .gte('created_at', todayStart)

      if (error) throw error
      
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
            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-gray-900 dark:text-white">
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <MetricCard title="Veículos em trabalho" value={emTrabalhoCount} total={totalPesadosCount} color="bg-amber-800 dark:bg-amber-900/80" />
        <MetricCard title="Locais de execução" value={MOCK_METRICS.locais} total={0} color="bg-blue-600 dark:bg-blue-700/80" />
        <MetricCard title="Pendentes" value={MOCK_METRICS.pendentes} total={0} color="bg-gray-500 dark:bg-gray-600/80" />
        <MetricCard title="Devoluções" value={MOCK_METRICS.devolucoes} total={0} color="bg-rose-500 dark:bg-rose-600/80" />
        <MetricCard title="Anomalias" value={MOCK_METRICS.anomalias} total={0} color="bg-orange-500 dark:bg-orange-600/80" />
        <MetricCard title="Em atraso" value={MOCK_METRICS.emAtraso} total={0} color="bg-red-600 dark:bg-red-700/80" />
        <MetricCard title="Concluídos" value={MOCK_METRICS.concluidos} total={0} color="bg-emerald-500 dark:bg-emerald-600/80" />
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

    </div>
  )
}

function MetricCard({ title, value, total, color }: { title: string, value: number, total: number, color: string }) {
  const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0
  
  return (
    <div className={`${color} text-white p-4 rounded-2xl relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[110px]`}>
      <div className="relative z-10">
        <h3 className="text-3xl font-bold font-display leading-none">{value}</h3>
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
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editKmInicial, setEditKmInicial] = useState('')
  const [editKmFinal, setEditKmFinal] = useState('')
  const [editHoriInicial, setEditHoriInicial] = useState('')
  const [editHoriFinal, setEditHoriFinal] = useState('')

  const openEditModal = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditKmInicial(dispatch?.odometer_start?.toString() || '')
    setEditKmFinal(dispatch?.odometer_end?.toString() || vehicle.current_km?.toString() || '')
    setEditHoriInicial(dispatch?.horimeter_start?.toString() || '')
    setEditHoriFinal(dispatch?.horimeter_end?.toString() || vehicle.current_horimeter?.toString() || '')
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
          horimeter_end: editHoriFinal ? parseFloat(editHoriFinal) : null
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

  const driverId = lastHistory ? lastHistory.driver_id : null
  const driverName = driverId ? DRIVERS.find(d => d.id === driverId)?.name || 'Desconhecido' : 'Motorista não atribuído'

  let statusColor = 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-gray-400 border-gray-200 dark:border-zinc-700'
  let statusDot = 'bg-gray-500'
  let statusLabel = 'Parado'
  
  const statusLower = currentStatus.toLowerCase()

  // Se for finalizada ou sem status, fica cinza
  if (statusLower === 'sem status' || statusLower.includes('finalizada') || statusLower.includes('offline')) {
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
    statusLabel = 'Parado'
  } 
  // Qualquer outra atividade (Operando, Irrigação, Nova atividade, etc) -> Verde
  else {
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
                </div>
                <DialogFooter>
                  <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800">Cancelar</button>
                  <button onClick={handleSaveCorrection} className="px-4 py-2 rounded-md text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700">Salvar</button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

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
                <p className="font-semibold text-gray-900 dark:text-white">{vehicle.current_horimeter || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs">KM Atual</p>
                <p className="font-semibold text-gray-900 dark:text-white">{vehicle.current_km || '-'}</p>
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
            {history.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma atividade registrada para hoje.</p>
            ) : (
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 dark:before:via-zinc-700 before:to-transparent">
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
          abastecimentoInicial={dispatch?.fuel_start_percent || '-'}
          abastecimentoFinal={dispatch?.fuel_end_percent || '-'}
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
