import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { RefreshCw, ArrowUpCircle } from "lucide-react"

const CHECK_INTERVAL_MS = 2 * 60 * 1000 // 2 minutos
const AUTO_RELOAD_SECONDS = 10
const STORAGE_KEY = 'app_acknowledged_version'

declare const __APP_VERSION__: string | undefined;

// Acessa a versão gerada no build time (injetada via Vite define)
const CURRENT_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null;

export function AppUpdateNotification() {
  const [hasUpdate, setHasUpdate] = useState(false)
  const [countdown, setCountdown] = useState(AUTO_RELOAD_SECONDS)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const doReload = async () => {
    // Salva a versão que estamos atualizando para não mostrar de novo após reload
    try {
      const stored = localStorage.getItem(STORAGE_KEY + '_pending')
      if (stored) {
        localStorage.setItem(STORAGE_KEY, stored)
        localStorage.removeItem(STORAGE_KEY + '_pending')
      }
    } catch {}

    if ("caches" in window) {
      try {
        const names = await caches.keys()
        await Promise.all(names.map(n => caches.delete(n)))
      } catch {}
    }
    if ("serviceWorker" in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(r => r.unregister()))
      } catch {}
    }
    window.location.href = window.location.pathname + '?t=' + Date.now()
  }

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        const serverVersion = data.version
        if (!serverVersion) return

        // Versão que o usuário já reconheceu (salva no localStorage após reload)
        const acknowledgedVersion = localStorage.getItem(STORAGE_KEY)

        // Se a versão do servidor já foi reconhecida, não mostra nada
        if (serverVersion === acknowledgedVersion) return

        // Se é a mesma versão que está rodando agora, marca como reconhecida e ignora
        if (CURRENT_VERSION && serverVersion === CURRENT_VERSION) {
          localStorage.setItem(STORAGE_KEY, serverVersion)
          return
        }

        // Se não temos versão base (dev), adotamos a do servidor e ignoramos
        if (!CURRENT_VERSION) {
          localStorage.setItem(STORAGE_KEY, serverVersion)
          return
        }

        // Nova versão detectada! Salva como pendente e mostra notificação
        localStorage.setItem(STORAGE_KEY + '_pending', serverVersion)
        setHasUpdate(true)
      } catch {
        // silencioso
      }
    }

    fetchVersion()
    const interval = setInterval(fetchVersion, CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  // Contador regressivo quando update detectado
  useEffect(() => {
    if (!hasUpdate) return
    setCountdown(AUTO_RELOAD_SECONDS)

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!)
          doReload()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [hasUpdate])

  return (
    <AnimatePresence>
      {hasUpdate && (
        <motion.div
          initial={{ opacity: 0, y: 80, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 80, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed bottom-14 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-sm px-4"
        >
          <div
            className="rounded-2xl shadow-2xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            {/* Progress bar */}
            <motion.div
              className="h-1 bg-gradient-to-r from-yellow-400 to-orange-400"
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: AUTO_RELOAD_SECONDS, ease: "linear" }}
            />

            <div className="p-4 flex items-start gap-3">
              {/* Icon */}
              <div className="mt-0.5 w-9 h-9 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center shrink-0">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <RefreshCw size={16} className="text-yellow-400" />
                </motion.div>
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm leading-tight">
                  🚀 Nova atualização disponível!
                </p>
                <p className="text-white/50 text-xs mt-0.5">
                  Atualizando em <span className="text-white font-bold">{countdown}s</span>...
                </p>
              </div>

              {/* Button */}
              <button
                onClick={doReload}
                className="shrink-0 flex items-center gap-1.5 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
              >
                <ArrowUpCircle size={14} />
                Agora
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
