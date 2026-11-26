/**
 * Helpers e listas compartilhadas para seleção separada de Berma e Elevado
 * nas atividades de Relatório de Obra (Jardinagem, Gabião, Módulos e RDO).
 */

/** Bermas (números pares de 26 a 56) + locais especiais. */
export const BERMAS_OPTIONS: string[] = [
  ...Array.from({ length: 16 }, (_, i) => `Berma ${26 + i * 2}`),
  'MIRANTE',
  'GABIÃO 1',
  'GABIÃO 2',
  'GABIÃO 3',
];

/** Elevados (números ímpares de 27 a 57). */
export const ELEVADOS_OPTIONS: string[] = Array.from(
  { length: 16 },
  (_, i) => `Elevado ${27 + i * 2}`
);

/**
 * Normaliza valores legados de Berma/Elevado:
 * - Pares (ex: "42", "Elevado 42") -> "Berma 42"
 * - Ímpares (ex: "41", "Berma 41") -> "Elevado 41"
 * - "Nenhum" / "Nenhuma" / vazio -> ""
 */
export function normalizeBermaElevado(val?: string): string {
  if (!val) return '';
  const trimmed = String(val).trim();
  if (!trimmed || trimmed === 'Nenhum' || trimmed === 'Nenhuma') return '';
  const match = trimmed.match(/^(?:Berma|Elevado)?\s*(\d+)$/i);
  if (match) {
    const n = parseInt(match[1], 10);
    return n % 2 === 0 ? `Berma ${n}` : `Elevado ${n}`;
  }
  return trimmed;
}

export function isElevadoValue(val?: string): boolean {
  if (!val) return false;
  return /^Elevado\s+\d+$/i.test(val.trim());
}

/**
 * Separa/migra dados antigos (onde Berma e Elevado compartilhavam o mesmo campo)
 * e normaliza valores atuais onde ambos os campos podem existir juntos ou isolados.
 */
export function splitBermaElevado(
  rawBerma?: string,
  rawElevado?: string
): { berma: string; elevado: string } {
  const normB = normalizeBermaElevado(rawBerma);
  const normE = normalizeBermaElevado(rawElevado);

  let berma = '';
  let elevado = '';

  if (normB) {
    if (isElevadoValue(normB)) {
      elevado = normB;
    } else {
      berma = normB;
    }
  }

  if (normE) {
    if (isElevadoValue(normE)) {
      elevado = normE;
    } else if (!berma) {
      // Compatibilidade com registros antigos do Gabião que salvavam Berma/MIRANTE/GABIÃO em localElevado
      berma = normE;
    }
  }

  return { berma, elevado };
}

/**
 * Formata Berma e Elevado juntos (ou apenas um deles) para exibição/resumo.
 */
export function formatBermaElevadoPair(
  rawBerma?: string,
  rawElevado?: string,
  separator = ' e '
): string {
  const { berma, elevado } = splitBermaElevado(rawBerma, rawElevado);
  return [berma, elevado].filter(Boolean).join(separator);
}

/**
 * Formata a localização completa (Faixa + Berma/Elevado) para linhas do RDO principal.
 */
export function formatRdoLocation(
  faixa?: string,
  rawBerma?: string,
  rawElevado?: string
): string {
  const beStr = formatBermaElevadoPair(rawBerma, rawElevado, ' e ');
  return [faixa ? faixa.trim() : '', beStr].filter(Boolean).join(' ');
}
