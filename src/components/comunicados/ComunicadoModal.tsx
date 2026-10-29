import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  duracaoParaMs,
  montarSequencia,
  trilhaSemImagem,
  urlEmbedYoutube,
  type ComunicadoElegivel,
  type MidiaExibicao,
} from '../../lib/comunicados/regras'
import {
  registrarExibicao,
  registrarFechamento,
  urlPublicaMidia,
} from '../../lib/comunicados/api'

interface Props {
  comunicado: ComunicadoElegivel
  sessionKey: string
  /** Notifica que o comunicado entrou em exibição. */
  onExibir?: () => void
  onClose: () => void
}

/**
 * Captura o comunicado apenas na montagem.
 *
 * O polling do viewer devolve objetos novos a cada consulta; sem esta
 * trava, qualquer re-render reiniciaria o contador regressivo.
 */
function useCongelado<T>(valor: T): T {
  const ref = useRef(valor)
  return ref.current
}

/**
 * Modal de exibição do comunicado Sucena.
 *
 * Mídias:
 *  - foto e vídeo aparecem individualmente
 *  - áudio NUNCA mostra player. Quando acompanha uma imagem, a imagem
 *    é exibida e a música toca junto, sincronizada. Quando está sozinho
 *    (sem imagem), nada é exibido — apenas a descrição.
 *
 * Fecha automaticamente após `duracao_segundos` ou pelo botão "Entendi".
 * Sem botão "X".
 */
