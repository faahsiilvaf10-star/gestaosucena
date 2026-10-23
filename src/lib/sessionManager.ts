import { supabase } from './supabase'
import { toast } from 'sonner'

export const SESSION_EXPIRES_KEY = 'sucena_session_expires_at'

/**
 * Retorna o timestamp (ms) da próxima meia-noite (00:00:00) no fuso horário local.
 */
export function getNextMidnightTimestamp(): number {
  const now = new Date()
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0
  )
  return nextMidnight.getTime()
}

/**
 * Define a validade da sessão até a próxima meia-noite (00:00).
 */
export function setDailySessionExpiry(): void {
  const expiresAt = getNextMidnightTimestamp()
  localStorage.setItem(SESSION_EXPIRES_KEY, expiresAt.toString())
}

/**
 * Remove a marca de expiração diária.
 */
export function clearDailySessionExpiry(): void {
  localStorage.removeItem(SESSION_EXPIRES_KEY)
}

/**
 * Verifica se a sessão atual já ultrapassou a meia-noite.
 */
export function isSessionExpired(): boolean {
  const expiresAtStr = localStorage.getItem(SESSION_EXPIRES_KEY)
  if (!expiresAtStr) return false
  const expiresAt = Number(expiresAtStr)
  return !isNaN(expiresAt) && Date.now() >= expiresAt
}

let isLoggingOut = false

/**
 * Executa o deslogamento automático diário das 00:00 com feedback visual.
 */
export async function handleMidnightLogout(onNavigate?: () => void): Promise<void> {
  if (isLoggingOut) return
  isLoggingOut = true

  try {
    clearDailySessionExpiry()
    localStorage.removeItem('sucena_environment')
    localStorage.removeItem('sucena_user_name')
    await supabase.auth.signOut().catch(() => {})
    
    toast.warning('Sua sessão diária expirou às 00:00. Por favor, faça login novamente para continuar.', {
      duration: 6000,
    })

    if (onNavigate) {
      onNavigate()
    } else if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.location.href = '/'
    }
  } catch (error) {
    console.error('Erro ao realizar logout das 00:00:', error)
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.location.href = '/'
    }
  } finally {
    isLoggingOut = false
  }
}
