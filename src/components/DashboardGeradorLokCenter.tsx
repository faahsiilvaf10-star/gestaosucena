import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Zap from 'lucide-react/dist/esm/icons/zap.js'
import Clock from 'lucide-react/dist/esm/icons/clock.js'
import Wrench from 'lucide-react/dist/esm/icons/wrench.js'
import History from 'lucide-react/dist/esm/icons/history.js'
import Edit3 from 'lucide-react/dist/esm/icons/pen-line.js'
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.js'
import AlertTriangle from 'lucide-react/dist/esm/icons/triangle-alert.js'
import ShieldAlert from 'lucide-react/dist/esm/icons/shield-alert.js'
import Lock from 'lucide-react/dist/esm/icons/lock.js'
import X from 'lucide-react/dist/esm/icons/x.js'
import Calendar from 'lucide-react/dist/esm/icons/calendar.js'
import { toast } from 'sonner'
import {
  GeradorHorimetroData,
  getGeradorHorimetro,
  saveGeradorHorimetro,
  registrarManutencaoRealizada,
  calcHorasRestantes,
  getStatusGerador,
  GERADOR_HORIMETRO_UPDATED_EVENT
} from '../lib/geradorHorimetro'
import { checkCurrentUserIsAdmin, getAuthenticatedUserName } from '../lib/authHelpers'
import { supabase } from '../lib/supabase'
import '../generator-dashboard.css'

interface DashboardGeradorLokCenterProps {
  currentEnv?: string
}

