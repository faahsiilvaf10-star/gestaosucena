import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Link } from '@tanstack/react-router'
import {
  ShieldCheck,
  Trophy,
  Target,
  Award,
  Sparkles,
  Calendar,
  Settings,
  ExternalLink,
  CheckCircle2,
  X,
  Flame,
  ArrowRight,
} from 'lucide-react'
import {
  type PlacarSegurancaConfig,
  calcularDiasSemAcidente,
  calcularProgressoMeta,
  obterFeitoSeguranca,
  carregarPlacarSeguranca,
  salvarPlacarSeguranca,
  getDbKeyPlacarSeguranca,
} from '../lib/diasSemAcidentesData'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

interface DashboardPlacarSegurancaProps {
  currentEnv?: string
  modoCompacto?: boolean
}

export function DashboardPlacarSeguranca({
  currentEnv = 'barcarena',
  modoCompacto = false,
}: DashboardPlacarSegurancaProps) {
  const [config, setConfig] = useState<PlacarSegurancaConfig | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // Campos do modal de ajuste
  const [dataAfastamento, setDataAfastamento] = useState('')
  const [dataSemAfastamento, setDataSemAfastamento] = useState('')
  const [metaDias, setMetaDias] = useState('365')
  const [recordeDias, setRecordeDias] = useState('420')
  const [observacao, setObservacao] = useState('')

  // Trava scroll de fundo e escuta ESC enquanto modal de ajuste estiver aberto
  useEffect(() => {
    if (!modalAberto) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalAberto(false)
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [modalAberto])

  // Carregar dados iniciais e escutar realtime
  useEffect(() => {
    let isMounted = true

    const inicializar = async () => {
      try {
        setCarregando(true)
        const dados = await carregarPlacarSeguranca(currentEnv)
        if (isMounted) {
          setConfig(dados)
          setDataAfastamento(dados.dataUltimoAcidenteComAfastamento)
          setDataSemAfastamento(dados.dataUltimoAcidenteSemAfastamento || '')
          setMetaDias(String(dados.metaDias || 365))
          setRecordeDias(String(dados.recordeHistoricoDias || 365))
          setObservacao(dados.observacao || '')
        }
      } catch (err) {
        console.warn('[PlacarSeguranca] Falha ao carregar:', err)
      } finally {
        if (isMounted) {
          setCarregando(false)
        }
      }
    }

    inicializar()

    // Realtime do Supabase
    const dbKey = getDbKeyPlacarSeguranca(currentEnv)
    const channel = supabase
      .channel(`placar-seguranca-${currentEnv}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'global_settings',
          filter: `key=eq.${dbKey}`,
        },
        (payload: any) => {
          if (payload.new && payload.new.value && typeof payload.new.value === 'object') {
            setConfig(payload.new.value as PlacarSegurancaConfig)
          }
        }
      )
      .subscribe()

    const handleCustomUpdate = (e: any) => {
      if (e.detail && typeof e.detail === 'object') {
        setConfig(e.detail)
      }
    }
    window.addEventListener('sucena_placar_seguranca_updated', handleCustomUpdate)

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
      window.removeEventListener('sucena_placar_seguranca_updated', handleCustomUpdate)
    }
  }, [currentEnv])

  // Cálculos dinâmicos por dia
  const diasComAfastamento = useMemo(() => {
    return calcularDiasSemAcidente(config?.dataUltimoAcidenteComAfastamento)
  }, [config?.dataUltimoAcidenteComAfastamento])

  const diasSemAfastamento = useMemo(() => {
    return calcularDiasSemAcidente(config?.dataUltimoAcidenteSemAfastamento)
  }, [config?.dataUltimoAcidenteSemAfastamento])

  const metaNum = config?.metaDias || 365
  const recordeNum = config?.recordeHistoricoDias || 365

  const progresso = useMemo(() => {
    return calcularProgressoMeta(diasComAfastamento, metaNum)
  }, [diasComAfastamento, metaNum])

  const feito = useMemo(() => {
    return obterFeitoSeguranca(diasComAfastamento, metaNum, recordeNum)
  }, [diasComAfastamento, metaNum, recordeNum])

  // Salvar ajustes
  const handleSalvarAjustes = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dataAfastamento) {
      toast.error('Informe a data base do último acidente com afastamento.')
      return
    }

    try {
      setSalvando(true)
      const novaConfig: PlacarSegurancaConfig = {
        dataUltimoAcidenteComAfastamento: dataAfastamento,
        dataUltimoAcidenteSemAfastamento: dataSemAfastamento || undefined,
        metaDias: Number(metaDias) || 365,
        recordeHistoricoDias: Number(recordeDias) || 365,
        observacao: observacao.trim() || undefined,
        atualizadoEm: new Date().toISOString(),
      }

      setConfig(novaConfig)
      const ok = await salvarPlacarSeguranca(novaConfig, currentEnv)
      if (ok) {
        toast.success('Placar de segurança e metas atualizados com sucesso!')
      } else {
        toast.info('Placar salvo localmente neste navegador.')
      }
      setModalAberto(false)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar configurações do placar.')
    } finally {
      setSalvando(false)
    }
  }

  // Skeleton screen
  if (carregando && !config) {
    return (
      <div className="w-full bg-white/70 dark:bg-[#1A1A1E]/70 backdrop-blur-md rounded-2xl p-5 border border-amber-200/50 shadow-sm animate-pulse mb-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-40 h-28 bg-gray-200 dark:bg-white/10 rounded-xl" />
          <div className="flex-1 space-y-3 w-full">
            <div className="h-6 w-48 bg-gray-200 dark:bg-white/10 rounded-md" />
            <div className="h-4 w-72 bg-gray-200 dark:bg-white/10 rounded-md" />
            <div className="h-3 w-full bg-gray-200 dark:bg-white/10 rounded-full" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <section
        className={`relative overflow-hidden rounded-2xl md:rounded-3xl border border-amber-300/80 dark:border-amber-500/30 bg-gradient-to-br from-amber-50/90 via-white to-amber-100/40 dark:from-[#1E1C16] dark:via-[#161618] dark:to-[#1E1C16] shadow-md hover:shadow-lg transition-all duration-300 p-4 md:p-6 mb-6 ${
          modoCompacto ? 'my-3' : 'my-5'
        }`}
        aria-label="Placar de Segurança — Dias sem acidentes"
      >
        {/* Fundo decorativo sutil */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-44 h-44 rounded-full bg-amber-400/10 dark:bg-amber-400/5 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-36 h-36 rounded-full bg-emerald-400/10 dark:bg-emerald-400/5 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
          
          {/* LADO ESQUERDO: THUMBNAIL / PLACAR EM DESTAQUE */}
          <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-4 shrink-0">
            {/* Display do Placar em Estilo Thumbnail Industrial */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#111827] to-[#0A0D14] text-white p-4 md:p-5 flex flex-col justify-between shadow-lg border border-amber-500/40 min-w-[240px] sm:w-[270px] text-center group">
              {/* Luz do Placar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-emerald-400 to-amber-400 animate-pulse" />
              
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[10px] uppercase font-black tracking-widest text-amber-400/90 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Placar da Obra
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Ao Vivo
                </span>
              </div>

              {/* Título do Placar */}
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                Estamos trabalhando há
              </span>

              {/* Número de Dias com Tipografia Gigante de Impacto */}
              <div className="my-1.5 flex items-baseline justify-center gap-2">
                <span className="text-5xl sm:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-amber-100 font-mono drop-shadow-[0_2px_10px_rgba(245,197,24,0.3)]">
                  {diasComAfastamento}
                </span>
                <span className="text-base sm:text-lg font-black text-amber-400 uppercase">
                  {diasComAfastamento === 1 ? 'Dia' : 'Dias'}
                </span>
              </div>

              {/* Legenda Oficial */}
              <div className="text-[11px] font-extrabold uppercase tracking-wide text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 py-1 px-2 rounded-lg mb-2">
                Sem Acidentes com Afastamento
              </div>

              {/* Sub-informação de Acidentes sem Afastamento */}
              {diasSemAfastamento > 0 && (
                <div className="text-[10px] text-gray-300 flex items-center justify-center gap-1 font-medium pt-1 border-t border-white/10">
                  <span>Sem afastamento:</span>
                  <b className="text-amber-300">{diasSemAfastamento} dias</b>
                </div>
              )}
            </div>
          </div>

          {/* CENTRO E LADO DIREITO: O FEITO E A META */}
          <div className="flex-1 flex flex-col justify-between space-y-3.5">
            {/* Header do Feito / Conquista */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-2xl" role="img" aria-label={feito.titulo}>
                  {feito.icone}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${feito.badgeBg} ${feito.badgeTexto} border-amber-300 dark:border-amber-700`}>
                      {feito.titulo}
                    </span>
                    {progresso.metaBatida && (
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        Meta Batida!
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-gray-950 dark:text-white mt-0.5">
                    {feito.subtitulo}
                  </h3>
                </div>
              </div>

              {/* Botão de Ajuste Rápido */}
              <button
                type="button"
                onClick={() => setModalAberto(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white bg-white/80 dark:bg-white/5 hover:bg-amber-100 dark:hover:bg-amber-950/50 border border-gray-300/80 dark:border-white/10 px-3 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer"
                title="Configurar data do último acidente ou meta de dias"
              >
                <Settings className="w-3.5 h-3.5 text-amber-600" />
                <span>Ajustar Placar</span>
              </button>
            </div>

            {/* BARRA DE PROGRESSO DA META */}
            <div className="bg-white/80 dark:bg-white/5 border border-amber-200/80 dark:border-white/10 rounded-2xl p-3.5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-amber-600" />
                  Meta da Operação: <b className="text-amber-700 dark:text-amber-400 font-extrabold">{metaNum} Dias</b>
                </span>
                <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">
                  {progresso.porcentagem}% Concluído
                </span>
              </div>

              {/* Barra Animada */}
              <div className="w-full h-3.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden p-0.5 border border-amber-300/50 dark:border-amber-600/30">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 via-emerald-400 to-emerald-500 transition-all duration-1000 relative shadow-sm"
                  style={{ width: `${Math.max(4, progresso.porcentagem)}%` }}
                >
                  <span className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400 mt-2">
                <span>
                  {progresso.metaBatida ? (
                    <b className="text-emerald-600 dark:text-emerald-400">
                      🎉 Parabéns! Meta de {metaNum} dias alcançada com sucesso!
                    </b>
                  ) : (
                    <>
                      Faltam apenas <b className="text-amber-600 dark:text-amber-400">{progresso.diasRestantes} dias</b> para atingir a meta.
                    </>
                  )}
                </span>
                <span className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  Recorde da Obra: <b>{recordeNum} dias</b>
                </span>
              </div>
            </div>

            {/* Footer do Card com Links Diretos */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
              <span className="text-gray-500 dark:text-gray-400 text-[11px] font-medium flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                Contagem contínua atualizada automaticamente dia a dia.
              </span>

              <Link
                to="/seguranca/indicadores"
                className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 hover:underline"
              >
                <span>Ver todos os Indicadores de Segurança</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

          </div>

        </div>
      </section>

      {/* MODAL DE AJUSTE DO PLACAR E METAS VIA PORTAL */}
      {modalAberto && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[999999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setModalAberto(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white dark:bg-[#1A1A1E] border border-amber-300/80 dark:border-white/10 rounded-3xl w-full max-w-lg p-6 sm:p-7 shadow-2xl space-y-4 text-gray-900 dark:text-white my-auto max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-700">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">Ajustar Placar de Segurança e Meta</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Defina a data inicial do marco e as metas comemorativas da obra
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarAjustes} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block mb-1 text-gray-700 dark:text-gray-300">
                  Data do último acidente com afastamento *
                </label>
                <input
                  type="date"
                  required
                  value={dataAfastamento}
                  onChange={(e) => setDataAfastamento(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-white/20 bg-white dark:bg-white/5 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-1">
                  Os dias serão calculados automaticamente a partir desta data até hoje.
                </span>
              </div>

              <div>
                <label className="block mb-1 text-gray-700 dark:text-gray-300">
                  Data do último acidente sem afastamento (opcional)
                </label>
                <input
                  type="date"
                  value={dataSemAfastamento}
                  onChange={(e) => setDataSemAfastamento(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-white/20 bg-white dark:bg-white/5 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-gray-700 dark:text-gray-300">
                    Meta de Dias sem Acidente
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={metaDias}
                    onChange={(e) => setMetaDias(e.target.value)}
                    placeholder="Ex.: 365"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-white/20 bg-white dark:bg-white/5 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-gray-700 dark:text-gray-300">
                    Recorde Histórico da Obra (dias)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={recordeDias}
                    onChange={(e) => setRecordeDias(e.target.value)}
                    placeholder="Ex.: 420"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-white/20 bg-white dark:bg-white/5 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-gray-700 dark:text-gray-300">
                  Mensagem / Observação da Liderança
                </label>
                <input
                  type="text"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex.: Foco contínuo em zero acidentes na frente de serviço."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-white/20 bg-white dark:bg-white/5 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-gray-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-[#F5C518] hover:bg-[#E5B508] text-black shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{salvando ? 'Salvando...' : 'Salvar Placar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

