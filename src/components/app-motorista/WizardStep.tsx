import { useState } from 'react'
import { Users, Gauge, Droplet, ClipboardCheck, Camera, Loader2, ArrowLeftRight, AlertTriangle } from 'lucide-react'
import { getWhatsappSettings } from '../../lib/settings'
import { sendWhatsappTextOnServer } from '../../lib/whatsapp-api'
import { format } from 'date-fns'
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

  // Brakes State
  const [isBrakesModalOpen, setIsBrakesModalOpen] = useState(false)
  const [brakesObservation, setBrakesObservation] = useState('')

  // Horn State
  const [isHornModalOpen, setIsHornModalOpen] = useState(false)
  const [hornObservation, setHornObservation] = useState('')

  // Lights State
  const [isLightsModalOpen, setIsLightsModalOpen] = useState(false)
  const [lightsIssues, setLightsIssues] = useState<string[]>([])
  const [lightsObservation, setLightsObservation] = useState('')

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
      const hasAnomalies = checklist.some(item => item.status === 'nao_conforme')
      const checklistData = {
        dispatch_id: newDispatchId,
        equipment_id: equipmentId,
        driver_id: userId,
        type: 'pre-operacional',
        status: hasAnomalies ? 'aprovado_com_ressalvas' : 'aprovado',
        created_at: new Date().toISOString()
      }
      const checkRes = await saveOfflineFirst('eq_checklists', 'INSERT', checklistData)
      const newChecklistId = (Array.isArray(checkRes.data) ? checkRes.data[0]?.id : checkRes.data?.id) || crypto.randomUUID()

      // 2.1 Insert Checklist Items
      for (const item of checklist) {
        await saveOfflineFirst('eq_checklist_items', 'INSERT', {
          checklist_id: newChecklistId,
          item_name: item.name,
          is_critical: item.critical,
          status: item.status,
          observation: item.name === 'Pneus' ? tireObservation : ''
        })
      }

      // 3. Update Equipment status to "Operando" (actually handled by backend or we update it directly)
      await saveOfflineFirst('eq_equipments', 'UPDATE', { id: equipmentId, location_status: 'inside' })

      // Save local cache for dashboard if offline
      localStorage.setItem('app_motorista_current_dispatch', JSON.stringify({ ...dispatchData, id: newDispatchId }))

      // Define o status inicial como 'Aguardando'
      const nowISO = new Date().toISOString()

      // === LIMPAR TODOS OS DADOS DO TURNO ANTERIOR ===
      localStorage.removeItem('app_motorista_timeline')
      localStorage.removeItem('app_motorista_active_status')
      localStorage.removeItem('app_motorista_active_status_color')
      localStorage.removeItem('app_motorista_status_start')
      localStorage.removeItem('app_motorista_water_point')
      localStorage.removeItem('app_motorista_water_start')
      // ===============================================

      localStorage.setItem('app_motorista_active_status', 'waiting')
      localStorage.setItem('app_motorista_status_start', nowISO)
      
      // Inicializa o Histórico (Timeline) limpo para o novo turno
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

        const anomalyId = crypto.randomUUID()
        await saveOfflineFirst('eq_anomalies', 'INSERT', {
          id: anomalyId,
          equipment_id: equipmentId,
          driver_id: userId,
          anomaly_type: 'Pneu',
          description: `Pneus selecionados: ${selectedTires.join(', ')}`,
          observation: tireObservation,
          status: 'Pendente',
          reported_at: nowISO
        })

        const activeAnomalies = JSON.parse(localStorage.getItem('app_motorista_active_anomalies') || '[]')
        activeAnomalies.push({ id: anomalyId, type: 'Pneu', description: `Pneus selecionados: ${selectedTires.join(', ')}` })
        localStorage.setItem('app_motorista_active_anomalies', JSON.stringify(activeAnomalies))

        // --- DISPARO WHATSAPP PNEUS ---
        if (navigator.onLine) {
          try {
            const wSettings = await getWhatsappSettings()
            if (wSettings.appMotoristaAlerts?.enabled !== false) {
              const targetPhone = wSettings.appMotoristaAlerts?.specificGroupId || wSettings.groupId
              if (wSettings.url && wSettings.token && wSettings.instanceId && targetPhone && wSettings.messageTemplates?.anomaliaRegistrada) {
                let text = wSettings.messageTemplates.anomaliaRegistrada
                text = text.replace('{hora}', format(new Date(), 'HH:mm'))
                text = text.replace('{equipamento}', equipment?.name || equipment?.type || '-')
                text = text.replace('{tag}', equipment?.name || '-')
                text = text.replace('{placa}', equipment?.plate_tag || '-')
                text = text.replace('{anomalia}', 'Pneus')
                text = text.replace('{descricao}', `Pneus selecionados: ${selectedTires.join(', ')} ${tireObservation ? '- Obs: ' + tireObservation : ''}`)
                const driverData = localStorage.getItem('app_motorista_driver')
                const driverName = driverData ? JSON.parse(driverData).name : 'Motorista'
                text = text.replace('{motorista}', driverName)

                sendWhatsappTextOnServer({
                  data: {
                    url: wSettings.url,
                    token: wSettings.token,
                    instanceId: wSettings.instanceId,
                    phone: targetPhone,
                    text
                  }
                }).catch(e => console.error('Erro WP', e))
              }
            }
          } catch (e) {}
        }
        // -----------------------------
      }

      const otherAnomalies = checklist.filter(item => item.status === 'nao_conforme' && item.name !== 'Pneus')
      for (const item of otherAnomalies) {
        // Build detailed description per item type
        let anomalyType = item.name
        let anomalyDesc = ''
        if (item.name === 'Freios') {
          anomalyType = 'Freios'
          anomalyDesc = brakesObservation || 'Problema nos freios relatado no check-list'
        } else if (item.name === 'Buzina') {
          anomalyType = 'Buzina'
          anomalyDesc = hornObservation || 'Problema na buzina relatado no check-list'
        } else if (item.name === 'Faróis') {
          anomalyType = 'Faróis'
          anomalyDesc = lightsIssues.length > 0
            ? `Peças com problema: ${lightsIssues.join(', ')}${lightsObservation ? ` - ${lightsObservation}` : ''}`
            : lightsObservation || 'Problema nos faróis relatado no check-list'
        } else {
          anomalyDesc = `Item reprovado: ${item.name}`
        }

        const statusLabel = lightsIssues.length > 0 && item.name === 'Faróis'
          ? `Anomalia Checklist: Faróis - ${lightsIssues.join(', ')}`
          : `Anomalia Checklist: ${item.name}`

        initialTimeline.push({
          time: nowISO,
          name: statusLabel,
          type: 'Anomalia',
          color: 'bg-red-500'
        })
        await saveOfflineFirst('eq_status_history', 'INSERT', {
          dispatch_id: newDispatchId,
          equipment_id: equipmentId,
          driver_id: userId,
          previous_status: 'Jornada Iniciada',
          new_status: statusLabel,
          created_at: nowISO
        })

        const anomalyId = crypto.randomUUID()
        await saveOfflineFirst('eq_anomalies', 'INSERT', {
          id: anomalyId,
          equipment_id: equipmentId,
          driver_id: userId,
          anomaly_type: anomalyType,
          description: anomalyDesc,
          status: 'Pendente',
          reported_at: nowISO
        })

        const activeAnomalies = JSON.parse(localStorage.getItem('app_motorista_active_anomalies') || '[]')
        activeAnomalies.push({ id: anomalyId, type: anomalyType, description: anomalyDesc })
        localStorage.setItem('app_motorista_active_anomalies', JSON.stringify(activeAnomalies))

        // --- DISPARO WHATSAPP CHECKLIST ---
        if (navigator.onLine) {
          try {
            const wSettings = await getWhatsappSettings()
            if (wSettings.appMotoristaAlerts?.enabled !== false) {
              const targetPhone = wSettings.appMotoristaAlerts?.specificGroupId || wSettings.groupId
              if (wSettings.url && wSettings.token && wSettings.instanceId && targetPhone && wSettings.messageTemplates?.anomaliaRegistrada) {
                let text = wSettings.messageTemplates.anomaliaRegistrada
                text = text.replace('{hora}', format(new Date(), 'HH:mm'))
                text = text.replace('{equipamento}', equipment?.name || equipment?.type || '-')
                text = text.replace('{tag}', equipment?.name || '-')
                text = text.replace('{placa}', equipment?.plate_tag || '-')
                text = text.replace('{anomalia}', anomalyType)
                text = text.replace('{descricao}', anomalyDesc)
                const driverData = localStorage.getItem('app_motorista_driver')
                const driverName = driverData ? JSON.parse(driverData).name : 'Motorista'
                text = text.replace('{motorista}', driverName)

                sendWhatsappTextOnServer({
                  data: {
                    url: wSettings.url,
                    token: wSettings.token,
                    instanceId: wSettings.instanceId,
                    phone: targetPhone,
                    text
                  }
                }).catch(e => console.error('Erro WP', e))
              }
            }
          } catch (e) {}
        }
        // -----------------------------
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
    if (item?.name === 'Pneus') {
      if (status === 'nao_conforme') setIsTireModalOpen(true)
      if (status === 'conforme') {
        setSelectedTires([])
        setTireObservation('')
      }
    }
    if (item?.name === 'Freios') {
      if (status === 'nao_conforme') setIsBrakesModalOpen(true)
      if (status === 'conforme') setBrakesObservation('')
    }
    if (item?.name === 'Buzina') {
      if (status === 'nao_conforme') setIsHornModalOpen(true)
      if (status === 'conforme') setHornObservation('')
    }
    if (item?.name === 'Faróis') {
      if (status === 'nao_conforme') setIsLightsModalOpen(true)
      if (status === 'conforme') {
        setLightsIssues([])
        setLightsObservation('')
      }
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
                        className={`absolute w-8 h-14 rounded-lg flex flex-col items-center justify-center transition-all shadow-md ${ isSelected ? 'bg-red-500 scale-110 shadow-red-500/50 z-10 border-2 border-red-700' : 'bg-gray-800 dark:bg-black border-2 border-gray-900 dark:border-zinc-900' }`}
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
                    setSelectedTires([])
                    setTireObservation('')
                    setChecklist(prev => prev.map(item => item.name === 'Pneus' ? { ...item, status: 'conforme' } : item))
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

      {/* BRAKES MODAL */}
      {isBrakesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] w-full max-w-sm overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 pb-2 border-b border-gray-100 dark:border-zinc-800">
              <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="text-red-500" /> Freios com Problema
              </h3>
              <p className="text-sm text-gray-500 mt-1">Descreva o que está acontecendo com os freios.</p>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-zinc-950/50">
              <textarea
                className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none text-gray-700 dark:text-gray-200 h-32"
                placeholder="Ex: Pedal mole, barulho ao frear, freio travando..."
                value={brakesObservation}
                onChange={(e) => setBrakesObservation(e.target.value)}
                autoFocus
              />
            </div>
            <div className="p-6 border-t border-gray-100 dark:border-zinc-800 flex gap-3 bg-white dark:bg-zinc-900">
              <button
                onClick={() => {
                  setIsBrakesModalOpen(false)
                  setBrakesObservation('')
                  setChecklist(prev => prev.map(item => item.name === 'Freios' ? { ...item, status: 'conforme' } : item))
                }}
                className="flex-1 py-4 font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 rounded-2xl active:scale-[0.98] transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!brakesObservation.trim()) {
                    alert('Por favor, descreva o problema nos freios.')
                    return
                  }
                  setIsBrakesModalOpen(false)
                }}
                className="flex-1 py-4 font-bold text-white bg-red-500 rounded-2xl active:scale-[0.98] transition-all shadow-lg shadow-red-500/30"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HORN MODAL */}
      {isHornModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] w-full max-w-sm overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 pb-2 border-b border-gray-100 dark:border-zinc-800">
              <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="text-red-500" /> Buzina com Problema
              </h3>
              <p className="text-sm text-gray-500 mt-1">Descreva o que está acontecendo com a buzina.</p>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-zinc-950/50">
              <textarea
                className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none text-gray-700 dark:text-gray-200 h-32"
                placeholder="Ex: Buzina não funciona, som fraco, travada..."
                value={hornObservation}
                onChange={(e) => setHornObservation(e.target.value)}
                autoFocus
              />
            </div>
            <div className="p-6 border-t border-gray-100 dark:border-zinc-800 flex gap-3 bg-white dark:bg-zinc-900">
              <button
                onClick={() => {
                  setIsHornModalOpen(false)
                  setHornObservation('')
                  setChecklist(prev => prev.map(item => item.name === 'Buzina' ? { ...item, status: 'conforme' } : item))
                }}
                className="flex-1 py-4 font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 rounded-2xl active:scale-[0.98] transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!hornObservation.trim()) {
                    alert('Por favor, descreva o problema na buzina.')
                    return
                  }
                  setIsHornModalOpen(false)
                }}
                className="flex-1 py-4 font-bold text-white bg-red-500 rounded-2xl active:scale-[0.98] transition-all shadow-lg shadow-red-500/30"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTS MODAL */}
      {isLightsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 pb-4 border-b border-gray-100 dark:border-zinc-800">
              <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="text-yellow-500" /> Faróis com Problema
              </h3>
              <p className="text-sm text-gray-500 mt-1">Toque nas peças que estão com defeito ou queimadas.</p>
            </div>

            <div className="p-4 flex-1 overflow-y-auto bg-gray-50 dark:bg-zinc-950/50">
              {/* FRONT */}
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 text-center">Frente do Caminhão</p>
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-gray-100 dark:border-zinc-800 mb-4">
                {/* Truck front drawing */}
                <div className="relative flex justify-center items-end mb-3">
                  {/* cab shape */}
                  <div className="w-36 h-16 bg-gray-200 dark:bg-zinc-700 rounded-t-2xl rounded-b-md flex items-end justify-between px-1 pb-1">
                    {/* left headlight area */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setLightsIssues(prev => prev.includes('Farol Esquerdo (Frente)') ? prev.filter(x => x !== 'Farol Esquerdo (Frente)') : [...prev, 'Farol Esquerdo (Frente)'])}
                        className={`w-8 h-4 rounded-sm text-[9px] font-bold transition-all ${ lightsIssues.includes('Farol Esquerdo (Frente)') ? 'bg-red-500 text-white' : 'bg-yellow-300 text-yellow-900' }`}
                        title="Farol Esquerdo Frente"
                      >FE</button>
                      <button
                        onClick={() => setLightsIssues(prev => prev.includes('Pisca Esquerdo (Frente)') ? prev.filter(x => x !== 'Pisca Esquerdo (Frente)') : [...prev, 'Pisca Esquerdo (Frente)'])}
                        className={`w-8 h-3 rounded-sm text-[8px] font-bold transition-all ${ lightsIssues.includes('Pisca Esquerdo (Frente)') ? 'bg-red-500 text-white' : 'bg-orange-300 text-orange-900' }`}
                        title="Pisca Esquerdo Frente"
                      >PE</button>
                    </div>
                    {/* center grill */}
                    <div className="flex-1 mx-1 h-8 bg-gray-300 dark:bg-zinc-600 rounded flex items-center justify-center">
                      <div className="grid grid-cols-3 gap-0.5">
                        {Array.from({length:6}).map((_,i) => <div key={i} className="w-1.5 h-2 bg-gray-400 dark:bg-zinc-500 rounded-sm"/>)}
                      </div>
                    </div>
                    {/* right headlight area */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setLightsIssues(prev => prev.includes('Farol Direito (Frente)') ? prev.filter(x => x !== 'Farol Direito (Frente)') : [...prev, 'Farol Direito (Frente)'])}
                        className={`w-8 h-4 rounded-sm text-[9px] font-bold transition-all ${ lightsIssues.includes('Farol Direito (Frente)') ? 'bg-red-500 text-white' : 'bg-yellow-300 text-yellow-900' }`}
                        title="Farol Direito Frente"
                      >FD</button>
                      <button
                        onClick={() => setLightsIssues(prev => prev.includes('Pisca Direito (Frente)') ? prev.filter(x => x !== 'Pisca Direito (Frente)') : [...prev, 'Pisca Direito (Frente)'])}
                        className={`w-8 h-3 rounded-sm text-[8px] font-bold transition-all ${ lightsIssues.includes('Pisca Direito (Frente)') ? 'bg-red-500 text-white' : 'bg-orange-300 text-orange-900' }`}
                        title="Pisca Direito Frente"
                      >PD</button>
                    </div>
                  </div>
                </div>
                {/* Legend front */}
                <div className="flex flex-wrap gap-1.5 justify-center text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-3 h-2 bg-yellow-300 rounded inline-block"/> Farol</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-2 bg-orange-300 rounded inline-block"/> Pisca</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-500 rounded inline-block"/> Queimado/Defeito</span>
                </div>
              </div>

              {/* REAR */}
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 text-center">Traseira do Caminhão</p>
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-gray-100 dark:border-zinc-800 mb-4">
                <div className="relative flex justify-center items-end mb-3">
                  <div className="w-36 h-14 bg-gray-200 dark:bg-zinc-700 rounded-xl flex items-center justify-between px-1">
                    {/* left rear */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setLightsIssues(prev => prev.includes('Lanterna Esquerda (Traseira)') ? prev.filter(x => x !== 'Lanterna Esquerda (Traseira)') : [...prev, 'Lanterna Esquerda (Traseira)'])}
                        className={`w-8 h-5 rounded-sm text-[8px] font-bold transition-all ${ lightsIssues.includes('Lanterna Esquerda (Traseira)') ? 'bg-red-500 text-white' : 'bg-red-300 text-red-900' }`}
                        title="Lanterna Esquerda Traseira"
                      >LE</button>
                      <button
                        onClick={() => setLightsIssues(prev => prev.includes('Pisca Esquerdo (Traseira)') ? prev.filter(x => x !== 'Pisca Esquerdo (Traseira)') : [...prev, 'Pisca Esquerdo (Traseira)'])}
                        className={`w-8 h-3 rounded-sm text-[8px] font-bold transition-all ${ lightsIssues.includes('Pisca Esquerdo (Traseira)') ? 'bg-red-500 text-white' : 'bg-orange-300 text-orange-900' }`}
                        title="Pisca Esquerdo Traseira"
                      >PE</button>
                    </div>
                    {/* center bar */}
                    <div className="flex-1 mx-1 h-3 bg-gray-300 dark:bg-zinc-600 rounded"/>
                    {/* right rear */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setLightsIssues(prev => prev.includes('Lanterna Direita (Traseira)') ? prev.filter(x => x !== 'Lanterna Direita (Traseira)') : [...prev, 'Lanterna Direita (Traseira)'])}
                        className={`w-8 h-5 rounded-sm text-[8px] font-bold transition-all ${ lightsIssues.includes('Lanterna Direita (Traseira)') ? 'bg-red-500 text-white' : 'bg-red-300 text-red-900' }`}
                        title="Lanterna Direita Traseira"
                      >LD</button>
                      <button
                        onClick={() => setLightsIssues(prev => prev.includes('Pisca Direito (Traseira)') ? prev.filter(x => x !== 'Pisca Direito (Traseira)') : [...prev, 'Pisca Direito (Traseira)'])}
                        className={`w-8 h-3 rounded-sm text-[8px] font-bold transition-all ${ lightsIssues.includes('Pisca Direito (Traseira)') ? 'bg-red-500 text-white' : 'bg-orange-300 text-orange-900' }`}
                        title="Pisca Direito Traseira"
                      >PD</button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-300 rounded inline-block"/> Lanterna</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-2 bg-orange-300 rounded inline-block"/> Pisca</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-500 rounded inline-block"/> Defeito</span>
                </div>
              </div>

              {/* Observation */}
              {lightsIssues.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Peças selecionadas: <span className="text-red-500 font-semibold">{lightsIssues.join(', ')}</span></p>
                  <textarea
                    className="w-full p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none text-gray-700 dark:text-gray-200 h-20 text-sm"
                    placeholder="Observação adicional (opcional)..."
                    value={lightsObservation}
                    onChange={(e) => setLightsObservation(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-zinc-800 flex gap-3 bg-white dark:bg-zinc-900">
              <button
                onClick={() => {
                  setIsLightsModalOpen(false)
                  setLightsIssues([])
                  setLightsObservation('')
                  setChecklist(prev => prev.map(item => item.name === 'Faróis' ? { ...item, status: 'conforme' } : item))
                }}
                className="flex-1 py-4 font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 rounded-2xl active:scale-[0.98] transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (lightsIssues.length === 0) {
                    alert('Selecione pelo menos uma peça com defeito, ou cancele.')
                    return
                  }
                  setIsLightsModalOpen(false)
                }}
                className="flex-1 py-4 font-bold text-white bg-yellow-500 rounded-2xl active:scale-[0.98] transition-all shadow-lg shadow-yellow-500/30"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
