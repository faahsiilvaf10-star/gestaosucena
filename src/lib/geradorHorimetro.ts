import { supabase } from './supabase'
import { notificarGeradorHorimetroManutencao } from './geradorHorimetroWhatsapp'
import { getWhatsappSettings } from './settings'

export interface GeradorHorimetroHistoryItem {
  id: string
  date: string
  horimeter: number
  nextMaintenance: number
  remainingHours: number
  userName: string
  notes?: string
}

export interface GeradorHorimetroData {
  equipmentId?: string
  name: string
  plate_tag: string
  currentHorimeter: number
  nextMaintenanceHorimeter: number
  alertHoursThreshold: number // Default 20h
  lastUpdated: string
  updatedBy: string
  lastWhatsappSentCycle?: number | null // Armazena o nextMaintenanceHorimeter para o qual já disparou
  history: GeradorHorimetroHistoryItem[]
}

const DEFAULT_ALERT_HOURS = 20

export function calcHorasRestantes(atual: number, proximo: number): number {
  return Number((proximo - atual).toFixed(1))
}

export function getStatusGerador(
  atual: number,
  proximo: number,
  threshold: number = DEFAULT_ALERT_HOURS
): 'normal' | 'alerta' | 'vencido' {
  const rest = calcHorasRestantes(atual, proximo)
  if (rest <= 0) return 'vencido'
  if (rest <= threshold) return 'alerta'
  return 'normal'
}

function getStorageKey(env?: string): string {
  const targetEnv =
    env ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('sucena_environment') || 'barcarena'
      : 'barcarena')
  return `gerador_horimetro_${targetEnv}`
}

export const GERADOR_HORIMETRO_UPDATED_EVENT = 'gerador_horimetro_updated'

/**
 * Obtém os dados de horímetro do gerador para o ambiente informado
 */
export async function getGeradorHorimetro(env?: string): Promise<GeradorHorimetroData> {
  const key = getStorageKey(env)
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.warn('Erro ao carregar gerador_horimetro:', error)
    }

    if (data?.value) {
      let parsed = data.value
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed)
        } catch {
          // fallback
        }
      }
      return {
        equipmentId: parsed.equipmentId || '1068c95d-23ea-448a-b1a8-bdf4b1f04d0b',
        name: parsed.name || 'GERADOR',
        plate_tag: parsed.plate_tag || 'E9A4808',
        currentHorimeter: Number(parsed.currentHorimeter || 0),
        nextMaintenanceHorimeter: Number(parsed.nextMaintenanceHorimeter || 250),
        alertHoursThreshold: Number(parsed.alertHoursThreshold || DEFAULT_ALERT_HOURS),
        lastUpdated: parsed.lastUpdated || new Date().toISOString(),
        updatedBy: parsed.updatedBy || 'Sistema',
        lastWhatsappSentCycle: parsed.lastWhatsappSentCycle ?? null,
        history: Array.isArray(parsed.history) ? parsed.history : []
      }
    }
  } catch (err) {
    console.error('Falha ao obter horímetro do gerador:', err)
  }

  // Padrão inicial caso ainda não haja registro salvo
  return {
    equipmentId: '1068c95d-23ea-448a-b1a8-bdf4b1f04d0b',
    name: 'GERADOR',
    plate_tag: 'E9A4808',
    currentHorimeter: 0,
    nextMaintenanceHorimeter: 250,
    alertHoursThreshold: DEFAULT_ALERT_HOURS,
    lastUpdated: new Date().toISOString(),
    updatedBy: 'Sistema',
    lastWhatsappSentCycle: null,
    history: []
  }
}

/**
 * Salva e atualiza o horímetro atual e/ou próximo horímetro de manutenção do gerador,
 * gravando histórico e verificando se deve enviar notificação no WhatsApp.
 */
