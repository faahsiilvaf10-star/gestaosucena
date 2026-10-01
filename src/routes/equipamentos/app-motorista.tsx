import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'

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
            onSelect={() => setCurrentStep('wizard')} 
            onBack={() => {
              localStorage.removeItem('app_motorista_driver')
              setCurrentStep('login')
            }} 
          />
        )}
        {currentStep === 'wizard' && <WizardStep onFinish={() => setCurrentStep('dashboard')} onCancel={() => setCurrentStep('equipment')} />}
        {currentStep === 'dashboard' && <DashboardStep />}
      </div>
      </div>
    </div>
  )
}
