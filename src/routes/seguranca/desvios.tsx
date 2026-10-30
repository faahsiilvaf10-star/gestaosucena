import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { isAdmin } from '@/components/ui/VerifiedBadge'
import { notificarDesvioRegistrado } from '@/lib/desviosWhatsapp'
import {
  ArrowLeft,
  TriangleAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Printer,
  Copy,
  RotateCcw,
  Trash2,
  Camera,
  User,
  Calendar,
  MapPin,
  Lock,
  Plus,
  X,
  Search,
  ExternalLink,
} from 'lucide-react'

export const Route = createFileRoute('/seguranca/desvios')({
  component: DesviosPage,
})

export interface ColaboradorRH {
  id: string
  nome: string
  cargo: string
  matricula?: string
  source: 'rh' | 'system'
}

export interface DesvioRegistro {
  uid: string
  dataRegistro: string
  tecnico: string
  local: string
  area: string
  titulo: string
  descricao: string
  categoria: string
  etiqueta: string
  prioridade: string
  risco: string
  gravidade: string
  previsao: string
  sugestao: string
  respCorrecao: string
  respCorrecaoList?: string[]
  empresa: string
  comentarios: string
  statusFluxo: string
  foto: string
  fotos: string[]
  corrigido: boolean
  correcaoTexto: string
  fotoCorrecao: string
  dataCorrecao: string
  salvoEm: string
}

export interface AuditRecord {
  id: string
  data: string
  usuario: string
  acao: string
  comentario: string
}

function fmtDateBr(v?: string): string {
  if (!v) return '—'
  const p = String(v).split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : v
}

function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function diasAte(v?: string): number | null {
  if (!v) return null
  const a = new Date(`${hojeISO()}T12:00:00`)
  const b = new Date(`${v}T12:00:00`)
  return Math.round((b.getTime() - a.getTime()) / 864e5)
}

function previsaoTxt(d: DesvioRegistro): string {
  const n = diasAte(d.previsao)
  if (d.corrigido) return `Data limite era ${fmtDateBr(d.previsao)}`
  if (n === null) return 'Sem data limite'
  if (n < 0) return `🔴 Data limite: ${fmtDateBr(d.previsao)} — VENCIDO há ${Math.abs(n)} dia(s)`
  if (n === 0) return `⏰ Data limite: ${fmtDateBr(d.previsao)} — vence HOJE`
  return `⏰ Data limite para corrigir: ${fmtDateBr(d.previsao)} — faltam ${n} dia(s)`
}

function isVencido(d: DesvioRegistro): boolean {
  if (d.corrigido) return false
  const n = diasAte(d.previsao)
  return n !== null && n < 0
}

