import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data, error } = await supabase.rpc('admin_list_users')
  console.log('Error:', error)
  console.log('All users from admin_list_users:')
  data?.forEach(u => console.log(u.name + ' - ' + u.role))
}
check()
