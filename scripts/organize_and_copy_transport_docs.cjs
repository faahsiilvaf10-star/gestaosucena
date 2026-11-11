const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const rootDir = 'C:\\Users\\Sucena\\Downloads\\Documentos Transportes';
const targetPublicDir = path.join(__dirname, '..', 'public', 'documentos_transporte');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Map of equipments:
const EQ_MAP = {
  CP01: '44842a45-f510-4367-8016-77cc31537ea1', // SKK6I64
  CP02: '18e304a2-b710-4fe7-9c7d-7bc2bd78df18', // RQN2D45
  CP03: 'e067fcf3-e4cd-4554-af4c-36a38b03145f', // RQS3F79
  CP04: 'e4138600-05f2-4f13-8fc2-b4a378aeab7d', // SKR6B90
  CP05: '0c81cbc2-b995-4ae1-922d-3f852404f83d', // RQR7I03
  CP06: '4dcb5f38-da3d-4053-a779-edd03e598d36', // SKQ7H63
  CP07: '4c3e42b5-389b-4b74-87ad-88021871e235', // SKQ0B03 (ou SKG8B03 / SKG0B03)
  CP08: 'f79df42c-e96a-4ea5-9074-984f895b8bb4', // SKQ2D75
  CM01: '708e6818-1b33-4fc6-9f65-253be798a5bc', // GDF4A83
  OB01: 'c534f59a-00a6-43f6-97c5-22d2d99275bb', // RWR9F79
  GERADOR: '1068c95d-23ea-448a-b1a8-bdf4b1f04d0b' // E9A4808 / DTWA00080
};

const DRIVER_MAP = {
  ANDERSON: '64e27ad7-d55b-40c5-940b-37fedf11281a',
  ROBSON: '671799fa-6220-481c-9cc8-6372c96146b7'
};

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      // Don't include original zip or eml container files if already extracted
      const lower = file.toLowerCase();
      if (lower.endsWith('.eml') || lower.endsWith('.zip')) {
        continue;
      }
      fileList.push({
        fullPath: filePath,
        relativePath: path.relative(rootDir, filePath),
        fileName: file,
        size: stat.size
      });
    }
  }
  return fileList;
}

function detectFileType(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) return 'application/msword';
  if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return 'application/vnd.ms-excel';
  return 'application/octet-stream';
}

function classifyFile(f) {
  const rel = f.relativePath.toUpperCase();
  const name = f.fileName.toUpperCase();

  // 1. Motoristas
  if (rel.includes('ANDERSON DA CRUZ') || rel.includes('MOTORISTA_ANDERSON')) {
    return {
      cargoId: `transporte_cnh_${DRIVER_MAP.ANDERSON}`,
      targetLabel: 'Motorista Anderson da Cruz Pinheiro',
      targetType: 'driver'
    };
  }

  if (rel.includes('ROBSON LEANDRO') || rel.includes('CONDUTOR-ROBSON')) {
    return {
      cargoId: `transporte_cnh_${DRIVER_MAP.ROBSON}`,
      targetLabel: 'Motorista Robson Leandro Sousa',
      targetType: 'driver'
    };
  }

  // 2. Equipamentos específicos por Placa / Tag
  if (rel.includes('SKQ-7H63') || rel.includes('SKQ7H63')) {
    return {
      cargoId: `transporte_eq_${EQ_MAP.CP06}`,
      targetLabel: 'CP 06 (SKQ-7H63)',
      targetType: 'equipment'
    };
  }

  if (rel.includes('SKQ-2D75') || rel.includes('SKQ2D75')) {
    if (rel.includes('SKQ-0B03') || rel.includes('SKQ0B03')) {
      return {
        cargoId: 'transporte_eq_geral',
        targetLabel: 'Frota Geral (SKQ-0B03 e SKQ-2D75)',
        targetType: 'equipment'
      };
    }
    return {
      cargoId: `transporte_eq_${EQ_MAP.CP08}`,
      targetLabel: 'CP 08 (SKQ-2D75)',
      targetType: 'equipment'
    };
  }

  if (rel.includes('SKQ-0B03') || rel.includes('SKQ0B03') || rel.includes('SKG-8B03') || rel.includes('SKG8B03') || rel.includes('SKG-0B03') || rel.includes('SKG0B03')) {
    return {
      cargoId: `transporte_eq_${EQ_MAP.CP07}`,
      targetLabel: 'CP 07 (SKQ-0B03)',
      targetType: 'equipment'
    };
  }

  if (rel.includes('SKR-6B90') || rel.includes('SKR6B90')) {
    return {
      cargoId: `transporte_eq_${EQ_MAP.CP04}`,
      targetLabel: 'CP 04 (SKR-6B90)',
      targetType: 'equipment'
    };
  }

  if (rel.includes('RQS-3F79') || rel.includes('RQS3F79') || rel.includes('PQS-4F79') || rel.includes('PIPA 2 -RQS3F79')) {
    return {
      cargoId: `transporte_eq_${EQ_MAP.CP03}`,
      targetLabel: 'CP 03 (RQS-3F79)',
      targetType: 'equipment'
    };
  }

  if (rel.includes('RQN-2D45') || rel.includes('RQN2D45')) {
    return {
      cargoId: `transporte_eq_${EQ_MAP.CP02}`,
      targetLabel: 'CP 02 (RQN-2D45)',
      targetType: 'equipment'
    };
  }

  if (rel.includes('RQR-7I03') || rel.includes('RQR7I03')) {
    return {
      cargoId: `transporte_eq_${EQ_MAP.CP05}`,
      targetLabel: 'CP 05 (RQR-7I03)',
      targetType: 'equipment'
    };
  }

  if (rel.includes('SKK-6I64') || rel.includes('SKK6I64')) {
    return {
      cargoId: `transporte_eq_${EQ_MAP.CP01}`,
      targetLabel: 'CP 01 (SKK-6I64)',
      targetType: 'equipment'
    };
  }

  if (rel.includes('GDF-4A83') || rel.includes('GDF4A83')) {
    return {
      cargoId: `transporte_eq_${EQ_MAP.CM01}`,
      targetLabel: 'CM 01 (GDF-4A83)',
      targetType: 'equipment'
    };
  }

  if (rel.includes('RWR-9F79') || rel.includes('RWR9F79') || rel.includes('ONIBUS')) {
    return {
      cargoId: `transporte_eq_${EQ_MAP.OB01}`,
      targetLabel: 'OB 01 (RWR-9F79 - Ônibus)',
      targetType: 'equipment'
    };
  }

  if (rel.includes('GERADOR') || rel.includes('DTWA00080')) {
    return {
      cargoId: `transporte_eq_${EQ_MAP.GERADOR}`,
      targetLabel: 'GERADOR (DTWA00080)',
      targetType: 'equipment'
    };
  }

  // 3. Documentos gerais da Frota Pesada (ARTs, Boletos, Termos de Subcontratação, etc.)
  return {
    cargoId: 'transporte_eq_geral',
    targetLabel: 'Frota Geral (Todos os Pesados)',
    targetType: 'equipment'
  };
}

