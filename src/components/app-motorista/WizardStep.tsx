import { useState } from 'react'
import { Users, Gauge, Droplet, ClipboardCheck, Camera, Loader2, ArrowLeftRight, AlertTriangle } from 'lucide-react'
import { saveOfflineFirst } from '../../lib/offline-sync'
import FuelGauge from './FuelGauge'

export default function WizardStep({ onFinish, onCancel }: { onFinish: () => void, onCancel: () => void }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Tire Selector State
  const [isTireModalOpen, setIsTireModalOpen] = useState(false)
  const [selectedTires, setSelectedTires] = useState<string[]>([])
  const [tireObservation, setTireObservation] = useState('')
  const [tireModalStep, setTireModalStep] = useState<'select' | 'obs'>('select')

  const equipmentId = localStorage.getItem('app_motorista_equipment_id')

  // Form Data
  const [helperName, setHelperName] = useState('')
  const [km, setKm] = useState(() => {
    const data = JSON.parse(localStorage.getItem('app_motorista_equipment_data') || '{}')
    return data[equipmentId || '']?.lastKm || ''
  })
  const [horimeter, setHorimeter] = useState(() => {
    const data = JSON.parse(localStorage.getItem('app_motorista_equipment_data') || '{}')
    return data[equipmentId || '']?.lastHorimeter || ''
  })
  const [fuel, setFuel] = useState(() => localStorage.getItem('app_motorista_fuel_level') || '100') // percentage

  // Mock checklist items
  const [checklist, setChecklist] = useState([
    { id: '1', name: 'Pneus', status: 'conforme', critical: true },
    { id: '2', name: 'Freios', status: 'conforme', critical: true },
    { id: '3', name: 'Faróis', status: 'conforme', critical: false },
    { id: '4', name: 'Buzina', status: 'conforme', critical: false },
  ])

  const handleNext = () => setStep(prev => prev + 1)
  const handlePrev = () => setStep(prev => prev - 1)

  const handleStartShift = async () => {
    // Validate critical checklist items (Allow 'Pneus' if they recorded the anomaly, or just don't block for 'Pneus')
    const hasCriticalFail = checklist.some(item => item.critical && item.status === 'nao_conforme' && item.name !== 'Pneus')
    if (hasCriticalFail) {
      alert('EQUIPAMENTO NÃO LIBERADO\nForam encontrados problemas em itens críticos (Freios, etc). A operação não pode ser iniciada.')
      return
    }

    setLoading(true)
    try {
      const driverData = localStorage.getItem('app_motorista_driver')
      const driver = driverData ? JSON.parse(driverData) : null
      const userId = driver?.id || 'desconhecido'

      // 1. Create Dispatch (Jornada)
      const dispatchId = crypto.randomUUID()
      const dispatchData = {
        id: dispatchId,
        equipment_id: equipmentId,
        driver_id: userId,
        helper_name: helperName,
        odometer_start: km ? parseFloat(km) : null,
        horimeter_start: horimeter ? parseFloat(horimeter) : null,
        fuel_start_percent: parseInt(fuel),
        shift_start_time: new Date().toISOString(),
        status: 'Em atividade'
      }
      
      const dispatchRes = await saveOfflineFirst('eq_driver_dispatch', 'INSERT', dispatchData)
      // Se online result é array. Se offline result.data é o próprio dispatchData.
      const newDispatchId = (Array.isArray(dispatchRes.data) ? dispatchRes.data[0]?.id : dispatchRes.data?.id) || dispatchId


      // 2. Create Checklist
      const checklistData = {
        dispatch_id: newDispatchId,
        equipment_id: equipmentId,
        driver_id: userId,
        type: 'pre-operacional',
        status: 'aprovado'
      }
      const checkRes = await saveOfflineFirst('eq_checklists', 'INSERT', checklistData)
      const newCheckId = checkRes.data?.[0]?.id || 'offline-check-id'

      // 3. Update Equipment status to "Operando" (actually handled by backend or we update it directly)
      await saveOfflineFirst('eq_equipments', 'UPDATE', { id: equipmentId, location_status: 'inside' })

      // Save local cache for dashboard if offline
      localStorage.setItem('app_motorista_current_dispatch', JSON.stringify({ ...dispatchData, id: newDispatchId }))

      // Define o status inicial como 'Aguardando'
      const nowISO = new Date().toISOString()
      localStorage.setItem('app_motorista_active_status', 'waiting')
      localStorage.setItem('app_motorista_status_start', nowISO)
      
      // Inicializa o Histórico (Timeline)
      const initialTimeline = [
        { time: nowISO, name: 'Jornada Iniciada', type: 'Início', color: 'bg-emerald-500' },
        { time: nowISO, name: 'Aguardando', type: 'Status Inicial', color: 'bg-amber-500' }
      ]

      if (selectedTires.length > 0) {
        const obsText = tireObservation ? ` - Obs: ${tireObservation}` : ''
        initialTimeline.push({
          time: nowISO,
          name: `Anomalia Pneus: ${selectedTires.join(', ')}${obsText}`,
          type: 'Anomalia',
          color: 'bg-red-500'
        })
        
        await saveOfflineFirst('eq_status_history', 'INSERT', {
          dispatch_id: newDispatchId,
          equipment_id: equipmentId,
          driver_id: userId,
          previous_status: 'Jornada Iniciada',
          new_status: `Anomalia Pneus: ${selectedTires.join(', ')}${obsText}`,
          created_at: nowISO
        })
      }

      const otherAnomalies = checklist.filter(item => item.status === 'nao_conforme' && item.name !== 'Pneus')
      for (const item of otherAnomalies) {
        initialTimeline.push({
          time: nowISO,
          name: `Anomalia Checklist: ${item.name}`,
          type: 'Anomalia',
          color: 'bg-red-500'
        })
        await saveOfflineFirst('eq_status_history', 'INSERT', {
          dispatch_id: newDispatchId,
          equipment_id: equipmentId,
          driver_id: userId,
          previous_status: 'Jornada Iniciada',
          new_status: `Anomalia Checklist: ${item.name}`,
          created_at: nowISO
        })
      }

      localStorage.setItem('app_motorista_timeline', JSON.stringify(initialTimeline))

      await saveOfflineFirst('eq_status_history', 'INSERT', {
        dispatch_id: newDispatchId,
        equipment_id: equipmentId,
        driver_id: userId,
        previous_status: 'Jornada Iniciada',
        new_status: 'Aguardando',
        created_at: nowISO
      })

      localStorage.setItem('app_motorista_fuel_level', fuel)
      localStorage.setItem('app_motorista_current_step', 'dashboard')
      onFinish()
    } catch (err) {
      console.error(err)
      alert('Erro ao iniciar jornada.')
    } finally {
      setLoading(false)
    }
  }

  const updateChecklist = (id: string, status: string) => {
    const item = checklist.find(i => i.id === id)
    if (item?.name === 'Pneus' && status === 'nao_conforme') {
      setIsTireModalOpen(true)
    }
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, status } : item))
  }

  return (
    <div className="min-h-full flex flex-col p-6 bg-gray-50 dark:bg-zinc-950">
      
      {/* HEADER WIZARD */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={step === 1 ? undefined : handlePrev} className={`text-sm font-semibold flex items-center gap-1 ${step === 1 ? 'opacity-0 pointer-events-none' : 'text-gray-500'}`}>
          &larr; Voltar
        </button>
        <div className="flex gap-2 ml-4">
          {[1,2,3].map(i => (
            <div key={i} className={`w-2 h-2 rounded-full ${step >= i ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-zinc-700'}`} />
          ))}
        </div>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 dark:hover:text-white dark:text-gray-400 p-2 flex items-center justify-center rounded-full active:bg-gray-200 dark:active:bg-zinc-800 transition-colors" title="Trocar Equipamento">
          <ArrowLeftRight size={20} />
        </button>
      </div>

      {/* STEP 1: TEAM */}
      {step === 1 && (
        <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Users size={24} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">IDENTIFICAÇÃO <br/>DA EQUIPE</h2>
          </div>
          
          <div className="space-y-6 flex-1">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Nome do Ajudante (Opcional)</label>
              <input 
                type="text" 
                value={helperName}
                onChange={e => setHelperName(e.target.value)}
                placeholder="Ex: Carlos Silva"
                className="w-full h-14 px-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
              />
            </div>
          </div>

          <button onClick={handleNext} className="w-full h-14 bg-gray-900 dark:bg-white text-white dark:text-black font-bold text-lg rounded-2xl mt-4 active:scale-[0.98] transition-transform">
            AVANÇAR
          </button>
        </div>
      )}

      {/* STEP 2: DATA */}
      {step === 2 && (
        <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Gauge size={24} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">DADOS <br/>INICIAIS</h2>
          </div>

          <div className="space-y-6 flex-1 overflow-y-auto pb-8 custom-scrollbar">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">KM Inicial</label>
              <input 
                type="number" 
                value={km}
                onChange={e => setKm(e.target.value)}
                placeholder="Ex: 125487"
                className="w-full h-14 px-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
              {(() => {
                const data = JSON.parse(localStorage.getItem('app_motorista_equipment_data') || '{}')
                const lastKm = data[equipmentId || '']?.lastKm
                return lastKm ? <p className="text-[10px] text-gray-400 mt-1 ml-1">Último registrado: {lastKm}</p> : null
              })()}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Horímetro Inicial</label>
              <input 
                type="number" 
                value={horimeter}
                onChange={e => setHorimeter(e.target.value)}
                placeholder="Ex: 7542.3"
                className="w-full h-14 px-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
              {(() => {
                const data = JSON.parse(localStorage.getItem('app_motorista_equipment_data') || '{}')
                const lastH = data[equipmentId || '']?.lastHorimeter
                return lastH ? <p className="text-[10px] text-gray-400 mt-1 ml-1">Último registrado: {lastH}</p> : null
              })()}
            </div>

            <div className="pt-2 pb-4">
              <FuelGauge value={fuel} onChange={setFuel} />
            </div>

            <button className="w-full h-14 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-2xl flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 font-semibold active:bg-gray-100 dark:active:bg-zinc-800 transition-colors">
              <Camera size={20} />
              Fotografar Painel
            </button>
          </div>

          <button onClick={handleNext} className="w-full h-14 bg-gray-900 dark:bg-white text-white dark:text-black font-bold text-lg rounded-2xl mt-4 active:scale-[0.98] transition-transform">
            AVANÇAR
          </button>
        </div>
      )}

      {/* STEP 3: CHECKLIST */}
      {step === 3 && (
        <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <ClipboardCheck size={24} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">CHECKLIST <br/>PRÉ-OPERACIONAL</h2>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pb-8 custom-scrollbar">
            {checklist.map(item => (
              <div key={item.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    {item.name}
                    {item.critical && <span className="text-[10px] uppercase font-bold text-red-500 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded">Crítico</span>}
                  </h4>
                </div>
                <div className="flex bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-hidden">
                  <button 
                    onClick={() => updateChecklist(item.id, 'conforme')}
                    className={`px-4 py-2 text-xl transition-colors ${item.status === 'conforme' ? 'bg-emerald-500 text-white' : 'text-gray-400 grayscale'}`}
                  >
                    ✅
                  </button>
                  <button 
                    onClick={() => updateChecklist(item.id, 'nao_conforme')}
                    className={`px-4 py-2 text-xl transition-colors ${item.status === 'nao_conforme' ? 'bg-red-500 text-white' : 'text-gray-400 grayscale opacity-40'}`}
                  >
                    ❌
                  </button>
                  <button 
                    onClick={() => updateChecklist(item.id, 'nao_se_aplica')}
                    className={`px-4 py-2 text-xl transition-colors ${item.status === 'nao_se_aplica' ? 'bg-gray-500 text-white' : 'text-gray-400 grayscale opacity-40'}`}
                  >
                    ➖
                  </button>
                </div>
              </div>
            ))}

            <div className="pt-4 px-2 text-sm text-gray-500 text-center">
              Declaro que realizei a inspeção pré-operacional conforme procedimentos vigentes.
            </div>
          </div>

          <button onClick={handleStartShift} disabled={loading} className="w-full h-14 bg-emerald-500 text-white font-bold text-lg rounded-2xl mt-4 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 active:scale-[0.98] transition-transform">
            {loading ? <Loader2 className="animate-spin" size={24} /> : 'INICIAR OPERAÇÃO'}
          </button>
        </div>
      )}

      {/* TIRE SELECTOR MODAL */}
      {isTireModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="p-6 pb-2 border-b border-gray-100 dark:border-zinc-800">
              <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="text-red-500" /> Relatar Problema
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {tireModalStep === 'select' ? 'Toque nos pneus que estão secos ou furados.' : 'Adicione uma observação sobre os pneus (opcional).'}
              </p>
            </div>
            
            {tireModalStep === 'select' ? (
              <div className="p-6 flex-1 overflow-y-auto flex justify-center bg-gray-50 dark:bg-zinc-950/50">
                <div className="relative w-48 h-80 bg-gray-200 dark:bg-zinc-800 rounded-3xl border-4 border-gray-300 dark:border-zinc-700 shadow-inner">
                  {/* Chassis Line */}
                  <div className="absolute left-1/2 top-4 bottom-4 w-4 -ml-2 bg-gray-400 dark:bg-zinc-600 rounded-full opacity-30"></div>
                  
                  {/* Cab */}
                  <div className="absolute top-2 left-6 right-6 h-20 bg-gray-300 dark:bg-zinc-700 rounded-t-2xl rounded-b-md opacity-50"></div>
  
                  {[
                    { id: 'DE', x: -12, y: 8, label: 'Esq' },
                    { id: 'DD', x: 95, y: 8, label: 'Dir' },
                    { id: 'TEE', x: -21, y: 48, label: 'E-Ext' },
                    { id: 'TEI', x: -4, y: 48, label: 'E-Int' },
                    { id: 'TDI', x: 87, y: 48, label: 'D-Int' },
                    { id: 'TDE', x: 104, y: 48, label: 'D-Ext' },
                    { id: 'TREE', x: -21, y: 73, label: 'E-Ext' },
                    { id: 'TREI', x: -4, y: 73, label: 'E-Int' },
                    { id: 'TRDI', x: 87, y: 73, label: 'D-Int' },
                    { id: 'TRDE', x: 104, y: 73, label: 'D-Ext' },
                  ].map((tire) => {
                    const isSelected = selectedTires.includes(tire.id);
                    return (
                      <button
                        key={tire.id}
                        onClick={() => setSelectedTires(prev => prev.includes(tire.id) ? prev.filter(t => t !== tire.id) : [...prev, tire.id])}
                        className={`absolute w-8 h-14 rounded-lg flex flex-col items-center justify-center transition-all shadow-md ${
                          isSelected 
                            ? 'bg-red-500 scale-110 shadow-red-500/50 z-10 border-2 border-red-700' 
                            : 'bg-gray-800 dark:bg-black border-2 border-gray-900 dark:border-zinc-900'
                        }`}
                        style={{ 
                          left: `${tire.x}%`, 
                          top: `${tire.y}%`,
                        }}
                        title={tire.id}
                      >
                        {/* Treads */}
                        <div className="w-full h-1 bg-black/20 my-0.5"></div>
                        <div className="w-full h-1 bg-black/20 my-0.5"></div>
                        <div className="w-full h-1 bg-black/20 my-0.5"></div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="p-6 flex-1 flex flex-col bg-gray-50 dark:bg-zinc-950/50 min-h-[200px]">
                <textarea
                  className="w-full flex-1 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none text-gray-700 dark:text-gray-200"
                  placeholder="Ex: Pneu dianteiro direito rasgado..."
                  value={tireObservation}
                  onChange={(e) => setTireObservation(e.target.value)}
                />
              </div>
            )}

            <div className="p-6 border-t border-gray-100 dark:border-zinc-800 flex gap-3 bg-white dark:bg-zinc-900">
              <button 
                onClick={() => {
                  if (tireModalStep === 'obs') {
                    setTireModalStep('select')
                  } else {
                    setIsTireModalOpen(false)
                    if (selectedTires.length === 0) {
                       setChecklist(prev => prev.map(item => item.name === 'Pneus' ? { ...item, status: 'conforme' } : item))
                    }
                  }
                }}
                className="flex-1 py-4 font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 rounded-2xl active:scale-[0.98] transition-all"
              >
                {tireModalStep === 'obs' ? 'Voltar' : 'Cancelar'}
              </button>
              <button 
                onClick={() => {
                  if (tireModalStep === 'select') {
                    if (selectedTires.length === 0) {
                      alert('Selecione pelo menos um pneu com defeito, ou cancele.');
                      return;
                    }
                    setTireModalStep('obs')
                  } else {
                    setIsTireModalOpen(false)
                    setTireModalStep('select')
                  }
                }}
                className="flex-1 py-4 font-bold text-white bg-red-500 rounded-2xl active:scale-[0.98] transition-all shadow-lg shadow-red-500/30"
              >
                {tireModalStep === 'select' ? 'Avançar' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
