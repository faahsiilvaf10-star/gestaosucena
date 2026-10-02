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
    let savedStep = localStorage.getItem('app_motorista_current_step') as AppMotoristaStep

    if (driver && savedStep && savedStep !== 'login') {
      if (savedStep === 'environment') {
        const rememberEnv = localStorage.getItem('app_motorista_remember_env')
        const env = localStorage.getItem('sucena_environment')
        if (rememberEnv === 'true' && env) {
          savedStep = 'equipment'
          localStorage.setItem('app_motorista_current_step', 'equipment')
        }
      }
      setCurrentStepState(savedStep)
    } else if (!driver) {
      setCurrentStepState('login')
    }
  }, [])

  // Push Notifications — Realtime (rápido) + Polling a cada 30s (fallback confiável)
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let pollInterval: ReturnType<typeof setInterval> | null = null

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
      // 1. Tenta Capacitor (APK nativo)
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications')
        const perm = await LocalNotifications.requestPermissions()
        if (perm.display === 'granted') {
          await LocalNotifications.schedule({
            notifications: [{
              title, body,
              id: Date.now() % 2147483647,
              schedule: { at: new Date(Date.now() + 300) },
              sound: undefined, attachments: undefined,
              actionTypeId: '', extra: null
            }]
          })
        }
      } catch {
        // Não é APK nativo — tenta Web Notification API
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

      // 2. Sempre dispara o banner in-app (funciona sem permissão do sistema)
      window.dispatchEvent(new CustomEvent('app_notification', {
        detail: { title, body }
      }))
    }

    // --- Polling: verifica novas notificações a cada 30s ---
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
          // Marca como lidas no banco
          await supabase.from('app_notifications')
            .update({ is_read: true })
            .in('id', data.map(d => d.id))
            .catch(console.warn)

        for (const notif of (data || [])) {
          // Comando especial de reset enviado pelo administrador
          if (notif.title === '__ADMIN_RESET__') {
            // Limpa todo o cache do turno do motorista
            const keysToRemove = [
              'app_motorista_driver', 'app_motorista_current_step',
              'app_motorista_current_dispatch', 'app_motorista_equipment_id',
              'app_motorista_timeline', 'app_motorista_active_status',
              'app_motorista_active_status_color', 'app_motorista_status_start',
              'app_motorista_wizard_state', 'app_motorista_water_point',
              'app_motorista_water_start', 'app_motorista_fuel_level'
            ]
            keysToRemove.forEach(k => localStorage.removeItem(k))
            // Retorna para a tela inicial de seleção de motorista
            window.location.reload()
            return
          }

          await showNotif(notif.title || 'Nova Mensagem', notif.body || '')
          // Pequeno delay entre múltiplas notificações
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

      // Polling inicial + intervalo de 30s
      await pollNotifications()
      pollInterval = setInterval(pollNotifications, 30000)

      // Realtime como caminho rápido (complementar ao polling)
      channel = supabase.channel(`motorista_notif_${driverId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'app_notifications',
          filter: `driver_id=eq.${driverId}`
        }, async (payload) => {
          const notif = payload.new as any
          if (!notif.is_read) {
            // Marca como lido
            supabase.from('app_notifications').update({ is_read: true }).eq('id', notif.id).catch()
            await showNotif(notif.title || 'Nova Mensagem', notif.body || '')
          }
        })
        .subscribe((status) => {
          console.log('[Notif] Realtime:', status)
        })
    }

    if (currentStep !== 'login') {
      setup()
    }

    return () => {
      if (channel) supabase.removeChannel(channel)
      if (pollInterval) clearInterval(pollInterval)
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

    // Auto-skip environment if remembered
    if (target === 'environment') {
      const rememberEnv = localStorage.getItem('app_motorista_remember_env')
      const env = localStorage.getItem('sucena_environment')
      if (rememberEnv === 'true' && env) {
        target = 'equipment'
        localStorage.setItem('app_motorista_current_step', 'equipment')
      }
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
