import { supabase } from './supabase'

/**
 * Retorna o nome de exibição do usuário atualmente autenticado com múltiplos fallbacks:
 * 1. Sessão ativa em memória / localStorage (rápido e à prova de falha de rede)
 * 2. user.user_metadata (full_name, name, nome, display_name)
 * 3. Tabela social_profiles
 * 4. Cache sucena_user_name em localStorage
 * 5. Parte local do e-mail
 */
export async function getAuthenticatedUserName(): Promise<string> {
  try {
    // 1. Tentar ler da sessão ativa (localStorage / cache em memória)
    const { data: sessionData } = await supabase.auth.getSession()
    const sessionUser = sessionData?.session?.user

    // 2. Se não houver sessão imediata, tentar getUser()
    const user = sessionUser || (await supabase.auth.getUser()).data?.user

    if (user) {
      const meta = user.user_metadata || {}
      const metaName = meta.full_name || meta.name || meta.nome || meta.display_name
      if (metaName && typeof metaName === 'string' && metaName.trim() && metaName.trim() !== 'Usuário Logado') {
        const clean = metaName.trim()
        try {
          if (typeof window !== 'undefined') localStorage.setItem('sucena_user_name', clean)
        } catch (_) {}
        return clean
      }

      // 3. Tentar na tabela social_profiles
      try {
        const { data: profile } = await supabase
          .from('social_profiles')
          .select('display_name, username')
          .eq('user_id', user.id)
          .maybeSingle()

        if (profile?.display_name && profile.display_name !== 'Usuário' && profile.display_name !== 'Usuário Logado') {
          const clean = profile.display_name.trim()
          try {
            if (typeof window !== 'undefined') localStorage.setItem('sucena_user_name', clean)
          } catch (_) {}
          return clean
        }

        if (profile?.username && !profile.username.startsWith('user_')) {
          const clean = profile.username.trim()
          try {
            if (typeof window !== 'undefined') localStorage.setItem('sucena_user_name', clean)
          } catch (_) {}
          return clean
        }
      } catch (_) {}

      // 4. E-mail se houver
      if (user.email) {
        const emailName = user.email.split('@')[0]
        if (emailName && emailName.toLowerCase() !== 'usuario') {
          return emailName
        }
      }
    }

    // 5. Cache de localStorage
    const cachedName = typeof window !== 'undefined' ? localStorage.getItem('sucena_user_name') : null
    if (cachedName && cachedName !== 'Usuário Logado' && cachedName !== 'Usuário') {
      return cachedName
    }

    // 6. Motorista se estiver logado no app motorista
    const driverData = typeof window !== 'undefined' ? localStorage.getItem('app_motorista_driver') : null
    if (driverData) {
      try {
        const parsed = JSON.parse(driverData)
        if (parsed.name) return parsed.name
      } catch (_) {}
    }

    return 'Portaria / Operador'
  } catch (err) {
    console.warn('Erro ao obter nome do usuário autenticado:', err)
    return (typeof window !== 'undefined' ? localStorage.getItem('sucena_user_name') : null) || 'Portaria / Operador'
  }
}
