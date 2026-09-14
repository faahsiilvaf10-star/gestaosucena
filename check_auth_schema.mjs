import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '.env')
const envContent = fs.readFileSync(envPath, 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=')
  if (key) env[key.trim()] = vals.join('=').trim()
})

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY'])

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', { query: "SELECT column_name FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users';" })
  console.log('Columns:', data || error)
}
run()
