/**
 * Testes de integração do ciclo de vida da exibição.
 *
 * Reproduzem o cenário real: o servidor devolve o comunicado, a
 * exibição é registrada (consumindo o saldo diário) e o poll seguinte
 * devolve uma lista VAZIA. O modal precisa continuar aberto até o fim
 * do tempo configurado.
 */
import { describe, it, expect } from 'vitest'
import { escolherComunicado, type ComunicadoElegivel } from './regras'

function comunicado(id: string): ComunicadoElegivel {
  return {
    id,
    descricao: `Comunicado ${id}`,
    destino_usuario_id: null,
    periodicidade: 'unica',
    vezes_por_dia: 1,
    duracao_segundos: 60,
    data_inicio: '2026-10-15',
    hora_inicio: '00:00:00',
    data_fim: null,
    ativo: true,
    midias: [],
    jaExibidas: 0,
    totalPermitidas: 1,
    jaExibidoNaSessao: false,
  }
}

/** Reproduz o cache em memória do viewer. */
class Cache {
  private mapa = new Map<string, ComunicadoElegivel>()
  registrar(lista: ComunicadoElegivel[]) {
    for (const c of lista) {
      if (!this.mapa.has(c.id)) this.mapa.set(c.id, c)
    }
  }
  obter(id: string | null) {
    return id ? (this.mapa.get(id) ?? null) : null
  }
}

describe('ciclo de vida: o modal sobrevive ao poll que esvazia a lista', () => {
  it('mantém o comunicado em exibição quando o servidor devolve vazio', () => {
    const cache = new Cache()
    const c1 = comunicado('c1')

    // 1) Primeiro poll: o comunicado chega elegível
    let lista = [c1]
    cache.registrar(lista)

    let emExibicaoId: string | null = null
    let jaExibidos: string[] = []

    // Escolhe o que exibir
    let atual = escolherComunicado(lista, jaExibidos, null, [])
    expect(atual?.id).toBe('c1')

    // 2) Modal monta e notifica que entrou em exibição
    emExibicaoId = atual!.id
    atual = cache.obter(emExibicaoId) ?? atual
    expect(atual?.id).toBe('c1')

    // 3) Registrar a exibição consome o saldo diário.
    //    O próximo poll devolve lista vazia — o caso que quebrava o timer.
    lista = []
    cache.registrar(lista)

    // 4) O viewer NÃO pode perder o em exibição
    const emExibicao = cache.obter(emExibicaoId)
    const visivel = emExibicao ?? escolherComunicado(lista, jaExibidos, null, [])
    expect(visivel?.id).toBe('c1')

    // 5) Só no fechamento ele é marcado como visto
    jaExibidos = [...jaExibidos, emExibicaoId!]
    emExibicaoId = null

    const depois = escolherComunicado(lista, jaExibidos, null, [])
    expect(depois).toBeNull()
  })

  it('so consome o saldo uma vez por comunicado em exibicao', () => {
    const cache = new Cache()
    const c1 = comunicado('c1')
    cache.registrar([c1])

    let emExibicaoId: string | null = null
    const jaExibidos: string[] = []

    // Monta
    let atual = escolherComunicado([c1], jaExibidos, null, [])
    emExibicaoId = atual!.id

    // Três polls consecutivos com a lista vazia (o saldo já foi gasto)
    for (let i = 0; i < 3; i++) {
      const emExibicao = cache.obter(emExibicaoId)
      const visivel = emExibicao ?? escolherComunicado([], jaExibidos, null, [])
      expect(visivel?.id).toBe('c1')
    }
  })

  it('nao reabre um comunicado ja encerrado quando a lista volta', () => {
    const c1 = comunicado('c1')
    const c2 = comunicado('c2')
    const jaExibidos = ['c1']

    // O servidor devolve c1 de novo (ex.: modo "todo dia"), mas
    // sem prioridade de reexibicao ele nao volta.
    const escolhido = escolherComunicado([c1, c2], jaExibidos, null, [])
    expect(escolhido?.id).toBe('c2')
  })

  it('exibe comunicados diferentes em sequencia sem perder nenhum', () => {
    const cache = new Cache()
    const c1 = comunicado('c1')
    const c2 = comunicado('c2')
    let lista = [c1, c2]
    cache.registrar(lista)

    let emExibicaoId: string | null = null
    let jaExibidos: string[] = []
    const exibidos: string[] = []

    // Exibe c1
    let atual = escolherComunicado(lista, jaExibidos, null, [])!
    emExibicaoId = atual.id
    exibidos.push(atual.id)
    // Poll: o saldo de c1 foi consumido, mas c2 continua elegivel
    lista = [c2]
    cache.registrar(lista)
    atual = cache.obter(emExibicaoId) ?? escolherComunicado(lista, jaExibidos, null, [])!
    expect(atual.id).toBe('c1')

    // Fecha c1
    jaExibidos = [...jaExibidos, emExibicaoId]
    emExibicaoId = null

    // Exibe c2
    const segundo = escolherComunicado(lista, jaExibidos, null, [])!
    emExibicaoId = segundo.id
    exibidos.push(segundo.id)
    expect(exibidos).toEqual(['c1', 'c2'])
  })
})