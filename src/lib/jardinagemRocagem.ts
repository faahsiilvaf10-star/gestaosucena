import { supabase } from './supabase'
import { formatBermaElevadoPair, splitBermaElevado } from './rdoLocations'

export type JardinagemActivityType = 'rocagem' | 'limpeza_manual' | 'limpeza_soprador';

export interface ActivityConfig {
  type: JardinagemActivityType;
  name: string;
  shortName: string;
  unit: string;
  icon: string;
  dbKey: 'rocagem' | 'limpezaManual' | 'limpezaSoprador';
  color: string;
}

export const JARDINAGEM_ACTIVITIES: Record<JardinagemActivityType, ActivityConfig> = {
  rocagem: {
    type: 'rocagem',
    name: 'Roçagem',
    shortName: 'Roçagem',
    unit: 'm²',
    icon: '🌿',
    dbKey: 'rocagem',
    color: 'emerald'
  },
  limpeza_manual: {
    type: 'limpeza_manual',
    name: 'Limpeza Manual',
    shortName: 'Limpeza Manual',
    unit: 'm²',
    icon: '🧹',
    dbKey: 'limpezaManual',
    color: 'teal'
  },
  limpeza_soprador: {
    type: 'limpeza_soprador',
    name: 'Limpeza com Soprador',
    shortName: 'Limpeza Soprador',
    unit: 'm²',
    icon: '💨',
    dbKey: 'limpezaSoprador',
    color: 'sky'
  }
};

export interface RocagemEntry {
  activityType?: JardinagemActivityType;
  date: string // "YYYY-MM-DD"
  faixa: string // "Faixa 2", "Faixa 3", etc.
  berma: string // "Berma 28", "Elevado 27", "Berma 36 e Elevado 37", etc.
  elevado?: string
  value: number // Em m²
  rawString: string // Como digitado (ex: "1.200" ou "1.240,00")
  observacao?: string
}

export interface AllJardinagemRecords {
  rocagem: RocagemEntry[];
  limpezaManual: RocagemEntry[];
  limpezaSoprador: RocagemEntry[];
}

export interface RocagemCycle {
  id: string // "2026-09-16_2026-10-15"
  label: string // "16/09/2026 a 15/10/2026"
  startDate: string // "2026-09-16"
  endDate: string // "2026-10-15"
  monthName: string // "Setembro / Outubro 2026"
  referenceMonth: string // "Outubro 2026"
}

export const parseNumber = (val: string | number): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const clean = String(val).replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

export const formatM2 = (num: number): string => {
  if (isNaN(num)) return '0';
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

/**
 * Retorna o ciclo contratual (dia 16 do mês anterior/atual até dia 15 do próximo mês)
 * para qualquer data fornecida (YYYY-MM-DD).
 */
export function getRocagemCycleForDate(dateStr: string): RocagemCycle {
  if (!dateStr || !dateStr.includes('-')) {
    const today = new Date();
    dateStr = today.toISOString().split('T')[0];
  }

  const [yStr, mStr, dStr] = dateStr.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10); // 1-12
  const day = parseInt(dStr, 10);

  let startYear = year;
  let startMonth = month;
  let endYear = year;
  let endMonth = month;

  if (day >= 16) {
    // A partir do dia 16: ciclo vai até o dia 15 do mês seguinte
    startMonth = month;
    startYear = year;
    if (month === 12) {
      endMonth = 1;
      endYear = year + 1;
    } else {
      endMonth = month + 1;
      endYear = year;
    }
  } else {
    // Até o dia 15: ciclo iniciou no dia 16 do mês anterior
    endMonth = month;
    endYear = year;
    if (month === 1) {
      startMonth = 12;
      startYear = year - 1;
    } else {
      startMonth = month - 1;
      startYear = year;
    }
  }

  const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}-16`;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-15`;

  const startDisp = `16/${String(startMonth).padStart(2, '0')}/${startYear}`;
  const endDisp = `15/${String(endMonth).padStart(2, '0')}/${endYear}`;

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return {
    id: `${startDate}_${endDate}`,
    label: `${startDisp} a ${endDisp}`,
    startDate,
    endDate,
    monthName: `${monthNames[startMonth - 1]} / ${monthNames[endMonth - 1]} ${endYear}`,
    referenceMonth: `${monthNames[endMonth - 1]} de ${endYear}`
  };
}

