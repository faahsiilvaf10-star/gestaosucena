import X from 'lucide-react/dist/esm/icons/x.js';
import Truck from 'lucide-react/dist/esm/icons/truck.js';
import LogIn from 'lucide-react/dist/esm/icons/log-in.js';
import LogOut from 'lucide-react/dist/esm/icons/log-out.js';
import User from 'lucide-react/dist/esm/icons/user.js';
import Clock from 'lucide-react/dist/esm/icons/clock.js';
import Wrench from 'lucide-react/dist/esm/icons/wrench.js';
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import { format } from 'date-fns'
import { getEquipmentImage } from '../lib/equipamentos/equipmentImage'

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
    category?: string
    type?: string
  }
}

export function GlobalEquipmentAlert() {
  const { isDark } = useTheme()
  const [queue, setQueue] = useState<MovementAlert[]>([])
  const [currentAlert, setCurrentAlert] = useState<MovementAlert | null>(null)
  const [userId, setUserId] = useState<string>('default')
  const userIdRef = useRef('default')

  // Load today's non-dismissed movements on mount
  useEffect(() => {
    const fetchTodaysMovements = async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0]
        const { data, error } = await supabase
          .from('eq_movements')
          .select(`
            id, equipment_id, movement_type, exit_reason, description, created_at, created_by,
            eq_equipments(name, plate_tag, category, type)
          `)
          .gte('created_at', `${todayStr}T00:00:00.000Z`)
          .order('created_at', { ascending: true })

        if (error || !data) return

        const { data: userData } = await supabase.auth.getUser()
        const currentUserId = userData?.user?.id || 'default'
        setUserId(currentUserId)
        userIdRef.current = currentUserId

        const dismissed = JSON.parse(localStorage.getItem(`dismissed_eq_movements_${currentUserId}`) || '[]')
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
        
        // Fetch complete equipment details for this movement
        const { data: eqData } = await supabase
          .from('eq_equipments')
          .select('name, plate_tag, category, type')
          .eq('id', newMovement.equipment_id)
          .single()

        if (eqData) {
          const alert: MovementAlert = {
            ...newMovement,
            equipment: eqData
          }
          
          const dismissed = JSON.parse(localStorage.getItem(`dismissed_eq_movements_${userIdRef.current}`) || '[]')
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

  // Process queue and trigger alert sound
  useEffect(() => {
    if (!currentAlert && queue.length > 0) {
      const nextAlert = queue[0]
      setCurrentAlert(nextAlert)

      try {
        const audio = new Audio('/comunicado.mp3')
        audio.volume = 0.7
        audio.play().catch(() => {})
      } catch (_) {}
    }
  }, [queue, currentAlert])

  const handleDismiss = () => {
    if (!currentAlert) return
    
    // Save to local storage
    const dismissed = JSON.parse(localStorage.getItem(`dismissed_eq_movements_${userId}`) || '[]')
    dismissed.push(currentAlert.id)
    
    // Keep only last 100 to prevent local storage from growing infinitely
    if (dismissed.length > 100) {
      dismissed.shift()
    }
    
    localStorage.setItem(`dismissed_eq_movements_${userId}`, JSON.stringify(dismissed))
    
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

  // Fallback inteligente para nome do usuário que registrou
  const rawAuthor = currentAlert.created_by?.trim()
  const displayAuthor = (!rawAuthor || rawAuthor === 'Usuário Logado' || rawAuthor === 'Sistema' || rawAuthor === 'Usuário')
    ? (typeof window !== 'undefined' ? localStorage.getItem('sucena_user_name') || 'Portaria / Operador' : 'Portaria / Operador')
    : rawAuthor

  // Resolução da foto do equipamento
  const eqImage = getEquipmentImage(
    currentAlert.equipment?.name,
    currentAlert.equipment?.type,
    currentAlert.equipment?.category
  )

  const vehicleName = currentAlert.equipment?.name || 'Equipamento'
  const plateTag = currentAlert.equipment?.plate_tag

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border ${
        isDark ? 'bg-[#15161A] text-white border-white/10' : 'bg-white text-gray-900 border-black/10'
      }`}>
        
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isEntry 
            ? (isDark ? 'bg-blue-500/15 border-blue-500/25 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-700') 
            : (isDark ? 'bg-orange-500/15 border-orange-500/25 text-orange-400' : 'bg-orange-50 border-orange-100 text-orange-700')
        }`}>
          <div className="flex items-center gap-2 font-bold text-base sm:text-lg">
            {isEntry ? <LogIn size={22} className="shrink-0" /> : <LogOut size={22} className="shrink-0" />}
            <span>{isEntry ? 'ENTRADA DE EQUIPAMENTO' : 'SAÍDA DE EQUIPAMENTO'}</span>
          </div>
          <button 
            onClick={handleDismiss} 
            className={`p-1.5 rounded-full transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-black/5 text-gray-500 hover:text-black'}`}
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          
          {/* Foto e Card de Destaque do Equipamento */}
          <div className={`relative w-full rounded-2xl overflow-hidden flex items-center justify-center border shadow-inner ${
            isDark 
              ? 'bg-gradient-to-b from-[#1c1d22] to-[#121316] border-white/10' 
              : 'bg-gradient-to-b from-gray-50 to-gray-100 border-gray-200'
          } p-3 min-h-[150px]`}>
            {eqImage ? (
              <img 
                src={eqImage} 
                alt={vehicleName}
                className="w-full h-36 object-contain drop-shadow-md select-none transition-transform hover:scale-105 duration-300"
              />
            ) : (
              <div className="py-6 flex flex-col items-center justify-center gap-2 text-gray-400">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? 'bg-white/5 text-white' : 'bg-white text-gray-700 shadow-sm'}`}>
                  {currentAlert.equipment?.category?.toLowerCase().includes('jardinagem') ? <Wrench size={28} /> : <Truck size={28} />}
                </div>
                <span className="text-xs font-semibold">{currentAlert.equipment?.type || 'Equipamento'}</span>
              </div>
            )}

            {/* Placa Padrão Mercosul */}
            {plateTag && (
              <div className="absolute top-2.5 right-2.5 bg-white text-gray-900 px-2.5 py-1 rounded-md font-mono font-bold text-[11px] border border-gray-300 shadow-md flex flex-col items-center leading-none select-none">
                <span className="text-[7px] text-blue-600 font-sans tracking-widest font-black mb-0.5">BRASIL</span>
                <span>{plateTag.toUpperCase()}</span>
              </div>
            )}

            {/* Badge com Nome do Equipamento */}
            <div className="absolute bottom-2.5 left-2.5 bg-black/80 backdrop-blur-md text-white px-3 py-1.5 rounded-xl font-bold text-sm border border-white/15 shadow-lg flex items-center gap-1.5">
              <span>{vehicleName}</span>
              {currentAlert.equipment?.type && (
                <span className="text-xs text-white/70 font-normal hidden sm:inline">• {currentAlert.equipment.type}</span>
              )}
            </div>

            {/* TAG */}
            <div className="absolute bottom-2.5 right-2.5 bg-black/60 backdrop-blur-md text-gray-200 px-2.5 py-1 rounded-lg font-mono text-[10px] border border-white/10 shadow">
              TAG: {currentAlert.equipment_id.substring(0, 8).toUpperCase()}
            </div>
          </div>

          {/* Dados: Data/Hora e Registrado por */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3 rounded-xl border ${
              isDark ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'
            }`}>
              <div className={`flex items-center gap-1.5 text-xs uppercase font-bold mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <Clock size={13} />
                <span>Data/Hora</span>
              </div>
              <p className="font-semibold text-sm">
                {format(new Date(currentAlert.created_at), "dd/MM/yyyy 'às' HH:mm")}
              </p>
            </div>

            <div className={`p-3 rounded-xl border ${
              isDark ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'
            }`}>
              <div className={`flex items-center gap-1.5 text-xs uppercase font-bold mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <User size={13} />
                <span>Registrado por</span>
              </div>
              <p className="font-semibold text-sm truncate" title={displayAuthor}>
                {displayAuthor}
              </p>
            </div>
          </div>

          {/* Motivo de saída (se for saída) */}
          {!isEntry && (
            <div className={`p-3.5 rounded-xl border ${
              isDark ? 'bg-orange-500/10 border-orange-500/20' : 'bg-orange-50 border-orange-100'
            }`}>
              <p className={`text-xs uppercase font-bold mb-1 ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>
                Motivo da Saída
              </p>
              <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {reasonLabel || 'Não informado'}
              </p>
              {currentAlert.description && (
                <p className={`text-xs mt-1.5 italic ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  "{currentAlert.description}"
                </p>
              )}
            </div>
          )}

          {/* Status de entrada (se for entrada) */}
          {isEntry && (
            <div className={`p-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold border ${
              isDark ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' : 'bg-blue-50 text-blue-800 border-blue-100'
            }`}>
              <span>Equipamento confirmado dentro da obra.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex justify-end gap-3 ${
          isDark ? 'bg-[#0f1013] border-white/5' : 'bg-gray-50 border-gray-100'
        }`}>
          <button 
            onClick={handleDismiss}
            className={`px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-sm ${
              isDark 
                ? 'bg-white text-black hover:bg-gray-200 active:scale-95' 
                : 'bg-black text-white hover:bg-gray-800 active:scale-95'
            }`}
          >
            Ciente
          </button>
        </div>
        
      </div>
    </div>
  )
}
