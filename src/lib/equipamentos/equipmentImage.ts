/**
 * Retorna o caminho da imagem de alta fidelidade do equipamento baseado em nome, tipo ou categoria.
 */
export function getEquipmentImage(
  name?: string | null,
  type?: string | null,
  category?: string | null
): string | null {
  const n = (name || '').toUpperCase().trim()
  const t = (type || '').toLowerCase().trim()
  const c = (category || '').toLowerCase().trim()

  // Caminhão Munk / Munck (ex: CM 01, CM 02, etc.)
  if (n.startsWith('CM') || t.includes('munk') || t.includes('munck')) {
    return '/logomunk.png?v=1'
  }

  // Caminhão Pipa (ex: CP 01 a CP 08)
  if (n.startsWith('CP') || t.includes('pipa')) {
    return '/logopipa.png?v=2'
  }

  // Ônibus (ex: OB 01)
  if (n.startsWith('OB') || t.includes('onibus') || t.includes('ônibus')) {
    return '/logoonibus.png?v=1'
  }

  // Pick-up / Fiat Toro / Leve (ex: SUC 01)
  if (n.startsWith('SUC') || t.includes('pick') || t.includes('toro')) {
    return '/caminhao-final.png'
  }

  // Caminhão genérico ou equipamento pesado de transporte
  if (t.includes('caminhão') || t.includes('caminhao') || (c.includes('pesado') && !c.includes('jardinagem'))) {
    return '/logopipa.png?v=2'
  }

  return null
}
