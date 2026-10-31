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
    const env = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena';

    let resolvedUserName = user_name?.trim();

    // Se não veio nome ou veio genérico, resolve pelo usuário logado
    if (
      !resolvedUserName ||
      resolvedUserName.toLowerCase() === 'sistema' ||
      resolvedUserName.toLowerCase().startsWith('sistema') ||
      resolvedUserName.toLowerCase().startsWith('usuário') ||
      resolvedUserName.toLowerCase().startsWith('usuario')
    ) {
      try {
        const { data } = await supabase.auth.getUser();
        const u = data?.user;
        if (u) {
          resolvedUserName =
            u.user_metadata?.full_name ||
            u.user_metadata?.name ||
            (u.email ? u.email.split('@')[0] : '');
        }
      } catch (_) {}

      if (!resolvedUserName && typeof window !== 'undefined') {
        resolvedUserName = localStorage.getItem('sucena_user_name') || '';
      }

      // Se ainda assim não identificou, aplica o responsável padrão do módulo
      if (!resolvedUserName || resolvedUserName.toLowerCase() === 'sistema') {
        if (module === 'Segurança') resolvedUserName = 'Alexssandro Chaves';
        else resolvedUserName = 'Fabrício Silva';
      }
    }

    const { error } = await supabase.from('system_activities').insert({
      module,
      action,
      description: description || null,
      user_name: resolvedUserName,
      environment: env
    });
    
    if (error) {
      console.error('Erro ao registrar atividade:', error);
    }
  } catch (err) {
    console.error('Falha ao registrar atividade global:', err);
  }
}
