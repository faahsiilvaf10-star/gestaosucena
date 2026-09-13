import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL_HERE'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_KEY_HERE'
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  console.log('Querying eq_equipments status...')
}

test()
