import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getEquipmentRdoStatus,
  isEquipmentDemobilized,
  desmobilizarEquipamento,
  remobilizarEquipamento,
  saveEquipmentMobilization,
  getEquipmentMobilizationMap,
} from './mobilizacao'

vi.mock('../supabase', () => {
  const globalStore: Record<string, any> = {}
  return {
    supabase: {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn((field: string, val: any) => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: globalStore[val] ? { value: globalStore[val] } : null,
              error: null,
            }),
          })),
        })),
        upsert: vi.fn(({ key, value }: { key: string; value: any }) => {
          globalStore[key] = value
          return Promise.resolve({ error: null })
        }),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
        insert: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  }
})

describe('mobilizacao - regras de RDO e status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('não deve aparecer no RDO em datas ANTERIORES à mobilização', () => {
    const mobMap = {
      eq1: {
        equipment_id: 'eq1',
        mobilized_at: '2026-11-20T08:00:00.000Z',
      },
    }

    const res = getEquipmentRdoStatus('eq1', '2026-11-19', mobMap)
    expect(res.status).toBe('hidden_not_mobilized')
  })

  it('deve indicar mobilized_today no dia exato da mobilização', () => {
    const mobMap = {
      eq1: {
        equipment_id: 'eq1',
        mobilized_at: '2026-11-20T08:00:00.000Z',
      },
    }

    const res = getEquipmentRdoStatus('eq1', '2026-11-20', mobMap)
    expect(res.status).toBe('mobilized_today')
    expect(res.mobilizedTime).toBeDefined()
  })

  it('deve aparecer como ativo normalmente entre mobilização e desmobilização', () => {
    const mobMap = {
      eq1: {
        equipment_id: 'eq1',
        mobilized_at: '2026-11-20T08:00:00.000Z',
        demobilized_at: '2026-11-28T14:30:00.000Z',
      },
    }

    const res = getEquipmentRdoStatus('eq1', '2026-11-25', mobMap)
    expect(res.status).toBe('active')
  })

  it('deve aparecer com a HORA no dia em que foi desmobilizado', () => {
    const mobMap = {
      eq1: {
        equipment_id: 'eq1',
        mobilized_at: '2026-11-20T08:00:00.000Z',
        demobilized_at: '2026-11-28T14:30:00.000Z',
      },
    }

    const res = getEquipmentRdoStatus('eq1', '2026-11-28', mobMap)
    expect(res.status).toBe('demobilized_today')
    expect(res.demobilizedTime).toBeDefined()
    expect(res.demobilizedDateTime).toBeDefined()
  })

  it('NÃO deve aparecer no RDO em datas POSTERIORES à desmobilização', () => {
    const mobMap = {
      eq1: {
        equipment_id: 'eq1',
        mobilized_at: '2026-11-20T08:00:00.000Z',
        demobilized_at: '2026-11-28T14:30:00.000Z',
      },
    }

    const res = getEquipmentRdoStatus('eq1', '2026-11-29', mobMap)
    expect(res.status).toBe('hidden_demobilized')
  })

  it('isEquipmentDemobilized deve reconhecer status e last_exit_reason demobilized', () => {
    expect(isEquipmentDemobilized({ status: 'Desmobilizado' })).toBe(true)
    expect(isEquipmentDemobilized({ last_exit_reason: 'demobilized' })).toBe(true)
    expect(
      isEquipmentDemobilized(
        { id: 'eq1' },
        { eq1: { equipment_id: 'eq1', demobilized_at: '2026-11-28T14:00:00Z' } }
      )
    ).toBe(true)
    expect(
      isEquipmentDemobilized(
        { id: 'eq2' },
        { eq1: { equipment_id: 'eq1', demobilized_at: '2026-11-28T14:00:00Z' } }
      )
    ).toBe(false)
  })

  it('desmobilizarEquipamento e remobilizarEquipamento devem salvar registros corretamente', async () => {
    await desmobilizarEquipamento({
      equipmentId: 'eq100',
      eqName: 'CP 02',
      plateTag: 'RQN2D45',
      demobilizedAt: '2026-11-28T14:30:00.000Z',
      reason: 'Fim de contrato da locação',
      userName: 'Gestor Teste',
      environment: 'barcarena',
    })

    const map = await getEquipmentMobilizationMap()
    expect(map['eq100']).toBeDefined()
    expect(map['eq100'].demobilized_at).toBe('2026-11-28T14:30:00.000Z')

    await remobilizarEquipamento({
      equipmentId: 'eq100',
      eqName: 'CP 02',
      plateTag: 'RQN2D45',
      userName: 'Gestor Teste',
      environment: 'barcarena',
    })

    const mapAfter = await getEquipmentMobilizationMap()
    expect(mapAfter['eq100'].demobilized_at).toBeNull()
  })
})
