import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Try to parse .env or .env.local
let envContent = '';
try { envContent = fs.readFileSync('.env', 'utf-8'); } catch(e) {}
if (!envContent) {
  try { envContent = fs.readFileSync('.env.local', 'utf-8'); } catch(e) {}
}

const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v) env[k.trim()] = v.join('=').trim().replace(/'/g, '').replace(/"/g, '');
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];

if (!supabaseKey) {
  console.log('No supabase key found');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Get CP 01
  const { data: eq } = await supabase.from('eq_equipments').select('*').ilike('name', 'CP 01').single();
  if (!eq) {
    console.log('CP 01 not found');
    return;
  }
  console.log('Equipment ID:', eq.id);
  
  // Get recent dispatches
  const { data: dispatches } = await supabase.from('eq_driver_dispatch')
    .select('*')
    .eq('equipment_id', eq.id)
    .order('shift_start_time', { ascending: false })
    .limit(3);
    
  console.log('Recent dispatches:', JSON.stringify(dispatches, null, 2));

  if (dispatches && dispatches.length > 0) {
    const { data: history } = await supabase.from('eq_status_history')
      .select('*')
      .eq('dispatch_id', dispatches[0].id)
      .order('created_at', { ascending: true });
      
    console.log('History for latest dispatch:', JSON.stringify(history, null, 2));
  }
}

check();
