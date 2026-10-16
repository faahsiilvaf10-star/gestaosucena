import Sun from 'lucide-react/dist/esm/icons/sun.js';
import CalendarIcon from 'lucide-react/dist/esm/icons/calendar.js';
import BookOpen from 'lucide-react/dist/esm/icons/book-open.js';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left.js';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.js';
import Shuffle from 'lucide-react/dist/esm/icons/shuffle.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import Edit2 from 'lucide-react/dist/esm/icons/pen.js';
import ImageIcon from 'lucide-react/dist/esm/icons/image.js';
import Check from 'lucide-react/dist/esm/icons/check.js';
import ChevronsUpDown from 'lucide-react/dist/esm/icons/chevrons-up-down.js';
import Upload from 'lucide-react/dist/esm/icons/upload.js';
import Camera from 'lucide-react/dist/esm/icons/camera.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import Users from 'lucide-react/dist/esm/icons/users.js';
import Briefcase from 'lucide-react/dist/esm/icons/briefcase.js';
import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, addMonths, subMonths, isSameMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useTheme } from '@/contexts/ThemeContext'
import { DdsUploadModal } from '@/components/DdsUploadModal'

// Helper para feriados móveis e fixos no Brasil
function getEaster(year: number) {
  const f = Math.floor,
        G = year % 19,
        C = f(year / 100),
        H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
        I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
        J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7,
        L = I - J,
        month = 3 + f((L + 40) / 44),
        day = L + 28 - 31 * f(month / 4);
  return new Date(year, month - 1, day);
}

function getFeriados(year: number) {
  const easter = getEaster(year);
  const carnaval = new Date(easter.getTime());
  carnaval.setDate(easter.getDate() - 47);
  const paixao = new Date(easter.getTime());
  paixao.setDate(easter.getDate() - 2);
  const corpusChristi = new Date(easter.getTime());
  corpusChristi.setDate(easter.getDate() + 60);

  const formatFeriado = (d: Date) => format(d, 'MM-dd');

  return [
    '01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '12-25',
    formatFeriado(carnaval),
    formatFeriado(paixao),
    formatFeriado(corpusChristi)
  ];
}

function isFeriado(date: Date) {
  const feriados = getFeriados(date.getFullYear());
  return feriados.includes(format(date, 'MM-dd'));
}

export const Route = createFileRoute('/seguranca/dds')({
  component: DDSSchedulePage,
})

