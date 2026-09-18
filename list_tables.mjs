import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.log("Missing Supabase credentials in .env")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function getTables() {
  const { data, error } = await supabase.rpc('get_tables_names') // If RPC exists, otherwise we just query information_schema or run a dummy select on known tables
  console.log("RPC get_tables_names:", data, error)
}
getTables()
