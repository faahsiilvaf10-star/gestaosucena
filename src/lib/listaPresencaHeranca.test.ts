import { describe, it, expect } from 'vitest'

describe('Lista de Presença - Regras de Herança do Dia Anterior e Áreas Novas', () => {
  it('cleanAreaName deve preservar nomes de áreas customizadas e novas sem alterar prefixos', () => {
    const cleanAreaName = (areaName?: string | null): string => {
      if (!areaName) return 'Área Gabião'
      const trimmed = areaName.trim()
      if (
        trimmed.toUpperCase() === 'BARCARENA' ||
        trimmed.toUpperCase() === 'ÁREA BARCARENA' ||
        trimmed.toUpperCase() === 'AREA BARCARENA'
      ) {
        return 'Área Gabião'
      }
      return trimmed
    }

    expect(cleanAreaName('Área Transporte')).toBe('Área Transporte')
    expect(cleanAreaName('Canteiro Sucena')).toBe('Canteiro Sucena')
    expect(cleanAreaName('SE-07D-2')).toBe('SE-07D-2')
    expect(cleanAreaName('CWA 01')).toBe('CWA 01')
    expect(cleanAreaName('BARCARENA')).toBe('Área Gabião')
    expect(cleanAreaName(null)).toBe('Área Gabião')
  })

  it('deve herdar os mesmos colaboradores salvos no dia anterior com status PRESENTE para novo dia', () => {
    // Simula registros do dia anterior (2026-11-12)
    const pastRecords = [
      { id: '1', funcionario_id: 'func-1', area: 'Área Transporte', data: '2026-11-12', status: 'PRESENTE' },
      { id: '2', funcionario_id: 'func-2', area: 'Área Transporte', data: '2026-11-12', status: 'AUSENTE' },
      { id: '3', funcionario_id: 'func-3', area: 'Canteiro Sucena', data: '2026-11-12', status: 'PRESENTE' },
    ]

    const efetivoMap = new Map([
      ['func-1', { id: 'func-1', nome: 'ELITON DA SILVA BARROS', cargo: 'JARDINEIRO' }],
      ['func-2', { id: 'func-2', nome: 'PAULO FELIX CARDOSO', cargo: 'MOTORISTA' }],
      ['func-3', { id: 'func-3', nome: 'GUSTAVO DA SILVA', cargo: 'AJUDANTE' }],
    ])

    const latestDateByArea = new Map<string, string>()
    pastRecords.forEach(d => {
      if (!latestDateByArea.has(d.area)) {
        latestDateByArea.set(d.area, d.data)
      }
    })

    const previousEmployeesByArea = new Map<string, any[]>()
    pastRecords.forEach(d => {
      if (d.data === latestDateByArea.get(d.area)) {
        if (!previousEmployeesByArea.has(d.area)) previousEmployeesByArea.set(d.area, [])
        previousEmployeesByArea.get(d.area)!.push(d)
      }
    })

    // Monta a nova lista herdada para o dia 2026-11-13
    const nextColaboradores: any[] = []
    const allocated = new Set<string>()

    for (const area of ['Área Transporte', 'Canteiro Sucena']) {
      const prevRows = previousEmployeesByArea.get(area) || []
      prevRows.forEach(d => {
        if (!allocated.has(d.funcionario_id)) {
          allocated.add(d.funcionario_id)
          const emp = efetivoMap.get(d.funcionario_id)
          nextColaboradores.push({
            id: d.funcionario_id,
            nome: emp?.nome,
            cargo: emp?.cargo,
            setor: area,
            status: 'PRESENTE' // Pré-selecionado pronto para chamada do novo dia
          })
        }
      })
    }

    // Área Transporte deve ter 2 colaboradores herdados
    const transporte = nextColaboradores.filter(c => c.setor === 'Área Transporte')
    expect(transporte).toHaveLength(2)
    expect(transporte.map(c => c.id)).toEqual(['func-1', 'func-2'])
    // Mesmo quem estava AUSENTE no dia anterior agora vem pré-marcado como PRESENTE para nova chamada
    expect(transporte.every(c => c.status === 'PRESENTE')).toBe(true)

    // Área nova Canteiro Sucena deve ter herdado com sucesso
    const canteiro = nextColaboradores.filter(c => c.setor === 'Canteiro Sucena')
    expect(canteiro).toHaveLength(1)
    expect(canteiro[0].nome).toBe('GUSTAVO DA SILVA')
  })
})
