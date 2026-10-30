import { describe, it, expect } from 'vitest'
import {
  fmtAnexadoEm,
  fmtValidade,
  diasAteValidade,
  fmtTamanho,
  tipoAnexo,
  getDbKeyAnaliseRisco,
} from './analiseRiscoData'

describe('analiseRiscoData utils', () => {
  it('formats validity date correctly', () => {
    expect(fmtValidade('2026-11-15')).toBe('15/11/2026')
    expect(fmtValidade('')).toBe('')
    expect(fmtValidade(undefined)).toBe('')
  })

  it('calculates days until validity correctly', () => {
    expect(diasAteValidade(undefined)).toBeNull()
    expect(diasAteValidade('')).toBeNull()

    const hj = new Date()
    hj.setDate(hj.getDate() + 5)
    const ano = hj.getFullYear()
    const mes = String(hj.getMonth() + 1).padStart(2, '0')
    const dia = String(hj.getDate()).padStart(2, '0')
    const d5 = `${ano}-${mes}-${dia}`

    expect(diasAteValidade(d5)).toBe(5)
  })

  it('formats file sizes accurately', () => {
    expect(fmtTamanho(undefined)).toBe('—')
    expect(fmtTamanho(500)).toBe('500 B')
    expect(fmtTamanho(2048)).toBe('2,0 KB')
    expect(fmtTamanho(1048576 * 2.5)).toBe('2,50 MB')
  })

  it('identifies file types by extension and mime', () => {
    expect(tipoAnexo('documento.pdf').rotulo).toBe('PDF')
    expect(tipoAnexo('planilha.xlsx').rotulo).toBe('Excel')
    expect(tipoAnexo('relatorio.docx').rotulo).toBe('Word')
    expect(tipoAnexo('foto.png').rotulo).toBe('Imagem')
    expect(tipoAnexo('pacote.zip').rotulo).toBe('Arquivo')
  })

  it('generates db key with environment prefix', () => {
    expect(getDbKeyAnaliseRisco('barcarena')).toBe('analise_risco_barcarena')
  })
})
