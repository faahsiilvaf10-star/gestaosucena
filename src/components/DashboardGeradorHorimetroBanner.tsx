import React, { useState, useEffect, useMemo } from 'react'
import Zap from 'lucide-react/dist/esm/icons/zap.js'
import Clock from 'lucide-react/dist/esm/icons/clock.js'
import AlertTriangle from 'lucide-react/dist/esm/icons/triangle-alert.js'
import ShieldAlert from 'lucide-react/dist/esm/icons/shield-alert.js'
import Edit3 from 'lucide-react/dist/esm/icons/pen-line.js'
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.js'
import {
  GeradorHorimetroData,
  getGeradorHorimetro,
  calcHorasRestantes,
  getStatusGerador,
  GERADOR_HORIMETRO_UPDATED_EVENT
} from '../lib/geradorHorimetro'
import { GeradorHorimetroModal } from './GeradorHorimetroModal'
import { supabase } from '../lib/supabase'

interface DashboardGeradorHorimetroBannerProps {
  currentEnv?: string
}

export function DashboardGeradorHorimetroBanner({
  currentEnv
}: DashboardGeradorHorimetroBannerProps) {
  const [data, setData] = useState<GeradorHorimetroData | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const res = await getGeradorHorimetro(currentEnv)
      setData(res)
    } catch (e) {
      console.error('Erro ao carregar dados do gerador no dashboard:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    const handleLocalUpdate = (e: any) => {
      if (e?.detail) setData(e.detail)
    }
    window.addEventListener(GERADOR_HORIMETRO_UPDATED_EVENT, handleLocalUpdate)

    // Supabase Realtime para sincronizar atualizações feitas por outros usuários/dispositivos
    const targetEnv =
      currentEnv ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('sucena_environment') || 'barcarena'
        : 'barcarena')
    const key = `gerador_horimetro_${targetEnv}`

    const channel = supabase
      .channel(`rt_gerador_horimetro_${targetEnv}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'global_settings', filter: `key=eq.${key}` },
        () => {
          loadData()
        }
      )
      .subscribe()

    return () => {
      window.removeEventListener(GERADOR_HORIMETRO_UPDATED_EVENT, handleLocalUpdate)
      supabase.removeChannel(channel)
    }
  }, [currentEnv])

  const numCurrent = data?.currentHorimeter ?? 0
  const numNext = data?.nextMaintenanceHorimeter ?? 250
  const remainingHours = calcHorasRestantes(numCurrent, numNext)
  const status = getStatusGerador(numCurrent, numNext, data?.alertHoursThreshold || 20)

  const progressPercent = useMemo(() => {
    if (numNext <= 0) return 0
    const pct = (numCurrent / numNext) * 100
    return Math.min(100, Math.max(0, Math.round(pct)))
  }, [numCurrent, numNext])

  if (loading && !data) {
    return (
      <div className="card card-pad mb-4 animate-pulse" style={{ height: '80px', borderRadius: '16px' }} />
    )
  }

  return (
    <>
      <section
        className={`card card-pad transition-all duration-300 relative overflow-hidden ${
          status === 'vencido'
            ? 'border-red-500 shadow-md ring-1 ring-red-500/30'
            : status === 'alerta'
            ? 'border-amber-500 ring-1 ring-amber-500/20'
            : ''
        }`}
        style={{
          marginBottom: '20px',
          background:
            status === 'vencido'
              ? 'var(--red-bg, rgba(239, 68, 68, 0.08))'
              : status === 'alerta'
              ? 'rgba(245, 158, 11, 0.08)'
              : 'var(--card-bg, rgba(255, 255, 255, 0.75))',
          borderColor:
            status === 'vencido'
              ? 'var(--red, #ef4444)'
              : status === 'alerta'
              ? '#f59e0b'
              : 'var(--line, rgba(0, 0, 0, 0.08))'
        }}
        aria-label="Controle diário do Horímetro do Gerador"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Lado Esquerdo: Identificação e Alerta */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                status === 'vencido'
                  ? 'bg-red-500/20 text-red-600 border-red-500/30 animate-pulse'
                  : status === 'alerta'
                  ? 'bg-amber-500/20 text-amber-600 border-amber-500/30'
                  : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
              }`}
            >
              {status === 'vencido' ? (
                <ShieldAlert size={26} className="text-red-600" />
              ) : (
                <Zap size={24} className="fill-current" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-base tracking-tight" style={{ color: 'var(--ink)' }}>
                  Gerador Sucena
                </span>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md font-bold uppercase bg-black/5 dark:bg-white/10 opacity-80">
                  TAG: {data?.plate_tag || 'E9A4808'}
                </span>
                {status === 'vencido' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-red-600 text-white animate-pulse">
                    🚨 MANUTENÇÃO VENCIDA ({Math.abs(remainingHours)}h)
                  </span>
                ) : status === 'alerta' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500 text-black">
                    ⚠️ REVISÃO PRÓXIMA (Faltam {remainingHours}h)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    ● Operação Normal
                  </span>
                )}
              </div>

              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                {status === 'vencido' ? (
                  <span className="font-bold text-red-600 dark:text-red-400">
                    Atenção: Horímetro de manutenção ultrapassado! Programar a parada técnica para revisão imediata.
                  </span>
                ) : status === 'alerta' ? (
                  <span className="font-semibold text-amber-700 dark:text-amber-300">
                    Faltam menos de 20 horas para a revisão do gerador. Alerta sincronizado no WhatsApp.
                  </span>
                ) : (
                  <span>
                    Próxima manutenção preventiva programada para {numNext}h ({remainingHours}h restantes).
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Lado Direito: Indicadores de Horas e Botão de Ação */}
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-black/5 dark:border-white/5">
            <div className="flex items-center gap-4 text-center md:text-right">
              {/* Horímetro Atual */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--muted)' }}>
                  Horímetro Atual
                </span>
                <span className="text-lg md:text-xl font-black tabular-nums tracking-tight" style={{ color: 'var(--ink)' }}>
                  {numCurrent} <small className="text-xs font-semibold opacity-70">h</small>
                </span>
              </div>

              {/* Divisor */}
              <div className="h-8 w-px bg-black/10 dark:bg-white/10" />

              {/* Horas Restantes */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--muted)' }}>
                  {remainingHours <= 0 ? 'Atraso' : 'Faltam'}
                </span>
                <span
                  className={`text-lg md:text-xl font-black tabular-nums tracking-tight ${
                    remainingHours <= 0
                      ? 'text-red-600 dark:text-red-400'
                      : remainingHours <= 20
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {remainingHours <= 0 ? `+${Math.abs(remainingHours)}` : remainingHours}{' '}
                  <small className="text-xs font-semibold opacity-70">h</small>
                </span>
              </div>
            </div>

            {/* Botão de Alterar Horímetro */}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all shadow-sm shrink-0 active:scale-95"
              style={{
                background:
                  status === 'vencido'
                    ? 'var(--red, #ef4444)'
                    : status === 'alerta'
                    ? '#f59e0b'
                    : 'var(--ink, #1c1d21)',
                color: status === 'alerta' ? '#000' : '#fff'
              }}
              title="Clique para lançar o horímetro atual ou agendar a próxima manutenção"
            >
              <Edit3 size={14} />
              <span>Alterar Horímetro</span>
            </button>
          </div>
        </div>

        {/* Barra de Progresso Rápida na Base do Banner */}
        <div className="mt-3 w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              status === 'vencido'
                ? 'bg-red-500'
                : status === 'alerta'
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </section>

      {/* Modal de Atualização do Horímetro */}
      <GeradorHorimetroModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={data}
        currentEnv={currentEnv}
        onSuccess={(updated) => setData(updated)}
      />
    </>
  )
}
