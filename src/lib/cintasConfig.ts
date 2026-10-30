export type CorCinta = 'Vermelho' | 'Azul' | 'Amarelo' | 'Verde'

export interface MesInspecao {
  label: string
  cor: CorCinta
  mes: number
  ano: number
}

export const mesesInspecao: MesInspecao[] = [
  { label: 'janeiro de 2026', cor: 'Vermelho', mes: 1, ano: 2026 },
  { label: 'fevereiro de 2026', cor: 'Azul', mes: 2, ano: 2026 },
  { label: 'março de 2026', cor: 'Amarelo', mes: 3, ano: 2026 },
  { label: 'abril de 2026', cor: 'Verde', mes: 4, ano: 2026 },
  { label: 'maio de 2026', cor: 'Vermelho', mes: 5, ano: 2026 },
  { label: 'junho de 2026', cor: 'Azul', mes: 6, ano: 2026 },
  { label: 'julho de 2026', cor: 'Amarelo', mes: 7, ano: 2026 },
  { label: 'agosto de 2026', cor: 'Verde', mes: 8, ano: 2026 },
  { label: 'setembro de 2026', cor: 'Vermelho', mes: 9, ano: 2026 },
  { label: 'outubro de 2026', cor: 'Azul', mes: 10, ano: 2026 },
  { label: 'novembro de 2026', cor: 'Amarelo', mes: 11, ano: 2026 },
  { label: 'dezembro de 2026', cor: 'Verde', mes: 12, ano: 2026 },
]

export const colorConfigs: Record<
  CorCinta,
  {
    nome: string
    dotClass: string
    bgLight: string
    bgDark: string
    borderClass: string
    textClass: string
    badgeClass: string
    mesesTexto: string
    accentHex: string
  }
> = {
  Vermelho: {
    nome: 'Vermelho',
    dotClass: 'bg-red-500',
    bgLight: 'bg-red-50/70',
    bgDark: 'dark:bg-red-950/25',
    borderClass: 'border-red-500',
    textClass: 'text-red-700 dark:text-red-400',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800',
    mesesTexto: 'Jan, Mai, Set',
    accentHex: '#ef4444',
  },
  Azul: {
    nome: 'Azul',
    dotClass: 'bg-blue-500',
    bgLight: 'bg-blue-50/70',
    bgDark: 'dark:bg-blue-950/25',
    borderClass: 'border-blue-500',
    textClass: 'text-blue-700 dark:text-blue-400',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    mesesTexto: 'Fev, Jun, Out',
    accentHex: '#3b82f6',
  },
  Amarelo: {
    nome: 'Amarelo',
    dotClass: 'bg-yellow-500',
    bgLight: 'bg-amber-50/70',
    bgDark: 'dark:bg-amber-950/25',
    borderClass: 'border-amber-500',
    textClass: 'text-amber-700 dark:text-amber-400',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    mesesTexto: 'Mar, Jul, Nov',
    accentHex: '#eab308',
  },
  Verde: {
    nome: 'Verde',
    dotClass: 'bg-green-500',
    bgLight: 'bg-emerald-50/70',
    bgDark: 'dark:bg-emerald-950/25',
    borderClass: 'border-emerald-500',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    mesesTexto: 'Abr, Ago, Dez',
    accentHex: '#10b981',
  },
}

/**
 * Retorna o mês e cor proibida/ativa de inspeção para a data fornecida (ou atual).
 */
export function getMesInspecaoAtual(referenceDate = new Date()): MesInspecao {
  const mesIdx = referenceDate.getMonth() // 0 = Jan, 9 = Out
  const ano = referenceDate.getFullYear()

  const nomesMeses = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ]
  const nomeMes = nomesMeses[mesIdx]
  const label = `${nomeMes} de ${ano}`

  const match = mesesInspecao.find(
    (m) => m.label.toLowerCase() === label.toLowerCase()
  )
  if (match) return match

  // Fallback baseado no ciclo de 4 cores
  const coresCiclo: CorCinta[] = ['Vermelho', 'Azul', 'Amarelo', 'Verde']
  const cor = coresCiclo[mesIdx % 4]
  return {
    label,
    cor,
    mes: mesIdx + 1,
    ano,
  }
}

/**
 * Verifica se a cinta foi inspecionada no mês e ano de referência
 */
export function isInspecionadaNesteMes(
  cinta: { status: string; inspecionadaEm: string | null },
  referenceDate = new Date()
): boolean {
  if (cinta.status !== 'Inspecionada' || !cinta.inspecionadaEm) return false

  const parts = cinta.inspecionadaEm.split('/')
  if (parts.length < 3) return false

  const [day, month, year] = parts.map(Number)
  return (
    year === referenceDate.getFullYear() &&
    month === referenceDate.getMonth() + 1 &&
    day > 0
  )
}

/**
 * Função utilitária para comprimir imagem no padrão do sistema
 */
export function compressImage(file: File, maxDim = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = (err) => reject(err)
    }
    reader.onerror = (err) => reject(err)
  })
}
