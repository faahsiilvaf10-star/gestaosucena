import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('eq_movements')
    .select('*, eq_equipments(name, plate_tag)')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error("Join error:", error);
    // try fallback
    const { data: d2 } = await supabase.from('eq_movements').select('*').limit(2);
    console.log("Fallback:", d2);
  } else {
    console.log("Join works:", JSON.stringify(data, null, 2));
  }
}
run();
