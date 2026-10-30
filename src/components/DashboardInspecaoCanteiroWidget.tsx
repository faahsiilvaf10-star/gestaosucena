import React, { useState, useEffect, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import { CheckCircle2, Clock, AlertTriangle, HardHat, Calendar, MapPin, User, ChevronRight, ExternalLink } from 'lucide-react'

export interface PontoInspecao {
  uid: string
  titulo: string
  obs: string
  cat: string
  prio: string
  foto?: string
  corrigido: boolean
  fotoCorrecao?: string
  obsCorrecao?: string
  dataCorrecao?: string
}

export interface InspecaoRegistro {
  data: string
  local: string
  responsavel: string
  turno: string
  area: string
  salvoEm: string
  itens: PontoInspecao[]
}

function formatarDataBr(iso?: string): string {
  if (!iso) return '—'
  const parts = iso.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return iso
}

function calcularPrazoDias(dataIso?: string): { texto: string; classe: string; dias: number } {
  if (!dataIso) return { texto: 'Sem data', classe: 'bg-gray-100 text-gray-700', dias: 0 }
  const [ano, mes, dia] = dataIso.split('-').map(Number)
  const alvo = new Date(ano, mes - 1, dia)
  alvo.setHours(0, 0, 0, 0)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const diffDias = Math.round((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDias === 0) {
    return { texto: '🚨 É HOJE!', classe: 'bg-red-100 text-red-800 border-red-300 font-bold', dias: 0 }
  } else if (diffDias === 1) {
    return { texto: '⏳ É amanhã!', classe: 'bg-amber-100 text-amber-800 border-amber-300 font-bold', dias: 1 }
  } else if (diffDias > 1) {
    return { texto: `Faltam ${diffDias} dias`, classe: 'bg-blue-100 text-blue-800 border-blue-300', dias: diffDias }
  } else {
    return { texto: `Venceu há ${Math.abs(diffDias)} dia(s)`, classe: 'bg-rose-100 text-rose-800 border-rose-300', dias: diffDias }
  }
}

export function DashboardInspecaoCanteiroWidget() {
  const [inspecoes, setInspecoes] = useState<InspecaoRegistro[]>([])
  const [loading, setLoading] = useState(true)
  const [fotoModal, setFotoModal] = useState<string | null>(null)

  const carregar = async () => {
    try {
      const env = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
      const { data } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', `canteiro_inspecoes_${env}`)
        .maybeSingle()

      if (data?.value) {
        const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value
        if (Array.isArray(parsed)) {
          setInspecoes(parsed)
        }
      } else {
        setInspecoes([])
      }
    } catch (err) {
      console.warn('[DashboardInspecaoCanteiro] Erro ao carregar inspeções:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()

    const sub = supabase
      .channel('dash_canteiro_inspecoes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_settings' }, () => {
        carregar()
      })
      .subscribe()

    return () => {
      sub.unsubscribe()
    }
  }, [])

  // Última inspeção registrada / ativa
  const inspecaoAtiva = useMemo(() => {
    if (!inspecoes.length) return null
    return inspecoes[0]
  }, [inspecoes])

  const totalPontos = inspecaoAtiva?.itens?.length || 0
  const itensCorrigidos = useMemo(() => {
    return inspecaoAtiva?.itens?.filter((i) => i.corrigido) || []
  }, [inspecaoAtiva])

  const itensPendentes = useMemo(() => {
    return inspecaoAtiva?.itens?.filter((i) => !i.corrigido) || []
  }, [inspecaoAtiva])

  const percentual = totalPontos > 0 ? Math.round((itensCorrigidos.length / totalPontos) * 100) : 0
  const prazoInfo = inspecaoAtiva ? calcularPrazoDias(inspecaoAtiva.data) : null

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <HardHat className="w-5 h-5 text-amber-500 animate-pulse" />
          <div className="h-5 bg-gray-200 rounded w-48 animate-pulse" />
        </div>
        <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    )
  }

  if (!inspecaoAtiva) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white shadow-sm">
              <HardHat className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-gray-900 tracking-tight">Inspeção de Canteiro</h3>
              <p className="text-xs text-gray-500">Segurança do Trabalho</p>
            </div>
          </div>
          <Link
            to="/seguranca/inspecao-canteiro"
            className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 hover:underline"
          >
            Agendar <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="text-center py-5 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <p className="text-xs text-gray-600 font-medium">Nenhuma inspeção de canteiro agendada no momento.</p>
          <Link
            to="/seguranca/inspecao-canteiro"
            className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-md transition shadow-xs"
          >
            + Registrar Nova Inspeção
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header do Card */}
      <div className="p-4 sm:p-5 border-b border-gray-100 bg-gradient-to-r from-amber-50/60 to-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <HardHat className="w-5 h-5 text-gray-950" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wide">
                  Inspeção de Canteiro
                </h3>
                {prazoInfo && (
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${prazoInfo.classe}`}>
                    {prazoInfo.texto}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 font-medium mt-0.5">
                Data marcada: <strong className="text-gray-900">{formatarDataBr(inspecaoAtiva.data)}</strong>
              </p>
            </div>
          </div>

          <Link
            to="/seguranca/inspecao-canteiro"
            className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-900 bg-amber-100/70 hover:bg-amber-200/70 px-2.5 py-1.5 rounded-md transition"
          >
            Abrir <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {/* Metadados rápidos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-amber-200/50 text-xs">
          <div className="flex items-center gap-1.5 text-gray-700">
            <MapPin className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span className="truncate"><strong>Local:</strong> {inspecaoAtiva.local || 'Canteiro'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-700">
            <User className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span className="truncate"><strong>Inspetor:</strong> {inspecaoAtiva.responsavel || '—'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-700">
            <Clock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span className="truncate"><strong>Turno:</strong> {inspecaoAtiva.turno || 'Manhã'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-700">
            <Calendar className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span className="truncate"><strong>Área:</strong> {inspecaoAtiva.area || 'Geral'}</span>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="mt-3.5">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-bold text-gray-800">
              Status das Correções: {itensCorrigidos.length} de {totalPontos} concluídos ({percentual}%)
            </span>
            <span className={`text-[11px] font-bold ${percentual === 100 ? 'text-green-700' : 'text-amber-700'}`}>
              {itensPendentes.length} pendente(s)
            </span>
          </div>
          <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                percentual === 100
                  ? 'bg-green-600'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600'
              }`}
              style={{ width: `${percentual}%` }}
            />
          </div>
        </div>
      </div>

      {/* Lista de Itens Concluídos e Pendentes */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col gap-3">
        {/* Seção Itens Concluídos / Corrigidos */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-black text-gray-900 uppercase tracking-wide flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              Itens Concluídos / Corrigidos ({itensCorrigidos.length})
            </h4>
            {itensCorrigidos.length > 0 && (
              <span className="text-[11px] font-semibold text-green-800 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                Regularizados
              </span>
            )}
          </div>

          {itensCorrigidos.length === 0 ? (
            <div className="p-3 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-center">
              <p className="text-xs text-gray-500">Nenhum item corrigido ainda nesta inspeção.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {itensCorrigidos.map((item) => (
                <div
                  key={item.uid}
                  className="p-2.5 rounded-lg border border-green-200 bg-green-50/40 text-xs flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-gray-900 truncate">{item.titulo}</span>
                      <span className="text-[10px] bg-white text-gray-700 px-1.5 py-0.5 rounded border border-gray-200 font-semibold">
                        {item.cat}
                      </span>
                    </div>

                    {item.obsCorrecao && (
                      <p className="text-gray-700 mt-1 text-[11.5px] line-clamp-2">
                        <strong className="text-green-800">Correção:</strong> {item.obsCorrecao}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-1 text-[10.5px] text-gray-500">
                      {item.dataCorrecao && <span>🕒 {item.dataCorrecao}</span>}
                    </div>
                  </div>

                  {item.fotoCorrecao && (
                    <button
                      type="button"
                      onClick={() => setFotoModal(item.fotoCorrecao || null)}
                      className="flex-shrink-0 relative group rounded overflow-hidden border border-green-300 w-11 h-11 bg-white cursor-pointer"
                      title="Clique para ver foto da correção"
                    >
                      <img
                        src={item.fotoCorrecao}
                        alt="Foto da correção"
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resumo de Pendências */}
        {itensPendentes.length > 0 && (
          <div className="pt-2 border-t border-gray-100">
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Aguardando Correção ({itensPendentes.length})
            </h4>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {itensPendentes.map((item) => (
                <div
                  key={item.uid}
                  className="px-2.5 py-1.5 rounded-md border border-amber-200 bg-amber-50/50 text-xs flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                    <span className="font-semibold text-gray-800 truncate">{item.titulo}</span>
                    <span className="text-[10px] text-gray-500">({item.cat})</span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-800 uppercase px-1.5 py-0.5 bg-white rounded border border-amber-200 flex-shrink-0">
                    {item.prio}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal para expansão de foto */}
      {fotoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setFotoModal(null)}
        >
          <div className="relative max-w-xl max-h-[90vh] bg-white rounded-xl p-2 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <img src={fotoModal} alt="Foto ampliada" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
            <button
              onClick={() => setFotoModal(null)}
              className="mt-2 w-full py-2 bg-gray-900 text-white font-bold text-xs rounded-lg hover:bg-black transition"
            >
              Fechar Foto
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
