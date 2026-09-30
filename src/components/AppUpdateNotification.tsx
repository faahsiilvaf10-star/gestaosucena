import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { RefreshCw, ArrowUpCircle } from "lucide-react"

const CHECK_INTERVAL_MS = 2 * 60 * 1000 // 2 minutos
const AUTO_RELOAD_SECONDS = 10

export function AppUpdateNotification() {
  const [hasUpdate, setHasUpdate] = useState(false)
  const [countdown, setCountdown] = useState(AUTO_RELOAD_SECONDS)
  const [newVersion, setNewVersion] = useState("")
  const currentVersionRef = useRef<string | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const doReload = () => {
    if ("caches" in window) {
      caches.keys().then((names) => names.forEach((n) => caches.delete(n)))
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) =>
        regs.forEach((r) => r.unregister())
      )
    }
    window.location.reload()
  }

  useEffect(() => {
    // Busca versão atual na primeira vez
    const fetchVersion = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        if (!currentVersionRef.current) {
          // Primeira leitura — guarda como versão base
          currentVersionRef.current = data.version
          return
        }
        if (data.version !== currentVersionRef.current) {
          setNewVersion(data.version)
          setHasUpdate(true)
        }
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
                  ?? Nova atualização disponível!
                </p>
                <p className="text-white/50 text-xs mt-0.5">
                  Versão <span className="text-yellow-400 font-mono">{newVersion}</span> detectada.
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
