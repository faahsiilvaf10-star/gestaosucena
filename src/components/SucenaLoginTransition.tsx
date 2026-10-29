import React, { useEffect, useState } from 'react'

interface SucenaLoginTransitionProps {
  onComplete: () => void
}

const S_PATH =
  'M 35.25 0.1 C 36.46 0.08, 40.00 -0.26, 42.25 0.00 C 44.50 0.26, 46.58 0.84, 48.75 1.65 C 50.92 2.46, 53.51 3.79, 55.25 4.85 C 56.99 5.91, 60.08 7.08, 59.20 8.00 C 58.33 8.92, 52.20 9.63, 50.00 10.35 C 47.80 11.07, 47.13 11.61, 46.00 12.30 C 44.88 12.99, 44.00 13.68, 43.25 14.50 C 42.50 15.32, 41.96 16.29, 41.50 17.25 C 41.04 18.21, 40.64 19.04, 40.50 20.25 C 40.36 21.46, 40.29 22.63, 40.65 24.50 C 41.01 26.38, 41.49 28.38, 42.65 31.50 C 43.81 34.63, 46.50 40.38, 47.60 43.25 C 48.70 46.13, 48.89 46.13, 49.25 48.75 C 49.61 51.38, 49.77 56.50, 49.75 59.00 C 49.73 61.50, 49.87 61.46, 49.15 63.75 C 48.43 66.04, 46.68 70.42, 45.45 72.75 C 44.22 75.08, 42.87 76.44, 41.75 77.75 C 40.63 79.06, 39.92 79.69, 38.75 80.60 C 37.58 81.51, 36.75 82.28, 34.75 83.20 C 32.75 84.13, 29.67 85.60, 26.75 86.15 C 23.83 86.70, 19.58 86.63, 17.25 86.50 C 14.92 86.38, 14.83 86.21, 12.75 85.40 C 10.67 84.59, 6.76 82.88, 4.75 81.65 C 2.74 80.42, -0.09 79.16, 0.70 78.00 C 1.49 76.84, 7.03 75.80, 9.50 74.70 C 11.97 73.60, 13.93 72.52, 15.50 71.40 C 17.07 70.28, 18.09 68.98, 18.90 68.00 C 19.71 67.02, 20.00 66.42, 20.35 65.50 C 20.70 64.58, 20.89 63.50, 21.00 62.50 C 21.11 61.50, 21.18 60.75, 21.00 59.50 C 20.82 58.25, 21.30 58.42, 19.90 55.00 C 18.50 51.58, 14.08 42.79, 12.60 39.00 C 11.12 35.21, 11.27 34.63, 11.00 32.25 C 10.73 29.88, 10.70 27.25, 11.00 24.75 C 11.30 22.25, 11.81 19.67, 12.80 17.25 C 13.79 14.83, 15.38 12.26, 16.95 10.25 C 18.52 8.24, 20.53 6.51, 22.25 5.20 C 23.97 3.89, 25.13 3.24, 27.25 2.40 C 29.38 1.56, 33.67 0.53, 35.00 0.15 C 36.33 -0.23, 34.04 0.13, 35.25 0.10 Z'

function playEntrySound() {
  if (typeof window === 'undefined') return
  const now = Date.now()
  if ((window as any).__last_entry_sound_at && now - (window as any).__last_entry_sound_at < 5000) {
    return
  }
  (window as any).__last_entry_sound_at = now
  try {
    const audio = new Audio('/Som_entrada.mp3')
    audio.volume = 0.85
    audio.play().catch(err => {
      console.warn('Autoplay do som de entrada bloqueado pelo navegador:', err)
    })
  } catch (err) {
    console.warn('Erro ao tocar som de entrada:', err)
  }
}

