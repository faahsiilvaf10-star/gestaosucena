import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase
        .from('rh_efetivo')
        .select('id, nome, status')
        .ilike('status', '%ativo%')
        .limit(5);
    
    console.log("Com filtro:", data, error);

    const { data: allData, error: err2 } = await supabase
        .from('rh_efetivo')
        .select('id, nome, status')
        .limit(5);

    console.log("Sem filtro:", allData, err2);
}

run();
