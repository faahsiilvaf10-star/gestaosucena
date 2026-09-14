import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { saveOfflineFirst } from '../../lib/offline-sync'
import { Play, Square, Coffee, Droplet, Fuel, AlertOctagon, ListTodo, MapPin, Truck, History, Camera, Loader2, ClipboardCheck, Utensils, Wrench, X, Waves, Sprout, CloudRain, Car, LogOut, Clock } from 'lucide-react'
import { format, differenceInSeconds } from 'date-fns'
import FuelGauge from './FuelGauge'
import MercosulPlate from './MercosulPlate'

export default function DashboardStep() {
  const [equipment, setEquipment] = useState<any>(null)
  const [dispatch, setDispatch] = useState<any>(null)
  const [elapsedTime, setElapsedTime] = useState('00:00:00')
  const [activeStatus, setActiveStatus] = useState<string>(
    localStorage.getItem('app_motorista_active_status') || 'waiting'
  )
  const [statusStartTime, setStatusStartTime] = useState<Date | null>(
    localStorage.getItem('app_motorista_status_start')
      ? new Date(localStorage.getItem('app_motorista_status_start') as string)
      : new Date()
  )
  const [elapsedStatusTime, setElapsedStatusTime] = useState('00:00:00')
  const [viewState, setViewState] = useState<'operating' | 'finishing' | 'loading_water' | 'new_activity' | 'history'>('operating')

  // Water Loading State
  const [activeWaterPoint, setActiveWaterPoint] = useState<string | null>(localStorage.getItem('app_motorista_water_point'))
  const [waterLoadStartTime, setWaterLoadStartTime] = useState<Date | null>(
    localStorage.getItem('app_motorista_water_start') 
      ? new Date(localStorage.getItem('app_motorista_water_start') as string)
      : null
  )
  const [waterLoadTime, setWaterLoadTime] = useState('00:00:00')

  // Finish Shift State
  const [endKm, setEndKm] = useState('')
  const [endHorimeter, setEndHorimeter] = useState('')
  const [endFuel, setEndFuel] = useState('100')
  const [loadingFinish, setLoadingFinish] = useState(false)

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    color: string;
    confirmText?: string;
  } | null>(null)

  const confirmAction = (title: string, color: string, action: () => void, confirmText = 'Confirmar') => {
    let desc = `Deseja realmente prosseguir com a ação: ${title}?`
    
    const isStartingNewActivity = 
      title !== 'Retomar Operação' && 
      title !== 'Deslogar' && 
      title !== 'Finalizar Jornada' && 
      title !== 'Parar Atividade Atual' &&
      title !== 'Registrar Anomalia' &&
      title !== 'Abastecer';

    if (isStartingNewActivity && activeStatus !== 'operating') {
       // Precisamos resolver getStatusColors para pegar o label atual
       // Como getStatusColors usa activeStatus que já temos no state, podemos simular aqui
       let currentLabel = activeStatus.toUpperCase()
       if (activeStatus === 'paused') currentLabel = 'PAUSA / ALMOÇO'
       if (activeStatus === 'waiting') currentLabel = 'AGUARDANDO'
       if (activeStatus === 'raining') currentLabel = 'CHUVA'
       
       desc = `Você está atualmente em "${currentLabel}". Deseja encerrar a atividade atual e iniciar "${title}"?`
    }

    setConfirmModal({
      isOpen: true,
      title,
      description: desc,
      color,
      onConfirm: () => {
        setConfirmModal(null)
        action()
      },
      confirmText
    })
  }

  const renderConfirmModal = () => {
    if (!confirmModal?.isOpen) return null
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in">
        <div className="bg-white dark:bg-zinc-900 rounded-[32px] w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
          <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">{confirmModal.title}</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium">{confirmModal.description}</p>
          <div className="flex gap-3">
            <button 
              onClick={() => setConfirmModal(null)}
              className="flex-1 py-4 font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 rounded-2xl active:scale-[0.98] transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={confirmModal.onConfirm}
              className={`flex-1 py-4 font-bold text-white ${confirmModal.color} rounded-2xl active:scale-[0.98] transition-all shadow-lg`}
            >
              {confirmModal.confirmText}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const equipmentId = localStorage.getItem('app_motorista_equipment_id')

  useEffect(() => {
    const fetchData = async () => {
      if (!equipmentId) return

      const { data: eq } = await supabase.from('eq_equipments').select('*').eq('id', equipmentId).single()
      if (eq) setEquipment(eq)

      const { data: dsp } = await supabase
        .from('eq_driver_dispatch')
        .select('*')
        .eq('equipment_id', equipmentId)
        .eq('status', 'Em atividade')
        .order('shift_start_time', { ascending: false })
        .limit(1)
        .single()
      
      if (dsp) {
        setDispatch(dsp)
        localStorage.setItem('app_motorista_current_dispatch', JSON.stringify(dsp))
      } else {
        const localCache = localStorage.getItem('app_motorista_current_dispatch')
        if (localCache) {
          setDispatch(JSON.parse(localCache))
        } else {
          setDispatch({
            shift_start_time: new Date().toISOString(),
            helper_name: 'Desconhecido (Offline)',
            odometer_start: 10000,
            horimeter_start: 5000,
          })
        }
      }
    }

    fetchData()
  }, [equipmentId])

  useEffect(() => {
    if (!dispatch?.shift_start_time || viewState === 'finishing') return

    const interval = setInterval(() => {
      const now = new Date()
      const start = new Date(dispatch.shift_start_time)
      const diff = differenceInSeconds(now, start)
      
      const hours = Math.floor(diff / 3600).toString().padStart(2, '0')
      const mins = Math.floor((diff % 3600) / 60).toString().padStart(2, '0')
      const secs = (diff % 60).toString().padStart(2, '0')
      
      setElapsedTime(`${hours}:${mins}:${secs}`)

      if (activeStatus !== 'operating' && statusStartTime) {
        const sDiff = differenceInSeconds(now, statusStartTime)
        const sHours = Math.floor(sDiff / 3600).toString().padStart(2, '0')
        const sMins = Math.floor((sDiff % 3600) / 60).toString().padStart(2, '0')
        const sSecs = (sDiff % 60).toString().padStart(2, '0')
        setElapsedStatusTime(`${sHours}:${sMins}:${sSecs}`)
      }

      // Water load time
      if (activeWaterPoint && waterLoadStartTime) {
        const wDiff = differenceInSeconds(now, waterLoadStartTime)
        const wHours = Math.floor(wDiff / 3600).toString().padStart(2, '0')
        const wMins = Math.floor((wDiff % 3600) / 60).toString().padStart(2, '0')
        const wSecs = (wDiff % 60).toString().padStart(2, '0')
        setWaterLoadTime(`${wHours}:${wMins}:${wSecs}`)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [dispatch, viewState, activeStatus, statusStartTime, activeWaterPoint, waterLoadStartTime])
  const handleStatusChange = (newStatus: string, color?: string) => {
    const now = new Date()
    
    // Parar abastecimento de água se estiver mudando para outro status
    if (activeWaterPoint && !newStatus.startsWith('Abastecimento')) {
      const stop = new Date()
      const tl = JSON.parse(localStorage.getItem('app_motorista_timeline') || '[]')
      tl.push({ time: stop.toISOString(), name: `Abastecimento de Água (${activeWaterPoint})`, type: 'Finalizado (Auto)', color: 'bg-emerald-500' })
      localStorage.setItem('app_motorista_timeline', JSON.stringify(tl))
      
      setActiveWaterPoint(null)
      setWaterLoadStartTime(null)
      localStorage.removeItem('app_motorista_water_point')
      localStorage.removeItem('app_motorista_water_start')
    }

    setActiveStatus(newStatus)
    setStatusStartTime(newStatus === 'operating' ? null : now)
    
    // Save to timeline
    const timeline = JSON.parse(localStorage.getItem('app_motorista_timeline') || '[]')
    let eventName = newStatus === 'operating' ? 'Em Operação' :
                    newStatus === 'paused' ? 'Pausa / Almoço' :
                    newStatus === 'waiting' ? 'Aguardando' :
                    newStatus === 'raining' ? 'Chuva' : newStatus;
    
    let eventColor = color || (
      newStatus === 'operating' ? 'bg-emerald-500' :
      newStatus === 'paused' ? 'bg-orange-500' :
      newStatus === 'waiting' ? 'bg-amber-500' :
      newStatus === 'raining' ? 'bg-blue-500' : 'bg-gray-500'
    );

    timeline.push({
      time: now.toISOString(),
      name: eventName,
      type: 'Status Alterado',
      color: eventColor
    })
    localStorage.setItem('app_motorista_timeline', JSON.stringify(timeline))

    localStorage.setItem('app_motorista_active_status', newStatus)
    if (color) {
      localStorage.setItem('app_motorista_active_status_color', color)
    } else {
      localStorage.removeItem('app_motorista_active_status_color')
    }

    if (newStatus === 'operating') {
      localStorage.removeItem('app_motorista_status_start')
      setElapsedStatusTime('00:00:00')
    } else {
      localStorage.setItem('app_motorista_status_start', now.toISOString())
    }
  }

  const ActionButton = ({ icon: Icon, label, color, onClick, className = '' }: any) => (
    <button onClick={onClick} className={`${color.bg} ${className || 'aspect-square'} border-0 rounded-3xl p-4 shadow-sm active:scale-[0.95] transition-all flex flex-col items-center justify-center gap-2 text-center relative overflow-hidden group`}>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-black/5 dark:bg-white/10 ${color.text}`}>
        <Icon size={24} />
      </div>
      <span className={`font-bold ${color.text} text-[13px] leading-tight`}>
        {label}
      </span>
    </button>
  )

  const getStatusColors = () => {
    if (activeStatus === 'paused') return { bg: 'bg-orange-500 dark:bg-orange-600 shadow-orange-500/20', text: 'text-orange-50', dot: 'bg-orange-200', label: 'PAUSA / ALMOÇO', timeLabel: 'Tempo de Pausa' }
    if (activeStatus === 'waiting') return { bg: 'bg-amber-500 dark:bg-amber-600 shadow-amber-500/20', text: 'text-amber-50', dot: 'bg-amber-200', label: 'AGUARDANDO', timeLabel: 'Tempo Aguardando' }
    if (activeStatus === 'raining') return { bg: 'bg-blue-500 dark:bg-blue-600 shadow-blue-500/20', text: 'text-blue-50', dot: 'bg-blue-200', label: 'CHUVA', timeLabel: 'Tempo em Chuva' }
    
    if (activeStatus !== 'operating') {
      const customColor = localStorage.getItem('app_motorista_active_status_color') || 'bg-emerald-600'
      const isLight = customColor.includes('bg-white')
      return { 
        bg: customColor, 
        text: isLight ? 'text-gray-900' : 'text-white', 
        dot: isLight ? 'bg-gray-900' : 'bg-white', 
        label: activeStatus.toUpperCase(), 
        timeLabel: 'Tempo na Atividade' 
      }
    }

    return { bg: 'bg-emerald-600 dark:bg-emerald-800 shadow-emerald-500/20', text: 'text-emerald-50', dot: 'bg-emerald-300', label: 'EM OPERAÇÃO', timeLabel: 'Tempo Total' }
  }
  const sColors = getStatusColors()

  const handleFinishShift = async () => {
    if (dispatch?.odometer_start && parseFloat(endKm) < dispatch.odometer_start) {
      alert(`KM Final não pode ser menor que KM Inicial (${dispatch.odometer_start})`)
      return
    }
    if (dispatch?.horimeter_start && parseFloat(endHorimeter) < dispatch.horimeter_start) {
      alert(`Horímetro Final não pode ser menor que o Inicial (${dispatch.horimeter_start})`)
      return
    }

    setLoadingFinish(true)
    try {
      if (dispatch?.id) {
        // Update Dispatch
        await saveOfflineFirst('eq_driver_dispatch', 'UPDATE', {
          id: dispatch.id,
          odometer_end: parseFloat(endKm),
          horimeter_end: parseFloat(endHorimeter),
          fuel_end_percent: parseInt(endFuel),
          shift_end_time: new Date().toISOString(),
          status: 'Finalizada'
        })
      }

      // Create Pós-op Checklist
      await saveOfflineFirst('eq_checklists', 'INSERT', {
        dispatch_id: dispatch?.id,
        equipment_id: equipmentId,
        type: 'pos-operacional',
        status: 'aprovado'
      })

      // Update Equipment status to "Disponível"
      await saveOfflineFirst('eq_equipments', 'UPDATE', { id: equipmentId, location_status: 'outside' })

      localStorage.removeItem('app_motorista_current_dispatch')
      localStorage.removeItem('app_motorista_equipment_id')
      
      // Limpar estados de status e timers
      localStorage.removeItem('app_motorista_active_status')
      localStorage.removeItem('app_motorista_active_status_color')
      localStorage.removeItem('app_motorista_status_start')
      localStorage.removeItem('app_motorista_water_point')
      localStorage.removeItem('app_motorista_water_start')
      localStorage.removeItem('app_motorista_timeline')
      
      // Ao finalizar o turno, desloga o motorista e volta para a seleção de motorista
      localStorage.removeItem('app_motorista_driver')
      localStorage.removeItem('app_motorista_current_step')

      alert('Jornada finalizada com sucesso!')
      window.location.reload() 
    } catch (err) {
      console.error(err)
      alert('Erro ao finalizar jornada.')
    } finally {
      setLoadingFinish(false)
    }
  }

  const handleLogout = async () => {
    // Apenas avisa que não pode
    alert('Só é possível deslogar quando finalizar o turno atual. Use o botão "Finalizar Jornada".')
  }

  if (!equipment) {
    return <div className="min-h-full flex items-center justify-center p-6 bg-gray-50 dark:bg-zinc-950 text-gray-500">Carregando painel...</div>
  }

  if (viewState === 'history') {
    const timeline = JSON.parse(localStorage.getItem('app_motorista_timeline') || '[]')
    
    return (
      <div className="min-h-full flex flex-col bg-gray-50 dark:bg-zinc-950 pb-6 relative">
        <div className="p-6 pb-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
              <History size={22} className="text-emerald-500" />
              Histórico do Turno
            </h2>
            <button onClick={() => setViewState('operating')} className="text-gray-400 active:text-gray-900 dark:active:text-white p-2">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 space-y-6 custom-scrollbar pb-24">
          {timeline.length === 0 ? (
             <div className="text-center text-gray-400 mt-10">Nenhum evento registrado.</div>
          ) : (
            <div className="relative border-l-2 border-gray-200 dark:border-zinc-800 ml-3 space-y-6">
              {timeline.slice().reverse().map((event: any, i: number) => (
                <div key={i} className="relative pl-6">
                  <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-zinc-950 ${event.color || 'bg-gray-400'}`}></div>
                  <div className="text-xs font-bold text-gray-400 mb-0.5">{format(new Date(event.time), 'HH:mm')}</div>
                  <div className="text-sm font-bold text-gray-800 dark:text-gray-200">{event.name}</div>
                  <div className="text-xs text-gray-500">{event.type}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {renderConfirmModal()}
      </div>
    )
  }

  if (viewState === 'finishing') {
    return (
      <div className="min-h-full flex flex-col bg-gray-50 dark:bg-zinc-950">
        <div className="p-6 pb-2">
          <button onClick={() => setViewState('operating')} className="text-sm font-semibold text-gray-500 mb-4 flex items-center gap-1 active:opacity-70">
            &larr; Voltar ao Painel
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
              <Square size={24} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">FINALIZAR <br/>OPERAÇÃO</h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 pt-0 pb-24 custom-scrollbar">
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">KM Final (Opcional se usar horímetro)</label>
            <input 
              type="number" 
              value={endKm}
              onChange={e => setEndKm(e.target.value)}
              placeholder={`KM Inicial foi: ${dispatch?.odometer_start || '-'}`}
              className="w-full h-14 px-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Horímetro Final</label>
            <input 
              type="number" 
              value={endHorimeter}
              onChange={e => setEndHorimeter(e.target.value)}
              placeholder={`Inicial foi: ${dispatch?.horimeter_start || '-'}`}
              className="w-full h-14 px-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
            />
          </div>

          <div className="pt-2 pb-4">
            <FuelGauge value={endFuel} onChange={setEndFuel} />
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-2xl border border-orange-200 dark:border-orange-800/30 flex gap-3">
            <ClipboardCheck className="text-orange-500 shrink-0 mt-0.5" size={20} />
            <div className="text-sm font-medium text-orange-800 dark:text-orange-300 leading-snug">
              O checklist pós-operacional confirmará as condições do equipamento na devolução.
            </div>
          </div>

          <button onClick={handleFinishShift} disabled={loadingFinish} className="w-full h-14 bg-gray-900 dark:bg-white text-white dark:text-black font-bold text-lg rounded-2xl mt-4 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg">
            {loadingFinish ? <Loader2 className="animate-spin" size={24} /> : 'ENCERRAR E ENVIAR'}
          </button>
        </div>
        {renderConfirmModal()}
      </div>
    )
  }

  if (viewState === 'loading_water') {
    return (
      <div className="min-h-full flex flex-col bg-gray-950 text-white pb-20">
        <div className="p-6 pb-2">
          <button onClick={() => setViewState('operating')} className="text-sm font-semibold text-gray-400 mb-4 flex items-center gap-1 active:opacity-70">
            &larr; Voltar ao Painel
          </button>
          
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center mb-6 shadow-sm">
            <span className="text-blue-200 text-sm font-medium">Selecione o ponto de abastecimento para registrar a parada</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 space-y-4 custom-scrollbar">
          {['Ponto 46', 'Ponto 3C', 'Ponto 3D', 'Ponto 82'].map(point => {
            const isActive = activeWaterPoint === point;
            return (
              <button
                key={point}
                onClick={() => {
                  if (isActive) {
                    confirmAction(`Parar Abastecimento (${point})`, 'bg-emerald-500', () => {
                      setActiveWaterPoint(null)
                      setWaterLoadStartTime(null)
                      localStorage.removeItem('app_motorista_water_point')
                      localStorage.removeItem('app_motorista_water_start')
                      
                      const tl = JSON.parse(localStorage.getItem('app_motorista_timeline') || '[]')
                      tl.push({ time: new Date().toISOString(), name: `Abastecimento de Água (${point})`, type: 'Finalizado', color: 'bg-emerald-500' })
                      localStorage.setItem('app_motorista_timeline', JSON.stringify(tl))
                      
                      handleStatusChange('operating')
                      setViewState('operating')
                    })
                  } else {
                    if (activeWaterPoint) {
                       alert('Já existe um carregamento em andamento.')
                       return
                    }
                    confirmAction(`Iniciar Abastecimento (${point})`, 'bg-blue-600', () => {
                      setActiveWaterPoint(point)
                      const start = new Date()
                      setWaterLoadStartTime(start)
                      localStorage.setItem('app_motorista_water_point', point)
                      localStorage.setItem('app_motorista_water_start', start.toISOString())

                      const tl = JSON.parse(localStorage.getItem('app_motorista_timeline') || '[]')
                      tl.push({ time: start.toISOString(), name: `Abastecimento de Água (${point})`, type: 'Iniciado', color: 'bg-blue-600' })
                      localStorage.setItem('app_motorista_timeline', JSON.stringify(tl))
                      
                      handleStatusChange(`Abastecimento - ${point}`, 'bg-blue-600')
                      setViewState('operating')
                    })
                  }
                }}
                className={`w-full relative overflow-hidden rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
                  isActive 
                    ? 'bg-blue-600 border border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)] scale-[1.02]' 
                    : 'bg-blue-500 border border-blue-600 text-white active:scale-[0.98]'
                }`}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-white/10 animate-pulse pointer-events-none"></div>
                )}
                
                <Droplet size={32} className={isActive ? 'text-white' : 'text-blue-100'} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-xl font-bold text-white">
                  {point}
                </span>
                
                {isActive && (
                  <div className="mt-1 text-blue-100 font-mono text-xl font-bold tracking-wider">
                    {waterLoadTime}
                  </div>
                )}
                {isActive && (
                   <div className="text-xs text-blue-200 mt-0.5 uppercase font-semibold">Carregando... (Toque para Parar)</div>
                )}
              </button>
            )
          })}
        </div>
        {renderConfirmModal()}
      </div>
    )
  }

  if (viewState === 'new_activity') {
    const activities = [
      { name: 'Lavagem Mirante', icon: Waves, color: 'bg-zinc-900 border border-zinc-800 text-white' },
      { name: 'Irrigação Carretel', icon: Droplet, color: 'bg-white border border-gray-200 text-gray-900' },
      { name: 'Irrigação Faixa 3, 4 e 5', icon: Sprout, color: 'bg-zinc-900 border border-zinc-800 text-white' },
      { name: 'Abastecimento do Tanque de Irrigação', icon: Fuel, color: 'bg-white border border-gray-200 text-gray-900' },
      { name: 'Lavagem Vertedouro', icon: Waves, color: 'bg-zinc-900 border border-zinc-800 text-white' },
      { name: 'Umectação de Vias', icon: CloudRain, color: 'bg-white border border-gray-200 text-gray-900' },
      { name: 'Lavagem de Carro', icon: Car, color: 'bg-zinc-900 border border-zinc-800 text-white' },
    ]

    return (
      <div className="min-h-full flex flex-col bg-[#0A0A0A] text-white pb-6 relative">
        <div className="p-6 pb-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Wrench size={22} className="text-gray-300" />
              Selecione o Serviço
            </h2>
            <button onClick={() => setViewState('operating')} className="text-gray-400 active:text-white p-2">
              <X size={24} />
            </button>
          </div>
          
          <p className="text-gray-400 text-sm mb-6 leading-snug">
            O serviço aparecerá na Parte Diária e será enviado ao grupo do WhatsApp.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-3 custom-scrollbar pb-24">
          {activeStatus !== 'operating' && activeStatus !== 'paused' && activeStatus !== 'waiting' && activeStatus !== 'raining' && (
            <button
              onClick={() => {
                confirmAction('Parar Atividade Atual', 'bg-red-500', () => {
                  handleStatusChange('operating')
                  setViewState('operating')
                })
              }}
              className="w-full bg-gray-800 dark:bg-zinc-800 rounded-2xl p-4 flex items-center gap-4 active:scale-[0.98] transition-transform shadow-sm mb-4 border border-gray-700"
            >
              <Square size={24} className="text-gray-300 shrink-0" />
              <span className="text-gray-200 font-bold text-left text-sm md:text-base leading-tight">
                Parar Atividade Atual
              </span>
            </button>
          )}

          {activities.map(act => {
            const isActive = activeStatus === act.name;
            return (
              <button
                key={act.name}
                onClick={() => {
                  const modalColor = act.color.includes('bg-white') ? 'bg-gray-900' : act.color.split(' ')[0]
                  confirmAction(act.name, modalColor, () => {
                    handleStatusChange(act.name, act.color)
                    setViewState('operating')
                  })
                }}
                className={`w-full ${isActive ? 'bg-red-600 text-white border-transparent' : act.color} rounded-2xl p-4 flex items-center gap-4 active:scale-[0.98] transition-transform shadow-sm ${isActive ? 'animate-pulse ring-2 ring-red-400 shadow-[0_0_20px_rgba(220,38,38,0.6)]' : ''}`}
              >
                <act.icon size={24} className="shrink-0" />
                <span className="font-bold text-left text-sm md:text-base leading-tight">
                  {act.name} {isActive && <span className="text-xs font-normal opacity-80 ml-2">(Em andamento)</span>}
                </span>
              </button>
            )
          })}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A] to-transparent">
          <button 
            onClick={() => setViewState('operating')}
            className="w-auto ml-auto px-6 py-3 bg-black border border-gray-800 rounded-2xl text-white font-bold text-sm block active:bg-gray-900 transition-colors"
          >
            Cancelar
          </button>
        </div>
        {renderConfirmModal()}
      </div>
    )
  }

  return (
    <div className="min-h-full flex flex-col bg-gray-50 dark:bg-zinc-950 pb-20">
      
      {/* HEADER WIDGET */}
      <div className={`${sColors.bg} ${sColors.text} p-6 rounded-b-[40px] shadow-xl mb-6 transition-colors duration-500`}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className={`${sColors.text} font-semibold text-xs tracking-wider uppercase mb-1 flex items-center gap-1.5 opacity-90`}>
              <div className={`w-2 h-2 rounded-full ${sColors.dot} ${activeStatus !== 'operating' ? 'animate-pulse' : ''}`}></div>
              {sColors.label}
            </div>
            <h1 className="text-2xl font-black leading-tight tracking-tight">
              {equipment.name}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <span className={`${sColors.text} opacity-80 font-medium text-sm`}>{equipment.type}</span>
              <span className={`${sColors.text} opacity-50`}>•</span>
              <MercosulPlate plate={equipment.plate_tag} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setViewState('history')} className={`w-12 h-12 ${sColors.text === 'text-white' ? 'bg-white/20 hover:bg-white/30' : 'bg-black/5 hover:bg-black/10'} rounded-2xl flex items-center justify-center backdrop-blur-md transition-colors`} title="Histórico">
              <History size={22} className={sColors.text} />
            </button>
            <button onClick={() => confirmAction('Deslogar', 'bg-red-600', handleLogout, 'Sair')} className={`w-12 h-12 ${sColors.text === 'text-white' ? 'bg-white/20 hover:bg-white/30' : 'bg-black/5 hover:bg-black/10'} rounded-2xl flex items-center justify-center backdrop-blur-md transition-colors`} title="Deslogar">
              <LogOut size={22} className={sColors.text} />
            </button>
          </div>
        </div>

        <div className={`${sColors.text === 'text-white' ? 'bg-white/10 border-white/20' : 'bg-black/5 border-black/10'} rounded-2xl p-4 backdrop-blur-md border`}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className={`${sColors.text} opacity-80 text-xs font-semibold mb-1`}>Início da Jornada</div>
              <div className="text-lg font-bold">
                {dispatch?.shift_start_time ? format(new Date(dispatch.shift_start_time), 'HH:mm') : '--:--'}
              </div>
            </div>
            <div>
              <div className={`${sColors.text} opacity-80 text-xs font-semibold mb-1`}>{sColors.timeLabel}</div>
              <div className="text-lg font-bold font-mono tracking-wider">{activeStatus !== 'operating' ? elapsedStatusTime : elapsedTime}</div>
            </div>
          </div>
          {dispatch?.helper_name && (
            <div className={`mt-3 pt-3 border-t ${sColors.text === 'text-white' ? 'border-white/10' : 'border-black/10'}`}>
              <div className={`${sColors.text} opacity-80 text-xs font-semibold mb-0.5`}>Ajudante</div>
              <div className="text-sm font-bold">{dispatch.helper_name}</div>
            </div>
          )}
        </div>
      </div>

      {activeWaterPoint && (
        <div className="px-6 mb-6">
          <button 
            onClick={() => setViewState('loading_water')}
            className="w-full bg-blue-600 rounded-3xl p-4 shadow-lg flex items-center justify-between active:scale-[0.98] transition-transform shadow-blue-500/30"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center animate-pulse">
                <Droplet size={24} className="text-white" strokeWidth={2.5} />
              </div>
              <div className="text-left">
                <div className="text-blue-100 text-[10px] font-bold uppercase tracking-wider mb-0.5">Abastecendo Água</div>
                <div className="text-white font-black text-lg leading-tight">{activeWaterPoint}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-blue-100 text-[10px] font-bold uppercase tracking-wider mb-0.5">
                Início: {waterLoadStartTime ? format(new Date(waterLoadStartTime), 'HH:mm') : '--:--'}
              </div>
              <div className="text-white font-black text-lg font-mono tracking-wider">{waterLoadTime}</div>
            </div>
          </button>
        </div>
      )}

      {/* QUICK ACTIONS GRID */}
      <div className="px-6 flex-1">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <History size={18} className="text-emerald-500" /> 
          Ações Operacionais
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <ActionButton 
            icon={ListTodo} 
            label="Nova Atividade" 
            color={{ bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400' }}
            onClick={() => setViewState('new_activity')}
          />
          
          {equipment.type?.toLowerCase().includes('pipa') && (
            <ActionButton 
              icon={Droplet} 
              label="Carregar Água" 
              color={{ bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400' }}
              onClick={() => setViewState('loading_water')}
            />
          )}

          <ActionButton 
            icon={Fuel} 
            label="Abastecer" 
            color={{ bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-600 dark:text-orange-400' }}
            onClick={() => confirmAction('Abastecer', 'bg-orange-500', () => alert('Modal Abastecer'))}
          />

          <ActionButton 
            icon={AlertOctagon} 
            label="Anomalia" 
            color={{ bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-600 dark:text-red-400' }}
            onClick={() => confirmAction('Registrar Anomalia', 'bg-red-500', () => alert('Modal Registrar Anomalia'))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <ActionButton 
            icon={activeStatus === 'paused' ? Play : Utensils} 
            label={activeStatus === 'paused' ? "Retomar" : "PAUSA/ALMOÇO"} 
            color={{ bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-600 dark:text-orange-400' }}
            onClick={() => confirmAction(
              activeStatus === 'paused' ? 'Retomar Operação' : 'Pausa / Almoço', 
              'bg-orange-500', 
              () => handleStatusChange(activeStatus === 'paused' ? 'operating' : 'paused')
            )}
          />

          <ActionButton 
            icon={activeStatus === 'waiting' ? Play : Clock} 
            label={activeStatus === 'waiting' ? "Retomar" : "AGUARDANDO"} 
            color={{ bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400' }}
            onClick={() => confirmAction(
              activeStatus === 'waiting' ? 'Retomar Operação' : 'Aguardar', 
              'bg-amber-500', 
              () => handleStatusChange(activeStatus === 'waiting' ? 'operating' : 'waiting')
            )}
          />
          
          <ActionButton 
            icon={activeStatus === 'raining' ? Play : CloudRain} 
            label={activeStatus === 'raining' ? "Retomar" : "CHUVA"} 
            color={{ bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400' }}
            onClick={() => confirmAction(
              activeStatus === 'raining' ? 'Retomar Operação' : 'Registrar Chuva', 
              'bg-blue-500', 
              () => handleStatusChange(activeStatus === 'raining' ? 'operating' : 'raining')
            )}
          />

          <ActionButton 
            icon={Square} 
            label="Finalizar Jornada" 
            color={{ bg: 'bg-red-600 dark:bg-red-600', text: 'text-white' }}
            onClick={() => confirmAction('Finalizar Jornada', 'bg-red-600', () => setViewState('finishing'))}
          />
        </div>
      </div>

      {renderConfirmModal()}
    </div>
  )
}
