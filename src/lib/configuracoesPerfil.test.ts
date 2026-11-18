import { describe, it, expect } from 'vitest'

describe('Formatação de WhatsApp e tratamento de perfil', () => {
  it('adiciona prefixo 55 automaticamente e remove caracteres especiais', () => {
    function formatWhatsapp(raw: string): string {
      let formatted = raw.replace(/\D/g, '')
      if (formatted && !formatted.startsWith('55')) {
        formatted = '55' + formatted
      }
      return formatted
    }

    expect(formatWhatsapp('(91) 99210-227')).toBe('559199210227')
    expect(formatWhatsapp('9199210227')).toBe('559199210227')
    expect(formatWhatsapp('559199210227')).toBe('559199210227')
    expect(formatWhatsapp('+55 (91) 98888-7777')).toBe('5591988887777')
    expect(formatWhatsapp('')).toBe('')
  })

  it('detecta erro de senha idêntica para executar auto-recuperação sem travar WhatsApp', () => {
    function isSamePasswordError(msg: string): boolean {
      const lower = msg.toLowerCase()
      return (
        lower.includes('different from the old password') ||
        lower.includes('same_password') ||
        lower.includes('should be different')
      )
    }

    expect(isSamePasswordError('New password should be different from the old password.')).toBe(true)
    expect(isSamePasswordError('new password should be different')).toBe(true)
    expect(isSamePasswordError('same_password')).toBe(true)
    expect(isSamePasswordError('Invalid email format')).toBe(false)
  })
})
