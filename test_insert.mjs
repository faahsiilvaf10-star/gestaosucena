import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  const payload = {
    dispatch_id: 'a2014f32-e6e0-4db4-9c19-c4e5adf519be',
    equipment_id: '44842a45-f510-4367-8016-77cc31537ea1',
    driver_id: 'EM',
    previous_status: 'Jornada Iniciada',
    new_status: 'Anomalia Pneus: DE',
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from('eq_status_history').insert(payload);
  console.log("Insert result:", { data, error });
}
testInsert();
