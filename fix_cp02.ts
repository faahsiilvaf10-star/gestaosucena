import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function fix() {
  const { data, error } = await supabase
    .from('eq_equipments')
    .update({ location_status: 'outside' })
    .eq('name', 'CP 02')
    
  console.log('Update CP 02:', data, error)
  
  // E também o CP 07 por garantia se ele tiver ficado preso
  const { data: data2, error: err2 } = await supabase
    .from('eq_equipments')
    .update({ location_status: 'outside' })
    .eq('name', 'CP 07')
    
  console.log('Update CP 07:', data2, err2)
}

fix()
