import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import {
  BIRTHDAY_CONGRATS_MESSAGE,
  fetchColaboradoresAniversario,
  filtrarAniversariantesDoDia,
  getLocalDateKey,
  markBirthdayModalDismissedInSession,
  wasBirthdayModalDismissedInSession,
  type AniversarianteItem,
} from '../lib/aniversariantes'

const DECORATIVE_SPARKLES = [
  { top: '12%', left: '14%', size: 14, delay: 0, kind: 'star' as const },
  { top: '18%', right: '13%', size: 16, delay: 0.35, kind: 'star' as const },
  { top: '34%', left: '6%', size: 7, delay: 0.2, kind: 'dot' as const },
  { top: '30%', right: '7%', size: 8, delay: 0.55, kind: 'dot' as const },
  { top: '62%', left: '10%', size: 11, delay: 0.45, kind: 'star' as const },
  { top: '60%', right: '11%', size: 12, delay: 0.15, kind: 'star' as const },
  { top: '76%', left: '22%', size: 6, delay: 0.65, kind: 'dot' as const },
  { top: '75%', right: '20%', size: 6, delay: 0.3, kind: 'dot' as const },
]

const CELEBRATION_CONFETTI = [
  { x: '-140px', y: '-110px', r: -35, color: '#F59E0B', delay: 0 },
  { x: '-95px', y: '-145px', r: 28, color: '#2563EB', delay: 0.04 },
  { x: '-45px', y: '-155px', r: -20, color: '#FBBF24', delay: 0.08 },
  { x: '0px', y: '-165px', r: 45, color: '#3B82F6', delay: 0.02 },
  { x: '52px', y: '-150px', r: -40, color: '#F59E0B', delay: 0.06 },
  { x: '102px', y: '-138px', r: 32, color: '#60A5FA', delay: 0.03 },
  { x: '142px', y: '-102px', r: -25, color: '#FDE047', delay: 0.09 },
  { x: '-125px', y: '-55px', r: 50, color: '#3B82F6', delay: 0.05 },
  { x: '128px', y: '-52px', r: -55, color: '#F59E0B', delay: 0.07 },
  { x: '-72px', y: '-95px', r: 18, color: '#FDE68A', delay: 0.1 },
  { x: '76px', y: '-92px', r: -22, color: '#93C5FD', delay: 0.11 },
]

export interface BirthdayAnnouncementViewProps {
  isOpen: boolean
  aniversariantes: AniversarianteItem[]
  congratulated: boolean
  onCongratulate: () => void
  onClose: () => void
}

/**
 * Modal de comunicado de aniversariantes fiel ao modelo visual especificado.
 */
