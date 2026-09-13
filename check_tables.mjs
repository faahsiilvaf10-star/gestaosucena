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
  const tables = ['usuarios', 'users', 'profiles', 'rh_efetivo', 'auth.users']
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('id').limit(1)
    if (error) {
      console.log(`Error querying ${t}:`, error.message)
    } else {
      console.log(`Success! ${t} exists.`)
    }
  }
}
run()
