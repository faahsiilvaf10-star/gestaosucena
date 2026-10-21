import { useEffect, useRef } from 'react'
import { useRouter } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import {
  SESSION_EXPIRES_KEY,
  SESSION_SERVER_MIDNIGHT_KEY,
  getNextMidnightTimestamp,
  getServerMidnightTimestamp,
  setDailySessionExpiry,
  handleMidnightLogout,
} from '../lib/sessionManager'

/**
 * Componente sentinela global para garantir que todos os usuários
 * permaneçam logados durante o dia todo sem queda por inatividade,
 * e sejam pontualmente deslogados às 00:00 no fuso do servidor (UTC-3).
 */
export function DailySessionWatcher() {
  const router = useRouter()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isInitializedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const checkAndSchedule = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      // Se não há sessão ativa, não há o que agendar
      if (!session) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        return
      }

      // Se a data da meia-noite do servidor armazenada é de hoje, não precisa recalcular
      const storedMidnightDate = localStorage.getItem(SESSION_SERVER_MIDNIGHT_KEY)
      const today = new Date().toISOString().split('T')[0]
      
      let expiresAt: number
      const expiresAtStr = localStorage.getItem(SESSION_EXPIRES_KEY)

      if (!expiresAtStr || storedMidnightDate !== today) {
        // Obter meia-noite do servidor
        expiresAt = await getServerMidnightTimestamp()
        localStorage.setItem(SESSION_EXPIRES_KEY, expiresAt.toString())
      } else {
        expiresAt = Number(expiresAtStr)
        if (isNaN(expiresAt)) {
          expiresAt = await getServerMidnightTimestamp()
          localStorage.setItem(SESSION_EXPIRES_KEY, expiresAt.toString())
        }
      }

      const now = Date.now()

      // Se a meia-noite já passou
      if (now >= expiresAt) {
        if (!cancelled) {
          await handleMidnightLogout(() => {
            router.navigate({ to: '/' })
          })
        }
        return
      }

      // Agendamento preciso para o instante 00:00:00
      const msUntilMidnight = expiresAt - now
      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      timeoutRef.current = setTimeout(async () => {
        if (!cancelled) {
          await handleMidnightLogout(() => {
            router.navigate({ to: '/' })
          })
        }
      }, msUntilMidnight)
    }

    // 1. Checagem inicial assíncrona
    checkAndSchedule()
    isInitializedRef.current = true

    // 2. Intervalo de segurança (30 segundos) para cobrir suspensão/hibernação de notebooks
    intervalRef.current = setInterval(async () => {
      if (cancelled) return
      
      const expiresAtStr = localStorage.getItem(SESSION_EXPIRES_KEY)
      if (expiresAtStr) {
        const expiresAt = Number(expiresAtStr)
        if (!isNaN(expiresAt) && Date.now() >= expiresAt) {
          const { data } = await supabase.auth.getSession()
          if (data.session) {
            await handleMidnightLogout(() => {
              router.navigate({ to: '/' })
            })
          }
        }
      }
    }, 30000)

    // 3. Listener para quando a aba voltar a ficar visível ou receber foco
    const handleReactivation = () => {
      checkAndSchedule()
    }

    document.addEventListener('visibilitychange', handleReactivation)
    window.addEventListener('focus', handleReactivation)

    // 4. Sincronização entre abas via evento de storage
    const handleStorageChange = async (e: StorageEvent) => {
      if (e.key === SESSION_EXPIRES_KEY && !e.newValue) {
        // Outra aba encerrou a sessão
        const { data } = await supabase.auth.getSession()
        if (!data.session && window.location.pathname !== '/') {
          router.navigate({ to: '/' })
        }
      }
    }
    window.addEventListener('storage', handleStorageChange)

    // 5. Monitoramento de login/logout no Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      if (event === 'SIGNED_IN' && session) {
        await setDailySessionExpiry()
        checkAndSchedule()
      } else if (event === 'SIGNED_OUT') {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        localStorage.removeItem(SESSION_EXPIRES_KEY)
        localStorage.removeItem(SESSION_SERVER_MIDNIGHT_KEY)
      }
    })

    return () => {
      cancelled = true
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', handleReactivation)
      window.removeEventListener('focus', handleReactivation)
      window.removeEventListener('storage', handleStorageChange)
      subscription.unsubscribe()
    }
  }, [router])

  return null
}
