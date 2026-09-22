import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, Truck, LogIn, LogOut } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { format } from 'date-fns'

interface MovementAlert {
  id: string
  equipment_id: string
  movement_type: 'entry' | 'exit'
  exit_reason: string | null
  description: string | null
  created_at: string
  created_by: string | null
  equipment?: {
    name: string
    plate_tag: string
  }
}

export function GlobalEquipmentAlert() {
  const { isDark } = useTheme()
  const [queue, setQueue] = useState<MovementAlert[]>([])
  const [currentAlert, setCurrentAlert] = useState<MovementAlert | null>(null)

  // Load today's non-dismissed movements on mount
  useEffect(() => {
    const fetchTodaysMovements = async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0]
        const { data, error } = await supabase
          .from('eq_movements')
          .select(`
            id, equipment_id, movement_type, exit_reason, description, created_at, created_by,
            eq_equipments(name, plate_tag)
          `)
          .gte('created_at', `${todayStr}T00:00:00.000Z`)
          .order('created_at', { ascending: true })

        if (error || !data) return

        const dismissed = JSON.parse(localStorage.getItem('dismissed_eq_movements') || '[]')
        const unDismissed = data.filter((m: any) => !dismissed.includes(m.id)).map((m: any) => ({
          ...m,
          equipment: m.eq_equipments
        }))

        if (unDismissed.length > 0) {
          setQueue(unDismissed)
        }
      } catch (err) {
        console.error('Error fetching today movements:', err)
      }
    }

    fetchTodaysMovements()

    // Subscribe to new movements
    const subscription = supabase
      .channel('global_eq_movements_alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'eq_movements' }, async (payload) => {
        const newMovement = payload.new as any
        
        // Fetch equipment details for this movement
        const { data: eqData } = await supabase
          .from('eq_equipments')
          .select('name, plate_tag')
          .eq('id', newMovement.equipment_id)
          .single()

        if (eqData) {
          const alert: MovementAlert = {
            ...newMovement,
            equipment: eqData
          }
          
          const dismissed = JSON.parse(localStorage.getItem('dismissed_eq_movements') || '[]')
          if (!dismissed.includes(alert.id)) {
            setQueue(prev => [...prev, alert])
          }
        }
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Process queue
  useEffect(() => {
    if (!currentAlert && queue.length > 0) {
      setCurrentAlert(queue[0])
    }
  }, [queue, currentAlert])

  const handleDismiss = () => {
    if (!currentAlert) return
    
    // Save to local storage
    const dismissed = JSON.parse(localStorage.getItem('dismissed_eq_movements') || '[]')
    dismissed.push(currentAlert.id)
    
    // Keep only last 100 to prevent local storage from growing infinitely
    if (dismissed.length > 100) {
      dismissed.shift()
    }
    
    localStorage.setItem('dismissed_eq_movements', JSON.stringify(dismissed))
    
    // Remove from queue
    setQueue(prev => prev.slice(1))
    setCurrentAlert(null)
  }

  if (!currentAlert) return null

  const isEntry = currentAlert.movement_type === 'entry'
  const exitReasons: Record<string, string> = {
    'preventive_maintenance': 'Manutenção Preventiva',
    'corrective_maintenance': 'Manutenção Corretiva',
    'inspection': 'Vistoria',
    'external_service': 'Serviço Externo',
    'other': 'Outro'
  }
  const reasonLabel = currentAlert.exit_reason ? (exitReasons[currentAlert.exit_reason] || currentAlert.exit_reason) : ''

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${isDark ? 'bg-[#15161A] text-white border border-white/10' : 'bg-white text-gray-900 border border-black/5'}`}>
        
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${isEntry ? (isDark ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-700') : (isDark ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' : 'bg-orange-50 border-orange-100 text-orange-700')}`}>
          <div className="flex items-center gap-2 font-bold text-lg">
            {isEntry ? <LogIn size={24} /> : <LogOut size={24} />}
            {isEntry ? 'ENTRADA DE EQUIPAMENTO' : 'SAÍDA DE EQUIPAMENTO'}
          </div>
          <button onClick={handleDismiss} className={`p-1.5 rounded-full transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b border-gray-200 dark:border-white/10">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-white/5 text-white' : 'bg-gray-100 text-gray-700'}`}>
              <Truck size={28} />
            </div>
            <div>
              <h3 className="text-xl font-bold">{currentAlert.equipment?.name || 'Equipamento'}</h3>
              <p className={`text-sm font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {currentAlert.equipment?.plate_tag || 'S/ Placa'} • TAG: {currentAlert.equipment_id.substring(0, 8)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className={`p-3 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
              <p className={`text-xs uppercase font-bold mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Data/Hora</p>
              <p className="font-semibold">{format(new Date(currentAlert.created_at), "dd/MM/yyyy 'às' HH:mm")}</p>
            </div>
            <div className={`p-3 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
              <p className={`text-xs uppercase font-bold mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Registrado por</p>
              <p className="font-semibold truncate" title={currentAlert.created_by || '-'}>{currentAlert.created_by || '-'}</p>
            </div>
          </div>

          {!isEntry && (
            <div className={`p-4 rounded-xl ${isDark ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-orange-50 border border-orange-100'}`}>
              <p className={`text-xs uppercase font-bold mb-1 ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>Motivo da Saída</p>
              <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{reasonLabel}</p>
              {currentAlert.description && (
                <p className={`text-sm mt-1 italic ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>"{currentAlert.description}"</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex justify-end gap-3 ${isDark ? 'bg-[#0a0a0c] border-white/5' : 'bg-gray-50 border-black/5'}`}>
          <button 
            onClick={handleDismiss}
            className={`px-6 py-2.5 rounded-xl font-bold transition-colors ${isDark ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}
          >
            Ciente
          </button>
        </div>
        
      </div>
    </div>
  )
}
