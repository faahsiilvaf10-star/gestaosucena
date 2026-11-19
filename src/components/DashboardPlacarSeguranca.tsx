import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Settings, X, Download, CheckCircle2 } from 'lucide-react'
import {
  type PlacarSegurancaConfig,
  CONFIG_PADRAO_PLACAR,
  calcularDiasSemAcidente,
  carregarPlacarSeguranca,
  salvarPlacarSeguranca,
  getDbKeyPlacarSeguranca,
  formatarDataBr,
  normalizarDataIso,
} from '../lib/diasSemAcidentesData'
import { supabase } from '../lib/supabase'
import { canManageSafetyBanner } from '../lib/safetyBanners'
import { isAdmin } from './ui/VerifiedBadge'
import { toast } from 'sonner'
import '../placar-seguranca.css'

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
  const [canEdit, setCanEdit] = useState(true) // Padrão seguro, checado no auth

  // Campos de edição do modal
  const [editDias, setEditDias] = useState<number>(290)
  const [editNoLeave, setEditNoLeave] = useState<number>(90)
  const [editGoal, setEditGoal] = useState<number>(365)
  const [editRecord, setEditRecord] = useState<number>(365)
  const [editStart, setEditStart] = useState<string>('2026-07-20')
  const [editProject, setEditProject] = useState<string>('PLACAR DA OBRA')
  const [editMessage, setEditMessage] = useState<string>('NOSSO MAIOR VALOR É A VIDA')

  // Verificar permissões do usuário
  useEffect(() => {
    let active = true
    const verificarPermissao = async () => {
      try {
        const { data } = await supabase.auth.getUser()
        const user = data?.user
        const role =
          user?.user_metadata?.role ||
          (typeof window !== 'undefined' ? localStorage.getItem('sucena_user_role') : '') ||
          ''
        const name =
          user?.user_metadata?.full_name ||
          (typeof window !== 'undefined' ? localStorage.getItem('sucena_user_name') : '') ||
          ''

        const autorizado = canManageSafetyBanner(role, name) || isAdmin(name, role)
        if (active) setCanEdit(autorizado)
      } catch {
        const role = typeof window !== 'undefined' ? localStorage.getItem('sucena_user_role') || '' : ''
        const name = typeof window !== 'undefined' ? localStorage.getItem('sucena_user_name') || '' : ''
        if (active) setCanEdit(canManageSafetyBanner(role, name) || isAdmin(name, role))
      }
    }
    verificarPermissao()
    return () => {
      active = false
    }
  }, [])

  // Trava scroll de fundo e escuta ESC enquanto modal estiver aberto
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

  // Sincronizar dados do Supabase e escutar Realtime
  useEffect(() => {
    let isMounted = true

    const inicializar = async () => {
      try {
        setCarregando(true)
        const dados = await carregarPlacarSeguranca(currentEnv)
        if (isMounted) {
          setConfig(dados)
          sincronizarCamposEdicao(dados)
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

    // Supabase Realtime
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
          if (payload.new?.value && typeof payload.new.value === 'object') {
            const novaConfig = payload.new.value as PlacarSegurancaConfig
            setConfig(novaConfig)
            sincronizarCamposEdicao(novaConfig)
          }
        }
      )
      .subscribe()

    // Evento Customizado Local
    const handleCustomUpdate = (e: any) => {
      if (e.detail && typeof e.detail === 'object' && (!e.detail.env || e.detail.env === currentEnv)) {
        setConfig(e.detail)
        sincronizarCamposEdicao(e.detail)
      }
    }
    window.addEventListener('sucena_placar_seguranca_updated', handleCustomUpdate)

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
      window.removeEventListener('sucena_placar_seguranca_updated', handleCustomUpdate)
    }
  }, [currentEnv])

  const sincronizarCamposEdicao = (d: PlacarSegurancaConfig) => {
    const dataInicioIso = normalizarDataIso(d.dataUltimoAcidenteComAfastamento) || '2026-07-20'
    const diasCalc =
      d.diasSemAcidentesComAfastamento != null
        ? d.diasSemAcidentesComAfastamento
        : calcularDiasSemAcidente(dataInicioIso)

    setEditDias(diasCalc)
    setEditNoLeave(
      d.diasSemAfastamento != null
        ? d.diasSemAfastamento
        : d.dataUltimoAcidenteSemAfastamento
          ? calcularDiasSemAcidente(d.dataUltimoAcidenteSemAfastamento)
          : 90
    )
    setEditGoal(d.metaDias || 365)
    setEditRecord(d.recordeHistoricoDias || 365)
    setEditStart(dataInicioIso)
    setEditProject(d.nomeObra || 'PLACAR DA OBRA')
    setEditMessage(d.fraseDestaque || 'NOSSO MAIOR VALOR É A VIDA')
  }

  // Cálculos do placar
  const dadosAtuais = useMemo(() => {
    const dataInicioIso = normalizarDataIso(config?.dataUltimoAcidenteComAfastamento) || '2026-07-20'
    const dias = Math.max(
      0,
      config?.diasSemAcidentesComAfastamento != null
        ? Number(config.diasSemAcidentesComAfastamento)
        : calcularDiasSemAcidente(dataInicioIso)
    )

    const diasSemAfastamento = Math.max(
      0,
      config?.diasSemAfastamento != null
        ? Number(config.diasSemAfastamento)
        : config?.dataUltimoAcidenteSemAfastamento
          ? calcularDiasSemAcidente(config.dataUltimoAcidenteSemAfastamento)
          : 90
    )

    const meta = Math.max(1, Number(config?.metaDias) || 365)
    const recorde = Math.max(0, Number(config?.recordeHistoricoDias) || 365)
    const faltam = Math.max(0, meta - dias)
    const percentualBruto = (dias / meta) * 100
    const percentualExibicao = Math.min(100, Math.max(0, percentualBruto))

    // Formatação de hora salva
    let horaSalva = '21:08'
    if (config?.atualizadoEm) {
      try {
        const dateObj = new Date(config.atualizadoEm)
        horaSalva = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      } catch {
        horaSalva = '21:08'
      }
    }

    return {
      dias,
      diasSemAfastamento,
      meta,
      recorde,
      faltam,
      percentualExibicao,
      dataInicioBr: formatarDataBr(dataInicioIso),
      nomeObra: (config?.nomeObra || 'PLACAR DA OBRA').toUpperCase(),
      fraseDestaque: (config?.fraseDestaque || 'NOSSO MAIOR VALOR É A VIDA').toUpperCase(),
      horaSalva,
    }
  }, [config])

  // Abrir modal e sincronizar inputs com o estado atual
  const abrirModalAjuste = () => {
    if (config) {
      sincronizarCamposEdicao(config)
    }
    setModalAberto(true)
  }

  // Alterar data de início recalcula os dias automaticamente no formulário
  const handleDataInicioChange = (novaData: string) => {
    setEditStart(novaData)
    if (novaData) {
      const diasCalculados = calcularDiasSemAcidente(novaData)
      setEditDias(diasCalculados)
    }
  }

  // Alterar dias ajusta a data de início retroativamente para manter coerência
  const handleDiasChange = (novosDias: number) => {
    setEditDias(novosDias)
    if (novosDias >= 0) {
      const d = new Date()
      d.setDate(d.getDate() - novosDias)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      setEditStart(`${yyyy}-${mm}-${dd}`)
    }
  }

  // Salvar ajustes
  const handleSalvarAjustes = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validações obrigatórias
    if (editDias < 0) {
      toast.error('Dias sem acidentes com afastamento não pode ser negativo.')
      return
    }
    if (editNoLeave < 0) {
      toast.error('Dias sem afastamento não pode ser negativo.')
      return
    }
    if (editGoal <= 0 || isNaN(editGoal)) {
      toast.error('A meta anual deve ser maior que zero.')
      return
    }
    if (editRecord < 0) {
      toast.error('O recorde da obra não pode ser negativo.')
      return
    }
    if (!editStart) {
      toast.error('Informe a data de início da contagem.')
      return
    }

    try {
      setSalvando(true)
      const novaConfig: PlacarSegurancaConfig = {
        diasSemAcidentesComAfastamento: Math.round(editDias),
        diasSemAfastamento: Math.round(editNoLeave),
        metaDias: Math.round(editGoal),
        recordeHistoricoDias: Math.round(editRecord),
        dataUltimoAcidenteComAfastamento: editStart,
        nomeObra: editProject.trim() || 'PLACAR DA OBRA',
        fraseDestaque: editMessage.trim() || 'NOSSO MAIOR VALOR É A VIDA',
        observacao: editMessage.trim() || undefined,
        atualizadoEm: new Date().toISOString(),
      }

      setConfig(novaConfig)
      const ok = await salvarPlacarSeguranca(novaConfig, currentEnv)
      if (ok) {
        toast.success('Placar de segurança atualizado e salvo no banco de dados!')
      } else {
        toast.info('Placar atualizado e preservado localmente.')
      }
      setModalAberto(false)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar alterações no placar.')
    } finally {
      setSalvando(false)
    }
  }

  // Exportar dados em JSON (compatível com a funcionalidade da referência)
  const handleExportarJson = () => {
    const payload = {
      days: editDias,
      noLeave: editNoLeave,
      goal: editGoal,
      record: editRecord,
      start: editStart,
      project: editProject,
      message: editMessage,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `placar-seguranca-${currentEnv}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Dados do placar exportados com sucesso!')
  }

  // Skeleton screen para carregamento
  if (carregando && !config) {
    return (
      <div className="w-full bg-[#0a0f14] rounded-3xl p-8 border border-amber-500/40 shadow-2xl animate-pulse mb-6 text-white min-h-[380px] flex flex-col justify-between">
        <div className="flex justify-between items-center pb-4 border-b border-white/10">
          <div className="h-6 w-48 bg-white/10 rounded-md" />
          <div className="h-8 w-32 bg-white/10 rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-6 items-center">
          <div className="h-36 bg-white/10 rounded-2xl mx-auto w-36" />
          <div className="h-44 bg-white/10 rounded-2xl w-full" />
          <div className="h-36 bg-white/10 rounded-2xl mx-auto w-36" />
        </div>
        <div className="h-20 bg-white/10 rounded-2xl w-full" />
      </div>
    )
  }

  return (
    <>
      <section
        className={`placar-seguranca-board ${modoCompacto ? 'my-2' : 'my-2 sm:my-3'}`}
        aria-label="Placar de Segurança da Obra"
      >
        {/* Faixa Hazard Superior */}
        <div className="placar-hazard placar-hazard-top" aria-hidden="true" />

        {/* CABEÇALHO */}
        <header className="placar-topline">
          <div className="placar-brand-mark">
            <img src="/placar-seguranca/helmet.svg" alt="Capacete de Segurança" />
            <span>{dadosAtuais.nomeObra}</span>
          </div>

          <div className="placar-live">
            <span className="text-[#ffd34d] font-black tracking-wider text-xs hidden sm:inline">
              PLACAR DA OBRA
            </span>
            <b>
              <span className="placar-pulse" aria-hidden="true" />
              AO VIVO
            </b>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={abrirModalAjuste}
              className="placar-edit-btn"
              title="Ajustar indicadores do placar de segurança"
            >
              <Settings className="w-3.5 h-3.5 text-[#f5b400]" />
              <span>Ajustar Placar</span>
            </button>
          )}
        </header>

        {/* ÁREA CENTRAL */}
        <div className="placar-hero-grid">
          {/* LADO ESQUERDO: EMBLEMA TRANSPARENTE */}
          <aside className="placar-side-seal">
            <picture>
              <source srcSet="/placar-seguranca/security-badge.webp" type="image/webp" />
              <img
                src="/placar-seguranca/security-badge.png"
                alt="Emblema de Segurança do Trabalho"
                className="placar-security-badge"
                loading="lazy"
                decoding="async"
              />
            </picture>
            <span className="placar-seal-caption">{dadosAtuais.fraseDestaque}</span>
          </aside>

          {/* CENTRO: DIAS SEM ACIDENTES COM AFASTAMENTO */}
          <section className="placar-main-counter">
            <div className="placar-counter-kicker">
              <picture>
                <source srcSet="/placar-seguranca/generated-shield.webp" type="image/webp" />
                <img
                  src="/placar-seguranca/generated-shield.png"
                  alt=""
                  className="placar-generated-shield"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
              <span className="placar-pulse" aria-hidden="true" />
              <span>DIAS SEM ACIDENTES COM AFASTAMENTO</span>
            </div>

            <div className="placar-number-line">
              <strong>{dadosAtuais.dias.toLocaleString('pt-BR')}</strong>
              <span>DIAS</span>
            </div>

            <div className="placar-safe-ribbon">
              <img src="/placar-seguranca/shield-check.svg" alt="" />
              <span>TRABALHANDO COM SEGURANÇA</span>
            </div>

            <div className="placar-secondary-stat">
              <span>Sem afastamento</span>
              <strong>{dadosAtuais.diasSemAfastamento.toLocaleString('pt-BR')} dias</strong>
            </div>
          </section>

          {/* LADO DIREITO: ALVO ZERO ACIDENTE */}
          <aside className="placar-goal-side">
            <img src="/placar-seguranca/target.svg" alt="Alvo Zero Acidente" />
            <strong>
              ZERO
              <br />
              ACIDENTE
            </strong>
            <span>{dadosAtuais.fraseDestaque}</span>
          </aside>
        </div>

        {/* ÁREA INFERIOR: PAINEL DE META E PROGRESSO */}
        <section className="placar-progress-panel">
          <div className="placar-progress-head">
            <div className="placar-goal-label">
              <img src="/placar-seguranca/target.svg" alt="" />
              <span>
                META ANUAL: <b>{dadosAtuais.meta.toLocaleString('pt-BR')} DIAS</b>
              </span>
            </div>
            <div className="placar-remaining">
              <span>FALTAM:</span> <b>{dadosAtuais.faltam.toLocaleString('pt-BR')} DIAS</b>
            </div>
          </div>

          {/* Barra de Progresso */}
          <div
            className="placar-progress-track"
            role="progressbar"
            aria-label="Progresso da meta anual"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Number(dadosAtuais.percentualExibicao.toFixed(1))}
          >
            <div
              className="placar-progress-fill"
              style={{
                width: `${Math.max(5, dadosAtuais.percentualExibicao)}%`,
              }}
            >
              <span>
                {dadosAtuais.percentualExibicao.toLocaleString('pt-BR', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
                %
              </span>
            </div>
          </div>

          {/* Informações Complementares: Recorde e Início */}
          <div className="placar-progress-foot">
            <div>
              <img src="/placar-seguranca/trophy.svg" alt="" />
              <span>
                RECORDE DA OBRA: <b>{dadosAtuais.recorde.toLocaleString('pt-BR')} DIAS</b>
              </span>
            </div>
            <div>
              <img src="/placar-seguranca/calendar.svg" alt="" />
              <span>
                INÍCIO DA CONTAGEM: <b>{dadosAtuais.dataInicioBr}</b>
              </span>
            </div>
          </div>
        </section>

        {/* RODAPÉ DO PLACAR */}
        <footer className="placar-board-footer">
          <span>
            <img src="/placar-seguranca/shield-check.svg" alt="" />
            <span>Segurança é responsabilidade de todos.</span>
          </span>
          <span>Salvo automaticamente às {dadosAtuais.horaSalva}</span>
        </footer>

        {/* Faixa Hazard Inferior */}
        <div className="placar-hazard placar-hazard-bottom" aria-hidden="true" />
      </section>

      {/* MODAL DE AJUSTE DO PLACAR (VIA PORTAL) */}
      {modalAberto &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
            onClick={() => setModalAberto(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="placar-modal-title"
          >
            <div
              className="bg-[#0f1722] border-2 border-[#f5b400]/70 rounded-3xl w-full max-w-xl p-5 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.85)] text-white my-auto max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200 relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Topo do Modal */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#f5b400]/20 border border-[#f5b400]/50 flex items-center justify-center text-[#f5b400]">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-[#f5b400] uppercase tracking-widest block">
                      CONFIGURAÇÕES DO PLACAR
                    </span>
                    <h2 id="placar-modal-title" className="text-xl sm:text-2xl font-black text-white">
                      Ajustar Placar da Obra
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Formulário de Configuração */}
              <form onSubmit={handleSalvarAjustes} className="mt-5 space-y-4 text-xs font-bold">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Dias sem afastamento */}
                  <div>
                    <label className="block mb-1.5 text-gray-300 font-extrabold uppercase tracking-wider text-[11px]">
                      Dias sem acidentes com afastamento *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={editDias}
                      onChange={(e) => handleDiasChange(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/20 bg-[#16212d] text-base font-extrabold text-white focus:outline-none focus:ring-2 focus:ring-[#f5b400] focus:border-[#f5b400]"
                    />
                  </div>

                  {/* Dias sem afastamento */}
                  <div>
                    <label className="block mb-1.5 text-gray-300 font-extrabold uppercase tracking-wider text-[11px]">
                      Dias sem afastamento *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={editNoLeave}
                      onChange={(e) => setEditNoLeave(Math.max(0, Number(e.target.value)))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/20 bg-[#16212d] text-base font-extrabold text-white focus:outline-none focus:ring-2 focus:ring-[#f5b400] focus:border-[#f5b400]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Meta Anual */}
                  <div>
                    <label className="block mb-1.5 text-gray-300 font-extrabold uppercase tracking-wider text-[11px]">
                      Meta anual (dias) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={editGoal}
                      onChange={(e) => setEditGoal(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/20 bg-[#16212d] text-base font-extrabold text-white focus:outline-none focus:ring-2 focus:ring-[#f5b400] focus:border-[#f5b400]"
                    />
                  </div>

                  {/* Recorde da Obra */}
                  <div>
                    <label className="block mb-1.5 text-gray-300 font-extrabold uppercase tracking-wider text-[11px]">
                      Recorde da obra (dias) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={editRecord}
                      onChange={(e) => setEditRecord(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/20 bg-[#16212d] text-base font-extrabold text-white focus:outline-none focus:ring-2 focus:ring-[#f5b400] focus:border-[#f5b400]"
                    />
                  </div>
                </div>

                {/* Início da Contagem */}
                <div>
                  <label className="block mb-1.5 text-gray-300 font-extrabold uppercase tracking-wider text-[11px]">
                    Início da contagem *
                  </label>
                  <input
                    type="date"
                    required
                    value={editStart}
                    onChange={(e) => handleDataInicioChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/20 bg-[#16212d] text-sm font-extrabold text-white focus:outline-none focus:ring-2 focus:ring-[#f5b400] focus:border-[#f5b400]"
                  />
                  <span className="text-[10px] text-gray-400 block mt-1 font-medium">
                    Ao alterar a data, a contagem de dias se recalcula automaticamente.
                  </span>
                </div>

                {/* Nome da Obra / Unidade */}
                <div>
                  <label className="block mb-1.5 text-gray-300 font-extrabold uppercase tracking-wider text-[11px]">
                    Nome da obra / unidade
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={editProject}
                    onChange={(e) => setEditProject(e.target.value)}
                    placeholder="Ex.: PLACAR DA OBRA"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/20 bg-[#16212d] text-sm font-bold text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#f5b400] focus:border-[#f5b400]"
                  />
                </div>

                {/* Frase de Destaque */}
                <div>
                  <label className="block mb-1.5 text-gray-300 font-extrabold uppercase tracking-wider text-[11px]">
                    Frase de destaque
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={editMessage}
                    onChange={(e) => setEditMessage(e.target.value)}
                    placeholder="Ex.: NOSSO MAIOR VALOR É A VIDA"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/20 bg-[#16212d] text-sm font-medium text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#f5b400] focus:border-[#f5b400]"
                  />
                </div>

                {/* Ações do Modal */}
                <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={handleExportarJson}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/15 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-[#f5b400]" />
                    <span>Exportar JSON</span>
                  </button>

                  <div className="w-full sm:w-auto flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setModalAberto(false)}
                      className="w-1/2 sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={salvando}
                      className="w-1/2 sm:w-auto px-6 py-2.5 rounded-xl text-xs font-extrabold bg-[#087b3d] hover:bg-[#0aa351] text-white shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{salvando ? 'Salvando...' : 'Salvar alterações'}</span>
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-gray-400 leading-relaxed pt-1">
                  As alterações são gravadas diretamente no banco de dados Supabase e sincronizadas
                  em tempo real com todos os usuários autorizados do sistema.
                </p>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
