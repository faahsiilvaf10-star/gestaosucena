import { useEffect, useRef } from 'react'
import { useRouter } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import {
  SESSION_EXPIRES_KEY,
  getNextMidnightTimestamp,
  setDailySessionExpiry,
  handleMidnightLogout,
} from '../lib/sessionManager'

/**
 * Componente sentinela global para garantir que todos os usuários
 * permaneçam logados durante o dia todo sem queda por inatividade,
 * e sejam pontualmente deslogados às 00:00 (meia-noite).
 */
export function DailySessionWatcher() {
  const router = useRouter()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const checkAndSchedule = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      // Se não há sessão ativa, não há o que agendar
      if (!session) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        return
      }

      const expiresAtStr = localStorage.getItem(SESSION_EXPIRES_KEY)
      let expiresAt: number

      if (!expiresAtStr) {
        // Se já está logado mas não tinha a chave gravada, define para a próxima 00:00
        expiresAt = getNextMidnightTimestamp()
        setDailySessionExpiry()
      } else {
        expiresAt = Number(expiresAtStr)
        if (isNaN(expiresAt)) {
          expiresAt = getNextMidnightTimestamp()
          setDailySessionExpiry()
        }
      }

      const now = Date.now()

      // Se a meia-noite já passou
      if (now >= expiresAt) {
        await handleMidnightLogout(() => {
          router.navigate({ to: '/' })
        })
        return
      }

      // Agendamento preciso para o instante 00:00:00
      const msUntilMidnight = expiresAt - now
      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      timeoutRef.current = setTimeout(async () => {
        await handleMidnightLogout(() => {
          router.navigate({ to: '/' })
        })
      }, msUntilMidnight)
    }

    // 1. Checagem imediata ao carregar
    checkAndSchedule()

    // 2. Intervalo de segurança (30 segundos) para cobrir suspensão/hibernação de notebooks
    intervalRef.current = setInterval(() => {
      const expiresAtStr = localStorage.getItem(SESSION_EXPIRES_KEY)
      if (expiresAtStr) {
        const expiresAt = Number(expiresAtStr)
        if (!isNaN(expiresAt) && Date.now() >= expiresAt) {
          supabase.auth.getSession().then(({ data }) => {
            if (data.session) {
              handleMidnightLogout(() => {
                router.navigate({ to: '/' })
              })
            }
          })
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
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SESSION_EXPIRES_KEY && !e.newValue) {
        // Outra aba encerrou a sessão
        supabase.auth.getSession().then(({ data }) => {
          if (!data.session && window.location.pathname !== '/') {
            router.navigate({ to: '/' })
          }
        })
      }
    }
    window.addEventListener('storage', handleStorageChange)

    // 5. Monitoramento de login/logout no Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setDailySessionExpiry()
        checkAndSchedule()
      } else if (event === 'SIGNED_OUT') {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        localStorage.removeItem(SESSION_EXPIRES_KEY)
      }
    })

    return () => {
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
