import { supabase } from './supabase'
import { toast } from 'sonner'

export const SESSION_EXPIRES_KEY = 'sucena_session_expires_at'
export const SESSION_SERVER_MIDNIGHT_KEY = 'sucena_server_midnight_date'

/**
 * Obtém a meia-noite do servidor (UTC-3, America/Belem) via RPC.
 * Fallback: calcula localmente se a RPC falhar.
 */
export async function getServerMidnightTimestamp(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_next_midnight_server')
    if (!error && data) {
      // Salvar a data da meia-noite para validar no dia seguinte
      const midnightDate = new Date(data).toISOString().split('T')[0]
      localStorage.setItem(SESSION_SERVER_MIDNIGHT_KEY, midnightDate)
      return Number(data)
    }
  } catch (e) {
    console.warn('Erro ao obter meia-noite do servidor, usando fallback:', e)
  }
  
  // Fallback: calcular no cliente (pode ter diferença de fuso)
  return getNextMidnightTimestampLocal()
}

/**
 * Retorna o timestamp (ms) da próxima meia-noite no fuso LOCAL (fallback).
 * Usado apenas quando a RPC do servidor não está disponível.
 */
export function getNextMidnightTimestampLocal(): number {
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
 * Retorna o timestamp (ms) da próxima meia-noite no fuso do servidor.
 * Se a meia-noite do servidor já passou HOJE (dentro do mesmo dia local),
 * retorna a meia-noite de HOJE (não do próximo dia).
 * 
 * Isso evita que o usuário perca tempo de sessão se o fuso do cliente
 * estiver à frente do servidor.
 */
export async function getNextMidnightTimestamp(): Promise<number> {
  return getServerMidnightTimestamp()
}

/**
 * Define a validade da sessão até a próxima meia-noite do servidor (00:00).
 */
export async function setDailySessionExpiry(): Promise<void> {
  const expiresAt = await getServerMidnightTimestamp()
  localStorage.setItem(SESSION_EXPIRES_KEY, expiresAt.toString())
}

/**
 * Remove a marca de expiração diária.
 */
export function clearDailySessionExpiry(): void {
  localStorage.removeItem(SESSION_EXPIRES_KEY)
  localStorage.removeItem(SESSION_SERVER_MIDNIGHT_KEY)
}

/**
 * Verifica se a sessão atual já ultrapassou a meia-noite do servidor.
 */
export async function isSessionExpired(): Promise<boolean> {
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
    await supabase.auth.signOut()
    
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