export function DashboardGeradorLokCenter({ currentEnv }: DashboardGeradorLokCenterProps) {
  const [data, setData] = useState<GeradorHorimetroData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdminUser, setIsAdminUser] = useState(false)

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isMaintModalOpen, setIsMaintModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)

  // Form states - Alterar Horímetro
  const [hourInput, setHourInput] = useState<string>('')
  const [nextInput, setNextInput] = useState<string>('')
  const [intervalInput, setIntervalInput] = useState<string>('500')
  const [noteInput, setNoteInput] = useState<string>('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Form states - Registrar Manutenção
  const [maintHoriInput, setMaintHoriInput] = useState<string>('')
  const [maintDateInput, setMaintDateInput] = useState<string>(new Date().toISOString().split('T')[0])
  const [maintIntervalInput, setMaintIntervalInput] = useState<string>('500')
  const [maintNoteInput, setMaintNoteInput] = useState<string>('')
  const [maintResponsibleInput, setMaintResponsibleInput] = useState<string>('')
  const [savingMaint, setSavingMaint] = useState(false)

  const loadData = async () => {
    try {
      const [res, isAdm, user] = await Promise.all([
        getGeradorHorimetro(currentEnv),
        checkCurrentUserIsAdmin(),
        getAuthenticatedUserName()
      ])
      setData(res)
      setIsAdminUser(isAdm)
      if (user) setMaintResponsibleInput(user)
    } catch (e) {
      console.error('Erro ao carregar dados do gerador:', e)
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

  // Calculations
  const current = data?.currentHorimeter ?? 4296
  const next = data?.nextMaintenanceHorimeter ?? 4418
  const interval = data?.preventiveInterval || 500
  const lastService = data?.lastServiceHorimeter ?? Math.max(0, next - interval)
  const remainingHours = calcHorasRestantes(current, next)
  const isDue = remainingHours <= 0
  const status = getStatusGerador(current, next, data?.alertHoursThreshold || 20)

  // Cycle progress calculation matching reference formula
  const cyclePercent = useMemo(() => {
    if (interval <= 0) return 0
    const pct = ((current - lastService) / interval) * 100
    return Math.max(0, Math.min(100, pct))
  }, [current, lastService, interval])

  const formatNumber = (n: number) => {
    return Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  }

  // Open Edit Modal
  const handleOpenEdit = () => {
    setHourInput(String(current))
    setNextInput(String(next))
    setIntervalInput(String(interval))
    setNoteInput('')
    setIsEditModalOpen(true)
  }

  // Save Edit Reading
  const handleSaveEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const numHori = Number(hourInput)
    const numNext = Number(nextInput)
    const numInterval = Number(intervalInput)

    if (!Number.isFinite(numHori) || numHori < 0) {
      toast.error('Informe um horímetro válido.')
      return
    }

    if (!Number.isFinite(numNext) || numNext <= 0) {
      toast.error('Informe um valor válido para a próxima manutenção.')
      return
    }

    if (!Number.isFinite(numInterval) || numInterval <= 0) {
      toast.error('Informe um intervalo preventivo válido.')
      return
    }

    setSavingEdit(true)
    try {
      const userName = await getAuthenticatedUserName()
      const effectiveNext = isAdminUser ? numNext : next

      const res = await saveGeradorHorimetro(
        {
          currentHorimeter: numHori,
          nextMaintenanceHorimeter: effectiveNext,
          preventiveInterval: numInterval,
          notes: noteInput.trim() || undefined,
          eventType: 'Leitura atualizada',
          supplier: data?.supplier || 'LokCenter',
          name: data?.name || 'Gerador Sucena',
          plate_tag: data?.plate_tag || 'E9A4808'
        },
        currentEnv,
        userName
      )

      if (res.success) {
        setData(res.data)
        toast.success('Horímetro atualizado com sucesso!')
        setIsEditModalOpen(false)
      } else {
        toast.error(res.error || 'Erro ao salvar leitura')
      }
    } catch (err: any) {
      toast.error('Erro ao salvar leitura: ' + (err?.message || 'Falha de conexão'))
    } finally {
      setSavingEdit(false)
    }
  }

  // Open Maintenance Modal
  const handleOpenMaint = () => {
    setMaintHoriInput(String(current))
    setMaintDateInput(new Date().toISOString().split('T')[0])
    setMaintIntervalInput(String(interval))
    setMaintNoteInput('')
    setIsMaintModalOpen(true)
  }

  // Confirm Maintenance
  const handleConfirmMaint = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const numHori = Number(maintHoriInput)
    const numInterval = Number(maintIntervalInput)

    if (!Number.isFinite(numHori) || numHori < 0) {
      toast.error('Informe o horímetro da revisão.')
      return
    }

    if (!Number.isFinite(numInterval) || numInterval <= 0) {
      toast.error('Informe o intervalo preventivo em horas.')
      return
    }

    setSavingMaint(true)
    try {
      const userName = await getAuthenticatedUserName()
      const res = await registrarManutencaoRealizada(
        {
          maintenanceHorimeter: numHori,
          preventiveInterval: numInterval,
          maintenanceDate: maintDateInput,
          notes: maintNoteInput.trim() || 'Manutenção preventiva realizada',
          responsible: maintResponsibleInput.trim() || userName
        },
        currentEnv
      )

      if (res.success) {
        setData(res.data)
        toast.success('Manutenção preventiva registrada e próximo ciclo calculado!')
        setIsMaintModalOpen(false)
      } else {
        toast.error(res.error || 'Erro ao registrar manutenção')
      }
    } catch (err: any) {
      toast.error('Erro ao registrar manutenção: ' + (err?.message || 'Falha'))
    } finally {
      setSavingMaint(false)
    }
  }

  return (
    <>
      {/* ==========================================================
          MÓDULO GERADOR LOKCENTER — REPRODUÇÃO FIEL
          ========================================================== */}
      <section className="generator-card generator-dashboard" aria-label="Módulo Gerador LokCenter">
        {/* Cabeçalho */}
        <div className="gen-head generator-header">
          <div className="gen-ident">
            <div className="bolt" aria-hidden="true">
              ϟ
            </div>
            <div>
              <div className="gen-name">{data?.name || 'Gerador Sucena'}</div>
              <div className="gen-meta">
                <span className="tag">TAG: {data?.plate_tag || 'E9A4808'}</span>
                <span className="tag">FORNECEDOR: {data?.supplier || 'LOKCENTER'}</span>
                {status === 'vencido' ? (
                  <span className="danger-status" id="status">
                    ● MANUTENÇÃO PENDENTE ({Math.abs(remainingHours)}h)
                  </span>
                ) : status === 'alerta' ? (
                  <span className="warning-status" id="status">
                    ● REVISÃO PRÓXIMA ({remainingHours}h)
                  </span>
                ) : (
                  <span className="normal" id="status">
                    ● OPERAÇÃO NORMAL
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="gen-actions">
            <button
              type="button"
              className="button generator-btn"
              id="editBtn"
              onClick={handleOpenEdit}
            >
              ✎ &nbsp;Alterar Horímetro
            </button>
            <button
              type="button"
              className="button light generator-btn"
              id="maintBtn"
              onClick={handleOpenMaint}
              title="Registrar revisão preventiva e reiniciar ciclo"
            >
              ⚒ &nbsp;Manutenção
            </button>
            <button
              type="button"
              className="button light generator-btn"
              id="historyBtn"
              onClick={() => setIsHistoryModalOpen(true)}
            >
              ◷ Histórico
            </button>
          </div>
        </div>

        {/* Corpo Visual + Métricas */}
        <div className="gen-body">
          {/* Ilustração original flutuante do gerador LokCenter */}
          <div className="gen-visual generator-visual">
            <img
              alt="Ilustração do gerador industrial vermelho LokCenter"
              src="/images/generator-lokcenter.png"
            />
          </div>

          {/* Dados numéricos e progresso */}
          <div className="gen-data">
            <div className="gen-stats generator-metrics">
              {/* Horímetro Atual */}
              <div className="gen-stat">
                <small>◷ &nbsp; HORÍMETRO ATUAL</small>
                <strong id="current">
                  {formatNumber(current)} <em>h</em>
                </strong>
              </div>

              {/* Próxima Manutenção */}
              <div className="gen-stat">
                <small>⚒ &nbsp; PRÓXIMA MANUTENÇÃO</small>
                <strong id="next">
                  {formatNumber(next)} <em>h</em>
                </strong>
              </div>

              {/* Horas Restantes (Destaque Amarelo/Dourado) */}
              <div
                className={`gen-stat remaining ${
                  status === 'vencido' ? 'due' : status === 'alerta' ? 'warning' : ''
                }`}
              >
                <small>◴ &nbsp; HORAS RESTANTES</small>
                <strong id="remaining">
                  {isDue ? `0` : formatNumber(remainingHours)} <em>h</em>
                  {isDue && (
                    <span className="block text-[11px] font-bold text-red-600 dark:text-red-400 mt-0.5">
                      Vencido há {formatNumber(Math.abs(remainingHours))}h
                    </span>
                  )}
                </strong>
              </div>
            </div>

            {/* Barra de Progresso com Gradiente */}
            <div className="generator-progress progress">
              <div className="progresshead">
                <span>Progresso do ciclo de manutenção</span>
                <b id="progressText">
                  {cyclePercent.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                  % do ciclo
                </b>
              </div>
              <div className="track" role="progressbar" aria-valuenow={cyclePercent} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className={`fill ${status === 'vencido' ? 'fill-due' : status === 'alerta' ? 'fill-warning' : ''}`}
                  id="fill"
                  style={{ width: `${cyclePercent}%` }}
                />
              </div>
              <div className="gen-foot">
                <span id="lastService">Início do ciclo: {formatNumber(lastService)} h</span>
                <span>
                  Fornecedor: <b>{data?.supplier || 'LokCenter'}</b>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================================
          MODAL 1: ALTERAR HORÍMETRO
          ========================================================== */}
      {isEditModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="generator-modal"
            id="editModal"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsEditModalOpen(false)
            }}
          >
            <div className="generator-modal-dialog">
              <div className="flex items-center justify-between mb-2">
                <h3>Atualizar horímetro do gerador</h3>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>
              <p>
                Informe a leitura atual e a próxima manutenção preventiva. O painel recalcula as
                horas restantes automaticamente.
              </p>

              <form onSubmit={handleSaveEdit}>
                <div className="generator-modal-field">
                  <label htmlFor="hourInput">Horímetro atual (horas)</label>
                  <input
                    id="hourInput"
                    type="number"
                    min="0"
                    step="0.1"
                    required
                    value={hourInput}
                    onChange={(e) => setHourInput(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="generator-modal-field">
                  <label htmlFor="nextInput">
                    <span>Próxima manutenção (horas)</span>
                    {!isAdminUser && (
                      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                        <Lock size={10} /> Apenas Admin altera
                      </span>
                    )}
                  </label>
                  <input
                    id="nextInput"
                    type="number"
                    min="0"
                    step="0.1"
                    required
                    disabled={!isAdminUser}
                    value={nextInput}
                    onChange={(e) => setNextInput(e.target.value)}
                  />
                </div>

                <div className="generator-modal-field">
                  <label htmlFor="intervalInput">Intervalo preventivo (horas)</label>
                  <input
                    id="intervalInput"
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={intervalInput}
                    onChange={(e) => setIntervalInput(e.target.value)}
                  />
                </div>

                <div className="generator-modal-field">
                  <label htmlFor="noteInput">Observação (opcional)</label>
                  <input
                    id="noteInput"
                    type="text"
                    placeholder="Ex.: leitura realizada no início do turno"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                  />
                </div>

                <div className="generator-modal-actions">
                  <button
                    type="button"
                    className="button light generator-btn"
                    onClick={() => setIsEditModalOpen(false)}
                    disabled={savingEdit}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="button generator-btn"
                    disabled={savingEdit}
                  >
                    {savingEdit ? 'Salvando...' : 'Salvar leitura'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ==========================================================
          MODAL 2: REGISTRAR MANUTENÇÃO PREVENTIVA
          ========================================================== */}
      {isMaintModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="generator-modal"
            id="maintModal"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsMaintModalOpen(false)
            }}
          >
            <div className="generator-modal-dialog">
              <div className="flex items-center justify-between mb-2">
                <h3>Registrar Manutenção Preventiva</h3>
                <button
                  type="button"
                  onClick={() => setIsMaintModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>
              <p>
                Ao confirmar a manutenção, o início do ciclo é atualizado para o horímetro realizado
                e a próxima revisão preventiva é calculada automaticamente.
              </p>

              <form onSubmit={handleConfirmMaint}>
                <div className="generator-modal-field">
                  <label htmlFor="maintHoriInput">Horímetro da manutenção realizada (horas)</label>
                  <input
                    id="maintHoriInput"
                    type="number"
                    min="0"
                    step="0.1"
                    required
                    value={maintHoriInput}
                    onChange={(e) => setMaintHoriInput(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="generator-modal-field">
                  <label htmlFor="maintDateInput">Data da manutenção</label>
                  <input
                    id="maintDateInput"
                    type="date"
                    required
                    value={maintDateInput}
                    onChange={(e) => setMaintDateInput(e.target.value)}
                  />
                </div>

                <div className="generator-modal-field">
                  <label htmlFor="maintIntervalInput">Intervalo para a próxima manutenção (horas)</label>
                  <input
                    id="maintIntervalInput"
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={maintIntervalInput}
                    onChange={(e) => setMaintIntervalInput(e.target.value)}
                  />
                  <small className="block mt-1 text-[11px] text-slate-500">
                    Próxima manutenção estimada: <b>{(Number(maintHoriInput || 0) + Number(maintIntervalInput || 0)).toFixed(1)} h</b>
                  </small>
                </div>

                <div className="generator-modal-field">
                  <label htmlFor="maintResponsibleInput">Responsável pelo registro</label>
                  <input
                    id="maintResponsibleInput"
                    type="text"
                    required
                    value={maintResponsibleInput}
                    onChange={(e) => setMaintResponsibleInput(e.target.value)}
                  />
                </div>

                <div className="generator-modal-field">
                  <label htmlFor="maintNoteInput">Observações do serviço realizado</label>
                  <textarea
                    id="maintNoteInput"
                    rows={2}
                    placeholder="Ex.: Troca de óleo, substituição dos filtros de ar e combustível, teste de carga..."
                    value={maintNoteInput}
                    onChange={(e) => setMaintNoteInput(e.target.value)}
                  />
                </div>

                <div className="generator-modal-actions">
                  <button
                    type="button"
                    className="button light generator-btn"
                    onClick={() => setIsMaintModalOpen(false)}
                    disabled={savingMaint}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="button generator-btn"
                    style={{ background: '#00a878' }}
                    disabled={savingMaint}
                  >
                    {savingMaint ? 'Registrando...' : 'Confirmar Manutenção'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ==========================================================
          MODAL 3: HISTÓRICO PERSISTENTE
          ========================================================== */}
      {isHistoryModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="generator-modal"
            id="historyModal"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsHistoryModalOpen(false)
            }}
          >
            <div className="generator-modal-dialog" style={{ width: 'min(580px, 100%)' }}>
              <div className="flex items-center justify-between mb-2">
                <h3>Histórico do Gerador Sucena</h3>
                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>
              <p>
                Leituras e manutenções registradas e sincronizadas em tempo real com o banco de dados.
              </p>

              <div className="generator-history-list" id="historyList">
                {data?.history && data.history.length > 0 ? (
                  data.history.map((item) => {
                    const dt = new Date(item.date)
                    const dateFormatted = !isNaN(dt.getTime())
                      ? dt.toLocaleString('pt-BR')
                      : item.date
                    const isMaintEvent =
                      (item.eventType || '').toLowerCase().includes('manutenção')

                    return (
                      <div key={item.id} className="generator-history-row">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isMaintEvent
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {item.eventType || 'Leitura atualizada'}
                            </span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                              {dateFormatted}
                            </span>
                            <span className="text-[10.5px] text-slate-400">
                              por {item.userName || 'Sistema'}
                            </span>
                          </div>
                          {item.notes && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic">
                              "{item.notes}"
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Próxima revisão: {item.nextMaintenance}h
                            {item.remainingHours !== undefined && (
                              <span> · Restavam: {item.remainingHours}h</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <b className="text-[13px] font-extrabold text-[#17243c] dark:text-white">
                            {formatNumber(item.horimeter)} h
                          </b>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    Nenhum registro de histórico gravado ainda.
                  </div>
                )}
              </div>

              <div className="generator-modal-actions">
                <button
                  type="button"
                  className="button generator-btn"
                  id="closeHistory"
                  onClick={() => setIsHistoryModalOpen(false)}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
