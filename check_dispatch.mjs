const { createClient } = await import('@supabase/supabase-js')

const SUPABASE_URL = 'https://svacqjpyjniejqfmuwhl.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2YWNxanB5am5pZWpxZm11d2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNjQ1NTEsImV4cCI6MjEwMzk0MDU1MX0.P9bIBEhpyn42g3WVo7owIt87p9f4Vzx1xtq2aCzmDkc'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const { data, error } = await supabase
  .from('eq_driver_dispatch')
  .select('id, equipment_id, driver_id, shift_start_time, shift_end_time, status')
  .order('shift_start_time', { ascending: false })
  .limit(10)

if (error) {
  console.error('Erro:', error)
} else {
  console.log('Dispatches recentes:', JSON.stringify(data, null, 2))
}
