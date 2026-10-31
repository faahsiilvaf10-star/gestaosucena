import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../contexts/ThemeContext'
import { toast } from 'sonner'
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js'
import Search from 'lucide-react/dist/esm/icons/search.js'
import Filter from 'lucide-react/dist/esm/icons/funnel.js'
import Stethoscope from 'lucide-react/dist/esm/icons/stethoscope.js'
import Users from 'lucide-react/dist/esm/icons/users.js'
import Printer from 'lucide-react/dist/esm/icons/printer.js'
import Plus from 'lucide-react/dist/esm/icons/plus.js'
import Save from 'lucide-react/dist/esm/icons/save.js'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js'
import X from 'lucide-react/dist/esm/icons/x.js'
import Copy from 'lucide-react/dist/esm/icons/copy.js'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle.js'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle.js'
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js'
import Info from 'lucide-react/dist/esm/icons/info.js'
import FileText from 'lucide-react/dist/esm/icons/file-text.js'
import FileSpreadsheet from 'lucide-react/dist/esm/icons/file-spreadsheet.js'
import {
  ColaboradorAso,
  fmtDate,
  addUmAno,
  diasAte,
  baseValidade,
  validadeDe,
  nomeBase,
  statusASO,
  frasesValidade,
  isAtivo,
  canEditControleAso,
  exportarControleAsoPDF,
  exportarControleAsoExcel,
  gerarHtmlRelatorioAso,
} from '../../lib/controleAso'

export const Route = createFileRoute('/seguranca/controle-aso')({
  component: ControleAsoPage,
})