export function SucenaLoginTransition({ onComplete }: SucenaLoginTransitionProps) {
  const [reducedMotion, setReducedMotion] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('Iniciando sistema...')

  useEffect(() => {
    // Toca o som de entrada ao iniciar a transição
    playEntrySound()

    const isReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setReducedMotion(isReduced)

    if (isReduced) {
      const t = setTimeout(() => {
        onComplete()
      }, 1400)
      return () => clearTimeout(t)
    }

    // Exatamente 7.0 segundos no fluxo completo
    const tStatus1 = setTimeout(() => setLoadingStatus('Carregando ambiente e módulos...'), 4800)
    const tStatus2 = setTimeout(() => setLoadingStatus('Acesso autorizado!'), 6200)
    const tComplete = setTimeout(() => {
      onComplete()
    }, 7000)

    return () => {
      clearTimeout(tStatus1)
      clearTimeout(tStatus2)
      clearTimeout(tComplete)
    }
  }, [onComplete])

  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center select-none overflow-hidden"
      style={{
        background: '#070709',
        animation: reducedMotion ? 'fadeAllReduced 1.4s ease forwards' : 'fadeAll 7.0s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
      role="status"
      aria-label="Carregando o sistema Sucena"
    >
      <style>{`
        @keyframes fadeAll {
          0% { opacity: 0; }
          4% { opacity: 1; }
          93% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.02); pointer-events: none; }
        }
        @keyframes fadeAllReduced {
          0% { opacity: 0; }
          15% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; pointer-events: none; }
        }
        @keyframes ambientPulse {
          0%, 100% { opacity: 0.22; transform: scale(0.98); }
          50% { opacity: 0.38; transform: scale(1.06); }
        }
        @keyframes sDrawContour {
          0% { stroke-dashoffset: 100; opacity: 0; }
          8% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes sFillIn {
          0% { opacity: 0; transform: scale(0.96); filter: drop-shadow(0 0 0 rgba(255,196,0,0)); }
          70% { opacity: 1; transform: scale(1.02); filter: drop-shadow(0 0 28px rgba(255,200,0,0.65)); }
          100% { opacity: 1; transform: scale(1); filter: drop-shadow(0 0 16px rgba(255,196,0,0.4)); }
        }
        @keyframes beamSweep {
          0% { transform: translateX(-100px) skewX(-24deg); opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateX(120px) skewX(-24deg); opacity: 0; }
        }
        @keyframes textEmerge {
          0% { opacity: 0; transform: translateX(-14px); filter: blur(4px); }
          100% { opacity: 1; transform: translateX(0); filter: blur(0); }
        }
        @keyframes subtextEmerge {
          0% { opacity: 0; transform: translateY(6px); letter-spacing: 0.15em; }
          100% { opacity: 0.88; transform: translateY(0); letter-spacing: 0.34em; }
        }
        @keyframes progressCharge {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        @keyframes progressSpark {
          0% { opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      {/* Ambient golden glow behind logo */}
      <div
        className="absolute w-[560px] h-[340px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255, 196, 0, 0.18) 0%, rgba(229, 168, 0, 0.06) 45%, transparent 70%)',
          filter: 'blur(70px)',
          animation: reducedMotion ? 'none' : 'ambientPulse 5s ease-in-out infinite',
        }}
      />

      {/* Central Brand Box */}
      <div className="relative z-10 flex flex-col items-center">
        {/* SVG Vector Logo */}
        <div className="w-[320px] sm:w-[420px] max-w-[90vw] px-2">
          <svg
            viewBox="0 0 240 98"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-auto overflow-visible"
            aria-hidden="true"
          >
            <defs>
              {/* Rich Golden Gradient */}
              <linearGradient id="sucenaGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFF1A8" />
                <stop offset="35%" stopColor="#FFCC00" />
                <stop offset="75%" stopColor="#E5A800" />
                <stop offset="100%" stopColor="#C48800" />
              </linearGradient>

              {/* Shimmer Light Beam Gradient */}
              <linearGradient id="beamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
                <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>

              {/* Clip mask of S for the light beam sweep */}
              <clipPath id="sClipMask">
                <path d={S_PATH} />
              </clipPath>
            </defs>

            {/* S GROUP */}
            <g id="s-mark" transform="translate(0, 0)">
              {/* 1. Contour Stroke (Draws from 0s to 1.8s) */}
              <path
                d={S_PATH}
                fill="none"
                stroke="#FFCC00"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength="100"
                style={
                  reducedMotion
                    ? { strokeDasharray: 100, strokeDashoffset: 0, opacity: 1 }
                    : {
                        strokeDasharray: 100,
                        strokeDashoffset: 100,
                        animation: 'sDrawContour 1.8s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                      }
                }
              />

              {/* 2. Golden Fill (Lands with radiant glow at 1.8s - 3.0s) */}
              <path
                d={S_PATH}
                fill="url(#sucenaGoldGrad)"
                style={
                  reducedMotion
                    ? { opacity: 1 }
                    : {
                        opacity: 0,
                        animation: 'sFillIn 1.2s cubic-bezier(0.16, 1, 0.3, 1) 1.8s forwards',
                      }
                }
              />

              {/* 3. Feixe de Luz / Sheen Beam (sweeps across S at 3.0s - 4.2s) */}
              {!reducedMotion && (
                <g clipPath="url(#sClipMask)">
                  <rect
                    x="0"
                    y="-10"
                    width="45"
                    height="110"
                    fill="url(#beamGrad)"
                    style={{
                      opacity: 0,
                      animation: 'beamSweep 1.2s cubic-bezier(0.2, 0, 0.3, 1) 3.0s forwards',
                    }}
                  />
                </g>
              )}
            </g>

            {/* TEXT GROUP: UCENA & EMPREENDIMENTOS (Emerge at 4.0s - 5.2s) */}
            <g id="text-mark" transform="translate(64, 0)">
              {/* UCENA Bold Sans */}
              <text
                x="0"
                y="69"
                fill="#FFFFFF"
                fontFamily="Montserrat, Inter, 'Segoe UI', system-ui, -apple-system, sans-serif"
                fontWeight="900"
                fontSize="42"
                letterSpacing="3"
                style={
                  reducedMotion
                    ? { opacity: 1 }
                    : {
                        opacity: 0,
                        animation: 'textEmerge 1.1s cubic-bezier(0.16, 1, 0.3, 1) 4.0s forwards',
                      }
                }
              >
                UCENA
              </text>

              {/* EMPREENDIMENTOS Tracking */}
              <text
                x="1.5"
                y="89"
                fill="#C3C6CE"
                fontFamily="Montserrat, Inter, 'Segoe UI', system-ui, -apple-system, sans-serif"
                fontWeight="700"
                fontSize="9.8"
                letterSpacing="0.34em"
                style={
                  reducedMotion
                    ? { opacity: 0.85 }
                    : {
                        opacity: 0,
                        animation: 'subtextEmerge 1.1s cubic-bezier(0.16, 1, 0.3, 1) 4.3s forwards',
                      }
                }
              >
                EMPREENDIMENTOS
              </text>
            </g>
          </svg>
        </div>

        {/* Loading Progress Bar (Carrega de 4.8s até 6.6s) */}
        <div className="w-[240px] sm:w-[280px] mt-10 flex flex-col items-center">
          <div className="w-full h-[3px] bg-white/10 rounded-full overflow-hidden relative">
            <div
              className="h-full rounded-full relative"
              style={{
                background: 'linear-gradient(90deg, #FFE066 0%, #FFCC00 60%, #E5A800 100%)',
                boxShadow: '0 0 10px rgba(255, 204, 0, 0.65)',
                animation: reducedMotion
                  ? 'progressCharge 0.8s ease forwards'
                  : 'progressCharge 1.8s cubic-bezier(0.4, 0, 0.2, 1) 4.8s forwards',
                width: reducedMotion ? '100%' : '0%',
              }}
            />
          </div>

          {/* Status text */}
          <p
            className="text-[11px] font-medium tracking-wider uppercase mt-3 transition-opacity duration-300"
            style={{ color: '#A0A4AE' }}
          >
            {loadingStatus}
          </p>
        </div>
      </div>
    </div>
  )
}

