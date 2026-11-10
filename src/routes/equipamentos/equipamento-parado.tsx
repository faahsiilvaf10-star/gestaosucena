import Search from 'lucide-react/dist/esm/icons/search.js';
import Filter from 'lucide-react/dist/esm/icons/funnel.js';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw.js';
import AlertCircle from 'lucide-react/dist/esm/icons/circle-alert.js';
import TriangleAlert from 'lucide-react/dist/esm/icons/triangle-alert.js';
import History from 'lucide-react/dist/esm/icons/history.js';
import Clock from 'lucide-react/dist/esm/icons/clock.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.js';
import PowerOff from 'lucide-react/dist/esm/icons/power-off.js';
import Wrench from 'lucide-react/dist/esm/icons/wrench.js';
import FileDown from 'lucide-react/dist/esm/icons/file-down.js';
import Calendar from 'lucide-react/dist/esm/icons/calendar.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js';
import Play from 'lucide-react/dist/esm/icons/play.js';
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../contexts/ThemeContext'
import { toast } from 'sonner'
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover'
import { Calendar as CalendarUI } from '../../components/ui/calendar'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '../../lib/utils'
import { isOutside, locationFromMovements, MovementRecord } from '@/lib/equipamentos/locationStatus'
import { isVehicle, BROKEN_REASONS, getBrokenReasonLabel } from '@/lib/equipamentos/equipmentTypes'
import { getAuthenticatedUserName } from '@/lib/authHelpers'

export const Route = createFileRoute('/equipamentos/equipamento-parado')({
  component: EquipamentoParadoPage,
})

interface Equipment {
  id: string
  name: string
  plate_tag: string
  category?: string
  type?: string
  location_status?: 'inside' | 'outside' | null
  status?: string | null
  last_exit_reason?: string | null
  last_exit_description?: string | null
  updated_at: string
}

interface Movement {
  id: string
  equipment_id: string
  movement_type: 'entry' | 'exit'
  exit_reason: string | null
  description: string | null
  created_at: string
  created_by: string | null
}

