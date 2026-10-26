/**
 * Motor de geração dos tabuleiros.
 *
 * Tudo aqui é determinístico a partir de uma semente: o mesmo par
 * (semente, fase, modo) gera exatamente o mesmo tabuleiro. Isso é o que
 * permite que dois jogadores online recebam o mesmo desafio sem precisar
 * enviar o tabuleiro pela rede.
 */

import { sortearPalavras, type WordEntry, type Categoria } from './wordBank'

/** PRNG rápido e determinístico (mulberry32). */
export function criarRandom(semente: number): () => number {
  let a = semente >>> 0
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Converte texto em inteiro de 32 bits, para transformar string em semente. */
export function sementeDeTexto(texto: string): number {
  let hash = 2166136261
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

// ---------------------------------------------------------------------
// Caça-palavras
// ---------------------------------------------------------------------

export interface Posicao {
  r: number
  c: number
}

export interface Colocacao {
  word: string
  clue: string
  category: Categoria
  /** Posição inicial da palavra no tabuleiro. */
  start: Posicao
  /** Passo por célula (linha, coluna). */
  step: Posicao
  /** Células ocupadas, da primeira à última letra. */
  cells: Posicao[]
}

export interface TabuleiroBusca {
  grid: (string | null)[][]
  /** Tamanho do tabuleiro. */
  tamanho: number
  /** Palavras colocadas (na ordem em que entraram). */
  colocacoes: Colocacao[]
}

interface Direcao {
  dr: number
  dc: number
  peso: number
}

/**
 * Gera o tabuleiro de caça-palavras.
 *
 * @param palavras Palavras a esconder.
 * @param tamanho Lado do tabuleiro.
 * @param semente Semente do PRNG.
 * @param nivel Dificuldade (1-5). Níveis altos usam mais diagonais.
 */
export function gerarBusca(
  palavras: WordEntry[],
  tamanho: number,
  semente: number,
  nivel = 1,
): TabuleiroBusca {
  const random = criarRandom(semente)
  const grid: (string | null)[][] = Array.from({ length: tamanho }, () =>
    Array<string | null>(tamanho).fill(null),
  )

  const direcoes: Direcao[] = [
    { dr: 0, dc: 1, peso: 30 },
    { dr: 1, dc: 0, peso: 30 },
    { dr: 0, dc: -1, peso: 12 },
    { dr: -1, dc: 0, peso: 12 },
    { dr: 1, dc: 1, peso: nivel >= 3 ? 16 : 6 },
    { dr: -1, dc: -1, peso: nivel >= 3 ? 16 : 6 },
    { dr: 1, dc: -1, peso: nivel >= 4 ? 12 : 4 },
    { dr: -1, dc: 1, peso: nivel >= 4 ? 12 : 4 },
  ]
  const pesoTotal = direcoes.reduce((acc, d) => acc + d.peso, 0)

  const sortearDirecao = (): Direcao => {
    let alvo = random() * pesoTotal
    for (const direcao of direcoes) {
      alvo -= direcao.peso
      if (alvo <= 0) return direcao
    }
    return direcoes[0]
  }

  const colocacoes: Colocacao[] = []

  for (const entrada of palavras) {
    const palavra = entrada.word
    if (palavra.length > tamanho) continue

    let colocada = false
    for (let tentativa = 0; tentativa < 400 && !colocada; tentativa++) {
      const direcao = sortearDirecao()
      const r = Math.floor(random() * tamanho)
      const c = Math.floor(random() * tamanho)
      const endR = r + direcao.dr * (palavra.length - 1)
      const endC = c + direcao.dc * (palavra.length - 1)

      if (endR < 0 || endR >= tamanho || endC < 0 || endC >= tamanho) continue

      // Nenhuma letra pode conflitar com uma palavra já colocada.
      let conflito = false
      for (let i = 0; i < palavra.length; i++) {
        const celula = grid[r + direcao.dr * i]?.[c + direcao.dc * i]
        if (celula !== null && celula !== undefined && celula !== palavra[i]) {
          conflito = true
          break
        }
      }
      if (conflito) continue

      const cells: Posicao[] = []
      for (let i = 0; i < palavra.length; i++) {
        const rr = r + direcao.dr * i
        const cc = c + direcao.dc * i
        grid[rr][cc] = palavra[i]
        cells.push({ r: rr, c: cc })
      }

      colocacoes.push({
        word: palavra,
        clue: entrada.clue,
        category: entrada.category,
        start: { r, c },
        step: { r: direcao.dr, c: direcao.dc },
        cells,
      })
      colocada = true
    }
  }

  // Preenche as casas vazias com letras aleatórias.
  for (let r = 0; r < tamanho; r++) {
    for (let c = 0; c < tamanho; c++) {
      if (grid[r][c] === null) {
        grid[r][c] = ALFABETO[Math.floor(random() * ALFABETO.length)]
      }
    }
  }

  return { grid, tamanho, colocacoes }
}

/** Resultado da leitura de uma seleção feita pelo jogador no tabuleiro. */
export interface LeituraSelecao {
  /** Letras selecionadas, da origem ao destino. */
  texto: string
  /** Células selecionadas, na ordem. */
  cells: Posicao[]
}

/**
 * Lê a linha desenhada entre duas células.
 * Só linhas retas (horizontal, vertical ou diagonal de 45°) são aceitas.
 */
export function lerSelecao(
  grid: (string | null)[][],
  origem: Posicao,
  destino: Posicao,
): LeituraSelecao | null {
  const dr = destino.r - origem.r
  const dc = destino.c - origem.c

  if (dr === 0 && dc === 0) return null

  const horizontal = dr === 0
  const vertical = dc === 0
  const diagonal = Math.abs(dr) === Math.abs(dc)

  if (!horizontal && !vertical && !diagonal) return null

  const passoR = horizontal ? 0 : dr > 0 ? 1 : -1
  const passoC = vertical ? 0 : dc > 0 ? 1 : -1

  const cells: Posicao[] = []
  let r = origem.r
  let c = origem.c
  while (true) {
    if (r < 0 || r >= grid.length || c < 0 || c >= grid[0].length) return null
    cells.push({ r, c })
    if (r === destino.r && c === destino.c) break
    r += passoR
    c += passoC
  }

  const texto = cells.map((p) => grid[p.r][p.c] ?? '').join('')
  return { texto, cells }
}

/** Verifica se uma seleção corresponde a alguma das palavras restantes. */
export function selecionarPalavra(
  selecao: LeituraSelecao,
  restantes: Colocacao[],
): { correta: boolean; colocacao?: Colocacao; invertida: boolean } {
  const alvo = selecao.texto
  const inversa = [...alvo].reverse().join('')

  // 1. Tenta correspondência exata de células (palavra na posição correta do grid)
  for (const colocacao of restantes) {
    if (colocacao.word === alvo || colocacao.word === inversa) {
      const matchDireto =
        colocacao.cells.length === selecao.cells.length &&
        colocacao.cells[0]?.r === selecao.cells[0]?.r &&
        colocacao.cells[0]?.c === selecao.cells[0]?.c &&
        colocacao.cells[colocacao.cells.length - 1]?.r === selecao.cells[selecao.cells.length - 1]?.r &&
        colocacao.cells[colocacao.cells.length - 1]?.c === selecao.cells[selecao.cells.length - 1]?.c

      const matchInvertido =
        colocacao.cells.length === selecao.cells.length &&
        colocacao.cells[0]?.r === selecao.cells[selecao.cells.length - 1]?.r &&
        colocacao.cells[0]?.c === selecao.cells[selecao.cells.length - 1]?.c &&
        colocacao.cells[colocacao.cells.length - 1]?.r === selecao.cells[0]?.r &&
        colocacao.cells[colocacao.cells.length - 1]?.c === selecao.cells[0]?.c

      if (matchDireto) return { correta: true, colocacao, invertida: false }
      if (matchInvertido) return { correta: true, colocacao, invertida: true }
    }
  }

  // 2. Fallback por conteúdo do texto caso a seleção cubra a palavra
  for (const colocacao of restantes) {
    if (colocacao.word === alvo) return { correta: true, colocacao, invertida: false }
    if (colocacao.word === inversa) return { correta: true, colocacao, invertida: true }
  }
  return { correta: false, invertida: false }
}

// ---------------------------------------------------------------------
// Palavras cruzadas
// ---------------------------------------------------------------------

export interface Slot {
  /** Identificador único do slot. */
  id: number
  word: string
  clue: string
  category: Categoria
  /** 'H' horizontal, 'V' vertical. */
  direcao: 'H' | 'V'
  /** Número da casa inicial (numeração padrão de palavras cruzadas). */
  numero: number
  /** Células ocupadas, em ordem. */
  cells: Posicao[]
}

export interface TabuleiroCruzadas {
  /** Letras das casas; `null` em casas pretas. */
  grid: (string | null)[][]
  tamanho: number
  slots: Slot[]
  /** Casa inicial (r, c) -> número. */
  numeros: Record<string, number>
}

interface Ocupacao {
  r: number
  c: number
  letra: string
  idSlot: number
}

/**
 * Gera um quebra-cabeça de palavras cruzadas a partir de uma lista de
 * palavras, construindo palavras que se cruzam entre si.
 */
export function gerarCruzadas(
  palavras: WordEntry[],
  tamanho: number,
  semente: number,
): TabuleiroCruzadas {
  const random = criarRandom(semente)
  const ocupacao = new Map<string, Ocupacao>()
  const slots: Slot[] = []

  const chave = (r: number, c: number) => `${r}:${c}`
  const cabe = (r: number, c: number) =>
    r >= 0 && r < tamanho && c >= 0 && c < tamanho

  /** Tenta encaixar uma palavra perpendicular a um slot já colocado. */
  const tentarEncaixar = (entrada: WordEntry, alvo: Slot): boolean => {
    const novaDirecao = alvo.direcao === 'H' ? 'V' : 'H'
    for (let i = alvo.cells.length - 1; i >= 0; i--) {
      const ancora = alvo.cells[i]
      // O índice da letra que cruza o alvo.
      for (let j = 0; j < entrada.word.length; j++) {
        if (entrada.word[j] !== alvo.word[i]) continue

        let r: number
        let c: number
        if (novaDirecao === 'H') {
          r = ancora.r
          c = ancora.c - j
        } else {
          r = ancora.r - j
          c = ancora.c
        }

        const endR = novaDirecao === 'V' ? r + entrada.word.length - 1 : r
        const endC = novaDirecao === 'H' ? c + entrada.word.length - 1 : c
        if (!cabe(r, c) || !cabe(endR, endC)) continue

        // Todas as casas precisam estar livres ou ter a mesma letra.
        let ok = true
        for (let k = 0; k < entrada.word.length; k++) {
          const rr = novaDirecao === 'V' ? r + k : r
          const cc = novaDirecao === 'H' ? c + k : c
          const existente = ocupacao.get(chave(rr, cc))
          if (existente && existente.letra !== entrada.word[k]) {
            ok = false
            break
          }
        }
        if (!ok) continue

        const id = slots.length + 1
        const cells: Posicao[] = []
        for (let k = 0; k < entrada.word.length; k++) {
          const rr = novaDirecao === 'V' ? r + k : r
          const cc = novaDirecao === 'H' ? c + k : c
          ocupacao.set(chave(rr, cc), { r: rr, c: cc, letra: entrada.word[k], idSlot: id })
          cells.push({ r: rr, c: cc })
        }

        slots.push({
          id,
          word: entrada.word,
          clue: entrada.clue,
          category: entrada.category,
          direcao: novaDirecao,
          numero: 0,
          cells,
        })
        return true
      }
    }
    return false
  }

  const ordenadas = [...palavras].sort((a, b) => b.word.length - a.word.length)
  const primeira = ordenadas[0]
  if (!primeira) {
    return { grid: [], tamanho, slots: [], numeros: {} }
  }

  // Primeira palavra: horizontal, centralizada.
  const linhaInicial = Math.floor(tamanho / 2)
  const colInicial = Math.max(0, Math.floor((tamanho - primeira.word.length) / 2))
  const idPrimeiro = 1
  const cellsPrimeiro: Posicao[] = []
  for (let i = 0; i < primeira.word.length; i++) {
    const c = colInicial + i
    ocupacao.set(chave(linhaInicial, c), {
      r: linhaInicial,
      c,
      letra: primeira.word[i],
      idSlot: idPrimeiro,
    })
    cellsPrimeiro.push({ r: linhaInicial, c })
  }
  slots.push({
    id: idPrimeiro,
    word: primeira.word,
    clue: primeira.clue,
    category: primeira.category,
    direcao: 'H',
    numero: 0,
    cells: cellsPrimeiro,
  })

  // Demais palavras: cada uma precisa cruzar com alguma já colocada.
  const restantes = ordenadas.slice(1)
  for (const entrada of restantes) {
    if (entrada.word.length > tamanho) continue
    let encaixada = false
    // Tenta âncoras embaralhadas para variar o resultado.
    const ordem = [...slots].sort(() => random() - 0.5)
    for (const alvo of ordem) {
      if (tentarEncaixar(entrada, alvo)) {
        encaixada = true
        break
      }
    }
    if (!encaixada) continue
  }

  // Numeração padrão: cada casa inicial de uma palavra, em ordem de leitura.
  const inicios = new Map<string, number>()
  for (const slot of slots) {
    const inicio = slot.cells[0]
    const k = chave(inicio.r, inicio.c)
    if (!inicios.has(k)) inicios.set(k, 0)
  }
  const ordenadasInicios = [...inicios.keys()].sort((a, b) => {
    const [ra, ca] = a.split(':').map(Number)
    const [rb, cb] = b.split(':').map(Number)
    return ra - rb || ca - cb
  })
  ordenadasInicios.forEach((k, index) => inicios.set(k, index + 1))
  for (const slot of slots) {
    const inicio = slot.cells[0]
    slot.numero = inicios.get(chave(inicio.r, inicio.c)) ?? 0
  }

  // Monta a grade final.
  const grid: (string | null)[][] = Array.from({ length: tamanho }, () =>
    Array<string | null>(tamanho).fill(null),
  )
  for (const item of ocupacao.values()) {
    grid[item.r][item.c] = item.letra
  }

  const numeros: Record<string, number> = {}
  for (const [k, numero] of inicios.entries()) numeros[k] = numero

  return { grid, tamanho, slots, numeros }
}

/**
 * Sorteia as palavras e monta o tabuleiro completo de uma fase.
 * `modo` define se é caça-palavras ou palavras cruzadas.
 */
export function gerarFase(
  modo: 'busca' | 'cruzada',
  fase: number,
  tamanho: number,
  palavras: number,
  semente: number,
  categorias?: string[],
): { tabuleiroBusca: TabuleiroBusca | null; tabuleiroCruzadas: TabuleiroCruzadas | null; palavras: WordEntry[] } {
  const random = criarRandom(semente)
  const sorteadas = sortearPalavras(
    fase,
    palavras,
    random,
    categorias?.length ? (categorias as never) : undefined,
  )

  if (modo === 'cruzada') {
    const tabuleiro = gerarCruzadas(sorteadas, tamanho, semente)
    return { tabuleiroBusca: null, tabuleiroCruzadas: tabuleiro, palavras: tabuleiro.slots.map((slot) => ({
      word: slot.word,
      clue: slot.clue,
      category: slot.category,
      d: 1,
    })) }
  }

  const tabuleiro = gerarBusca(sorteadas, tamanho, semente, Math.min(5, 1 + Math.floor((fase - 1) / 2)))
  return { tabuleiroBusca: tabuleiro, tabuleiroCruzadas: null, palavras: sorteadas }
}
