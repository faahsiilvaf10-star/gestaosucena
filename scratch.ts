import { supabase } from './src/lib/supabase';

async function test() {
  const { data, error } = await supabase.from('rh_efetivo').select('cargo');
  if (error) console.error(error);
  else {
    const cargos = [...new Set(data.map(d => d.cargo))];
    console.log("Cargos:", cargos);
  }
}
test();