function DesviosPage() {
  const currentEnv = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
  const currentUserName = typeof window !== 'undefined' ? localStorage.getItem('sucena_user_name') || '' : ''
  const currentUserRole = typeof window !== 'undefined' ? localStorage.getItem('sucena_user_role') || '' : ''
  const storageKey = `desvios_seguranca_${currentEnv}`
  const auditKey = `desvios_seguranca_audit_${currentEnv}`

  // Estado do Formulário Novo Desvio
  const [statusSel, setStatusSel] = useState('Aberto')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [local, setLocal] = useState('')
  const [area, setArea] = useState('')

  // Suporte a múltiplas fotos no desvio
  const [fotosDesvio, setFotosDesvio] = useState<string[]>([])
  const [modalFoto, setModalFoto] = useState<string | null>(null)

  const [sugestao, setSugestao] = useState('')
  const [etiqueta, setEtiqueta] = useState('Selecionar etiquetas...')
  const [categoria, setCategoria] = useState('EPI / EPC')
  const [risco, setRisco] = useState('Queda de altura')
  const [gravidade, setGravidade] = useState('Alto — pode causar acidente grave')

  // Técnico de Segurança (selecionado do RH)
  const [tecnico, setTecnico] = useState(currentUserName)
  const [tecnicoBusca, setTecnicoBusca] = useState('')
  const [tecnicoDropdownOpen, setTecnicoDropdownOpen] = useState(false)

  // Pessoas Responsáveis (múltipla seleção do RH)
  const [responsaveisSel, setResponsaveisSel] = useState<string[]>([])
  const [respBusca, setRespBusca] = useState('')
  const [respDropdownOpen, setRespDropdownOpen] = useState(false)

  const [empresa, setEmpresa] = useState('')
  const [prioridadeSel, setPrioridadeSel] = useState('Alta')
  const [previsao, setPrevisao] = useState(() => {
    const pv = new Date(Date.now() + 3 * 864e5)
    return pv.toISOString().slice(0, 10)
  })
  const [dataRegistro, setDataRegistro] = useState(() => hojeISO())
  const [comentarios, setComentarios] = useState('')

  // Colaboradores do RH e Usuários do Sistema
  const [colaboradoresRH, setColaboradoresRH] = useState<ColaboradorRH[]>([])

  // Validação & Feedbacks
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({})
  const [saveFeedback, setSaveFeedback] = useState<{ msg: string; tipo: 'erro' | 'ok' } | null>(null)

  // Desvios e Auditoria
  const [desvios, setDesvios] = useState<DesvioRegistro[]>([])
  const [auditList, setAuditList] = useState<AuditRecord[]>([])
  const [filtroAtual, setFiltroAtual] = useState<'todos' | 'pendentes' | 'corrigidos' | 'vencidos'>('todos')

  // Rascunhos de correção por desvio: { [uid]: { foto: string, texto: string, erro?: string, info?: string } }
  const [correcaoDraft, setCorrecaoDraft] = useState<Record<string, { foto: string; texto: string; erro?: string; info?: string }>>({})

  // Permissão para alterar Status: apenas Técnico de Segurança ou Administrador
  const isTecnicoSeguranca = useMemo(() => {
    const roleLower = currentUserRole.toLowerCase()
    const nameLower = currentUserName.toLowerCase()
    const tecLower = tecnico.toLowerCase()
    return (
      isAdmin(currentUserName, currentUserRole) ||
      roleLower.includes('seguran') ||
      roleLower.includes('tst') ||
      roleLower.includes('tec') ||
      (tecLower && nameLower === tecLower)
    )
  }, [currentUserName, currentUserRole, tecnico])

  // Carregar dados do Supabase e Colaboradores do RH
  useEffect(() => {
    const carregar = async () => {
      try {
        // 1. Colaboradores do RH e Usuários
        const [sysRes, rhRes] = await Promise.all([
          supabase.rpc('get_system_users'),
          supabase.from('rh_efetivo').select('id, nome, cargo, status, matricula'),
        ])

        const list: ColaboradorRH[] = []
        const ids = new Set<string>()

        ;(sysRes.data || []).forEach((u: any) => {
          if (u.id && u.nome) {
            ids.add(u.id)
            list.push({
              id: u.id,
              nome: u.nome.trim(),
              cargo: u.cargo || 'Usuário do Sistema',
              source: 'system',
            })
          }
        })

        ;(rhRes.data || []).forEach((e: any) => {
          const s = (e.status || '').toUpperCase().trim()
          if (s === 'INATIVO' || s === 'DEMITIDO' || s === 'DESLIGADO') return
          if (e.id && e.nome && !ids.has(e.id)) {
            list.push({
              id: e.id,
              nome: e.nome.trim(),
              cargo: e.cargo || 'Efetivo RH',
              matricula: e.matricula,
              source: 'rh',
            })
          }
        })

        list.sort((a, b) => a.nome.localeCompare(b.nome))
        setColaboradoresRH(list)

        // Se o técnico atual ainda não estiver definido, sugere o usuário logado
        if (!tecnico && currentUserName) {
          setTecnico(currentUserName)
        }

        // 2. Desvios
        const { data: dbData } = await supabase
          .from('global_settings')
          .select('value')
          .eq('key', storageKey)
          .maybeSingle()

        if (dbData?.value) {
          const parsed = typeof dbData.value === 'string' ? JSON.parse(dbData.value) : dbData.value
          if (Array.isArray(parsed)) {
            // Garantir que todos tenham array de fotos
            const normalizados = parsed.map((d: any) => ({
              ...d,
              fotos: Array.isArray(d.fotos) ? d.fotos : d.foto ? [d.foto] : [],
            }))
            setDesvios(normalizados)
          }
        } else {
          const localStr = localStorage.getItem(storageKey)
          if (localStr) setDesvios(JSON.parse(localStr))
        }

        // 3. Auditoria
        const { data: dbAudit } = await supabase
          .from('global_settings')
          .select('value')
          .eq('key', auditKey)
          .maybeSingle()

        if (dbAudit?.value) {
          const parsedA = typeof dbAudit.value === 'string' ? JSON.parse(dbAudit.value) : dbAudit.value
          if (Array.isArray(parsedA)) setAuditList(parsedA)
        } else {
          const localA = localStorage.getItem(auditKey)
          if (localA) setAuditList(JSON.parse(localA))
        }
      } catch (err) {
        console.warn('[Desvios] Erro ao carregar dados:', err)
      }
    }

    carregar()

    // Realtime sync
    const channel = supabase
      .channel('desvios_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'global_settings', filter: `key=eq.${storageKey}` },
        (payload: any) => {
          if (payload?.new?.value && Array.isArray(payload.new.value)) {
            const normalizados = payload.new.value.map((d: any) => ({
              ...d,
              fotos: Array.isArray(d.fotos) ? d.fotos : d.foto ? [d.foto] : [],
            }))
            setDesvios(normalizados)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'global_settings', filter: `key=eq.${auditKey}` },
        (payload: any) => {
          if (payload?.new?.value && Array.isArray(payload.new.value)) {
            setAuditList(payload.new.value)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [storageKey, auditKey, currentUserName])

  // Persistência com Supabase
  const persistirDesvios = async (novos: DesvioRegistro[]) => {
    setDesvios(novos)
    try {
      localStorage.setItem(storageKey, JSON.stringify(novos))
    } catch (_) {}

    try {
      const { data: existing } = await supabase
        .from('global_settings')
        .select('id')
        .eq('key', storageKey)
        .maybeSingle()

      if (existing) {
        await supabase.from('global_settings').update({ value: novos }).eq('key', storageKey)
      } else {
        await supabase.from('global_settings').insert({ key: storageKey, value: novos })
      }
    } catch (err) {
      console.warn('Erro ao persistir desvios no Supabase:', err)
    }
  }

  const logAudit = async (usuario: string, acao: string, comentario: string) => {
    const novoItem: AuditRecord = {
      id: `audit-${Date.now()}-${Math.random()}`,
      data: new Date().toLocaleString('pt-BR'),
      usuario: usuario || currentUserName || 'Usuário',
      acao,
      comentario: comentario || '',
    }
    const novosAudit = [novoItem, ...auditList]
    setAuditList(novosAudit)

    try {
      localStorage.setItem(auditKey, JSON.stringify(novosAudit))
    } catch (_) {}

    try {
      const { data: existing } = await supabase
        .from('global_settings')
        .select('id')
        .eq('key', auditKey)
        .maybeSingle()

      if (existing) {
        await supabase.from('global_settings').update({ value: novosAudit }).eq('key', auditKey)
      } else {
        await supabase.from('global_settings').insert({ key: auditKey, value: novosAudit })
      }

      await supabase.from('system_activities').insert({
        module: 'Segurança',
        action: `Desvio de Segurança: ${acao} - ${comentario.slice(0, 80)}`,
        user_name: usuario || currentUserName,
        environment: currentEnv,
      })
    } catch (_) {}
  }

  // Upload de Múltiplas Fotos
  const handleFotosDesvioUpload = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const files = ev.target.files
    if (!files || files.length === 0) return

    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const res = e.target?.result as string
        if (res) {
          setFotosDesvio((prev) => [...prev, res])
        }
      }
      reader.readAsDataURL(file)
    })

    toast.success(`${files.length} foto(s) selecionada(s)!`)
    ev.target.value = ''
  }

  const handleRemoverFotoDesvio = (index: number) => {
    setFotosDesvio((prev) => prev.filter((_, i) => i !== index))
  }

  // Filtros de colaboradores para busca
  const colaboradoresFiltradosTecnico = useMemo(() => {
    if (!tecnicoBusca.trim()) return colaboradoresRH.slice(0, 30)
    const q = tecnicoBusca.toLowerCase()
    return colaboradoresRH.filter(
      (c) => c.nome.toLowerCase().includes(q) || c.cargo.toLowerCase().includes(q)
    )
  }, [colaboradoresRH, tecnicoBusca])

  const colaboradoresFiltradosResp = useMemo(() => {
    if (!respBusca.trim()) return colaboradoresRH.slice(0, 30)
    const q = respBusca.toLowerCase()
    return colaboradoresRH.filter(
      (c) =>
        !responsaveisSel.includes(c.nome) &&
        (c.nome.toLowerCase().includes(q) || c.cargo.toLowerCase().includes(q))
    )
  }, [colaboradoresRH, respBusca, responsaveisSel])

  // Salvar Novo Desvio
  const handleSalvarDesvio = () => {
    setSaveFeedback(null)
    const novosInvalid: Record<string, boolean> = {}
    const faltas: string[] = []

    if (!dataRegistro) {
      faltas.push('DATA DO REGISTRO')
      novosInvalid.dataRegistro = true
    }
    if (!tecnico.trim()) {
      faltas.push('TÉCNICO DE SEGURANÇA')
      novosInvalid.tecnico = true
    }
    if (!local.trim()) {
      faltas.push('LOCAL / FRENTE DE OBRA')
      novosInvalid.local = true
    }
    if (!titulo.trim()) {
      faltas.push('TÍTULO DO DESVIO')
      novosInvalid.titulo = true
    }
    if (!descricao.trim()) {
      faltas.push('DESCRIÇÃO DO DESVIO')
      novosInvalid.descricao = true
    }
    if (!previsao) {
      faltas.push('DATA LIMITE PARA CORRIGIR')
      novosInvalid.previsao = true
    }

    setInvalidFields(novosInvalid)

    if (faltas.length > 0) {
      setSaveFeedback({
        msg: `⚠️ NÃO SALVOU — falta preencher: ${faltas.join(', ')}.\nPreencha os campos destacados em vermelho e clique em Salvar de novo.`,
        tipo: 'erro',
      })
      const el = document.getElementById('saveFeedback')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    const respStr = responsaveisSel.length > 0 ? responsaveisSel.join(', ') : 'A definir'

    const novoRec: DesvioRegistro = {
      uid: `d${Date.now()}`,
      dataRegistro,
      tecnico: tecnico.trim(),
      local: local.trim(),
      area: area.trim(),
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      categoria,
      etiqueta,
      prioridade: prioridadeSel,
      risco,
      gravidade,
      previsao,
      sugestao: sugestao.trim(),
      respCorrecao: respStr,
      respCorrecaoList: responsaveisSel,
      empresa: empresa.trim(),
      comentarios: comentarios.trim(),
      statusFluxo: statusSel,
      foto: fotosDesvio[0] || '',
      fotos: fotosDesvio,
      corrigido: false,
      correcaoTexto: '',
      fotoCorrecao: '',
      dataCorrecao: '',
      salvoEm: new Date().toLocaleString('pt-BR'),
    }

    const atualizados = [novoRec, ...desvios]
    persistirDesvios(atualizados)

    logAudit(
      novoRec.tecnico,
      `Desvio registrado — ⏳ PENDENTE (status: ${novoRec.statusFluxo})`,
      `${novoRec.titulo} • ${novoRec.local} • Data limite: ${fmtDateBr(novoRec.previsao)} • Resp: ${respStr}`
    )

    // Disparo imediato para o grupo do WhatsApp com detalhes e fotos anexadas
    void notificarDesvioRegistrado(novoRec, novoRec.fotos)

    // Resetar campos do formulário
    setTitulo('')
    setDescricao('')
    setSugestao('')
    setResponsaveisSel([])
    setEmpresa('')
    setArea('')
    setComentarios('')
    setFotosDesvio([])
    setInvalidFields({})

    setSaveFeedback({
      msg: `✅ DESVIO SALVO NO HISTÓRICO E ENVIADO AO WHATSAPP!\nEle ficou registrado abaixo como ⏳ PENDENTE, com data limite para corrigir até ${fmtDateBr(
        novoRec.previsao
      )}, e notificado ao grupo com os responsáveis e ${novoRec.fotos.length} foto(s).\nEle só vira ✅ CORRIGIDO após qualquer usuário preencher a correção, anexar a foto e clicar em Salvar correção no card correspondente.`,
      tipo: 'ok',
    })
    toast.success(`✅ Desvio salvo e enviado ao WhatsApp — ⏳ PENDENTE até ${fmtDateBr(novoRec.previsao)}`)

    setTimeout(() => {
      const el = document.getElementById('historicoSection')
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    }, 400)
  }

  // Limpar formulário
  const handleLimpar = () => {
    setTitulo('')
    setDescricao('')
    setLocal('')
    setArea('')
    setSugestao('')
    setResponsaveisSel([])
    setEmpresa('')
    setComentarios('')
    setFotosDesvio([])
    setInvalidFields({})
    setSaveFeedback(null)
    toast.info('Formulário limpo!')
  }

  // Upload da foto de correção de um desvio
  const handleFotoCorrecaoUpload = (uid: string, ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const res = e.target?.result as string
      setCorrecaoDraft((prev) => ({
        ...prev,
        [uid]: {
          ...(prev[uid] || { texto: '' }),
          foto: res,
          erro: undefined,
          info: '📷 Foto da correção adicionada — mas o desvio AINDA ESTÁ ⏳ PENDENTE. Preencha “Correção realizada — o que foi feito” e clique em 💾 Salvar correção.',
        },
      }))
      toast.info('📷 Foto pronta — falta preencher a correção e Salvar')
    }
    reader.readAsDataURL(file)
  }

  // Salvar Correção do Desvio (Qualquer pessoa pode salvar a correção!)
  const handleSalvarCorrecao = (uid: string) => {
    const draft = correcaoDraft[uid] || { foto: '', texto: '' }
    const foto = draft.foto?.trim()
    const texto = draft.texto?.trim()

    const faltas: string[] = []
    if (!foto) faltas.push('enviar a FOTO DA CORREÇÃO')
    if (!texto) faltas.push('preencher a CORREÇÃO REALIZADA — O QUE FOI FEITO')

    if (faltas.length > 0) {
      setCorrecaoDraft((prev) => ({
        ...prev,
        [uid]: {
          ...draft,
          erro: `⚠️ AINDA ⏳ PENDENTE — falta: ${faltas.join(' + ')}. Complete e clique em 💾 Salvar correção de novo.`,
          info: undefined,
        },
      }))
      toast.error(`Ainda pendente: falta ${faltas.join(' e ')}`)
      return
    }

    const agoraStr = new Date().toLocaleString('pt-BR')
    const quemSalvou = currentUserName || 'Colaborador'

    const atualizados = desvios.map((d) => {
      if (d.uid === uid) {
        return {
          ...d,
          corrigido: true,
          statusFluxo: 'Corrigido',
          fotoCorrecao: foto,
          correcaoTexto: texto,
          dataCorrecao: agoraStr,
        }
      }
      return d
    })

    persistirDesvios(atualizados)

    const desvioAlvo = desvios.find((d) => d.uid === uid)
    logAudit(
      quemSalvou,
      'Correção salva — ✅ CORRIGIDO',
      `${desvioAlvo?.titulo} • Realizado por: ${quemSalvou} • ${texto}`
    )

    setCorrecaoDraft((prev) => {
      const copy = { ...prev }
      delete copy[uid]
      return copy
    })

    toast.success('✅ Correção salva! Desvio CORRIGIDO — relatório e histórico atualizados')
  }

  // Reabrir desvio
  const handleReabrir = (uid: string) => {
    const alvo = desvios.find((d) => d.uid === uid)
    if (!alvo) return

    setCorrecaoDraft((prev) => ({
      ...prev,
      [uid]: {
        foto: alvo.fotoCorrecao || '',
        texto: alvo.correcaoTexto || '',
      },
    }))

    const atualizados = desvios.map((d) => {
      if (d.uid === uid) {
        return {
          ...d,
          corrigido: false,
          statusFluxo: 'Em Tratamento',
          dataCorrecao: '',
        }
      }
      return d
    })

    persistirDesvios(atualizados)
    logAudit(currentUserName || alvo.tecnico, 'Desvio reaberto — voltou para ⏳ PENDENTE', alvo.titulo)
    toast.info('↩️ Desvio voltou para ⏳ PENDENTE')
  }

  // Excluir desvio
  const handleExcluir = (uid: string) => {
    const alvo = desvios.find((d) => d.uid === uid)
    if (!confirm(`Excluir este desvio do histórico?\n\n"${alvo?.titulo}"`)) return

    const atualizados = desvios.filter((d) => d.uid !== uid)
    persistirDesvios(atualizados)
    if (alvo) {
      logAudit(currentUserName || alvo.tecnico, 'Desvio excluído', alvo.titulo)
    }
    toast.success('Desvio excluído — relatório atualizado')
  }

  // Filtros
  const desviosFiltrados = useMemo(() => {
    return desvios.filter((d) => {
      if (filtroAtual === 'corrigidos') return d.corrigido
      if (filtroAtual === 'pendentes') return !d.corrigido
      if (filtroAtual === 'vencidos') return isVencido(d)
      return true
    })
  }, [desvios, filtroAtual])

  // Contadores para o Relatório
  const relStats = useMemo(() => {
    const total = desvios.length
    const corr = desvios.filter((d) => d.corrigido).length
    const venc = desvios.filter(isVencido).length
    const pend = total - corr
    const pct = total > 0 ? Math.round((corr / total) * 100) : 0

    const porPrio: Record<string, number> = {}
    const porRisco: Record<string, number> = {}
    desvios.forEach((d) => {
      porPrio[d.prioridade] = (porPrio[d.prioridade] || 0) + 1
      porRisco[d.risco] = (porRisco[d.risco] || 0) + 1
    })

    return { total, corr, venc, pend, pct, porPrio, porRisco }
  }, [desvios])

  // Copiar relatório
  const handleCopiarRelatorio = () => {
    if (!desvios.length) {
      toast.info('Nenhum desvio registrado para copiar.')
      return
    }
    const lines: string[] = []
    lines.push('RELATÓRIO AUTOMÁTICO — DESVIOS DE SEGURANÇA (Hydro Reabilitação)')
    lines.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`)
    lines.push(`Resumo: ${relStats.total} desvio(s) • ${relStats.corr} corrigido(s) • ${relStats.pend} pendente(s) • ${relStats.venc} vencido(s)`)
    lines.push('')

    desvios.forEach((d, i) => {
      const statusStr = d.corrigido ? 'CORRIGIDO' : isVencido(d) ? 'VENCIDO/PENDENTE' : 'PENDENTE'
      const fotosQtd = (d.fotos || (d.foto ? [d.foto] : [])).length
      lines.push(`${i + 1}. ${d.titulo} [${statusStr}]`)
      lines.push(`   Prioridade: ${d.prioridade} • Risco: ${d.risco} • Categoria: ${d.categoria}`)
      lines.push(`   Local: ${d.local} • Registro: ${fmtDateBr(d.dataRegistro)} • Técnico: ${d.tecnico}`)
      lines.push(`   Responsáveis: ${d.respCorrecao || 'A definir'}`)
      lines.push(`   ${previsaoTxt(d)}`)
      lines.push(`   Desvio: ${d.descricao}`)
      if (d.sugestao) lines.push(`   Instrução/Sugestão: ${d.sugestao}`)
      if (d.correcaoTexto) lines.push(`   Correção realizada: ${d.correcaoTexto}`)
      if (d.dataCorrecao) lines.push(`   Corrigido em: ${d.dataCorrecao}`)
      lines.push(`   Fotos do desvio: ${fotosQtd} foto(s) • Foto da correção: ${d.fotoCorrecao ? 'anexada' : 'não anexada'}`)
      lines.push('')
    })

    const txt = lines.join('\n')
    navigator.clipboard.writeText(txt).then(() => {
      toast.success('📋 Relatório copiado para a área de transferência!')
    })
  }

  // Imprimir relatório
  const handleImprimirRelatorio = () => {
    const el = document.getElementById('relConteudo')
    if (!el || !desvios.length) {
      toast.info('Nenhum desvio para imprimir.')
      return
    }
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório — Desvios de Segurança</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; color: #000; padding: 24px; }
    h1 { font-size: 24px; font-weight: 900; margin-bottom: 4px; }
    p { font-size: 14px; margin-top: 4px; }
    .rel-item { border-top: 1px solid #ccc; padding: 14px 0; font-size: 13px; line-height: 1.5; }
    .fotos { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-top: 10px; }
    .foto-box { border: 1px solid #999; padding: 8px; border-radius: 8px; }
    .foto-box img { width: 100%; height: 170px; object-fit: cover; border-radius: 6px; }
    .semfoto { padding: 30px; background: #eee; text-align: center; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>Relatório Automático — Desvios de Segurança</h1>
  <p>Hydro Reabilitação • Gerado em ${new Date().toLocaleString('pt-BR')}</p>
  ${el.innerHTML}
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`

    const w = window.open('', '_blank')
    if (!w) {
      toast.info('Permita pop-ups para imprimir ou use "Copiar relatório"')
      return
    }
    w.document.write(html)
    w.document.close()
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-28 pt-3 px-1 sm:px-2 w-full max-w-none">
      {/* Topo / Migalha de Pão */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm text-gray-700 font-semibold">
          <Link to="/seguranca" className="flex items-center gap-1 hover:text-amber-600 transition">
            <ArrowLeft className="w-4 h-4" /> Segurança
          </Link>
          <span>›</span>
          <strong className="text-black font-extrabold">Desvios</strong>
        </div>

        <span className="text-xs font-bold text-gray-700 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full">
          HYDRO REABILITAÇÃO · Segurança do Trabalho
        </span>
      </div>

      {/* Título Principal com Ilustração do Trabalhador EPI no Lado Esquerdo */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 bg-white border border-gray-200/80 rounded-3xl p-4 sm:p-5 shadow-xs">
        <div className="shrink-0 flex items-center justify-center">
          <img
            src="/trabalhador-epi-direita-v2.gif"
            alt="Trabalhador com EPI"
            className="w-32 sm:w-40 md:w-48 h-auto object-contain rounded-2xl drop-shadow-sm select-none"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-950 tracking-tight flex items-center gap-2.5">
            <TriangleAlert className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500 inline shrink-0" /> Desvios de Segurança
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-gray-800 mt-2 leading-relaxed max-w-4xl">
            Tela <strong>Novo Desvio</strong>: selecione o <strong>Técnico de Segurança</strong> e as <strong>Pessoas Responsáveis</strong> a partir do efetivo atual do RH. Ao salvar, os dados e as fotos são enviados imediatamente ao <strong>grupo de WhatsApp</strong>. O <strong>status</strong> só pode ser alterado pelo Técnico de Segurança, enquanto <strong>qualquer colaborador</strong> pode registrar a correção do desvio.
          </p>
        </div>
      </div>

      {/* ==========================================================
          TELA: NOVO DESVIO (EM PAISAGEM / 4 COLUNAS)
          ========================================================== */}
      <section className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-sm mb-6">
        {/* Cabeçalho do Card */}
        <div className="flex items-center justify-between gap-4 flex-wrap border-b border-gray-100 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleLimpar}
              className="text-gray-500 hover:text-black font-black text-xl leading-none transition"
              title="Limpar / Novo"
            >
              ✕
            </button>
            <h2 className="text-2xl font-serif font-bold text-black tracking-tight">Novo Desvio</h2>
          </div>

          {/* Pílulas de Status (Permissão: apenas Técnico de Segurança) */}
          <div className="flex items-center gap-2 flex-wrap">
            {!isTecnicoSeguranca && (
              <span className="text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-full flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-700" /> Status restrito ao Técnico
              </span>
            )}
            {['Aberto', 'Em Tratamento', 'Em Análise', 'Corrigido', 'Cancelado'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  if (!isTecnicoSeguranca) {
                    toast.warning('Apenas o Técnico de Segurança responsável pode alterar o status do desvio.')
                    return
                  }
                  setStatusSel(s)
                  if (s === 'Corrigido') {
                    toast.info('O desvio só vira CORRIGIDO após foto + correção + Salvar correção no histórico')
                  }
                }}
                disabled={!isTecnicoSeguranca}
                className={`text-xs font-black px-4 py-2 rounded-full border transition ${
                  statusSel === s
                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                    : 'bg-white border-gray-400 text-black hover:border-black'
                } ${!isTecnicoSeguranca ? 'opacity-60 cursor-not-allowed' : ''}`}
                title={!isTecnicoSeguranca ? 'Apenas o Técnico de Segurança pode alterar o status' : ''}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* 4 Colunas Lado a Lado */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {/* COLUNA 1: PROBLEMA / ASSUNTO */}
          <div className="bg-white border-1.5 border-gray-200 rounded-2xl p-4 flex flex-col justify-between h-full">
            <div>
              <h3 className="font-serif text-lg font-bold text-black flex items-center gap-2 mb-3">
                <span className="text-red-600 font-sans text-base">ⓘ</span> Problema / Assunto
              </h3>

              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">
                Título do desvio *
              </label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => {
                  setTitulo(e.target.value)
                  if (invalidFields.titulo) setInvalidFields((p) => ({ ...p, titulo: false }))
                }}
                placeholder="Ex.: Colaborador sem cinto em trabalho em altura"
                className={`w-full border-1.5 rounded-xl px-3 py-2 text-sm font-bold text-black placeholder:text-gray-600 outline-hidden bg-white mb-3 ${
                  invalidFields.titulo ? 'border-red-600 bg-red-50' : 'border-gray-400 focus:border-amber-500'
                }`}
              />

              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">
                Descrição do Desvio *
              </label>
              <textarea
                value={descricao}
                onChange={(e) => {
                  setDescricao(e.target.value)
                  if (invalidFields.descricao) setInvalidFields((p) => ({ ...p, descricao: false }))
                }}
                placeholder="Descreva o desvio detalhadamente..."
                rows={4}
                className={`w-full border-1.5 rounded-xl px-3 py-2 text-sm font-bold text-black placeholder:text-gray-600 outline-hidden bg-white mb-3 ${
                  invalidFields.descricao ? 'border-red-600 bg-red-50' : 'border-gray-400 focus:border-amber-500'
                }`}
              />

              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">
                Local / Frente de obra *
              </label>
              <input
                type="text"
                value={local}
                onChange={(e) => {
                  setLocal(e.target.value)
                  if (invalidFields.local) setInvalidFields((p) => ({ ...p, local: false }))
                }}
                placeholder="Ex.: Canteiro Central — área de escavação"
                className={`w-full border-1.5 rounded-xl px-3 py-2 text-sm font-bold text-black placeholder:text-gray-600 outline-hidden bg-white mb-3 ${
                  invalidFields.local ? 'border-red-600 bg-red-50' : 'border-gray-400 focus:border-amber-500'
                }`}
              />

              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">
                Área / Setor
              </label>
              <input
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Ex.: Terraplenagem / Drenagem / Montagem"
                className="w-full border-1.5 border-gray-400 focus:border-amber-500 rounded-xl px-3 py-2 text-sm font-bold text-black placeholder:text-gray-600 outline-hidden bg-white mb-3"
              />

              {/* MÚLTIPLAS FOTOS DO DESVIO */}
              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">
                Anexos — fotos do desvio ({fotosDesvio.length})
              </label>

              {fotosDesvio.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-2 max-h-48 overflow-y-auto pr-1">
                  {fotosDesvio.map((f, idx) => (
                    <div key={idx} className="relative rounded-lg overflow-hidden border border-gray-300 group">
                      <img src={f} alt={`Foto ${idx + 1}`} className="w-full h-20 object-cover cursor-pointer" onClick={() => setModalFoto(f)} />
                      <div className="absolute top-1 left-1 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        #{idx + 1}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoverFotoDesvio(idx)}
                        className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition hover:bg-red-700"
                        title="Remover foto"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label className="border-2 border-dashed border-gray-400 hover:border-amber-500 hover:bg-amber-50/50 rounded-xl p-3 text-center cursor-pointer block transition">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={handleFotosDesvioUpload}
                  className="hidden"
                />
                <Camera className="w-5 h-5 text-gray-700 mx-auto mb-1" />
                <span className="block text-xs font-black text-black">
                  {fotosDesvio.length > 0 ? '+ Adicionar mais fotos' : '📷 + Adicionar Anexos'}
                </span>
                <span className="block text-[11px] font-semibold text-gray-600 mt-0.5 leading-snug">
                  Tire foto ou anexe várias imagens. Elas vão juntas no WhatsApp!
                </span>
              </label>
            </div>
          </div>

          {/* COLUNA 2: TRATATIVA */}
          <div className="bg-white border-1.5 border-gray-200 rounded-2xl p-4 flex flex-col justify-between h-full">
            <div>
              <h3 className="font-serif text-lg font-bold text-black flex items-center gap-2 mb-3">
                <span className="text-green-600 font-sans text-base">◎</span> Tratativa
              </h3>

              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">
                Instrução — sugestão de correção
              </label>
              <textarea
                value={sugestao}
                onChange={(e) => setSugestao(e.target.value)}
                placeholder="Instruções para correção... Ex.: Instalar linha de vida, isolar a área e orientar a equipe no DDS..."
                rows={4}
                className="w-full border-1.5 border-gray-400 focus:border-amber-500 rounded-xl px-3 py-2 text-sm font-bold text-black placeholder:text-gray-600 outline-hidden bg-white mb-3"
              />

              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">
                Etiquetas de Ação
              </label>
              <select
                value={etiqueta}
                onChange={(e) => setEtiqueta(e.target.value)}
                className="w-full border-1.5 border-gray-400 focus:border-amber-500 rounded-xl px-3 py-2 text-sm font-bold text-black bg-white mb-3"
              >
                <option>Selecionar etiquetas...</option>
                <option>Isolar a área</option>
                <option>Orientar a equipe no DDS</option>
                <option>Manutenção / reparo</option>
                <option>Trocar / fornecer EPI</option>
                <option>Instalar EPC / proteção coletiva</option>
                <option>Sinalizar o local</option>
                <option>Limpeza e organização</option>
                <option>Paralisar a atividade</option>
                <option>Outra ação</option>
              </select>

              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">
                Tipo / Categoria do desvio
              </label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full border-1.5 border-gray-400 focus:border-amber-500 rounded-xl px-3 py-2 text-sm font-bold text-black bg-white mb-3"
              >
                <option>EPI / EPC</option>
                <option>Trabalho em altura</option>
                <option>Eletricidade</option>
                <option>Máquinas e equipamentos</option>
                <option>Organização e limpeza</option>
                <option>Sinalização e isolamento</option>
                <option>Acesso e circulação</option>
                <option>Escavação</option>
                <option>Içamento / Guindar</option>
                <option>Espaço confinado</option>
                <option>Atividade a quente</option>
                <option>Meio ambiente</option>
                <option>Comportamento / Ato inseguro</option>
                <option>Condição insegura</option>
                <option>Outro</option>
              </select>

              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">
                Risco envolvido *
              </label>
              <select
                value={risco}
                onChange={(e) => setRisco(e.target.value)}
                className="w-full border-1.5 border-gray-400 focus:border-amber-500 rounded-xl px-3 py-2 text-sm font-bold text-black bg-white mb-3"
              >
                <option>Queda de altura</option>
                <option>Queda de material / objeto</option>
                <option>Choque elétrico</option>
                <option>Atropelamento / colisão</option>
                <option>Corte / perfuração</option>
                <option>Prensamento / esmagamento</option>
                <option>Soterramento</option>
                <option>Incêndio / explosão</option>
                <option>Intoxicação / queimadura química</option>
                <option>Afogamento / alagamento</option>
                <option>Lesão ergonômica</option>
                <option>Outro risco</option>
              </select>

              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">
                Gravidade / Potencial do risco
              </label>
              <select
                value={gravidade}
                onChange={(e) => setGravidade(e.target.value)}
                className="w-full border-1.5 border-gray-400 focus:border-amber-500 rounded-xl px-3 py-2 text-sm font-bold text-black bg-white mb-3"
              >
                <option>Alto — pode causar acidente grave</option>
                <option>Médio — pode causar lesão</option>
                <option>Baixo — risco controlado</option>
              </select>
            </div>
          </div>

          {/* COLUNA 3: CORREÇÃO (BLOQUEADA NESTA TELA) */}
          <div className="bg-white border-1.5 border-gray-200 rounded-2xl p-4 flex flex-col justify-between h-full">
            <div>
              <h3 className="font-serif text-lg font-bold text-black flex items-center gap-2 mb-3">
                <span className="text-blue-600 font-sans text-base">✓</span> Correção
              </h3>

              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">
                Correção Realizada
              </label>
              <textarea
                disabled
                rows={4}
                placeholder="Descreva a correção efetuada... (preenchido depois, no desvio salvo no histórico)"
                className="w-full border-1.5 border-dashed border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold text-gray-500 bg-gray-50 mb-3"
              />

              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">
                Fotos da Correção
              </label>
              <button
                type="button"
                disabled
                className="w-full border-2 border-dashed border-gray-400 rounded-full py-2.5 text-xs font-extrabold text-gray-400 bg-gray-50 cursor-not-allowed mb-4"
              >
                🖼️ Anexar Fotos da Correção
              </button>

              <div className="border border-amber-300 bg-amber-50/80 rounded-xl p-3 text-xs font-bold text-gray-900 leading-relaxed">
                ⏳ <strong>Como funciona:</strong> ao salvar, este desvio fica <strong>PENDENTE</strong>. A correção é feita{' '}
                <strong>no próprio desvio, no Histórico de Desvios abaixo</strong>: <strong>1)</strong> enviar a foto da correção,{' '}
                <strong>2)</strong> preencher “Correção realizada — o que foi feito” e <strong>3)</strong> clicar em{' '}
                <strong>💾 Salvar correção</strong>. <em>Qualquer pessoa pode salvar a correção!</em>
              </div>
            </div>
          </div>

          {/* COLUNA 4: RESPONSÁVEL / PRAZO (INTEGRADO AO RH) */}
          <div className="bg-white border-1.5 border-gray-200 rounded-2xl p-4 flex flex-col justify-between h-full">
            <div>
              <h3 className="font-serif text-lg font-bold text-black flex items-center gap-2 mb-3">
                <span className="text-blue-600 font-sans text-base">👤</span> Responsável / Prazo
              </h3>

              {/* TÉCNICO DE SEGURANÇA QUE REGISTROU (Busca no RH) */}
              <div className="relative mb-3">
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">
                  Técnico de Segurança que registrou * (Efetivo RH)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={tecnico}
                    onFocus={() => setTecnicoDropdownOpen(true)}
                    onChange={(e) => {
                      setTecnico(e.target.value)
                      setTecnicoBusca(e.target.value)
                      setTecnicoDropdownOpen(true)
                      if (invalidFields.tecnico) setInvalidFields((p) => ({ ...p, tecnico: false }))
                    }}
                    placeholder="Buscar colaborador no RH..."
                    className={`w-full border-1.5 rounded-xl px-3.5 py-2 text-sm font-bold text-black placeholder:text-gray-600 outline-hidden bg-white ${
                      invalidFields.tecnico ? 'border-red-600 bg-red-50' : 'border-gray-400 focus:border-amber-500'
                    }`}
                  />
                  <Search className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
                </div>

                {tecnicoDropdownOpen && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                    <div className="p-1.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-200">
                      Colaboradores Ativos no RH ({colaboradoresFiltradosTecnico.length})
                    </div>
                    {colaboradoresFiltradosTecnico.length === 0 ? (
                      <div className="p-3 text-xs text-gray-500 text-center">Nenhum colaborador encontrado</div>
                    ) : (
                      colaboradoresFiltradosTecnico.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setTecnico(c.nome)
                            setTecnicoBusca('')
                            setTecnicoDropdownOpen(false)
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-amber-50 border-b border-gray-100 last:border-0 transition"
                        >
                          <div className="text-xs font-black text-black">{c.nome}</div>
                          <div className="text-[11px] font-semibold text-gray-600">{c.cargo}</div>
                        </button>
                      ))
                    )}
                    <button
                      type="button"
                      onClick={() => setTecnicoDropdownOpen(false)}
                      className="w-full py-1 text-center text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200"
                    >
                      Fechar Lista
                    </button>
                  </div>
                )}
              </div>

              {/* PESSOAS RESPONSÁVEIS (Múltipla Seleção do RH) */}
              <div className="relative mb-3">
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">
                  Pessoas Responsáveis (Selecione um ou mais no RH)
                </label>

                {/* Chips dos Selecionados */}
                {responsaveisSel.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {responsaveisSel.map((nome) => (
                      <span
                        key={nome}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-950 rounded-full text-xs font-bold"
                      >
                        <User className="w-3 h-3 text-blue-600" />
                        {nome}
                        <button
                          type="button"
                          onClick={() => setResponsaveisSel((prev) => prev.filter((n) => n !== nome))}
                          className="hover:text-red-600 ml-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <input
                    type="text"
                    value={respBusca}
                    onFocus={() => setRespDropdownOpen(true)}
                    onChange={(e) => {
                      setRespBusca(e.target.value)
                      setRespDropdownOpen(true)
                    }}
                    placeholder="+ Adicionar colaborador responsável..."
                    className="w-full border-1.5 border-gray-400 focus:border-amber-500 rounded-xl px-3 py-2 text-sm font-bold text-black placeholder:text-gray-600 outline-hidden bg-white"
                  />
                  <Search className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
                </div>

                {respDropdownOpen && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                    <div className="p-1.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-200">
                      Efetivo RH ({colaboradoresFiltradosResp.length})
                    </div>
                    {colaboradoresFiltradosResp.length === 0 ? (
                      <div className="p-3 text-xs text-gray-500 text-center">Nenhum colaborador disponível</div>
                    ) : (
                      colaboradoresFiltradosResp.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setResponsaveisSel((prev) => [...prev, c.nome])
                            setRespBusca('')
                            setRespDropdownOpen(false)
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition"
                        >
                          <div className="text-xs font-black text-black">{c.nome}</div>
                          <div className="text-[11px] font-semibold text-gray-600">{c.cargo}</div>
                        </button>
                      ))
                    )}
                    <button
                      type="button"
                      onClick={() => setRespDropdownOpen(false)}
                      className="w-full py-1 text-center text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200"
                    >
                      Fechar Lista
                    </button>
                  </div>
                )}
              </div>

              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">
                Empresa / Equipe envolvida
              </label>
              <input
                type="text"
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                placeholder="Ex.: Equipe própria / terceirizada"
                className="w-full border-1.5 border-gray-400 focus:border-amber-500 rounded-xl px-3 py-2 text-sm font-bold text-black placeholder:text-gray-600 outline-hidden bg-white mb-3"
              />

              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">
                Prioridade
              </label>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setPrioridadeSel('Baixa')}
                  className={`py-2 px-1 text-xs font-black rounded-full border transition ${
                    prioridadeSel === 'Baixa'
                      ? 'bg-green-600 border-green-600 text-white shadow-xs'
                      : 'bg-white border-gray-400 text-black hover:border-black'
                  }`}
                >
                  Baixo
                </button>
                <button
                  type="button"
                  onClick={() => setPrioridadeSel('Média')}
                  className={`py-2 px-1 text-xs font-black rounded-full border transition ${
                    prioridadeSel === 'Média'
                      ? 'bg-amber-400 border-amber-400 text-black shadow-xs'
                      : 'bg-white border-gray-400 text-black hover:border-black'
                  }`}
                >
                  Médio
                </button>
                <button
                  type="button"
                  onClick={() => setPrioridadeSel('Alta')}
                  className={`py-2 px-1 text-xs font-black rounded-full border transition ${
                    prioridadeSel === 'Alta'
                      ? 'bg-orange-500 border-orange-500 text-white shadow-xs'
                      : 'bg-white border-gray-400 text-black hover:border-black'
                  }`}
                >
                  Alto
                </button>
                <button
                  type="button"
                  onClick={() => setPrioridadeSel('Crítica — risco imediato')}
                  className={`py-2 px-1 text-xs font-black rounded-full border transition ${
                    prioridadeSel === 'Crítica — risco imediato'
                      ? 'bg-red-600 border-red-600 text-white shadow-xs'
                      : 'bg-white border-gray-400 text-black hover:border-black'
                  }`}
                >
                  Crítico
                </button>
              </div>

              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">
                Data Limite — previsão para corrigir *
              </label>
              <input
                type="date"
                value={previsao}
                onChange={(e) => {
                  setPrevisao(e.target.value)
                  if (invalidFields.previsao) setInvalidFields((p) => ({ ...p, previsao: false }))
                }}
                className={`w-full border-1.5 rounded-xl px-3 py-2 text-sm font-bold text-black outline-hidden bg-white mb-3 ${
                  invalidFields.previsao ? 'border-red-600 bg-red-50' : 'border-gray-400 focus:border-amber-500'
                }`}
              />

              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">
                Data do registro *
              </label>
              <input
                type="date"
                value={dataRegistro}
                onChange={(e) => {
                  setDataRegistro(e.target.value)
                  if (invalidFields.dataRegistro) setInvalidFields((p) => ({ ...p, dataRegistro: false }))
                }}
                className={`w-full border-1.5 rounded-xl px-3 py-2 text-sm font-bold text-black outline-hidden bg-white mb-3 ${
                  invalidFields.dataRegistro ? 'border-red-600 bg-red-50' : 'border-gray-400 focus:border-amber-500'
                }`}
              />

              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">
                Comentários
              </label>
              <textarea
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
                placeholder="Observações adicionais..."
                rows={2}
                className="w-full border-1.5 border-gray-400 focus:border-amber-500 rounded-xl px-3 py-2 text-sm font-bold text-black placeholder:text-gray-600 outline-hidden bg-white"
              />
            </div>
          </div>
        </div>

        {/* Feedback de Validação */}
        {saveFeedback && (
          <div
            id="saveFeedback"
            className={`mt-4 p-4 rounded-xl text-sm font-bold whitespace-pre-line leading-relaxed border-2 ${
              saveFeedback.tipo === 'erro'
                ? 'bg-red-50 border-red-600 text-red-900 border-l-8'
                : 'bg-green-50 border-green-600 text-green-950 border-l-8'
            }`}
          >
            {saveFeedback.msg}
          </div>
        )}

        {/* Botões de Ação */}
        <div className="flex items-center gap-3 flex-wrap mt-5 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handleSalvarDesvio}
            className="px-6 py-3 bg-gray-900 hover:bg-black text-white text-sm font-black rounded-xl transition shadow-md"
          >
            💾 Salvar desvio no histórico e notificar WhatsApp
          </button>

          <button
            type="button"
            onClick={handleLimpar}
            className="px-6 py-3 bg-white hover:bg-gray-100 border-1.5 border-gray-400 text-black text-sm font-black rounded-xl transition shadow-xs"
          >
            <RotateCcw className="w-4 h-4 inline mr-1" /> Limpar formulário
          </button>
        </div>
      </section>

      {/* ==========================================================
          TABELA: HISTÓRICO DE AUDITORIA
          ========================================================== */}
      <section className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-sm mb-6 overflow-x-auto">
        <h2 className="text-xl font-serif font-bold text-black mb-1">🕘 Histórico</h2>
        <p className="text-xs font-semibold text-gray-700 mb-4">
          Registro automático de tudo o que acontece nesta página: cada desvio salvo, correção salva, desvio reaberto ou excluído entra aqui com data, usuário, ação realizada e comentário.
        </p>

        <table className="w-full text-left text-xs border-collapse min-w-[620px]">
          <thead>
            <tr className="border-b-2 border-black text-black font-black uppercase text-[11px] tracking-wider">
              <th className="py-2.5 px-3 w-[18%]">Data</th>
              <th className="py-2.5 px-3 w-[22%]">Usuário</th>
              <th className="py-2.5 px-3 w-[28%]">Ação realizada</th>
              <th className="py-2.5 px-3">Comentário</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {auditList.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-gray-500 font-semibold">
                  Nenhum registro encontrado
                </td>
              </tr>
            ) : (
              auditList.slice(0, 50).map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="py-2.5 px-3 text-gray-800 font-semibold">{r.data}</td>
                  <td className="py-2.5 px-3 font-bold text-black">{r.usuario}</td>
                  <td className="py-2.5 px-3 font-semibold text-gray-900">{r.acao}</td>
                  <td className="py-2.5 px-3 text-gray-700 font-medium">{r.comentario}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* ==========================================================
          LISTA: HISTÓRICO DE DESVIOS REGISTRADOS
          ========================================================== */}
      <section id="historicoSection" className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <h2 className="text-2xl font-serif font-bold text-black">📚 Histórico de Desvios Registrados</h2>
          <span className="text-xs font-bold text-gray-600">
            {desvios.length} desvio(s) no histórico • {relStats.corr} corrigido(s) • {relStats.pend} pendente(s) • {relStats.venc} vencido(s)
          </span>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {(['todos', 'pendentes', 'corrigidos', 'vencidos'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltroAtual(f)}
              className={`text-xs font-black px-4 py-1.5 rounded-full border transition capitalize ${
                filtroAtual === f
                  ? 'bg-black border-black text-white'
                  : 'bg-white border-gray-400 text-black hover:border-black'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Lista de Cards */}
        {desviosFiltrados.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded-2xl p-8 text-center text-xs font-semibold text-gray-500">
            Nenhum desvio registrado com o filtro selecionado.
          </div>
        ) : (
          <div className="space-y-4">
            {desviosFiltrados.map((d) => {
              const vencido = isVencido(d)
              const draft = correcaoDraft[d.uid] || { foto: '', texto: '' }
              const fotoDepois = d.corrigido ? d.fotoCorrecao : draft.foto
              const textoCorr = d.corrigido ? d.correcaoTexto : draft.texto
              const listaFotosDesvio = d.fotos && d.fotos.length > 0 ? d.fotos : d.foto ? [d.foto] : []

              return (
                <div
                  key={d.uid}
                  data-uid={d.uid}
                  className={`rounded-2xl p-5 border-2 transition shadow-xs ${
                    d.corrigido
                      ? 'border-green-300 bg-green-50/30 border-l-8 border-l-green-600'
                      : vencido
                      ? 'border-red-300 bg-red-50/40 border-l-8 border-l-red-600'
                      : 'border-amber-300 bg-amber-50/30 border-l-8 border-l-amber-500'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-base font-extrabold text-black">{d.titulo}</h3>

                        {d.corrigido ? (
                          <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-green-100 text-green-900 border border-green-300">
                            ✅ CORRIGIDO
                          </span>
                        ) : vencido ? (
                          <>
                            <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-red-600 text-white">
                              🔴 VENCIDO
                            </span>
                            <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-red-100 text-red-900 border border-red-300">
                              ⏳ PENDENTE
                            </span>
                          </>
                        ) : (
                          <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                            ⏳ PENDENTE
                          </span>
                        )}

                        {/* Prioridade */}
                        <span
                          className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                            d.prioridade.includes('Crítica')
                              ? 'bg-red-600 text-white'
                              : d.prioridade === 'Alta'
                              ? 'bg-orange-500 text-white'
                              : d.prioridade === 'Média'
                              ? 'bg-amber-400 text-black'
                              : 'bg-green-600 text-white'
                          }`}
                        >
                          Prioridade: {d.prioridade}
                        </span>

                        <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-gray-900 text-white">
                          Risco: {d.risco}
                        </span>

                        {d.statusFluxo && (
                          <span className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
                            {d.statusFluxo}
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-semibold text-gray-800 mt-1">{d.descricao}</p>

                      <div className="text-xs font-semibold text-gray-700 mt-2 space-y-1">
                        <div>
                          📂 <strong>{d.categoria}</strong>
                          {d.etiqueta && d.etiqueta !== 'Selecionar etiquetas...' && <span> • 🏷️ {d.etiqueta}</span>}
                          <span> • ⚠️ Gravidade: {d.gravidade}</span>
                        </div>
                        <div>
                          📍 <strong>{d.local}</strong>
                          {d.area && <span> — {d.area}</span>}
                          <span> • 📅 Registrado em {fmtDateBr(d.dataRegistro)} por <strong>{d.tecnico}</strong></span>
                        </div>
                        <div className="font-bold text-gray-950">{previsaoTxt(d)}</div>
                        {d.respCorrecao && (
                          <div>
                            👷 <strong>Responsáveis pela correção:</strong> {d.respCorrecao}
                          </div>
                        )}
                        {d.empresa && <div>🏢 Empresa/equipe: <strong>{d.empresa}</strong></div>}
                        {d.comentarios && <div>💬 Comentários: <em>{d.comentarios}</em></div>}
                        <div className="text-[11px] text-gray-500">Salvo em {d.salvoEm}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleExcluir(d.uid)}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </button>
                  </div>

                  {/* Instrução / Sugestão */}
                  {d.sugestao && (
                    <div className="mt-3 p-3 bg-white border border-amber-300 rounded-xl text-xs font-semibold text-gray-900">
                      💡 <strong>Instrução / Sugestão de correção (Técnico de Segurança):</strong> {d.sugestao}
                    </div>
                  )}

                  {/* BLOCO DE CORREÇÃO (Antes / Depois) */}
                  {d.corrigido ? (
                    <div className="mt-4 pt-3 border-t border-green-200">
                      <div className="p-3 bg-green-50 border border-green-300 rounded-xl text-xs font-bold text-green-950 mb-3">
                        ✅ <strong>Correção salva</strong> em {d.dataCorrecao} — este desvio já entrou como CORRIGIDO no relatório abaixo.
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div className="border border-gray-300 rounded-xl p-2.5 bg-white">
                          <span className="block text-xs font-black uppercase tracking-wider text-black mb-2">
                            📷 Antes — fotos do desvio ({listaFotosDesvio.length})
                          </span>
                          {listaFotosDesvio.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                              {listaFotosDesvio.map((f, idx) => (
                                <img
                                  key={idx}
                                  src={f}
                                  alt={`Antes #${idx + 1}`}
                                  className="w-full h-28 object-cover rounded-lg cursor-pointer hover:opacity-90 transition"
                                  onClick={() => setModalFoto(f)}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="h-28 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500">
                              Sem fotos do desvio
                            </div>
                          )}
                        </div>

                        <div className="border border-gray-300 rounded-xl p-2.5 bg-white">
                          <span className="block text-xs font-black uppercase tracking-wider text-black mb-2">
                            ✅ Depois — foto da correção
                          </span>
                          {d.fotoCorrecao ? (
                            <img
                              src={d.fotoCorrecao}
                              alt="Depois"
                              className="w-full h-28 object-cover rounded-lg cursor-pointer hover:opacity-90 transition"
                              onClick={() => setModalFoto(d.fotoCorrecao)}
                            />
                          ) : (
                            <div className="h-28 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500">
                              Sem foto da correção
                            </div>
                          )}
                        </div>
                      </div>

                      <p className="text-xs font-semibold text-gray-900 mb-3">
                        <strong>Correção realizada — o que foi feito:</strong> {d.correcaoTexto}
                      </p>

                      <button
                        type="button"
                        onClick={() => handleReabrir(d.uid)}
                        className="px-4 py-2 bg-white hover:bg-gray-100 border-1.5 border-gray-400 text-black text-xs font-black rounded-xl transition shadow-xs"
                      >
                        ↩️ Voltar para PENDENTE para editar a correção
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 pt-3 border-t border-amber-200">
                      <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs font-bold text-amber-950 mb-3">
                        ⏳ Este desvio fica <strong>PENDENTE</strong> até você: <strong>1)</strong> enviar a foto da correção,{' '}
                        <strong>2)</strong> preencher “Correção realizada — o que foi feito” e <strong>3)</strong> clicar em{' '}
                        <strong>💾 Salvar correção</strong>. <em>(Qualquer pessoa pode salvar a correção)</em>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div className="border border-gray-300 rounded-xl p-2.5 bg-white">
                          <span className="block text-xs font-black uppercase tracking-wider text-black mb-2">
                            📷 Antes — fotos do desvio ({listaFotosDesvio.length})
                          </span>
                          {listaFotosDesvio.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                              {listaFotosDesvio.map((f, idx) => (
                                <img
                                  key={idx}
                                  src={f}
                                  alt={`Antes #${idx + 1}`}
                                  className="w-full h-28 object-cover rounded-lg cursor-pointer hover:opacity-90 transition"
                                  onClick={() => setModalFoto(f)}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="h-28 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500">
                              Sem fotos do desvio
                            </div>
                          )}
                        </div>

                        <div className="border border-gray-300 rounded-xl p-2.5 bg-white">
                          <span className="block text-xs font-black uppercase tracking-wider text-black mb-2">
                            ✅ Depois — foto da correção *
                          </span>
                          {fotoDepois ? (
                            <img
                              src={fotoDepois}
                              alt="Depois"
                              className="w-full h-32 object-cover rounded-lg mb-2 cursor-pointer hover:opacity-90 transition"
                              onClick={() => setModalFoto(fotoDepois)}
                            />
                          ) : (
                            <div className="h-32 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500 mb-2">
                              Nenhuma foto da correção ainda
                            </div>
                          )}

                          <label className="border-2 border-dashed border-gray-400 hover:border-amber-500 rounded-xl p-2.5 text-center cursor-pointer block bg-white">
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={(ev) => handleFotoCorrecaoUpload(d.uid, ev)}
                              className="hidden"
                            />
                            <span className="block text-xs font-black text-black">📷 Clique para enviar a foto da correção</span>
                            <span className="block text-[10.5px] text-gray-600">Ela aparece na hora, mas continua PENDENTE até salvar</span>
                          </label>
                        </div>
                      </div>

                      <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">
                        Correção realizada — o que foi feito *
                      </label>
                      <textarea
                        value={textoCorr}
                        onChange={(e) => {
                          const val = e.target.value
                          setCorrecaoDraft((prev) => ({
                            ...prev,
                            [d.uid]: {
                              ...(prev[d.uid] || { foto: '' }),
                              texto: val,
                              erro: undefined,
                            },
                          }))
                        }}
                        placeholder="Preenchimento da correção: descreva o que foi feito para corrigir o desvio..."
                        rows={3}
                        className="w-full border-1.5 border-gray-400 focus:border-amber-500 rounded-xl px-3 py-2 text-sm font-bold text-black placeholder:text-gray-600 outline-hidden bg-white mb-2"
                      />

                      {/* Mensagens de Erro / Info do Card */}
                      {draft.erro && (
                        <div className="p-3 bg-red-50 border border-red-600 rounded-xl text-xs font-bold text-red-900 mb-2">
                          {draft.erro}
                        </div>
                      )}
                      {draft.info && (
                        <div className="p-3 bg-amber-50 border border-amber-400 rounded-xl text-xs font-bold text-amber-900 mb-2">
                          {draft.info}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSalvarCorrecao(d.uid)}
                        className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-xs"
                      >
                        💾 Salvar correção
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ==========================================================
          RELATÓRIO AUTOMÁTICO DE DESVIOS
          ========================================================== */}
      <section className="bg-white border-2 border-black rounded-3xl p-5 sm:p-6 shadow-md">
        <h2 className="text-2xl font-serif font-bold text-black mb-1">📋 Relatório Automático de Desvios</h2>
        <p className="text-xs font-semibold text-gray-700 mb-4">
          Atualizado automaticamente a cada desvio salvo, corrigido ou vencido — sem preencher de novo.
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
            <span className="block text-2xl font-black text-black">{relStats.total}</span>
            <span className="text-[11px] font-extrabold uppercase text-gray-700">Total de desvios</span>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
            <span className="block text-2xl font-black text-red-600">{relStats.pend}</span>
            <span className="text-[11px] font-extrabold uppercase text-red-800">Pendentes</span>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <span className="block text-2xl font-black text-green-700">{relStats.corr}</span>
            <span className="text-[11px] font-extrabold uppercase text-green-800">Corrigidos</span>
          </div>

          <div className="bg-rose-100 border border-rose-300 rounded-xl p-3 text-center">
            <span className="block text-2xl font-black text-rose-900">{relStats.venc}</span>
            <span className="text-[11px] font-extrabold uppercase text-rose-900">Vencidos</span>
          </div>
        </div>

        {/* Barra de Progresso */}
        <div className="mb-4">
          <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden mb-1">
            <div className="h-full bg-green-600 transition-all duration-300" style={{ width: `${relStats.pct}%` }} />
          </div>
          <p className="text-xs font-black text-black">
            {relStats.pct}% concluído — {relStats.corr} de {relStats.total} desvio(s) corrigido(s)
          </p>
        </div>

        {/* Conteúdo do Relatório */}
        <div id="relConteudo" className="mt-4 pt-4 border-t border-gray-200">
          {desvios.length === 0 ? (
            <div className="p-6 border border-dashed border-gray-300 rounded-xl text-center text-xs font-semibold text-gray-500">
              O relatório aparece aqui automaticamente assim que houver desvios salvos.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 leading-relaxed">
                Resumo automático: <strong>{relStats.total} desvio(s)</strong>,{' '}
                <strong className="text-green-700">{relStats.corr} corrigido(s)</strong>,{' '}
                <strong className="text-red-600">{relStats.pend} pendente(s)</strong> e{' '}
                <strong className="text-rose-900">{relStats.venc} vencido(s)</strong>.<br />
                Por prioridade: {Object.keys(relStats.porPrio).map((k) => `${k}: ${relStats.porPrio[k]}`).join(' • ')}<br />
                Por risco: {Object.keys(relStats.porRisco).map((k) => `${k}: ${relStats.porRisco[k]}`).join(' • ')}
              </div>

              {desvios.map((d, i) => {
                const listaFotosDesvio = d.fotos && d.fotos.length > 0 ? d.fotos : d.foto ? [d.foto] : []

                return (
                  <div key={d.uid} className="p-3 border-t border-gray-200 text-xs font-semibold">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <strong className="font-black text-black">
                        {i + 1}. {d.titulo}
                      </strong>
                      <span
                        className={`font-black uppercase px-2 py-0.5 rounded text-[10px] ${
                          d.corrigido ? 'bg-green-100 text-green-800' : isVencido(d) ? 'bg-rose-100 text-rose-900' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {d.corrigido ? 'CORRIGIDO' : isVencido(d) ? 'VENCIDO / PENDENTE' : 'PENDENTE'}
                      </span>
                    </div>

                    <div className="text-gray-700 space-y-0.5">
                      <div>
                        Prioridade: <strong>{d.prioridade}</strong> • Risco: <strong>{d.risco}</strong> • Categoria: <strong>{d.categoria}</strong>
                      </div>
                      <div>
                        Local: <strong>{d.local}</strong> • Registrado: {fmtDateBr(d.dataRegistro)} por <strong>{d.tecnico}</strong>
                      </div>
                      <div>
                        Responsáveis: <strong>{d.respCorrecao || 'A definir'}</strong>
                      </div>
                      <div className="font-bold text-black">{previsaoTxt(d)}</div>
                      <div>Desvio: {d.descricao}</div>
                      {d.sugestao && <div>Instrução / Sugestão: {d.sugestao}</div>}
                      {d.correcaoTexto && <div>Correção realizada: <strong>{d.correcaoTexto}</strong></div>}
                      {d.dataCorrecao && <div className="text-green-800">Corrigido em: {d.dataCorrecao}</div>}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-2 max-w-xl">
                      <div className="border border-gray-300 rounded-lg p-2 bg-white">
                        <span className="block text-[10px] font-black uppercase text-black mb-1">
                          Antes ({listaFotosDesvio.length})
                        </span>
                        {listaFotosDesvio.length > 0 ? (
                          <div className="grid grid-cols-2 gap-1.5">
                            {listaFotosDesvio.map((f, idx) => (
                              <img
                                key={idx}
                                src={f}
                                alt={`Antes #${idx + 1}`}
                                className="w-full h-20 object-cover rounded cursor-pointer hover:opacity-90"
                                onClick={() => setModalFoto(f)}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="h-20 bg-gray-100 flex items-center justify-center text-[10px] text-gray-500 rounded">
                            Sem fotos
                          </div>
                        )}
                      </div>

                      <div className="border border-gray-300 rounded-lg p-2 bg-white">
                        <span className="block text-[10px] font-black uppercase text-black mb-1">Depois</span>
                        {d.fotoCorrecao ? (
                          <img
                            src={d.fotoCorrecao}
                            alt="Depois"
                            className="w-full h-20 object-cover rounded cursor-pointer hover:opacity-90"
                            onClick={() => setModalFoto(d.fotoCorrecao)}
                          />
                        ) : (
                          <div className="h-20 bg-gray-100 flex items-center justify-center text-[10px] text-gray-500 rounded">
                            Sem foto da correção
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Botões do Relatório */}
        <div className="flex items-center gap-3 flex-wrap mt-5 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleImprimirRelatorio}
            className="px-5 py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-black rounded-xl transition shadow-md flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" /> Imprimir / Salvar relatório em PDF
          </button>

          <button
            type="button"
            onClick={handleCopiarRelatorio}
            className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-black text-xs font-black rounded-xl transition shadow-xs flex items-center gap-1.5"
          >
            <Copy className="w-4 h-4" /> Copiar relatório (texto)
          </button>
        </div>
      </section>

      {/* Modal para expansão de foto */}
      {modalFoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setModalFoto(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh] bg-white rounded-2xl p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <img src={modalFoto} alt="Foto ampliada" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
            <button
              onClick={() => setModalFoto(null)}
              className="mt-3 w-full py-2 bg-gray-950 text-white font-bold text-xs rounded-xl hover:bg-black transition"
            >
              Fechar Foto
            </button>
          </div>
        </div>
      )}

      {/* Rodapé da Página */}
      <footer className="mt-8 text-center text-xs font-semibold text-gray-600">
        Hydro Reabilitação — Segurança • Desvios • Integrado ao RH e notificações automáticas no WhatsApp.
      </footer>
    </div>
  )
}
