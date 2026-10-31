import { describe, it, expect } from 'vitest'
import {
  fmtDate,
  addUmAno,
  diasAte,
  baseValidade,
  validadeDe,
  nomeBase,
  statusASO,
  frasesValidade,
  isAtivo,
  canEditControleAso,
} from './controleAso'

describe('Controle de ASO — Utilitários e Regras de Negócio', () => {
  it('formata datas ISO para DD/MM/AAAA corretamente', () => {
    expect(fmtDate('2026-06-29')).toBe('29/06/2026')
    expect(fmtDate('2026-10-09')).toBe('09/10/2026')
    expect(fmtDate(null)).toBe('—')
    expect(fmtDate(undefined)).toBe('—')
  })

  it('calcula validade de exatamente 1 ano à frente', () => {
    expect(addUmAno('2026-06-29')).toBe('2027-06-29')
    expect(addUmAno('2025-10-09')).toBe('2026-10-09')
    // Ano bissexto: 29 de fevereiro para ano normal vira 28 de fevereiro
    expect(addUmAno('2024-02-29')).toBe('2025-02-28')
  })

  it('pega a data mais recente entre os 4 exames do Controle Médico', () => {
    const colab = {
      aso_admissional: '2025-06-01',
      aso_periodico: '2026-05-15',
      retorno_ao_trabalho: '2026-06-29',
      mudanca_de_risco: '2026-04-10',
    }
    expect(baseValidade(colab)).toBe('2026-06-29')
    expect(nomeBase(colab)).toBe('Retorno ao Trab.')
    expect(validadeDe(colab)).toBe('2027-06-29')
  })

  it('calcula status do ASO corretamente (Válido, A Vencer, Vencido, Sem ASO)', () => {
    // Sem data
    const sem = statusASO({})
    expect(sem.k).toBe('sem')
    expect(sem.label).toContain('SEM ASO')

    // Vencido
    const vencido = statusASO({ aso_admissional: '2020-01-01' })
    expect(vencido.k).toBe('vencido')
    expect(vencido.label).toContain('VENCIDO')

    // Válido a vencer no futuro distante
    const hoje = new Date()
    const anoQueVem = `${hoje.getFullYear() + 2}-01-01`
    const valido = statusASO({ validade_aso_efetiva: anoQueVem })
    expect(valido.k).toBe('valido')
    expect(valido.label).toContain('VÁLIDO')
  })

  it('detecta status ativo e inativo', () => {
    expect(isAtivo('Ativo (Em Efetivo)')).toBe(true)
    expect(isAtivo('ATIVO')).toBe(true)
    expect(isAtivo('Afastado')).toBe(false)
    expect(isAtivo('Desligado')).toBe(false)
    expect(isAtivo(null)).toBe(false)
  })

  describe('Permissões de edição no Controle de ASO', () => {
    it('permite Administrador editar', () => {
      expect(canEditControleAso('Fabrício Silva', 'Admin')).toBe(true)
      expect(canEditControleAso('Qualquer Nome', 'Diretor')).toBe(true)
      expect(canEditControleAso('User', 'Operador', 'ffaahsiilva@gmail.com')).toBe(true)
    })

    it('permite Auxiliar Administrativo editar', () => {
      expect(canEditControleAso('Maria Santos', 'Auxiliar Administrativo')).toBe(true)
      expect(canEditControleAso('João Lima', 'Aux. Administrativo')).toBe(true)
    })

    it('permite Técnico de Segurança do Trabalho editar', () => {
      expect(canEditControleAso('Alexssandro Souza', 'Técnico de Segurança do Trabalho')).toBe(true)
      expect(canEditControleAso('Alexssandra Souza', 'TECNICO DE SEGURANÇA DO TRABALHO III')).toBe(true)
      expect(canEditControleAso('Itamar Pereira', 'TST')).toBe(true)
    })

    it('bloqueia outros cargos (Ajudante, Motorista, etc.)', () => {
      expect(canEditControleAso('Carlos Renan', 'Ajudante')).toBe(false)
      expect(canEditControleAso('Anderson Cruz', 'Motorista de Caminhão Pipa')).toBe(false)
      expect(canEditControleAso('Danieli Farias', 'Planejador')).toBe(false)
      expect(canEditControleAso('Lucas', 'Apontador')).toBe(false)
    })
  })

  describe('Exportação de Relatórios e Logo Sucena', () => {
    it('possui a logo oficial da Sucena em base64 válida', async () => {
      const { SUCENA_LOGO_BASE64 } = await import('./controleAso')
      expect(SUCENA_LOGO_BASE64).toBeDefined()
      expect(SUCENA_LOGO_BASE64.startsWith('data:image/png;base64,')).toBe(true)
      expect(SUCENA_LOGO_BASE64.length).toBeGreaterThan(500)
    })

    it('gera documento HTML completo com logo e indicadores para impressão', async () => {
      const { gerarHtmlRelatorioAso } = await import('./controleAso')
      const colaboradores = [
        {
          id: '1',
          nome: 'FABRICIO SILVA',
          cargo: 'ENCARREGADO GERAL',
          matricula_hydro: '68964',
          matricula_sucena: '1635',
          aso_admissional: '2025-10-21',
          aso_periodico: '2026-10-15',
          status: 'Ativo',
        },
      ]
      const stats = {
        total: 1,
        validos: 1,
        vencendo: 0,
        vencidos: 0,
        sem: 0,
        pctValidos: 100,
      }
      const html = gerarHtmlRelatorioAso(colaboradores, stats)
      expect(html).toContain('SUCENA EMPREENDIMENTOS LTDA')
      expect(html).toContain('RELATÓRIO GERENCIAL — CONTROLE DE ASO')
      expect(html).toContain('FABRICIO SILVA')
      expect(html).toContain('68964')
      expect(html).toContain('Sucena: 1635')
      expect(html).toContain('data:image/png;base64,')
    })
  })
})

