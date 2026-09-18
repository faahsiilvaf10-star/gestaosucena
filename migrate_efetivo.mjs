import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://svacqjpyjniejqfmuwhl.supabase.co';
const supabaseKey = 'sb_publishable_OhDMp29ICi6tpYWqBT67tQ_EJ1cAla0';
const supabase = createClient(supabaseUrl, supabaseKey);

const filePath = 'D:\\GestaoSucena\\efetivo_exames.xlsx';
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet, { defval: null });

function parseExcelDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    return date.toISOString().split('T')[0];
  }
  if (typeof val === 'string') {
    const parts = val.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    // If it's already YYYY-MM-DD
    if (val.includes('-')) return val;
  }
  return null;
}

async function migrate() {
  console.log(`Buscando funcionários no banco de dados...`);
  const { data: dbRows, error: fetchErr } = await supabase.from('rh_efetivo').select('id, nome');
  if (fetchErr) {
    console.error('Erro ao buscar db:', fetchErr);
    return;
  }
  
  let updatedCount = 0;
  
  for (const row of data) {
    const excelName = (row['Nome'] || '').trim().toUpperCase();
    const matriculaHydro = row['Matrícula Hydro'];
    
    if (!excelName || !matriculaHydro) continue;
    
    const asoAdmissional = parseExcelDate(row['ASO Admissional']);
    const asoPeriodico = parseExcelDate(row['ASO Periódico']);
    const retorno = parseExcelDate(row['Retorno ao Trabalho']);
    const mudanca = parseExcelDate(row['Mudança de Risco']);
    const obs = row['Observação'];
    
    const dbUser = dbRows.find(u => (u.nome || '').trim().toUpperCase() === excelName);
    
    if (dbUser) {
      const updateData = {
        matricula: String(matriculaHydro),
        aso_admissional: asoAdmissional,
        aso_periodico: asoPeriodico,
        retorno_ao_trabalho: retorno,
        mudanca_de_risco: mudanca,
        observacao: obs || null
      };
      
      // Clean undefined/null values so we don't overwrite with null if we shouldn't? 
      // The instruction says "Onde tem Matrícula Hydro Preencha em todas as matrículas em seus devidos funcionarios".
      // It also says "busque ela e atualize todas as informações do RH efetivo."
      // I will overwrite with nulls if they are null in Excel, because Excel is the source of truth for "efetivo_exames".
      
      const { error: updateErr } = await supabase
        .from('rh_efetivo')
        .update(updateData)
        .eq('id', dbUser.id);
        
      if (updateErr) {
        console.error(`Erro ao atualizar ${excelName}:`, updateErr);
      } else {
        console.log(`Atualizado ${excelName}: Matrícula=${matriculaHydro}`);
        updatedCount++;
      }
    } else {
      console.log(`Não encontrado no DB: ${excelName}`);
    }
  }
  
  console.log(`\nMigração finalizada. ${updatedCount} funcionários atualizados.`);
}

migrate();
