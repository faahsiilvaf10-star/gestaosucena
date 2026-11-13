import React, { useState, useEffect, useMemo } from 'react'
import Zap from 'lucide-react/dist/esm/icons/zap.js'
import Clock from 'lucide-react/dist/esm/icons/clock.js'
import AlertTriangle from 'lucide-react/dist/esm/icons/triangle-alert.js'
import AlertCircle from 'lucide-react/dist/esm/icons/circle-alert.js'
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.js'
import History from 'lucide-react/dist/esm/icons/history.js'
import Send from 'lucide-react/dist/esm/icons/send.js'
import X from 'lucide-react/dist/esm/icons/x.js'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw.js'
import ShieldAlert from 'lucide-react/dist/esm/icons/shield-alert.js'
import { toast } from 'sonner'
import { useTheme } from '../contexts/ThemeContext'
import {
  GeradorHorimetroData,
  getGeradorHorimetro,
  saveGeradorHorimetro,
  calcHorasRestantes,
  getStatusGerador,
  reenviarAlertaWhatsappGerador,
  GERADOR_HORIMETRO_UPDATED_EVENT
} from '../lib/geradorHorimetro'
import { getAuthenticatedUserName } from '../lib/authHelpers'

interface GeradorHorimetroModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (data: GeradorHorimetroData) => void
  initialData?: GeradorHorimetroData | null
  currentEnv?: string
}

