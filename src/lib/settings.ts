import { supabase } from './supabase'

export async function isRegistrationOpen(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', 'registration_open')
      .single()

    if (error || !data) {
      if (error && error.code === 'PGRST116') {
        await setRegistrationOpen(true)
        return true
      }
      return true
    }

    return data.value === true || data.value === 'true'
  } catch (err) {
    console.error('Erro ao buscar status do cadastro:', err)
    return true
  }
}

export async function setRegistrationOpen(isOpen: boolean): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('global_settings')
      .upsert({
        key: 'registration_open',
        value: isOpen,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })
      
    if (error) {
      console.error('Erro ao salvar status do cadastro:', error)
      return false
    }
    return true
  } catch (err) {
    console.error('Erro ao salvar status do cadastro:', err)
    return false
  }
}

export type WhatsappSettings = {
  url: string;
  instanceId: string;
  token: string;
  groupId: string;
  interval: number;
  ddsReminders?: {
    enabled_0600: boolean;
    enabled_1600: boolean;
    specificGroupId: string;
  };
  requisitionAlerts?: {
    enabled: boolean;
    specificGroupId: string;
  };
}

const defaultWhatsappSettings: WhatsappSettings = {
  url: '',
  instanceId: '',
  token: '',
  groupId: '',
  interval: 30,
  ddsReminders: {
    enabled_0600: false,
    enabled_1600: false,
    specificGroupId: ''
  },
  requisitionAlerts: {
    enabled: false,
    specificGroupId: ''
  }
}

export async function getWhatsappSettings(): Promise<WhatsappSettings> {
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', 'whatsapp_settings')
      .single()

    if (error || !data) {
      return defaultWhatsappSettings
    }

    return { ...defaultWhatsappSettings, ...(data.value as any) }
  } catch (err) {
    console.error('Erro ao buscar configs do whatsapp:', err)
    return defaultWhatsappSettings
  }
}

export async function saveWhatsappSettings(settings: WhatsappSettings): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('global_settings')
      .upsert({
        key: 'whatsapp_settings',
        value: settings,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })
      
    if (error) {
      console.error('Erro ao salvar configs do whatsapp:', error)
      return false
    }
    return true
  } catch (err) {
    console.error('Erro ao salvar configs do whatsapp:', err)
    return false
  }
}

