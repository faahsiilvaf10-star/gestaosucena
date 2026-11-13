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
import ZoomIn from 'lucide-react/dist/esm/icons/zoom-in.js';
import Download from 'lucide-react/dist/esm/icons/download.js';
import Eye from 'lucide-react/dist/esm/icons/eye.js';
import MapPin from 'lucide-react/dist/esm/icons/map-pin.js';
import Clock from 'lucide-react/dist/esm/icons/clock.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';
import Paperclip from 'lucide-react/dist/esm/icons/paperclip.js';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link.js';
import Search from 'lucide-react/dist/esm/icons/search.js';
import Filter from 'lucide-react/dist/esm/icons/filter.js';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw.js';
import Folder from 'lucide-react/dist/esm/icons/folder.js';
import { createPortal } from 'react-dom';
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
import { DdsAttachmentModal } from '@/components/DdsAttachmentModal'
import { PdfViewerModal } from '@/components/PdfViewerModal'
import { getDdsAttachments, deleteDdsAttachment, DdsAttachment } from '@/lib/ddsAttachments'

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
  const [selectedDdsDetail, setSelectedDdsDetail] = useState<{
    id: string
    dateStr: string
    formattedDate: string
    mediaUrl: string
    tema: string
    palestrante: string
    corProibida?: string
    location?: string
    caption: string
    createdAt: string
    formattedTime: string
  } | null>(null)
  const [uploadTarget, setUploadTarget] = useState<{ tema: string; palestrante: string }>({
    tema: '',
    palestrante: ''
  })

  // Estados para Anexos / PDFs do DDS
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false)
  const [attachmentTargetDate, setAttachmentTargetDate] = useState<string | undefined>(undefined)
  const [selectedPdfViewer, setSelectedPdfViewer] = useState<{
    url: string
    title: string
    fileType?: string
  } | null>(null)

  const currentEnvironment = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'

  const { data: ddsAttachments = [], refetch: refetchAttachments } = useQuery({
    queryKey: ['dds_attachments', currentEnvironment],
    queryFn: async () => {
      return getDdsAttachments(currentEnvironment)
    }
  })

  const handleDeleteAttachment = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente excluir o anexo "${name}"?`)) return
    const ok = await deleteDdsAttachment(id, currentEnvironment)
    if (ok) {
      toast.success('Anexo excluído com sucesso!')
      refetchAttachments()
    } else {
      toast.error('Erro ao excluir anexo.')
    }
  }

  // Estados de Filtro para Arquivos DDS Mensal
  const [attMonthFilter, setAttMonthFilter] = useState<string>('current') // 'current' | 'all' | 'YYYY-MM'
  const [attTypeFilter, setAttTypeFilter] = useState<'all' | 'pdf' | 'image' | 'doc'>('all')
  const [attSearchQuery, setAttSearchQuery] = useState('')

  // Meses disponíveis para os documentos de DDS
  const availableAttMonths = useMemo(() => {
    const monthsMap = new Map<string, string>()
    const curMonthKey = format(currentMonth, 'yyyy-MM')
    monthsMap.set(curMonthKey, format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR }))

    ddsAttachments.forEach(att => {
      const m = att.month || att.date?.slice(0, 7) || att.uploadedAt?.slice(0, 7)
      if (m && !monthsMap.has(m)) {
        try {
          const [y, mon] = m.split('-')
          const d = new Date(parseInt(y), parseInt(mon) - 1, 1)
          monthsMap.set(m, format(d, "MMMM 'de' yyyy", { locale: ptBR }))
        } catch {
          monthsMap.set(m, m)
        }
      }
    })

    return Array.from(monthsMap.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [ddsAttachments, currentMonth])

  // Anexos filtrados por Mês, Tipo e Texto de Busca
  const filteredAttachments = useMemo(() => {
    const curMonthKey = format(currentMonth, 'yyyy-MM')
    return ddsAttachments.filter(att => {
      const attMonth = att.month || att.date?.slice(0, 7) || att.uploadedAt?.slice(0, 7)

      // 1. Filtro de Mês
      if (attMonthFilter === 'current') {
        if (attMonth !== curMonthKey) return false
      } else if (attMonthFilter !== 'all') {
        if (attMonth !== attMonthFilter) return false
      }

      // 2. Filtro de Tipo de Arquivo
      const isPdf = att.fileType === 'pdf' || att.name.toLowerCase().endsWith('.pdf')
      if (attTypeFilter === 'pdf' && !isPdf) return false
      if (attTypeFilter === 'image' && att.fileType !== 'image') return false
      if (attTypeFilter === 'doc' && (isPdf || att.fileType === 'image')) return false

      // 3. Filtro de Busca Textual
      if (attSearchQuery.trim()) {
        const q = attSearchQuery.toLowerCase()
        const matchName = att.name.toLowerCase().includes(q)
        const matchDesc = att.description?.toLowerCase().includes(q) || false
        const matchAuthor = att.uploadedBy?.toLowerCase().includes(q) || false
        if (!matchName && !matchDesc && !matchAuthor) return false
      }

      return true
    })
  }, [ddsAttachments, attMonthFilter, currentMonth, attTypeFilter, attSearchQuery])

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
        .order('nome', { ascending: true })
      if (error) {
        console.error("Erro ao buscar efetivo do RH:", error)
        throw error
      }
      return (data || []).filter((d: any) => {
        const s = (d.status || '').toUpperCase().trim();
        return s !== 'INATIVO' && s !== 'DEMITIDO' && s !== 'DESLIGADO';
      })
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
    queryKey: ['seguranca_dds_today', currentEnvironment, todayDateStr],
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
    queryKey: ['dds_post_today', currentEnvironment, todayDateStr],
    queryFn: async () => {
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const isCivil = currentEnvironment === 'hydro-civil'

      const { data, error } = await supabase
        .from('social_posts')
        .select(`
          id,
          caption,
          location,
          created_at,
          social_post_media (
            media_url
          )
        `)
        .like('caption', '%DDS Realizado!%')
        .gte('created_at', startOfToday.toISOString())
        .order('created_at', { ascending: false })

      if (error) {
        console.error("Erro ao buscar foto do DDS de hoje:", error)
        return null
      }

      const filtered = (data || []).filter((p: any) => {
        const loc = (p.location || '').toUpperCase()
        const cap = (p.caption || '').toUpperCase()
        const isCivilPost = loc.includes('CIVIL') || cap.includes('[HYDRO CIVIL]')
        return isCivil ? isCivilPost : !isCivilPost
      })

      const targetPost = filtered[0] || null
      const mediaUrl = targetPost?.social_post_media?.[0]?.media_url || null
      return { post: targetPost, mediaUrl }
    },
    refetchInterval: 30000,
    staleTime: 10000
  })

  // Palestrante de hoje
  const todayPalestrante = useMemo(() => {
    if (!todayDdsData?.palestrante_id) return null
    return allSpeakersMap.get(todayDdsData.palestrante_id) || null
  }, [todayDdsData, allSpeakersMap])

  // Buscar todas as fotos postadas de DDS no sistema
  const { data: allDdsPosts = [], refetch: refetchAllDdsPosts } = useQuery({
    queryKey: ['all_dds_posts', currentEnvironment],
    queryFn: async () => {
      const isCivil = currentEnvironment === 'hydro-civil'
      const { data, error } = await supabase
        .from('social_posts')
        .select(`
          id,
          user_id,
          caption,
          location,
          created_at,
          social_post_media (
            media_url
          )
        `)
        .or('caption.ilike.%DDS%,post_type.eq.dds')
        .order('created_at', { ascending: false })

      if (error) {
        console.error("Erro ao buscar todos os posts de DDS:", error)
        return []
      }

      const filtered = (data || []).filter((p: any) => {
        const loc = (p.location || '').toUpperCase()
        const cap = (p.caption || '').toUpperCase()
        const isCivilPost = loc.includes('CIVIL') || cap.includes('[HYDRO CIVIL]')
        return isCivil ? isCivilPost : !isCivilPost
      })

      const parsed: Array<{
        id: string
        dateStr: string
        formattedDate: string
        mediaUrl: string
        tema: string
        palestrante: string
        corProibida?: string
        location?: string
        caption: string
        createdAt: string
        formattedTime: string
      }> = []

      filtered.forEach(post => {
        const mediaUrl = post.social_post_media?.[0]?.media_url
        if (!mediaUrl) return

        const caption = post.caption || ''

        let dateStr = ''
        let formattedDate = ''
        const dateMatch = caption.match(/\*\*Data:\*\*\s*(\d{2})\/(\d{2})\/(\d{4})/)
        if (dateMatch) {
          const [_, d, m, y] = dateMatch
          dateStr = `${y}-${m}-${d}`
          formattedDate = `${d}/${m}/${y}`
        } else {
          const dt = new Date(post.created_at)
          const y = dt.getFullYear()
          const m = String(dt.getMonth() + 1).padStart(2, '0')
          const d = String(dt.getDate()).padStart(2, '0')
          dateStr = `${y}-${m}-${d}`
          formattedDate = `${d}/${m}/${y}`
        }

        const temaMatch = caption.match(/\*\*Tema:\*\*\s*([^\n*]+)/)
        const tema = temaMatch ? temaMatch[1].trim() : 'DDS'

        const palestranteMatch = caption.match(/\*\*Palestrante:\*\*\s*([^\n*]+)/)
        const palestrante = palestranteMatch ? palestranteMatch[1].trim() : 'Livre'

        const corMatch = caption.match(/\*\*Cor Proibida do Mês:\*\*\s*([^\n*]+)/)
        const corProibida = corMatch ? corMatch[1].trim() : ''

        const createdDt = new Date(post.created_at)
        const formattedTime = createdDt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

        parsed.push({
          id: post.id,
          dateStr,
          formattedDate,
          mediaUrl,
          tema,
          palestrante,
          corProibida,
          location: post.location || 'HYDRO REABILITAÇÃO',
          caption,
          createdAt: post.created_at,
          formattedTime
        })
      })

      return parsed
    },
    refetchInterval: 30000,
    staleTime: 10000
  })

  // Mapeamento dateStr -> post de DDS
  const ddsPostsByDate = useMemo(() => {
    const map = new Map<string, typeof allDdsPosts[0]>()
    allDdsPosts.forEach(post => {
      if (!map.has(post.dateStr)) {
        map.set(post.dateStr, post)
      }
    })
    return map
  }, [allDdsPosts])

  // Download da foto do DDS em alta resolução
  const handleDownloadDdsPhoto = async (url: string, dateStr: string, speakerName?: string) => {
    try {
      toast.loading('Iniciando download da foto do DDS...', { id: 'download-dds' })
      const res = await fetch(url)
      const blob = await res.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const safeSpeaker = (speakerName || 'palestrante').replace(/[^a-zA-Z0-9_-]/g, '_')
      const fileName = `DDS_${dateStr}_${safeSpeaker}.jpg`
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(blobUrl)
      toast.success('Foto baixada com sucesso!', { id: 'download-dds' })
    } catch (err) {
      console.warn('Erro ao baixar foto diretamente:', err)
      window.open(url, '_blank')
      toast.info('Abrindo foto em nova aba para salvar.', { id: 'download-dds' })
    }
  }

  const handleOpenDdsUpload = (targetTema?: string, targetPalestrante?: string) => {
    const t = targetTema !== undefined && targetTema !== '' ? targetTema : (todayDdsData?.tema || 'A DEFINIR')
    const p = targetPalestrante !== undefined && targetPalestrante !== '' ? targetPalestrante.trim() : (todayPalestrante?.nome?.trim() || '')
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
    queryKey: ['seguranca_dds', currentEnvironment, monthStartStr, monthEndStr],
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
      queryClient.invalidateQueries({ queryKey: ['dds_dashboard'] })
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
      queryClient.invalidateQueries({ queryKey: ['dds_dashboard'] })
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
              {todayPalestrante?.avatar_url ? (
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

          {/* Foto do DDS em Tamanho Real na Página (Abaixo do nome do Palestrante) */}
          {todayPostData?.mediaUrl && (
            <div 
              className="mt-5 w-full rounded-2xl overflow-hidden border border-gray-200 shadow-sm relative group bg-black/5 cursor-pointer"
              onClick={() => setExpandedImage(todayPostData.mediaUrl)}
              title="Clique para ver a foto do DDS ampliada em tela cheia"
            >
              <img 
                src={todayPostData.mediaUrl} 
                alt="Foto do DDS de Hoje" 
                className="w-full h-auto max-h-[520px] object-cover sm:object-contain rounded-2xl transition-transform duration-300 group-hover:scale-[1.005]" 
              />
              <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDownloadDdsPhoto(todayPostData.mediaUrl, todayDateStr, todayPalestrante?.nome)
                  }}
                  title="Baixar foto do DDS de hoje em alta resolução"
                  className="bg-black/80 hover:bg-black text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Foto</span>
                </button>
              </div>
              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white pointer-events-none">
                <span className="bg-black/70 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg">
                  <ZoomIn className="w-4 h-4" />
                  Clique para ver em tela cheia
                </span>
              </div>
            </div>
          )}
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
              onClick={() => {
                const curMonthStr = format(currentMonth, 'yyyy-MM')
                setAttachmentTargetDate(todayDateStr.startsWith(curMonthStr) ? todayDateStr : `${curMonthStr}-01`)
                setIsAttachmentModalOpen(true)
              }} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium border-0 shadow-sm"
              title="Anexar múltiplos arquivos ou PDFs para salvar por mês no banco de dados"
            >
              <Paperclip className="w-4 h-4 mr-2" />
              Anexar Arquivos DDS Mensal
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

        {/* Seção: Arquivos DDS Mensal */}
        <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h2 className="text-xl font-bold text-black">Arquivos DDS Mensal</h2>
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {filteredAttachments.length} {filteredAttachments.length === 1 ? 'arquivo' : 'arquivos'}
                  {ddsAttachments.length !== filteredAttachments.length && (
                    <span className="text-emerald-700/70 font-normal ml-1">
                      (de {ddsAttachments.length})
                    </span>
                  )}
                </span>
                {attMonthFilter === 'current' && (
                  <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize">
                    Mês: {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                )}
              </div>
              <p className="text-gray-500 text-sm mt-0.5">
                Documentos, atas, listas de presença e materiais salvos por mês no banco de dados
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                const curMonthStr = format(currentMonth, 'yyyy-MM')
                setAttachmentTargetDate(todayDateStr.startsWith(curMonthStr) ? todayDateStr : `${curMonthStr}-01`)
                setIsAttachmentModalOpen(true)
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Novo Anexo / PDF
            </Button>
          </div>

          {/* Barra de Filtros e Busca */}
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Campo de Busca */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={attSearchQuery}
                onChange={e => setAttSearchQuery(e.target.value)}
                placeholder="Buscar por nome, autor ou descrição..."
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-800 placeholder:text-gray-400 outline-none focus:border-emerald-500 transition"
              />
              {attSearchQuery && (
                <button
                  type="button"
                  onClick={() => setAttSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filtro de Mês */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 flex items-center gap-1 shrink-0">
                <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
                Mês:
              </span>
              <select
                value={attMonthFilter}
                onChange={e => setAttMonthFilter(e.target.value)}
                className="text-xs font-semibold bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 outline-none focus:border-emerald-500 transition cursor-pointer capitalize"
              >
                <option value="current">
                  Mês Atual ({format(currentMonth, "MMMM yyyy", { locale: ptBR })})
                </option>
                <option value="all">Todos os Meses</option>
                {availableAttMonths
                  .filter(([m]) => m !== format(currentMonth, 'yyyy-MM'))
                  .map(([monthKey, label]) => (
                    <option key={monthKey} value={monthKey}>
                      {label}
                    </option>
                  ))}
              </select>
            </div>

            {/* Filtro de Tipo (Pills) */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAttTypeFilter('all')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  attTypeFilter === 'all'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-black hover:bg-gray-100'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setAttTypeFilter('pdf')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  attTypeFilter === 'pdf'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-black hover:bg-gray-100'
                }`}
              >
                PDFs
              </button>
              <button
                type="button"
                onClick={() => setAttTypeFilter('image')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  attTypeFilter === 'image'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-black hover:bg-gray-100'
                }`}
              >
                Imagens
              </button>
              <button
                type="button"
                onClick={() => setAttTypeFilter('doc')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  attTypeFilter === 'doc'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-gray-600 hover:text-black hover:bg-gray-100'
                }`}
              >
                Outros
              </button>
            </div>

            {/* Botão Limpar Filtros */}
            {(attMonthFilter !== 'current' || attTypeFilter !== 'all' || attSearchQuery.trim() !== '') && (
              <button
                type="button"
                onClick={() => {
                  setAttMonthFilter('current')
                  setAttTypeFilter('all')
                  setAttSearchQuery('')
                }}
                className="text-xs font-semibold text-gray-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition cursor-pointer"
                title="Restaurar filtros padrões"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Limpar
              </button>
            )}
          </div>

          {/* Cards ou Empty State */}
          {filteredAttachments.length === 0 ? (
            <div className="border border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-500 text-sm bg-gray-50/40">
              <FileText className="w-10 h-10 mx-auto text-gray-300 mb-2" />
              {ddsAttachments.length === 0 ? (
                <>
                  <p className="font-semibold text-gray-700">Nenhum arquivo ou PDF anexado ainda.</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Clique no botão "Novo Anexo / PDF" para adicionar e salvar no mês selecionado.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-gray-700">Nenhum documento encontrado com os filtros selecionados.</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Tente selecionar outro mês, limpar a busca ou alternar para "Todos os Meses".
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAttMonthFilter('all')
                      setAttTypeFilter('all')
                      setAttSearchQuery('')
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Mostrar Todos os Meses ({ddsAttachments.length})
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredAttachments.map((att) => {
                const isPdf = att.fileType === 'pdf' || att.name.toLowerCase().endsWith('.pdf')
                return (
                  <div
                    key={att.id}
                    className="border border-gray-200/90 hover:border-emerald-500/60 rounded-xl p-4 bg-gray-50/60 hover:bg-emerald-50/20 transition-all flex flex-col justify-between shadow-xs group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                            isPdf
                              ? 'bg-red-500/15 text-red-700'
                              : att.fileType === 'image'
                              ? 'bg-blue-500/15 text-blue-700'
                              : 'bg-emerald-500/15 text-emerald-700'
                          }`}
                        >
                          {isPdf ? 'PDF' : att.fileType.toUpperCase()}
                        </span>
                        {att.date ? (
                          <span className="text-[11px] font-bold text-gray-600 flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3 text-gray-400" />
                            {format(new Date(att.date + 'T12:00:00'), 'dd/MM/yyyy')}
                          </span>
                        ) : att.month ? (
                          <span className="text-[11px] font-bold text-gray-600 flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3 text-gray-400" />
                            {att.month}
                          </span>
                        ) : null}
                      </div>

                      <h4
                        className="font-bold text-sm text-gray-900 group-hover:text-emerald-700 transition truncate mb-1"
                        title={att.name}
                      >
                        {att.name}
                      </h4>

                      {att.description && (
                        <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                          {att.description}
                        </p>
                      )}

                      <div className="text-[11px] text-gray-400">
                        {att.uploadedBy && <span>Enviado por {att.uploadedBy} • </span>}
                        <span>{format(new Date(att.uploadedAt), "dd/MM/yy 'às' HH:mm")}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-200/60">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedPdfViewer({
                            url: att.url,
                            title: att.name,
                            fileType: att.fileType
                          })
                        }
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        title="Visualizar em tela cheia"
                      >
                        <Eye size={14} />
                        <span>Ver em Tela Cheia</span>
                      </button>

                      <a
                        href={att.url}
                        download={att.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg border border-gray-300 hover:bg-white text-gray-700 transition cursor-pointer"
                        title="Baixar arquivo / PDF"
                      >
                        <Download size={14} />
                      </a>

                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(att.id, att.name)}
                        className="p-1.5 rounded-lg border border-gray-300 hover:bg-red-50 text-gray-500 hover:text-red-600 transition cursor-pointer"
                        title="Excluir do banco"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
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
                  <th className="px-6 py-4 whitespace-nowrap">Foto do DDS</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {workDays.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const entry = scheduleMap.get(dateStr)
                  const post = ddsPostsByDate.get(dateStr)
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        {post ? (
                          <div className="flex items-center gap-2.5">
                            <div 
                              onClick={() => setSelectedDdsDetail(post)}
                              className="relative group/thumb cursor-pointer w-11 h-11 rounded-xl overflow-hidden border border-gray-200 shadow-xs hover:ring-2 hover:ring-blue-500 transition-all shrink-0 bg-gray-100"
                              title="Clique para ver a foto com todos os detalhes"
                            >
                              <img 
                                src={post.mediaUrl} 
                                alt="Foto do DDS" 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" 
                              />
                              <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                <Eye className="w-4 h-4" />
                              </div>
                            </div>
                            <div className="flex flex-col">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full w-fit">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Foto postada
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                <button
                                  type="button"
                                  onClick={() => handleDownloadDdsPhoto(post.mediaUrl, post.dateStr, post.palestrante || entry?.palestrante?.nome)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                                  title="Baixar foto do DDS"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Baixar</span>
                                </button>
                                <span className="text-gray-300">•</span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedDdsDetail(post)}
                                  className="text-[11px] text-gray-500 hover:text-gray-800 transition-colors font-medium"
                                >
                                  Detalhes
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenDdsUpload(entry?.tema, entry?.palestrante?.nome)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-gray-300 transition-colors"
                            title="Postar foto deste DDS"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Adicionar</span>
                          </button>
                        )}
                        {(() => {
                          const dayAtts = ddsAttachments.filter(a => a.date === dateStr)
                          if (dayAtts.length === 0) return null
                          return (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {dayAtts.map(att => (
                                <button
                                  key={att.id}
                                  type="button"
                                  onClick={() => setSelectedPdfViewer({ url: att.url, title: att.name, fileType: att.fileType })}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100 transition cursor-pointer"
                                  title={`Ver ${att.name} em tela cheia`}
                                >
                                  <Paperclip className="w-2.5 h-2.5 text-emerald-600" />
                                  <span className="truncate max-w-[100px]">{att.name}</span>
                                </button>
                              ))}
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            type="button"
                            onClick={() => {
                              setAttachmentTargetDate(dateStr)
                              setIsAttachmentModalOpen(true)
                            }}
                            title="Anexar arquivos ou PDF neste dia"
                            className="p-2 text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
                          >
                            <Paperclip className="w-4 h-4" />
                          </button>
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
              const post = ddsPostsByDate.get(dateStr)
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

                    {/* Foto do DDS Mobile */}
                    {post ? (
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex items-center gap-3">
                        <div 
                          onClick={() => setSelectedDdsDetail(post)}
                          className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-gray-200 relative group cursor-pointer"
                          title="Clique para ver detalhes e foto ampliada"
                        >
                          <img src={post.mediaUrl} alt="Foto do DDS" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/25 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            <Eye className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Foto do DDS
                          </span>
                          <div className="flex items-center gap-3 mt-2">
                            <button
                              type="button"
                              onClick={() => handleDownloadDdsPhoto(post.mediaUrl, post.dateStr, post.palestrante || entry?.palestrante?.nome)}
                              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800"
                            >
                              <Download className="w-3.5 h-3.5" /> Baixar
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedDdsDetail(post)}
                              className="text-xs text-gray-600 hover:text-black font-medium"
                            >
                              Ver detalhes
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenDdsUpload(entry?.tema, entry?.palestrante?.nome)}
                        className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-gray-600 hover:text-blue-600 bg-gray-50 border border-dashed border-gray-300 rounded-xl transition-colors"
                      >
                        <Camera className="w-4 h-4" />
                        Adicionar Foto do DDS
                      </button>
                    )}
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
                            className="text-black hover:bg-slate-900 hover:text-white cursor-pointer flex items-center justify-between py-2.5 px-3 rounded-lg group data-[selected=true]:bg-slate-900 data-[selected=true]:text-white transition-colors"
                          >
                            <div className="flex items-center min-w-0 mr-2">
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4 shrink-0 text-blue-600 group-data-[selected=true]:text-white group-hover:text-white",
                                  palestranteId === emp.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="truncate">
                                <span className="font-medium text-sm text-gray-900 group-data-[selected=true]:text-white group-data-[selected=true]:font-bold group-hover:text-white">
                                  {emp.nome}
                                </span>
                                {emp.cargo && (
                                  <span className="text-gray-500 group-data-[selected=true]:text-gray-100 group-hover:text-gray-100 text-xs ml-1.5 block sm:inline truncate">
                                    • {emp.cargo}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className={cn(
                              "text-[10px] uppercase font-bold px-2 py-0.5 rounded shrink-0 transition-colors",
                              emp.source === 'system'
                                ? "bg-blue-50 text-blue-700 border border-blue-200 group-data-[selected=true]:bg-white group-data-[selected=true]:text-blue-900 group-data-[selected=true]:border-transparent group-hover:bg-white group-hover:text-blue-900"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200 group-data-[selected=true]:bg-white group-data-[selected=true]:text-emerald-900 group-data-[selected=true]:border-transparent group-hover:bg-white group-hover:text-emerald-900"
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
          queryClient.invalidateQueries({ queryKey: ['all_dds_posts'] })
          queryClient.invalidateQueries({ queryKey: ['dds_dashboard'] })
          refetchTodayPost()
          refetchAllDdsPosts()
          toast.success("Foto do DDS postada com sucesso!")
        }}
      />

      {/* Modal com Todos os Detalhes e Download da Foto do DDS */}
      {selectedDdsDetail && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 cursor-default animate-in fade-in duration-200"
          style={{ zIndex: 9999999 }}
          onClick={() => setSelectedDdsDetail(null)}
        >
          <div 
            className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Imagem em Destaque */}
            <div className="relative md:w-3/5 bg-black flex items-center justify-center overflow-hidden min-h-[300px] md:min-h-[500px]">
              <img 
                src={selectedDdsDetail.mediaUrl} 
                alt="Foto do DDS" 
                className="w-full h-full max-h-[75vh] object-contain cursor-zoom-in"
                onClick={() => setExpandedImage(selectedDdsDetail.mediaUrl)}
                title="Clique para ver em tela cheia"
              />
              <button 
                type="button"
                onClick={() => setExpandedImage(selectedDdsDetail.mediaUrl)}
                className="absolute bottom-3 left-3 bg-black/60 hover:bg-black/80 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-md flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" /> Tela cheia
              </button>
            </div>

            {/* Painel de Detalhes e Download */}
            <div className="md:w-2/5 p-6 flex flex-col justify-between overflow-y-auto max-h-[92vh]">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" /> DDS Realizado
                  </span>
                  <button 
                    onClick={() => setSelectedDdsDetail(null)}
                    className="p-2 rounded-full text-gray-400 hover:text-black hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <h3 className="text-xl font-bold text-gray-900 leading-snug mb-4">
                  {selectedDdsDetail.tema || 'DDS Realizado'}
                </h3>

                <div className="space-y-3.5 border-t border-b border-gray-100 py-4 text-sm">
                  <div className="flex items-start gap-3">
                    <CalendarIcon className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Data do DDS</p>
                      <p className="font-semibold text-gray-800">{selectedDdsDetail.formattedDate}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Users className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Palestrante</p>
                      <p className="font-semibold text-gray-800">{selectedDdsDetail.palestrante || 'Livre'}</p>
                    </div>
                  </div>

                  {selectedDdsDetail.corProibida && (
                    <div className="flex items-start gap-3">
                      <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Cor Proibida do Mês</p>
                        <p className="font-semibold text-gray-800">{selectedDdsDetail.corProibida}</p>
                      </div>
                    </div>
                  )}

                  {selectedDdsDetail.location && (
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Ambiente / Unidade</p>
                        <p className="font-semibold text-gray-800">{selectedDdsDetail.location}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Horário da Postagem</p>
                      <p className="font-medium text-gray-600">
                        {new Date(selectedDdsDetail.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </div>

                {selectedDdsDetail.caption && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Legenda / Informações Completas
                    </p>
                    <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {selectedDdsDetail.caption.replace(/[*#]/g, '')}
                    </p>
                  </div>
                )}
              </div>

              {/* Ação de Download com Alta Resolução */}
              <div className="pt-5 mt-4 border-t border-gray-100">
                <Button
                  onClick={() => handleDownloadDdsPhoto(selectedDdsDetail.mediaUrl, selectedDdsDetail.dateStr, selectedDdsDetail.palestrante)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Download className="w-5 h-5" />
                  <span>Baixar Foto (Alta Resolução)</span>
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Expanded Image Modal */}
      {expandedImage && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          style={{ zIndex: 9999999 }}
          onClick={() => setExpandedImage(null)}
        >
          <img src={expandedImage} alt="Foto do DDS Expandida" className="max-w-[85vw] max-h-[80vh] object-contain rounded-lg shadow-2xl" />
          <button 
            className="absolute top-6 right-6 text-white p-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-md rounded-full transition-colors cursor-pointer border border-white/10 shadow-lg"
            style={{ zIndex: 10000000 }}
            onClick={(e) => {
              e.stopPropagation()
              setExpandedImage(null)
            }}
          >
            <X size={24} />
          </button>
        </div>,
        document.body
      )}

      {/* Modal de Upload de Múltiplos Arquivos e PDFs do DDS */}
      <DdsAttachmentModal
        isOpen={isAttachmentModalOpen}
        onClose={() => setIsAttachmentModalOpen(false)}
        currentDate={attachmentTargetDate}
        currentMonth={format(currentMonth, 'yyyy-MM')}
        environment={currentEnvironment}
        onSuccess={() => refetchAttachments()}
      />

      {/* Modal de Visualização em Tela Cheia do PDF / Arquivo */}
      <PdfViewerModal
        isOpen={!!selectedPdfViewer}
        onClose={() => setSelectedPdfViewer(null)}
        url={selectedPdfViewer?.url || null}
        title={selectedPdfViewer?.title || 'Documento do DDS'}
        fileType={selectedPdfViewer?.fileType}
      />
    </div>
  )
}
