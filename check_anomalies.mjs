import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read env variables (mocking how we get them usually, or hardcode if we know them)
const envFile = fs.readFileSync('.env', 'utf8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: dispatches } = await supabase.from('eq_driver_dispatch').select('*').order('created_at', { ascending: false }).limit(5);
  console.log("Recent dispatches:", dispatches.map(d => ({id: d.id, date: d.created_at, status: d.status})));
  
  if (dispatches.length > 0) {
    const dispatchId = dispatches[0].id;
    const { data: history } = await supabase.from('eq_status_history').select('*').eq('dispatch_id', dispatchId);
    console.log("History for latest dispatch:", history);

    const { data: checks } = await supabase.from('eq_checklists').select('*').eq('dispatch_id', dispatchId);
    console.log("Checklists for latest dispatch:", checks);
  }
}
check();
