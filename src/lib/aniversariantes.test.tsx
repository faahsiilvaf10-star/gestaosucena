// @vitest-environment jsdom
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const supabaseMockState = vi.hoisted(() => ({
  selectMock: vi.fn(),
  eqMock: vi.fn(),
  orMock: vi.fn(),
  rows: [] as any[],
}))

vi.mock('./supabase', () => ({
  rawSupabase: {
    from: (table: string) => {
      expect(table).toBe('rh_efetivo')
      return {
        select: (cols: string) => {
          supabaseMockState.selectMock(cols)
          return {
            eq: (col: string, val: string) => {
              supabaseMockState.eqMock(col, val)
              return Promise.resolve({ data: supabaseMockState.rows, error: null })
            },
            or: (expr: string) => {
              supabaseMockState.orMock(expr)
              return Promise.resolve({ data: supabaseMockState.rows, error: null })
            },
          }
        },
      }
    },
  },
  supabase: {},
}))

import {
  BIRTHDAY_CONGRATS_MESSAGE,
  fetchColaboradoresAniversario,
  filtrarAniversariantesDoDia,
  filtrarAniversariantesDoMes,
  formatEmployeeDisplayName,
  getLocalDateKey,
  markBirthdayModalDismissedInSession,
  parseBirthDayMonth,
  wasBirthdayModalDismissedInSession,
  type AniversarianteItem,
  type ColaboradorEfetivoRecord,
} from './aniversariantes'
import { BirthdayAnnouncementView } from '../components/BirthdayAnnouncementModal'

function makeAniversariante(id: string, nome: string, day = 25, month = 10): AniversarianteItem {
  return {
    id,
    nome,
    nomeFormatado: formatEmployeeDisplayName(nome),
    cargo: 'Operador',
    day,
    month,
  }
}

