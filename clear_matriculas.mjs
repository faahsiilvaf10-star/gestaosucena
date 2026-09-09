import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://svacqjpyjniejqfmuwhl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2YWNxanB5am5pZWpxZm11d2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNjQ1NTEsImV4cCI6MjEwMzk0MDU1MX0.P9bIBEhpyn42g3WVo7owIt87p9f4Vzx1xtq2aCzmDkc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { error } = await supabase.from('rh_efetivo').update({ matricula: null }).neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) {
    console.error(error);
  } else {
    console.log('All matriculas cleared.');
  }
}
main();
