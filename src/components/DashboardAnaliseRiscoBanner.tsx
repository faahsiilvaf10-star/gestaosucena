import React, { useState, useEffect, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import {
  type AnaliseRiscoItem,
  carregarAnalisesRisco,
  salvarAnalisesRisco,
  diasAteValidade,
  fmtValidade,
} from '../lib/analiseRiscoData'
import { isAdmin } from './ui/VerifiedBadge'
import { ShieldAlert, AlertTriangle, ArrowRight, CheckCircle2, Lock } from 'lucide-react'
import { toast } from 'sonner'

export function DashboardAnaliseRiscoBanner() {
  const [analises, setAnalises] = useState<AnaliseRiscoItem[]>([])
  const [fechandoId, setFechandoId] = useState<string | null>(null)

  const currentUserName =
    typeof window !== 'undefined' ? localStorage.getItem('sucena_user_name') || '' : ''
  const currentUserRole =
    typeof window !== 'undefined' ? localStorage.getItem('sucena_user_role') || '' : ''

  const isTecnicoSeguranca = useMemo(() => {
    const roleLower = currentUserRole.toLowerCase()
    return (
      isAdmin(currentUserName, currentUserRole) ||
      roleLower.includes('seguran') ||
      roleLower.includes('tst') ||
      roleLower.includes('técnico') ||
      roleLower.includes('tecnico')
    )
  }, [currentUserName, currentUserRole])

  const carregar = async () => {
    try {
      const env =
        typeof window !== 'undefined'
          ? localStorage.getItem('sucena_environment') || 'barcarena'
          : 'barcarena'
      const lista = await carregarAnalisesRisco(env)
      setAnalises(lista)
    } catch (err) {
      console.warn('[DashboardAnaliseRiscoBanner] Erro ao carregar análises:', err)
    }
  }

  useEffect(() => {
    carregar()

    const sub = supabase
      .channel('dash_analise_risco_banner')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_settings' }, () => {
        carregar()
      })
      .subscribe()

    return () => {
      sub.unsubscribe()
    }
  }, [])

  // Análises em aberto que estão vencidas ou vencem em até 5 dias
  const analisesCriticas = useMemo(() => {
    return analises.filter((a) => {
      if (a.status !== 'Em aberto' || !a.validaAte) return false
      const dias = diasAteValidade(a.validaAte)
      return dias !== null && dias <= 5
    })
  }, [analises])

  if (analisesCriticas.length === 0) {
    return null
  }

  const handleFecharAnalise = async (item: AnaliseRiscoItem) => {
    if (!isTecnicoSeguranca) {
      toast.error('Apenas o cargo de Técnico de Segurança pode fechar uma Análise de Risco.')
      return
    }

    if (
      !window.confirm(
        `Deseja fechar a Análise de Risco "${item.titulo}"?\n\nEsta ação indicará que uma nova análise de risco já foi elaborada e substituiu esta.`
      )
    ) {
      return
    }

    setFechandoId(item.id)
    try {
      const env =
        typeof window !== 'undefined'
          ? localStorage.getItem('sucena_environment') || 'barcarena'
          : 'barcarena'

      const agora = new Date()
      const quando = `${String(agora.getDate()).padStart(2, '0')}/${String(
        agora.getMonth() + 1
      ).padStart(2, '0')}/${agora.getFullYear()} às ${String(agora.getHours()).padStart(
        2,
        '0'
      )}:${String(agora.getMinutes()).padStart(2, '0')}`

      const listaAtualizada = analises.map((a) => {
        if (a.id === item.id) {
          return {
            ...a,
            status: 'Fechada' as const,
            fechadaEm: quando,
            fechadaPor: currentUserName || 'Técnico de Segurança',
            fechadaObs: 'Fechada para substituição por nova análise',
          }
        }
        return a
      })

      await salvarAnalisesRisco(listaAtualizada, env)
      setAnalises(listaAtualizada)
      toast.success(`Análise de Risco "${item.titulo}" fechada com sucesso!`)
    } catch (e) {
      toast.error('Erro ao fechar análise de risco.')
    } finally {
      setFechandoId(null)
    }
  }

  return (
    <div className="flex flex-col gap-3 mb-4">
      {analisesCriticas.map((item) => {
        const dias = diasAteValidade(item.validaAte)
        const vencida = dias !== null && dias < 0
        const venceHoje = dias === 0
        const faltamDias = dias !== null && dias > 0

        return (
          <div
            key={item.id}
            className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all shadow-sm ${
              vencida
                ? 'bg-gradient-to-r from-red-50 via-rose-50 to-red-100/50 border-red-300 dark:bg-red-950/20 dark:border-red-900/40 text-red-950 dark:text-red-100'
                : venceHoje
                ? 'bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100/60 border-amber-300 dark:bg-amber-950/20 dark:border-amber-900/40 text-amber-950 dark:text-amber-100'
                : 'bg-gradient-to-r from-yellow-50 via-amber-50 to-yellow-100/50 border-yellow-300 dark:bg-yellow-950/20 dark:border-yellow-900/40 text-yellow-950 dark:text-yellow-100'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div
                  className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                    vencida
                      ? 'bg-red-500 text-white'
                      : venceHoje
                      ? 'bg-amber-500 text-white'
                      : 'bg-yellow-500 text-black'
                  }`}
                >
                  <ShieldAlert className="w-6 h-6" />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider ${
                        vencida
                          ? 'bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-200'
                          : venceHoje
                          ? 'bg-orange-200 text-orange-950 dark:bg-orange-900/60 dark:text-orange-200'
                          : 'bg-yellow-200 text-yellow-950 dark:bg-yellow-900/60 dark:text-yellow-200'
                      }`}
                    >
                      {vencida
                        ? `🔴 VALIDADE VENCIDA (${Math.abs(dias!)}d atrás)`
                        : venceHoje
                        ? '🚨 VENCE HOJE!'
                        : dias === 1
                        ? '⏳ VENCE AMANHÃ!'
                        : `⏳ FALTAM ${dias} DIAS PARA VENCER`}
                    </span>
                    <span className="text-xs font-bold opacity-75">
                      Válida até: <b>{fmtValidade(item.validaAte)}</b>
                    </span>
                  </div>

                  <h3 className="font-extrabold text-base sm:text-lg leading-tight text-gray-900 dark:text-white">
                    Análise de Risco: {item.titulo}
                  </h3>

                  {item.atividadeLocal && (
                    <p className="text-xs sm:text-sm font-semibold opacity-85 mt-0.5">
                      📍 Atividade / Local: {item.atividadeLocal}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                {isTecnicoSeguranca ? (
                  <button
                    type="button"
                    onClick={() => handleFecharAnalise(item)}
                    disabled={fechandoId === item.id}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition active:scale-95 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {fechandoId === item.id ? 'Fechando...' : 'Fechar Análise (Outra feita)'}
                  </button>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-black/5 dark:bg-white/5 opacity-75"
                    title="Apenas o Técnico de Segurança pode fechar a análise"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Fechamento restrito ao TST
                  </span>
                )}

                <Link
                  to="/seguranca/analise-risco"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 shadow-sm transition"
                >
                  Abrir Análise
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
export default DashboardAnaliseRiscoBanner