export async function saveGeradorHorimetro(
  payload: {
    currentHorimeter: number
    nextMaintenanceHorimeter?: number
    alertHoursThreshold?: number
    notes?: string
    equipmentId?: string
    name?: string
    plate_tag?: string
  },
  env?: string,
  userName?: string
): Promise<{
  success: boolean
  data: GeradorHorimetroData
  whatsappSent: boolean
  error?: string
}> {
  try {
    const key = getStorageKey(env)
    const current = await getGeradorHorimetro(env)

    const updatedCurrentHorimeter = Number(payload.currentHorimeter)
    const updatedNextMaintenance = Number(
      payload.nextMaintenanceHorimeter !== undefined && payload.nextMaintenanceHorimeter !== null
        ? payload.nextMaintenanceHorimeter
        : current.nextMaintenanceHorimeter
    )

    // Se as configurações do WhatsApp definirem um alertHours, use-o como fallback
    let configuredAlertHours = payload.alertHoursThreshold || current.alertHoursThreshold || DEFAULT_ALERT_HOURS
    try {
      const waSettings = await getWhatsappSettings(env)
      if (waSettings.geradorManutencao?.alertHours) {
        configuredAlertHours = waSettings.geradorManutencao.alertHours
      }
    } catch {
      // ignore
    }

    const remaining = calcHorasRestantes(updatedCurrentHorimeter, updatedNextMaintenance)
    const nowIso = new Date().toISOString()
    const finalUserName = userName || 'Usuário do Sistema'

    const newHistoryItem: GeradorHorimetroHistoryItem = {
      id: Math.random().toString(36).substring(2, 11),
      date: nowIso,
      horimeter: updatedCurrentHorimeter,
      nextMaintenance: updatedNextMaintenance,
      remainingHours: remaining,
      userName: finalUserName,
      notes: payload.notes?.trim() || undefined
    }

    const updatedHistory = [newHistoryItem, ...(current.history || [])].slice(0, 50)

    let whatsappSent = false
    let lastWhatsappSentCycle = current.lastWhatsappSentCycle ?? null

    // Regra de Envio do WhatsApp:
    // Dispara quando faltarem <= alertHoursThreshold (ex: 20h) OU se já estiver vencido (remaining <= 0).
    // Para não reenviar a cada digitação no mesmo ciclo, checa se já enviou para este mesmo `nextMaintenanceHorimeter`
    // (a menos que a manutenção tenha sido redefinida para um novo ciclo).
    const isMaintenanceCycleNew = lastWhatsappSentCycle !== updatedNextMaintenance
    const shouldAlert = remaining <= configuredAlertHours

    if (shouldAlert && isMaintenanceCycleNew) {
      whatsappSent = await notificarGeradorHorimetroManutencao({
        eqName: payload.name || current.name || 'GERADOR',
        plateTag: payload.plate_tag || current.plate_tag || 'E9A4808',
        currentHorimeter: updatedCurrentHorimeter,
        nextMaintenanceHorimeter: updatedNextMaintenance,
        remainingHours: remaining,
        userName: finalUserName,
        force: false
      })
      if (whatsappSent) {
        lastWhatsappSentCycle = updatedNextMaintenance
      }
    }

    const dataToSave: GeradorHorimetroData = {
      equipmentId: payload.equipmentId || current.equipmentId,
      name: payload.name || current.name || 'GERADOR',
      plate_tag: payload.plate_tag || current.plate_tag || 'E9A4808',
      currentHorimeter: updatedCurrentHorimeter,
      nextMaintenanceHorimeter: updatedNextMaintenance,
      alertHoursThreshold: configuredAlertHours,
      lastUpdated: nowIso,
      updatedBy: finalUserName,
      lastWhatsappSentCycle,
      history: updatedHistory
    }

    const { error: upsertError } = await supabase.from('global_settings').upsert(
      {
        key,
        value: dataToSave,
        updated_at: nowIso
      },
      { onConflict: 'key' }
    )

    if (upsertError) throw upsertError

    // Realtime broadcast & local custom event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(GERADOR_HORIMETRO_UPDATED_EVENT, { detail: dataToSave })
      )
    }

    return {
      success: true,
      data: dataToSave,
      whatsappSent
    }
  } catch (error: any) {
    console.error('Erro ao salvar horímetro do gerador:', error)
    return {
      success: false,
      data: await getGeradorHorimetro(env),
      whatsappSent: false,
      error: error?.message || 'Erro desconhecido ao salvar horímetro'
    }
  }
}

/**
 * Permite disparo manual de alerta no WhatsApp sob demanda (para testes ou reenvio)
 */
export async function reenviarAlertaWhatsappGerador(
  data: GeradorHorimetroData,
  userName?: string
): Promise<boolean> {
  const remaining = calcHorasRestantes(data.currentHorimeter, data.nextMaintenanceHorimeter)
  return await notificarGeradorHorimetroManutencao({
    eqName: data.name || 'GERADOR',
    plateTag: data.plate_tag || 'E9A4808',
    currentHorimeter: data.currentHorimeter,
    nextMaintenanceHorimeter: data.nextMaintenanceHorimeter,
    remainingHours: remaining,
    userName: userName || data.updatedBy || 'Sistema',
    force: true
  })
}
