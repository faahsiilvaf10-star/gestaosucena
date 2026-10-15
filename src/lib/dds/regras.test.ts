import { describe, it, expect } from 'vitest'
import {
  tipoDdsParaAgora,
  chaveDds,
  dataAlvoDds,
  dataDisparo,
  resolverNomePalestrante,
  minutosDoDia,
  HORA_DDS_HOJE,
  HORA_DDS_AMANHA,
} from './regras'

describe('minutosDoDia', () => {
  it('converte hora e minuto', () => {
    expect(minutosDoDia(6, 0)).toBe(360)
    expect(minutosDoDia(16, 0)).toBe(960)
    expect(minutosDoDia(0, 0)).toBe(0)
    expect(minutosDoDia(23, 59)).toBe(1439)
  })
})

describe('tipoDdsParaAgora — regressão da janela de 1 minuto', () => {
  it('dispara exatamente às 06:00', () => {
    expect(tipoDdsParaAgora(6, 0)).toBe('hoje')
  })

  it('dispara dentro da janela de tolerância às 06h', () => {
    // Regressão: exigia minute === 0 e o tique de 60s quase nunca caía
    // no minuto exato.
    expect(tipoDdsParaAgora(6, 1)).toBe('hoje')
    expect(tipoDdsParaAgora(6, 5)).toBe('hoje')
    expect(tipoDdsParaAgora(6, 9)).toBe('hoje')
    expect(tipoDdsParaAgora(6, 10)).toBe('hoje')
  })

  it('dispara dentro da janela de tolerância às 16h', () => {
    expect(tipoDdsParaAgora(16, 1)).toBe('amanha')
    expect(tipoDdsParaAgora(16, 7)).toBe('amanha')
    expect(tipoDdsParaAgora(16, 10)).toBe('amanha')
  })

  it('cobre o tique atrasado de quem carregou a página perto do horário', () => {
    // Se o app abre às 06:00:50, o primeiro tique seria 06:01:50.
    expect(tipoDdsParaAgora(6, 1)).toBe('hoje')
  })

  it('NÃO dispara muito antes do horário', () => {
    // A janela é [alvo-10, alvo+10]; 05:45 e 05:49 ficam fora dela.
    expect(tipoDdsParaAgora(5, 30)).toBeNull()
    expect(tipoDdsParaAgora(5, 45)).toBeNull()
    expect(tipoDdsParaAgora(5, 49)).toBeNull()
  })

  it('05:55 ainda está na janela e dispara', () => {
    // 05:55 fica dentro de [05:50, 06:10]: quem abriu o app antes das 6h
    // ainda recebe o aviso.
    expect(tipoDdsParaAgora(5, 55)).toBe('hoje')
  })

  it('NÃO dispara muito depois do horário', () => {
    expect(tipoDdsParaAgora(6, 11)).toBeNull()
    expect(tipoDdsParaAgora(6, 30)).toBeNull()
    expect(tipoDdsParaAgora(7, 0)).toBeNull()
    expect(tipoDdsParaAgora(16, 30)).toBeNull()
  })

  it('NÃO dispara em horários fora das janelas', () => {
    expect(tipoDdsParaAgora(0, 0)).toBeNull()
    expect(tipoDdsParaAgora(9, 15)).toBeNull()
    expect(tipoDdsParaAgora(12, 0)).toBeNull()
    expect(tipoDdsParaAgora(23, 0)).toBeNull()
  })

  it('respeita tolerância customizada', () => {
    expect(tipoDdsParaAgora(6, 3, 2)).toBeNull()
    expect(tipoDdsParaAgora(6, 3, 5)).toBe('hoje')
    expect(tipoDdsParaAgora(6, 0, 0)).toBe('hoje')
  })

  it('os horarios alvo sao 6h e 16h', () => {
    expect(HORA_DDS_HOJE).toBe(6)
    expect(HORA_DDS_AMANHA).toBe(16)
  })
})

describe('chaveDds', () => {
  it('separa os tipos para não colidirem', () => {
    const hoje = chaveDds('hoje', '2026-10-15')
    const amanha = chaveDds('amanha', '2026-10-15')
    expect(hoje).not.toBe(amanha)
  })

  it('separa os dias', () => {
    expect(chaveDds('hoje', '2026-10-15')).not.toBe(chaveDds('hoje', '2026-10-16'))
  })

  it('é estável para o mesmo tipo e dia', () => {
    expect(chaveDds('hoje', '2026-10-15')).toBe(chaveDds('hoje', '2026-10-15'))
  })

  it('inclui o prefixo identificando o modulo', () => {
    expect(chaveDds('hoje', '2026-10-15')).toMatch(/^dds_enviado_/)
  })
})

describe('resolverNomePalestrante — regressão da tabela inexistente', () => {
  const usuarios = [
    { id: 'u1', nome: 'Creriane Alcantara' },
    { id: 'u2', nome: 'Pedro Melo cordeiro' },
    { id: 'u3', nome: null },
  ]

  it('encontra o nome pelo id', () => {
    // Regressão: com hr_employees (tabela inexistente) o nome vinha
    // "Não informado" mesmo com o id correto.
    expect(resolverNomePalestrante(usuarios, 'u1')).toBe('Creriane Alcantara')
    expect(resolverNomePalestrante(usuarios, 'u2')).toBe('Pedro Melo cordeiro')
  })

  it('devolve "Não informado" quando o id não existe na lista', () => {
    expect(resolverNomePalestrante(usuarios, 'inexistente')).toBe('Não informado')
  })

  it('devolve "Não informado" quando o id é nulo ou vazio', () => {
    expect(resolverNomePalestrante(usuarios, null)).toBe('Não informado')
    expect(resolverNomePalestrante(usuarios, undefined)).toBe('Não informado')
    expect(resolverNomePalestrante(usuarios, '')).toBe('Não informado')
  })

  it('devolve "Não informado" quando o nome é nulo ou só espaços', () => {
    expect(resolverNomePalestrante(usuarios, 'u3')).toBe('Não informado')
    expect(resolverNomePalestrante([{ id: 'u4', nome: '   ' }], 'u4')).toBe('Não informado')
  })

  it('devolve "Não informado" com lista vazia', () => {
    expect(resolverNomePalestrante([], 'u1')).toBe('Não informado')
  })

  it('remove espaços em branco no início e fim', () => {
    expect(resolverNomePalestrante([{ id: 'u5', nome: '  Joana Lima  ' }], 'u5')).toBe('Joana Lima')
  })
})

describe('dataDisparo e dataAlvoDds', () => {
  const agora = new Date('2026-10-15T16:00:00')

  it('o registro usa o dia em que o disparo aconteceu', () => {
    expect(dataDisparo('amanha', agora)).toBe('2026-10-15')
  })

  it("'hoje' busca o DDS do dia corrente", () => {
    expect(dataAlvoDds('hoje', agora).toISOString().slice(0, 10)).toBe('2026-10-15')
  })

  it("'amanha' busca o DDS do dia seguinte", () => {
    expect(dataAlvoDds('amanha', agora).toISOString().slice(0, 10)).toBe('2026-10-16')
  })

it('os dois disparos do mesmo dia usam registros diferentes', () => {
    // 06h fala do dia 15; 16h fala do dia 16 — mas ambos marcam o
    // registro em 15, distinguidos pelo tipo.
    expect(dataAlvoDds('hoje', agora).toISOString().slice(0, 10)).not.toBe(
      dataAlvoDds('amanha', agora).toISOString().slice(0, 10),
    )
  })
})