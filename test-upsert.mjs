import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function run() {
  const { data, error } = await supabase
    .from('pluviometria_registros')
    .upsert([{ data_registro: '2026-01-01', volume_mm: 10, setor: 'CAMPO' }], { onConflict: 'data_registro' })
  
  console.log('Result:', data, error)
}

run()