export function GeradorHorimetroModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  currentEnv
}: GeradorHorimetroModalProps) {
  const { isDark } = useTheme()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false)

  const [data, setData] = useState<GeradorHorimetroData | null>(initialData || null)
  const [currentHoriInput, setCurrentHoriInput] = useState<string>('')
  const [nextMaintInput, setNextMaintInput] = useState<string>('')
  const [notesInput, setNotesInput] = useState<string>('')
  const [showHistory, setShowHistory] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await getGeradorHorimetro(currentEnv)
      setData(res)
      setCurrentHoriInput(String(res.currentHorimeter || ''))
      setNextMaintInput(String(res.nextMaintenanceHorimeter || ''))
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível carregar os dados do horímetro')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setData(initialData)
        setCurrentHoriInput(String(initialData.currentHorimeter || ''))
        setNextMaintInput(String(initialData.nextMaintenanceHorimeter || ''))
      } else {
        loadData()
      }
    }
  }, [isOpen, initialData, currentEnv])

  // Cálculos reativos
  const numCurrent = parseFloat(currentHoriInput) || 0
  const numNext = parseFloat(nextMaintInput) || 0
  const remainingHours = calcHorasRestantes(numCurrent, numNext)
  const status = getStatusGerador(numCurrent, numNext, data?.alertHoursThreshold || 20)

  const progressPercent = useMemo(() => {
    if (numNext <= 0) return 0
    const pct = (numCurrent / numNext) * 100
    return Math.min(100, Math.max(0, Math.round(pct)))
  }, [numCurrent, numNext])

  if (!isOpen) return null

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (numCurrent < 0) {
      toast.error('O horímetro não pode ser negativo')
      return
    }
    if (numNext <= 0) {
      toast.error('Defina um horímetro de manutenção válido')
      return
    }

    setSaving(true)
    try {
      const userName = await getAuthenticatedUserName()
      const res = await saveGeradorHorimetro(
        {
          currentHorimeter: numCurrent,
          nextMaintenanceHorimeter: numNext,
          notes: notesInput
        },
        currentEnv,
        userName
      )

      if (!res.success) {
        throw new Error(res.error || 'Erro ao salvar horímetro')
      }

      setData(res.data)
      setNotesInput('')

      if (res.whatsappSent) {
        toast.success(
          `Horímetro salvo! Alerta de manutenção (faltam ${remainingHours}h) enviado ao grupo do WhatsApp!`
        )
      } else {
        toast.success('Horímetro do gerador atualizado com sucesso!')
      }

      if (onSuccess) onSuccess(res.data)
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao salvar alterações')
    } finally {
      setSaving(false)
    }
  }

  const handleManualWhatsappAlert = async () => {
    if (!data) return
    setSendingWhatsapp(true)
    try {
      const userName = await getAuthenticatedUserName()
      const ok = await reenviarAlertaWhatsappGerador(
        {
          ...data,
          currentHorimeter: numCurrent,
          nextMaintenanceHorimeter: numNext
        },
        userName
      )
      if (ok) {
        toast.success('Alerta de horímetro enviado com sucesso para o grupo do WhatsApp!')
      } else {
        toast.error('Não foi possível enviar para o WhatsApp. Verifique as configurações.')
      }
    } catch (err) {
      console.error(err)
      toast.error('Erro ao acionar WhatsApp')
    } finally {
      setSendingWhatsapp(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => !saving && onClose()}
      />

      {/* Modal Card */}
      <div
        className={`relative w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl max-h-[calc(100dvh-32px)] overflow-y-auto transition-all ${
          isDark
            ? 'bg-[#121217] text-white border border-white/10'
            : 'bg-white text-gray-900 border border-black/10 shadow-xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-black/5 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
              <Zap size={24} className="fill-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">Gerador</h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 uppercase font-semibold">
                  TAG: {data?.plate_tag || 'E9A4808'}
                </span>
              </div>
              <p className="text-xs opacity-60 mt-0.5">
                Controle de horímetro diário e manutenção preventiva
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 opacity-60">
            <RefreshCw size={28} className="animate-spin text-amber-500" />
            <span className="text-sm">Carregando dados do horímetro...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="mt-6 space-y-6">
            {/* Status Card com Alerta Visual */}
            <div
              className={`p-4 rounded-2xl border transition-all ${
                status === 'vencido'
                  ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                  : status === 'alerta'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {status === 'vencido' ? (
                    <ShieldAlert size={22} className="text-red-500 shrink-0 animate-bounce" />
                  ) : status === 'alerta' ? (
                    <AlertTriangle size={22} className="text-amber-500 shrink-0" />
                  ) : (
                    <CheckCircle2 size={22} className="text-emerald-500 shrink-0" />
                  )}
                  <div>
                    <h4 className="text-sm font-bold">
                      {status === 'vencido'
                        ? '🚨 ALERTA: MANUTENÇÃO VENCIDA!'
                        : status === 'alerta'
                        ? '⚠️ ATENÇÃO: MANUTENÇÃO PREVENTIVA PRÓXIMA'
                        : '✅ OPERAÇÃO EM DIA'}
                    </h4>
                    <p className="text-xs mt-0.5 opacity-90">
                      {status === 'vencido'
                        ? `O gerador ultrapassou o horímetro programado em ${Math.abs(remainingHours)} horas!`
                        : status === 'alerta'
                        ? `Restam apenas ${remainingHours} horas para a revisão do equipamento.`
                        : `Faltam ${remainingHours} horas de operação para a próxima manutenção.`}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-2xl font-black tabular-nums tracking-tight">
                    {remainingHours <= 0 ? (
                      <span className="text-red-500">+{Math.abs(remainingHours)}h</span>
                    ) : (
                      <span>{remainingHours}h</span>
                    )}
                  </div>
                  <div className="text-[10px] uppercase font-bold opacity-75">
                    {remainingHours <= 0 ? 'Vencidas' : 'Restantes'}
                  </div>
                </div>
              </div>

              {/* Barra de Progresso do Horímetro */}
              <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5">
                <div className="flex items-center justify-between text-[11px] font-semibold mb-1 opacity-80">
                  <span>Uso até a revisão ({progressPercent}%)</span>
                  <span>
                    {numCurrent}h / {numNext}h
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
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
              </div>
            </div>

            {/* Inputs de Horímetro */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Horímetro Atual */}
              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                <label className="block text-xs font-bold uppercase tracking-wider opacity-70 mb-1">
                  ⏱️ Horímetro Atual (Hoje)
                </label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={currentHoriInput}
                    onChange={(e) => setCurrentHoriInput(e.target.value)}
                    placeholder="Ex: 1250"
                    className={`w-full px-4 py-3 rounded-xl border text-xl font-black tabular-nums transition-colors outline-none ${
                      isDark
                        ? 'bg-[#18181f] border-white/10 focus:border-amber-500 text-white'
                        : 'bg-white border-gray-300 focus:border-amber-500 text-gray-900'
                    }`}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold opacity-50">
                    horas
                  </span>
                </div>
                {/* Botões de Incremento Rápido */}
                <div className="flex items-center gap-1.5 mt-2">
                  {[1, 5, 10].map((inc) => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() =>
                        setCurrentHoriInput(String(Number((numCurrent + inc).toFixed(1))))
                      }
                      className="px-2 py-1 rounded-lg text-xs font-semibold bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
                    >
                      +{inc}h
                    </button>
                  ))}
                </div>
              </div>

              {/* Próximo Horímetro de Manutenção */}
              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                <label className="block text-xs font-bold uppercase tracking-wider opacity-70 mb-1">
                  🔧 Próx. Manutenção
                </label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    required
                    value={nextMaintInput}
                    onChange={(e) => setNextMaintInput(e.target.value)}
                    placeholder="Ex: 1500"
                    className={`w-full px-4 py-3 rounded-xl border text-xl font-black tabular-nums transition-colors outline-none ${
                      isDark
                        ? 'bg-[#18181f] border-white/10 focus:border-amber-500 text-white'
                        : 'bg-white border-gray-300 focus:border-amber-500 text-gray-900'
                    }`}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold opacity-50">
                    horas
                  </span>
                </div>
                {/* Botões rápidos de intervalo padrão */}
                <div className="flex items-center gap-1.5 mt-2">
                  {[250, 500].map((step) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() =>
                        setNextMaintInput(String(Math.ceil((numCurrent + 1) / step) * step))
                      }
                      className="px-2 py-1 rounded-lg text-xs font-semibold bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
                      title={`Próximo múltiplo de ${step}h`}
                    >
                      {step}h
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Observações / Notas */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider opacity-70 mb-1.5">
                Observações do Apontamento (Opcional)
              </label>
              <input
                type="text"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="Ex: Troca de óleo realizada, filtro de ar inspecionado..."
                className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors outline-none ${
                  isDark
                    ? 'bg-white/5 border-white/10 focus:border-amber-500 text-white'
                    : 'bg-white border-gray-300 focus:border-amber-500 text-gray-900'
                }`}
              />
            </div>

            {/* Botão de Histórico e Reenvio WhatsApp */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 text-xs font-semibold opacity-70 hover:opacity-100 hover:underline transition-opacity"
              >
                <History size={14} />
                <span>
                  {showHistory ? 'Ocultar Histórico' : `Ver Histórico (${data?.history?.length || 0})`}
                </span>
              </button>

              <button
                type="button"
                onClick={handleManualWhatsappAlert}
                disabled={sendingWhatsapp}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/20 border border-emerald-600/20 transition-colors disabled:opacity-50"
                title="Dispara notificação imediata no grupo do WhatsApp configurado"
              >
                <Send size={12} className={sendingWhatsapp ? 'animate-pulse' : ''} />
                <span>{sendingWhatsapp ? 'Enviando...' : 'Notificar WhatsApp Agora'}</span>
              </button>
            </div>

            {/* Painel de Histórico */}
            {showHistory && (
              <div
                className={`max-h-48 overflow-y-auto rounded-xl p-3 border text-xs space-y-2 ${
                  isDark ? 'bg-black/40 border-white/10' : 'bg-gray-100 border-gray-200'
                }`}
              >
                {data?.history && data.history.length > 0 ? (
                  data.history.map((h) => (
                    <div
                      key={h.id}
                      className={`p-2.5 rounded-lg border ${
                        isDark ? 'bg-white/5 border-white/5' : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span>Horímetro: {h.horimeter}h</span>
                        <span className="opacity-60 text-[10px]">
                          {new Date(h.date).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] opacity-75 mt-0.5">
                        <span>Manutenção: {h.nextMaintenance}h ({h.remainingHours}h rest.)</span>
                        <span>{h.userName}</span>
                      </div>
                      {h.notes && (
                        <p className="mt-1 text-[11px] italic opacity-80">{h.notes}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 opacity-50">
                    Nenhum apontamento anterior registrado.
                  </div>
                )}
              </div>
            )}

            {/* Ações do Rodapé */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-black/5 dark:border-white/10">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 text-black shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50"
              >
                {saving && <RefreshCw size={16} className="animate-spin" />}
                <span>{saving ? 'Salvando...' : 'Salvar Horímetro'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