describe('Aniversariantes - Consulta Real, Regras de Sessão e Modal', () => {
  let container: HTMLDivElement
  let root: Root | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    supabaseMockState.rows = []
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
      root = null
    }
    container.remove()
  })

  it('deve consultar a tabela real rh_efetivo respeitando o ambiente selecionado', async () => {
    supabaseMockState.rows = [
      { id: '1', nome: 'ENISON DA SILVA SANTOS', status: 'ATIVO', raw_data: { 'DATA\r\nNASCIMENTO': 33082 } },
    ]

    const barcarenaData = await fetchColaboradoresAniversario('barcarena')
    expect(supabaseMockState.selectMock).toHaveBeenCalledWith('id, nome, cargo, setor, raw_data, status, environment')
    expect(supabaseMockState.orMock).toHaveBeenCalledWith('environment.eq.barcarena,environment.is.null')
    expect(barcarenaData).toHaveLength(1)

    await fetchColaboradoresAniversario('hydro-civil')
    expect(supabaseMockState.eqMock).toHaveBeenCalledWith('environment', 'hydro-civil')
  })

  it('deve interpretar datas de nascimento em serial Excel, DD/MM/AAAA e AAAA-MM-DD ignorando o ano e filtrando apenas colaboradores ativos', () => {
    // 25/11/1990 em serial Excel = 33202
    expect(parseBirthDayMonth(33202)).toEqual({ day: 25, month: 10 })
    expect(parseBirthDayMonth('25/11/1988')).toEqual({ day: 25, month: 10 })
    expect(parseBirthDayMonth('1995-11-25T00:00:00.000Z')).toEqual({ day: 25, month: 10 })

    const refDate = new Date(2026, 10, 25) // 25 de novembro de 2026
    const colaboradores: ColaboradorEfetivoRecord[] = [
      { id: '1', nome: 'ENISON DA SILVA SANTOS', status: 'ATIVO', raw_data: { 'DATA\r\nNASCIMENTO': 33202 } },
      { id: '2', nome: 'FELIPE DOS SANTOS PEREIRA', status: 'Ativo', raw_data: { 'DATA NASCIMENTO': '25/11/1999' } },
      { id: '3', nome: 'DESLIGADO HOJE', status: 'DESLIGADO', raw_data: { 'DATA NASCIMENTO': '25/11/1992' } },
      { id: '4', nome: 'INATIVO HOJE', status: 'Inativo', raw_data: { 'DATA NASCIMENTO': '1985-11-25' } },
      { id: '5', nome: 'OUTRO DIA DO MES', status: 'ATIVO', raw_data: { 'DATA NASCIMENTO': '10/11/1991' } },
    ]

    const doDia = filtrarAniversariantesDoDia(colaboradores, refDate)
    expect(doDia.map((a) => a.nomeFormatado)).toEqual([
      'Enison da Silva Santos',
      'Felipe dos Santos Pereira',
    ])

    const doMes = filtrarAniversariantesDoMes(colaboradores, refDate)
    expect(doMes).toHaveLength(3)
  })

  it('cenário 1: um aniversariante exibe presente 3D, título, subtítulo, cartão com bolo e mensagem ao clicar em Parabenizar', async () => {
    const onClose = vi.fn()
    let congratulated = false

    const renderView = async () => {
      await act(async () => {
        if (!root) root = createRoot(container)
        root.render(
          <BirthdayAnnouncementView
            isOpen={true}
            aniversariantes={[makeAniversariante('1', 'TIAGO AUGUSTO ROSA MACHADO')]}
            congratulated={congratulated}
            onCongratulate={() => {
              congratulated = true
            }}
            onClose={onClose}
          />
        )
      })
    }

    await renderView()

    const img = container.querySelector('img[src="/assets/aniversario/presente-3d.png"]') as HTMLImageElement | null
    expect(img).not.toBeNull()
    expect(container.textContent).toContain('Tem festa hoje! 🎉')
    expect(container.textContent).toContain('Hoje é o aniversário dos nossos colaboradores:')

    const cardsList = container.querySelector('[data-testid="birthday-cards-list"]')
    expect(cardsList?.children).toHaveLength(1)
    expect(cardsList?.textContent).toContain('🎂')
    expect(cardsList?.textContent).toContain('Tiago Augusto Rosa Machado')

    const parabenizarBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Parabenizar')
    )
    expect(parabenizarBtn).toBeDefined()
    expect(parabenizarBtn?.className).toContain('w-full')
    expect(parabenizarBtn?.className).toContain('min-h-[65px]')

    await act(async () => {
      parabenizarBtn?.click()
    })
    await renderView()

    const msgBox = container.querySelector('[data-testid="birthday-congrats-message"]')
    expect(msgBox?.textContent).toContain('Feliz aniversário! 🎂🎉')
    expect(msgBox?.textContent).toContain(BIRTHDAY_CONGRATS_MESSAGE)
  })

  it('cenário 2: dois aniversariantes renderiza ambos os cartões individuais', async () => {
    await act(async () => {
      root = createRoot(container)
      root.render(
        <BirthdayAnnouncementView
          isOpen={true}
          aniversariantes={[
            makeAniversariante('1', 'ALEXSSANDRA SOUZA CHAVES'),
            makeAniversariante('2', 'CRERIANE ALCANTARA NAVEGANTES'),
          ]}
          congratulated={false}
          onCongratulate={vi.fn()}
          onClose={vi.fn()}
        />
      )
    })

    const cardsList = container.querySelector('[data-testid="birthday-cards-list"]')
    expect(cardsList?.children).toHaveLength(2)
    expect(cardsList?.textContent).toContain('Alexssandra Souza Chaves')
    expect(cardsList?.textContent).toContain('Creriane Alcantara Navegantes')
  })

  it('cenário 3 e 6: vários aniversariantes não limita quantidade, mantém nomes inteiros sem corte e ativa rolagem interna responsiva', async () => {
    const varios = Array.from({ length: 10 }, (_, idx) =>
      makeAniversariante(`u-${idx}`, `COLABORADOR NOME COMPLETO EXTENSO NUMERO ${idx + 1} DE BARCARENA`)
    )

    await act(async () => {
      root = createRoot(container)
      root.render(
        <BirthdayAnnouncementView
          isOpen={true}
          aniversariantes={varios}
          congratulated={false}
          onCongratulate={vi.fn()}
          onClose={vi.fn()}
        />
      )
    })

    const modal = container.querySelector('[data-testid="birthday-announcement-modal"]')
    expect(modal?.innerHTML).toContain('max-h-[92vh]')
    expect(modal?.innerHTML).toContain('rounded-[30px]')

    const cardsList = container.querySelector('[data-testid="birthday-cards-list"]')
    expect(cardsList?.children).toHaveLength(10)
    expect(cardsList?.className).toContain('overflow-y-auto')
    expect(cardsList?.innerHTML).toContain('break-words')
    expect(cardsList?.innerHTML).not.toContain('truncate')
    expect(cardsList?.textContent).toContain('Colaborador Nome Completo Extenso Numero 10 de Barcarena')
  })

  it('cenário 4: nenhum aniversariante não renderiza o modal', async () => {
    await act(async () => {
      root = createRoot(container)
      root.render(
        <BirthdayAnnouncementView
          isOpen={true}
          aniversariantes={[]}
          congratulated={false}
          onCongratulate={vi.fn()}
          onClose={vi.fn()}
        />
      )
    })

    expect(container.querySelector('[data-testid="birthday-announcement-modal"]')).toBeNull()
  })

  it('cenário 5: fechamento pelo botão X e controle de sessão evita reabrir no mesmo dia e atualiza ao mudar a data', async () => {
    const onClose = vi.fn()
    await act(async () => {
      root = createRoot(container)
      root.render(
        <BirthdayAnnouncementView
          isOpen={true}
          aniversariantes={[makeAniversariante('1', 'DANIELI FERREIRA COSTA FARIAS')]}
          congratulated={false}
          onCongratulate={vi.fn()}
          onClose={onClose}
        />
      )
    })

    const closeBtn = container.querySelector('button[aria-label="Fechar"]') as HTMLButtonElement | null
    expect(closeBtn).not.toBeNull()

    await act(async () => {
      closeBtn?.click()
    })
    expect(onClose).toHaveBeenCalledTimes(1)

    const todayKey = getLocalDateKey(new Date(2026, 10, 25))
    const tomorrowKey = getLocalDateKey(new Date(2026, 10, 26))

    expect(wasBirthdayModalDismissedInSession('user-1', 'barcarena', todayKey)).toBe(false)
    markBirthdayModalDismissedInSession('user-1', 'barcarena', todayKey)
    expect(wasBirthdayModalDismissedInSession('user-1', 'barcarena', todayKey)).toBe(true)
    expect(wasBirthdayModalDismissedInSession('user-1', 'barcarena', tomorrowKey)).toBe(false)
  })
})
