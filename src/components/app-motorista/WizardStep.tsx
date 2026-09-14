import { useState } from 'react'
import { Users, Gauge, Droplet, ClipboardCheck, Camera, Loader2, ArrowLeftRight } from 'lucide-react'
import { saveOfflineFirst } from '../../lib/offline-sync'
import FuelGauge from './FuelGauge'

export default function WizardStep({ onFinish, onCancel }: { onFinish: () => void, onCancel: () => void }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

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
    // Validate critical checklist items
    const hasCriticalFail = checklist.some(item => item.critical && item.status === 'nao_conforme')
    if (hasCriticalFail) {
      alert('EQUIPAMENTO NÃO LIBERADO\nForam encontrados problemas em itens críticos (Freios, Pneus, etc). A operação não pode ser iniciada.')
      return
    }

    setLoading(true)
    try {
      const driverData = localStorage.getItem('app_motorista_driver')
      const driver = driverData ? JSON.parse(driverData) : null
      const userId = driver?.id || 'desconhecido'

      // 1. Create Dispatch (Jornada)
      const dispatchData = {
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
      const newDispatchId = dispatchRes.data?.[0]?.id || 'offline-id'

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
      localStorage.setItem('app_motorista_timeline', JSON.stringify([
        { time: nowISO, name: 'Jornada Iniciada', type: 'Início', color: 'bg-emerald-500' },
        { time: nowISO, name: 'Aguardando', type: 'Status Inicial', color: 'bg-amber-500' }
      ]))

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

    </div>
  )
}
