/**
 * Regras de negócio do módulo de Comunicados.
 *
 * Este módulo é intencionalmente puro: não importa React, nem Supabase.
 * Assim as regras de periodicidade, limite diário, janela de exibição e
 * duração podem ser testadas isoladamente.
 */

export type Periodicidade = 'unica' | 'diaria' | 'todo_dia'
export type TipoMidia = 'video' | 'foto' | 'audio' | 'youtube'
export type ModoFechamento = 'manual' | 'automatico'

export interface ComunicadoMidia {
  id: string
  comunicado_id: string
  tipo: TipoMidia
  storage_path: string
  mime_type?: string | null
  capa_path?: string | null
  duracao_segundos?: number | null
  ordem?: number
}

export interface Comunicado {
  id: string
  descricao: string
  destino_usuario_id: string | null
  periodicidade: Periodicidade
  vezes_por_dia: number
  duracao_segundos: number
  data_inicio: string
  hora_inicio: string
  data_fim: string | null
  ativo: boolean
  /** Quando verdadeiro, ignora a janela de data/hora (exibição imediata). */
  imediato?: boolean
  criado_por?: string | null
  criado_em?: string
}

export interface ComunicadoElegivel extends Comunicado {
  midias: ComunicadoMidia[]
  /** Quantas vezes já foi exibido ao usuário no dia. */
  jaExibidas: number
  /** Total permitido no dia conforme a periodicidade. */
  totalPermitidas: number
  /** Se já foi exibido dentro da sessão atual. */
  jaExibidoNaSessao: boolean
}

export const DURACAO_MAXIMA_SEGUNDOS = 3600
export const MAX_EXIBICOES_DIA = 100

/** Converte `YYYY-MM-DD` e `HH:MM:SS` em minutos desde a meia-noite. */
export function minutosDoDia(hora: string): number {
  const [h, m] = hora.split(':')
  return Number(h) * 60 + Number(m || 0)
}

/** Dia local (YYYY-MM-DD) de uma data, no fuso de Brasília. */
export function diaLocal(data: Date = new Date()): string {
  const formatado = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Belem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(data)
  return formatado
}

/**
 * Define se um comunicado pode ser exibido agora.
 *
 * Regras:
 *  - precisa estar ativo
 *  - a data atual precisa estar entre `data_inicio` e `data_fim`
 *  - em `todo_dia`: uma exibição por sessão, sem limite diário
 *  - em `unica`/`diaria`: limitado por `vezes_por_dia`
 */
export function podeExibir(
  comunicado: Pick<Comunicado, 'ativo' | 'data_inicio' | 'hora_inicio' | 'data_fim' | 'periodicidade' | 'vezes_por_dia'> & {
    imediato?: boolean
  },
  opcoes: { dia: string; jaExibidas: number; jaExibidoNaSessao: boolean },
): boolean {
  if (!comunicado.ativo) return false

  // "imediato" ignora a janela de data/hora, mas mantém periodicidade
  // e limite diário.
  if (!comunicado.imediato) {
    const inicio = comunicado.data_inicio
    const fim = comunicado.data_fim

    if (opcoes.dia < inicio) return false
    if (fim && opcoes.dia > fim) return false

    // Horário só é avaliado no dia inicial.
    const ehDiaInicial = opcoes.dia === inicio
    if (ehDiaInicial) {
      const agora = new Date()
      const agoraMin = agora.getHours() * 60 + agora.getMinutes()
      if (agoraMin < minutosDoDia(comunicado.hora_inicio)) return false
    }
  }

  if (comunicado.periodicidade === 'todo_dia') {
    // Não reabrir a mesma janela dentro da mesma sessão.
    return !opcoes.jaExibidoNaSessao
  }

  return opcoes.jaExibidas < comunicado.vezes_por_dia
}

/**
 * Total de exibições permitidas hoje conforme a periodicidade.
 * `todo_dia` não tem limite diário relevante.
 */
export function totalPermitidas(comunicado: Pick<Comunicado, 'periodicidade' | 'vezes_por_dia'>): number {
  return comunicado.periodicidade === 'todo_dia' ? Number.POSITIVE_INFINITY : comunicado.vezes_por_dia
}

/** Resta quantas exibições ainda estão disponíveis hoje. */
export function exibicoesRestantes(
  comunicado: Pick<Comunicado, 'periodicidade' | 'vezes_por_dia'>,
  jaExibidas: number,
): number {
  return Math.max(0, totalPermitidas(comunicado) - jaExibidas)
}

/**
 * Próxima exibição numerada (1-based).
 * Sempre retorna o próximo número livre na sequência do dia.
 */
