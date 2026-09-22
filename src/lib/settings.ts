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
  appMotoristaAlerts?: {
    enabled: boolean;
    specificGroupId: string;
  };
  equipamentosMovimentacao?: {
    enabled: boolean;
    specificGroupId: string;
  };
  cintasInspection?: {
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
    anomaliaRegistrada: string;
    anomaliaCorrigida: string;
    statusAlterado: string;
    cintasAvisoMensal: string;
    cintasInspecionada: string;
    equipamentoEntrada: string;
    equipamentoSaida: string;
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
  appMotoristaAlerts: {
    enabled: true,
    specificGroupId: ''
  },
  equipamentosMovimentacao: {
    enabled: false,
    specificGroupId: ''
  },
  cintasInspection: {
    enabled: false,
    specificGroupId: ''
  },
  messageTemplates: {
    ddsHoje: '🎤 *Lembrete DDS - Hoje*\n\n👤 *Palestrante:* {palestrante}\n📅 *Data:* {data} (hoje)\n📋 {tema}\n\n_Mensagem automática - Sucena_',
    ddsAmanha: '🎤 *Aviso Prévio DDS - Amanhã*\n\n👤 *Palestrante:* {palestrante}\n📅 *Data:* {data} (amanhã)\n📋 {tema}\n\n_Mensagem automática - Sucena_',
    lembreteHoje: '🔔 *Lembrete Automático*\n\n📌 *{titulo}*\n_{descricao}_\n\n📅 Data: {data}\n⏰ Horário: {hora}',
    lembreteAmanha: '⏳ *Aviso Antecipado de Lembrete*\n\n📌 *{titulo}*\n_{descricao}_\n\n📅 Data: {data}\n⏰ Horário: {hora}',
    listaPresenca: '📅 Data: {data}\n\n✳️  {area}  ✳️\n\n{lista_nomes}\n───────────────────────────\n{resumo}',
    requisicaoEpi: '🦺 *TROCA DE EPI*\n\n📅 *Data:* {data}\n👤 *Funcionário:* {nome}\n💼 *Função:* {cargo}\n🆔 *Matrícula:* {matricula}\n📝 *Motivo:* {motivo}\n✅ *Autorizado por:* {autorizador} ({matricula_autorizador})\n\n*Itens:*\n{itens}',
    anomaliaRegistrada: '🚨 *NOVA ANOMALIA REPORTADA* 🚨\n\n⏰ *Hora:* {hora}\n🚜 *Equipamento:* {equipamento}\n🏷️ *Tag:* {tag}\n🚙 *Placa:* {placa}\n\n⚠️ *Anomalia:* {anomalia}\n📝 *Descrição:* {descricao}\n👤 *Motorista:* {motorista}',
    anomaliaCorrigida: '✅ *ANOMALIA CORRIGIDA* ✅\n\n⏰ *Hora:* {hora}\n🚜 *Equipamento:* {equipamento}\n🏷️ *Tag:* {tag}\n🚙 *Placa:* {placa}\n\n⚠️ *Resolvido:* {anomalia}\n👤 *Motorista:* {motorista}',
    statusAlterado: '🚜 *MUDANÇA DE STATUS* 🚜\n\n⏰ *Hora:* {hora}\n🚜 *Equipamento:* {equipamento}\n🏷️ *Tag:* {tag}\n🚙 *Placa:* {placa}\n\n🔄 *Novo Status:* {status}\n👤 *Motorista:* {motorista}',
    cintasAvisoMensal: '🔗 *AVISO DE INSPEÇÃO MENSAL DE CINTAS*\n\n📅 *Mês:* {mes}\n🎨 *Cor do mês:* {cor}\n\n⚠️ As seguintes cintas precisam ser inspecionadas:\n{lista_cintas}\n\n_Por favor, realize a inspeção e registre no sistema._\n\n_Mensagem automática - Sucena_',
    cintasInspecionada: '✅ *INSPEÇÃO DE CINTA REGISTRADA*\n\n🔗 *Tag:* {tag}\n📋 *Descrição:* {descricao}\n🎨 *Cor:* {cor}\n📅 *Data:* {data}\n👤 *Responsável:* {responsavel}\n\n_Mensagem automática - Sucena_',
    equipamentoEntrada: '🚜 *ENTRADA DE EQUIPAMENTO*\n\n⏰ *Hora:* {hora}\n🚜 *Equipamento:* {equipamento}\n🚙 *Placa:* {placa}\n\n_Mensagem automática - Sucena_',
    equipamentoSaida: '🚜 *SAÍDA DE EQUIPAMENTO*\n\n⏰ *Hora:* {hora}\n🚜 *Equipamento:* {equipamento}\n🚙 *Placa:* {placa}\n\n⚠️ *Motivo:* {motivo}\n\n_Mensagem automática - Sucena_'
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

    const loaded = data.value as any
    return {
      ...defaultWhatsappSettings,
      ...loaded,
      // Deep merge messageTemplates so new keys always fall back to defaults
      messageTemplates: {
        ...defaultWhatsappSettings.messageTemplates,
        ...(loaded.messageTemplates || {})
      }
    }
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

export type EquipmentActivity = {
  id: string;
  name: string;
  icon: string;
  color: string;
  categories: string[];
};

export async function getEquipmentActivities(): Promise<EquipmentActivity[]> {
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', 'equipment_activities')
      .single()

    if (error || !data) {
      return [
        { id: '1', name: 'Lavagem Mirante', icon: 'Waves', color: 'bg-zinc-900 border border-zinc-800 text-white', categories: [] },
        { id: '2', name: 'Irrigação Carretel', icon: 'Droplet', color: 'bg-white border border-gray-200 text-gray-900', categories: [] },
        { id: '3', name: 'Irrigação Faixa 3', icon: 'Sprout', color: 'bg-zinc-900 border border-zinc-800 text-white', categories: [] },
        { id: '4', name: 'Irrigação Faixa 4', icon: 'Sprout', color: 'bg-white border border-gray-200 text-gray-900', categories: [] },
        { id: '5', name: 'Irrigação Faixa 5', icon: 'Sprout', color: 'bg-zinc-900 border border-zinc-800 text-white', categories: [] },
        { id: '6', name: 'Abastecimento do Tanque de Irrigação', icon: 'Fuel', color: 'bg-white border border-gray-200 text-gray-900', categories: [] },
        { id: '7', name: 'Lavagem Vertedouro', icon: 'Waves', color: 'bg-zinc-900 border border-zinc-800 text-white', categories: [] },
        { id: '8', name: 'Umectação de Vias', icon: 'CloudRain', color: 'bg-white border border-gray-200 text-gray-900', categories: [] },
        { id: '9', name: 'Lavagem de Carro', icon: 'Car', color: 'bg-zinc-900 border border-zinc-800 text-white', categories: [] },
      ]
    }

    return data.value as EquipmentActivity[]
  } catch (err) {
    console.error('Erro ao buscar atividades:', err)
    return []
  }
}

export async function setEquipmentActivities(activities: EquipmentActivity[]): Promise<{success: boolean, error?: string}> {
  try {
    const { error } = await supabase
      .from('global_settings')
      .upsert({
        key: 'equipment_activities',
        value: activities,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })
      
    if (error) {
      console.error('Erro ao salvar atividades:', error)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err: any) {
    console.error('Erro ao salvar atividades:', err)
    return { success: false, error: err.message }
  }
}
