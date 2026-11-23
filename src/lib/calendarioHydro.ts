import { format } from 'date-fns';

export const FERIADOS_HYDRO: Record<string, string> = {
  '2026-01-01': 'Confraternização Universal',
  '2026-04-03': 'Paixão de Cristo',
  '2026-04-21': 'Tiradentes',
  '2026-05-01': 'Dia do Trabalhador',
  '2026-06-04': 'Corpus Christi',
  '2026-08-15': 'Adesão do Pará',
  '2026-09-07': 'Independência do Brasil',
  '2026-10-12': 'Nossa Sra. Aparecida / Dias das Crianças',
  '2026-11-02': 'Finados',
  '2026-11-15': 'Proclamação da República',
  '2026-11-20': 'Dia da Consciência Negra',
  '2026-12-03': 'Feriado Municipal - São Francisco Xavier',
  '2026-12-25': 'Natal',
};

export const PRENSADOS_HYDRO: Record<string, string> = {
  '2026-02-16': 'Carnaval',
  '2026-02-17': 'Carnaval',
  '2026-02-18': 'Quarta Cinzas (dia compensado)',
  '2026-04-20': 'Dia Compensado',
  '2026-06-05': 'Dia Compensado',
  '2026-12-04': 'Dia Compensado',
};

// Cálculo dos feriados móveis baseado na Páscoa
function getEaster(year: number): Date {
  const f = Math.floor;
  const G = year % 19;
  const C = f(year / 100);
  const H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30;
  const I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11));
  const J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7;
  const L = I - J;
  const month = 3 + f((L + 40) / 44);
  const day = L + 28 - 31 * f(month / 4);
  return new Date(year, month - 1, day);
}

/**
 * Feriados fixos anuais de Barcarena / Hydro:
 * - 01-01: Confraternização Universal
 * - 04-21: Tiradentes
 * - 05-01: Dia do Trabalhador
 * - 08-15: Adesão do Pará (Estadual)
 * - 09-07: Independência do Brasil
 * - 10-12: Nossa Sra. Aparecida
 * - 11-02: Finados
 * - 11-15: Proclamação da República
 * - 11-20: Dia da Consciência Negra
 * - 12-03: São Francisco Xavier (Padroeiro Barcarena)
 * - 12-25: Natal
 */
const FIXED_ANNUAL_FERIADOS: Record<string, string> = {
  '01-01': 'Confraternização Universal',
  '04-21': 'Tiradentes',
  '05-01': 'Dia do Trabalhador',
  '08-15': 'Adesão do Pará',
  '09-07': 'Independência do Brasil',
  '10-12': 'Nossa Sra. Aparecida / Dias das Crianças',
  '11-02': 'Finados',
  '11-15': 'Proclamação da República',
  '11-20': 'Dia da Consciência Negra',
  '12-03': 'Feriado Municipal - São Francisco Xavier',
  '12-25': 'Natal',
};

/**
 * Retorna se uma data (YYYY-MM-DD) é feriado conforme o Calendário Hydro.
 */
export function isFeriadoHydro(dateStr: string): boolean {
  if (FERIADOS_HYDRO[dateStr]) return true;

  // Extrai ano, mês e dia
  const parts = dateStr.split('-');
  if (parts.length < 3) return false;
  const year = parseInt(parts[0], 10);
  const mmDd = `${parts[1]}-${parts[2]}`;

  if (FIXED_ANNUAL_FERIADOS[mmDd]) return true;

  // Verifica feriados móveis para o ano
  if (!isNaN(year)) {
    const easter = getEaster(year);
    const paixao = new Date(easter.getTime());
    paixao.setDate(easter.getDate() - 2);
    const corpusChristi = new Date(easter.getTime());
    corpusChristi.setDate(easter.getDate() + 60);

    const fmtMmDd = (d: Date) => format(d, 'MM-dd');
    if (mmDd === fmtMmDd(paixao) || mmDd === fmtMmDd(corpusChristi)) {
      return true;
    }
  }

  return false;
}

/**
 * Retorna o nome do feriado conforme o Calendário Hydro ou null se não for feriado.
 */
export function getFeriadoHydroName(dateStr: string): string | null {
  if (FERIADOS_HYDRO[dateStr]) return FERIADOS_HYDRO[dateStr];

  const parts = dateStr.split('-');
  if (parts.length < 3) return null;
  const year = parseInt(parts[0], 10);
  const mmDd = `${parts[1]}-${parts[2]}`;

  if (FIXED_ANNUAL_FERIADOS[mmDd]) return FIXED_ANNUAL_FERIADOS[mmDd];

  if (!isNaN(year)) {
    const easter = getEaster(year);
    const paixao = new Date(easter.getTime());
    paixao.setDate(easter.getDate() - 2);
    if (mmDd === format(paixao, 'MM-dd')) return 'Paixão de Cristo';

    const corpusChristi = new Date(easter.getTime());
    corpusChristi.setDate(easter.getDate() + 60);
    if (mmDd === format(corpusChristi, 'MM-dd')) return 'Corpus Christi';
  }

  return null;
}
