import { describe, it, expect } from 'vitest'
import {
  calcConformidade,
  tipoArq,
  fmtTam,
  listarPendencias,
  gerarTextoRelatorioChecklist,
  type ChecklistExecucao,
} from './checklistData'

describe('checklistData logic', () => {
  it('deve calcular a conformidade corretamente desconsiderando NA', () => {
    const itens = [
      { status: 'C' as const },
      { status: 'C' as const },
      { status: 'NC' as const },
      { status: 'NA' as const },
    ]
    const res = calcConformidade(itens)
    expect(res.conf).toBe(2)
    expect(res.nc).toBe(1)
    expect(res.na).toBe(1)
    expect(res.aval).toBe(3)
    expect(res.pct).toBe(67) // 2 / 3 * 100
  })

  it('deve retornar null se todos os itens forem NA', () => {
    const itens = [{ status: 'NA' as const }, { status: 'NA' as const }]
    const res = calcConformidade(itens)
    expect(res.conf).toBe(0)
    expect(res.nc).toBe(0)
    expect(res.na).toBe(2)
    expect(res.aval).toBe(0)
    expect(res.pct).toBeNull()
  })

  it('deve detectar tipo e ícone de arquivos', () => {
    expect(tipoArq('checklist.pdf')).toEqual({ rotulo: 'PDF', icone: '📕' })
    expect(tipoArq('planilha.xlsx')).toEqual({ rotulo: 'Excel', icone: '📗' })
    expect(tipoArq('relatorio.docx')).toEqual({ rotulo: 'Word', icone: '📘' })
    expect(tipoArq('foto.jpg')).toEqual({ rotulo: 'Imagem', icone: '🖼️' })
    expect(tipoArq('arquivo.zip')).toEqual({ rotulo: 'Arquivo', icone: '📄' })
  })

  it('deve formatar tamanho de arquivos em bytes, KB ou MB', () => {
    expect(fmtTam(500)).toBe('500 B')
    expect(fmtTam(2048)).toBe('2,0 KB')
    expect(fmtTam(2 * 1024 * 1024)).toBe('2,00 MB')
  })

  it('deve listar pendências de itens Não Conforme e gerar texto do relatório', () => {
    const execs: ChecklistExecucao[] = [
      {
        uid: 'e1',
        modeloUid: 'm1',
        modeloNome: 'Checklist Diário',
        data: '2026-10-30',
        executor: 'João Silva',
        local: 'Canteiro Central',
        itens: [
          { itemUid: 'i1', texto: 'Capacete com jugular', status: 'C', obs: '' },
          {
            itemUid: 'i2',
            texto: 'Óculos de proteção',
            status: 'NC',
            obs: 'Colaborador sem óculos na serra',
          },
        ],
        conf: 1,
        nc: 1,
        na: 0,
        pct: 50,
        salvoEm: '30/10/2026 10:00:00',
      },
    ]

    const pends = listarPendencias(execs, {})
    expect(pends.length).toBe(1)
    expect(pends[0].item.texto).toBe('Óculos de proteção')
    expect(pends[0].resolvida).toBe(false)

    const relatorio = gerarTextoRelatorioChecklist(execs, {})
    expect(relatorio).toContain('CHECK LIST DE SEGURANÇA')
    expect(relatorio).toContain('50%')
    expect(relatorio).toContain('Colaborador sem óculos')
  })
})

