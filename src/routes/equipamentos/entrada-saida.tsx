import Search from 'lucide-react/dist/esm/icons/search.js';
import Filter from 'lucide-react/dist/esm/icons/funnel.js';
import ArrowRightToLine from 'lucide-react/dist/esm/icons/arrow-right-to-line.js';
import ArrowRightFromLine from 'lucide-react/dist/esm/icons/arrow-right-from-line.js';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw.js';
import AlertCircle from 'lucide-react/dist/esm/icons/circle-alert.js';
import History from 'lucide-react/dist/esm/icons/history.js';
import Clock from 'lucide-react/dist/esm/icons/clock.js';
import LogIn from 'lucide-react/dist/esm/icons/log-in.js';
import LogOut from 'lucide-react/dist/esm/icons/log-out.js';
import Info from 'lucide-react/dist/esm/icons/info.js';
import Truck from 'lucide-react/dist/esm/icons/truck.js';
import FileDown from 'lucide-react/dist/esm/icons/file-down.js';
import Calendar from 'lucide-react/dist/esm/icons/calendar.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import Zap from 'lucide-react/dist/esm/icons/zap.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import { createFileRoute, Link } from '@tanstack/react-router'
import { createPortal } from 'react-dom'
import { DateInput } from '@/components/ui/DateInput'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../contexts/ThemeContext'
import { toast } from 'sonner' // Assuming sonner is the toast library used
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover'
import { Calendar as CalendarUI } from '../../components/ui/calendar'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '../../lib/utils'
import { getWhatsappSettings } from '../../lib/settings'
import { sendWhatsappTextOnServer } from '@/lib/whatsapp-api'
import { sendEntryExitWhatsappNotification } from '@/lib/whatsappHelpers'
import { isOutside, locationFromMovements, MovementRecord, EXIT_REASONS as LOCATION_EXIT_REASONS } from '@/lib/equipamentos/locationStatus'
import { getAuthenticatedUserName } from '@/lib/authHelpers'
import {
  GeradorHorimetroData,
  getGeradorHorimetro,
  calcHorasRestantes,
  getStatusGerador,
  GERADOR_HORIMETRO_UPDATED_EVENT
} from '../../lib/geradorHorimetro'
import { GeradorHorimetroModal } from '../../components/GeradorHorimetroModal'

// EXIT_REASONS passou a ter fonte única em @/lib/equipamentos/locationStatus.
const EXIT_REASONS = LOCATION_EXIT_REASONS as unknown as Array<{ value: string; label: string }>

export const Route = createFileRoute('/equipamentos/entrada-saida')({
  component: EntradaSaidaPage,
})