function formatCompactDate(isoString?: string | null) {
  if (!isoString) return '-'
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return '-'
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year} ${hours}:${minutes}`
  } catch {
    return '-'
  }
}

function EquipamentoParadoPage() {
  const { isDark } = useTheme()
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('Todos')
  const [filterCategory, setFilterCategory] = useState<string>('Todas as categorias')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Modals
  const [selectedEq, setSelectedEq] = useState<Equipment | null>(null)
  const [isBrokenModalOpen, setIsBrokenModalOpen] = useState(false)
  const [isWorkingModalOpen, setIsWorkingModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)

  // Report Modal
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [reportStartDate, setReportStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [reportEndDate, setReportEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)

  const [eqHistory, setEqHistory] = useState<Movement[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [deletingMovId, setDeletingMovId] = useState<string | null>(null)

  // Forms
  const [brokenReason, setBrokenReason] = useState<string>('mechanical_failure')
  const [brokenDescription, setBrokenDescription] = useState('')
  const [workingDescription, setWorkingDescription] = useState('')
  const [actionDateTime, setActionDateTime] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const getLocalDatetime = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  }

  const getUserName = async () => {
    return await getAuthenticatedUserName('Encarregado')
  }

  const fetchEquipments = async () => {
    try {
      setError(null)
      if (!isRefreshing) setLoading(true)

      const currentEnv = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'

      const [eqRes, movRes] = await Promise.all([
        supabase
          .from('eq_equipments')
          .select('id, name, plate_tag, category, type, location_status, status, environment, updated_at, last_exit_reason, last_exit_description')
          .eq('environment', currentEnv)
          .order('name', { ascending: true }),
        supabase
          .from('eq_movements')
          .select('id, equipment_id, movement_type, exit_reason, description, created_at, created_by')
          .order('created_at', { ascending: false })
      ])

      if (eqRes.error) throw eqRes.error

      const movementsByEq = new Map<string, MovementRecord[]>()
      if (movRes.data) {
        for (const m of movRes.data) {
          if (!movementsByEq.has(m.equipment_id)) {
            movementsByEq.set(m.equipment_id, [])
          }
          movementsByEq.get(m.equipment_id)!.push(m)
        }
      }

      // Regra fundamental: SOMENTE EQUIPAMENTOS (sem ser veículos)
      const rawEquipments = (eqRes.data || []).filter(eq => !isVehicle(eq))

      const reconciledEquipments = rawEquipments.map(eq => {
        const movements = movementsByEq.get(eq.id) || []
        const lastMov = movements[0]

        // Se último movimento foi exit => 'outside' (Quebrado)
        // Sem movimento de saída => 'inside' (Funcionando)
        const derivedStatus = locationFromMovements(movements) ?? 'inside'
        const derivedReason = derivedStatus === 'outside' ? (lastMov?.exit_reason || eq.last_exit_reason) : null
        const derivedDesc = derivedStatus === 'outside' ? (lastMov?.description || eq.last_exit_description) : null
        const targetStatus = derivedStatus === 'outside' ? 'Quebrado' : 'Em operação'

        // Reconciliar cache no banco se houver divergência
        if (eq.location_status !== derivedStatus || eq.status !== targetStatus) {
          supabase
            .from('eq_equipments')
            .update({
              location_status: derivedStatus,
              status: targetStatus,
              last_exit_reason: derivedReason,
              last_exit_description: derivedDesc
            })
            .eq('id', eq.id)
            .then()
        }

        return {
          ...eq,
          location_status: derivedStatus,
          status: targetStatus,
          last_exit_reason: derivedReason,
          last_exit_description: derivedDesc,
          updated_at: lastMov?.created_at || eq.updated_at
        }
      })

      setEquipments(reconciledEquipments)
    } catch (err: any) {
      console.error('Erro ao buscar equipamentos:', err)
      setError('Não foi possível carregar os equipamentos.')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchEquipments()

    const subscription = supabase
      .channel('eq_equipamentos_parados_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eq_equipments' }, () => {
        fetchEquipments()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eq_movements' }, () => {
        fetchEquipments()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving && !isGeneratingReport) {
        setIsBrokenModalOpen(false)
        setIsWorkingModalOpen(false)
        setIsHistoryModalOpen(false)
        setIsReportModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSaving, isGeneratingReport])

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchEquipments()
  }

  const handleOpenMarkBroken = (eq: Equipment) => {
    setSelectedEq(eq)
    setBrokenReason('mechanical_failure')
    setBrokenDescription('')
    setActionDateTime(getLocalDatetime())
    setIsBrokenModalOpen(true)
  }

  const handleOpenMarkWorking = (eq: Equipment) => {
    setSelectedEq(eq)
    setWorkingDescription('')
    setActionDateTime(getLocalDatetime())
    setIsWorkingModalOpen(true)
  }

  const handleOpenHistory = async (eq: Equipment) => {
    setSelectedEq(eq)
    setIsHistoryModalOpen(true)
    setLoadingHistory(true)
    try {
      const currentEnv = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
      const { data, error } = await supabase
        .from('eq_movements')
        .select('id, equipment_id, movement_type, exit_reason, description, created_by, created_at')
        .eq('environment', currentEnv)
        .eq('equipment_id', eq.id)
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      setEqHistory(data || [])
    } catch (err) {
      console.error('Erro ao buscar histórico:', err)
      toast.error('Erro ao carregar histórico')
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleDeleteMovement = async (movId: string) => {
    if (!selectedEq) return
    const confirmDelete = window.confirm('Deseja realmente excluir este registro de histórico?')
    if (!confirmDelete) return

    setDeletingMovId(movId)
    try {
      const { error } = await supabase
        .from('eq_movements')
        .delete()
        .eq('id', movId)

      if (error) throw error

      toast.success('Registro excluído com sucesso.')
      setEqHistory(prev => prev.filter(m => m.id !== movId))
      fetchEquipments()
    } catch (err: any) {
      console.error('Erro ao excluir movimentação:', err)
      toast.error('Erro ao excluir registro.')
    } finally {
      setDeletingMovId(null)
    }
  }

  const handleConfirmBroken = async () => {
    if (!selectedEq) return
    if (!brokenReason) {
      toast.error('Selecione o motivo do defeito.')
      return
    }

    setIsSaving(true)
    try {
      const userName = await getUserName()
      const timestamp = new Date(actionDateTime).toISOString()
      const currentEnv = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'

      // Registrar em eq_movements como 'exit'
      const { error: moveError } = await supabase
        .from('eq_movements')
        .insert({
          equipment_id: selectedEq.id,
          movement_type: 'exit',
          exit_reason: brokenReason,
          description: brokenDescription.trim() || null,
          created_by: userName,
          created_at: timestamp,
          environment: currentEnv
        })

      if (moveError) throw moveError

      // Atualiza eq_equipments
      const { error: touchError } = await supabase
        .from('eq_equipments')
        .update({
          location_status: 'outside',
          status: 'Quebrado',
          last_exit_reason: brokenReason,
          last_exit_description: brokenDescription.trim() || null,
          updated_at: timestamp
        })
        .eq('id', selectedEq.id)

      if (touchError) {
        console.warn('Falha ao atualizar eq_equipments:', touchError.message)
      }

      // Notificar outros clientes e sistema
      const payload = {
        equipment_id: selectedEq.id,
        movement_type: 'exit',
        created_by: userName,
        created_at: timestamp,
        exit_reason: getBrokenReasonLabel(brokenReason),
        description: brokenDescription.trim() || null
      }

      supabase.channel('global_eq_movements').send({
        type: 'broadcast',
        event: 'eq_moved',
        payload
      })
      window.dispatchEvent(new CustomEvent('eq_moved_local', { detail: payload }))

      toast.success(`${selectedEq.name} marcado como QUEBRADO. Não contará no RDO principal.`)
      setIsBrokenModalOpen(false)
      fetchEquipments()

      try {
        const { logActivity } = await import('../../lib/logActivity')
        await logActivity({
          module: 'Equipamentos',
          action: `Equipamento Parado / Quebrado: ${selectedEq.name} (${selectedEq.plate_tag || 'S/ Tag'}) - Motivo: ${getBrokenReasonLabel(brokenReason)}`,
          user_name: userName
        })
      } catch (e) {
        console.error('Falha ao gravar log de atividade', e)
      }
    } catch (err: any) {
      console.error('Erro ao registrar quebra:', err)
      toast.error('Não foi possível registrar o equipamento como quebrado.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmWorking = async () => {
    if (!selectedEq) return

    setIsSaving(true)
    try {
      const userName = await getUserName()
      const timestamp = new Date(actionDateTime).toISOString()
      const currentEnv = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'

      // Registrar em eq_movements como 'entry'
      const { error: moveError } = await supabase
        .from('eq_movements')
        .insert({
          equipment_id: selectedEq.id,
          movement_type: 'entry',
          description: workingDescription.trim() || null,
          created_by: userName,
          created_at: timestamp,
          environment: currentEnv
        })

      if (moveError) throw moveError

      // Atualiza eq_equipments
      const { error: touchError } = await supabase
        .from('eq_equipments')
        .update({
          location_status: 'inside',
          status: 'Em operação',
          last_exit_reason: null,
          last_exit_description: null,
          updated_at: timestamp
        })
        .eq('id', selectedEq.id)

      if (touchError) {
        console.warn('Falha ao atualizar eq_equipments:', touchError.message)
      }

      const payload = {
        equipment_id: selectedEq.id,
        movement_type: 'entry',
        created_by: userName,
        created_at: timestamp
      }

      supabase.channel('global_eq_movements').send({
        type: 'broadcast',
        event: 'eq_moved',
        payload
      })
      window.dispatchEvent(new CustomEvent('eq_moved_local', { detail: payload }))

      toast.success(`${selectedEq.name} retornou para FUNCIONANDO (contará normalmente no RDO).`)
      setIsWorkingModalOpen(false)
      fetchEquipments()

      try {
        const { logActivity } = await import('../../lib/logActivity')
        await logActivity({
          module: 'Equipamentos',
          action: `Equipamento Funcionando: ${selectedEq.name} (${selectedEq.plate_tag || 'S/ Tag'})`,
          user_name: userName
        })
      } catch (e) {
        console.error('Falha ao gravar log de atividade', e)
      }
    } catch (err: any) {
      console.error('Erro ao registrar funcionamento:', err)
      toast.error('Não foi possível registrar o equipamento como funcionando.')
    } finally {
      setIsSaving(false)
    }
  }

  const generatePDFReport = async () => {
    if (!reportStartDate || !reportEndDate) {
      toast.error('Selecione as datas inicial e final.')
      return
    }

    setIsGeneratingReport(true)
    try {
      const startDate = new Date(`${reportStartDate}T00:00:00`)
      const endDate = new Date(`${reportEndDate}T23:59:59`)
      const currentEnv = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'

      const { data: movements, error } = await supabase
        .from('eq_movements')
        .select(`
          *,
          eq_equipments (
            name,
            plate_tag,
            category,
            type
          )
        `)
        .eq('environment', currentEnv)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true })

      if (error) throw error

      // Filtra apenas os que são equipamentos puros (sem veículos)
      const pureMovements = (movements || []).filter(m => !isVehicle(m.eq_equipments as any))

      if (pureMovements.length === 0) {
        toast.info('Nenhum registro de quebra ou funcionamento encontrado neste período.')
        return
      }

      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()

      try {
        const img = new Image()
        img.src = '/logo-relatorio.png'
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
        })
        const imgWidth = 30
        const imgHeight = imgWidth * (img.height / img.width)
        doc.addImage(img, 'PNG', 14, 10, imgWidth, imgHeight)

        doc.setFontSize(16)
        doc.text('Relatório de Equipamentos Parados e em Operação', 14, 10 + imgHeight + 8)
        doc.setFontSize(10)
        doc.text(`Período: ${reportStartDate.split('-').reverse().join('/')} até ${reportEndDate.split('-').reverse().join('/')}`, 14, 10 + imgHeight + 14)

        autoTable(doc, {
          startY: 10 + imgHeight + 20,
          head: [['Data/Hora', 'Equipamento', 'Tag / Ident.', 'Status', 'Motivo da Quebra', 'Observações / Responsável']],
          body: pureMovements.map(m => [
            new Date(m.created_at).toLocaleString('pt-BR'),
            (m.eq_equipments as any)?.name || '-',
            (m.eq_equipments as any)?.plate_tag || '-',
            m.movement_type === 'entry' ? 'FUNCIONANDO' : 'QUEBRADO',
            m.movement_type === 'exit' ? getBrokenReasonLabel(m.exit_reason) : 'Retorno à Operação',
            (m.description ? `${m.description} ` : '') + (m.created_by ? `(${m.created_by})` : '')
          ]),
          theme: 'striped',
          headStyles: { fillColor: [220, 38, 38] },
          styles: { fontSize: 8 },
          columnStyles: { 5: { cellWidth: 'auto' } }
        })
      } catch (e) {
        doc.setFontSize(16)
        doc.text('Relatório de Equipamentos Parados e em Operação', 14, 20)
        doc.setFontSize(10)
        doc.text(`Período: ${reportStartDate.split('-').reverse().join('/')} até ${reportEndDate.split('-').reverse().join('/')}`, 14, 28)

        autoTable(doc, {
          startY: 35,
          head: [['Data/Hora', 'Equipamento', 'Tag / Ident.', 'Status', 'Motivo da Quebra', 'Observações / Responsável']],
          body: pureMovements.map(m => [
            new Date(m.created_at).toLocaleString('pt-BR'),
            (m.eq_equipments as any)?.name || '-',
            (m.eq_equipments as any)?.plate_tag || '-',
            m.movement_type === 'entry' ? 'FUNCIONANDO' : 'QUEBRADO',
            m.movement_type === 'exit' ? getBrokenReasonLabel(m.exit_reason) : 'Retorno à Operação',
            (m.description ? `${m.description} ` : '') + (m.created_by ? `(${m.created_by})` : '')
          ]),
          theme: 'striped',
          headStyles: { fillColor: [220, 38, 38] },
          styles: { fontSize: 8 },
          columnStyles: { 5: { cellWidth: 'auto' } }
        })
      }

      doc.save(`relatorio_equipamentos_parados_${reportStartDate}_a_${reportEndDate}.pdf`)
      toast.success('Relatório gerado com sucesso!')
      setIsReportModalOpen(false)
    } catch (err) {
      console.error('Erro ao gerar relatório:', err)
      toast.error('Erro ao gerar relatório.')
    } finally {
      setIsGeneratingReport(false)
    }
  }

  // Filtragem dos equipamentos
  const filteredEquipments = useMemo(() => {
    return equipments.filter(eq => {
      const isBroken = isOutside(eq)

      if (filterStatus === 'Funcionando' && isBroken) return false
      if (filterStatus === 'Quebrado' && !isBroken) return false
      if (filterCategory !== 'Todas as categorias' && eq.category !== filterCategory) return false

      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchName = eq.name?.toLowerCase().includes(query)
        const matchTag = eq.plate_tag?.toLowerCase().includes(query)
        const matchCategory = eq.category?.toLowerCase().includes(query)
        if (!matchName && !matchTag && !matchCategory) return false
      }
      return true
    })
  }, [equipments, filterStatus, filterCategory, searchQuery])

  // Métricas
  const metrics = useMemo(() => {
    let working = 0
    let broken = 0

    equipments.forEach(eq => {
      if (isOutside(eq)) broken++
      else working++
    })

    return {
      total: equipments.length,
      working,
      broken
    }
  }, [equipments])

  const parsedActionDate = (actionDateTime && !isNaN(new Date(actionDateTime).getTime())) ? new Date(actionDateTime) : new Date()
  const actionTimeStr = actionDateTime && actionDateTime.includes('T') ? actionDateTime.split('T')[1].substring(0, 5) : '00:00'

  const updateActionDateTime = (newDate?: Date, newTime?: string) => {
    const d = newDate || parsedActionDate
    let t = newTime !== undefined ? newTime : actionTimeStr
    if (!t) t = '00:00'
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    setActionDateTime(`${year}-${month}-${day}T${t}`)
  }

  return (
    <div className={`flex flex-col min-h-screen ${isDark ? 'bg-transparent text-white' : 'bg-[#faf9f6] text-gray-900'}`}>
      {/* Header */}
      <div className="flex-none p-3 sm:p-5 md:p-6 pb-2 sm:pb-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link
                to="/equipamentos"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors opacity-80 hover:opacity-100"
              >
                <ArrowLeft size={14} /> Voltar aos Equipamentos
              </Link>
            </div>
            <h1
              className="tracking-tight mb-2 flex items-center gap-3 font-semibold"
              style={{ fontSize: 'clamp(22px, 6vw, 42px)' }}
            >
              <PowerOff className="text-red-600 dark:text-red-500 w-8 h-8 sm:w-10 sm:h-10" />
              Equipamento Parado
            </h1>
            <p className="text-sm md:text-base opacity-70">
              Controle de equipamentos funcionando e quebrados. Equipamentos quebrados não contam no RDO principal.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 self-start md:self-auto">
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600/10 text-red-600 dark:bg-red-500/10 dark:text-red-400 border border-red-600/20 rounded-full text-sm font-semibold hover:bg-red-600/20 transition-colors"
            >
              <FileDown size={16} />
              Relatório
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-full text-sm font-medium hover:bg-white dark:hover:bg-white/10 transition-colors"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-3 sm:p-5 md:px-6 pb-6">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">

          {/* Cards de Métricas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`p-3.5 sm:p-4 rounded-xl border flex flex-col justify-between ${isDark ? 'bg-black/20 border-white/10' : 'bg-white/60 border-black/10 backdrop-blur-md shadow-sm'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400 flex items-center gap-1.5">
                  <CheckCircle2 size={16} /> Funcionando
                </span>
                <span className="text-xs opacity-60">Operando na obra</span>
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-green-600 dark:text-green-400">
                {metrics.working}
                <span className="text-sm font-normal opacity-60 ml-2">/ {metrics.total}</span>
              </div>
            </div>

            <div className={`p-3.5 sm:p-4 rounded-xl border flex flex-col justify-between ${isDark ? 'bg-black/20 border-white/10' : 'bg-white/60 border-black/10 backdrop-blur-md shadow-sm'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <TriangleAlert size={16} /> Quebrado / Parado
                </span>
                <span className="text-xs opacity-60">Sem operação</span>
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-red-600 dark:text-red-400">
                {metrics.broken}
                <span className="text-sm font-normal opacity-60 ml-2">/ {metrics.total}</span>
              </div>
            </div>

            <div className={`p-3.5 sm:p-4 rounded-xl border flex flex-col justify-between ${isDark ? 'bg-black/20 border-white/10' : 'bg-white/60 border-black/10 backdrop-blur-md shadow-sm'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider opacity-60 flex items-center gap-1.5">
                  <Wrench size={16} /> Total de Equipamentos
                </span>
                <span className="text-xs opacity-60">Cadastrados</span>
              </div>
              <div className="text-3xl sm:text-4xl font-bold">
                {metrics.total}
              </div>
            </div>
          </div>

          {/* Filtros e Busca */}
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" size={18} />
              <input
                type="text"
                placeholder="Buscar equipamento, tag ou categoria..."
                className={`w-full border rounded-xl pl-10 pr-3 py-2 text-xs sm:text-sm outline-none transition-all ${isDark ? 'bg-white/5 border-white/10 focus:border-white/30 placeholder:text-white/30' : 'bg-white/45 border-black/10 focus:border-black/30 placeholder:text-black/30'}`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="relative">
              <button
                onClick={() => { setShowCategoryMenu(!showCategoryMenu); setShowFilterMenu(false) }}
                className={`border px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors w-full md:w-auto ${filterCategory !== 'Todas as categorias' ? 'bg-red-600 text-white border-red-600' : isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white/45 border-black/10 hover:bg-white'}`}
              >
                <Filter size={18} /> <span>{filterCategory === 'Todas as categorias' ? 'Categoria' : filterCategory}</span>
              </button>
              {showCategoryMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowCategoryMenu(false)} />
                  <div className={`absolute right-0 top-full mt-2 w-48 rounded-xl shadow-xl border z-50 overflow-hidden py-1 ${isDark ? 'bg-[#1a1a1b] border-white/10' : 'bg-white border-black/10'}`}>
                    {['Todas as categorias', 'Jardinagem', 'Canteiro', 'Leve', 'Equipamento Pesado'].map(f => (
                      <button
                        key={f}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${filterCategory === f ? 'font-bold bg-black/5 dark:bg-white/5' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                        onClick={() => { setFilterCategory(f); setShowCategoryMenu(false) }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="relative">
              <button
                onClick={() => { setShowFilterMenu(!showFilterMenu); setShowCategoryMenu(false) }}
                className={`border px-5 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors w-full md:w-auto ${filterStatus !== 'Todos' ? 'bg-red-600 text-white border-red-600' : isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white/45 border-black/10 hover:bg-white'}`}
              >
                <Filter size={18} /> <span>{filterStatus === 'Todos' ? 'Status' : filterStatus}</span>
              </button>
              {showFilterMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFilterMenu(false)} />
                  <div className={`absolute right-0 top-full mt-2 w-48 rounded-xl shadow-xl border z-50 overflow-hidden py-1 ${isDark ? 'bg-[#1a1a1b] border-white/10' : 'bg-white border-black/10'}`}>
                    {['Todos', 'Funcionando', 'Quebrado'].map(f => (
                      <button
                        key={f}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${filterStatus === f ? 'font-bold bg-black/5 dark:bg-white/5' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                        onClick={() => { setFilterStatus(f); setShowFilterMenu(false) }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Lista de Equipamentos */}
          <div className={`flex flex-col rounded-2xl border overflow-hidden transition-colors ${isDark ? 'bg-black/20 border-white/10' : 'bg-white/45 border-black/10 backdrop-blur-md'}`}>
            {loading && !equipments.length ? (
              <div className="flex-1 flex flex-col gap-4 p-6">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className={`h-16 rounded-xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-black/5'}`} />
                ))}
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <AlertCircle size={48} className="text-red-500 mb-4 opacity-80" />
                <h3 className="text-xl mb-2">{error}</h3>
                <button onClick={handleRefresh} className="px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full font-medium text-sm">
                  Tentar novamente
                </button>
              </div>
            ) : filteredEquipments.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-50">
                <Wrench size={48} className="mb-4" />
                <h3 className="text-xl">Nenhum equipamento encontrado.</h3>
              </div>
            ) : (
              <>
                {/* Tabela Desktop Otimizada (Encaixe Fluido em Qualquer Resolução, Sem Scroll Horizontal) */}
                <div className="hidden md:block w-full overflow-hidden">
                  <table className="w-full table-fixed text-left text-xs">
                    <colgroup>
                      <col className="w-[24%]" />
                      <col className="w-[12%]" />
                      <col className="w-[14%]" />
                      <col className="w-[20%]" />
                      <col className="w-[16%]" />
                      <col className="w-[14%]" />
                    </colgroup>
                    <thead className={`border-b font-bold tracking-wider text-[11px] uppercase select-none ${isDark ? 'bg-white/5 border-white/10 text-white/70' : 'bg-black/5 border-black/10 text-black/60'}`}>
                      <tr>
                        <th className="py-2.5 px-2.5 sm:px-3">EQUIPAMENTO</th>
                        <th className="py-2.5 px-2 sm:px-2.5">TAG / IDENT.</th>
                        <th className="py-2.5 px-2 sm:px-2.5">CATEGORIA</th>
                        <th className="py-2.5 px-2 sm:px-2.5">STATUS</th>
                        <th className="py-2.5 px-2 sm:px-2.5">DATA DO STATUS</th>
                        <th className="py-2.5 px-2 sm:px-3 text-right">AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y text-xs ${isDark ? 'divide-white/5' : 'divide-black/5'}`}>
                      {filteredEquipments.map(eq => {
                        const isBroken = isOutside(eq)
                        return (
                          <tr key={eq.id} className={`transition-colors group ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}>
                            {/* 1. EQUIPAMENTO */}
                            <td className="py-2 px-2.5 sm:px-3">
                              <div className="flex items-center gap-2 min-w-0">
                                {isBroken ? (
                                  <span className="w-2 h-2 shrink-0 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
                                ) : (
                                  <span className="w-2 h-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                                )}
                                <span
                                  className="font-bold text-xs sm:text-[13px] tracking-tight truncate block text-gray-900 dark:text-white"
                                  title={eq.name}
                                >
                                  {eq.name}
                                </span>
                              </div>
                            </td>

                            {/* 2. TAG / IDENTIFICAÇÃO */}
                            <td className="py-2 px-2 sm:px-2.5 font-mono text-[11px] font-semibold tracking-wider uppercase opacity-80">
                              <span className="truncate block" title={eq.plate_tag ? eq.plate_tag.toUpperCase() : '-'}>
                                {eq.plate_tag ? eq.plate_tag.toUpperCase() : '-'}
                              </span>
                            </td>

                            {/* 3. CATEGORIA */}
                            <td className="py-2 px-2 sm:px-2.5 opacity-75">
                              <span className="truncate block" title={eq.category || '-'}>
                                {eq.category || '-'}
                              </span>
                            </td>

                            {/* 4. STATUS COMPACTO */}
                            <td className="py-2 px-2 sm:px-2.5">
                              <div className="relative group/tooltip inline-flex flex-col min-w-0 max-w-full">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold max-w-full truncate shadow-sm ${
                                    !isBroken
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                                      : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300'
                                  }`}
                                >
                                  {!isBroken ? (
                                    <>
                                      <CheckCircle2 size={12} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                                      <span className="truncate">Funcionando</span>
                                    </>
                                  ) : (
                                    <>
                                      <TriangleAlert size={12} className="shrink-0 text-red-600 dark:text-red-400" />
                                      <span className="truncate">Quebrado</span>
                                    </>
                                  )}
                                </span>
                                {isBroken && eq.last_exit_reason && (
                                  <span
                                    className="text-[10px] text-red-600 dark:text-red-400 font-medium truncate mt-0.5 block max-w-[150px]"
                                    title={getBrokenReasonLabel(eq.last_exit_reason)}
                                  >
                                    {getBrokenReasonLabel(eq.last_exit_reason)}
                                  </span>
                                )}
                                {isBroken && eq.last_exit_description && (
                                  <div className="absolute bottom-full left-0 mb-2 w-56 p-2 bg-gray-950 text-white text-[11px] rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-20 shadow-2xl pointer-events-none border border-white/10">
                                    <div className="font-bold mb-0.5 opacity-60 text-[9px] uppercase tracking-wider">Defeito relatado</div>
                                    <div className="leading-tight">{eq.last_exit_description}</div>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* 5. DATA DO STATUS */}
                            <td className="py-2 px-2 sm:px-2.5 text-[11px] leading-tight">
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <div className="flex items-center gap-1">
                                  <Clock size={11} className="shrink-0 opacity-50" />
                                  {isBroken ? (
                                    <span className="text-red-600 dark:text-red-400 font-bold truncate">
                                      Quebrou
                                    </span>
                                  ) : (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold truncate">
                                      Operando
                                    </span>
                                  )}
                                </div>
                                <span className="opacity-70 font-mono text-[10px] sm:text-[11px] truncate block">
                                  {formatCompactDate(eq.updated_at)}
                                </span>
                              </div>
                            </td>

                            {/* 6. AÇÕES */}
                            <td className="py-2 px-2.5 sm:px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenHistory(eq)}
                                  className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                                    isDark ? 'hover:bg-white/10 text-white/70 hover:text-white' : 'hover:bg-black/10 text-black/70 hover:text-black'
                                  }`}
                                  title="Ver histórico de movimentações deste equipamento"
                                >
                                  <History size={15} />
                                </button>
                                {!isBroken ? (
                                  <button
                                    onClick={() => handleOpenMarkBroken(eq)}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[11px] tracking-wide transition-all shadow-sm active:scale-95 shrink-0"
                                    title="Marcar equipamento como quebrado / fora de operação"
                                  >
                                    <TriangleAlert size={12} />
                                    <span>Parar</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleOpenMarkWorking(eq)}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] tracking-wide transition-all shadow-sm active:scale-95 shrink-0"
                                    title="Marcar equipamento como funcionando / operando"
                                  >
                                    <Play size={12} />
                                    <span>Liberar</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Cards Mobile (< 768px) Otimizados e Compactos */}
                <div className="md:hidden flex flex-col gap-2.5 p-3">
                  {filteredEquipments.map(eq => {
                    const isBroken = isOutside(eq)
                    return (
                      <div key={eq.id} className={`w-full p-3 rounded-xl border flex flex-col gap-2.5 ${isDark ? 'bg-[#1a1a1b] border-white/10' : 'bg-white border-black/10 shadow-sm'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {isBroken ? (
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                              )}
                              <h3 className="font-bold text-sm sm:text-base truncate">{eq.name}</h3>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-[11px] font-semibold tracking-wider uppercase opacity-70">
                                Tag: {eq.plate_tag ? eq.plate_tag.toUpperCase() : 'S/ Tag'}
                              </span>
                              <span className="opacity-40">•</span>
                              <span className="text-[11px] opacity-70 truncate">{eq.category || 'Sem categoria'}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleOpenHistory(eq)}
                            className="p-1.5 bg-black/5 dark:bg-white/5 rounded-lg opacity-70 hover:opacity-100 shrink-0"
                            title="Histórico"
                          >
                            <History size={16} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-black/5 dark:border-white/5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            !isBroken
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300'
                          }`}>
                            {!isBroken ? (
                              <>
                                <CheckCircle2 size={12} /> Funcionando
                              </>
                            ) : (
                              <>
                                <TriangleAlert size={12} /> Quebrado
                              </>
                            )}
                          </span>
                          <span className="text-[10px] opacity-70 font-mono flex items-center gap-1">
                            <Clock size={11} /> {formatCompactDate(eq.updated_at)}
                          </span>
                        </div>

                        {isBroken && eq.last_exit_reason && (
                          <div className="text-[11px] bg-red-500/10 text-red-600 dark:text-red-400 p-2 rounded-lg border border-red-500/20">
                            <div className="font-semibold">{getBrokenReasonLabel(eq.last_exit_reason)}</div>
                            {eq.last_exit_description && (
                              <div className="opacity-80 text-[10px] mt-0.5 leading-tight">{eq.last_exit_description}</div>
                            )}
                          </div>
                        )}

                        <div className="pt-1">
                          {!isBroken ? (
                            <button
                              onClick={() => handleOpenMarkBroken(eq)}
                              className="w-full flex justify-center items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg font-bold text-xs hover:bg-red-700 transition-colors active:scale-98 shadow-sm"
                            >
                              <TriangleAlert size={14} /> Marcar como Quebrado
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenMarkWorking(eq)}
                              className="w-full flex justify-center items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs hover:bg-emerald-700 transition-colors active:scale-98 shadow-sm"
                            >
                              <Play size={14} /> Marcar como Funcionando
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal Marcar Quebrado */}
      {isBrokenModalOpen && selectedEq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isSaving && setIsBrokenModalOpen(false)} />
          <div className={`relative w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl max-h-[calc(100dvh-24px)] overflow-y-auto ${isDark ? 'bg-[#101014] text-white border border-white/10' : 'bg-white text-black'}`}>
            <div className="flex items-center gap-3 mb-6 text-red-600">
              <TriangleAlert size={28} />
              <h2 className="text-2xl font-bold">Marcar como Quebrado</h2>
            </div>

            <div className="mb-6 p-4 rounded-2xl bg-black/5 dark:bg-white/5 flex flex-col gap-1">
              <span className="text-xs opacity-50 uppercase font-semibold">Equipamento</span>
              <span className="font-bold text-lg">{selectedEq.name}</span>
              <span className="text-xs opacity-70 font-mono">Tag / Identificação: {selectedEq.plate_tag || 'S/ Tag'}</span>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold opacity-70 mb-1">DATA E HORA DA QUEBRA</label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'flex-1 flex items-center justify-between px-3 py-2 border rounded-xl font-medium text-sm',
                          isDark ? 'border-white/10 bg-white/5 text-white' : 'border-black/10 bg-black/5 text-black'
                        )}
                      >
                        <span>{format(parsedActionDate, 'dd/MM/yyyy')}</span>
                        <Calendar size={16} className="opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarUI
                        mode="single"
                        selected={parsedActionDate}
                        onSelect={(date) => {
                          if (date) updateActionDateTime(date)
                        }}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <input
                    type="time"
                    value={actionTimeStr}
                    onChange={(e) => updateActionDateTime(undefined, e.target.value)}
                    className={cn(
                      'w-28 px-3 py-2 border rounded-xl font-medium text-sm outline-none',
                      isDark ? 'border-white/10 bg-white/5 text-white' : 'border-black/10 bg-black/5 text-black'
                    )}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold opacity-70 mb-1">MOTIVO DO DEFEITO / QUEBRA</label>
                <select
                  value={brokenReason}
                  onChange={(e) => setBrokenReason(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-3 outline-none text-sm font-medium ${isDark ? 'bg-[#1a1a1b] border-white/10' : 'bg-black/5 border-black/10'}`}
                >
                  {BROKEN_REASONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold opacity-70 mb-1">DESCRIÇÃO DO DEFEITO / OBSERVAÇÕES</label>
                <textarea
                  rows={3}
                  placeholder="Descreva o que quebrou ou os sintomas do problema..."
                  value={brokenDescription}
                  onChange={(e) => setBrokenDescription(e.target.value)}
                  className={`w-full border rounded-xl p-3 outline-none text-sm resize-none ${isDark ? 'bg-[#1a1a1b] border-white/10' : 'bg-black/5 border-black/10'}`}
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                ⚠️ Este equipamento não será contabilizado na lista de operando no RDO principal enquanto estiver quebrado.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={() => setIsBrokenModalOpen(false)}
                disabled={isSaving}
                className={`px-5 py-2.5 rounded-full font-semibold text-sm transition-colors ${isDark ? 'hover:bg-white/10 text-white/70' : 'hover:bg-black/5 text-black/70'}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmBroken}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-full font-semibold text-sm hover:bg-red-700 transition-colors shadow-lg active:scale-95 disabled:opacity-50"
              >
                {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <TriangleAlert size={16} />}
                Confirmar Quebra
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Marcar Funcionando */}
      {isWorkingModalOpen && selectedEq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isSaving && setIsWorkingModalOpen(false)} />
          <div className={`relative w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl max-h-[calc(100dvh-24px)] overflow-y-auto ${isDark ? 'bg-[#101014] text-white border border-white/10' : 'bg-white text-black'}`}>
            <div className="flex items-center gap-3 mb-6 text-green-600">
              <CheckCircle2 size={28} />
              <h2 className="text-2xl font-bold">Marcar como Funcionando</h2>
            </div>

            <div className="mb-6 p-4 rounded-2xl bg-black/5 dark:bg-white/5 flex flex-col gap-1">
              <span className="text-xs opacity-50 uppercase font-semibold">Equipamento</span>
              <span className="font-bold text-lg">{selectedEq.name}</span>
              <span className="text-xs opacity-70 font-mono">Tag / Identificação: {selectedEq.plate_tag || 'S/ Tag'}</span>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold opacity-70 mb-1">DATA E HORA DO RETORNO À OPERAÇÃO</label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'flex-1 flex items-center justify-between px-3 py-2 border rounded-xl font-medium text-sm',
                          isDark ? 'border-white/10 bg-white/5 text-white' : 'border-black/10 bg-black/5 text-black'
                        )}
                      >
                        <span>{format(parsedActionDate, 'dd/MM/yyyy')}</span>
                        <Calendar size={16} className="opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarUI
                        mode="single"
                        selected={parsedActionDate}
                        onSelect={(date) => {
                          if (date) updateActionDateTime(date)
                        }}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <input
                    type="time"
                    value={actionTimeStr}
                    onChange={(e) => updateActionDateTime(undefined, e.target.value)}
                    className={cn(
                      'w-28 px-3 py-2 border rounded-xl font-medium text-sm outline-none',
                      isDark ? 'border-white/10 bg-white/5 text-white' : 'border-black/10 bg-black/5 text-black'
                    )}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold opacity-70 mb-1">OBSERVAÇÕES DO CONSERTO / REPARO (OPCIONAL)</label>
                <textarea
                  rows={3}
                  placeholder="Informe o que foi consertado, peças trocadas ou observações..."
                  value={workingDescription}
                  onChange={(e) => setWorkingDescription(e.target.value)}
                  className={`w-full border rounded-xl p-3 outline-none text-sm resize-none ${isDark ? 'bg-[#1a1a1b] border-white/10' : 'bg-black/5 border-black/10'}`}
                />
              </div>

              <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-xs text-green-700 dark:text-green-400">
                ✅ O equipamento voltará a constar como operando no RDO principal.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={() => setIsWorkingModalOpen(false)}
                disabled={isSaving}
                className={`px-5 py-2.5 rounded-full font-semibold text-sm transition-colors ${isDark ? 'hover:bg-white/10 text-white/70' : 'hover:bg-black/5 text-black/70'}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmWorking}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-full font-semibold text-sm hover:bg-green-700 transition-colors shadow-lg active:scale-95 disabled:opacity-50"
              >
                {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                Confirmar Funcionando
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Histórico */}
      {isHistoryModalOpen && selectedEq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsHistoryModalOpen(false)} />
          <div className={`relative w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col max-h-[85vh] ${isDark ? 'bg-[#101014] text-white border border-white/10' : 'bg-white text-black'}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <History size={20} /> Histórico de Paradas e Retornos
                </h2>
                <div className="text-xs opacity-70 mt-1 font-mono">{selectedEq.name} ({selectedEq.plate_tag || 'S/ Tag'})</div>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-sm font-bold opacity-70 hover:opacity-100"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 my-4 flex flex-col gap-3">
              {loadingHistory ? (
                <div className="flex flex-col gap-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className={`h-16 rounded-xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-black/5'}`} />
                  ))}
                </div>
              ) : eqHistory.length === 0 ? (
                <div className="py-8 text-center opacity-50 text-sm">
                  Nenhum registro de quebra ou funcionamento encontrado para este equipamento.
                </div>
              ) : (
                eqHistory.map(m => {
                  const isBrokenEvent = m.movement_type === 'exit'
                  return (
                    <div
                      key={m.id}
                      className={`p-3.5 rounded-2xl border flex flex-col gap-1 text-sm ${isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${!isBrokenEvent ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>
                          {!isBrokenEvent ? 'FUNCIONANDO' : 'QUEBRADO'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] opacity-60">
                            {new Date(m.created_at).toLocaleString('pt-BR')}
                          </span>
                          <button
                            onClick={() => handleDeleteMovement(m.id)}
                            disabled={deletingMovId === m.id}
                            className="p-1 rounded text-red-500 hover:bg-red-500/10 transition-colors"
                            title="Excluir movimentação"
                          >
                            <Trash2 size={13} className={deletingMovId === m.id ? 'animate-spin' : ''} />
                          </button>
                        </div>
                      </div>

                      {isBrokenEvent && m.exit_reason && (
                        <div className="font-semibold text-xs text-red-600 dark:text-red-400 mt-1">
                          Motivo: {getBrokenReasonLabel(m.exit_reason)}
                        </div>
                      )}

                      {m.description && (
                        <div className="text-xs opacity-80 mt-0.5 whitespace-pre-wrap">
                          {m.description}
                        </div>
                      )}

                      {m.created_by && (
                        <div className="text-[10px] opacity-50 mt-1">
                          Registrado por: {m.created_by}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-black/10 dark:border-white/10">
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className={`px-5 py-2 rounded-full font-medium text-sm ${isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-black/5 text-black hover:bg-black/10'}`}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Relatório PDF */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isGeneratingReport && setIsReportModalOpen(false)} />
          <div className={`relative w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl ${isDark ? 'bg-[#101014] text-white border border-white/10' : 'bg-white text-black'}`}>
            <div className="flex items-center gap-3 mb-6 text-red-600">
              <FileDown size={28} />
              <h2 className="text-2xl font-bold">Relatório de Equipamentos</h2>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold opacity-70 mb-1">DATA INICIAL</label>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-3 outline-none text-sm font-medium ${isDark ? 'bg-[#1a1a1b] border-white/10' : 'bg-black/5 border-black/10'}`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold opacity-70 mb-1">DATA FINAL</label>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-3 outline-none text-sm font-medium ${isDark ? 'bg-[#1a1a1b] border-white/10' : 'bg-black/5 border-black/10'}`}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                disabled={isGeneratingReport}
                className={`px-5 py-2.5 rounded-full font-semibold text-sm transition-colors ${isDark ? 'hover:bg-white/10 text-white/70' : 'hover:bg-black/5 text-black/70'}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={generatePDFReport}
                disabled={isGeneratingReport}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-full font-semibold text-sm hover:bg-red-700 transition-colors shadow-lg active:scale-95 disabled:opacity-50"
              >
                {isGeneratingReport ? <RefreshCw size={16} className="animate-spin" /> : <FileDown size={16} />}
                Gerar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
