import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  podeExibir,
  totalPermitidas,
  exibicoesRestantes,
  proximaExibicao,
  validarComunicado,
  detectarTipoMidia,
  montarSequencia,
  trilhaSemImagem,
  extrairIdYoutube,
  urlEmbedYoutube,
  ehLinkYoutubeValido,
  escolherComunicado,
  formatarDuracao,
  duracaoParaMs,
  minutosDoDia,
  diaLocal,
  DURACAO_MAXIMA_SEGUNDOS,
  MAX_EXIBICOES_DIA,
  type Periodicidade,
  type ComunicadoMidia,
} from './regras'

const HOJE = '2026-10-15'

function comunicadoBase(over: Partial<Parameters<typeof podeExibir>[0]> = {}) {
  return {
    ativo: true,
    data_inicio: HOJE,
    hora_inicio: '00:00:00',
    data_fim: null,
    periodicidade: 'unica' as Periodicidade,
    vezes_por_dia: 1,
    ...over,
  }
}

describe('minutosDoDia', () => {
  it('converte HH:MM e HH:MM:SS em minutos', () => {
    expect(minutosDoDia('00:00')).toBe(0)
    expect(minutosDoDia('08:30')).toBe(510)
    expect(minutosDoDia('13:45:30')).toBe(825)
    expect(minutosDoDia('23:59')).toBe(1439)
  })
})

describe('diaLocal', () => {
  it('retorna o dia no fuso de Brasília em YYYY-MM-DD', () => {
    const d = diaLocal(new Date('2026-10-15T12:00:00Z'))
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('avança para o dia seguinte quando é meia-noite em Brasília', () => {
    // 2026-10-16T02:00Z === 2026-10-15 23:00 em Belém (UTC-3)
    expect(diaLocal(new Date('2026-10-16T02:00:00Z'))).toBe('2026-10-15')
    // 2026-10-16T04:00Z === 2026-10-16 01:00 em Belém
    expect(diaLocal(new Date('2026-10-16T04:00:00Z'))).toBe('2026-10-16')
  })
})

describe('podeExibir — janela de datas', () => {
  it('não exibe antes da data de início', () => {
    const c = comunicadoBase({ data_inicio: '2026-10-20' })
    expect(podeExibir(c, { dia: '2026-10-15', jaExibidas: 0, jaExibidoNaSessao: false })).toBe(false)
  })

  it('exibe na data de início', () => {
    const c = comunicadoBase({ data_inicio: HOJE })
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 0, jaExibidoNaSessao: false })).toBe(true)
  })

  it('não exibe depois da data final', () => {
    const c = comunicadoBase({ data_fim: '2026-10-14' })
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 0, jaExibidoNaSessao: false })).toBe(false)
  })

  it('exibe na data final (limite inclusivo)', () => {
    const c = comunicadoBase({ data_fim: HOJE })
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 0, jaExibidoNaSessao: false })).toBe(true)
  })

  it('não exibe quando está inativo', () => {
    const c = comunicadoBase({ ativo: false })
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 0, jaExibidoNaSessao: false })).toBe(false)
  })
})

describe('podeExibir — horário de início', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(`${HOJE}T12:00:00`))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('não exibe antes da hora de início no dia inicial', () => {
    const c = comunicadoBase({ hora_inicio: '18:00:00' })
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 0, jaExibidoNaSessao: false })).toBe(false)
  })

  it('exibe a partir da hora de início', () => {
    const c = comunicadoBase({ hora_inicio: '12:00:00' })
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 0, jaExibidoNaSessao: false })).toBe(true)
  })

  it('ignora a hora de início nos dias seguintes', () => {
    const c = comunicadoBase({ data_inicio: '2026-10-01', hora_inicio: '18:00:00' })
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 0, jaExibidoNaSessao: false })).toBe(true)
  })
})

describe('podeExibir — limite diário (periodicidade unica e diaria)', () => {
  it('"unica" exibe apenas uma vez por dia', () => {
    const c = comunicadoBase({ periodicidade: 'unica', vezes_por_dia: 1 })
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 0, jaExibidoNaSessao: false })).toBe(true)
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 1, jaExibidoNaSessao: true })).toBe(false)
  })

  it('"diaria" respeita a quantidade configurada', () => {
    const c = comunicadoBase({ periodicidade: 'diaria', vezes_por_dia: 3 })
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 0, jaExibidoNaSessao: false })).toBe(true)
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 2, jaExibidoNaSessao: true })).toBe(true)
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 3, jaExibidoNaSessao: true })).toBe(false)
  })

  it('volta a exibir em outra sessão enquanto houver saldo diário', () => {
    const c = comunicadoBase({ periodicidade: 'diaria', vezes_por_dia: 2 })
    // Sessão 1 consumiu 1 exibição
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 1, jaExibidoNaSessao: false })).toBe(true)
    // Sessão 2 consumiu a segunda
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 2, jaExibidoNaSessao: false })).toBe(false)
  })
})

