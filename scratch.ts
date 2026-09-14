import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://svacqjpyjniejqfmuwhl.supabase.co', 'sb_publishable_OhDMp29ICi6tpYWqBT67tQ_EJ1cAla0')

async function run() {
  const { data, error } = await supabase.from('eq_equipments').select('*').like('name', 'CP%')
  if (error) console.error(error)
  else console.log(JSON.stringify(data, null, 2))
}
run()