function ControleAsoPage() {
  const { isDark } = useTheme()
  const [colaboradores, setColaboradores] = useState<ColaboradorAso[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'ativos' | 'ferias' | 'afastados' | 'desligados' | 'todos'>('ativos')
  const [filtroSituacao, setFiltroSituacao] = useState<'todos' | 'validos' | 'vencendo' | 'vencidos' | 'sem'>('todos')
  const [filtroOrdem, setFiltroOrdem] = useState<'alfabetica' | 'validade'>('alfabetica')
  
  // Permissões
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [canEdit, setCanEdit] = useState(false)

  // Editor
  const [editorOpen, setEditorOpen] = useState(false)
  const [isNovo, setIsNovo] = useState(false)
  const [editId, setEditId] = useState<string>('')
  const [formData, setFormData] = useState({
    nome: '',
    status: 'Ativo (Em Efetivo)',
    matriculaHydro: '',
    matriculaSucena: '',
    admissional: '',
    setor: 'BARCARENA - PA',
    funcao: '',
    aso: '',
    periodico: '',
    retorno: '',
    mudanca: '',
    obs: '',
  })
  const [editorFeedback, setEditorFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [isExportingExcel, setIsExportingExcel] = useState(false)

  const editorRef = useRef<HTMLDivElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)

  // 1. Carrega dados do usuário autenticado e avalia permissão
  useEffect(() => {
    async function checkAuth() {
      try {
        const isMock = typeof window !== 'undefined' && window.location.search.includes('mock=true')
        const { data: { user } } = await supabase.auth.getUser()
        if (user || isMock) {
          const email = user?.email || (isMock ? 'ffaahsiilva@gmail.com' : null)
          const metaRole = user?.user_metadata?.role || (isMock ? 'Admin' : '')
          const metaName = user?.user_metadata?.name || user?.user_metadata?.full_name || (isMock ? 'Fabrício Silva' : '')
          
          let finalRole = metaRole
          let finalName = metaName

          try {
            if (user) {
              const { data: users } = await supabase.rpc('get_users')
              if (users && Array.isArray(users)) {
                const u = users.find((x: any) => x.id === user.id)
                if (u) {
                  finalRole = u.role || u.cargo || metaRole
                  finalName = u.name || u.full_name || metaName
                }
              }
            }
          } catch (e) {
            // fallback para metadata
          }

          setUserEmail(email)
          setUserName(finalName)
          setUserRole(finalRole)

          const allowed = isMock || canEditControleAso(finalName, finalRole, email)
          setCanEdit(allowed)
        }
      } catch (err) {
        console.error('Erro ao verificar usuário:', err)
      }
    }
    checkAuth()
  }, [])

  // 2. Busca lista de colaboradores do RH (rh_efetivo) e se inscreve no realtime
  const carregarColaboradores = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('rh_efetivo')
        .select('*')
        .order('nome', { ascending: true })

      if (error) throw error

      const mapeados: ColaboradorAso[] = (data || []).map((row: any) => {
        const matHydro = row.matricula_hydro || row.matricula || ''
        const rawSucena = row.raw_data && (
          row.raw_data['MATRICULA SUCENA'] ||
          row.raw_data['MATRÍCULA SUCENA'] ||
          row.raw_data['MATRICULA'] ||
          row.raw_data['MATRÍCULA']
        )
        const matSucena = row.matricula_sucena || (rawSucena ? String(rawSucena) : '')

        return {
          id: row.id,
          nome: row.nome,
          cargo: row.cargo || row.funcao || '',
          status: row.status || 'Ativo',
          matricula: matHydro,
          matricula_hydro: matHydro,
          matricula_sucena: matSucena,
          data_admissao: row.data_admissao || row.aso_admissional_2 || '',
          setor: row.setor || '',
          aso_admissional: row.aso_admissional || '',
          aso_admissional_2: row.aso_admissional_2 || '',
          aso_periodico: row.aso_periodico || '',
          retorno_ao_trabalho: row.retorno_ao_trabalho || '',
          mudanca_de_risco: row.mudanca_de_risco || '',
          observacao: row.observacao || row.observacoes || '',
          validade_aso_efetiva: row.validade_aso_efetiva || '',
        }
      })

      setColaboradores(mapeados)
    } catch (err) {
      console.error('Erro ao carregar colaboradores de rh_efetivo:', err)
      toast.error('Erro ao carregar dados do efetivo/ASO')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarColaboradores()

    // Sincronização em tempo real com rh_efetivo
    const channel = supabase
      .channel('realtime:rh_efetivo_aso')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rh_efetivo' },
        () => {
          carregarColaboradores()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Filtragem base por status
  const baseFiltrada = useMemo(() => {
    return colaboradores.filter((c) => {
      const s = (c.status || '').toUpperCase().trim()
      const isDesligado = s === 'DESLIGADO' || s === 'INATIVO' || s === 'DEMITIDO'
      const isFerias = s.includes('FERIAS') || s.includes('FÉRIAS')
      const isAfastado = s.includes('AFASTAD')
      const isAtivoStatus = !isDesligado && !isFerias && !isAfastado

      if (filtroStatus === 'ativos') return isAtivoStatus
      if (filtroStatus === 'ferias') return isFerias
      if (filtroStatus === 'afastados') return isAfastado
      if (filtroStatus === 'desligados') return isDesligado
      return true
    })
  }, [colaboradores, filtroStatus])

  // Estatísticas calculadas
  const stats = useMemo(() => {
    let validos = 0
    let vencendo = 0
    let vencidos = 0
    let sem = 0

    baseFiltrada.forEach((c) => {
      const st = statusASO(c)
      if (st.k === 'valido') validos++
      else if (st.k === 'vencendo') vencendo++
      else if (st.k === 'vencido') vencidos++
      else sem++
    })

    return {
      total: baseFiltrada.length,
      validos,
      vencendo,
      vencidos,
      sem,
      pctValidos: baseFiltrada.length ? Math.round((validos / baseFiltrada.length) * 100) : 0,
    }
  }, [baseFiltrada])

  // Lista final visível na tabela
  const listaVisivel = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    const filtrados = baseFiltrada.filter((c) => {
      const st = statusASO(c)
      if (filtroSituacao === 'validos' && st.k !== 'valido') return false
      if (filtroSituacao === 'vencendo' && st.k !== 'vencendo') return false
      if (filtroSituacao === 'vencidos' && st.k !== 'vencido') return false
      if (filtroSituacao === 'sem' && st.k !== 'sem') return false

      if (q) {
        const str = `${c.nome} ${c.cargo || ''} ${c.matricula_hydro || ''} ${c.matricula_sucena || ''} ${c.matricula || ''}`.toLowerCase()
        if (!str.includes(q)) return false
      }

      return true
    })

    // Ordenação alfabética por padrão (A-Z) ou por validade
    return filtrados.sort((a, b) => {
      if (filtroOrdem === 'validade') {
        const va = validadeDe(a) || '9999-99-99'
        const vb = validadeDe(b) || '9999-99-99'
        if (va < vb) return -1
        if (va > vb) return 1
        return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
      }
      return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
    })
  }, [baseFiltrada, filtroSituacao, searchQuery, filtroOrdem])

  // Lista ordenada para o Relatório Automático
  const listaRelatorio = useMemo(() => {
    return [...baseFiltrada].sort((a, b) => {
      const va = validadeDe(a) || '9999-99-99'
      const vb = validadeDe(b) || '9999-99-99'
      if (va < vb) return -1
      if (va > vb) return 1
      return a.nome.localeCompare(b.nome)
    })
  }, [baseFiltrada])

  // Cálculo da validade em tempo real para o formulário
  const previewValidade = useMemo(() => {
    const colabTemp = {
      aso_admissional: formData.aso,
      aso_periodico: formData.periodico,
      retorno_ao_trabalho: formData.retorno,
      mudanca_de_risco: formData.mudanca,
    }
    const val = validadeDe(colabTemp)
    const base = baseValidade(colabTemp)
    const baseNome = nomeBase(colabTemp)
    const frase = frasesValidade(colabTemp)

    return {
      validade: val,
      base,
      baseNome,
      frase,
    }
  }, [formData.aso, formData.periodico, formData.retorno, formData.mudanca])

  // Abertura do editor
  const abrirEditor = (colab?: ColaboradorAso) => {
    setEditorFeedback(null)
    setConfirmDelete(false)

    if (colab) {
      setIsNovo(false)
      setEditId(colab.id)
      const matHydro = colab.matricula_hydro || colab.matricula || ''
      const matSucena = colab.matricula_sucena || ''
      setFormData({
        nome: colab.nome || '',
        status: colab.status || 'Ativo (Em Efetivo)',
        matriculaHydro: matHydro,
        matriculaSucena: matSucena,
        admissional: colab.data_admissao ? colab.data_admissao.slice(0, 10) : '',
        setor: colab.setor || 'BARCARENA - PA',
        funcao: colab.cargo || '',
        aso: colab.aso_admissional ? colab.aso_admissional.slice(0, 10) : '',
        periodico: colab.aso_periodico ? colab.aso_periodico.slice(0, 10) : '',
        retorno: colab.retorno_ao_trabalho ? colab.retorno_ao_trabalho.slice(0, 10) : '',
        mudanca: colab.mudanca_de_risco ? colab.mudanca_de_risco.slice(0, 10) : '',
        obs: colab.observacao || '',
      })
    } else {
      setIsNovo(true)
      setEditId('')
      setFormData({
        nome: '',
        status: 'Ativo (Em Efetivo)',
        matriculaHydro: '',
        matriculaSucena: '',
        admissional: '',
        setor: 'BARCARENA - PA',
        funcao: '',
        aso: '',
        periodico: '',
        retorno: '',
        mudanca: '',
        obs: '',
      })
    }

    setEditorOpen(true)
    setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const fecharEditor = () => {
    setEditorOpen(false)
    setEditorFeedback(null)
    setConfirmDelete(false)
    setTimeout(() => {
      listaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  // Salvar no Supabase
  const handleSalvar = async () => {
    if (!canEdit) {
      toast.error('Apenas Auxiliar Administrativo e Técnico de Segurança podem alterar as datas.')
      return
    }

    if (!formData.nome.trim()) {
      setEditorFeedback({
        tipo: 'erro',
        msg: '⚠️ NÃO SALVOU — preencha o NOME COMPLETO do colaborador.',
      })
      return
    }

    setIsSaving(true)
    setEditorFeedback(null)

    try {
      const payload: any = {
        nome: formData.nome.trim(),
        cargo: formData.funcao.trim() || null,
        status: formData.status,
        matricula_hydro: formData.matriculaHydro.trim() || null,
        matricula_sucena: formData.matriculaSucena.trim() || null,
        matricula: formData.matriculaHydro.trim() || formData.matriculaSucena.trim() || null,
        data_admissao: formData.admissional || null,
        aso_admissional_2: formData.admissional || null,
        setor: formData.setor.trim() || null,
        aso_admissional: formData.aso || null,
        aso_periodico: formData.periodico || null,
        retorno_ao_trabalho: formData.retorno || null,
        mudanca_de_risco: formData.mudanca || null,
        observacao: formData.obs.trim() || null,
      }

      if (isNovo) {
        const { data, error } = await supabase.from('rh_efetivo').insert([payload]).select().single()
        if (error) throw error

        toast.success(`✅ ${payload.nome} cadastrado com sucesso!`)
        setEditId(data.id)
        setIsNovo(false)
      } else {
        const { error } = await supabase.from('rh_efetivo').update(payload).eq('id', editId)
        if (error) throw error

        toast.success(`✅ Alterações salvas para ${payload.nome}!`)
      }

      const valPreview = previewValidade.validade
      setEditorFeedback({
        tipo: 'ok',
        msg: `✅ SALVO! ${formData.nome} atualizado no Controle de ASO e sincronizado com o RH.\n` +
          (valPreview
            ? `VALIDADE ASO (EFETIVA): ${fmtDate(valPreview)} — ${previewValidade.frase} (base: ${previewValidade.baseNome} em ${fmtDate(previewValidade.base)} + 1 ano).`
            : `Sem data de ASO informada — validade ainda não calculada.`),
      })

      await carregarColaboradores()
    } catch (err: any) {
      console.error('Erro ao salvar colaborador:', err)
      setEditorFeedback({
        tipo: 'erro',
        msg: `❌ Erro ao salvar no banco de dados: ${err.message || 'Verifique sua conexão.'}`,
      })
      toast.error('Erro ao salvar no banco de dados')
    } finally {
      setIsSaving(false)
    }
  }

  // Excluir colaborador (com dupla confirmação)
  const handleExcluir = async () => {
    if (!canEdit) {
      toast.error('Permissão negada.')
      return
    }

    if (!confirmDelete) {
      setConfirmDelete(true)
      setEditorFeedback({
        tipo: 'erro',
        msg: `⚠️ EXCLUIR ${formData.nome || 'o colaborador'} do Controle de ASO?\nClique novamente no botão da lixeira para confirmar a exclusão.`,
      })
      setTimeout(() => setConfirmDelete(false), 5000)
      return
    }

    try {
      setIsSaving(true)
      const { error } = await supabase.from('rh_efetivo').delete().eq('id', editId)
      if (error) {
        // Se houver restrição de FK em cascata, marca como DESLIGADO/INATIVO
        const { error: updErr } = await supabase
          .from('rh_efetivo')
          .update({ status: 'Desligado' })
          .eq('id', editId)
        if (updErr) throw updErr
        toast.info('Colaborador marcado como Desligado devido a registros vinculados.')
      } else {
        toast.success('Colaborador excluído com sucesso.')
      }

      fecharEditor()
      await carregarColaboradores()
    } catch (err: any) {
      console.error('Erro ao excluir:', err)
      toast.error('Erro ao excluir colaborador.')
    } finally {
      setIsSaving(false)
      setConfirmDelete(false)
    }
  }

  // Copiar relatório como texto
  const handleCopiarRelatorio = () => {
    let s = `RELATÓRIO AUTOMÁTICO — CONTROLE DE ASO (Hydro Reabilitação)\n`
    s += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n`
    s += `Regra: Validade ASO (Efetiva) = data mais recente entre ASO/Periódico/Retorno/Mudança de Risco + 1 ano.\n`
    s += `Total de Colaboradores: ${baseFiltrada.length} (${stats.validos} válidos, ${stats.vencendo} a vencer em 30 dias, ${stats.vencidos} vencidos)\n\n`

    listaRelatorio.forEach((c, idx) => {
      const st = statusASO(c)
      const v = validadeDe(c)
      s += `${idx + 1}. ${c.nome} — ${c.cargo || 'Função não informada'} [${st.label}]\n`
      s += `   ASO: ${fmtDate(c.aso_admissional)} • Periódico: ${fmtDate(c.aso_periodico)} • Retorno: ${fmtDate(c.retorno_ao_trabalho)} • Mudança: ${fmtDate(c.mudanca_de_risco)}\n`
      s += `   Validade Efetiva: ${v ? fmtDate(v) : '—'} (${st.txt}) • Base: ${nomeBase(c) || '—'}\n`
      if (c.observacao) s += `   Observação: ${c.observacao}\n`
      s += `\n`
    })

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(s).then(() => {
        toast.success('📋 Relatório copiado para a área de transferência!')
      })
    } else {
      prompt('Copie o relatório abaixo:', s)
    }
  }

  // Exportar Relatório Oficial em PDF (A4 Paisagem com Logo Sucena)
  const handleExportarPDF = async () => {
    try {
      setIsExportingPdf(true)
      const fileName = await exportarControleAsoPDF(listaRelatorio, stats)
      toast.success(`PDF "${fileName}" gerado com sucesso!`)
    } catch (err: any) {
      console.error('Erro ao gerar PDF do Controle de ASO:', err)
      toast.error('Erro ao gerar PDF do relatório')
    } finally {
      setIsExportingPdf(false)
    }
  }

  // Exportar Planilha Excel (.xlsx estilizada com Logo Sucena)
  const handleExportarExcel = async () => {
    try {
      setIsExportingExcel(true)
      const fileName = await exportarControleAsoExcel(listaRelatorio, stats)
      toast.success(`Planilha "${fileName}" exportada com sucesso!`)
    } catch (err: any) {
      console.error('Erro ao exportar Excel:', err)
      toast.error('Erro ao exportar planilha Excel')
    } finally {
      setIsExportingExcel(false)
    }
  }

  // Visualizar e Imprimir relatório com layout executivo e Logo Sucena
  const handleImprimirRelatorio = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Permita pop-ups no navegador para imprimir o relatório.')
      return
    }

    const doc = gerarHtmlRelatorioAso(listaRelatorio, stats)
    printWindow.document.write(doc)
    printWindow.document.close()
  }

  return (
    <div className={`min-h-screen w-full px-3 sm:px-6 lg:px-8 pt-8 sm:pt-10 pb-24 transition-colors ${isDark ? 'bg-[#0f172a] text-white' : 'bg-[#fafafa] text-gray-900'}`}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Breadcrumb e Navegação */}
        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400">
          <Link
            to="/seguranca"
            className="flex items-center gap-1.5 hover:text-amber-600 dark:hover:text-amber-400 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Segurança</span>
          </Link>
          <span>›</span>
          <span className="text-gray-900 dark:text-white font-bold">Controle de ASO</span>
        </div>

        {/* Título Principal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2.5">
              <span>🩺 Controle de ASO</span>
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-gray-700 dark:text-gray-300 max-w-4xl font-medium">
              Página <b>configurável</b> do <b>Controle Médico (ASO)</b> dos colaboradores do Efetivo, sincronizada diretamente com o <b>RH</b>. Clique em um colaborador para <b>editar</b>: ao alterar qualquer data de exame, a <b>VALIDADE ASO (EFETIVA) fica automaticamente para 1 ano depois</b>, sem precisar calcular na mão.
            </p>
          </div>
        </div>

        {/* Card Informativo da Regra de Validade */}
        <div className="bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 border-l-4 sm:border-l-6 border-l-blue-600 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-blue-950 dark:text-blue-200 leading-relaxed">
              <strong className="font-bold text-blue-900 dark:text-blue-300 block mb-1">
                Regra da validade — leia antes de editar:
              </strong>
              A <b>VALIDADE ASO (EFETIVA)</b> é calculada automaticamente: pega a <b>data mais recente</b> entre <b>ASO, Periódico, Retorno ao Trabalho e Mudança de Risco</b> e soma <b>1 ano</b>. Exemplo: ASO em <b>29/06/2026</b> → validade <b>29/06/2027</b>. Mudou qualquer uma dessas datas no cadastro, a validade muda na hora, já na tela de edição.
            </div>
          </div>
        </div>

        {/* Banner de Permissão (aviso se não for Aux. Adm., TST ou Admin) */}
        {!canEdit && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl p-3 sm:p-4 text-xs sm:text-sm text-amber-900 dark:text-amber-200 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <strong>Modo de Leitura:</strong> Somente cargos como <b>Auxiliar Administrativo</b> e <b>Técnico de Segurança</b> (ou Administradores) possuem permissão para salvar e editar datas do Controle Médico de ASO.
            </div>
          </div>
        )}

        {/* SEÇÃO 1: LISTA DE COLABORADORES */}
        <section
          ref={listaRef}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm space-y-5"
        >
          {/* Header da Seção */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-500" />
                <span>👥 Efetivo — Controle de ASO</span>
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium mt-0.5">
                {loading
                  ? 'Carregando colaboradores do RH...'
                  : `${stats.total} colaborador(es) no filtro • ${stats.validos} com ASO válido • ${stats.vencendo} a vencer em 30 dias • ${stats.vencidos} vencido(s)`}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
              <button
                type="button"
                disabled={isExportingPdf}
                onClick={handleExportarPDF}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white transition shadow-xs cursor-pointer disabled:opacity-50"
                title="Exportar Relatório Oficial em PDF (com Logo da Sucena)"
              >
                <FileText className="w-4 h-4" />
                <span>{isExportingPdf ? 'Gerando...' : 'Baixar PDF'}</span>
              </button>

              <button
                type="button"
                disabled={isExportingExcel}
                onClick={handleExportarExcel}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs cursor-pointer disabled:opacity-50"
                title="Exportar Planilha Excel (.xlsx formatada com Logo)"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{isExportingExcel ? 'Exportando...' : 'Planilha Excel'}</span>
              </button>

              <button
                type="button"
                onClick={handleImprimirRelatorio}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold rounded-xl bg-gray-700 hover:bg-gray-800 text-white dark:bg-gray-800 dark:hover:bg-gray-700 transition shadow-xs cursor-pointer"
                title="Visualizar e Imprimir Relatório Oficial"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Imprimir</span>
              </button>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => abrirEditor()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold rounded-xl bg-amber-400 hover:bg-amber-500 text-black transition shadow-xs cursor-pointer"
                  title="Cadastrar novo colaborador"
                >
                  <Plus className="w-4 h-4" />
                  <span>➕ Novo</span>
                </button>
              )}
            </div>
          </div>

          {/* Filtros de Busca, Status e Ordenação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2 relative">
              <label className="block text-[11px] font-extrabold tracking-wider uppercase text-gray-500 dark:text-gray-400 mb-1">
                Buscar por nome, cargo ou matrícula
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome, cargo ou matrícula..."
                  className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm font-semibold rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold tracking-wider uppercase text-gray-500 dark:text-gray-400 mb-1">
                Colaboradores
              </label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value as any)}
                className="w-full py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
              >
                <option value="ativos">Apenas Ativos</option>
                <option value="ferias">Férias</option>
                <option value="afastados">Afastados</option>
                <option value="desligados">Desligados</option>
                <option value="todos">Todos</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold tracking-wider uppercase text-gray-500 dark:text-gray-400 mb-1">
                Ordenação
              </label>
              <select
                value={filtroOrdem}
                onChange={(e) => setFiltroOrdem(e.target.value as any)}
                className="w-full py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
              >
                <option value="alfabetica">Ordem Alfabética (A-Z)</option>
                <option value="validade">Validade ASO (Mais Próximos)</option>
              </select>
            </div>
          </div>

          {/* Pills de Situação do ASO */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setFiltroSituacao('todos')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer border ${
                filtroSituacao === 'todos'
                  ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-black dark:border-white'
                  : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Todos ({stats.total})
            </button>

            <button
              type="button"
              onClick={() => setFiltroSituacao('validos')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer border ${
                filtroSituacao === 'validos'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
              }`}
            >
              Válidos ({stats.validos})
            </button>

            <button
              type="button"
              onClick={() => setFiltroSituacao('vencendo')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer border ${
                filtroSituacao === 'vencendo'
                  ? 'bg-amber-500 text-black border-amber-500'
                  : 'bg-white dark:bg-gray-800 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900 hover:bg-amber-50 dark:hover:bg-amber-950/40'
              }`}
            >
              A vencer (30 dias) ({stats.vencendo})
            </button>

            <button
              type="button"
              onClick={() => setFiltroSituacao('vencidos')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer border ${
                filtroSituacao === 'vencidos'
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white dark:bg-gray-800 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/40'
              }`}
            >
              Vencidos ({stats.vencidos})
            </button>

            <button
              type="button"
              onClick={() => setFiltroSituacao('sem')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer border ${
                filtroSituacao === 'sem'
                  ? 'bg-gray-600 text-white border-gray-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Sem ASO ({stats.sem})
            </button>
          </div>

          {/* Cards de Métricas (Stats) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
            <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-center">
              <span className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white block">
                {stats.total}
              </span>
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                Colaboradores
              </span>
            </div>

            <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-3 text-center">
              <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 block">
                {stats.validos}
              </span>
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                ASO Válidos
              </span>
            </div>

            <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3 text-center">
              <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 block">
                {stats.vencendo}
              </span>
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                A Vencer (30d)
              </span>
            </div>

            <div className="bg-red-50/60 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl p-3 text-center">
              <span className="text-xl sm:text-2xl font-black text-red-600 dark:text-red-400 block">
                {stats.vencidos}
              </span>
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-red-800 dark:text-red-300">
                ASO Vencidos
              </span>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
              <span className="text-xl sm:text-2xl font-black text-gray-700 dark:text-gray-300 block">
                {stats.sem}
              </span>
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                Sem ASO
              </span>
            </div>
          </div>

          {/* Tabela de Colaboradores */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left border-collapse min-w-[860px]">
              <thead>
                <tr className="border-b-2 border-gray-900 dark:border-white bg-gray-50/70 dark:bg-gray-800/40 text-[12px] font-extrabold uppercase tracking-wider text-gray-900 dark:text-white">
                  <th className="py-3 px-3">Matrícula Hydro</th>
                  <th className="py-3 px-3">Nome</th>
                  <th className="py-3 px-3">Cargo / Função</th>
                  <th className="py-3 px-3">ASO</th>
                  <th className="py-3 px-3">Validade ASO (Efetiva)</th>
                  <th className="py-3 px-3">Situação do ASO</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-xs sm:text-sm font-semibold">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500 font-medium">
                      Carregando colaboradores do RH...
                    </td>
                  </tr>
                ) : listaVisivel.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500 font-medium">
                      Nenhum colaborador encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  listaVisivel.map((c) => {
                    const st = statusASO(c)
                    const val = validadeDe(c)
                    const frases = frasesValidade(c)
                    const ativo = isAtivo(c.status)

                    return (
                      <tr
                        key={c.id}
                        onClick={() => abrirEditor(c)}
                        className="hover:bg-amber-50/60 dark:hover:bg-gray-800/60 transition cursor-pointer group"
                      >
                        <td className="py-3 px-3 font-mono text-gray-700 dark:text-gray-300">
                          <span className="font-bold text-gray-900 dark:text-white block">
                            {c.matricula_hydro || c.matricula || '—'}
                          </span>
                          {c.matricula_sucena && (
                            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block">
                              Sucena: {c.matricula_sucena}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 font-bold text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                          {c.nome}
                        </td>

                        <td className="py-3 px-3 text-gray-600 dark:text-gray-300 text-xs">
                          {c.cargo || '—'}
                        </td>

                        <td className="py-3 px-3 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {c.aso_admissional ? fmtDate(c.aso_admissional) : '—'}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-extrabold text-blue-600 dark:text-blue-400 text-sm block">
                            {val ? fmtDate(val) : '—'}
                          </span>
                          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block leading-tight">
                            {frases}
                          </span>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase ${st.badgeClass}`}>
                            {st.label}
                          </span>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          {(() => {
                            const s = (c.status || '').toUpperCase().trim()
                            if (s.includes('FERIAS') || s.includes('FÉRIAS')) {
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                                  🌴 FÉRIAS
                                </span>
                              )
                            }
                            if (s.includes('AFASTAD')) {
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                                  🩹 AFASTADO
                                </span>
                              )
                            }
                            if (s === 'DESLIGADO' || s === 'INATIVO' || s === 'DEMITIDO') {
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-200 dark:border-red-900">
                                  ● DESLIGADO
                                </span>
                              )
                            }
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                ● ATIVO
                              </span>
                            )
                          })()}
                        </td>

                        <td className="py-3 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => abrirEditor(c)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-gray-900 text-white dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 transition cursor-pointer"
                          >
                            <span>{canEdit ? '✏️ Editar' : '👁️ Ver'}</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">
            💡 Dica: Clique em qualquer linha ou no botão <b>Editar</b> para abrir o cadastro do colaborador e alterar as datas do Controle Médico (ASO).
          </p>
        </section>

        {/* SEÇÃO 2: EDITOR DO COLABORADOR / CONTROLE MÉDICO */}
        {editorOpen && (
          <section
            ref={editorRef}
            className="bg-white dark:bg-gray-900 border-2 border-amber-400 dark:border-amber-500 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl space-y-5 animate-in fade-in slide-in-from-top-4 duration-300"
          >
            {/* Header do Editor */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800 gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white uppercase">
                  {formData.nome || (isNovo ? 'Novo Colaborador' : 'Editar Colaborador')}
                </h2>
                <div className="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-0.5">
                  {formData.funcao || 'Preencha os dados abaixo — validade do ASO calculada automaticamente (+1 ano)'}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                {canEdit && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSalvar}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-extrabold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'Salvando...' : '💾 Salvar'}</span>
                  </button>
                )}

                {!isNovo && canEdit && (
                  <button
                    type="button"
                    onClick={handleExcluir}
                    className={`p-2 rounded-full border transition cursor-pointer ${
                      confirmDelete
                        ? 'bg-red-600 text-white border-red-700 animate-pulse'
                        : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400'
                    }`}
                    title={confirmDelete ? 'Clique de novo para confirmar exclusão' : 'Excluir colaborador'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={fecharEditor}
                  className="p-2 rounded-full border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 transition cursor-pointer"
                  title="Fechar sem salvar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Campos Cadastrais */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Nome completo *
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome completo do colaborador"
                  className="w-full px-3.5 py-2.5 text-sm font-bold rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    disabled={!canEdit}
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm font-bold rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60 transition"
                  >
                    <option value="Ativo (Em Efetivo)">Ativo (Em Efetivo)</option>
                    <option value="Ativo">Ativo</option>
                    <option value="Afastado">Afastado</option>
                    <option value="Férias">Férias</option>
                    <option value="Desligado">Desligado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Matrícula Hydro
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={formData.matriculaHydro}
                    onChange={(e) => setFormData({ ...formData, matriculaHydro: e.target.value })}
                    placeholder="Ex.: 59178"
                    className="w-full px-3.5 py-2.5 text-sm font-bold rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Admissional (Data de Admissão)
                  </label>
                  <input
                    type="date"
                    disabled={!canEdit}
                    value={formData.admissional}
                    onChange={(e) => setFormData({ ...formData, admissional: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm font-bold rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Matrícula Sucena
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={formData.matriculaSucena}
                    onChange={(e) => setFormData({ ...formData, matriculaSucena: e.target.value })}
                    placeholder="Matrícula Sucena..."
                    className="w-full px-3.5 py-2.5 text-sm font-bold rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Setor
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={formData.setor}
                    onChange={(e) => setFormData({ ...formData, setor: e.target.value })}
                    placeholder="Ex.: BARCARENA - PA"
                    className="w-full px-3.5 py-2.5 text-sm font-bold rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Função / Cargo
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={formData.funcao}
                    onChange={(e) => setFormData({ ...formData, funcao: e.target.value })}
                    placeholder="Ex.: TECNICO DE SEGURANÇA DO TRABALHO"
                    className="w-full px-3.5 py-2.5 text-sm font-bold rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60 transition"
                  />
                </div>
              </div>
            </div>

            {/* Divisor do Controle Médico (ASO) */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2 text-base sm:text-lg font-black text-gray-900 dark:text-white mb-1">
                <span>Controle Médico (ASO) ✏️</span>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
                Altere qualquer data abaixo: a <b>VALIDADE ASO (EFETIVA)</b> é recalculada <b>na hora</b> para <b>1 ano depois</b> da data mais recente entre ASO, Periódico, Retorno ao Trab. e Mudança de Risco.
              </p>
            </div>

            {/* 4 Inputs de Data do ASO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  ASO
                </label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={formData.aso}
                  onChange={(e) => setFormData({ ...formData, aso: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm font-bold rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Periódico
                </label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={formData.periodico}
                  onChange={(e) => setFormData({ ...formData, periodico: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm font-bold rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Retorno ao Trab.
                </label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={formData.retorno}
                  onChange={(e) => setFormData({ ...formData, retorno: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm font-bold rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Mudança de Risco
                </label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={formData.mudanca}
                  onChange={(e) => setFormData({ ...formData, mudanca: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm font-bold rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60 transition"
                />
              </div>
            </div>

            {/* Observação e Box de Validade Preview em Tempo Real */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                  Observação
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.obs}
                  onChange={(e) => setFormData({ ...formData, obs: e.target.value })}
                  placeholder="Ex.: ASO REALIZADO 10/11/2025"
                  className="w-full px-3.5 py-2.5 text-sm font-bold rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60 transition"
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-2xl p-4">
                <div className="text-[11px] font-black uppercase tracking-wider text-gray-600 dark:text-gray-300">
                  Validade ASO (Efetiva) — automática, +1 ano
                </div>
                <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 mt-1">
                  {previewValidade.validade ? fmtDate(previewValidade.validade) : '—'}
                </div>
                <div className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mt-1 leading-relaxed">
                  {previewValidade.validade ? (
                    <span>
                      Base: <b>{previewValidade.baseNome}</b> em <b>{fmtDate(previewValidade.base)}</b> + 1 ano = <b>{fmtDate(previewValidade.validade)}</b>. {previewValidade.frase}.
                    </span>
                  ) : (
                    <span>Preencha pelo menos uma data do Controle Médico (ASO) para calcular a validade.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Mensagem de Feedback do Editor */}
            {editorFeedback && (
              <div
                className={`p-4 rounded-xl text-xs sm:text-sm font-bold leading-relaxed whitespace-pre-line ${
                  editorFeedback.tipo === 'ok'
                    ? 'bg-emerald-50 text-emerald-900 border-2 border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200'
                    : 'bg-red-50 text-red-900 border-2 border-red-500 dark:bg-red-950/40 dark:text-red-200'
                }`}
              >
                {editorFeedback.msg}
              </div>
            )}

            {/* Botões do Rodapé do Editor */}
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
              {canEdit && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSalvar}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs sm:text-sm font-extrabold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Salvando alterações...' : '💾 Salvar alterações'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={fecharEditor}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 transition cursor-pointer"
              >
                <span>← Voltar para a lista</span>
              </button>
            </div>
          </section>
        )}

        {/* SEÇÃO 3: RELATÓRIO AUTOMÁTICO */}
        <section className="bg-white dark:bg-gray-900 border-2 border-gray-900 dark:border-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
                📋 Relatório Automático — Controle de ASO
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
                Atualizado automaticamente a cada colaborador salvo, editado ou excluído — sem preencher de novo. Ordenado por quem vence primeiro.
              </p>
            </div>
          </div>

          {/* Barra de Progresso */}
          <div>
            <div className="w-full h-3 sm:h-4 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-500 rounded-full"
                style={{ width: `${stats.pctValidos}%` }}
              />
            </div>
            <div className="mt-1.5 text-xs sm:text-sm font-black text-gray-900 dark:text-white">
              {stats.pctValidos}% válidos — {stats.validos} de {stats.total} colaborador(es)
            </div>
          </div>

          {/* Resumo e Lista de Itens do Relatório */}
          <div className="bg-gray-50/70 dark:bg-gray-800/40 rounded-xl p-3 sm:p-4 border border-gray-200 dark:border-gray-800 space-y-3">
            <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white leading-relaxed">
              Resumo automático: <b>{stats.total} colaborador(es)</b> —{' '}
              <span className="text-emerald-600 font-bold">{stats.validos} válido(s)</span>,{' '}
              <span className="text-amber-600 font-bold">{stats.vencendo} a vencer em 30 dias</span>,{' '}
              <span className="text-red-600 font-bold">{stats.vencidos} vencido(s)</span>. Regra: validade efetiva = data mais recente do ASO + 1 ano.
            </p>

            <div className="max-h-96 overflow-y-auto space-y-2 pr-1 divide-y divide-gray-200 dark:divide-gray-800">
              {listaRelatorio.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-500 font-medium">
                  Nenhum colaborador no filtro atual.
                </div>
              ) : (
                listaRelatorio.map((c, i) => {
                  const st = statusASO(c)
                  const v = validadeDe(c)
                  return (
                    <div key={c.id} className="pt-2 text-xs sm:text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                      <b>{i + 1}. {c.nome}</b> — {c.cargo || 'Função não informada'}<br />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        Situação: <b className="text-gray-900 dark:text-white">{st.label}</b> — {st.txt}<br />
                        ASO: <b>{c.aso_admissional ? fmtDate(c.aso_admissional) : '—'}</b> • Periódico: <b>{c.aso_periodico ? fmtDate(c.aso_periodico) : '—'}</b> • Retorno ao Trab.: <b>{c.retorno_ao_trabalho ? fmtDate(c.retorno_ao_trabalho) : '—'}</b> • Mudança de Risco: <b>{c.mudanca_de_risco ? fmtDate(c.mudanca_de_risco) : '—'}</b><br />
                        Validade ASO (Efetiva): <b className="text-blue-600 dark:text-blue-400 font-extrabold">{v ? fmtDate(v) : '—'}</b> (base: {nomeBase(c) || '—'}) • Matrícula Hydro: {c.matricula_hydro || '—'} • Status: {c.status || '—'}
                        {c.observacao && <span><br />Observação: {c.observacao}</span>}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Botões de Ação do Relatório */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="button"
              disabled={isExportingPdf}
              onClick={handleExportarPDF}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white transition cursor-pointer disabled:opacity-50"
              title="Baixar Relatório Oficial em PDF (A4 Paisagem com Logo da Sucena)"
            >
              <FileText className="w-4 h-4" />
              <span>{isExportingPdf ? 'Gerando...' : 'Baixar PDF'}</span>
            </button>

            <button
              type="button"
              disabled={isExportingExcel}
              onClick={handleExportarExcel}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer disabled:opacity-50"
              title="Baixar Planilha Excel formatada com Logo da Sucena"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isExportingExcel ? 'Exportando...' : 'Planilha Excel'}</span>
            </button>

            <button
              type="button"
              onClick={handleImprimirRelatorio}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-100 text-white dark:text-black transition cursor-pointer"
              title="Visualizar e Imprimir Relatório"
            >
              <Printer className="w-4 h-4" />
              <span>🖨️ Imprimir</span>
            </button>

            <button
              type="button"
              onClick={handleCopiarRelatorio}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-amber-400 hover:bg-amber-500 text-black transition cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              <span>📋 Copiar relatório (texto)</span>
            </button>
          </div>
        </section>

        {/* Rodapé Informativo */}
        <footer className="text-center text-xs text-gray-500 dark:text-gray-400 font-medium pt-4 leading-relaxed">
          Hydro Reabilitação — Segurança • Controle de ASO • Integrado ao Banco de Dados (Supabase) e sincronizado com o RH (Efetivo). Validade ASO (Efetiva) = data mais recente do exame + 1 ano.
        </footer>

      </div>
    </div>
  )
}
