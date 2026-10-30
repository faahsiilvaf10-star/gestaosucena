import React, { useState, useEffect, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  MapPin,
  User,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  Camera,
  X,
} from 'lucide-react'

export interface DesvioItem {
  uid: string
  dataRegistro: string
  titulo: string
  categoria: string
  prioridade: string
  risco: string
  gravidade: string
  local: string
  area: string
  tecnico: string
  previsao: string
  sugestao: string
  respCorrecao: string
  statusFluxo: string
  foto?: string
  fotos?: string[]
  corrigido: boolean
}

function formatarDataBr(iso?: string): string {
  if (!iso) return '—'
  const parts = iso.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return iso
}

function calcularPrazoDias(dataIso?: string): {
  texto: string
  classe: string
  dias: number
} {
  if (!dataIso) {
    return { texto: 'Sem prazo', classe: 'bg-gray-100 text-gray-700 border-gray-200', dias: 0 }
  }
  const parts = dataIso.split('-').map(Number)
  if (parts.length < 3 || isNaN(parts[0])) {
    return { texto: dataIso, classe: 'bg-gray-100 text-gray-700 border-gray-200', dias: 0 }
  }

  const alvo = new Date(parts[0], parts[1] - 1, parts[2])
  alvo.setHours(0, 0, 0, 0)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const diffDias = Math.round((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDias < 0) {
    const abs = Math.abs(diffDias)
    return {
      texto: `🚨 Vencido há ${abs} dia${abs > 1 ? 's' : ''}`,
      classe: 'bg-red-100 text-red-800 border-red-300 font-black',
      dias: diffDias,
    }
  } else if (diffDias === 0) {
    return {
      texto: '⏳ Vence HOJE!',
      classe: 'bg-red-50 text-red-700 border-red-400 font-black',
      dias: 0,
    }
  } else if (diffDias === 1) {
    return {
      texto: '⏳ Vence amanhã!',
      classe: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
      dias: 1,
    }
  } else {
    return {
      texto: `Faltam ${diffDias} dias`,
      classe: 'bg-blue-100 text-blue-800 border-blue-300 font-bold',
      dias: diffDias,
    }
  }
}

export function DashboardDesviosWidget() {
  const [desvios, setDesvios] = useState<DesvioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fotoModal, setFotoModal] = useState<string | null>(null)

  const carregar = async () => {
    try {
      const env = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
      const storageKey = `desvios_seguranca_${env}`

      const { data } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', storageKey)
        .maybeSingle()

      if (data?.value) {
        const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value
        if (Array.isArray(parsed)) {
          setDesvios(parsed)
          return
        }
      }

      const local = localStorage.getItem(storageKey)
      if (local) {
        const parsed = JSON.parse(local)
        if (Array.isArray(parsed)) setDesvios(parsed)
      }
    } catch (err) {
      console.warn('[DashboardDesviosWidget] Erro ao carregar desvios:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()

    const sub = supabase
      .channel('dash_desvios_widget_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_settings' }, () => {
        carregar()
      })
      .subscribe()

    return () => {
      sub.unsubscribe()
    }
  }, [])

  // Desvios em aberto
  const desviosAbertos = useMemo(() => {
    return desvios
      .filter((d) => !d.corrigido && d.statusFluxo !== 'Corrigido' && d.statusFluxo !== 'Cancelado')
      .sort((a, b) => {
        const prazoA = a.previsao || '9999-99-99'
        const prazoB = b.previsao || '9999-99-99'
        return prazoA.localeCompare(prazoB)
      })
  }, [desvios])

  const totalAbertos = desviosAbertos.length
  const totalGeral = desvios.length
  const totalCorrigidos = desvios.filter((d) => d.corrigido || d.statusFluxo === 'Corrigido').length

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 animate-pulse" />
          <div className="h-5 bg-gray-200 rounded w-48 animate-pulse" />
        </div>
        <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between">
      {/* Cabeçalho do Widget */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white shadow-xs">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-950 tracking-tight flex items-center gap-2">
                Desvios de Segurança
                {totalAbertos > 0 ? (
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-red-100 text-red-800 border border-red-200">
                    {totalAbertos} {totalAbertos === 1 ? 'aberto' : 'abertos'}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Zerado
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-500 font-medium">Segurança do Trabalho & Prazos de Correção</p>
            </div>
          </div>

          <Link
            to="/seguranca/desvios"
            className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 hover:underline transition"
          >
            Ver todos <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Estado: Sem desvios em aberto */}
        {totalAbertos === 0 ? (
          <div className="text-center py-6 bg-emerald-50/50 rounded-xl border border-dashed border-emerald-200 my-2">
            <CheckCircle2 className="w-9 h-9 text-emerald-600 mx-auto mb-2 opacity-90" />
            <p className="text-xs font-bold text-emerald-950">Nenhum desvio em aberto no momento</p>
            <p className="text-[11px] text-emerald-800 mt-0.5">
              {totalCorrigidos > 0
                ? `${totalCorrigidos} ${totalCorrigidos === 1 ? 'desvio foi corrigido' : 'desvios foram corrigidos com sucesso'}.`
                : 'Excelente! O canteiro está operando em conformidade.'}
            </p>
            <Link
              to="/seguranca/desvios"
              className="inline-flex items-center gap-1 mt-3 px-3 py-1.5 text-xs font-bold bg-white text-emerald-900 border border-emerald-300 rounded-lg hover:bg-emerald-100 shadow-2xs transition"
            >
              Registrar novo desvio <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        ) : (
          /* Lista de desvios em aberto */
          <div className="space-y-3 mt-3">
            {desviosAbertos.slice(0, 3).map((desvio) => {
              const prazo = calcularPrazoDias(desvio.previsao)
              const fotosLista = Array.isArray(desvio.fotos) && desvio.fotos.length > 0 ? desvio.fotos : desvio.foto ? [desvio.foto] : []

              return (
                <div
                  key={desvio.uid}
                  className="p-3 rounded-xl border border-gray-200 bg-gray-50/60 hover:bg-gray-50 transition shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] border ${prazo.classe}`}>
                          {prazo.texto}
                        </span>

                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-gray-800 border border-gray-300">
                          {desvio.prioridade || 'Média'}
                        </span>

                        {desvio.categoria && (
                          <span className="text-[10px] font-semibold text-gray-500 uppercase">
                            {desvio.categoria}
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs font-black text-gray-950 truncate mb-1" title={desvio.titulo}>
                        {desvio.titulo}
                      </h4>

                      <div className="flex items-center gap-3 text-[11px] text-gray-600 flex-wrap font-medium">
                        {desvio.local && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            {desvio.local}
                          </span>
                        )}
                        {desvio.previsao && (
                          <span className="flex items-center gap-1 font-bold text-gray-900">
                            <Clock className="w-3 h-3 text-gray-400" />
                            Prazo: {formatarDataBr(desvio.previsao)}
                          </span>
                        )}
                        {desvio.respCorrecao && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-gray-400" />
                            Resp: <strong className="text-gray-900 truncate max-w-[140px]">{desvio.respCorrecao}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Foto antes thumbnail */}
                    {fotosLista.length > 0 && (
                      <div className="shrink-0 relative">
                        <img
                          src={fotosLista[0]}
                          alt="Desvio"
                          className="w-12 h-12 rounded-lg object-cover border border-gray-300 cursor-pointer hover:opacity-90 transition shadow-2xs"
                          onClick={() => setFotoModal(fotosLista[0])}
                          title="Clique para ampliar foto"
                        />
                        {fotosLista.length > 1 && (
                          <span className="absolute -top-1.5 -right-1.5 bg-black text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full shadow-xs">
                            +{fotosLista.length - 1}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {totalAbertos > 3 && (
              <p className="text-center text-[11px] font-bold text-gray-500 pt-1">
                + {totalAbertos - 3} outro(s) desvio(s) em aberto na lista completa
              </p>
            )}
          </div>
        )}
      </div>

      {/* Rodapé com atalho de ação */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
        <span className="text-gray-500 font-semibold">
          {totalAbertos > 0 ? (
            <span className="text-amber-700 font-bold">
              ⚠️ {totalAbertos} {totalAbertos === 1 ? 'desvio aguardando correção' : 'desvios aguardando correção'}
            </span>
          ) : (
            'Tudo regularizado'
          )}
        </span>
        <Link
          to="/seguranca/desvios"
          className="font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 hover:underline"
        >
          {totalAbertos > 0 ? 'Corrigir desvios' : 'Abrir desvios'} <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Modal para expansão de foto */}
      {fotoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setFotoModal(null)}
        >
          <div className="relative max-w-xl max-h-[90vh] bg-white rounded-2xl p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
              <span className="text-xs font-black text-gray-900 uppercase">Foto do Desvio</span>
              <button
                onClick={() => setFotoModal(null)}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition"
              >
                <X className="w-4 h-4 text-gray-700" />
              </button>
            </div>
            <img src={fotoModal} alt="Foto ampliada" className="max-w-full max-h-[75vh] object-contain rounded-xl mx-auto" />
          </div>
        </div>
      )}
    </div>
  )
}

