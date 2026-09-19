import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from('pluviometria_registros')
    .upsert([{ data_registro: '2026-01-01', volume_mm: 10, setor: 'CAMPO' }], { onConflict: 'data_registro' });
  console.log('With data_registro:', error);

  const { data: d2, error: e2 } = await supabase
    .from('pluviometria_registros')
    .upsert([{ data_registro: '2026-01-01', volume_mm: 10, setor: 'CAMPO' }], { onConflict: 'data_registro, setor' });
  console.log('With data_registro, setor:', e2);
}

run();