async function main() {
  const files = getAllFiles(rootDir);
  console.log(`Encontrados ${files.length} arquivos físicos para processar.`);

  const catalog = [];
  const countsByTarget = {};

  if (!fs.existsSync(targetPublicDir)) {
    fs.mkdirSync(targetPublicDir, { recursive: true });
  }

  let index = 0;
  for (const f of files) {
    index++;
    const classification = classifyFile(f);
    countsByTarget[classification.targetLabel] = (countsByTarget[classification.targetLabel] || 0) + 1;

    // Destino no diretório público
    const targetFolder = path.join(targetPublicDir, classification.cargoId);
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    const sanitizedFileName = f.fileName.replace(/[^a-zA-Z0-9._\-\(\) ]/g, '_');
    const targetFilePath = path.join(targetFolder, sanitizedFileName);
    fs.copyFileSync(f.fullPath, targetFilePath);

    const publicUrl = `/documentos_transporte/${classification.cargoId}/${encodeURIComponent(sanitizedFileName)}`;

    catalog.push({
      id: `doc-transp-${index}-${Math.random().toString(36).substr(2, 8)}`,
      cargo_id: classification.cargoId,
      file_name: f.fileName,
      file_path: publicUrl,
      file_size: f.size,
      file_type: detectFileType(f.fileName),
      uploaded_by: 'Sistema Sucena',
      created_at: new Date().toISOString()
    });
  }

  console.log('\n--- RESUMO DE PROCESSAMENTO E SALVAMENTO ---');
  for (const [target, count] of Object.entries(countsByTarget)) {
    console.log(`✔ ${target}: ${count} arquivo(s)`);
  }

  // Salvar catálogo em src/data/transportDocuments.json
  const dataDir = path.join(__dirname, '..', 'src', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const jsonPath = path.join(dataDir, 'transportDocuments.json');
  fs.writeFileSync(jsonPath, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`\nSalvo catálogo local em ${jsonPath} com ${catalog.length} documentos.`);

  // Salvar também em global_settings no Supabase
  try {
    const { error: gsErr } = await supabase
      .from('global_settings')
      .upsert({
        key: 'transporte_docs_catalog',
        value: catalog,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (gsErr) {
      console.warn('Aviso ao salvar em global_settings:', gsErr);
    } else {
      console.log('✔ Catálogo salvo com sucesso em global_settings (transporte_docs_catalog)!');
    }
  } catch (err) {
    console.warn('Exceção ao persistir em global_settings:', err);
  }
}

main();