export function proximaExibicao(
  comunicado: Pick<Comunicado, 'periodicidade'>,
  exibicoesDoDia: Array<{ exibicao_numero: number }>,
): number {
  if (comunicado.periodicidade === 'todo_dia') {
    // Uma por sessão: nunca reaproveita número no mesmo dia
    return 1
  }
  const maior = exibicoesDoDia.reduce((max, e) => Math.max(max, e.exibicao_numero), 0)
  return maior + 1
}

/**
 * Extrai o ID do vídeo de uma URL do YouTube.
 *
 * Aceita os formatos mais comuns:
 *   https://www.youtube.com/watch?v=ID
 *   https://youtu.be/ID
 *   https://www.youtube.com/embed/ID
 *   https://www.youtube.com/shorts/ID
 *   https://www.youtube.com/live/ID
 *   https://m.youtube.com/watch?v=ID
 *
 * Retorna `null` quando o link não é do YouTube ou está malformado.
 */
export function extrairIdYoutube(url: string): string | null {
  if (!url) return null

  const trimmed = url.trim()
  if (!/^https?:\/\//i.test(trimmed)) return null

  let host = ''
  let caminho = ''
  let query = ''

  try {
    const u = new URL(trimmed)
    host = u.hostname.replace(/^www\./i, '').toLowerCase()
    caminho = u.pathname
    query = u.searchParams.get('v') || ''
  } catch {
    return null
  }

  const ehYouTube =
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtu.be' ||
    host.endsWith('.youtube.com')

  if (!ehYouTube) return null

  // youtu.be/ID
  if (host === 'youtu.be') {
    const id = caminho.replace(/^\//, '').split('/')[0]
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
  }

  // ?v=ID
  if (query && /^[A-Za-z0-9_-]{11}$/.test(query)) return query

  // /embed/ID, /shorts/ID, /live/ID, /v/ID
  const segmentos = caminho.split('/').filter(Boolean)
  if (segmentos.length >= 2) {
    const [tipo, id] = segmentos
    if (['embed', 'shorts', 'live', 'v'].includes(tipo) && /^[A-Za-z0-9_-]{11}$/.test(id)) {
      return id
    }
  }

  return null
}

/** URL de incorporação do YouTube, sem barra de progresso de branding. */
export function urlEmbedYoutube(id: string): string {
  // nocookiedomains remove cookies de rastreamento e o logo do YouTube
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=0&controls=0&modestbranding=1&rel=0&playsinline=1&showinfo=0&fs=0&iv_load_policy=3`
}

/** Indica se a URL informada é um link válido de vídeo do YouTube. */
export function ehLinkYoutubeValido(url: string): boolean {
  return extrairIdYoutube(url) !== null
}

export interface MidiaExibicao {
  /** Caminho da mídia visual (foto ou vídeo). */
  url: string
  tipo: TipoMidia
  midiaId: string
  /**
   * Caminho do áudio que deve tocar junto desta mídia.
   * `null` quando não há trilha sonora.
   */
  audioUrl: string | null
}

/**
 * Monta a sequência de exibição.
 *
 * Regras:
 *  - `foto` e `video` viram itens visuais na ordem original
 *  - `audio` NUNCA vira item próprio: é a trilha sonora da mídia visual
 *    que estiver sendo exibida. Se houver várias faixas, a última
 *    acompanha a última mídia visual.
 *  - `capa_path` não é exibida: serve apenas de referência visual no
 *    cadastro e nunca aparece como slide avulso nem miniatura.
 *
 * Assim um comunicado com uma foto e uma música mostra **apenas a foto**
 * enquanto a música toca — sem "1/2", "2/2" nem player visível.
 */
export function montarSequencia(midias: ComunicadoMidia[]): MidiaExibicao[] {
  const ordenadas = [...midias].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))

  const visuais = ordenadas.filter(
    (m) => m.tipo === 'foto' || m.tipo === 'video' || m.tipo === 'youtube',
  )
  const audios = ordenadas.filter((m) => m.tipo === 'audio')

  if (visuais.length === 0) {
    // Sem mídia visual: nada a exibir. O áudio ainda toca (ver `trilhaPadrao`).
    return []
  }

  // Uma faixa por item visual; excedentes ficam sem imagem (som isolado).
  return visuais.map((visual, i) => ({
    url: visual.storage_path,
    tipo: visual.tipo,
    midiaId: visual.id,
    audioUrl: i < audios.length ? audios[i].storage_path : null,
  }))
}

/**
 * Áudio que deve tocar mesmo sem nenhuma mídia visual na sequência.
 * Só existe quando o comunicado tem trilha sonora e nenhuma foto/vídeo.
 */
export function trilhaSemImagem(midias: ComunicadoMidia[]): string | null {
  const ordenadas = [...midias].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
  const temVisual = ordenadas.some(
    (m) => m.tipo === 'foto' || m.tipo === 'video' || m.tipo === 'youtube',
  )
  if (temVisual) return null
  const audio = ordenadas.find((m) => m.tipo === 'audio')
  return audio ? audio.storage_path : null
}


export interface ResultadoValidacao {
  valido: boolean
  erros: string[]
}

/**
 * Valida o formulário de criação no cliente.
 * O servidor valida novamente via RLS/RPC — isto é apenas feedback rápido.
 */
export function validarComunicado(dados: {
  descricao: string
  destinoUsuarioId: string | null
  enviarParaTodos: boolean
  periodicidade: Periodicidade
  vezesPorDia: number
  duracaoSegundos: number
  dataInicio: string
  horaInicio: string
  dataFim: string | null
  midias: Array<{ tipo: TipoMidia; size: number; mimeType: string }>
  /** Link de YouTube informado (opcional). */
  linkYoutube?: string
}): ResultadoValidacao {
  const erros: string[] = []

  if (!dados.descricao || !dados.descricao.trim()) {
    erros.push('A descrição do comunicado é obrigatória.')
  } else if (dados.descricao.length > 2000) {
    erros.push('A descrição não pode passar de 2000 caracteres.')
  }

  if (!dados.enviarParaTodos && !dados.destinoUsuarioId) {
    erros.push('Selecione um destinatário ou marque "Enviar para todos".')
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.dataInicio)) {
    erros.push('Data de início inválida.')
  }

  if (dados.dataFim && !/^\d{4}-\d{2}-\d{2}$/.test(dados.dataFim)) {
    erros.push('Data final inválida.')
  }

  if (dados.dataFim && dados.dataFim < dados.dataInicio) {
    erros.push('A data final não pode ser anterior à data de início.')
  }

  if (dados.periodicidade !== 'todo_dia') {
    if (!Number.isInteger(dados.vezesPorDia) || dados.vezesPorDia < 1) {
      erros.push('A quantidade de exibições por dia deve ser no mínimo 1.')
    } else if (dados.vezesPorDia > MAX_EXIBICOES_DIA) {
      erros.push(`A quantidade não pode passar de ${MAX_EXIBICOES_DIA} por dia.`)
    }
  }

  if (!Number.isFinite(dados.duracaoSegundos) || dados.duracaoSegundos < 1) {
    erros.push('A duração deve ser de pelo menos 1 segundo.')
  } else if (dados.duracaoSegundos > DURACAO_MAXIMA_SEGUNDOS) {
    erros.push(`A duração não pode passar de ${DURACAO_MAXIMA_SEGUNDOS} segundos.`)
  }

  // Validação das mídias
  const TIPOS_PERMITIDOS: Record<TipoMidia, string[]> = {
    video: ['video/mp4', 'video/webm', 'video/quicktime'],
    foto: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    audio: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/x-m4a'],
    youtube: [],
  }
  const TAMANHO_MAXIMO = 100 * 1024 * 1024

  dados.midias.forEach((midia, indice) => {
    const permitidos = TIPOS_PERMITIDOS[midia.tipo]
    if (!permitidos.includes(midia.mimeType)) {
      erros.push(`Mídia ${indice + 1}: tipo de arquivo não suportado para ${midia.tipo}.`)
    }
    if (midia.size > TAMANHO_MAXIMO) {
      erros.push(`Mídia ${indice + 1}: o arquivo excede o limite de 100 MB.`)
    }
  })

  // Validação do link do YouTube (opcional)
  if (dados.linkYoutube && dados.linkYoutube.trim()) {
    if (!ehLinkYoutubeValido(dados.linkYoutube)) {
      erros.push('Link do YouTube inválido. Use um link de watch, youtu.be, embed, shorts ou live.')
    }
  }

  return { valido: erros.length === 0, erros }
}

/** Descobre o tipo de mídia a partir do MIME type do arquivo. */
export function detectarTipoMidia(mimeType: string, nomeArquivo: string): TipoMidia | null {
  const m = mimeType.toLowerCase()
  if (m.startsWith('video/')) return 'video'
  if (m.startsWith('audio/')) return 'audio'
  if (m.startsWith('image/')) return 'foto'

  const ext = nomeArquivo.split('.').pop()?.toLowerCase() || ''
  if (['mp4', 'webm', 'mov', 'm4v'].includes(ext)) return 'video'
  if (['mp3', 'm4a', 'wav', 'ogg', 'aac'].includes(ext)) return 'audio'
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'foto'

  return null
}

/** Converte segundos em um rótulo legível ("1m 30s"). */
export function formatarDuracao(segundos: number): string {
  if (segundos < 60) return `${segundos}s`
  const min = Math.floor(segundos / 60)
  const seg = segundos % 60
  if (seg === 0) return `${min}m`
  return `${min}m ${seg}s`
}

/** Converte a duração configurada para milissegundos (usado no timer do modal). */
export function duracaoParaMs(segundos: number): number {
  if (!Number.isFinite(segundos) || segundos <= 0) return 0
  return Math.round(segundos * 1000)
}
