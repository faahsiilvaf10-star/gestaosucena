import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import X from 'lucide-react/dist/esm/icons/x.js'
import { useTheme } from '../../contexts/ThemeContext'
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
  onClose: () => void
}

/**
 * Modal de exibição do comunicado.
 *
 * Mídias:
 *  - foto e vídeo aparecem individualmente
 *  - áudio NUNCA mostra player. Quando acompanha uma imagem, a imagem
 *    é exibida e a música toca junto, sincronizada. Quando está sozinho
 *    (sem imagem), nada é exibido — apenas a descrição.
 *
 * Fecha automaticamente após `duracao_segundos` e também pelo botão "X".
 */
export function ComunicadoModal({ comunicado, sessionKey, onClose }: Props) {
  const { isDark } = useTheme()
  const [indice, setIndice] = useState(0)
  const [exibicaoId, setExibicaoId] = useState<string | null>(null)

  const montadoRef = useRef(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)

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

  // Contador regressivo + fechamento automático
  useEffect(() => {
    const totalMs = duracaoParaMs(duracaoSegundos)
    const inicio = Date.now()

    const intervalo = window.setInterval(() => {
      if (!montadoRef.current) return
      const decorrido = Date.now() - inicio
      const faltaMs = totalMs - decorrido

      if (faltaMs <= 0) {
        window.clearInterval(intervalo)
        fechar('automatico')
        return
      }
      setRestante(Math.ceil(faltaMs / 1000))
    }, 250)

    return () => {
      montadoRef.current = false
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

  const progresso = duracaoSegundos > 0
    ? Math.max(0, Math.min(100, (restante / duracaoSegundos) * 100))
    : 0

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
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

      <div
        className={`relative w-full max-w-lg max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col ${
          isDark ? 'bg-[#1A1B20] border border-white/10' : 'bg-white border border-black/10'
        }`}
      >
        {/* Cabeçalho */}
        <div
          className={`flex items-center justify-between px-5 py-4 shrink-0 ${
            isDark ? 'border-b border-white/10' : 'border-b border-black/10'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-lg" aria-hidden="true">
              📢
            </span>
            <h2
              id="comunicado-titulo"
              className={`font-bold text-base ${isDark ? 'text-white' : 'text-[#1c1d21]'}`}
            >
              Comunicado
            </h2>
          </div>

          <button
            onClick={() => fechar('manual')}
            aria-label="Fechar comunicado"
            className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
              isDark
                ? 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                : 'bg-black/5 text-gray-600 hover:bg-black/10 hover:text-[#1c1d21]'
            }`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Mídia visual (fotos, vídeos e vídeos do YouTube) */}
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

        {/* Descrição */}
        <div className="px-5 py-4 overflow-y-auto custom-scrollbar flex-1">
          <p
            className={`text-[15px] leading-relaxed whitespace-pre-wrap ${
              isDark ? 'text-white/90' : 'text-[#1c1d21]'
            }`}
          >
            {comunicado.descricao}
          </p>
        </div>

        {/* Rodapé: barra de tempo + botão */}
        <div
          className={`px-5 py-4 shrink-0 ${isDark ? 'border-t border-white/10' : 'border-t border-black/10'}`}
        >
          <div
            className="h-1 w-full rounded-full overflow-hidden mb-3"
            role="progressbar"
            aria-label="Tempo restante para fechar automaticamente"
            aria-valuenow={restante}
            aria-valuemin={0}
            aria-valuemax={duracaoSegundos}
            style={{ background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-300 ease-linear"
              style={{
                width: `${progresso}%`,
                background: isDark ? '#c9a84c' : '#b8860b',
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <span
              className={`text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}
              aria-live="polite"
            >
              Fecha em {restante}s
            </span>

            <button
              onClick={() => fechar('manual')}
              className="px-6 py-2.5 font-bold rounded-xl transition-colors active:scale-95 text-[#1c1d21] dark:text-white"
              style={{ background: isDark ? '#c9a84c' : '#b8860b' }}
            >
              Entendi
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}