import Wifi from 'lucide-react/dist/esm/icons/wifi.js';
import WifiOff from 'lucide-react/dist/esm/icons/wifi-off.js';
import Loader2 from 'lucide-react/dist/esm/icons/loader-circle.js';
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import Bell from 'lucide-react/dist/esm/icons/bell.js';

// Sub-components that we will build out
import LoginStep from '../../components/app-motorista/LoginStep'
import EnvironmentStep from '../../components/app-motorista/EnvironmentStep'
import EquipmentStep from '../../components/app-motorista/EquipmentStep'
import WizardStep from '../../components/app-motorista/WizardStep'
import DashboardStep from '../../components/app-motorista/DashboardStep'

export const Route = createFileRoute('/equipamentos/app-motorista')({
  component: AppMotoristaWrapper,
})

export type AppMotoristaStep = 'login' | 'environment' | 'equipment' | 'wizard' | 'dashboard'

function AppMotoristaWrapper() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentStepState, setCurrentStepState] = useState<AppMotoristaStep>(
    (localStorage.getItem('app_motorista_current_step') as AppMotoristaStep) || 'login'
  )

  const [announcements, setAnnouncements] = useState<Array<{title: string, body: string}>>([])
  const pollingSetupRef = useRef(false)

  const getDriverId = () => {
    try {
      const str = localStorage.getItem('app_motorista_driver')
      if (!str) return null
      const d = JSON.parse(str)
      return d.id && d.id !== 'ADMIN' ? d.id : null
    } catch { return null }
  }

  // Exibe notificação no sistema e in-app banner
  const showNotif = async (title: string, body: string) => {
    setAnnouncements(prev => [...prev, { title, body }])

    // Tenta Web Notification API
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' })
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => {
          if (p === 'granted') new Notification(title, { body, icon: '/favicon.ico' })
        })
      }
    }
  }

  useEffect(() => {
    if (currentStepState === 'login' || pollingSetupRef.current) return;
    pollingSetupRef.current = true;
    
    let channel: any;
    let pollInterval: any;

    const pollNotifications = async () => {
      const driverId = getDriverId()
      if (!driverId) return

      try {
        const { data, error } = await supabase
          .from('app_notifications')
          .select('id, title, body, created_at')
          .eq('driver_id', driverId)
          .eq('is_read', false)
          .order('created_at', { ascending: true })

        if (error) { console.warn('[Notif Polling] Erro:', error.message); return }

        if (data && data.length > 0) {
          await supabase.from('app_notifications')
            .update({ is_read: true })
            .in('id', data.map(d => d.id))
            .catch(console.warn)

          for (const notif of (data || [])) {
            if (notif.title === '__ADMIN_RESET__') {
              const keysToRemove = [
                'app_motorista_driver', 'app_motorista_current_step',
                'app_motorista_current_dispatch', 'app_motorista_equipment_id',
                'app_motorista_timeline', 'app_motorista_active_status',
                'app_motorista_active_status_color', 'app_motorista_status_start',
                'app_motorista_wizard_state', 'app_motorista_water_point',
                'app_motorista_water_start', 'app_motorista_fuel_level'
              ]
              keysToRemove.forEach(k => localStorage.removeItem(k))
              window.location.reload()
              return
            }
            await showNotif(notif.title || 'Nova Mensagem', notif.body || '')
            await new Promise(r => setTimeout(r, 500))
          }
        }
      } catch (err) {
        console.warn('[Notif Polling] Falha:', err)
      }
    }

    const setup = async () => {
      const driverId = getDriverId()
      if (!driverId) return

      await pollNotifications()
      pollInterval = setInterval(pollNotifications, 30000)

      channel = supabase.channel(`motorista_notif_${driverId}_web`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'app_notifications',
          filter: `driver_id=eq.${driverId}`
        }, async (payload) => {
          const notif = payload.new as any
          if (!notif.is_read) {
            supabase.from('app_notifications').update({ is_read: true }).eq('id', notif.id).catch()
            await showNotif(notif.title || 'Nova Mensagem', notif.body || '')
          }
        })
        .subscribe()
    }

    setup()

    return () => {
      if (pollInterval) clearInterval(pollInterval)
      if (channel) supabase.removeChannel(channel)
      pollingSetupRef.current = false
    }
  }, [currentStepState])

  const currentStep = currentStepState
  const setCurrentStep = (step: AppMotoristaStep) => {
    setCurrentStepState(step)
    localStorage.setItem('app_motorista_current_step', step)
  }
  
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  // Session Management
  useEffect(() => {
    // Usando login local baseado em PIN (armazenado no localStorage)
    const driver = localStorage.getItem('app_motorista_driver')
    
    if (driver) {
      setSession({ user: JSON.parse(driver) })
      const savedStep = localStorage.getItem('app_motorista_current_step') as AppMotoristaStep
      if (savedStep && savedStep !== 'login') {
        setCurrentStep(savedStep)
      } else {
        setCurrentStep('environment')
      }
    } else {
      setCurrentStep('login')
    }
    setLoading(false)
  }, [])

  // Offline Management
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      import('../../lib/offline-sync').then(m => m.processSyncQueue())
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Trigger on mount if online
    if (navigator.onLine) {
      import('../../lib/offline-sync').then(m => m.processSyncQueue())
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-[#000]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen sm:p-4 flex items-center justify-center w-full">
      <div className="flex flex-col w-full h-screen sm:h-[850px] sm:max-h-[95vh] sm:max-w-[400px] sm:rounded-[40px] sm:border-[12px] sm:border-gray-900 sm:shadow-2xl bg-white/10 dark:bg-black/40 backdrop-blur-md text-gray-900 dark:text-gray-100 font-sans overflow-hidden relative">
      {/* ONLINE/OFFLINE INDICATOR */}
      <div className="absolute top-10 right-4 sm:top-8 sm:right-6 z-50 flex items-center gap-2 bg-black/40 px-2 py-1 rounded-full backdrop-blur-sm border border-white/5 shadow-md">
        <span className="text-[10px] font-bold tracking-wider uppercase opacity-70">
          {isOnline ? 'Online' : 'Offline'}
        </span>
        <span className="relative flex h-2.5 w-2.5">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnline ? 'bg-green-400' : 'bg-red-400'}`}></span>
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
        </span>
      </div>

      {/* STATUS BAR */}
      {!isOnline && (
        <div className="w-full bg-red-500 text-white text-xs text-center py-2 pt-10 sm:pt-2 font-semibold flex items-center justify-center gap-2 relative z-40">
          <WifiOff size={14} /> Trabalhando offline. Sincronizaremos em breve.
        </div>
      )}
      
      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto pt-24 sm:pt-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {currentStep === 'login' && <LoginStep onLogin={(step) => setCurrentStep((step as AppMotoristaStep) || 'environment')} />}
        {currentStep === 'environment' && <EnvironmentStep onSelect={() => setCurrentStep('equipment')} />}
        {currentStep === 'equipment' && (
          <EquipmentStep 
            onSelect={() => {
              const driver = JSON.parse(localStorage.getItem('app_motorista_driver') || '{}')
              if (driver.id === 'ADMIN') {
                setCurrentStep('dashboard')
              } else {
                setCurrentStep('wizard')
              }
            }} 
            onBack={() => {
              localStorage.removeItem('app_motorista_driver')
              setCurrentStep('login')
            }} 
          />
        )}
        {currentStep === 'wizard' && <WizardStep onFinish={() => setCurrentStep('dashboard')} onCancel={() => setCurrentStep('equipment')} />}
        {currentStep === 'dashboard' && <DashboardStep onBack={() => setCurrentStep('equipment')} />}
      </div>
      
      {/* MODAL DE COMUNICADO OFICIAL */}
      {announcements.length > 0 && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1A1C20] border border-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-300">
            {/* Banner/Header decoration */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
            
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Bell className="w-6 h-6" />
              </div>
              <div className="flex-1 mt-1">
                <h2 className="text-xl font-bold text-white leading-tight">
                  {announcements[0].title}
                </h2>
                <p className="text-blue-400 text-xs font-semibold mt-1">
                  COMUNICADO OFICIAL
                </p>
              </div>
            </div>
            
            <div className="bg-black/20 rounded-xl p-4 mb-6 max-h-60 overflow-y-auto custom-scrollbar">
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                {announcements[0].body}
              </p>
            </div>
            
            <button 
              onClick={() => setAnnouncements(prev => prev.slice(1))}
              className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl transition-colors text-center shadow-lg"
            >
              Estou ciente / Fechar
            </button>
          </div>
        </div>
      )}

      </div>
    </div>
  )
}
