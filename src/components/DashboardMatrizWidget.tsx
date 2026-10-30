import React, { useState, useEffect, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import {
  CARGOS_MATRIZ,
  getMesKey,
  getMesLabel,
  getMetricasCargo,
  getMetricasGerais,
  carregarDadosMatriz,
  type AtividadeMatriz,
} from '../lib/matrizResponsabilidadesData'
import { verificarEEnviarLembreteMatrizMes } from '../lib/matrizWhatsapp'
import { CheckCircle2, Clock, ChevronRight, Grid3X3, ArrowRight } from 'lucide-react'

function normalizarCargoParaMatriz(cargoColab: string): string | null {
  const c = (cargoColab || '').toLowerCase().trim()
  if (c.includes('preposto')) return 'Preposto'
  if (c.includes('encarregado geral')) return 'Encarregado Geral'
  if (c.includes('encarregado i') || c.includes('encarregado 1') || c === 'encarregado') return 'Encarregado I'
  if (c.includes('encarregado ii') || c.includes('encarregado 2')) return 'Encarregado II'
  if (c.includes('tec') && c.includes('seg') && (c.includes('ii') || c.includes('2'))) return 'Téc. Segurança II'
  if (c.includes('tec') && c.includes('seg')) return 'Téc. Segurança I'
  return null
}

export function DashboardMatrizWidget() {
  const [mesKey] = useState<string>(() => getMesKey())
  const [atividadesPorCargo, setAtividadesPorCargo] = useState<Record<string, AtividadeMatriz[]>>({})
  const [nomesPorCargo, setNomesPorCargo] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState<boolean>(true)

  const env = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'

  useEffect(() => {
    let mounted = true

    async function carregar() {
      try {
        const [matrizDb, rhRes] = await Promise.all([
          carregarDadosMatriz(mesKey, env),
          supabase
            .from('rh_efetivo')
            .select('nome, cargo, status')
            .order('nome', { ascending: true }),
        ])

        if (!mounted) return

        setAtividadesPorCargo(matrizDb.atividadesPorCargo || {})

        // Mapa de nomes do RH
        const mapa: Record<string, string[]> = {}
        for (const c of CARGOS_MATRIZ) {
          mapa[c.nome] = []
        }

        if (rhRes.data && Array.isArray(rhRes.data)) {
          for (const item of rhRes.data) {
            const statusUpper = (item.status || '').toUpperCase().trim()
            if (statusUpper === 'INATIVO' || statusUpper === 'DEMITIDO' || statusUpper === 'DESLIGADO') continue
            if (!item.nome || !item.cargo) continue

            const cargoMatriz = normalizarCargoParaMatriz(item.cargo)
            if (cargoMatriz && mapa[cargoMatriz]) {
              if (!mapa[cargoMatriz].includes(item.nome.trim())) {
                mapa[cargoMatriz].push(item.nome.trim())
              }
            }
          }
        }

        // Se houver colaboradores adicionados na matriz
        if (matrizDb.customColaboradores) {
          for (const custom of matrizDb.customColaboradores) {
            if (mapa[custom.cargo] && !mapa[custom.cargo].includes(custom.nome)) {
              mapa[custom.cargo].push(custom.nome)
            }
          }
        }

        setNomesPorCargo(mapa)

        // Verificar lembrete do WhatsApp em segundo plano
        verificarEEnviarLembreteMatrizMes(false).catch(() => {})
      } catch (err) {
        console.warn('[Dashboard Matriz] Erro ao carregar dados:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    carregar()

    return () => {
      mounted = false
    }
  }, [mesKey, env])

  const metricas = useMemo(() => {
    return getMetricasGerais(atividadesPorCargo)
  }, [atividadesPorCargo])

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
      <div>
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white shadow-2xs font-bold text-base">
              <Grid3X3 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-gray-950 tracking-tight">
                  Matriz de Responsabilidades
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  {getMesLabel()}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Progresso mensal de preenchimento por cargo
              </p>
            </div>
          </div>

          <Link
            to="/seguranca/matriz-responsabilidade"
            className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 hover:underline transition"
          >
            Ver matriz <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Resumo Rápido: Concluídos vs Pendentes */}
        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
          <div className="bg-green-50 border border-green-200 rounded-lg p-2">
            <span className="text-[10px] font-black uppercase text-green-800 block">
              Concluídos
            </span>
            <b className="text-base font-black text-green-950">
              {metricas.cargosConcluidos}/{metricas.totalCargos}
            </b>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
            <span className="text-[10px] font-black uppercase text-amber-800 block">
              Pendentes
            </span>
            <b className="text-base font-black text-amber-950">
              {metricas.cargosPendentes}
            </b>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
            <span className="text-[10px] font-black uppercase text-gray-700 block">
              Geral
            </span>
            <b className="text-base font-black text-gray-950">
              {metricas.pctGeral}%
            </b>
          </div>
        </div>

        {/* Barra de Progresso Geral */}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3 border border-gray-200">
          <div
            className="h-full bg-green-600 rounded-full transition-all duration-500"
            style={{ width: `${metricas.pctGeral}%` }}
          />
        </div>

        {/* Lista dos 6 Cargos com Status */}
        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
          {CARGOS_MATRIZ.map((c) => {
            const ativs = atividadesPorCargo[c.id] || []
            const m = getMetricasCargo(c, ativs)
            const nomes = nomesPorCargo[c.nome] || []
            const isDone = m.isConcluidoTotal || m.porcentagem === 100

            return (
              <div
                key={c.id}
                className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 text-xs transition-colors ${
                  isDone
                    ? 'bg-green-50/70 border-green-200'
                    : m.porcentagem > 0
                    ? 'bg-amber-50/50 border-amber-200'
                    : 'bg-gray-50/70 border-gray-200'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-bold text-gray-900">
                    <span className="text-sm shrink-0">{c.icone}</span>
                    <span className="truncate">{c.nome}</span>
                  </div>
                  <div className="text-[11px] text-gray-600 font-medium truncate mt-0.5">
                    {nomes.length > 0 ? (
                      `👤 ${nomes.join(', ')}`
                    ) : (
                      <span className="italic text-gray-400">Sem colaborador</span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {isDone ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-green-800 bg-green-100 border border-green-300 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-green-700" /> 100% Concluído
                    </span>
                  ) : m.porcentagem > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3 text-amber-700" /> {m.porcentagem}% ({m.concluidas}/{m.totalAtividades})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-gray-100 border border-gray-300 px-2 py-0.5 rounded-full">
                      ⏳ Pendente
                    </span>
                  )}
                  <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1 ml-auto">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${m.porcentagem}%`,
                        background: c.cor,
                      }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Rodapé do Widget */}
      <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs">
        <span className="text-gray-500 font-semibold text-[11px]">
          Fim do mês zera automaticamente
        </span>
        <Link
          to="/seguranca/matriz-responsabilidade"
          className="font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 hover:underline"
        >
          Preencher atividades <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  )
}

