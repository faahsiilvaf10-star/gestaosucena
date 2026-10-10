import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl!, supabaseAnonKey!)

async function check() {
  const { data, error } = await supabase.from('rh_efetivo').select('*').limit(1)
  console.log(Object.keys(data?.[0] || {}))
}
check()
