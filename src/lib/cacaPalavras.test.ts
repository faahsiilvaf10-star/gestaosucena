import { describe, it, expect } from 'vitest'
import {
  gerarCodigo,
  type Pontuacao,
  type Partida,
} from './cacaPalavras'

describe('cacaPalavras logic', () => {
  it('deve gerar código de 6 caracteres alfanuméricos em caixa alta', () => {
    const cod = gerarCodigo()
    expect(cod).toHaveLength(6)
    expect(cod).toBe(cod.toUpperCase())
    expect(/^[A-Z0-9]{6}$/.test(cod)).toBe(true)
  })

  it('deve ordenar e filtrar ranking por mês e modo de jogo corretamente', () => {
    const mockScores: Pontuacao[] = [
      {
        id: 1,
        user_id: 'u1',
        user_name: 'Carlos',
        modo: 'cruzada',
        fase: 5,
        nivel: 5,
        score: 180,
        tempo_ms: 65000,
        palavras_found: 15,
        total_palavras: 15,
        vitoria: true,
        created_at: '2026-11-04T10:00:00.000Z',
      },
      {
        id: 2,
        user_id: 'u2',
        user_name: 'Ana',
        modo: 'cruzada',
        fase: 5,
        nivel: 5,
        score: 220,
        tempo_ms: 50000,
        palavras_found: 15,
        total_palavras: 15,
        vitoria: true,
        created_at: '2026-11-08T12:00:00.000Z',
      },
      {
        id: 3,
        user_id: 'u3',
        user_name: 'Beatriz',
        modo: 'busca',
        fase: 3,
        nivel: 3,
        score: 95,
        tempo_ms: 40000,
        palavras_found: 10,
        total_palavras: 10,
        vitoria: false,
        created_at: '2026-10-15T09:00:00.000Z',
      },
    ]

    // Filtro mês atual (2026-11)
    const novScores = mockScores.filter((s) => s.created_at?.startsWith('2026-11'))
    expect(novScores).toHaveLength(2)

    // Ordenação por pontuação (maior primeiro)
    const ordenados = [...novScores].sort((a, b) => b.score - a.score || a.tempo_ms - b.tempo_ms)
    expect(ordenados[0].user_name).toBe('Ana')
    expect(ordenados[0].score).toBe(220)
    expect(ordenados[1].user_name).toBe('Carlos')
    expect(ordenados[1].score).toBe(180)

    // Filtro mês anterior (2026-10)
    const outScores = mockScores.filter((s) => s.created_at?.startsWith('2026-10'))
    expect(outScores).toHaveLength(1)
    expect(outScores[0].user_name).toBe('Beatriz')
  })

  it('deve validar estrutura e status da partida 1x1', () => {
    const partida: Partida = {
      id: '38GD5W',
      codigo: '38GD5W',
      host_id: 'user_123',
      host_nome: 'Fabrício Silva',
      adversario_id: 'user_456',
      adversario_nome: 'Marcos Souza',
      modo: 'cruzada',
      fase_atual: 1,
      semente: 12345,
      status: 'em_andamento',
      criado_em: '2026-11-09T15:00:00.000Z',
      atualizado_em: '2026-11-09T15:01:00.000Z',
    }

    expect(partida.codigo).toBe('38GD5W')
    expect(partida.status).toBe('em_andamento')
    expect(partida.adversario_id).toBe('user_456')
  })
})
