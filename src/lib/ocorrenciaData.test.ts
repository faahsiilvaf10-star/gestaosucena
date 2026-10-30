import { describe, it, expect } from 'vitest'
import { fmtAnexadoEm, fmtTamanho, tipoAnexo } from './ocorrenciaData'

describe('ocorrenciaData helpers', () => {
  it('deve formatar data de anexo corretamente', () => {
    const data = new Date(2026, 9, 30, 15, 30) // 30 de Outubro de 2026 às 15:30
    expect(fmtAnexadoEm(data)).toBe('30/10/2026 às 15:30')
  })

  it('deve formatar tamanho de arquivo em bytes, KB e MB', () => {
    expect(fmtTamanho(250)).toBe('250 B')
    expect(fmtTamanho(1024)).toBe('1,0 KB')
    expect(fmtTamanho(1048576 * 2.5)).toBe('2,50 MB')
    expect(fmtTamanho(undefined)).toBe('—')
  })

  it('deve classificar os tipos de anexo e ícones corretamente', () => {
    expect(tipoAnexo('relatorio.pdf')).toEqual({ rotulo: 'PDF', icone: '📕' })
    expect(tipoAnexo('dados.xlsx')).toEqual({ rotulo: 'Excel', icone: '📗' })
    expect(tipoAnexo('oficio.docx')).toEqual({ rotulo: 'Word', icone: '📘' })
    expect(tipoAnexo('foto.png')).toEqual({ rotulo: 'Imagem', icone: '🖼️' })
    expect(tipoAnexo('backup.zip')).toEqual({ rotulo: 'Arquivo', icone: '📄' })
  })
})