/**
 * Função utilitária para extrair entradas de um array salvo (rocagem, limpezaManual, limpezaSoprador).
 */
export function extractEntriesFromRows(
  rows: any,
  date: string,
  activityType: JardinagemActivityType
): RocagemEntry[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r: any) => parseNumber(r?.value) > 0)
    .map((r: any) => {
      const { elevado } = splitBermaElevado(r.berma, r.elevado);
      const localLabel = formatBermaElevadoPair(r.berma, r.elevado) || 'Sem Berma';
      return {
        activityType,
        date,
        faixa: r.faixa || 'Sem Faixa',
        berma: localLabel,
        elevado: elevado || undefined,
        value: parseNumber(r.value),
        rawString: String(r.value || ''),
        observacao: r.observacao && String(r.observacao).trim() ? String(r.observacao).trim() : undefined,
      };
    });
}

/**
 * Carrega todos os registros das 3 atividades (Roçagem, Limpeza Manual e Limpeza com Soprador)
 * salvos no Supabase e no localStorage.
 */
export async function getAllJardinagemRecords(): Promise<AllJardinagemRecords> {
  const rocagemMap: Record<string, RocagemEntry[]> = {};
  const manualMap: Record<string, RocagemEntry[]> = {};
  const sopradorMap: Record<string, RocagemEntry[]> = {};

  // 1. Carregar do localStorage
  try {
    if (typeof window !== 'undefined') {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('jardinagem_rdo_'));
      for (const k of keys) {
        const date = k.replace('jardinagem_rdo_', '');
        try {
          const val = JSON.parse(localStorage.getItem(k) || '{}');
          if (val.rocagem) rocagemMap[date] = extractEntriesFromRows(val.rocagem, date, 'rocagem');
          if (val.limpezaManual) manualMap[date] = extractEntriesFromRows(val.limpezaManual, date, 'limpeza_manual');
          if (val.limpezaSoprador) sopradorMap[date] = extractEntriesFromRows(val.limpezaSoprador, date, 'limpeza_soprador');
        } catch (e) {}
      }
    }
  } catch (e) {}

  // 2. Carregar do Supabase (global_settings)
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('key, value')
      .like('key', 'jardinagem_rdo_%');

    if (!error && data) {
      data.forEach(item => {
        const date = item.key.replace('jardinagem_rdo_', '');
        const val = item.value;
        if (val) {
          if (val.rocagem) rocagemMap[date] = extractEntriesFromRows(val.rocagem, date, 'rocagem');
          if (val.limpezaManual) manualMap[date] = extractEntriesFromRows(val.limpezaManual, date, 'limpeza_manual');
          if (val.limpezaSoprador) sopradorMap[date] = extractEntriesFromRows(val.limpezaSoprador, date, 'limpeza_soprador');
        }
      });
    }
  } catch (err) {
    console.error('Erro ao buscar registros de jardinagem do banco:', err);
  }

  const flatten = (map: Record<string, RocagemEntry[]>) => {
    const list: RocagemEntry[] = [];
    Object.values(map).forEach(entries => list.push(...entries));
    return list;
  };

  return {
    rocagem: flatten(rocagemMap),
    limpezaManual: flatten(manualMap),
    limpezaSoprador: flatten(sopradorMap)
  };
}

/**
 * Carrega todos os registros de roçagem salvos no Supabase e no localStorage (compatibilidade).
 */
export async function getAllRocagemRecords(): Promise<RocagemEntry[]> {
  const all = await getAllJardinagemRecords();
  return all.rocagem;
}

/**
 * Retorna os ciclos disponíveis com base nos registros e na data atual.
 */
