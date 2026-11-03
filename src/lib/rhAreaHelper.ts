/**
 * Auxiliar para resolução e mapeamento lógico de Áreas/Setores de RH.
 * Áreas oficiais do sistema:
 * - Área Jardinagem
 * - Área Transporte
 * - Área Gabião
 * - Área ADM
 */

export const OFFICIAL_AREAS = [
  'Área Jardinagem',
  'Área Transporte',
  'Área Gabião',
  'Área ADM'
] as const;

export type OfficialArea = typeof OFFICIAL_AREAS[number];

/**
 * Deduce ou normaliza a Área de um colaborador com base no setor atual e/ou cargo.
 * Sempre que houver um novo colaborador ou setor não definido, aplica a lógica institucional.
 */
export function getLogicalAreaForColaborador(colab: { setor?: string | null; cargo?: string | null }): string {
  const currentSetor = (colab.setor || '').trim();

  // 1. Se já tiver uma área válida explícita (e não for genérica como BARCARENA)
  if (currentSetor && !currentSetor.toUpperCase().includes('BARCARENA')) {
    const sLower = currentSetor.toLowerCase();
    if (sLower.includes('jardin')) return 'Área Jardinagem';
    if (sLower.includes('transp')) return 'Área Transporte';
    if (sLower.includes('gabi')) return 'Área Gabião';
    if (sLower.includes('adm')) return 'Área ADM';
    
    // Se for uma área customizada (ex: "Área Pintura")
    if (currentSetor.toLowerCase().startsWith('área ') || currentSetor.toLowerCase().startsWith('area ')) {
      return currentSetor;
    }
    return `Área ${currentSetor}`;
  }

  // 2. Dedução lógica pelo cargo / função
  const cargo = (colab.cargo || '').toUpperCase();

  // Jardinagem
  if (cargo.includes('JARDIN')) {
    return 'Área Jardinagem';
  }

  // Transporte & Logística
  if (
    cargo.includes('MOTORISTA') ||
    cargo.includes('RIGGER') ||
    cargo.includes('MUNCK') ||
    cargo.includes('PIPA') ||
    cargo.includes('ONIBUS') ||
    cargo.includes('ÔNIBUS') ||
    cargo.includes('TRANSPORTE')
  ) {
    return 'Área Transporte';
  }

  // Gabião & Obras Civis
  if (
    cargo.includes('POLIVALENTE') ||
    cargo.includes('MEIO OFICIAL') ||
    cargo.includes('GABIÃO') ||
    cargo.includes('GABIAO')
  ) {
    return 'Área Gabião';
  }

  // ADM / SST / Gestão / Engenharia / Elétrica
  if (
    cargo.includes('SEGURANÇA') ||
    cargo.includes('SEGURANCA') ||
    cargo.includes('MEIO AMBIENTE') ||
    cargo.includes('PLANEJ') ||
    cargo.includes('APONTADOR') ||
    cargo.includes('ENGENHEIRO') ||
    cargo.includes('ELETRICISTA') ||
    cargo.includes('ADMINISTRAT') ||
    cargo.includes('ADM') ||
    cargo.includes('ALMOXARIF') ||
    cargo.includes('COMPRAS') ||
    cargo.includes('FINANCEIRO') ||
    cargo.includes('DIRETOR')
  ) {
    return 'Área ADM';
  }

  // Padrão institucional caso seja ajudante sem setor explícito
  return 'Área Gabião';
}