function DDSSchedulePage() {
  const queryClient = useQueryClient()
  const { isDark } = useTheme()
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))
  
  // Dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [tema, setTema] = useState('')
  const [palestranteId, setPalestranteId] = useState('')
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const [speakerFilterMode, setSpeakerFilterMode] = useState<'system' | 'rh'>('system')
  const [confirmAction, setConfirmAction] = useState<{isOpen: boolean, title: string, message: string, action: () => void}>({ isOpen: false, title: '', message: '', action: () => {} })

  // Estados para Modal de Upload do DDS e Foto Expandida
  const [isDdsModalOpen, setIsDdsModalOpen] = useState(false)
  const [expandedImage, setExpandedImage] = useState<string | null>(null)
  const [uploadTarget, setUploadTarget] = useState<{ tema: string; palestrante: string }>({
    tema: '',
    palestrante: ''
  })

  const todayDate = useMemo(() => new Date(), [])
  const todayDateStr = useMemo(() => format(todayDate, 'yyyy-MM-dd'), [todayDate])

  // Buscar usuários cadastrados no sistema (via RPC)
  const { data: systemUsers = [] } = useQuery({
    queryKey: ['system_users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_system_users')
      if (error) {
        console.error("Erro ao buscar usuários do sistema:", error)
        throw error
      }
      return data || []
    }
  })

  // Buscar todo o efetivo do RH
  const { data: rhEfetivo = [] } = useQuery({
    queryKey: ['rh_efetivo_dds'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_efetivo')
        .select('id, nome, cargo, status')
        .eq('status', 'ATIVO')
        .order('nome', { ascending: true })
      if (error) {
        console.error("Erro ao buscar efetivo do RH:", error)
        throw error
      }
      return data || []
    }
  })

  // Para compatibilidade com outras referências existentes
  const employees = systemUsers

  // Lista consolidada de palestrantes para resolver qualquer ID (usuário do sistema ou efetivo do RH)
  const allSpeakers = useMemo(() => {
    const list: Array<{ id: string; nome: string; cargo?: string; avatar_url?: string; source: 'system' | 'rh' }> = []
    const ids = new Set<string>()

    systemUsers.forEach((u: any) => {
      ids.add(u.id)
      list.push({
        id: u.id,
        nome: u.nome,
        cargo: u.cargo || 'Usuário do Sistema',
        avatar_url: u.avatar_url,
        source: 'system'
      })
    })

    rhEfetivo.forEach((emp: any) => {
      if (!ids.has(emp.id)) {
        list.push({
          id: emp.id,
          nome: emp.nome,
          cargo: emp.cargo || 'Colaborador',
          avatar_url: undefined,
          source: 'rh'
        })
      }
    })

    return list
  }, [systemUsers, rhEfetivo])

  const allSpeakersMap = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; cargo?: string; avatar_url?: string; source: 'system' | 'rh' }>()
    allSpeakers.forEach(s => map.set(s.id, s))
    return map
  }, [allSpeakers])

  // Colaboradores filtrados para exibir no seletor manual (apenas usuários ou todo efetivo)
  const displayedSpeakers = useMemo(() => {
    if (speakerFilterMode === 'system') {
      return systemUsers.map((u: any) => ({
        id: u.id,
        nome: u.nome,
        cargo: u.cargo || 'Usuário do Sistema',
        avatar_url: u.avatar_url,
        source: 'system' as const
      }))
    }
    return rhEfetivo.map((e: any) => ({
      id: e.id,
      nome: e.nome,
      cargo: e.cargo || 'Colaborador',
      avatar_url: undefined,
      source: 'rh' as const
    }))
  }, [speakerFilterMode, systemUsers, rhEfetivo])

  // Buscar DDS de hoje especificamente (permanece visível mesmo mudando de mês)
  const { data: todayDdsData } = useQuery({
    queryKey: ['seguranca_dds_today', todayDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seguranca_dds')
        .select('id, date, tema, palestrante_id')
        .eq('date', todayDateStr)
        .maybeSingle()
      if (error) {
        console.error("Erro ao buscar DDS de hoje:", error)
        return null
      }
      return data || null
    }
  })

  // Buscar foto do DDS de hoje já postada no Instacena (social_posts)
  const { data: todayPostData, refetch: refetchTodayPost } = useQuery({
    queryKey: ['dds_post_today', todayDateStr],
    queryFn: async () => {
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)

      const { data, error } = await supabase
        .from('social_posts')
        .select(`
          id,
          caption,
          created_at,
          social_post_media (
            media_url
          )
        `)
        .like('caption', '%DDS Realizado!%')
        .gte('created_at', startOfToday.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) {
        console.error("Erro ao buscar foto do DDS de hoje:", error)
        return null
      }
      const mediaUrl = data?.[0]?.social_post_media?.[0]?.media_url || null
      return { post: data?.[0] || null, mediaUrl }
    },
    refetchInterval: 30000,
    staleTime: 10000
  })

  // Palestrante de hoje
  const todayPalestrante = useMemo(() => {
    if (!todayDdsData?.palestrante_id) return null
    return allSpeakersMap.get(todayDdsData.palestrante_id) || null
  }, [todayDdsData, allSpeakersMap])

  const handleOpenDdsUpload = (targetTema?: string, targetPalestrante?: string) => {
    const t = targetTema !== undefined && targetTema !== '' ? targetTema : (todayDdsData?.tema || 'A DEFINIR')
    const p = targetPalestrante !== undefined && targetPalestrante !== '' ? targetPalestrante : (todayPalestrante?.nome || 'Livre')
    setUploadTarget({
      tema: t,
      palestrante: p
    })
    setIsDdsModalOpen(true)
  }

  // Fetch month schedule
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const monthStartStr = format(monthStart, 'yyyy-MM-dd')
  const monthEndStr = format(monthEnd, 'yyyy-MM-dd')

  const { data: schedule = [] } = useQuery({
    queryKey: ['seguranca_dds', monthStartStr, monthEndStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seguranca_dds')
        .select('id, date, tema, palestrante_id')
        .gte('date', monthStartStr)
        .lte('date', monthEndStr)
      if (error) {
        console.error("Erro ao buscar agendamentos:", error)
        throw error
      }
      return data || []
    }
  })

  const saveMutation = useMutation({
    mutationFn: async (data: { date: string, tema: string, palestrante_id: string }) => {
      const { error } = await supabase
        .from('seguranca_dds')
        .upsert({
          date: data.date,
          tema: data.tema,
          palestrante_id: data.palestrante_id || null
        }, { onConflict: 'date' })
      if (error) {
        console.error("Erro no upsert:", error)
        throw error
      }
      
      const { logActivity } = await import('../../lib/logActivity');
      await logActivity({
        module: 'Segurança',
        action: `DDS agendado para ${data.date.split('-').reverse().join('/')} (Tema: ${data.tema || 'A definir'})`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seguranca_dds'] })
      queryClient.invalidateQueries({ queryKey: ['seguranca_dds_today'] })
      setEditDialogOpen(false)
      toast.success("Salvo com sucesso!")
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar: " + err.message)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (dateStr: string) => {
      const { error } = await supabase
        .from('seguranca_dds')
        .delete()
        .eq('date', dateStr)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seguranca_dds'] })
      queryClient.invalidateQueries({ queryKey: ['seguranca_dds_today'] })
    }
  })

  const generateRandomMutation = useMutation({
    mutationFn: async () => {
      if (employees.length === 0) return

      const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
      const workDays = monthDays.filter(d => !isWeekend(d) && !isFeriado(d))
      
      const toUpsert = []
      let empIndex = 0
      
      // Shuffle employees array for randomness
      const shuffled = [...employees].sort(() => 0.5 - Math.random())

      for (const day of workDays) {
        const dateStr = format(day, 'yyyy-MM-dd')
        
        // Skip if already has an entry
        if (schedule.some(s => s.date === dateStr)) {
          continue
        }

        const palestrante = shuffled[empIndex % shuffled.length]
        toUpsert.push({
          date: dateStr,
          palestrante_id: palestrante.id,
          tema: 'TEMA A DEFINIR'
        })
        
        empIndex++
      }

      if (toUpsert.length > 0) {
        const { error } = await supabase
          .from('seguranca_dds')
          .upsert(toUpsert, { onConflict: 'date' })
        if (error) {
          console.error("Erro no randomize:", error)
          throw error
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seguranca_dds'] })
      queryClient.invalidateQueries({ queryKey: ['seguranca_dds_today'] })
      toast.success("Dias preenchidos com sucesso!")
    },
    onError: (err: any) => {
      toast.error("Erro ao gerar aleatórios: " + err.message)
    }
  })

  const clearMonthMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('seguranca_dds')
        .delete()
        .gte('date', monthStartStr)
        .lte('date', monthEndStr)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seguranca_dds'] })
      queryClient.invalidateQueries({ queryKey: ['seguranca_dds_today'] })
    }
  })

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1))
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1))

  const openEdit = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const entry = scheduleMap.get(dateStr)
    
    setSelectedDate(date)
    setTema(entry?.tema || '')
    setPalestranteId(entry?.palestrante_id || '')

    // Identificar a qual lista o palestrante atual pertence
    if (entry?.palestrante_id) {
      const isSystem = systemUsers.some((u: any) => u.id === entry.palestrante_id)
      if (isSystem) {
        setSpeakerFilterMode('system')
      } else {
        const isRh = rhEfetivo.some((e: any) => e.id === entry.palestrante_id)
        if (isRh) {
          setSpeakerFilterMode('rh')
        }
      }
    } else {
      setSpeakerFilterMode('system')
    }

    setEditDialogOpen(true)
  }

  const handleSave = () => {
    if (!selectedDate) return
    saveMutation.mutate({
      date: format(selectedDate, 'yyyy-MM-dd'),
      tema: tema.toUpperCase(), // Formatação MAIÚSCULO pedida
      palestrante_id: palestranteId
    })
  }

  const handleDelete = (date: Date) => {
    setConfirmAction({
      isOpen: true,
      title: 'Remover Agendamento',
      message: 'Tem certeza que deseja remover o agendamento deste dia?',
      action: () => deleteMutation.mutate(format(date, 'yyyy-MM-dd'))
    })
  }

  const handleRandomize = () => {
    setConfirmAction({
      isOpen: true,
      title: 'Definir Aleatoriamente',
      message: 'Preencher os dias vazios deste mês com funcionários aleatórios?',
      action: () => generateRandomMutation.mutate()
    })
  }

  const handleClearMonth = () => {
    setConfirmAction({
      isOpen: true,
      title: 'Limpar Mês',
      message: 'Tem certeza que deseja limpar toda a escala deste mês?',
      action: () => clearMonthMutation.mutate()
    })
  }

  // Build the list of days for the table
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const workDays = daysInMonth.filter(d => !isWeekend(d) && !isFeriado(d))
  
  const scheduleMap = useMemo(() => {
    const map = new Map()
    schedule.forEach((s: any) => {
      const emp = allSpeakersMap.get(s.palestrante_id)
      map.set(s.date, {
        ...s,
        palestrante: emp ? { id: emp.id, nome: emp.nome, cargo: emp.cargo, avatar_url: emp.avatar_url } : null
      })
    })
    return map
  }, [schedule, allSpeakersMap])

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-[#f8f9fa] text-black">
      {/* Header section */}
      <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <div className="space-y-2">
          <div className="flex items-center space-x-3 text-black">
            <Sun className="w-8 h-8 text-amber-500" />
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-black">
              DDS - Diálogo de Segurança
            </h1>
          </div>
          <p className="text-gray-500">Gerencie escalas e consulte os temas programados</p>
        </div>

        {/* Card DDS HOJE - Postagem e Consulta da Foto do Dia */}
        <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm transition-all hover:shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4 min-w-0">
              {todayPostData?.mediaUrl ? (
                <div 
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 shadow-md border-2 border-blue-500/40 cursor-pointer hover:opacity-90 transition-opacity relative group"
                  onClick={() => setExpandedImage(todayPostData.mediaUrl)}
                  title="Clique para ver a foto do DDS ampliada"
                >
                  <img src={todayPostData.mediaUrl} alt="Foto do DDS de Hoje" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                </div>
              ) : todayPalestrante?.avatar_url ? (
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 shadow-sm border border-gray-200">
                  <img src={todayPalestrante.avatar_url} alt={todayPalestrante.nome} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 border border-blue-500/20">
                  <FileText className="w-6 h-6" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-blue-600 tracking-wider uppercase">
                    DDS HOJE
                  </span>
                  {todayPostData?.mediaUrl && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Foto postada
                    </span>
                  )}
                </div>
                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-black capitalize truncate mt-0.5">
                  {todayPalestrante?.nome?.toLowerCase() || 'Livre / Não agendado'}
                </div>
                <div className="text-sm text-gray-500 mt-0.5 truncate">
                  Tema: <span className="font-semibold text-gray-800">{todayDdsData?.tema || 'A DEFINIR'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
              <Button
                onClick={() => handleOpenDdsUpload()}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border border-blue-500/30 px-4 py-2.5 rounded-xl font-medium transition-all shadow-sm"
              >
                <Upload className="w-4 h-4" />
                <span>{todayPostData?.mediaUrl ? 'Alterar Foto do DDS' : 'Postar DDS'}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs and Nav */}
        <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
          <div className="flex bg-white shadow-sm border border-gray-200 rounded-xl p-1">
            <button className="flex items-center space-x-2 px-6 py-2.5 rounded-lg bg-black text-white text-sm font-medium transition-colors">
              <CalendarIcon className="w-4 h-4" />
              <span>Escala do Mês</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button onClick={handlePrevMonth} className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="bg-white border border-gray-200 px-6 py-2 rounded-lg font-medium min-w-[160px] text-center capitalize text-black shadow-sm">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </div>
            <button onClick={handleNextMonth} className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
          <h2 className="text-xl font-bold mb-2">Ações Rápidas</h2>
          <p className="text-gray-500 text-sm mb-6">Gerencie a escala do mês</p>
          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={() => handleOpenDdsUpload()} 
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium border-0 shadow-sm"
            >
              <Upload className="w-4 h-4 mr-2" />
              Postar Foto do DDS
            </Button>
            <Button 
              onClick={handleRandomize} 
              disabled={generateRandomMutation.isPending}
              className="bg-black hover:bg-gray-800 text-white font-medium border-0"
            >
              <Shuffle className="w-4 h-4 mr-2" />
              Definir Aleatoriamente
            </Button>
            <Button 
              onClick={handleClearMonth}
              disabled={clearMonthMutation.isPending}
              variant="outline" 
              className="bg-transparent hover:bg-red-50 text-red-600 border-gray-200 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Limpar Mês
            </Button>
          </div>
        </div>

        {/* Schedule Table */}
        <div className="border border-gray-200 rounded-2xl bg-white overflow-hidden shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3 mb-1">
              <CalendarIcon className="w-5 h-5 text-gray-500" />
              <h2 className="text-2xl font-bold text-black">Escala do Mês</h2>
            </div>
            <p className="text-gray-500 text-sm">
              {workDays.length} dias úteis • {schedule.length} agendamentos
            </p>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-gray-500 uppercase bg-gray-50 font-semibold text-xs border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 whitespace-nowrap">Data</th>
                  <th className="px-6 py-4 whitespace-nowrap">Dia</th>
                  <th className="px-6 py-4 whitespace-nowrap">Palestrante</th>
                  <th className="px-6 py-4 whitespace-nowrap">Tema</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {workDays.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const entry = scheduleMap.get(dateStr)
                  const isCurrentDay = dateStr === todayDateStr
                  
                  return (
                    <tr 
                      key={dateStr} 
                      className={cn(
                        "hover:bg-gray-50/80 transition-colors group",
                        isCurrentDay && "bg-blue-50/40"
                      )}
                    >
                      <td className="px-6 py-4 font-bold text-black whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{format(day, 'dd/MM')}</span>
                          {isCurrentDay && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-blue-100 text-blue-700">
                              HOJE
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-500 capitalize whitespace-nowrap">
                        {format(day, 'EEE', { locale: ptBR }).replace('.', '')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {entry?.palestrante ? (
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center border border-blue-300 text-blue-700 font-bold overflow-hidden shadow-sm">
                              {entry.palestrante.avatar_url ? (
                                <img src={entry.palestrante.avatar_url} className="w-full h-full object-cover" />
                              ) : (
                                entry.palestrante.nome.substring(0, 2).toUpperCase()
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-black">{entry.palestrante.nome}</p>
                              <p className="text-xs text-gray-500">{entry.palestrante.cargo}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[#5f6472] dark:text-gray-400">Não definido</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {entry?.tema ? (
                          <div className="flex items-center space-x-2 text-gray-700 font-medium">
                            <span className="line-clamp-2">{entry.tema}</span>
                          </div>
                        ) : (
                          <span className="text-[#5f6472] dark:text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isCurrentDay && (
                            <button 
                              onClick={() => handleOpenDdsUpload(entry?.tema, entry?.palestrante?.nome)}
                              title="Postar Foto do DDS de Hoje"
                              className="p-2 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                            >
                              <Camera className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={() => openEdit(day)}
                            className="p-2 text-[#5f6472] dark:text-gray-400 hover:text-black transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {entry && (
                            <button 
                              onClick={() => handleDelete(day)}
                              className="p-2 text-[#5f6472] dark:text-gray-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
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

          {/* Mobile Card View */}
          <div className="md:hidden flex flex-col divide-y divide-gray-100">
            {workDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const entry = scheduleMap.get(dateStr)
              const isCurrentDay = dateStr === todayDateStr
              
              return (
                <div key={dateStr} className={cn("p-4 flex flex-col gap-4", isCurrentDay && "bg-blue-50/40")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-black text-xl">{format(day, 'dd/MM')}</span>
                      {isCurrentDay && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-blue-100 text-blue-700">
                          HOJE
                        </span>
                      )}
                      <span className="text-gray-500 capitalize text-sm">{format(day, 'EEEE', { locale: ptBR })}</span>
                    </div>
                    <div className="flex gap-2">
                      {isCurrentDay && (
                        <button 
                          onClick={() => handleOpenDdsUpload(entry?.tema, entry?.palestrante?.nome)} 
                          title="Postar foto do DDS" 
                          className="p-2.5 text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-200 rounded-xl transition-colors"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => openEdit(day)} className="p-2.5 text-gray-500 hover:text-black bg-gray-50 border border-gray-200 rounded-xl transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {entry && (
                        <button onClick={() => handleDelete(day)} className="p-2.5 text-red-500 hover:text-red-700 bg-red-50 border border-red-100 rounded-xl transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3 flex flex-col justify-center border border-gray-100">
                      <div className="text-[11px] font-bold text-[#5f6472] dark:text-gray-400 uppercase tracking-wider mb-1.5">Palestrante</div>
                      {entry?.palestrante ? (
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center border border-blue-300 text-blue-700 font-bold overflow-hidden shadow-sm shrink-0">
                            {entry.palestrante.avatar_url ? (
                              <img src={entry.palestrante.avatar_url} className="w-full h-full object-cover" />
                            ) : (
                              entry.palestrante.nome.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-gray-900 text-sm truncate">{entry.palestrante.nome}</p>
                            <p className="text-xs text-gray-500 truncate">{entry.palestrante.cargo}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[#5f6472] dark:text-gray-400 text-sm">Não definido</span>
                      )}
                    </div>

                    <div className="bg-gray-50 rounded-xl p-3 flex flex-col justify-center border border-gray-100">
                      <div className="text-[11px] font-bold text-[#5f6472] dark:text-gray-400 uppercase tracking-wider mb-1.5">Tema</div>
                      {entry?.tema ? (
                        <div className="flex items-center space-x-2 text-gray-800 font-medium text-sm leading-snug">
                          <span>{entry.tema}</span>
                        </div>
                      ) : (
                        <span className="text-[#5f6472] dark:text-gray-400 text-sm">-</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* Edit/Add Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white border-gray-200 text-black">
          <DialogHeader>
            <DialogTitle className="font-bold text-2xl text-black">
              Agendar DDS - {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            
            <div className="space-y-3 flex flex-col">
              <div className="flex items-center justify-between">
                <Label className="text-gray-700 font-semibold text-sm">Palestrante</Label>
                {palestranteId && (
                  <button
                    type="button"
                    onClick={() => setPalestranteId('')}
                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                  >
                    Limpar seleção
                  </button>
                )}
              </div>

              {/* Seletor de Origem: Usuários Cadastrados ou Todo Efetivo do RH */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Origem do colaborador:
                </span>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 rounded-xl border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setSpeakerFilterMode('system')}
                    className={cn(
                      "flex items-center justify-center gap-1.5 py-2 px-2.5 text-xs font-semibold rounded-lg transition-all",
                      speakerFilterMode === 'system'
                        ? "bg-white text-blue-700 shadow-sm border border-gray-200"
                        : "text-gray-600 hover:text-black hover:bg-white/60"
                    )}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span className="truncate">Usuários ({systemUsers.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpeakerFilterMode('rh')}
                    className={cn(
                      "flex items-center justify-center gap-1.5 py-2 px-2.5 text-xs font-semibold rounded-lg transition-all",
                      speakerFilterMode === 'rh'
                        ? "bg-white text-emerald-700 shadow-sm border border-gray-200"
                        : "text-gray-600 hover:text-black hover:bg-white/60"
                    )}
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    <span className="truncate">Efetivo RH ({rhEfetivo.length})</span>
                  </button>
                </div>
              </div>

              <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboboxOpen}
                    className="w-full justify-between bg-white border-gray-300 hover:bg-gray-50 text-black text-left font-normal h-11"
                  >
                    <span className="truncate">
                      {palestranteId
                        ? allSpeakersMap.get(palestranteId)?.nome || "Colaborador selecionado"
                        : speakerFilterMode === 'system' ? "Selecione um usuário cadastrado..." : "Selecione um colaborador do RH..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[380px] p-0 bg-white border-gray-200 text-black shadow-xl rounded-xl">
                  <Command className="bg-transparent">
                    <CommandInput 
                      placeholder={speakerFilterMode === 'system' ? "Buscar usuário cadastrado..." : "Buscar no efetivo do RH..."} 
                      className="text-black" 
                    />
                    <CommandList className="max-h-[260px] overflow-y-auto">
                      <CommandEmpty className="py-4 text-center text-sm text-gray-500">
                        Nenhum colaborador encontrado.
                      </CommandEmpty>
                      <CommandGroup heading={speakerFilterMode === 'system' ? "Usuários Cadastrados" : "Efetivo do RH"}>
                        {displayedSpeakers.map((emp) => (
                          <CommandItem
                            key={emp.id}
                            value={`${emp.nome} ${emp.cargo || ''}`}
                            onSelect={() => {
                              setPalestranteId(emp.id)
                              setComboboxOpen(false)
                            }}
                            className="text-black hover:bg-gray-100 cursor-pointer flex items-center justify-between py-2"
                          >
                            <div className="flex items-center min-w-0 mr-2">
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4 shrink-0 text-blue-600",
                                  palestranteId === emp.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="truncate">
                                <span className="font-medium text-sm text-gray-900">{emp.nome}</span>
                                {emp.cargo && (
                                  <span className="text-gray-500 text-xs ml-1.5 block sm:inline truncate">
                                    • {emp.cargo}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className={cn(
                              "text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded shrink-0",
                              emp.source === 'system' ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            )}>
                              {emp.source === 'system' ? 'Sistema' : 'RH'}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {palestranteId && allSpeakersMap.get(palestranteId) && (
                <div className="flex items-center justify-between text-xs text-gray-600 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="truncate">
                    Selecionado: <strong className="text-gray-900">{allSpeakersMap.get(palestranteId)?.nome}</strong>
                    {allSpeakersMap.get(palestranteId)?.cargo && (
                      <span className="text-gray-500"> ({allSpeakersMap.get(palestranteId)?.cargo})</span>
                    )}
                  </span>
                  <span className={cn(
                    "text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ml-2 shrink-0",
                    allSpeakersMap.get(palestranteId)?.source === 'system' ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"
                  )}>
                    {allSpeakersMap.get(palestranteId)?.source === 'system' ? 'Usuário' : 'RH'}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tema" className="text-gray-700">Tema</Label>
              <Input
                id="tema"
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                placeholder="Ex: USO CORRETO DE EPIS"
                className="bg-white border-gray-300 text-black focus-visible:ring-black uppercase"
              />
            </div>
            
          </div>
          <DialogFooter>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="w-full sm:w-auto bg-black hover:bg-gray-800 text-white border-0"
            >
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog open={confirmAction.isOpen} onOpenChange={(open) => !open && setConfirmAction(prev => ({ ...prev, isOpen: false }))}>
        <DialogContent className="sm:max-w-[425px] bg-white border-gray-200 text-black">
          <DialogHeader>
            <DialogTitle className="font-bold text-2xl text-black">
              {confirmAction.title}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-[#495057] text-base">
            {confirmAction.message}
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" className="w-full sm:w-auto bg-white border-gray-300 text-black hover:bg-gray-50" onClick={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}>
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                confirmAction.action()
                setConfirmAction(prev => ({ ...prev, isOpen: false }))
              }}
              className="w-full sm:w-auto bg-black hover:bg-gray-800 text-white border-0"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload DDS Photo Modal */}
      <DdsUploadModal
        key={`dds-upload-modal-${uploadTarget.tema}-${uploadTarget.palestrante}-${isDdsModalOpen}`}
        isOpen={isDdsModalOpen}
        onClose={() => setIsDdsModalOpen(false)}
        tema={uploadTarget.tema || 'A DEFINIR'}
        palestrante={uploadTarget.palestrante || 'Livre'}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['dds_post_today'] })
          queryClient.invalidateQueries({ queryKey: ['dds_dashboard'] })
          refetchTodayPost()
          toast.success("Foto do DDS postada com sucesso!")
        }}
      />

      {/* Expanded Image Modal */}
      {expandedImage && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[99999] p-4 cursor-zoom-out"
          onClick={() => setExpandedImage(null)}
        >
          <img src={expandedImage} alt="Foto do DDS Expandida" className="max-w-[85vw] max-h-[80vh] object-contain rounded-lg shadow-2xl" />
          <button 
            className="absolute top-6 right-6 text-white p-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-md rounded-full transition-colors cursor-pointer border border-white/10 shadow-lg"
            onClick={(e) => {
              e.stopPropagation()
              setExpandedImage(null)
            }}
          >
            <X size={24} />
          </button>
        </div>
      )}
    </div>
  )
}