interface Equipment {
  id: string
  name: string
  plate_tag: string
  category?: string
  location_status?: 'inside' | 'outside' | null // Cache derivado de eq_movements pelo trigger
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

function EntradaSaidaPage() {
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
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false)
  const [isExitModalOpen, setIsExitModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [isGeradorModalOpen, setIsGeradorModalOpen] = useState(false)
  const [geradorData, setGeradorData] = useState<GeradorHorimetroData | null>(null)

  // Report Modal
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [reportStartDate, setReportStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [reportEndDate, setReportEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  
  // Global History Modal
  const [isGlobalHistoryOpen, setIsGlobalHistoryOpen] = useState(false)
  const [globalHistoryMovements, setGlobalHistoryMovements] = useState<any[]>([])
  const [loadingGlobalHistory, setLoadingGlobalHistory] = useState(false)
  const [globalHistoryStartDate, setGlobalHistoryStartDate] = useState<string>('')
  const [globalHistoryEndDate, setGlobalHistoryEndDate] = useState<string>('')
  const [globalHistoryType, setGlobalHistoryType] = useState<'all' | 'entry' | 'exit'>('all')
  const [globalHistorySearch, setGlobalHistorySearch] = useState<string>('')
  const [deletingGlobalMovId, setDeletingGlobalMovId] = useState<string | null>(null)

  const [eqHistory, setEqHistory] = useState<Movement[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [deletingMovId, setDeletingMovId] = useState<string | null>(null)

  // Exit Form
  const [exitReason, setExitReason] = useState('')
  const [exitDescription, setExitDescription] = useState('')
  const [actionDateTime, setActionDateTime] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const getLocalDatetime = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  }

  const fetchEquipments = async () => {
    try {
      setError(null)
      if (!isRefreshing) setLoading(true)
      
      const currentEnv = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'

      const [eqRes, movRes] = await Promise.all([
        supabase
          .from('eq_equipments')
          .select('id, name, plate_tag, category, type, location_status, environment, updated_at, last_exit_reason, last_exit_description')
          .eq('environment', currentEnv)
          .order('name', { ascending: true }),
        supabase
          .from('eq_movements')
          .select('id, equipment_id, movement_type, exit_reason, description, created_at, created_by')
          .order('created_at', { ascending: false })
          .limit(500)
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

      const reconciledEquipments = (eqRes.data || []).map(eq => {
        const movements = movementsByEq.get(eq.id) || []
        const lastMov = movements[0]
        
        // REGRA DE OURO:
        // Só está 'outside' se houver um registro de movimento do tipo 'exit'.
        // Sem movimento de saída => 'inside' (Dentro da Obra).
        const derivedStatus = locationFromMovements(movements) ?? 'inside'
        const derivedReason = derivedStatus === 'outside' ? (lastMov?.exit_reason || eq.last_exit_reason) : null
        const derivedDesc = derivedStatus === 'outside' ? (lastMov?.description || eq.last_exit_description) : null

        // Auto-reconcilia o cache na tabela eq_equipments se estiver divergente
        if (eq.location_status !== derivedStatus || (eq.last_exit_reason || null) !== (derivedReason || null)) {
          supabase
            .from('eq_equipments')
            .update({
              location_status: derivedStatus,
              last_exit_reason: derivedReason,
              last_exit_description: derivedDesc
            })
            .eq('id', eq.id)
            .then()
        }

        return {
          ...eq,
          location_status: derivedStatus,
          last_exit_reason: derivedReason,
          last_exit_description: derivedDesc
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
    getGeradorHorimetro().then(setGeradorData).catch(console.error)

    const handleHoriUpdate = (e: any) => {
      if (e?.detail) setGeradorData(e.detail)
    }
    window.addEventListener(GERADOR_HORIMETRO_UPDATED_EVENT, handleHoriUpdate)

    const subscription = supabase
      .channel('eq_equipments_changes_es')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eq_equipments' }, () => {
        fetchEquipments()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eq_movements' }, () => {
        fetchEquipments()
      })
      .subscribe()

    return () => {
      window.removeEventListener(GERADOR_HORIMETRO_UPDATED_EVENT, handleHoriUpdate)
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving && !isGeneratingReport) {
        setIsEntryModalOpen(false)
        setIsExitModalOpen(false)
        setIsHistoryModalOpen(false)
        setIsReportModalOpen(false)
        setIsGlobalHistoryOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSaving, isGeneratingReport])

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchEquipments()
  }

  const handleOpenEntry = (eq: Equipment) => {
    setSelectedEq(eq)
    setActionDateTime(getLocalDatetime())
    setIsEntryModalOpen(true)
  }

  const handleOpenExit = (eq: Equipment) => {
    setSelectedEq(eq)
    setExitReason('')
    setExitDescription('')
    setActionDateTime(getLocalDatetime())
    setIsExitModalOpen(true)
  }

  const handleOpenHistory = async (eq: Equipment) => {
    setSelectedEq(eq)
    setIsHistoryModalOpen(true)
    setLoadingHistory(true)
    try {
      const { data, error } = await supabase
        .from('eq_movements').select('id, equipment_id, movement_type, exit_reason, description, created_by, created_at').eq('environment', typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena')
        .eq('equipment_id', eq.id)
        .order('created_at', { ascending: false })
        .limit(20)
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
    const confirmDelete = window.confirm('Deseja realmente excluir este registro de movimentação?')
    if (!confirmDelete) return

    setDeletingMovId(movId)
    try {
      const { error: delError } = await supabase
        .from('eq_movements')
        .delete()
        .eq('id', movId)

      if (delError) throw delError

      // Buscar histórico remanescente
      const { data: remainingMovs, error: remError } = await supabase
        .from('eq_movements')
        .select('id, equipment_id, movement_type, exit_reason, description, created_by, created_at')
        .eq('equipment_id', selectedEq.id)
        .order('created_at', { ascending: false })

      if (remError) throw remError

      const updatedHistory = remainingMovs || []
      setEqHistory(updatedHistory)

      // Recalcular localização do equipamento
      const newStatus = locationFromMovements(updatedHistory) ?? 'inside'
      const lastMov = updatedHistory[0]
      const newReason = newStatus === 'outside' ? (lastMov?.exit_reason || null) : null
      const newDesc = newStatus === 'outside' ? (lastMov?.description || null) : null

      const { error: updateError } = await supabase
        .from('eq_equipments')
        .update({
          location_status: newStatus,
          last_exit_reason: newReason,
          last_exit_description: newDesc,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedEq.id)

      if (updateError) console.error('Erro ao atualizar eq_equipments:', updateError)

      setSelectedEq(prev => prev ? {
        ...prev,
        location_status: newStatus,
        last_exit_reason: newReason,
        last_exit_description: newDesc
      } : null)

      fetchEquipments()
      toast.success('Movimentação excluída e status recalculado com sucesso!')
    } catch (err: any) {
      console.error('Erro ao excluir movimentação:', err)
      toast.error('Erro ao excluir movimentação: ' + (err.message || 'Erro desconhecido'))
    } finally {
      setDeletingMovId(null)
    }
  }

  // Histórico Geral de todos os equipamentos
  const fetchGlobalHistory = async (start?: string, end?: string) => {
    setLoadingGlobalHistory(true)
    try {
      const currentEnv = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
      let query = supabase
        .from('eq_movements')
        .select(`
          id,
          equipment_id,
          movement_type,
          exit_reason,
          description,
          created_by,
          created_at,
          environment,
          eq_equipments (
            id,
            name,
            plate_tag,
            category
          )
        `)
        .order('created_at', { ascending: false })

      if (currentEnv) {
        query = query.eq('environment', currentEnv)
      }

      if (start) {
        query = query.gte('created_at', `${start}T00:00:00`)
      }
      if (end) {
        query = query.lte('created_at', `${end}T23:59:59`)
      }

      if (!start && !end) {
        query = query.limit(150)
      }

      const { data, error } = await query
      if (error) throw error
      setGlobalHistoryMovements(data || [])
    } catch (err: any) {
      console.error('Erro ao buscar histórico geral:', err)
      toast.error('Erro ao carregar histórico geral: ' + (err.message || 'Erro desconhecido'))
    } finally {
      setLoadingGlobalHistory(false)
    }
  }

  const handleOpenGlobalHistory = () => {
    setIsGlobalHistoryOpen(true)
    fetchGlobalHistory(globalHistoryStartDate, globalHistoryEndDate)
  }

  const handleApplyQuickDate = (days?: number) => {
    if (days === undefined) {
      setGlobalHistoryStartDate('')
      setGlobalHistoryEndDate('')
      fetchGlobalHistory('', '')
      return
    }
    const end = new Date()
    const start = new Date()
    if (days > 0) {
      start.setDate(end.getDate() - days)
    }
    const endStr = end.toISOString().split('T')[0]
    const startStr = start.toISOString().split('T')[0]
    setGlobalHistoryStartDate(startStr)
    setGlobalHistoryEndDate(endStr)
    fetchGlobalHistory(startStr, endStr)
  }

  const handleDeleteGlobalMovement = async (mov: any) => {
    const eq = Array.isArray(mov.eq_equipments) ? mov.eq_equipments[0] : mov.eq_equipments
    const eqName = eq?.name || 'Equipamento'
    const confirmDelete = window.confirm(`Deseja realmente excluir esta movimentação de "${eqName}"?`)
    if (!confirmDelete) return

    setDeletingGlobalMovId(mov.id)
    try {
      const { error: delError } = await supabase
        .from('eq_movements')
        .delete()
        .eq('id', mov.id)

      if (delError) throw delError

      setGlobalHistoryMovements(prev => prev.filter(m => m.id !== mov.id))

      if (mov.equipment_id) {
        const { data: remainingMovs } = await supabase
          .from('eq_movements')
          .select('id, equipment_id, movement_type, exit_reason, description, created_by, created_at')
          .eq('equipment_id', mov.equipment_id)
          .order('created_at', { ascending: false })

        const updatedHistory = remainingMovs || []
        const newStatus = locationFromMovements(updatedHistory) ?? 'inside'
        const lastMov = updatedHistory[0]
        const newReason = newStatus === 'outside' ? (lastMov?.exit_reason || null) : null
        const newDesc = newStatus === 'outside' ? (lastMov?.description || null) : null

        await supabase
          .from('eq_equipments')
          .update({
            location_status: newStatus,
            last_exit_reason: newReason,
            last_exit_description: newDesc,
            updated_at: new Date().toISOString()
          })
          .eq('id', mov.equipment_id)
      }

      fetchEquipments()
      toast.success('Movimentação excluída e status recalculado com sucesso!')
    } catch (err: any) {
      console.error('Erro ao excluir movimentação:', err)
      toast.error('Erro ao excluir movimentação: ' + (err.message || 'Erro desconhecido'))
    } finally {
      setDeletingGlobalMovId(null)
    }
  }

  const filteredGlobalHistory = useMemo(() => {
    return globalHistoryMovements.filter(mov => {
      if (globalHistoryType !== 'all' && mov.movement_type !== globalHistoryType) {
        return false
      }
      if (globalHistorySearch.trim()) {
        const q = globalHistorySearch.toLowerCase()
        const eq = Array.isArray(mov.eq_equipments) ? mov.eq_equipments[0] : mov.eq_equipments
        const eqName = (eq?.name || '').toLowerCase()
        const eqPlate = (eq?.plate_tag || '').toLowerCase()
        const eqCat = (eq?.category || '').toLowerCase()
        const reason = (mov.exit_reason || '').toLowerCase()
        const desc = (mov.description || '').toLowerCase()
        const user = (mov.created_by || '').toLowerCase()

        const matches =
          eqName.includes(q) ||
          eqPlate.includes(q) ||
          eqCat.includes(q) ||
          reason.includes(q) ||
          desc.includes(q) ||
          user.includes(q)

        if (!matches) return false
      }
      return true
    })
  }, [globalHistoryMovements, globalHistoryType, globalHistorySearch])

  const getUserName = async () => {
    return await getAuthenticatedUserName()
  }

  const handleConfirmEntry = async () => {
    if (!selectedEq) return
    setIsSaving(true)
    try {
      // Fonte de verdade: o último movimento registrado em eq_movements
      const { data: lastMovements } = await supabase
        .from('eq_movements')
        .select('movement_type, created_at')
        .eq('equipment_id', selectedEq.id)
        .order('created_at', { ascending: false })
        .limit(1)

      const lastMovement = lastMovements?.[0]
      if (lastMovement?.movement_type === 'entry' || (!lastMovement && selectedEq.location_status === 'inside')) {
        toast.error('Este equipamento já está dentro da obra. Atualize a página.')
        setIsEntryModalOpen(false)
        fetchEquipments()
        return
      }

      const userName = await getUserName()

      // Registra a movimentação em eq_movements
      const { error: moveError } = await supabase
        .from('eq_movements')
        .insert({
          equipment_id: selectedEq.id,
          movement_type: 'entry',
          created_by: userName,
          created_at: new Date(actionDateTime).toISOString(),
          environment: typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
        })

      if (moveError) throw moveError

      const timestamp = new Date(actionDateTime).toISOString()
      const payload = {
        equipment_id: selectedEq.id,
        movement_type: 'entry',
        created_by: userName,
        created_at: timestamp
      };

      // Atualiza o equipamento para 'inside', limpando motivos de saída
      const { error: touchError } = await supabase
        .from('eq_equipments')
        .update({
          location_status: 'inside',
          last_exit_reason: null,
          last_exit_description: null,
          updated_at: timestamp
        })
        .eq('id', selectedEq.id)

      if (touchError) {
        console.warn('Falha ao atualizar eq_equipments:', touchError.message)
      }

      // Broadcast para os outros clientes
      supabase.channel('global_eq_movements').send({
        type: 'broadcast',
        event: 'eq_moved',
        payload
      })
      // Disparar localmente para quem registrou
      window.dispatchEvent(new CustomEvent('eq_moved_local', { detail: payload }))

      toast.success(`${selectedEq.name} registrada DENTRO da obra.`)
      setIsEntryModalOpen(false)
      fetchEquipments()

      try {
        const { logActivity } = await import('../../lib/logActivity');
        await logActivity({
          module: 'Equipamentos',
          action: `Entrada: ${selectedEq.name} (Placa: ${selectedEq.plate_tag || 'S/ Placa'})`,
          user_name: userName
        });
      } catch (e) {
        console.error("Failed to log activity", e)
      }

      // Notificação WhatsApp (agora aguardamos e usamos o helper centralizado)
      try {
        await sendEntryExitWhatsappNotification(
          'entry',
          selectedEq,
          actionDateTime
        )
      } catch (e) {
        console.error("Failed to send whatsapp", e)
      }
    } catch (err) {
      console.error('Error recording entry:', err)
      toast.error('Não foi possível registrar a movimentação.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmExit = async () => {
    if (!selectedEq) return
    if (!exitReason) {
      toast.error('Selecione um motivo para a saída.')
      return
    }
    if (exitReason === 'other' && !exitDescription.trim()) {
      toast.error('A descrição é obrigatória para o motivo selecionado.')
      return
    }

    setIsSaving(true)
    try {
      // Fonte de verdade: o último movimento registrado em eq_movements
      const { data: lastMovements } = await supabase
        .from('eq_movements')
        .select('movement_type, created_at')
        .eq('equipment_id', selectedEq.id)
        .order('created_at', { ascending: false })
        .limit(1)

      const lastMovement = lastMovements?.[0]
      if (lastMovement?.movement_type === 'exit') {
        toast.error('Este equipamento já está fora da obra. Atualize a página.')
        setIsExitModalOpen(false)
        fetchEquipments()
        return
      }

      const userName = await getUserName()

      // Registra a saída em eq_movements
      const { error: moveError } = await supabase
        .from('eq_movements')
        .insert({
          equipment_id: selectedEq.id,
          movement_type: 'exit',
          exit_reason: exitReason,
          description: exitDescription.trim() || null,
          created_by: userName,
          created_at: new Date(actionDateTime).toISOString(),
          environment: typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
        })

      if (moveError) throw moveError

      const reasonLabel = EXIT_REASONS.find(r => r.value === exitReason)?.label || exitReason
      const timestamp = new Date(actionDateTime).toISOString()

      const payload = {
        equipment_id: selectedEq.id,
        movement_type: 'exit',
        created_by: userName,
        created_at: timestamp,
        exit_reason: reasonLabel,
        description: exitDescription.trim() || null
      };

      // Atualiza o equipamento para 'outside' com o motivo e descrição
      const { error: touchError } = await supabase
        .from('eq_equipments')
        .update({
          location_status: 'outside',
          last_exit_reason: exitReason,
          last_exit_description: exitDescription.trim() || null,
          updated_at: timestamp
        })
        .eq('id', selectedEq.id)

      if (touchError) {
        console.warn('Falha ao atualizar eq_equipments:', touchError.message)
      }

      // Broadcast para os outros clientes
      supabase.channel('global_eq_movements').send({
        type: 'broadcast',
        event: 'eq_moved',
        payload
      })
      // Disparar localmente para quem registrou
      window.dispatchEvent(new CustomEvent('eq_moved_local', { detail: payload }))
      
      toast.success(`${selectedEq.name} registrada FORA da obra — ${reasonLabel}.`)
      setIsExitModalOpen(false)
      fetchEquipments()
      
      try {
        const { logActivity } = await import('../../lib/logActivity');
        await logActivity({
          module: 'Equipamentos',
          action: `Saída: ${selectedEq.name} (Placa: ${selectedEq.plate_tag || 'S/ Placa'}) - ${reasonLabel}`,
          user_name: userName
        });
      } catch (e) {
        console.error("Failed to log activity", e)
      }

      // Notificação WhatsApp
      try {
        await sendEntryExitWhatsappNotification(
          'exit',
          selectedEq,
          actionDateTime,
          exitReason,
          exitDescription
        )
      } catch (e) {
        console.error("Failed to send whatsapp", e)
      }
    } catch (err) {
      console.error('Error recording exit:', err)
      toast.error('Não foi possível registrar a movimentação.')
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

      const { data: movements, error } = await supabase
        .from('eq_movements').select(`
          *,
          eq_equipments (
            name,
            plate_tag,
            category
          ).eq('environment', typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena')
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true })

      if (error) throw error

      if (!movements || movements.length === 0) {
        toast.info('Nenhuma movimentação encontrada neste período.')
        return
      }

      const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable').catch(()=>({default:null}));
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
        doc.text('Relatório de Entradas e Saídas', 14, 10 + imgHeight + 8)
        doc.setFontSize(10)
        doc.text(`Período: ${reportStartDate.split('-').reverse().join('/')} até ${reportEndDate.split('-').reverse().join('/')}`, 14, 10 + imgHeight + 14)
        
        autoTable(doc, {
          startY: 10 + imgHeight + 20,
          head: [['Data/Hora', 'Equipamento', 'Placa/Tag', 'Tipo', 'Motivo', 'Observações']],
          body: movements.map(m => [
            new Date(m.created_at).toLocaleString('pt-BR'),
            (m.eq_equipments as any)?.name || '-',
            (m.eq_equipments as any)?.plate_tag || '-',
            m.movement_type === 'entry' ? 'ENTRADA' : 'SAÍDA',
            m.movement_type === 'exit' ? (EXIT_REASONS.find(r => r.value === m.exit_reason)?.label || m.exit_reason || '-') : '-',
            m.description || '-'
          ]),
          theme: 'striped',
          headStyles: { fillColor: [8, 102, 255] },
          styles: { fontSize: 8 },
          columnStyles: { 5: { cellWidth: 'auto' } }
        })
      } catch (e) {
        doc.setFontSize(16)
        doc.text('Relatório de Entradas e Saídas', 14, 20)
        doc.setFontSize(10)
        doc.text(`Período: ${reportStartDate.split('-').reverse().join('/')} até ${reportEndDate.split('-').reverse().join('/')}`, 14, 28)
        
        autoTable(doc, {
          startY: 35,
          head: [['Data/Hora', 'Equipamento', 'Placa/Tag', 'Tipo', 'Motivo', 'Observações']],
          body: movements.map(m => [
            new Date(m.created_at).toLocaleString('pt-BR'),
            (m.eq_equipments as any)?.name || '-',
            (m.eq_equipments as any)?.plate_tag || '-',
            m.movement_type === 'entry' ? 'ENTRADA' : 'SAÍDA',
            m.movement_type === 'exit' ? (EXIT_REASONS.find(r => r.value === m.exit_reason)?.label || m.exit_reason || '-') : '-',
            m.description || '-'
          ]),
          theme: 'striped',
          headStyles: { fillColor: [8, 102, 255] },
          styles: { fontSize: 8 },
          columnStyles: { 5: { cellWidth: 'auto' } }
        })
      }

      doc.save(`relatorio_movimentacoes_${reportStartDate}_a_${reportEndDate}.pdf`)
      toast.success('Relatório gerado com sucesso!')
      setIsReportModalOpen(false)
    } catch (err) {
      console.error('Error generating report:', err)
      toast.error('Erro ao gerar relatório.')
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const filteredEquipments = useMemo(() => {
    return equipments.filter(eq => {
      // Só existe "fora da obra" com registro de saída no banco. Sem
      // movimento, o equipamento é tratado como dentro.
      const isInside = isOutside(eq) === false

      if (filterStatus === 'Dentro da Obra' && !isInside) return false
      if (filterStatus === 'Fora da Obra' && isInside) return false
      if (filterCategory !== 'Todas as categorias' && eq.category !== filterCategory) return false

      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchName = eq.name?.toLowerCase().includes(query)
        const matchPlate = eq.plate_tag?.toLowerCase().includes(query)
        if (!matchName && !matchPlate) return false
      }
      return true
    })
  }, [equipments, filterStatus, filterCategory, searchQuery])

  // Derived Metrics
  const metrics = useMemo(() => {
    let inside = 0
    let outside = 0

    equipments.forEach(eq => {
      if (isOutside(eq)) outside++
      else inside++
    })

    return {
      total: equipments.length,
      inside,
      outside
    }
  }, [equipments])

  const parsedActionDate = (actionDateTime && !isNaN(new Date(actionDateTime).getTime())) ? new Date(actionDateTime) : new Date();
  const actionTimeStr = actionDateTime && actionDateTime.includes('T') ? actionDateTime.split('T')[1].substring(0,5) : "00:00";

  const updateActionDateTime = (newDate?: Date, newTime?: string) => {
    const d = newDate || parsedActionDate;
    let t = newTime !== undefined ? newTime : actionTimeStr;
    if (!t) t = "00:00";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setActionDateTime(`${year}-${month}-${day}T${t}`);
  };

  return (
    <div className={`flex flex-col min-h-screen ${isDark ? 'bg-transparent text-white' : 'bg-[#faf9f6] text-gray-900'}`}>
      {/* Header */}
      <div className="flex-none p-4 md:p-8 pb-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="tracking-tight mb-2"
              style={{ fontSize: 'clamp(20px, 6vw, 48px)' }}
            >Controle de Entrada e Saída</h1>
            <p className="text-sm md:text-base opacity-70">Controle dos equipamentos dentro e fora da obra</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 self-start md:self-auto">
            <button 
              onClick={handleOpenGlobalHistory}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400 border border-amber-500/20 rounded-full text-sm font-semibold hover:bg-amber-500/20 transition-colors shadow-sm"
              title="Ver histórico de entrada e saída de todos os equipamentos por data"
            >
              <History size={16} />
              Histórico Geral
            </button>
            <button 
              onClick={() => setIsReportModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600/10 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-600/20 rounded-full text-sm font-semibold hover:bg-blue-600/20 transition-colors"
            >
              <FileDown size={16} />
              Relatório
            </button>
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-full text-sm font-medium hover:bg-white dark:hover:bg-white/10 transition-colors"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 md:px-8 pb-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <MetricCard title="Dentro da Obra" value={metrics.inside} total={metrics.total} color="green" />
            <MetricCard title="Fora da Obra" value={metrics.outside} total={metrics.total} color="red" />
            <MetricCard title="Total Cadastrado" value={metrics.total} color="default" />
          </div>

          {/* Controls */}
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" size={18} />
              <input 
                type="text" 
                placeholder="Buscar equipamento ou placa/tag..." 
                className={`w-full border rounded-xl pl-11 pr-4 py-3 outline-none transition-all ${isDark ? 'bg-white/5 border-white/10 focus:border-white/30 placeholder:text-white/30' : 'bg-white/45 border-black/10 focus:border-black/30 placeholder:text-black/30'}`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="relative">
              <button 
                onClick={() => { setShowCategoryMenu(!showCategoryMenu); setShowFilterMenu(false); }}
                className={`border px-5 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors w-full md:w-auto ${filterCategory !== 'Todas as categorias' ? 'bg-[#0866ff] text-white border-[#0866ff]' : isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white/45 border-black/10 hover:bg-white'}`}
              >
                <Filter size={18} /> <span>{filterCategory === 'Todas as categorias' ? 'Categoria' : filterCategory}</span> {filterCategory !== 'Todas as categorias' && <span className="w-2 h-2 rounded-full bg-white ml-1"></span>}
              </button>
              {showCategoryMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowCategoryMenu(false)} />
                  <div className={`absolute right-0 top-full mt-2 w-48 rounded-xl shadow-xl border z-50 overflow-hidden py-1 ${isDark ? 'bg-[#1a1a1b] border-white/10' : 'bg-white border-black/10'}`}>
                    {['Todas as categorias', 'Equipamento Pesado', 'Leve', 'Jardinagem', 'Canteiro'].map(f => (
                      <button 
                        key={f}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${filterCategory === f ? 'font-bold bg-black/5 dark:bg-white/5' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                        onClick={() => { setFilterCategory(f); setShowCategoryMenu(false); }}
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
                onClick={() => { setShowFilterMenu(!showFilterMenu); setShowCategoryMenu(false); }}
                className={`border px-5 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors w-full md:w-auto ${filterStatus !== 'Todos' ? 'bg-[#0866ff] text-white border-[#0866ff]' : isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white/45 border-black/10 hover:bg-white'}`}
              >
                <Filter size={18} /> <span>{filterStatus === 'Todos' ? 'Status' : filterStatus}</span> {filterStatus !== 'Todos' && <span className="w-2 h-2 rounded-full bg-white ml-1"></span>}
              </button>
              {showFilterMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFilterMenu(false)} />
                  <div className={`absolute right-0 top-full mt-2 w-48 rounded-xl shadow-xl border z-50 overflow-hidden py-1 ${isDark ? 'bg-[#1a1a1b] border-white/10' : 'bg-white border-black/10'}`}>
                    {['Todos', 'Dentro da Obra', 'Fora da Obra'].map(f => (
                      <button 
                        key={f}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${filterStatus === f ? 'font-bold bg-black/5 dark:bg-white/5' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                        onClick={() => { setFilterStatus(f); setShowFilterMenu(false); }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleOpenGlobalHistory}
              className={`border px-4 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors w-full md:w-auto ${isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20' : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'}`}
              title="Ver histórico de entrada e saída de todos os equipamentos e por data"
            >
              <History size={18} />
              <span>Histórico</span>
            </button>
          </div>

          {/* List/Table Area */}
          <div className={`flex flex-col rounded-2xl border overflow-hidden transition-colors ${isDark ? 'bg-black/20 border-white/10' : 'bg-white/45 border-black/10 backdrop-blur-md'}`}>
            {loading && !equipments.length ? (
              <div className="flex-1 flex flex-col gap-4 p-6">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className={`h-16 rounded-xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-black/5'}`} />
                ))}
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <AlertCircle size={48} className="text-red-500 mb-4 opacity-80" />
                <h3 className="text-xl mb-2">{error}</h3>
                <button onClick={handleRefresh} className="px-6 py-2 bg-black dark:bg-white text-[#1c1d21] dark:text-white dark:text-black rounded-full font-medium text-sm">
                  Tentar novamente
                </button>
              </div>
            ) : filteredEquipments.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-50">
                <Truck size={48} className="mb-4" />
                <h3 className="text-xl">Nenhum equipamento encontrado.</h3>
              </div>
            ) : (
              <>
                {/* Desktop Table - Responsiva sem necessidade de scroll horizontal */}
                <div className="hidden md:block w-full overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className={`border-b font-semibold text-[11px] uppercase tracking-wider ${isDark ? 'bg-white/5 border-white/10 text-white/70' : 'bg-black/5 border-black/10 text-black/60'}`}>
                      <tr>
                        <th className="px-3 py-2.5">EQUIPAMENTO</th>
                        <th className="px-2 py-2.5 text-center w-24 shrink-0">PLACA / TAG</th>
                        <th className="px-2 py-2.5 hidden lg:table-cell w-28">CATEGORIA</th>
                        <th className="px-2 py-2.5 text-center w-28 shrink-0">STATUS</th>
                        <th className="px-2.5 py-2.5 w-28 shrink-0">ÚLTIMA MOVIMENTAÇÃO</th>
                        <th className="px-3 py-2.5 text-right w-44 shrink-0">AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-black/5'}`}>
                      {filteredEquipments.map(eq => {
                        const isInside = !isOutside(eq)
                        const isEqGerador = (eq.name || '').toUpperCase().includes('GERADOR') || (eq.plate_tag || '').toUpperCase() === 'E9A4808'
                        const remHoriGerador = geradorData ? calcHorasRestantes(geradorData.currentHorimeter, geradorData.nextMaintenanceHorimeter) : 0
                        const statusHoriGerador = geradorData ? getStatusGerador(geradorData.currentHorimeter, geradorData.nextMaintenanceHorimeter, geradorData.alertHoursThreshold) : 'normal'
                        return (
                          <tr key={eq.id} className={`transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}>
                            <td className="px-3 py-2.5 font-bold text-xs sm:text-sm">
                              {isEqGerador ? (
                                <div className="flex flex-col items-start gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setIsGeradorModalOpen(true)}
                                    className="text-left font-bold text-xs sm:text-sm hover:text-amber-500 transition-colors flex items-center gap-1.5 group/g"
                                    title="Clique para ver e alterar o Horímetro do Gerador"
                                  >
                                    <span className="truncate max-w-[150px] sm:max-w-[200px] lg:max-w-[280px]" title={eq.name}>{eq.name}</span>
                                    <Zap size={14} className="text-amber-500 fill-amber-500 group-hover/g:scale-125 transition-transform shrink-0" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setIsGeradorModalOpen(true)}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all shadow-sm ${
                                      statusHoriGerador === 'vencido'
                                        ? 'bg-red-500 text-white animate-pulse'
                                        : statusHoriGerador === 'alerta'
                                        ? 'bg-amber-500 text-black'
                                        : isDark
                                        ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30'
                                        : 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'
                                    }`}
                                    title="Clique para ver e alterar o Horímetro do Gerador"
                                  >
                                    <Clock size={10} />
                                    <span>Horímetro: {geradorData?.currentHorimeter ?? 0}h</span>
                                    <span className="opacity-80">
                                      ({remHoriGerador <= 0 ? `+${Math.abs(remHoriGerador)}h` : `${remHoriGerador}h`})
                                    </span>
                                  </button>
                                  <span className="lg:hidden text-[11px] font-normal text-gray-500 dark:text-white/60">
                                    {eq.category || '-'}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex flex-col min-w-0">
                                  <span className="truncate block max-w-[140px] sm:max-w-[200px] lg:max-w-[280px] xl:max-w-none text-gray-900 dark:text-white" title={eq.name}>
                                    {eq.name}
                                  </span>
                                  <span className="lg:hidden text-[11px] font-normal text-gray-500 dark:text-white/60 truncate">
                                    {eq.category || '-'}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <span className="font-mono text-xs tracking-wider uppercase font-bold px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 whitespace-nowrap">
                                {eq.plate_tag ? eq.plate_tag.toUpperCase() : '-'}
                              </span>
                            </td>
                            <td className="px-2 py-2.5 hidden lg:table-cell text-xs opacity-80 truncate max-w-[120px]" title={eq.category || '-'}>
                              {eq.category || '-'}
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <div className="relative group/tooltip inline-block">
                                <span className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${ isInside ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 cursor-pointer' }`}>
                                  {isInside ? 'Operando' : (EXIT_REASONS.find(r => r.value === eq.last_exit_reason)?.label || 'Fora da Obra')}
                                </span>
                                {!isInside && eq.last_exit_description && (
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-white text-black text-xs rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-10 shadow-xl pointer-events-none">
                                    <div className="font-bold mb-1 opacity-50 text-[10px] uppercase">Observação</div>
                                    {eq.last_exit_description}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white"></div>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-2.5 py-2.5 text-xs">
                              <div className="flex flex-col leading-tight">
                                <span className="font-medium whitespace-nowrap text-gray-800 dark:text-gray-200">
                                  {new Date(eq.updated_at).toLocaleDateString('pt-BR')}
                                </span>
                                <span className="text-[10px] opacity-60 flex items-center gap-0.5 whitespace-nowrap mt-0.5">
                                  <Clock size={10} className="shrink-0" /> {new Date(eq.updated_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isEqGerador && (
                                  <button
                                    type="button"
                                    onClick={() => setIsGeradorModalOpen(true)}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold text-xs transition-colors shrink-0 ${
                                      statusHoriGerador === 'vencido'
                                        ? 'bg-red-600 text-white hover:bg-red-700'
                                        : statusHoriGerador === 'alerta'
                                        ? 'bg-amber-500 text-black hover:bg-amber-600'
                                        : isDark
                                        ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30'
                                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                                    }`}
                                    title="Horímetro e Manutenção Preventiva do Gerador"
                                  >
                                    <Zap size={13} className="fill-current shrink-0" />
                                    <span className="hidden xl:inline">HORÍMETRO</span>
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleOpenHistory(eq)}
                                  className={`p-1.5 rounded-lg transition-colors shrink-0 ${isDark ? 'hover:bg-white/10 text-white/70 hover:text-white' : 'hover:bg-black/10 text-black/70 hover:text-black'}`}
                                  title="Histórico de Movimentações"
                                >
                                  <History size={16} />
                                </button>
                                {isInside ? (
                                  <button 
                                    onClick={() => handleOpenExit(eq)}
                                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg font-bold text-xs hover:bg-red-700 transition-colors whitespace-nowrap shadow-sm active:scale-95 shrink-0"
                                    title="Registrar Saída da Obra"
                                  >
                                    <ArrowRightFromLine size={13} className="shrink-0" />
                                    <span><span className="hidden xl:inline">REGISTRAR </span>SAÍDA</span>
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => handleOpenEntry(eq)}
                                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700 transition-colors whitespace-nowrap shadow-sm active:scale-95 shrink-0"
                                    title="Registrar Entrada na Obra"
                                  >
                                    <ArrowRightToLine size={13} className="shrink-0" />
                                    <span><span className="hidden xl:inline">REGISTRAR </span>ENTRADA</span>
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

                {/* Mobile Cards */}
                <div className="md:hidden flex flex-col gap-3 p-4">
                  {filteredEquipments.map(eq => {
                    const isInside = !isOutside(eq)
                    const isEqGerador = (eq.name || '').toUpperCase().includes('GERADOR') || (eq.plate_tag || '').toUpperCase() === 'E9A4808'
                    const remHoriGerador = geradorData ? calcHorasRestantes(geradorData.currentHorimeter, geradorData.nextMaintenanceHorimeter) : 0
                    const statusHoriGerador = geradorData ? getStatusGerador(geradorData.currentHorimeter, geradorData.nextMaintenanceHorimeter, geradorData.alertHoursThreshold) : 'normal'
                    return (
                      <div key={eq.id} className={`w-full p-4 rounded-2xl border flex flex-col gap-3 ${isDark ? 'bg-[#1a1a1b] border-white/10' : 'bg-white border-black/10 shadow-sm'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            {isEqGerador ? (
                              <div className="flex flex-col items-start gap-1">
                                <button
                                  type="button"
                                  onClick={() => setIsGeradorModalOpen(true)}
                                  className="font-bold text-lg text-left hover:text-amber-500 transition-colors flex items-center gap-1.5"
                                >
                                  <span>{eq.name}</span>
                                  <Zap size={16} className="text-amber-500 fill-amber-500" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsGeradorModalOpen(true)}
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold transition-all shadow-sm ${
                                    statusHoriGerador === 'vencido'
                                      ? 'bg-red-500 text-white animate-pulse'
                                      : statusHoriGerador === 'alerta'
                                      ? 'bg-amber-500 text-black'
                                      : isDark
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                                  }`}
                                >
                                  <Clock size={11} />
                                  <span>Horímetro: {geradorData?.currentHorimeter ?? 0}h ({remHoriGerador <= 0 ? `+${Math.abs(remHoriGerador)}h` : `Faltam ${remHoriGerador}h`})</span>
                                </button>
                              </div>
                            ) : (
                              <h3 className="font-bold text-lg">{eq.name}</h3>
                            )}
                            <div className="font-mono text-xs tracking-wider uppercase opacity-70 whitespace-nowrap tabular-nums mt-1">{eq.plate_tag ? eq.plate_tag.toUpperCase() : ''}</div>
                            <div className="text-xs opacity-70 mt-1">{eq.category || 'Sem categoria'}</div>
                          </div>
                          <div>
                            <button onClick={() => handleOpenHistory(eq)} className="p-2 bg-black/5 dark:bg-white/5 rounded-lg opacity-70">
                              <History size={18} />
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex items-start justify-between mt-1">
                          <div className="relative group/tooltip">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${ isInside ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 cursor-pointer' }`}>
                              {isInside ? 'Operando' : (EXIT_REASONS.find(r => r.value === eq.last_exit_reason)?.label || 'Fora da Obra')}
                            </span>
                            {!isInside && eq.last_exit_description && (
                              <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-white text-black text-xs rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-10 shadow-xl pointer-events-none">
                                <div className="font-bold mb-1 opacity-50 text-[10px] uppercase">Observação</div>
                                {eq.last_exit_description}
                                <div className="absolute top-full left-4 border-4 border-transparent border-t-white"></div>
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] opacity-50 flex items-center gap-1">
                             <Clock size={10} /> {new Date(eq.updated_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>

                        <div className="mt-2 pt-3 border-t border-black/5 dark:border-white/5 flex flex-col">
                           {isEqGerador && (
                             <button
                               type="button"
                               onClick={() => setIsGeradorModalOpen(true)}
                               className="w-full flex justify-center items-center gap-2 px-4 py-2.5 bg-amber-500 text-black rounded-xl font-bold text-sm hover:bg-amber-600 transition-colors mb-2 min-h-[40px]"
                             >
                               <Zap size={16} className="fill-current" /> HORÍMETRO DO GERADOR
                             </button>
                           )}
                           {isInside ? (
                              <button 
                                onClick={() => handleOpenExit(eq)}
                                className="w-full flex justify-center items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors min-h-[44px]"
                              >
                                <ArrowRightFromLine size={16} /> REGISTRAR SAÍDA
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleOpenEntry(eq)}
                                className="w-full flex justify-center items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors min-h-[44px]"
                              >
                                <ArrowRightToLine size={16} /> REGISTRAR ENTRADA
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

      {/* Entry Modal */}
      {isEntryModalOpen && selectedEq && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isSaving && setIsEntryModalOpen(false)} />
          <div className={`relative w-full max-w-md my-auto rounded-3xl p-6 md:p-8 shadow-2xl max-h-[calc(100dvh-24px)] overflow-y-auto ${isDark ? 'bg-[#101014] text-[#1c1d21] dark:text-white border border-white/10' : 'bg-white text-black'}`}>
            <div className="flex items-center gap-3 mb-6 text-blue-500">
              <LogIn size={28} />
              <h2 className="text-2xl">Registrar Entrada</h2>
            </div>
            
            <div className={`p-4 rounded-2xl mb-6 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
              <div className="text-sm opacity-60 uppercase tracking-wider mb-1">Equipamento</div>
              <div className="text-xl font-bold">{selectedEq.name}</div>
              <div className="font-mono text-sm opacity-70 uppercase mt-1">{selectedEq.plate_tag ? selectedEq.plate_tag.toUpperCase() : ''}</div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex flex-col gap-2 pb-3 border-b border-black/10 dark:border-white/10">
                <label className="text-sm opacity-70 font-semibold">Data / Hora da Entrada</label>
                <div className="flex gap-2 w-full">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className={cn("flex-1 p-3 rounded-xl border flex items-center justify-between font-semibold", isDark ? 'bg-black/20 border-white/20' : 'bg-black/5 border-black/10')}>
                        {format(parsedActionDate, 'dd/MM/yyyy', { locale: ptBR })}
                        <Calendar className="w-4 h-4 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarUI
                        mode="single"
                        selected={parsedActionDate}
                        onSelect={(d) => d && updateActionDateTime(d, undefined)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <input 
                    type="time" 
                    value={actionTimeStr}
                    onChange={(e) => updateActionDateTime(undefined, e.target.value)}
                    className={cn("w-32 p-3 rounded-xl border outline-none font-semibold text-center", isDark ? 'bg-black/20 border-white/20' : 'bg-black/5 border-black/10')}
                  />
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setIsEntryModalOpen(false)}
                disabled={isSaving}
                className={`flex-1 py-3 rounded-xl font-semibold transition-colors min-h-[44px] ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmEntry}
                disabled={isSaving}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors flex justify-center items-center gap-2 min-h-[44px]"
              >
                {isSaving ? <RefreshCw size={18} className="animate-spin" /> : 'CONFIRMAR ENTRADA'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Exit Modal */}
      {isExitModalOpen && selectedEq && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isSaving && setIsExitModalOpen(false)} />
          <div className={`relative w-full max-w-md my-auto rounded-3xl p-6 md:p-8 shadow-2xl max-h-[calc(100dvh-24px)] overflow-y-auto ${isDark ? 'bg-[#101014] text-[#1c1d21] dark:text-white border border-white/10' : 'bg-white text-black'}`}>
            <div className="flex items-center gap-3 mb-6 text-red-500">
              <LogOut size={28} />
              <h2 className="text-2xl">Registrar Saída</h2>
            </div>
            
            <div className={`p-4 rounded-2xl mb-6 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
              <div className="text-sm opacity-60 uppercase tracking-wider mb-1">Equipamento</div>
              <div className="text-xl font-bold">{selectedEq.name}</div>
              <div className="font-mono text-sm opacity-70 uppercase mt-1">{selectedEq.plate_tag ? selectedEq.plate_tag.toUpperCase() : ''}</div>
            </div>

            <div className="mb-6 pb-4 border-b border-black/10 dark:border-white/10">
              <label className="block text-sm font-semibold mb-2">Data / Hora da Saída</label>
              <div className="flex gap-2 w-full">
                <Popover>
                  <PopoverTrigger asChild>
                    <button className={cn("flex-1 p-3 rounded-xl border flex items-center justify-between font-semibold", isDark ? 'bg-black/20 border-white/20' : 'bg-black/5 border-black/10')}>
                      {format(parsedActionDate, 'dd/MM/yyyy', { locale: ptBR })}
                      <Calendar className="w-4 h-4 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarUI
                      mode="single"
                      selected={parsedActionDate}
                      onSelect={(d) => d && updateActionDateTime(d, undefined)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <input 
                  type="time" 
                  value={actionTimeStr}
                  onChange={(e) => updateActionDateTime(undefined, e.target.value)}
                  className={cn("w-32 p-3 rounded-xl border outline-none font-semibold text-center", isDark ? 'bg-black/20 border-white/20' : 'bg-black/5 border-black/10')}
                />
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2">Motivo da Saída <span className="text-red-500">*</span></label>
                <div className="space-y-2">
                  {EXIT_REASONS.map(reason => (
                    <label key={reason.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${exitReason === reason.value ? (isDark ? 'bg-white/10 border-white/30' : 'bg-black/5 border-black/20') : (isDark ? 'border-white/10 hover:bg-white/5' : 'border-black/10 hover:bg-black/5')}`}>
                      <input 
                        type="radio" 
                        name="exit_reason" 
                        value={reason.value}
                        checked={exitReason === reason.value}
                        onChange={(e) => setExitReason(e.target.value)}
                        className="w-4 h-4 accent-black dark:accent-white"
                      />
                      <span className="font-medium text-sm">{reason.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {exitReason && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="block text-sm font-semibold mb-2 flex justify-between items-end">
                    <span>Descrição / Detalhes</span>
                    {exitReason === 'other' && <span className="text-[10px] text-red-500 uppercase tracking-wider font-bold">Obrigatório</span>}
                  </label>
                  <textarea 
                    value={exitDescription}
                    onChange={e => setExitDescription(e.target.value)}
                    placeholder="Descreva por que o equipamento está saindo da obra..."
                    className={`w-full p-4 rounded-xl border outline-none min-h-[100px] resize-none ${isDark ? 'bg-black/20 border-white/20 focus:border-white/50' : 'bg-white border-black/10 focus:border-black/30'}`}
                  />
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-8 pt-4 border-t border-black/10 dark:border-white/10">
              <button 
                onClick={() => setIsExitModalOpen(false)}
                disabled={isSaving}
                className={`flex-1 py-3 rounded-xl font-semibold transition-colors min-h-[44px] ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmExit}
                disabled={isSaving || !exitReason}
                className={`flex-1 py-3 rounded-xl font-bold transition-colors flex justify-center items-center gap-2 min-h-[44px] ${!exitReason ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-white/10 dark:text-white/30' : 'bg-red-600 text-white hover:bg-red-700'}`}
              >
                {isSaving ? <RefreshCw size={18} className="animate-spin" /> : 'CONFIRMAR SAÍDA'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* History Modal */}
      {isHistoryModalOpen && selectedEq && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsHistoryModalOpen(false)} />
          <div className={`relative w-full max-w-lg my-auto rounded-3xl p-6 md:p-8 shadow-2xl max-h-[calc(100dvh-24px)] flex flex-col ${isDark ? 'bg-[#101014] text-[#1c1d21] dark:text-white border border-white/10' : 'bg-white text-black'}`}>
            <div className="flex-none flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl">Histórico de Movimentação</h2>
                <div className="text-sm opacity-70 mt-1 font-bold">{selectedEq.name} <span className="font-mono text-xs opacity-70 uppercase ml-2">{selectedEq.plate_tag ? selectedEq.plate_tag.toUpperCase() : ''}</span></div>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className={`p-2 rounded-full ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-black/5 hover:bg-black/10'}`}>
                <ArrowRightFromLine size={20} className="rotate-180" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-[300px]">
              {loadingHistory ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw size={24} className="animate-spin opacity-50" />
                </div>
              ) : eqHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-50 py-12">
                  <Info size={48} className="mb-4" />
                  <p>Nenhuma movimentação registrada.</p>
                </div>
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-black/10 dark:before:via-white/10 before:to-transparent">
                  {eqHistory.map((mov, idx) => {
                    const isEntry = mov.movement_type === 'entry'
                    const reasonLabel = EXIT_REASONS.find(r => r.value === mov.exit_reason)?.label || 'Outro'
                    
                    return (
                      <div key={mov.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        {/* Icon */}
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 ${ isDark ? (isEntry ? 'bg-[#101014] border-green-500/30 text-green-400' : 'bg-[#101014] border-red-500/30 text-red-400') : (isEntry ? 'bg-white border-green-200 text-green-600' : 'bg-white border-red-200 text-red-600') }`}>
                          {isEntry ? <LogIn size={16} /> : <LogOut size={16} />}
                        </div>
                        
                        {/* Card */}
                        <div className={`w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl shadow-sm border ${ isDark ? 'bg-white/5 border-white/10' : 'bg-white border-black/5' }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`font-bold text-sm ${isEntry ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {isEntry ? 'ENTRADA' : 'SAÍDA'}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] opacity-60 font-medium">
                                {new Date(mov.created_at).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteMovement(mov.id)
                                }}
                                disabled={deletingMovId === mov.id}
                                title="Excluir movimentação"
                                className="p-1 text-[#5f6472] dark:text-gray-400 hover:text-red-500 rounded transition-colors disabled:opacity-50"
                              >
                                {deletingMovId === mov.id ? (
                                  <RefreshCw size={12} className="animate-spin" />
                                ) : (
                                  <Trash2 size={12} />
                                )}
                              </button>
                            </div>
                          </div>
                          
                          {!isEntry && mov.exit_reason && (
                            <div className="text-sm font-semibold opacity-90 mt-2">{reasonLabel}</div>
                          )}
                          {mov.description && (
                            <div className="text-xs opacity-70 mt-1">"{mov.description}"</div>
                          )}
                          
                          <div className="text-[10px] opacity-40 mt-3 flex items-center gap-1">
                            Usuário: {mov.created_by ? (mov.created_by.includes('@') ? mov.created_by.split('@')[0] : mov.created_by) : 'Desconhecido'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Report Modal */}
      {isReportModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isGeneratingReport && setIsReportModalOpen(false)} />
          <div className={`relative w-full max-w-sm my-auto rounded-3xl p-6 md:p-8 shadow-2xl ${isDark ? 'bg-[#101014] text-[#1c1d21] dark:text-white border border-white/10' : 'bg-white text-black'}`}>
            <h2 className="text-2xl mb-2">Relatório PDF</h2>
            <p className="text-sm opacity-70 mb-6">Selecione o período das movimentações para baixar o relatório completo.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold opacity-70 mb-1 flex items-center gap-2"><Calendar size={14} /> Data Inicial</label>
                <DateInput 
                  value={reportStartDate}
                  onChange={val => setReportStartDate(val)}
                  className={`w-full px-4 py-3 rounded-xl border outline-none ${isDark ? 'bg-black/20 border-white/20 focus:border-white/50' : 'bg-black/5 border-black/10 focus:border-black/30'}`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold opacity-70 mb-1 flex items-center gap-2"><Calendar size={14} /> Data Final</label>
                <DateInput 
                  value={reportEndDate}
                  onChange={val => setReportEndDate(val)}
                  className={`w-full px-4 py-3 rounded-xl border outline-none ${isDark ? 'bg-black/20 border-white/20 focus:border-white/50' : 'bg-black/5 border-black/10 focus:border-black/30'}`}
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setIsReportModalOpen(false)}
                disabled={isGeneratingReport}
                className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}
              >
                Cancelar
              </button>
              <button 
                onClick={generatePDFReport}
                disabled={isGeneratingReport}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors flex justify-center items-center gap-2"
              >
                {isGeneratingReport ? <RefreshCw size={18} className="animate-spin" /> : <><FileDown size={18} /> Baixar PDF</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Global History Modal - Histórico Geral por Data */}
      {isGlobalHistoryOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsGlobalHistoryOpen(false)} />
          <div className={`relative w-full max-w-4xl my-auto rounded-3xl p-5 md:p-7 shadow-2xl flex flex-col max-h-[92vh] ${isDark ? 'bg-[#101014] text-white border border-white/10' : 'bg-white text-black'}`}>
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-black/10 dark:border-white/10 flex-none">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-none">
                  <History size={22} />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold leading-tight">Histórico Geral de Movimentações</h2>
                  <p className="text-xs md:text-sm opacity-60">Entradas e saídas de todos os equipamentos filtradas por data e período</p>
                </div>
              </div>
              <button
                onClick={() => setIsGlobalHistoryOpen(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex-none"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Filters Bar */}
            <div className="py-4 space-y-3 border-b border-black/10 dark:border-white/10 flex-none">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-4">
                  <label className="block text-xs font-semibold opacity-70 mb-1 flex items-center gap-1.5">
                    <Calendar size={13} /> Data Inicial
                  </label>
                  <DateInput 
                    value={globalHistoryStartDate}
                    onChange={val => setGlobalHistoryStartDate(val)}
                    className={`w-full px-3 py-2 text-sm rounded-xl border outline-none ${isDark ? 'bg-black/30 border-white/15 focus:border-white/40' : 'bg-black/5 border-black/10 focus:border-black/30'}`}
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-xs font-semibold opacity-70 mb-1 flex items-center gap-1.5">
                    <Calendar size={13} /> Data Final
                  </label>
                  <DateInput 
                    value={globalHistoryEndDate}
                    onChange={val => setGlobalHistoryEndDate(val)}
                    className={`w-full px-3 py-2 text-sm rounded-xl border outline-none ${isDark ? 'bg-black/30 border-white/15 focus:border-white/40' : 'bg-black/5 border-black/10 focus:border-black/30'}`}
                  />
                </div>
                <div className="sm:col-span-4 flex gap-2">
                  <button 
                    onClick={() => fetchGlobalHistory(globalHistoryStartDate, globalHistoryEndDate)}
                    disabled={loadingGlobalHistory}
                    className="flex-1 py-2 px-3 text-sm font-semibold rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {loadingGlobalHistory ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                    <span>Filtrar</span>
                  </button>
                </div>
              </div>

              {/* Atalhos Rápidos de Data e Pílulas de Tipo */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="opacity-50 text-[11px] mr-1">Período:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyQuickDate(0)}
                    className={`px-2.5 py-1 rounded-lg border font-medium transition-colors ${globalHistoryStartDate === new Date().toISOString().split('T')[0] && globalHistoryEndDate === new Date().toISOString().split('T')[0] ? 'bg-amber-500 text-white border-amber-500' : isDark ? 'border-white/10 hover:bg-white/5' : 'border-black/10 hover:bg-black/5'}`}
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyQuickDate(7)}
                    className={`px-2.5 py-1 rounded-lg border font-medium transition-colors ${isDark ? 'border-white/10 hover:bg-white/5' : 'border-black/10 hover:bg-black/5'}`}
                  >
                    Últimos 7 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyQuickDate(30)}
                    className={`px-2.5 py-1 rounded-lg border font-medium transition-colors ${isDark ? 'border-white/10 hover:bg-white/5' : 'border-black/10 hover:bg-black/5'}`}
                  >
                    Últimos 30 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyQuickDate(undefined)}
                    className={`px-2.5 py-1 rounded-lg border font-medium transition-colors ${!globalHistoryStartDate && !globalHistoryEndDate ? 'bg-amber-500/20 text-amber-500 border-amber-500/40' : isDark ? 'border-white/10 hover:bg-white/5' : 'border-black/10 hover:bg-black/5'}`}
                  >
                    Ver Tudo
                  </button>
                </div>

                {/* Tipo de Movimento */}
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-black/5 dark:border-white/10 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setGlobalHistoryType('all')}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${globalHistoryType === 'all' ? 'bg-white dark:bg-white/20 shadow-sm' : 'opacity-60 hover:opacity-100'}`}
                  >
                    Todos ({globalHistoryMovements.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGlobalHistoryType('entry')}
                    className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${globalHistoryType === 'entry' ? 'bg-emerald-500 text-white shadow-sm' : 'opacity-60 hover:opacity-100 text-emerald-600 dark:text-emerald-400'}`}
                  >
                    <LogIn size={12} /> Entradas
                  </button>
                  <button
                    type="button"
                    onClick={() => setGlobalHistoryType('exit')}
                    className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${globalHistoryType === 'exit' ? 'bg-red-500 text-white shadow-sm' : 'opacity-60 hover:opacity-100 text-red-600 dark:text-red-400'}`}
                  >
                    <LogOut size={12} /> Saídas
                  </button>
                </div>
              </div>

              {/* Busca rápida */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
                <input 
                  type="text"
                  value={globalHistorySearch}
                  onChange={e => setGlobalHistorySearch(e.target.value)}
                  placeholder="Buscar por equipamento, placa/tag, motivo, observação ou usuário..."
                  className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none ${isDark ? 'bg-black/20 border-white/10 focus:border-white/30 placeholder:text-white/30' : 'bg-black/5 border-black/10 focus:border-black/30 placeholder:text-black/30'}`}
                />
              </div>
            </div>

            {/* List Body */}
            <div className="overflow-y-auto pr-1 py-3 space-y-2.5 flex-1 min-h-[240px] max-h-[55vh]">
              {loadingGlobalHistory ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 opacity-60">
                  <RefreshCw size={28} className="animate-spin text-amber-500" />
                  <p className="text-sm">Carregando histórico de movimentações...</p>
                </div>
              ) : filteredGlobalHistory.length === 0 ? (
                <div className="py-16 text-center opacity-60 flex flex-col items-center justify-center gap-2">
                  <Clock size={36} className="opacity-40" />
                  <p className="font-semibold text-base">Nenhuma movimentação encontrada</p>
                  <p className="text-xs max-w-sm">
                    {globalHistorySearch || globalHistoryStartDate || globalHistoryEndDate || globalHistoryType !== 'all'
                      ? 'Nenhum registro corresponde aos filtros selecionados. Tente alterar as datas ou a busca.'
                      : 'Não há registros de entrada ou saída no histórico.'}
                  </p>
                  {(globalHistorySearch || globalHistoryStartDate || globalHistoryEndDate || globalHistoryType !== 'all') && (
                    <button
                      onClick={() => {
                        setGlobalHistorySearch('')
                        setGlobalHistoryType('all')
                        handleApplyQuickDate(undefined)
                      }}
                      className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 font-semibold transition-colors"
                    >
                      Limpar todos os filtros
                    </button>
                  )}
                </div>
              ) : (
                filteredGlobalHistory.map(mov => {
                  const isEntry = mov.movement_type === 'entry'
                  const eq = Array.isArray(mov.eq_equipments) ? mov.eq_equipments[0] : mov.eq_equipments
                  const eqName = eq?.name || 'Equipamento não identificado'
                  const eqPlate = eq?.plate_tag
                  const eqCategory = eq?.category
                  const reasonLabel = EXIT_REASONS.find(r => r.value === mov.exit_reason)?.label || mov.exit_reason || ''
                  const isDeleting = deletingGlobalMovId === mov.id

                  return (
                    <div 
                      key={mov.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isDark ? 'bg-white/[0.03] border-white/10 hover:border-white/20' : 'bg-black/[0.02] border-black/10 hover:border-black/20'}`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`p-2.5 rounded-xl flex-none mt-0.5 ${isEntry ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/15 text-red-500 border border-red-500/20'}`}>
                          {isEntry ? <LogIn size={18} /> : <LogOut size={18} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm tracking-tight truncate">{eqName}</span>
                            {eqPlate && (
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${isDark ? 'bg-white/5 border-white/10 text-white/80' : 'bg-black/5 border-black/10 text-black/80'}`}>
                                {eqPlate}
                              </span>
                            )}
                            {eqCategory && (
                              <span className="text-[10px] opacity-60 px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5">
                                {eqCategory}
                              </span>
                            )}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${isEntry ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/15 text-red-600 dark:text-red-400'}`}>
                              {isEntry ? 'Entrada' : 'Saída'}
                            </span>
                          </div>

                          {!isEntry && reasonLabel && (
                            <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1">
                              Motivo: {reasonLabel}
                            </div>
                          )}

                          {mov.description && (
                            <div className="text-xs opacity-75 mt-0.5 italic">
                              "{mov.description}"
                            </div>
                          )}

                          <div className="text-[11px] opacity-50 mt-1.5 flex flex-wrap items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {new Date(mov.created_at).toLocaleString('pt-BR')}
                            </span>
                            <span>•</span>
                            <span>
                              Registrado por: <strong>{mov.created_by ? (mov.created_by.includes('@') ? mov.created_by.split('@')[0] : mov.created_by) : 'Sistema'}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end sm:justify-start gap-2 flex-none self-end sm:self-center">
                        <button
                          onClick={() => handleDeleteGlobalMovement(mov)}
                          disabled={isDeleting}
                          className="p-2 rounded-xl text-red-500/70 hover:text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors"
                          title="Excluir movimentação"
                        >
                          {isDeleting ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between text-xs opacity-60 flex-none">
              <span>Total de movimentações: {filteredGlobalHistory.length}</span>
              <button 
                onClick={() => setIsGlobalHistoryOpen(false)}
                className={`px-4 py-2 rounded-xl font-semibold transition-colors ${isDark ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-black/5 hover:bg-black/10 text-black'}`}
              >
                Fechar
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Modal de Horímetro e Manutenção do Gerador */}
      <GeradorHorimetroModal
        isOpen={isGeradorModalOpen}
        onClose={() => setIsGeradorModalOpen(false)}
        initialData={geradorData}
        onSuccess={setGeradorData}
      />

    </div>
  )
}

function MetricCard({ title, value, total, color = 'default' }: { title: string, value: number, total?: number, color?: 'default' | 'green' | 'red' }) {
  const { isDark } = useTheme()
  
  let colorClass = isDark ? 'bg-white/5 border-white/10' : 'bg-white border-black/5 shadow-sm'
  if (color === 'green') {
    colorClass = isDark ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-green-50 border-green-100 text-green-800 shadow-sm'
  } else if (color === 'red') {
    colorClass = isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-100 text-red-800 shadow-sm'
  }
  
  return (
    <div className={`p-5 rounded-2xl border transition-colors flex flex-col justify-between ${colorClass}`}>
      <div className="text-xs font-bold opacity-60 uppercase tracking-widest">{title}</div>
      <div className="flex items-baseline gap-2 mt-3">
        <div className="font-bold metric-value" style={{ fontSize: 'clamp(24px, 6vw, 48px)' }}>{value}</div>
        {total !== undefined && <div className="text-lg opacity-50">/ {total}</div>}
      </div>
    </div>
  )
}


