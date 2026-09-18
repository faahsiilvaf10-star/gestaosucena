import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://svacqjpyjniejqfmuwhl.supabase.co', 'sb_publishable_OhDMp29ICi6tpYWqBT67tQ_EJ1cAla0');

// Dados extraídos da imagem
const updates = [
  {
    plate: 'E9A-4808',
    vistoria_ultima: '2026-01-12',
    laudo_opacidade: null,
    laudo_mecanico: null,
    plano_manutencao: '2026-11-10',
    cronografo: null
  },
  {
    plate: 'GDF-4A83',
    vistoria_ultima: '2025-12-19',
    laudo_opacidade: '2026-11-21',
    laudo_mecanico: '2027-05-25',
    plano_manutencao: '2027-05-25',
    cronografo: '2026-12-04'
  },
  {
    plate: 'RQN-2D45',
    vistoria_ultima: '2026-06-05',
    laudo_opacidade: '2026-11-25',
    laudo_mecanico: '2027-05-29',
    plano_manutencao: '2027-05-29',
    cronografo: '2026-12-17'
  },
  {
    plate: 'RQR-7I03',
    vistoria_ultima: null,
    laudo_opacidade: null,
    laudo_mecanico: null,
    plano_manutencao: null,
    cronografo: null
  },
  {
    plate: 'RQS-3F79',
    vistoria_ultima: '2026-04-06',
    laudo_opacidade: '2026-09-26',
    laudo_mecanico: '2026-10-07',
    plano_manutencao: '2026-10-08',
    cronografo: '2027-09-12'
  },
  {
    plate: 'SMY-7A93',
    vistoria_ultima: '2026-03-29',
    laudo_opacidade: '2026-09-26',
    laudo_mecanico: '2027-03-30',
    plano_manutencao: '2027-03-30',
    cronografo: '2027-05-02'
  }
];

async function runMigration() {
  console.log("Iniciando atualização de datas dos equipamentos...");
  let successCount = 0;

  for (const item of updates) {
    if (!item.vistoria_ultima && !item.laudo_opacidade && !item.laudo_mecanico && !item.plano_manutencao && !item.cronografo) {
      console.log(`Ignorando ${item.plate} (nenhuma data para atualizar)`);
      continue;
    }

    const { data, error } = await supabase
      .from('eq_equipments')
      .update({
        vistoria_ultima: item.vistoria_ultima,
        laudo_opacidade: item.laudo_opacidade,
        laudo_mecanico: item.laudo_mecanico,
        plano_manutencao: item.plano_manutencao,
        cronografo: item.cronografo
      })
      .eq('plate_tag', item.plate);

    if (error) {
      console.error(`Erro ao atualizar placa ${item.plate}:`, error.message);
    } else {
      console.log(`Sucesso ao atualizar placa ${item.plate}`);
      successCount++;
    }
  }

  console.log(`Atualização concluída. ${successCount} equipamentos atualizados.`);
}

runMigration();
