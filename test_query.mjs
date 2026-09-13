import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing URL or KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  console.log("Fetching rh_efetivo...")
  const { data, error } = await supabase
    .from('rh_efetivo')
    .select('id, nome, cargo, avatar_url, status')
    .limit(5)
  
  if (error) {
    console.error("Error:", error)
  } else {
    console.log("Data:", data)
  }
}

test()