describe('podeExibir — modo "todo dia"', () => {
  it('exibe uma vez por sessão, sem limite diário', () => {
    const c = comunicadoBase({ periodicidade: 'todo_dia' })
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 0, jaExibidoNaSessao: false })).toBe(true)
    // Ja exibido nesta sessão -> não reabre
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 1, jaExibidoNaSessao: true })).toBe(false)
  })

  it('permite exibir novamente em uma sessão posterior mesmo já tendo exibido hoje', () => {
    const c = comunicadoBase({ periodicidade: 'todo_dia' })
    // jaExibidas alto, mas é outra sessão
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 5, jaExibidoNaSessao: false })).toBe(true)
  })
})

describe('podeExibir — exibição imediata', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(`${HOJE}T09:00:00`))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ignora a data de início futura quando imediato', () => {
    const c = comunicadoBase({ data_inicio: '2026-12-01', imediato: true })
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 0, jaExibidoNaSessao: false })).toBe(true)
  })

  it('ignora a hora de início quando imediato', () => {
    const c = comunicadoBase({ hora_inicio: '23:00:00', imediato: true })
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 0, jaExibidoNaSessao: false })).toBe(true)
  })

  it('ignora a data final expirada quando imediato', () => {
    const c = comunicadoBase({ data_fim: '2026-01-01', imediato: true })
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 0, jaExibidoNaSessao: false })).toBe(true)
  })

  it('mantém o limite diário quando imediato', () => {
    const c = comunicadoBase({ periodicidade: 'unica', vezes_por_dia: 1, imediato: true })
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 0, jaExibidoNaSessao: false })).toBe(true)
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 1, jaExibidoNaSessao: true })).toBe(false)
  })

  it('mantém a regra de uma vez por sessão em "todo dia" quando imediato', () => {
    const c = comunicadoBase({ periodicidade: 'todo_dia', imediato: true })
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 0, jaExibidoNaSessao: false })).toBe(true)
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 1, jaExibidoNaSessao: true })).toBe(false)
  })

  it('ainda respeita "inativo" quando imediato', () => {
    const c = comunicadoBase({ ativo: false, imediato: true })
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 0, jaExibidoNaSessao: false })).toBe(false)
  })

  it('sem imediato, continua respeitando a janela', () => {
    const c = comunicadoBase({ data_inicio: '2026-12-01' })
    expect(podeExibir(c, { dia: HOJE, jaExibidas: 0, jaExibidoNaSessao: false })).toBe(false)
  })
})

