/**
 * Sons do jogo sintetizados na hora com a Web Audio API — nenhum arquivo de
 * áudio externo é necessário, o que evita peso no bundle e funciona offline.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export type SomJogo =
  | 'clique'
  | 'acerto'
  | 'erro'
  | 'tique'
  | 'vitoria'
  | 'vitoriaFase'
  | 'vitoriaFinal'
  | 'derrota'
  | 'entrada'
  | 'contagem'

const CHAVE_MUDO = 'caca_palavras_mudo'

/** Cria um envelope simples (ataque + decaimento) sobre um oscilador. */
function tocar(
  ctx: AudioContext,
  destino: AudioNode,
  {
    frequencia,
    duracao,
    tipo = 'sine',
    volume = 0.18,
    atraso = 0,
    glissando = 0,
  }: {
    frequencia: number
    duracao: number
    tipo?: OscillatorType
    volume?: number
    atraso?: number
    glissando?: number
  },
) {
  const inicio = ctx.currentTime + atraso
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = tipo
  osc.frequency.setValueAtTime(frequencia, inicio)
  if (glissando) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, frequencia + glissando),
      inicio + duracao,
    )
  }

  gain.gain.setValueAtTime(0.0001, inicio)
  gain.gain.exponentialRampToValueAtTime(volume, inicio + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao)

  osc.connect(gain)
  gain.connect(destino)
  osc.start(inicio)
  osc.stop(inicio + duracao + 0.05)
}

export function useGameSounds() {
  const ctxRef = useRef<AudioContext | null>(null)
  const [mudo, setMudo] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(CHAVE_MUDO) === '1'
  })

  useEffect(() => {
    localStorage.setItem(CHAVE_MUDO, mudo ? '1' : '0')
  }, [mudo])

  const garantirContexto = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      ctxRef.current = new Ctor()
    }
    if (ctxRef.current.state === 'suspended') {
      void ctxRef.current.resume()
    }
    return ctxRef.current
  }, [])

  const tocarSom = useCallback(
    (som: SomJogo) => {
      if (mudo) return
      const ctx = garantirContexto()
      if (!ctx) return

      const saida = ctx.createGain()
      saida.gain.value = 0.9
      saida.connect(ctx.destination)

      switch (som) {
        case 'clique':
          tocar(ctx, saida, { frequencia: 520, duracao: 0.07, tipo: 'triangle', volume: 0.1 })
          break
        case 'acerto':
          tocar(ctx, saida, { frequencia: 660, duracao: 0.12, tipo: 'sine', volume: 0.16 })
          tocar(ctx, saida, { frequencia: 990, duracao: 0.16, tipo: 'sine', volume: 0.12, atraso: 0.07 })
          break
        case 'erro':
          tocar(ctx, saida, { frequencia: 220, duracao: 0.18, tipo: 'sawtooth', volume: 0.1, glissando: -120 })
          break
        case 'tique':
          tocar(ctx, saida, { frequencia: 1200, duracao: 0.04, tipo: 'square', volume: 0.05 })
          break
        case 'contagem':
          tocar(ctx, saida, { frequencia: 880, duracao: 0.14, tipo: 'square', volume: 0.12 })
          break
        case 'entrada':
          tocar(ctx, saida, { frequencia: 440, duracao: 0.1, tipo: 'triangle', volume: 0.12 })
          tocar(ctx, saida, { frequencia: 660, duracao: 0.12, tipo: 'triangle', volume: 0.1, atraso: 0.08 })
          break
        case 'vitoria':
        case 'vitoriaFase':
          ;[523, 659, 784].forEach((f, i) =>
            tocar(ctx, saida, { frequencia: f, duracao: 0.22, tipo: 'triangle', volume: 0.14, atraso: i * 0.11 }),
          )
          break
        case 'vitoriaFinal':
          ;[523, 659, 784, 1046, 1318].forEach((f, i) =>
            tocar(ctx, saida, { frequencia: f, duracao: 0.3, tipo: 'triangle', volume: 0.16, atraso: i * 0.13 }),
          )
          break
        case 'derrota':
          ;[440, 349, 262].forEach((f, i) =>
            tocar(ctx, saida, { frequencia: f, duracao: 0.32, tipo: 'sawtooth', volume: 0.11, atraso: i * 0.14 }),
          )
          break
      }
    },
    [garantirContexto, mudo],
  )

  return { som: tocarSom, mudo, setMudo, alternarMudo: () => setMudo((v) => !v) }
}
