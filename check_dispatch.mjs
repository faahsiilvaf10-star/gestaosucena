const { createClient } = await import('@supabase/supabase-js')

const SUPABASE_URL = 'https://svacqjpyjniejqfmuwhl.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2YWNxanB5am5pZWpxZm11d2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNjQ1NTEsImV4cCI6MjEwMzk0MDU1MX0.P9bIBEhpyn42g3WVo7owIt87p9f4Vzx1xtq2aCzmDkc'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Check dispatch odometer/horimeter
const { data: disp } = await supabase
  .from('eq_driver_dispatch')
  .select('id, odometer_start, odometer_end, horimeter_start, horimeter_end')
  .eq('id', '378721fc-3e1f-4e7d-a80d-d0cd78461028')
console.log('Dispatch KM/Horimetro:', JSON.stringify(disp, null, 2))

// Check equipment table
const { data: eq } = await supabase
  .from('equipamentos')
  .select('id, name, current_km, current_horimeter')
  .eq('id', '44842a45-f510-4367-8016-77cc31537ea1')
console.log('Equipment KM/Horimetro:', JSON.stringify(eq, null, 2))