export function getAvailableCycles(records: RocagemEntry[], currentDateStr?: string): RocagemCycle[] {
  const cyclesMap: Record<string, RocagemCycle> = {};

  // Adiciona o ciclo da data atual
  const today = currentDateStr || new Date().toISOString().split('T')[0];
  const currentCycle = getRocagemCycleForDate(today);
  cyclesMap[currentCycle.id] = currentCycle;

  // Adiciona ciclos de todos os registros existentes
  records.forEach(r => {
    const cycle = getRocagemCycleForDate(r.date);
    if (!cyclesMap[cycle.id]) {
      cyclesMap[cycle.id] = cycle;
    }
  });

  // Ordena os ciclos em ordem decrescente (mais recente primeiro)
  return Object.values(cyclesMap).sort((a, b) => b.startDate.localeCompare(a.startDate));
}

/**
 * Calcula a soma em m² no período contratual (16 a 15) para uma atividade,
 * permitindo incluir os dados que estão atualmente sendo editados no formulário do dia.
 */
export function calculatePeriodActivityTotal(
  referenceDateStr: string,
  allSavedRecords: RocagemEntry[],
  currentDayRows?: Array<{ value: string; faixa: string; berma?: string; elevado?: string }>
): {
  cycle: RocagemCycle
  totalM2: number
  totalItems: number
  currentDayM2: number
  otherDaysM2: number
} {
  const cycle = getRocagemCycleForDate(referenceDateStr);

  // Filtra registros salvos de OUTROS dias dentro do mesmo ciclo
  const otherDaysRecordsInCycle = allSavedRecords.filter(r => 
    r.date >= cycle.startDate && 
    r.date <= cycle.endDate && 
    r.date !== referenceDateStr
  );

  const otherDaysM2 = otherDaysRecordsInCycle.reduce((sum, r) => sum + r.value, 0);

  // Calcula o total do dia atual (do formulário se fornecido, ou dos salvos)
  let currentDayM2 = 0;
  let currentDayCount = 0;

  if (currentDayRows && currentDayRows.length > 0) {
    currentDayRows.forEach(row => {
      const val = parseNumber(row.value);
      if (val > 0) {
        currentDayM2 += val;
        currentDayCount++;
      }
    });
  } else {
    const savedForToday = allSavedRecords.filter(r => r.date === referenceDateStr);
    currentDayM2 = savedForToday.reduce((sum, r) => sum + r.value, 0);
    currentDayCount = savedForToday.length;
  }

  const totalM2 = otherDaysM2 + currentDayM2;
  const totalItems = otherDaysRecordsInCycle.length + currentDayCount;

  return {
    cycle,
    totalM2,
    totalItems,
    currentDayM2,
    otherDaysM2
  };
}

/**
 * Soma os totais das 3 atividades de medição (Roçagem, Limpeza Manual e Limpeza com Soprador).
 */
export function sumActivitiesTotals(totals: {
  rocagem: number;
  limpeza_manual: number;
  limpeza_soprador: number;
}): number {
  return (totals.rocagem || 0) + (totals.limpeza_manual || 0) + (totals.limpeza_soprador || 0);
}

/**
 * Extrai o texto copiável do resumo ignorando elementos marcados com data-no-copy="true"
 * (ex.: caixas visuais de total acumulado do período).
 */
export function extractCopyableText(root: HTMLElement | null): string {
  if (!root) return '';
  const lines: string[] = [];

  const walk = (node: Node) => {
    if (node.nodeType === 1) {
      const el = node as HTMLElement;
      if (el.getAttribute('data-no-copy') === 'true') return;

      const hasBlockChildren = Array.from(el.children).some(child =>
        ['DIV', 'P', 'LI', 'SECTION', 'HEADER', 'FOOTER'].includes(child.tagName)
      );

      if (hasBlockChildren) {
        Array.from(el.childNodes).forEach(walk);
      } else {
        const rawLines = (el.textContent || '').split('\n');
        rawLines.forEach(raw => {
          const txt = raw.replace(/[ \t]+/g, ' ').trim();
          if (txt) lines.push(txt);
        });
      }
    } else if (node.nodeType === 3) {
      const rawLines = (node.textContent || '').split('\n');
      rawLines.forEach(raw => {
        const txt = raw.replace(/[ \t]+/g, ' ').trim();
        if (txt) lines.push(txt);
      });
    }
  };

  Array.from(root.childNodes).forEach(walk);
  return lines.join('\n');
}

/**
 * Alias mantido para compatibilidade com código existente
 */
export const calculatePeriodRocagemTotal = calculatePeriodActivityTotal;