export function ComunicadoModal({
  comunicado: comunicadoExterno,
  sessionKey,
  onExibir,
  onClose,
}: Props) {
  // Fixa o comunicado na montagem: o polling revalida a lista a cada
  // 15s e devolveria outra referência, reiniciando a contagem.
  const comunicado = useCongelado(comunicadoExterno)

  const [indice, setIndice] = useState(0)
  const [exibicaoId, setExibicaoId] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Avisa que entrou em exibição, para o viewer travar este item
  const avisouExibicao = useRef(false)
  useEffect(() => {
    if (avisouExibicao.current) return
    avisouExibicao.current = true
    onExibir?.()
  }, [onExibir])

  // Sanidade: a duração precisa ser um número válido e positivo.
  // Se vier undefined/NaN por algum problema na RPC, evita travar em 0.
  const duracaoSegundos =
    Number.isFinite(comunicado.duracao_segundos) && comunicado.duracao_segundos > 0
      ? comunicado.duracao_segundos
      : 15

  const [restante, setRestante] = useState(duracaoSegundos)

  const midias = comunicado.midias ?? []

  // Somente fotos e vídeos viram slides. A música é trilha sonora:
  // toca junto da imagem, sem virar um slide próprio.
  const sequencia: MidiaExibicao[] = useMemo(
    () => montarSequencia(midias),
    [midias],
  )

  const atual = sequencia[indice]

  // Áudio que acompanha a mídia visível atual
  const audioDaVez = atual?.audioUrl
    ? urlPublicaMidia(atual.audioUrl)
    : null

  // Caso raro: música sem nenhuma foto/vídeo no comunicado
  const audioSozinho = useMemo(() => {
    if (sequencia.length > 0) return null
    const path = trilhaSemImagem(midias)
    return path ? urlPublicaMidia(path) : null
  }, [midias, sequencia.length])

  const audioAtual = audioDaVez ?? audioSozinho
  const temAudio = Boolean(audioAtual)

  // Registra a exibição assim que o modal abre
  useEffect(() => {
    let cancelado = false
    registrarExibicao(comunicado.id, sessionKey).then((id: string | null) => {
      if (!cancelado) setExibicaoId(id)
    })
    return () => {
      cancelado = true
    }
  }, [comunicado.id, sessionKey])

  const fechar = useCallback(
    (modo: 'manual' | 'automatico') => {
      audioRef.current?.pause()
      if (exibicaoId) {
        registrarFechamento(exibicaoId, modo)
      }
      onClose()
    },
    [exibicaoId, onClose],
  )

  // Dispara a reprodução automática assim que a mídia está pronta.
  // Navegadores só permitem tocar após gesto do usuário: se for o caso,
  // tenta de novo no primeiro clique/toque em qualquer lugar.
  useEffect(() => {
    if (!temAudio) return
    let tocando = false

    const tentar = async () => {
      if (tocando) return
      const el = audioRef.current
      if (!el) return
      try {
        el.currentTime = 0
        await el.play()
        tocando = true
      } catch {
        // Autoplay bloqueado: aguarda um gesto do usuário
      }
    }

    void tentar()

    const id = window.setTimeout(tentar, 350)

    const aoInteragir = () => {
      void tentar()
    }
    window.addEventListener('pointerdown', aoInteragir)
    window.addEventListener('keydown', aoInteragir)

    return () => {
      window.clearTimeout(id)
      window.removeEventListener('pointerdown', aoInteragir)
      window.removeEventListener('keydown', aoInteragir)
    }
  }, [temAudio, audioAtual])

  // Contador regressivo + fechamento automático.
  //
  // Usa uma flag LOCAL (e não um ref compartilhado) porque outros
  // efeitos deste componente também fazem cleanup. Com um ref único,
  // o cleanup do efeito de áudio marcava `montado = false` e o timer
  // parava de contar — o modal fechava antes do tempo configurado.
  //
  // O prazo é absoluto (`Date.now()`): se o efeito re-executar, o
  // prazo já consumido continua valendo e a contagem não reinicia.
  useEffect(() => {
    const totalMs = duracaoParaMs(duracaoSegundos)
    const inicio = Date.now()
    let ativo = true

    const intervalo = window.setInterval(() => {
      if (!ativo) return
      const decorrido = Date.now() - inicio
      const faltaMs = totalMs - decorrido

      if (faltaMs <= 0) {
        window.clearInterval(intervalo)
        ativo = false
        fechar('automatico')
        return
      }
      setRestante(Math.ceil(faltaMs / 1000))
    }, 250)

    return () => {
      ativo = false
      window.clearInterval(intervalo)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duracaoSegundos])

  // Fecha com ESC (acessibilidade)
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar('manual')
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [fechar])

  // Vídeo avança sozinho; imagem avança ao clicar
  const avancar = useCallback(() => {
    if (indice < sequencia.length - 1) {
      setIndice(indice + 1)
    }
  }, [indice, sequencia.length])

  return (
    <div
      className="comunicado-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="comunicado-titulo"
    >
      {/* Player de áudio invisível: nenhuma interface de reprodução
          é exibida. A música toca junto da imagem, sem botão de play. */}
      {temAudio && (
        <audio
          ref={audioRef}
          key={audioAtual ?? 'audio'}
          src={audioAtual ?? undefined}
          autoPlay
          playsInline
          preload="auto"
          loop={sequencia.length === 0}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
      )}

      <div className="comunicado flex flex-col max-h-[90vh]">
        {/* LOGO original Sucena sobreposta no topo */}
        <img
          src="/logo.png"
          alt="Sucena"
          className="comunicado-logo"
        />

        {/* Cabeçalho com o Título */}
        <div className="comunicado-titulo">
          <span className="comunicado-icone" aria-hidden="true">
            📢
          </span>
          <h2 id="comunicado-titulo" className="m-0 p-0 text-[22px] font-[800] leading-tight text-[#111111]">
            Comunicado
          </h2>
        </div>

        {/* Mídia visual (fotos, vídeos e vídeos do YouTube), se houver */}
        {atual && (
          <div className="w-full shrink-0 bg-black/90 flex items-center justify-center overflow-hidden">
            {atual.tipo === 'video' && (
              <video
                key={atual.midiaId}
                src={urlPublicaMidia(atual.url)}
                autoPlay
                playsInline
                muted={!temAudio}
                onEnded={avancar}
                className="w-full max-h-[45vh] object-contain"
              >
                Seu navegador não suporta vídeo.
              </video>
            )}

            {atual.tipo === 'youtube' && (
              <div
                key={atual.midiaId}
                className="w-full aspect-video bg-black"
                style={{ maxHeight: '45vh' }}
              >
                <iframe
                  src={urlEmbedYoutube(atual.url)}
                  title="Vídeo do comunicado"
                  className="w-full h-full border-0"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  style={{ display: 'block' }}
                />
              </div>
            )}

            {atual.tipo === 'foto' && (
              <img
                key={atual.midiaId}
                src={urlPublicaMidia(atual.url)}
                alt="Mídia do comunicado"
                onClick={avancar}
                className="w-full max-h-[45vh] object-contain cursor-pointer"
              />
            )}
          </div>
        )}

        {/* Corpo do comunicado */}
        <div className="comunicado-conteudo overflow-y-auto custom-scrollbar flex-1">
          {comunicado.descricao}
        </div>

        {/* Rodapé: barra de progresso dourada + "Fecha em Xs" + botão Entendi */}
        <div className="comunicado-rodape">
          <div
            className="comunicado-progresso"
            role="progressbar"
            aria-label="Tempo restante para fechar automaticamente"
            aria-valuenow={restante}
            aria-valuemin={0}
            aria-valuemax={duracaoSegundos}
          >
            <div
              className="comunicado-progresso-barra"
              style={{
                animationDuration: `${duracaoSegundos}s`,
              }}
            />
          </div>

          <div className="comunicado-acoes">
            <span className="comunicado-tempo" aria-live="polite">
              Fecha em {restante}s
            </span>

            <button
              type="button"
              onClick={() => fechar('manual')}
              className="comunicado-botao-entendi"
            >
              Entendi
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
