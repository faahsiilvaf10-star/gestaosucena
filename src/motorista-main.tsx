import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'
import { supabase } from './lib/supabase'

// Registra o Service Worker para funcionamento offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(() => {
      console.log('[SW] Service Worker registrado com sucesso')
    }).catch((err) => {
      console.error('[SW] Erro ao registrar Service Worker:', err)
    })
  })
}

// Import apenas os componentes do App Motorista
import LoginStep from './components/app-motorista/LoginStep'
import EnvironmentStep from './components/app-motorista/EnvironmentStep'
import EquipmentStep from './components/app-motorista/EquipmentStep'
import WizardStep from './components/app-motorista/WizardStep'
import DashboardStep from './components/app-motorista/DashboardStep'

export type AppMotoristaStep = 'login' | 'environment' | 'equipment' | 'wizard' | 'dashboard'

function AppMotoristaStandalone() {
  const [currentStep, setCurrentStepState] = useState<AppMotoristaStep>(() => {
    if (typeof window === 'undefined') return 'login'
    const driver = localStorage.getItem('app_motorista_driver')
    const savedStep = localStorage.getItem('app_motorista_current_step') as AppMotoristaStep
    if (driver && savedStep) return savedStep
    return 'login'
  })
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  const setCurrentStep = (step: AppMotoristaStep) => {
    setCurrentStepState(step)
    localStorage.setItem('app_motorista_current_step', step)
  }

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true)
      import('./lib/offline-sync').then(m => m.processSyncQueue())
    }
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      import('./lib/offline-sync').then(m => m.processSyncQueue())
    }

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // Restaurar sessão salva no localStorage ao iniciar
  useEffect(() => {
    const driver = localStorage.getItem('app_motorista_driver')
    const savedStep = localStorage.getItem('app_motorista_current_step') as AppMotoristaStep

    if (driver && savedStep && savedStep !== 'login') {
      setCurrentStepState(savedStep)
    } else if (!driver) {
      setCurrentStepState('login')
    }
  }, [])

  // Push Notifications — funciona em native (Capacitor) e browser (Web API)
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null

    const setupNotifications = async () => {
      try {
        const driverDataStr = localStorage.getItem('app_motorista_driver')
        if (!driverDataStr) return

        const driver = JSON.parse(driverDataStr)
        if (!driver.id || driver.id === 'ADMIN') return

        // --- Pede permissão de notificação do sistema ---
        // 1. Tenta via Capacitor LocalNotifications (APK nativo)
        let canUseCapacitor = false
        try {
          const { LocalNotifications } = await import('@capacitor/local-notifications')
          const perm = await LocalNotifications.requestPermissions()
          canUseCapacitor = perm.display === 'granted'
        } catch {
          // Capacitor não disponível (browser), ignorar
        }

        // 2. Tenta via Web Notification API (PWA / browser)
        let canUseWebNotif = false
        if (!canUseCapacitor && 'Notification' in window) {
          const webPerm = await Notification.requestPermission()
          canUseWebNotif = webPerm === 'granted'
        }

        const showSystemNotif = async (title: string, body: string) => {
          if (canUseCapacitor) {
            const { LocalNotifications } = await import('@capacitor/local-notifications')
            await LocalNotifications.schedule({
              notifications: [{
                title,
                body,
                id: Date.now(),
                schedule: { at: new Date(Date.now() + 500) },
                sound: undefined,
                attachments: undefined,
                actionTypeId: '',
                extra: null
              }]
            })
          } else if (canUseWebNotif) {
            new Notification(title, { body, icon: '/favicon.ico' })
          }
        }

        // --- Subscribe ao Realtime para notificações do motorista ---
        channel = supabase.channel(`motorista_notif_${driver.id}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'app_notifications',
            filter: `driver_id=eq.${driver.id}`
          }, async (payload) => {
            const notif = payload.new as any

            // Exibe notificação no sistema operacional
            await showSystemNotif(
              notif.title || 'Nova Mensagem',
              notif.body || 'Você tem uma nova mensagem do painel.'
            )

            // Emite evento DOM para mostrar banner in-app no DashboardStep
            window.dispatchEvent(new CustomEvent('app_notification', {
              detail: { title: notif.title, body: notif.body }
            }))
          })
          .subscribe((status) => {
            console.log('[Notif] Canal Supabase Realtime:', status)
          })

      } catch (err) {
        console.error('Erro ao configurar notificações:', err)
      }
    }

    if (currentStep !== 'login') {
      setupNotifications()
    }

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [currentStep])

  const handleLogin = (stepOrDriver?: any) => {
    let target: AppMotoristaStep = 'environment'
    if (typeof stepOrDriver === 'string' && stepOrDriver) {
      target = stepOrDriver as AppMotoristaStep
    } else {
      const savedStep = localStorage.getItem('app_motorista_current_step') as AppMotoristaStep
      if (savedStep) target = savedStep
    }
    setCurrentStep(target)
  }

  const handleLogout = () => {
    localStorage.removeItem('app_motorista_driver')
    localStorage.removeItem('app_motorista_current_step')
    localStorage.removeItem('app_motorista_current_dispatch')
    localStorage.removeItem('app_motorista_equipment_id')
    localStorage.removeItem('app_motorista_timeline')
    localStorage.removeItem('app_motorista_active_status')
    localStorage.removeItem('app_motorista_active_status_color')
    localStorage.removeItem('app_motorista_status_start')
    localStorage.removeItem('app_motorista_wizard_state')
    setCurrentStep('login')
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white" style={{ height: '100dvh', maxHeight: '100dvh', overflow: 'hidden' }}>
      {/* Indicador offline */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600 text-white text-xs font-bold text-center py-1 px-3 shadow-md flex items-center justify-center gap-2">
          <span>📡 Modo Offline ativo — registros salvos e sincronizados ao conectar</span>
        </div>
      )}

      <div className="h-full overflow-y-auto">
        {currentStep === 'login' && (
          <LoginStep onLogin={handleLogin} />
        )}
        {currentStep === 'environment' && (
          <EnvironmentStep
            onSelect={(env: string) => {
              localStorage.setItem('sucena_environment', env)
              setCurrentStep('equipment')
            }}
            onBack={() => setCurrentStep('login')}
          />
        )}
        {currentStep === 'equipment' && (
          <EquipmentStep
            onSelect={(equipmentId: string) => {
              localStorage.setItem('app_motorista_equipment_id', equipmentId)
              const driver = localStorage.getItem('app_motorista_driver')
              const driverData = driver ? JSON.parse(driver) : null
              if (driverData?.id === 'ADMIN') {
                setCurrentStep('dashboard')
              } else {
                setCurrentStep('wizard')
              }
            }}
            onBack={() => setCurrentStep('environment')}
          />
        )}
        {currentStep === 'wizard' && (
          <WizardStep
            onFinish={() => setCurrentStep('dashboard')}
            onComplete={() => setCurrentStep('dashboard')}
            onCancel={() => setCurrentStep('equipment')}
            onBack={() => setCurrentStep('equipment')}
          />
        )}
        {currentStep === 'dashboard' && (
          <DashboardStep
            onLogout={handleLogout}
            isOnline={isOnline}
            onBack={() => setCurrentStep('equipment')}
          />
        )}
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppMotoristaStandalone />
  </React.StrictMode>
)
