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
  adminPhone?: string;
  ddsReminders?: {
    enabled_0600: boolean;
    enabled_1600: boolean;
    specificGroupId: string;
  };
  requisitionAlerts?: {
    enabled: boolean;
    specificGroupId: string;
  };
  reminders?: {
    enabled: boolean;
    specificGroupId: string;
  };
  attendanceAlerts?: {
    enabled: boolean;
    specificGroupId: string;
  };
  messageTemplates?: {
    ddsHoje: string;
    ddsAmanha: string;
    lembreteHoje: string;
    lembreteAmanha: string;
    listaPresenca: string;
    requisicaoEpi: string;
  };
}

const defaultWhatsappSettings: WhatsappSettings = {
  url: '',
  instanceId: '',
  token: '',
  groupId: '',
  interval: 30,
  adminPhone: '',
  ddsReminders: {
    enabled_0600: false,
    enabled_1600: false,
    specificGroupId: ''
  },
  requisitionAlerts: {
    enabled: false,
    specificGroupId: ''
  },
  reminders: {
    enabled: false,
    specificGroupId: ''
  },
  attendanceAlerts: {
    enabled: false,
    specificGroupId: ''
  },
  messageTemplates: {
    ddsHoje: '🎤 *Lembrete DDS - Hoje*\n\n👤 *Palestrante:* {palestrante}\n📅 *Data:* {data} (hoje)\n📋 {tema}\n\n_Mensagem automática - Sucena_',
    ddsAmanha: '🎤 *Aviso Prévio DDS - Amanhã*\n\n👤 *Palestrante:* {palestrante}\n📅 *Data:* {data} (amanhã)\n📋 {tema}\n\n_Mensagem automática - Sucena_',
    lembreteHoje: '🔔 *Lembrete Automático*\n\n📌 *{titulo}*\n_{descricao}_\n\n📅 Data: {data}\n⏰ Horário: {hora}',
    lembreteAmanha: '⏳ *Aviso Antecipado de Lembrete*\n\n📌 *{titulo}*\n_{descricao}_\n\n📅 Data: {data}\n⏰ Horário: {hora}',
    listaPresenca: '📅 Data: {data}\n\n✳️  {area}  ✳️\n\n{lista_nomes}\n───────────────────────────\n{resumo}',
    requisicaoEpi: '🦺 *TROCA DE EPI*\n\n📅 *Data:* {data}\n👤 *Funcionário:* {nome}\n💼 *Função:* {cargo}\n🆔 *Matrícula:* {matricula}\n📝 *Motivo:* {motivo}\n✅ *Autorizado por:* {autorizador} ({matricula_autorizador})\n\n*Itens:*\n{itens}'
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

export async function saveWhatsappSettings(settings: WhatsappSettings): Promise<{success: boolean, error?: string}> {
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
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err: any) {
    console.error('Erro ao salvar configs do whatsapp:', err)
    return { success: false, error: err.message }
  }
}