export function BirthdayAnnouncementView({
  isOpen,
  aniversariantes,
  congratulated,
  onCongratulate,
  onClose,
}: BirthdayAnnouncementViewProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || aniversariantes.length === 0) return null

  return (
    <AnimatePresence>
      <motion.div
        key="birthday-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="fixed inset-0 z-[999999] flex items-center justify-center p-4 sm:p-6 bg-black/65 backdrop-blur-sm overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="birthday-modal-title"
        data-testid="birthday-announcement-modal"
      >
        <motion.div
          key="birthday-dialog"
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 8 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-[440px] sm:max-w-[468px] my-auto bg-white rounded-[30px] shadow-[0_32px_80px_-14px_rgba(0,0,0,0.42),0_0_0_1px_rgba(15,23,42,0.06)] px-6 sm:px-8 pt-8 pb-7 sm:pb-8 max-h-[92vh] flex flex-col overflow-hidden text-[#111827]"
        >
          {/* Botão X no canto superior direito */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute top-5 right-5 z-20 w-9 h-9 rounded-full flex items-center justify-center text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] active:scale-95 transition-all cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="w-5 h-5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>

          {/* Topo: Presente 3D preto e dourado com halo dourado e partículas */}
          <div className="relative flex items-center justify-center w-44 h-40 sm:w-48 sm:h-44 mx-auto mb-2 shrink-0 select-none">
            {/* Halo dourado suave */}
            <motion.div
              aria-hidden="true"
              animate={{ scale: [0.96, 1.04, 0.96], opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-1 rounded-full pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle, rgba(251, 191, 36, 0.45) 0%, rgba(245, 158, 11, 0.20) 42%, rgba(251, 191, 36, 0) 72%)',
              }}
            />

            {/* Anel de brilho dourado sutil */}
            <div
              aria-hidden="true"
              className="absolute w-32 h-32 sm:w-36 sm:h-36 rounded-full pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle, rgba(253, 224, 71, 0.25) 0%, rgba(245, 158, 11, 0.08) 55%, transparent 75%)',
              }}
            />

            {/* Partículas e brilhos decorativos ao redor do presente */}
            {DECORATIVE_SPARKLES.map((sp, idx) => (
              <motion.span
                key={idx}
                aria-hidden="true"
                initial={{ opacity: 0.45, scale: 0.85 }}
                animate={{
                  opacity: [0.35, 1, 0.35],
                  scale: [0.8, 1.15, 0.8],
                  y: [0, -4, 0],
                }}
                transition={{
                  duration: 2.6,
                  repeat: Infinity,
                  delay: sp.delay,
                  ease: 'easeInOut',
                }}
                className="absolute pointer-events-none"
                style={{
                  top: sp.top,
                  left: sp.left,
                  right: sp.right,
                }}
              >
                {sp.kind === 'star' ? (
                  <svg
                    width={sp.size}
                    height={sp.size}
                    viewBox="0 0 24 24"
                    fill="#F59E0B"
                    className="drop-shadow-[0_0_6px_rgba(245,158,11,0.55)]"
                  >
                    <path d="M12 2L14.3 9.7L22 12L14.3 14.3L12 22L9.7 14.3L2 12L9.7 9.7L12 2Z" />
                  </svg>
                ) : (
                  <span
                    className="block rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.75)]"
                    style={{ width: sp.size, height: sp.size }}
                  />
                )}
              </motion.span>
            ))}

            {/* Imagem PNG 3D com fundo transparente */}
            <img
              src="/assets/aniversario/presente-3d.png"
              alt="Presente de aniversário 3D"
              className="relative z-10 w-36 h-36 sm:w-40 sm:h-40 object-contain drop-shadow-[0_14px_22px_rgba(17,24,39,0.22)]"
              draggable={false}
            />

            {/* Confetes disparados ao clicar em Parabenizar */}
            {congratulated && (
              <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                {CELEBRATION_CONFETTI.map((c, idx) => (
                  <motion.span
                    key={idx}
                    initial={{ opacity: 1, x: 0, y: 0, scale: 0.4, rotate: 0 }}
                    animate={{ opacity: [1, 1, 0], x: c.x, y: c.y, scale: [0.6, 1.15, 0.9], rotate: c.r }}
                    transition={{ duration: 0.95, delay: c.delay, ease: 'easeOut' }}
                    className="absolute w-2.5 h-2.5 rounded-[3px]"
                    style={{ backgroundColor: c.color }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Título e Subtítulo centralizados */}
          <div className="text-center shrink-0">
            <h2
              id="birthday-modal-title"
              className="text-[26px] sm:text-[28px] font-extrabold tracking-tight text-[#111827] leading-tight"
            >
              Tem festa hoje! 🎉
            </h2>
            <p className="mt-2 text-[15px] sm:text-[15.5px] font-medium text-[#6B7280] leading-relaxed">
              Hoje é o aniversário dos nossos colaboradores:
            </p>
          </div>

          {/* Cartões individuais dos aniversariantes (sem limite de quantidade, com rolagem interna se necessário) */}
          <div
            className="mt-5 mb-6 w-full flex flex-col gap-3 overflow-y-auto pr-0.5 max-h-[250px] sm:max-h-[280px] custom-scrollbar"
            data-testid="birthday-cards-list"
          >
            {aniversariantes.map((aniv, idx) => (
              <div
                key={aniv.id || `${aniv.nome}-${idx}`}
                className="w-full min-h-[60px] bg-[#F4F5F7] border border-[#E5E7EB]/90 rounded-[18px] px-4 py-3.5 flex items-center gap-3.5 shrink-0 transition-colors hover:bg-[#ECEEF2]"
              >
                <span className="text-[22px] leading-none shrink-0 select-none" aria-hidden="true">
                  🎂
                </span>
                <span className="flex-1 text-left text-[15.5px] sm:text-[16px] font-bold text-[#111827] leading-snug break-words">
                  {aniv.nomeFormatado}
                </span>
              </div>
            ))}
          </div>

          {/* Mensagem exibida após clicar em Parabenizar */}
          <AnimatePresence>
            {congratulated && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className="mb-4 rounded-[18px] bg-gradient-to-br from-[#EFF6FF] via-[#F8FAFC] to-[#FEFCE8] border border-[#BFDBFE] px-4 py-3.5 text-center shadow-xs shrink-0"
                data-testid="birthday-congrats-message"
              >
                <p className="text-[14px] sm:text-[14.5px] font-semibold text-[#1E3A8A] whitespace-pre-line leading-relaxed">
                  {BIRTHDAY_CONGRATS_MESSAGE}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Botão azul grande */}
          <button
            type="button"
            onClick={congratulated ? onClose : onCongratulate}
            className="w-full min-h-[65px] rounded-[18px] bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.985] text-white font-bold text-[17px] tracking-tight shadow-[0_12px_28px_-6px_rgba(37,99,235,0.48)] hover:shadow-[0_16px_34px_-6px_rgba(37,99,235,0.58)] transition-all duration-200 flex items-center justify-center gap-2.5 px-6 cursor-pointer shrink-0"
          >
            {congratulated ? (
              <span>Fechar</span>
            ) : (
              <>
                <span className="text-xl leading-none" aria-hidden="true">
                  🎉
                </span>
                <span>Parabenizar</span>
              </>
            )}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * Contêiner automático conectado à autenticação, data atual e tabela `rh_efetivo`.
 * Exibe o comunicado uma única vez por sessão/dia quando houver aniversariantes ativos.
 */
export function BirthdayAnnouncementModal() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentEnv, setCurrentEnv] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sucena_environment') || 'barcarena'
    }
    return 'barcarena'
  })
  const [todayKey, setTodayKey] = useState<string>(() => getLocalDateKey())
  const [dismissed, setDismissed] = useState<boolean>(false)
  const [congratulated, setCongratulated] = useState<boolean>(false)

  // Monitora usuário autenticado
  useEffect(() => {
    let active = true

    supabase.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => {
      if (!active) return
      setCurrentUserId(data?.user?.id || null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user: { id: string } | null } | null) => {
        if (!active) return
        setCurrentUserId(session?.user?.id || null)
        setCongratulated(false)
      }
    )

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  // Monitora troca de ambiente
  useEffect(() => {
    const handleEnvChange = (e: any) => {
      const nextEnv = e?.detail || localStorage.getItem('sucena_environment') || 'barcarena'
      setCurrentEnv(nextEnv)
      setCongratulated(false)
    }
    window.addEventListener('sucena_environment_change', handleEnvChange)
    window.addEventListener('storage', handleEnvChange)
    return () => {
      window.removeEventListener('sucena_environment_change', handleEnvChange)
      window.removeEventListener('storage', handleEnvChange)
    }
  }, [])

  // Atualiza automaticamente caso a data vire (meia-noite) ou ao retornar para a aba
  useEffect(() => {
    const syncDateKey = () => {
      const nextKey = getLocalDateKey()
      setTodayKey((prev) => (prev !== nextKey ? nextKey : prev))
    }

    const interval = setInterval(syncDateKey, 60 * 1000)
    window.addEventListener('focus', syncDateKey)
    document.addEventListener('visibilitychange', syncDateKey)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', syncDateKey)
      document.removeEventListener('visibilitychange', syncDateKey)
    }
  }, [])

  // Sincroniza estado de fechamento na sessão atual
  useEffect(() => {
    if (!currentUserId) {
      setDismissed(true)
      return
    }
    setDismissed(wasBirthdayModalDismissedInSession(currentUserId, currentEnv, todayKey))
    setCongratulated(false)
  }, [currentUserId, currentEnv, todayKey])

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['aniversariantes_efetivo_modal', currentEnv, todayKey],
    queryFn: () => fetchColaboradoresAniversario(currentEnv),
    enabled: Boolean(currentUserId && !dismissed),
    staleTime: 5 * 60 * 1000,
  })

  const aniversariantesHoje = useMemo(() => {
    const [year, month, day] = todayKey.split('-').map(Number)
    const refDate = new Date(year, (month || 1) - 1, day || 1)
    return filtrarAniversariantesDoDia(colaboradores, refDate)
  }, [colaboradores, todayKey])

  const handleClose = useCallback(() => {
    if (currentUserId) {
      markBirthdayModalDismissedInSession(currentUserId, currentEnv, todayKey)
    }
    setDismissed(true)
    setCongratulated(false)
  }, [currentUserId, currentEnv, todayKey])

  const handleCongratulate = useCallback(() => {
    setCongratulated(true)
  }, [])

  const shouldShow = Boolean(currentUserId && !dismissed && aniversariantesHoje.length > 0)

  if (!shouldShow || typeof document === 'undefined') return null

  return createPortal(
    <BirthdayAnnouncementView
      isOpen={shouldShow}
      aniversariantes={aniversariantesHoje}
      congratulated={congratulated}
      onCongratulate={handleCongratulate}
      onClose={handleClose}
    />,
    document.body
  )
}