describe('extrairIdYoutube', () => {
  const ID = 'dQw4w9WgXcQ'

  it('extrai de watch?v=', () => {
    expect(extrairIdYoutube(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID)
  })

  it('extrai de youtu.be', () => {
    expect(extrairIdYoutube(`https://youtu.be/${ID}`)).toBe(ID)
  })

  it('extrai de /embed/', () => {
    expect(extrairIdYoutube(`https://www.youtube.com/embed/${ID}`)).toBe(ID)
  })

  it('extrai de /shorts/', () => {
    expect(extrairIdYoutube(`https://www.youtube.com/shorts/${ID}`)).toBe(ID)
  })

  it('extrai de /live/', () => {
    expect(extrairIdYoutube(`https://www.youtube.com/live/${ID}`)).toBe(ID)
  })

  it('aceita m.youtube.com', () => {
    expect(extrairIdYoutube(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID)
  })

  it('aceita parâmetros extras (list, t, index)', () => {
    expect(extrairIdYoutube(`https://www.youtube.com/watch?v=${ID}&list=PL123&t=30s`)).toBe(ID)
  })

  it('tolera espaços em volta', () => {
    expect(extrairIdYoutube(`  https://youtu.be/${ID}  `)).toBe(ID)
  })

  it('devolve null para link de outro site', () => {
    expect(extrairIdYoutube('https://vimeo.com/12345')).toBeNull()
    expect(extrairIdYoutube('https://facebook.com/video/123')).toBeNull()
  })

  it('devolve null para YouTube sem ID de vídeo', () => {
    expect(extrairIdYoutube('https://www.youtube.com/@canal')).toBeNull()
    expect(extrairIdYoutube('https://www.youtube.com/')).toBeNull()
  })

  it('devolve null para texto solto', () => {
    expect(extrairIdYoutube('meu video favorito')).toBeNull()
    expect(extrairIdYoutube('')).toBeNull()
  })

  it('devolve null para ID com tamanho inválido', () => {
    expect(extrairIdYoutube('https://www.youtube.com/watch?v=curto')).toBeNull()
  })

  it('devolve null para URL sem protocolo', () => {
    expect(extrairIdYoutube(`www.youtube.com/watch?v=${ID}`)).toBeNull()
  })
})

describe('urlEmbedYoutube / ehLinkYoutubeValido', () => {
  const ID = 'dQw4w9WgXcQ'

  it('gera URL de embed com autoplay', () => {
    expect(urlEmbedYoutube(ID)).toContain(`/embed/${ID}`)
    expect(urlEmbedYoutube(ID)).toContain('autoplay=1')
  })

  it('remove controles e branding', () => {
    const url = urlEmbedYoutube(ID)
    expect(url).toContain('controls=0')
    expect(url).toContain('modestbranding=1')
    expect(url).toContain('showinfo=0')
  })

  it('usa o domínio nocookie', () => {
    expect(urlEmbedYoutube(ID)).toContain('youtube-nocookie.com')
  })

  it('valida links corretamente', () => {
    expect(ehLinkYoutubeValido(`https://youtu.be/${ID}`)).toBe(true)
    expect(ehLinkYoutubeValido('https://vimeo.com/1')).toBe(false)
  })
})

describe('montarSequencia — música é trilha da imagem, não slide próprio', () => {
  const foto: ComunicadoMidia = {
    id: 'f1',
    comunicado_id: 'c1',
    tipo: 'foto',
    storage_path: 'foto.png',
    ordem: 0,
  }
  const musica: ComunicadoMidia = {
    id: 'a1',
    comunicado_id: 'c1',
    tipo: 'audio',
    storage_path: 'musica.mp3',
    capa_path: 'capa.png',
    ordem: 1,
  }

  it('foto + música gera UM ÚNICO slide (não dois)', () => {
    const seq = montarSequencia([foto, musica])
    expect(seq).toHaveLength(1)
    expect(seq[0].midiaId).toBe('f1')
    expect(seq[0].url).toBe('foto.png')
  })

  it('a música acompanha a imagem via audioUrl', () => {
    const seq = montarSequencia([foto, musica])
    expect(seq[0].audioUrl).toBe('musica.mp3')
  })

  it('a capa gerada NUNCA vira slide avulso', () => {
    const seq = montarSequencia([foto, musica])
    expect(seq.some((m) => m.url === 'capa.png')).toBe(false)
  })

  it('nenhum item da sequência é do tipo audio', () => {
    const seq = montarSequencia([foto, musica])
    expect(seq.every((m) => m.tipo !== 'audio')).toBe(true)
  })

  it('a mesma música NÃO cria um segundo slide com a capa', () => {
    // Este é o bug reportado: com capa, a capa virava slide "2/2"
    const seq = montarSequencia([foto, musica])
    expect(seq).toHaveLength(1)
  })

  it('música sem imagem não gera nenhum slide', () => {
    const seq = montarSequencia([musica])
    expect(seq).toHaveLength(0)
  })

  it('vídeo também aceita trilha sonora', () => {
    const video: ComunicadoMidia = {
      id: 'v1',
      comunicado_id: 'c1',
      tipo: 'video',
      storage_path: 'video.mp4',
      ordem: 0,
    }
    const seq = montarSequencia([video, musica])
    expect(seq).toHaveLength(1)
    expect(seq[0].audioUrl).toBe('musica.mp3')
  })

  it('duas imagens: a 1ª recebe a 1ª faixa', () => {
    const foto2: ComunicadoMidia = { ...foto, id: 'f2', storage_path: 'foto2.png', ordem: 1 }
    const musica2: ComunicadoMidia = { ...musica, id: 'a2', storage_path: 'musica2.mp3', ordem: 2 }
    const seq = montarSequencia([foto, foto2, musica, musica2])
    expect(seq.map((m) => m.audioUrl)).toEqual(['musica.mp3', 'musica2.mp3'])
  })

  it('mais imagens que músicas: a última fica sem trilha', () => {
    const foto2: ComunicadoMidia = { ...foto, id: 'f2', storage_path: 'foto2.png', ordem: 1 }
    const seq = montarSequencia([foto, foto2, musica])
    expect(seq.map((m) => m.audioUrl)).toEqual(['musica.mp3', null])
  })

  it('mais músicas que imagens: excedente fica sem imagem', () => {
    const musica2: ComunicadoMidia = { ...musica, id: 'a2', storage_path: 'm2.mp3', ordem: 2 }
    const seq = montarSequencia([foto, musica, musica2])
    expect(seq).toHaveLength(1)
    expect(seq[0].audioUrl).toBe('musica.mp3')
  })

  it('foto sem música fica com audioUrl nulo', () => {
    const seq = montarSequencia([foto])
    expect(seq[0].audioUrl).toBeNull()
  })

  it('ordena por "ordem" antes de parear', () => {
    const seq = montarSequencia([musica, foto])
    expect(seq[0].midiaId).toBe('f1')
  })

  it('lista vazia retorna sequência vazia', () => {
    expect(montarSequencia([])).toEqual([])
  })
})

describe('trilhaSemImagem', () => {
  const musica: ComunicadoMidia = {
    id: 'a1',
    comunicado_id: 'c1',
    tipo: 'audio',
    storage_path: 'musica.mp3',
    ordem: 0,
  }
  const foto: ComunicadoMidia = {
    id: 'f1',
    comunicado_id: 'c1',
    tipo: 'foto',
    storage_path: 'foto.png',
    ordem: 1,
  }

  it('devolve a trilha quando só há música', () => {
    expect(trilhaSemImagem([musica])).toBe('musica.mp3')
  })

  it('devolve null quando existe imagem (a trilha acompanha a imagem)', () => {
    expect(trilhaSemImagem([foto, musica])).toBeNull()
  })

  it('devolve null sem nenhuma mídia', () => {
    expect(trilhaSemImagem([])).toBeNull()
  })
})

describe('escolherComunicado — regressão do comunicado novo não aparecer', () => {
  const c1 = { id: 'c1' }
  const c2 = { id: 'c2' }
  const c3 = { id: 'c3' }

  it('escolhe o primeiro quando nada foi exibido', () => {
    expect(escolherComunicado([c1, c2], [])).toEqual(c1)
  })

  it('não devolve o que já foi exibido nesta sessão', () => {
    expect(escolherComunicado([c1, c2], ['c1'])).toEqual(c2)
  })

  it('ESCONHE c2 recém-criado mesmo com c1 já exibido', () => {
    // Regressão: o filtro marcava c2 como visto antes de exibir,
    // então o polling nunca o mostrava.
    expect(escolherComunicado([c1, c2], ['c1'])).toEqual(c2)
    expect(escolherComunicado([c1, c2], ['c1'])).not.toEqual(c1)
  })

  it('mantém o comunicado em exibição apesar do polling', () => {
    // Regressão do timer: o polling devolvia c1 novamente e o modal era
    // remontado, reiniciando a contagem.
    expect(escolherComunicado([c1, c2], [], 'c1')).toEqual(c1)
    expect(escolherComunicado([c1, c2], [], 'c2')).toEqual(c2)
  })

  it('em exibição tem precedência sobre ja exibidos', () => {
    expect(escolherComunicado([c1, c2], ['c1'], 'c2')).toEqual(c2)
  })

  it('ignora emExibicaoId que não está mais na lista', () => {
    // Se o limite diário zerou, o item sai da lista e outro deve surgir.
    expect(escolherComunicado([c2], [], 'c1')).toEqual(c2)
  })

  it('prioriza jaExibidosSempre (modo todo dia)', () => {
    expect(escolherComunicado([c1, c2], ['c1'], null, ['c2'])).toEqual(c2)
  })

  it('jaExibidosSempre não bloqueia se o id sumiu da lista', () => {
    expect(escolherComunicado([c1], [], null, ['sumiu'])).toEqual(c1)
  })

  it('devolve null quando todos já foram exibidos', () => {
    expect(escolherComunicado([c1, c2], ['c1', 'c2'])).toBeNull()
  })

  it('devolve null para lista vazia', () => {
    expect(escolherComunicado([], [])).toBeNull()
    expect(escolherComunicado([], [], 'c1')).toBeNull()
  })

  it('preserva a ordem da lista ao ignorar os já exibidos', () => {
    // [c3, c1, c2] com c1 já exibido -> o primeiro restante é c3
    expect(escolherComunicado([c3, c1, c2], ['c1'])?.id).toBe('c3')
  })
})

describe('duracaoParaMs — regressão do timer', () => {
  it('converte a duração total respeitando minutos + segundos', () => {
    // Regressão: o modal fechava sempre em 15s mesmo com 1min30s
    // configurado. A conversão precisa refletir o total real.
    expect(duracaoParaMs(90)).toBe(90_000)
    expect(duracaoParaMs(60)).toBe(60_000)
    expect(duracaoParaMs(15)).toBe(15_000)
  })

  it('não trunca nem arredonda a duração', () => {
    expect(duracaoParaMs(45)).toBe(45_000)
    expect(duracaoParaMs(3600)).toBe(3_600_000)
  })

  it('valores inválidos viram 0 em vez de NaN', () => {
    expect(duracaoParaMs(NaN)).toBe(0)
    expect(duracaoParaMs(Infinity)).toBe(0)
    expect(duracaoParaMs(-10)).toBe(0)
  })
})

describe('totalPermitidas / exibicoesRestantes', () => {
  it('"todo_dia" não tem limite diário', () => {
    expect(totalPermitidas({ periodicidade: 'todo_dia', vezes_por_dia: 1 })).toBe(Number.POSITIVE_INFINITY)
    expect(exibicoesRestantes({ periodicidade: 'todo_dia', vezes_por_dia: 1 }, 99)).toBe(Number.POSITIVE_INFINITY)
  })

  it('"unica"/"diaria" devolvem o valor configurado', () => {
    expect(totalPermitidas({ periodicidade: 'unica', vezes_por_dia: 1 })).toBe(1)
    expect(totalPermitidas({ periodicidade: 'diaria', vezes_por_dia: 5 })).toBe(5)
  })

  it('nunca devolve saldo negativo', () => {
    expect(exibicoesRestantes({ periodicidade: 'unica', vezes_por_dia: 1 }, 5)).toBe(0)
  })
})

describe('proximaExibicao', () => {
  it('incrementa o número de exibição dentro do dia', () => {
    expect(proximaExibicao({ periodicidade: 'diaria' }, [])).toBe(1)
    expect(proximaExibicao({ periodicidade: 'diaria' }, [{ exibicao_numero: 1 }])).toBe(2)
    expect(
      proximaExibicao({ periodicidade: 'diaria' }, [{ exibicao_numero: 1 }, { exibicao_numero: 2 }]),
    ).toBe(3)
  })

  it('ignora numeração fora de ordem', () => {
    expect(
      proximaExibicao({ periodicidade: 'unica' }, [{ exibicao_numero: 3 }, { exibicao_numero: 1 }]),
    ).toBe(4)
  })
})

describe('detectarTipoMidia', () => {
  it('detecta por MIME type', () => {
    expect(detectarTipoMidia('video/mp4', 'a.mp4')).toBe('video')
    expect(detectarTipoMidia('image/png', 'a.png')).toBe('foto')
    expect(detectarTipoMidia('audio/mpeg', 'a.mp3')).toBe('audio')
  })

  it('detecta por extensão quando o MIME é genérico', () => {
    expect(detectarTipoMidia('', 'gravacao.mov')).toBe('video')
    expect(detectarTipoMidia('application/octet-stream', 'foto.JPEG')).toBe('foto')
    expect(detectarTipoMidia('', 'musica.m4a')).toBe('audio')
  })

  it('devolve null para arquivo não suportado', () => {
    expect(detectarTipoMidia('application/pdf', 'doc.pdf')).toBeNull()
    expect(detectarTipoMidia('', 'planilha.xlsx')).toBeNull()
  })
})

describe('formatarDuracao / duracaoParaMs', () => {
  it('formata segundos, minutos e combinações', () => {
    expect(formatarDuracao(30)).toBe('30s')
    expect(formatarDuracao(60)).toBe('1m')
    expect(formatarDuracao(90)).toBe('1m 30s')
    expect(formatarDuracao(3600)).toBe('60m')
  })

  it('converte para milissegundos', () => {
    expect(duracaoParaMs(15)).toBe(15_000)
    expect(duracaoParaMs(90)).toBe(90_000)
    expect(duracaoParaMs(-5)).toBe(0)
  })
})

describe('validarComunicado — descrição obrigatória', () => {
  const base = {
    descricao: 'Manutenção programada',
    destinoUsuarioId: null,
    enviarParaTodos: true,
    periodicidade: 'unica' as Periodicidade,
    vezesPorDia: 1,
    duracaoSegundos: 15,
    dataInicio: HOJE,
    horaInicio: '08:00:00',
    dataFim: null,
    midias: [],
  }

  it('aceita um comunicado válido', () => {
    const r = validarComunicado(base)
    expect(r.valido).toBe(true)
    expect(r.erros).toHaveLength(0)
  })

  it('rejeita descrição vazia', () => {
    const r = validarComunicado({ ...base, descricao: '   ' })
    expect(r.valido).toBe(false)
    expect(r.erros.join()).toMatch(/descrição/i)
  })

  it('rejeita descrição muito longa', () => {
    const r = validarComunicado({ ...base, descricao: 'a'.repeat(2001) })
    expect(r.valido).toBe(false)
    expect(r.erros.join()).toMatch(/2000/)
  })
})

describe('validarComunicado — destinatário', () => {
  const base = {
    descricao: 'Aviso',
    destinoUsuarioId: null,
    enviarParaTodos: false,
    periodicidade: 'unica' as Periodicidade,
    vezesPorDia: 1,
    duracaoSegundos: 15,
    dataInicio: HOJE,
    horaInicio: '08:00:00',
    dataFim: null,
    midias: [],
  }

  it('exige destinatário quando não é para todos', () => {
    const r = validarComunicado(base)
    expect(r.valido).toBe(false)
    expect(r.erros.join()).toMatch(/destinatário/i)
  })

  it('aceita usuário específico selecionado', () => {
    const r = validarComunicado({ ...base, destinoUsuarioId: 'uuid-123' })
    expect(r.valido).toBe(true)
  })

  it('aceita "todos" sem destinatário', () => {
    const r = validarComunicado({ ...base, enviarParaTodos: true, destinoUsuarioId: null })
    expect(r.valido).toBe(true)
  })
})

describe('validarComunicado — datas', () => {
  const base = {
    descricao: 'Aviso',
    destinoUsuarioId: null,
    enviarParaTodos: true,
    periodicidade: 'unica' as Periodicidade,
    vezesPorDia: 1,
    duracaoSegundos: 15,
    dataInicio: HOJE,
    horaInicio: '08:00:00',
    dataFim: null,
    midias: [],
  }

  it('rejeita data de início mal formatada', () => {
    const r = validarComunicado({ ...base, dataInicio: '15/10/2026' })
    expect(r.valido).toBe(false)
    expect(r.erros.join()).toMatch(/Data de início/i)
  })

  it('rejeita data final anterior à inicial', () => {
    const r = validarComunicado({ ...base, dataFim: '2026-10-01' })
    expect(r.valido).toBe(false)
    expect(r.erros.join()).toMatch(/anterior/i)
  })

  it('aceita data final igual ou posterior à inicial', () => {
    expect(validarComunicado({ ...base, dataFim: HOJE }).valido).toBe(true)
    expect(validarComunicado({ ...base, dataFim: '2026-12-31' }).valido).toBe(true)
  })
})

describe('validarComunicado — periodicidade e duração', () => {
  const base = {
    descricao: 'Aviso',
    destinoUsuarioId: null,
    enviarParaTodos: true,
    periodicidade: 'diaria' as Periodicidade,
    vezesPorDia: 3,
    duracaoSegundos: 15,
    dataInicio: HOJE,
    horaInicio: '08:00:00',
    dataFim: null,
    midias: [],
  }

  it('rejeita zero exibições por dia', () => {
    const r = validarComunicado({ ...base, vezesPorDia: 0 })
    expect(r.valido).toBe(false)
    expect(r.erros.join()).toMatch(/mínimo 1/)
  })

  it('rejeita mais de 100 exibições por dia', () => {
    const r = validarComunicado({ ...base, vezesPorDia: MAX_EXIBICOES_DIA + 1 })
    expect(r.valido).toBe(false)
    expect(r.erros.join()).toMatch(new RegExp(String(MAX_EXIBICOES_DIA)))
  })

  it('ignora vezes_por_dia no modo "todo dia"', () => {
    const r = validarComunicado({ ...base, periodicidade: 'todo_dia', vezesPorDia: 0 })
    expect(r.valido).toBe(true)
  })

  it('rejeita duração menor que 1 segundo', () => {
    const r = validarComunicado({ ...base, duracaoSegundos: 0 })
    expect(r.valido).toBe(false)
    expect(r.erros.join()).toMatch(/1 segundo/)
  })

  it('rejeita duração acima do máximo', () => {
    const r = validarComunicado({ ...base, duracaoSegundos: DURACAO_MAXIMA_SEGUNDOS + 1 })
    expect(r.valido).toBe(false)
    expect(r.erros.join()).toMatch(new RegExp(String(DURACAO_MAXIMA_SEGUNDOS)))
  })

  it('aceita minutos convertidos em segundos', () => {
    expect(validarComunicado({ ...base, duracaoSegundos: 90 }).valido).toBe(true)
  })
})

describe('validarComunicado — mídias', () => {
  const base = {
    descricao: 'Aviso',
    destinoUsuarioId: null,
    enviarParaTodos: true,
    periodicidade: 'unica' as Periodicidade,
    vezesPorDia: 1,
    duracaoSegundos: 15,
    dataInicio: HOJE,
    horaInicio: '08:00:00',
    dataFim: null,
    midias: [] as Array<{ tipo: 'video' | 'foto' | 'audio'; size: number; mimeType: string }>,
  }

  it('aceita vídeo, foto e áudio com MIME compatível', () => {
    const r = validarComunicado({
      ...base,
      midias: [
        { tipo: 'video', size: 1000, mimeType: 'video/mp4' },
        { tipo: 'foto', size: 2000, mimeType: 'image/png' },
        { tipo: 'audio', size: 3000, mimeType: 'audio/mpeg' },
      ],
    })
    expect(r.valido).toBe(true)
  })

  it('rejeita MIME incompatível com o tipo declarado', () => {
    const r = validarComunicado({
      ...base,
      midias: [{ tipo: 'video', size: 1000, mimeType: 'image/png' }],
    })
    expect(r.valido).toBe(false)
    expect(r.erros.join()).toMatch(/não suportado/i)
  })

  it('rejeita arquivo acima de 100 MB', () => {
    const r = validarComunicado({
      ...base,
      midias: [{ tipo: 'video', size: 101 * 1024 * 1024, mimeType: 'video/mp4' }],
    })
    expect(r.valido).toBe(false)
    expect(r.erros.join()).toMatch(/100 MB/)
  })

  it('indica a posição da mídia inválida', () => {
    const r = validarComunicado({
      ...base,
      midias: [
        { tipo: 'foto', size: 1000, mimeType: 'image/png' },
        { tipo: 'foto', size: 1000, mimeType: 'application/pdf' },
      ],
    })
    expect(r.erros.join()).toMatch(/Mídia 2/)
  })
})

describe('fluxo completo — usuário específico vs todos', () => {
  it('comunicado de usuário específico só aparece para ele (controle feito na RPC/RLS)', () => {
    // A regra pura não conhece destinatário: quem aplica o filtro é o servidor.
    // Aqui validamos que a estrutura aceita destinatário sem "todos".
    const r = validarComunicado({
      descricao: 'Relatório individual',
      destinoUsuarioId: 'uuid-abc',
      enviarParaTodos: false,
      periodicidade: 'unica',
      vezesPorDia: 1,
      duracaoSegundos: 20,
      dataInicio: HOJE,
      horaInicio: '09:00:00',
      dataFim: null,
      midias: [],
    })
    expect(r.valido).toBe(true)
  })

  it('ciclo completo: 1x/dia esgota o saldo e volta no dia seguinte', () => {
    const c = comunicadoBase({ periodicidade: 'unica', vezes_por_dia: 1 })
    const sessao1 = { dia: HOJE, jaExibidas: 0, jaExibidoNaSessao: false }
    expect(podeExibir(c, sessao1)).toBe(true)

    const aposExibir = { dia: HOJE, jaExibidas: 1, jaExibidoNaSessao: true }
    expect(podeExibir(c, aposExibir)).toBe(false)

    const amanha = { dia: '2026-10-16', jaExibidas: 0, jaExibidoNaSessao: false }
    expect(podeExibir(c, amanha)).toBe(true)
  })
})
