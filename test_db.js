const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Extract supabase url and key from src/lib/supabase.ts
const supabaseFile = fs.readFileSync('src/lib/supabase.ts', 'utf8');
const urlMatch = supabaseFile.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = supabaseFile.match(/supabaseAnonKey\s*=\s*['"]([^'"]+)['"]/);

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1]);
  supabase.from('rh_presencas').select('*').eq('data', '2026-09-09').then(({data, error}) => {
    if (error) console.error(error);
    else console.log('Total records for 2026-09-09:', data.length);
  });
} else {
  console.log('Could not find credentials');
}
