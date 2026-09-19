import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

const envPath = path.resolve('.env.local')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
} else {
  dotenv.config()
}

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials missing')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const year = 2026;
const records = [
  { data_registro: '2026-01-1', volume_litros: 1000, setor: 'GERAL' },
  { data_registro: '2026-01-2', volume_litros: 1000, setor: 'GERAL' },
  { data_registro: '2026-02-1', volume_litros: 1000, setor: 'GERAL' },
  { data_registro: '2026-02-3', volume_litros: 1000, setor: 'GERAL' },
  { data_registro: '2026-03-1', volume_litros: 1000, setor: 'GERAL' },
  { data_registro: '2026-03-3', volume_litros: 1000, setor: 'GERAL' },
  { data_registro: '2026-03-4', volume_litros: 1000, setor: 'GERAL' },
  { data_registro: '2026-04-2', volume_litros: 1000, setor: 'GERAL' },
  { data_registro: '2026-05-1', volume_litros: 1000, setor: 'GERAL' },
  { data_registro: '2026-05-4', volume_litros: 1000, setor: 'GERAL' },
  { data_registro: '2026-06-2', volume_litros: 1000, setor: 'GERAL' },
  { data_registro: '2026-06-4', volume_litros: 1000, setor: 'GERAL' },
  { data_registro: '2026-07-1', volume_litros: 1000, setor: 'GERAL' },
  { data_registro: '2026-07-2', volume_litros: 1000, setor: 'GERAL' },
  { data_registro: '2026-07-4', volume_litros: 1000, setor: 'GERAL' },
  { data_registro: '2026-08-2', volume_litros: 1000, setor: 'GERAL' },
  { data_registro: '2026-08-4', volume_litros: 1000, setor: 'GERAL' }
]

async function run() {
  const { data, error } = await supabase
    .from('caixa_dagua_registros')
    .upsert(records, { onConflict: 'data_registro' })

  if (error) {
    console.error('Error inserting records:', error)
  } else {
    console.log('Records successfully inserted!')
  }
}

run()
