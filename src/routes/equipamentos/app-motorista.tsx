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
  const [currentStepState, setCurrentStepState] = useState<AppMotoristaStep>(() => {
    if (typeof window === 'undefined') return 'login'
    const driver = localStorage.getItem('app_motorista_driver')
    const savedStep = localStorage.getItem('app_motorista_current_step') as AppMotoristaStep
    if (driver && savedStep) return savedStep
    return 'login'
  })
  const [announcements, setAnnouncements] = useState<Array<{title: string, body: string}>>([])

  // Exibe notificação no sistema e in-app banner
  const showNotif = async (title: string, body: string) => {
    setAnnouncements(prev => [...prev, { title, body }])
    try {
      if ('Notification' in window && Notification.permission !== 'denied') {
        if (Notification.permission === 'granted') {
          new Notification(title, { body, icon: '/favicon.ico' })
        } else {
          Notification.requestPermission().then(p => {
            if (p === 'granted') new Notification(title, { body, icon: '/favicon.ico' })
          })
        }
      }
    } catch(e) {}
  }

  // BULLETPROOF GLOBAL POLLING (Ignores React lifecycles to guarantee it never stops)
  useEffect(() => {
    let isPolling = false;
    
    const tick = async () => {
      if (isPolling) return;
      isPolling = true;
      try {
        const str = localStorage.getItem('app_motorista_driver')
        if (!str) return;
        const d = JSON.parse(str)
        const driverId = d.id && d.id !== 'ADMIN' ? d.id : null
        
        if (!driverId) return;

        const { data, error } = await supabase
          .from('app_notifications')
          .select('id, title, body, created_at')
          .eq('driver_id', driverId)
          .eq('is_read', false)
          .order('created_at', { ascending: true })

        if (!error && data && data.length > 0) {
          await supabase.from('app_notifications')
            .update({ is_read: true })
            .in('id', data.map(d => d.id))
            .catch(() => {})

          for (const notif of data) {
            if (notif.title === '__ADMIN_RESET__') {
              const keys = ['app_motorista_driver', 'app_motorista_current_step', 'app_motorista_current_dispatch', 'app_motorista_equipment_id', 'app_motorista_timeline', 'app_motorista_active_status', 'app_motorista_active_status_color', 'app_motorista_status_start', 'app_motorista_wizard_state', 'app_motorista_water_point', 'app_motorista_water_start', 'app_motorista_fuel_level']
              keys.forEach(k => localStorage.removeItem(k))
              window.location.reload()
              return
            }
            showNotif(notif.title || 'Nova Mensagem', notif.body || '')
            await new Promise(r => setTimeout(r, 500))
          }
        }
      } catch (e) {
        console.warn('Global Poll error', e)
      } finally {
        isPolling = false;
      }
    };

    // Run immediately and then every 10 seconds
    tick();
    const interval = setInterval(tick, 10000);
    return () => clearInterval(interval);
  }, [])

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
        {currentStep === 'dashboard' && (
          <DashboardStep
            onLogout={() => {
              const keys = ['app_motorista_driver', 'app_motorista_current_step', 'app_motorista_current_dispatch', 'app_motorista_equipment_id', 'app_motorista_timeline', 'app_motorista_active_status', 'app_motorista_active_status_color', 'app_motorista_status_start', 'app_motorista_wizard_state', 'app_motorista_water_point', 'app_motorista_water_start', 'app_motorista_fuel_level']
              keys.forEach(k => localStorage.removeItem(k))
              setCurrentStep('login')
            }}
            onBack={() => setCurrentStep('equipment')}
          />
        )}
      </div>
      
      {/* MODAL DE COMUNICADO OFICIAL */}
      {announcements.length > 0 && (
        <div className="comunicado-overlay" role="dialog" aria-modal="true">
          <div className="comunicado flex flex-col max-h-[90vh]">
            <img src="/logo.png" alt="Sucena" className="comunicado-logo" />

            <div className="comunicado-titulo">
              <span className="comunicado-icone" aria-hidden="true">
                📢
              </span>
              <h2 className="m-0 p-0 text-[22px] font-[800] leading-tight text-[#111111]">
                {announcements[0].title || 'Comunicado'}
              </h2>
            </div>

            <div className="comunicado-conteudo overflow-y-auto custom-scrollbar flex-1">
              {announcements[0].body}
            </div>

            <div className="comunicado-rodape">
              <div className="comunicado-acoes justify-end">
                <button 
                  type="button"
                  onClick={() => setAnnouncements(prev => prev.slice(1))}
                  className="comunicado-botao-entendi w-full sm:w-auto"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  )
}
