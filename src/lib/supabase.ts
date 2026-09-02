import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Credenciais do Supabase não encontradas. Por favor, adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no seu arquivo .env'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
