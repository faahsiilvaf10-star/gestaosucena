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

export const supabase = new Proxy(rawSupabase, {
  get(target: any, prop: string) {
    if (prop === 'from') {
      return (table: string) => {
        const query = target.from(table);
        
        if (tablesWithEnv.includes(table)) {
          const getEnv = () => typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena';
          
          const originalSelect = query.select.bind(query);
          query.select = (...args: any[]) => {
            return originalSelect(...args).eq('environment', getEnv());
          };
          
          const originalInsert = query.insert.bind(query);
          query.insert = (data: any, ...args: any[]) => {
            const env = getEnv();
            const dataWithEnv = Array.isArray(data) 
              ? data.map(d => ({ ...d, environment: env })) 
              : { ...data, environment: env };
            return originalInsert(dataWithEnv, ...args);
          };

          const originalUpsert = query.upsert.bind(query);
          query.upsert = (data: any, ...args: any[]) => {
            const env = getEnv();
            const dataWithEnv = Array.isArray(data) 
              ? data.map(d => ({ ...d, environment: env })) 
              : { ...data, environment: env };
            return originalUpsert(dataWithEnv, ...args);
          };

          const originalUpdate = query.update.bind(query);
          query.update = (data: any, ...args: any[]) => {
            return originalUpdate(data, ...args).eq('environment', getEnv());
          };

          const originalDelete = query.delete.bind(query);
          query.delete = (...args: any[]) => {
            return originalDelete(...args).eq('environment', getEnv());
          };
        }
        
        return query;
      };
    }
    
    // Bind functions to the original target to preserve 'this' context
    const value = target[prop];
    return typeof value === 'function' ? value.bind(target) : value;
  }
});
