import { supabase } from './supabase';

type ModuleType = 'RH' | 'Equipamentos' | 'Almoxarifado' | 'Segurança' | 'RDO' | 'Meio Ambiente' | 'Admin' | 'Geral';

interface LogOptions {
  module: ModuleType;
  action: string;
  description?: string;
  user_name?: string;
}

/**
 * Registra uma atividade no sistema na tabela global `system_activities`.
 * Essa tabela é usada para o feed em tempo real no Dashboard.
 */
export async function logActivity({ module, action, description, user_name }: LogOptions) {
  try {
    const { error } = await supabase.from('system_activities').insert({
      module,
      action,
      description: description || null,
      user_name: user_name || 'Sistema'
    });
    
    if (error) {
      console.error('Erro ao registrar atividade:', error);
    }
  } catch (err) {
    console.error('Falha ao registrar atividade global:', err);
  }
}
