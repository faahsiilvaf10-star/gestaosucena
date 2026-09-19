import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const data = [
  { nome: 'ALEXSSANDRA SOUZA CHAVES', matricula: '59178' },
  { nome: 'ALEXSSANDRO SOUZA CHAVES', matricula: '57930' },
  { nome: 'ANDERSON DA CRUZ PINHEIRO', matricula: '70868' },
  { nome: 'ANDERSON DE ARAUJO BARARUA', matricula: '63871' },
  { nome: 'ANDRE DE OLIVEIRA SILVA', matricula: '70557' },
  { nome: 'CARLOS ANDRE MOURÃO DOS REIS', matricula: '70207' },
  { nome: 'CRERIANE ALCANTARA NAVEGANTES', matricula: '69245' },
  { nome: 'DANIELI FERREIRA COSTA FARIAS', matricula: '69816' },
  { nome: 'DERICK EUDES SOUZA DE JESUS', matricula: '70545' },
  { nome: 'DOMINGUES FABRICIO DA SILVA SOUSA', matricula: '68964' },
  { nome: 'EDSON DARLEY MOURA DA SILVA', matricula: '68966' },
  { nome: 'EZEDEQUIAS FERREIRA DA SILVA', matricula: '72284' },
  { nome: 'FABIANO DOS ANJOS BARROS', matricula: '63318' },
  { nome: 'FABIO GENILSON FERNANDES DOS REMEDIOS', matricula: '56149' },
  { nome: 'FELIPE DOS SANTOS PEREIRA', matricula: '69634' },
  { nome: 'FLAVIO HENRIQUE BARARUA CARDOSO', matricula: '69634' },
  { nome: 'FRANCINALDO BARATA DOS SANTOS', matricula: '70690' },
  { nome: 'ITAMAR DE SOUZA PEREIRA JUNIOR', matricula: '60972' },
  { nome: 'JHEFFESON SILVA DE SOUSA', matricula: '59426' },
  { nome: 'JOSE MARIA CORREA CORREA', matricula: '22456' },
  { nome: 'JOSE ROBERTO RODRIGUES DE SOUZA', matricula: '70090' },
  { nome: 'LUIS CARLOS PASSOS ARAUJO', matricula: '68980' },
  { nome: 'MARCELO PINHEIRO CARDOSO', matricula: '60182' },
  { nome: 'MAURICIO NASCIMENTO MARTINS', matricula: '70541' },
  { nome: 'PAULO FELIX CARDOSO', matricula: '56834' },
  { nome: 'PEDRO MELO CORDEIRO', matricula: '19231' },
  { nome: 'RAIMUNDO PEREIRA DOS SANTOS', matricula: '70351' },
  { nome: 'REGINALDO DOS SANTOS CARNEIRO', matricula: '20056' },
  { nome: 'ROBERT WILLIAN RODRIGUES PEREIRA', matricula: '63654' },
  { nome: 'THAYLON SILVA DA CONCEIÇÃO', matricula: '67323' },
  { nome: 'TIAGO AUGUSTO ROSA MACHADO', matricula: '68991' },
  { nome: 'VINICIUS MALCHER DE JESUS JUNIOR', matricula: '70205' },
  { nome: 'WELBER SANTOS MENDES', matricula: '72286' }
];

async function updateRH() {
  console.log('Starting RH updates...');
  let successCount = 0;
  let errorCount = 0;

  for (const emp of data) {
    const { error } = await supabase
      .from('rh_efetivo')
      .update({ matricula: emp.matricula })
      .eq('nome', emp.nome);

    if (error) {
      console.error(`Error updating ${emp.nome}:`, error.message);
      errorCount++;
    } else {
      console.log(`Successfully updated ${emp.nome} -> ${emp.matricula}`);
      successCount++;
    }
  }

  console.log(`Update complete. Success: ${successCount}, Errors: ${errorCount}`);
}

updateRH();
