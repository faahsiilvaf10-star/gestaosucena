import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://svacqjpyjniejqfmuwhl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2YWNxanB5am5pZWpxZm11d2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNjQ1NTEsImV4cCI6MjEwMzk0MDU1MX0.P9bIBEhpyn42g3WVo7owIt87p9f4Vzx1xtq2aCzmDkc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.from('rh_efetivo').select('raw_data').limit(1);
  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(data[0].raw_data, null, 2));
  }
}
main();
