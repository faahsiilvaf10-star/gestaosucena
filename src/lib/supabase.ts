import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Credenciais do Supabase não encontradas. Por favor, adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no seu arquivo .env'
  )
}

const rawSupabase = createClient(supabaseUrl, supabaseAnonKey)

const tablesWithEnv = [
  'al_epi_requisitions',
  'al_products',
  'al_purchase_orders',
  'doc_arquivos',
  'eq_equipments',
  'eq_movements',
  'rh_efetivo',
  'rh_presencas',
  'seguranca_dds',
  'system_activities'
];

export const supabase = {
  ...rawSupabase,
  from: (table: string) => {
    const query = rawSupabase.from(table as any);
    
    if (tablesWithEnv.includes(table)) {
      const getEnv = () => typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena';
      
      const originalSelect = query.select.bind(query);
      (query as any).select = (...args: any[]) => {
        return originalSelect(...args).eq('environment', getEnv());
      };
      
      const originalInsert = query.insert.bind(query);
      (query as any).insert = (data: any, ...args: any[]) => {
        const env = getEnv();
        const dataWithEnv = Array.isArray(data) 
          ? data.map(d => ({ ...d, environment: env })) 
          : { ...data, environment: env };
        return originalInsert(dataWithEnv, ...args);
      };

      const originalUpsert = query.upsert.bind(query);
      (query as any).upsert = (data: any, ...args: any[]) => {
        const env = getEnv();
        const dataWithEnv = Array.isArray(data) 
          ? data.map(d => ({ ...d, environment: env })) 
          : { ...data, environment: env };
        return originalUpsert(dataWithEnv, ...args);
      };

      const originalUpdate = query.update.bind(query);
      (query as any).update = (data: any, ...args: any[]) => {
        return originalUpdate(data, ...args).eq('environment', getEnv());
      };

      const originalDelete = query.delete.bind(query);
      (query as any).delete = (...args: any[]) => {
        return originalDelete(...args).eq('environment', getEnv());
      };
    }
    
    return query;
  }
} as any;
