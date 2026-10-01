import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'

// Registra o Service Worker para funcionamento offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(() => {
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
  const [currentStep, setCurrentStepState] = useState<AppMotoristaStep>(
    (localStorage.getItem('app_motorista_current_step') as AppMotoristaStep) || 'login'
  )
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  const setCurrentStep = (step: AppMotoristaStep) => {
    setCurrentStepState(step)
    localStorage.setItem('app_motorista_current_step', step)
  }

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // Restaurar sessão salva no localStorage
  useEffect(() => {
    const driver = localStorage.getItem('app_motorista_driver')
    const savedStep = localStorage.getItem('app_motorista_current_step') as AppMotoristaStep

    if (driver && savedStep && savedStep !== 'login') {
      setCurrentStepState(savedStep)
    } else if (!driver) {
      setCurrentStepState('login')
    }
  }, [])

  const handleLogin = (driver: any) => {
    localStorage.setItem('app_motorista_driver', JSON.stringify(driver))
    if (driver.id === 'ADMIN') {
      const env = localStorage.getItem('sucena_environment')
      if (!env) {
        setCurrentStep('environment')
      } else {
        setCurrentStep('equipment')
      }
    } else {
      setCurrentStep('environment')
    }
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
    setCurrentStep('login')
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white" style={{ height: '100dvh', maxHeight: '100dvh', overflow: 'hidden' }}>
      {/* Indicador offline */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-orange-500 text-white text-xs font-bold text-center py-1 px-3">
          📡 Offline — dados serão sincronizados quando conectar
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
            onComplete={() => setCurrentStep('dashboard')}
            onBack={() => setCurrentStep('equipment')}
          />
        )}
        {currentStep === 'dashboard' && (
          <DashboardStep
            onLogout={handleLogout}
            isOnline={isOnline}
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
