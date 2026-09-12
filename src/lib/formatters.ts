/**
 * formatters.ts — Helpers seguros de formatação para o Sistema Sucena
 *
 * Nunca retornam: undefined, null, NaN, "Invalid Date", "[object Object]"
 * Sempre retornam uma string legível ou um fallback explícito.
 */

import { format, isValid, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ============================================================
// DATAS
// ============================================================

/**
 * Formata uma data de forma segura, nunca retornando "Invalid Date".
 * @param value - string ISO, Date, timestamp, ou qualquer valor
 * @param pattern - padrão date-fns (default: 'dd/MM/yyyy')
 * @param fallback - valor quando a data é inválida (default: 'Data não disponível')
 */
export function safeDate(
  value: string | Date | number | null | undefined,
  pattern = 'dd/MM/yyyy',
  fallback = 'Data não disponível'
): string {
  if (value === null || value === undefined || value === '') return fallback

  try {
    let date: Date

    if (value instanceof Date) {
      date = value
    } else if (typeof value === 'number') {
      date = new Date(value)
    } else if (typeof value === 'string') {
      // Tentar parseISO primeiro (formato ISO 8601)
      date = parseISO(value)
      // Se falhar, tentar new Date()
      if (!isValid(date)) {
        date = new Date(value)
      }
    } else {
      return fallback
    }

    if (!isValid(date)) return fallback

    return format(date, pattern, { locale: ptBR })
  } catch {
    return fallback
  }
}

/**
 * Formata data e hora de forma segura.
 * @param value - string ISO ou Date
 * @param fallback - valor quando inválido
 */
export function safeDateTime(
  value: string | Date | null | undefined,
  fallback = 'Data não disponível'
): string {
  return safeDate(value, "dd/MM/yyyy 'às' HH:mm", fallback)
}

/**
 * Formata data no formato curto para mobile (ex: "12/09/26").
 */
export function safeDateShort(
  value: string | Date | null | undefined,
  fallback = '—'
): string {
  return safeDate(value, 'dd/MM/yy', fallback)
}

/**
 * Formata data com mês por extenso (ex: "12 de setembro de 2026").
 */
export function safeDateFull(
  value: string | Date | null | undefined,
  fallback = 'Data não disponível'
): string {
  return safeDate(value, "d 'de' MMMM 'de' yyyy", fallback)
}

// ============================================================
// NÚMEROS
// ============================================================

/**
 * Converte um valor para número de forma segura, nunca retornando NaN.
 * @param value - qualquer valor
 * @param fallback - valor numérico quando inválido (default: 0)
 */
export function safeNumber(
  value: string | number | null | undefined,
  fallback = 0
): number {
  if (value === null || value === undefined || value === '') return fallback

  const n = Number(value)
  return isNaN(n) || !isFinite(n) ? fallback : n
}

/**
 * Formata um número como string, nunca retornando "NaN".
 * @param value - qualquer valor
 * @param fallback - string quando inválido (default: '—')
 */
export function safeNumberStr(
  value: string | number | null | undefined,
  fallback = '—'
): string {
  if (value === null || value === undefined || value === '') return fallback

  const n = Number(value)
  if (isNaN(n) || !isFinite(n)) return fallback

  return n.toLocaleString('pt-BR')
}

// ============================================================
// PORCENTAGEM
// ============================================================

/**
 * Formata um valor como porcentagem segura.
 * @param value - número entre 0 e 100 (ou 0 e 1 se isDecimal=true)
 * @param decimals - casas decimais (default: 0)
 * @param isDecimal - se true, multiplica por 100 (ex: 0.82 → "82%")
 * @param fallback - valor quando inválido
 */
export function safePercent(
  value: string | number | null | undefined,
  decimals = 0,
  isDecimal = false,
  fallback = '—'
): string {
  if (value === null || value === undefined || value === '') return fallback

  const n = Number(value)
  if (isNaN(n) || !isFinite(n)) return fallback

  const pct = isDecimal ? n * 100 : n
  return `${pct.toFixed(decimals)}%`
}

// ============================================================
// MOEDA
// ============================================================

/**
 * Formata um valor como moeda brasileira (R$).
 * @param value - número ou string numérica
 * @param fallback - valor quando inválido
 */
export function safeCurrency(
  value: string | number | null | undefined,
  fallback = 'R$ —'
): string {
  if (value === null || value === undefined || value === '') return fallback

  const n = Number(value)
  if (isNaN(n) || !isFinite(n)) return fallback

  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ============================================================
// PLACAS / TAGS
// ============================================================

/**
 * Formata uma placa ou tag de equipamento de forma segura.
 * Nunca retorna undefined/null, sempre em maiúsculas.
 * @param value - string da placa/tag
 * @param fallback - valor quando vazio/inválido
 */
export function safePlate(
  value: string | null | undefined,
  fallback = '—'
): string {
  if (!value || typeof value !== 'string' || value.trim() === '') return fallback
  return value.trim().toUpperCase()
}

// ============================================================
// STRINGS
// ============================================================

/**
 * Retorna uma string segura, nunca undefined/null/[object Object].
 * @param value - qualquer valor
 * @param fallback - valor quando inválido (default: '—')
 */
export function safeStr(
  value: string | null | undefined | unknown,
  fallback = '—'
): string {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return fallback
  const str = String(value).trim()
  return str === '' || str === 'undefined' || str === 'null' || str === 'NaN' ? fallback : str
}

/**
 * Trunca um texto com ellipsis de forma segura.
 * @param value - texto
 * @param maxLength - comprimento máximo
 * @param fallback - valor quando inválido
 */
export function safeTruncate(
  value: string | null | undefined,
  maxLength: number,
  fallback = '—'
): string {
  const str = safeStr(value, fallback)
  if (str === fallback) return fallback
  return str.length > maxLength ? `${str.slice(0, maxLength)}…` : str
}

// ============================================================
// VALIDAÇÃO
// ============================================================

/**
 * Verifica se um valor é uma data válida.
 */
export function isValidDate(value: string | Date | null | undefined): boolean {
  if (!value) return false
  try {
    const date = value instanceof Date ? value : parseISO(String(value))
    return isValid(date)
  } catch {
    return false
  }
}

/**
 * Verifica se um valor é um número válido (não NaN, não Infinity).
 */
export function isValidNumber(value: unknown): boolean {
  const n = Number(value)
  return !isNaN(n) && isFinite(n)
}
