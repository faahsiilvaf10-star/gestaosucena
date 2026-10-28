import { useEffect, useRef } from 'react'
import { useRouter } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import {
  SESSION_EXPIRES_KEY,
  getNextMidnightTimestamp,
  setDailySessionExpiry,
  handleMidnightLogout,
  isSessionExpired,
  clearDailySessionExpiry,
} from '../lib/sessionManager'

/**
 * Componente sentinela global para garantir que todos os usuários
 * permaneçam logados durante o dia todo sem queda por inatividade,
 * e sejam pontualmente deslogados às 00:00 (meia-noite).
 *
 * Se a sessão for resetada pelo banco de dados ou expirada, garante
 * o retorno imediato à tela de login (/).
 */
export function DailySessionWatcher() {
  const router = useRouter()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const isAppPath = () => {
      if (typeof window === 'undefined') return false
      if (window.location.search.includes('mock=true')) return false
      const path = window.location.pathname
      return path !== '/' && !path.startsWith('/equipamentos/app-motorista')
    }

    const checkAndSchedule = async () => {
      // 1. Se a expiração de meia-noite já passou, executa o logout imediatamente
      if (isSessionExpired()) {
        await handleMidnightLogout(() => {
          router.navigate({ to: '/' })
        })
        return
      }

      const { data: { session } } = await supabase.auth.getSession()

      // 2. Se não há sessão ativa
      if (!session) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        // Se estiver em rota interna (ex: /dashboard) sem sessão ativa, volta para o login normalmente
        if (isAppPath()) {
          clearDailySessionExpiry()
          localStorage.removeItem('sucena_environment')
          localStorage.removeItem('sucena_user_name')
          router.navigate({ to: '/' })
        }
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

    // 2. Intervalo de segurança (15 segundos) para cobrir expiração ou reset no banco
    intervalRef.current = setInterval(async () => {
      if (isSessionExpired()) {
        await handleMidnightLogout(() => {
          router.navigate({ to: '/' })
        })
        return
      }

      if (isAppPath()) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          clearDailySessionExpiry()
          localStorage.removeItem('sucena_environment')
          localStorage.removeItem('sucena_user_name')
          router.navigate({ to: '/' })
        }
      }
    }, 15000)

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
        if (isAppPath()) {
          router.navigate({ to: '/' })
        }
      }
    }
    window.addEventListener('storage', handleStorageChange)

    // 5. Monitoramento de login/logout no Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setDailySessionExpiry()
        checkAndSchedule()
      } else if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        clearDailySessionExpiry()
        localStorage.removeItem('sucena_environment')
        localStorage.removeItem('sucena_user_name')
        if (isAppPath()) {
          router.navigate({ to: '/' })
        }
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
