import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  ArrowLeft,
  GraduationCap,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  Copy,
  Trash2,
  Plus,
  RefreshCw,
  Calendar,
} from 'lucide-react'

export const Route = createFileRoute('/seguranca/controle-treinamento')({
  component: ControleTreinamentoPage,
})

export interface ColaboradorEfetivo {
  id: string
  nome: string
  cargo?: string
  matricula?: string
  setor?: string
  status?: string
}

export interface TreinamentoSalvo {
  uid: string
  colabId: string
  nome: string
  cargo: string
  matricula: string
  setor: string
  nr: string
  nrTitulo: string
  inicio?: string
  expira: string
  salvoEm: string
}

export const NRS = [
  { cod: 'NR-01', titulo: 'Disposições Gerais e Gerenciamento de Riscos Ocupacionais' },
  { cod: 'NR-03', titulo: 'Embargo e Interdição' },
  { cod: 'NR-04', titulo: 'Serviços Especializados em Segurança e Medicina do Trabalho (SESMT)' },
  { cod: 'NR-05', titulo: 'Comissão Interna de Prevenção de Acidentes e de Assédio (CIPA)' },
  { cod: 'NR-06', titulo: 'Equipamentos de Proteção Individual (EPI)' },
  { cod: 'NR-07', titulo: 'Programa de Controle Médico de Saúde Ocupacional (PCMSO)' },
  { cod: 'NR-08', titulo: 'Edificações' },
  { cod: 'NR-09', titulo: 'Avaliação e Controle das Exposições Ocupacionais a Agentes Físicos, Químicos e Biológicos' },
  { cod: 'NR-10', titulo: 'Segurança em Instalações e Serviços em Eletricidade' },
  { cod: 'NR-11', titulo: 'Transporte, Movimentação, Armazenagem e Manuseio de Materiais' },
  { cod: 'NR-12', titulo: 'Segurança no Trabalho em Máquinas e Equipamentos' },
  { cod: 'NR-13', titulo: 'Caldeiras, Vasos de Pressão, Tubulações e Tanques Metálicos de Armazenamento' },
  { cod: 'NR-14', titulo: 'Fornos' },
  { cod: 'NR-15', titulo: 'Atividades e Operações Insalubres' },
  { cod: 'NR-16', titulo: 'Atividades e Operações Perigosas' },
  { cod: 'NR-17', titulo: 'Ergonomia' },
  { cod: 'NR-18', titulo: 'Segurança e Saúde no Trabalho na Indústria da Construção' },
  { cod: 'NR-19', titulo: 'Explosivos' },
  { cod: 'NR-20', titulo: 'Segurança e Saúde no Trabalho com Inflamáveis e Combustíveis' },
  { cod: 'NR-21', titulo: 'Trabalhos a Céu Aberto' },
  { cod: 'NR-22', titulo: 'Segurança e Saúde Ocupacional na Mineração' },
  { cod: 'NR-23', titulo: 'Proteção Contra Incêndios' },
  { cod: 'NR-24', titulo: 'Condições Sanitárias e de Conforto nos Locais de Trabalho' },
  { cod: 'NR-25', titulo: 'Resíduos Industriais' },
  { cod: 'NR-26', titulo: 'Sinalização de Segurança' },
  { cod: 'NR-28', titulo: 'Fiscalização e Penalidades' },
  { cod: 'NR-29', titulo: 'Segurança e Saúde no Trabalho Portuário' },
  { cod: 'NR-31', titulo: 'Segurança e Saúde no Trabalho na Agricultura, Pecuária, Silvicultura, Exploração Florestal e Aquicultura' },
  { cod: 'NR-32', titulo: 'Segurança e Saúde no Trabalho em Serviços de Saúde' },
  { cod: 'NR-33', titulo: 'Segurança e Saúde nos Trabalhos em Espaços Confinados' },
  { cod: 'NR-34', titulo: 'Condições e Meio Ambiente de Trabalho na Indústria da Construção e Reparação Naval' },
  { cod: 'NR-35', titulo: 'Trabalho em Altura' },
  { cod: 'NR-36', titulo: 'Segurança e Saúde no Trabalho em Empresas de Abate e Processamento de Carnes e Derivados' },
  { cod: 'NR-37', titulo: 'Segurança e Saúde em Plataformas de Petróleo' },
  { cod: 'NR-38', titulo: 'Segurança e Saúde no Trabalho nas Atividades de Limpeza Urbana e Manejo de Resíduos Sólidos' },
  { cod: 'OUTRO', titulo: 'Outro treinamento / Integração / Curso específico' },
]

function fmtDate(v?: string): string {
  if (!v) return '—'
  const p = String(v).split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : v
}

function diasAte(v?: string): number | null {
  if (!v) return null
  const parts = String(v).split('-').map(Number)
  if (parts.length < 3 || isNaN(parts[0])) return null
  const alvo = new Date(parts[0], parts[1] - 1, parts[2])
  alvo.setHours(12, 0, 0, 0)
  const hoje = new Date()
  hoje.setHours(12, 0, 0, 0)
  return Math.round((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

function nrTitulo(cod: string): string {
  const achado = NRS.find((n) => n.cod === cod)
  return achado ? achado.titulo : ''
}

function statusTreino(t: { expira?: string }): {
  k: 'valido' | 'vencendo' | 'vencido'
  label: string
  txt: string
} {
  const n = diasAte(t.expira)
  if (n === null) return { k: 'valido', label: '✅ VÁLIDO', txt: 'Sem data de vencimento informada' }
  if (n < 0) return { k: 'vencido', label: '🔴 VENCIDO', txt: `Venceu em ${fmtDate(t.expira)} — há ${Math.abs(n)} dia(s)` }
  if (n === 0) return { k: 'vencendo', label: '⏰ VENCE HOJE', txt: `Expira hoje, ${fmtDate(t.expira)}` }
  if (n <= 30) return { k: 'vencendo', label: '⚠️ A VENCER', txt: `Expira em ${fmtDate(t.expira)} — faltam ${n} dia(s)` }
  return { k: 'valido', label: '✅ VÁLIDO', txt: `Expira em ${fmtDate(t.expira)} — faltam ${n} dia(s)` }
}

function ControleTreinamentoPage() {
  const currentEnv = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
  const storageKey = `controle_treinamento_${currentEnv}`

  // Estados principais
  const [colaboradores, setColaboradores] = useState<ColaboradorEfetivo[]>([])
  const [treinamentos, setTreinamentos] = useState<TreinamentoSalvo[]>([])
  const [loadingRH, setLoadingRH] = useState(false)
  const [buscaRH, setBuscaRH] = useState('')

  // Passo 2
  const [nrSel, setNrSel] = useState('')

  // Passo 3
  const [marcados, setMarcados] = useState<Record<string, boolean>>({})
  const [datasInicio, setDatasInicio] = useState<Record<string, string>>({})
  const [datasExpira, setDatasExpira] = useState<Record<string, string>>({})
  const [invalidosExpira, setInvalidosExpira] = useState<Record<string, boolean>>({})
  const [cardFeedbacks, setCardFeedbacks] = useState<Record<string, { tipo: 'ok' | 'erro'; msg: string }>>({})

  // Feedbacks de seção
  const [rhFeedback, setRhFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)
  const [addFeedback, setAddFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)
  const [atribFeedback, setAtribFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)

  // Cadastro de colaborador demo
  const [novoNome, setNovoNome] = useState('')
  const [novoCargo, setNovoCargo] = useState('')
  const [novaMatricula, setNovaMatricula] = useState('')
  const [novoSetor, setNovoSetor] = useState('')
  const [invalidNovoNome, setInvalidNovoNome] = useState(false)

  // Filtros de controle
  const [filtroAtual, setFiltroAtual] = useState<'todos' | 'validos' | 'vencendo' | 'vencidos'>('todos')

  const atribSectionRef = useRef<HTMLDivElement>(null)

  // Carregar dados iniciais do Supabase
  const buscarColaboradoresRH = async (mostrarMensagem = false) => {
    setLoadingRH(true)
    try {
      const { data, error } = await supabase
        .from('rh_efetivo')
        .select('id, nome, cargo, matricula, setor, status')

      if (error) {
        console.warn('[Treinamento] Erro ao buscar colaboradores:', error)
        if (mostrarMensagem) {
          setRhFeedback({
            tipo: 'erro',
            msg: `Erro ao buscar no RH: ${error.message}. Verifique a conexão com o Supabase.`,
          })
        }
        return
      }

      // Filtrar apenas ATIVOS (efetivados)
      const ativos = (data || []).filter((c: any) => {
        const s = String(c.status || '').toUpperCase().trim()
        return s === 'ATIVO' || (s !== 'INATIVO' && s !== 'DEMITIDO' && s !== 'DESLIGADO' && s !== '')
      })

      setColaboradores(ativos)

      if (mostrarMensagem) {
        if (!ativos.length) {
          setRhFeedback({
            tipo: 'erro',
            msg: 'Nenhum colaborador com status ATIVO (efetivado) foi encontrado na tabela rh_efetivo do Supabase.\nCadastre um novo colaborador abaixo para testar.',
          })
        } else {
          setRhFeedback({
            tipo: 'ok',
            msg: `✅ ${ativos.length} colaborador(es) efetivado(s) carregado(s) do RH (status ATIVO).\nAgora selecione a NR no passo 2 e marque quem tem o treinamento no passo 3.`,
          })
        }
      }
    } catch (err: any) {
      console.warn('[Treinamento] Erro inesperado:', err)
      if (mostrarMensagem) {
        setRhFeedback({
          tipo: 'erro',
          msg: `Falha na requisição ao RH: ${err.message || 'Erro desconhecido'}.`,
        })
      }
    } finally {
      setLoadingRH(false)
    }
  }

  // Carregar treinamentos salvos
  useEffect(() => {
    const carregarTreinamentos = async () => {
      try {
        const { data: dbData } = await supabase
          .from('global_settings')
          .select('value')
          .eq('key', storageKey)
          .maybeSingle()

        if (dbData?.value) {
          const parsed = typeof dbData.value === 'string' ? JSON.parse(dbData.value) : dbData.value
          if (Array.isArray(parsed)) {
            setTreinamentos(parsed)
            return
          }
        }

        const local = localStorage.getItem(storageKey)
        if (local) {
          const parsed = JSON.parse(local)
          if (Array.isArray(parsed)) setTreinamentos(parsed)
        }
      } catch (err) {
        console.warn('[Treinamento] Erro ao carregar treinamentos:', err)
      }
    }

    buscarColaboradoresRH(false)
    carregarTreinamentos()

    // Sincronização em tempo real
    const channel = supabase
      .channel('controle_treinamento_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'global_settings', filter: `key=eq.${storageKey}` },
        (payload: any) => {
          if (payload?.new?.value && Array.isArray(payload.new.value)) {
            setTreinamentos(payload.new.value)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rh_efetivo' },
        () => {
          buscarColaboradoresRH(false)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [storageKey])

  // Persistir treinamentos
  const salvarTreinamentosNoBanco = async (novos: TreinamentoSalvo[]) => {
    setTreinamentos(novos)
    try {
      localStorage.setItem(storageKey, JSON.stringify(novos))
    } catch (_) {}

    try {
      const { data: existe } = await supabase
        .from('global_settings')
        .select('key')
        .eq('key', storageKey)
        .maybeSingle()

      if (existe?.key) {
        await supabase.from('global_settings').update({ value: novos }).eq('key', storageKey)
      } else {
        await supabase.from('global_settings').insert({ key: storageKey, value: novos })
      }
    } catch (err) {
      console.warn('[Treinamento] Falha ao persistir no Supabase:', err)
    }
  }

  // Contagem de treinamentos por colaborador
  const treinosPorColaborador = useMemo(() => {
    const mapa: Record<string, TreinamentoSalvo[]> = {}
    for (const t of treinamentos) {
      if (!mapa[t.colabId]) mapa[t.colabId] = []
      mapa[t.colabId].push(t)
    }
    return mapa
  }, [treinamentos])

  // Contagem de colaboradores por NR
  const contagemPorNR = useMemo(() => {
    const mapa: Record<string, number> = {}
    for (const t of treinamentos) {
      mapa[t.nr] = (mapa[t.nr] || 0) + 1
    }
    return mapa
  }, [treinamentos])

  // Lista visível de colaboradores no Passo 1
  const colaboradoresFiltrados = useMemo(() => {
    const q = buscaRH.trim().toLowerCase()
    if (!q) return colaboradores
    return colaboradores.filter((c) => {
      const texto = `${c.nome} ${c.cargo || ''} ${c.matricula || ''} ${c.setor || ''}`.toLowerCase()
      return texto.includes(q)
    })
  }, [colaboradores, buscaRH])

  // Selecionar NR
  const selecionarNR = (cod: string) => {
    setNrSel(cod)
    setMarcados({})
    setCardFeedbacks({})
    setInvalidosExpira({})
    setAtribFeedback(null)

    // Preencher as datas se já existir salvo nesta NR
    const novoInicio: Record<string, string> = {}
    const novoExpira: Record<string, string> = {}
    const novoMarcados: Record<string, boolean> = {}

    for (const c of colaboradores) {
      const ex = treinamentos.find((t) => t.colabId === c.id && t.nr === cod)
      if (ex) {
        novoInicio[c.id] = ex.inicio || ''
        novoExpira[c.id] = ex.expira || ''
        novoMarcados[c.id] = true
      } else {
        novoInicio[c.id] = ''
        novoExpira[c.id] = ''
        novoMarcados[c.id] = false
      }
    }

    setDatasInicio(novoInicio)
    setDatasExpira(novoExpira)
    setMarcados(novoMarcados)

    if (cod && atribSectionRef.current) {
      atribSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Cadastrar colaborador demo
  const handleCadastrarColaborador = async () => {
    const nomeTrim = novoNome.trim()
    if (!nomeTrim) {
      setInvalidNovoNome(true)
      setAddFeedback({
        tipo: 'erro',
        msg: '⚠️ NÃO ADICIONOU — preencha o NOME COMPLETO do colaborador efetivado.',
      })
      return
    }
    setInvalidNovoNome(false)

    try {
      const payload = {
        nome: nomeTrim,
        cargo: novoCargo.trim() || 'Colaborador',
        matricula: novaMatricula.trim() || '',
        setor: novoSetor.trim() || 'Obra',
        status: 'ATIVO',
      }

      const { data, error } = await supabase.from('rh_efetivo').insert(payload).select().single()

      if (error) {
        // Fallback local caso tabela esteja restrita por RLS
        const novoColab: ColaboradorEfetivo = {
          id: `c_${Date.now()}`,
          ...payload,
        }
        setColaboradores((prev) => [...prev, novoColab])
      } else if (data) {
        setColaboradores((prev) => [...prev, data])
      }

      setNovoNome('')
      setNovoCargo('')
      setNovaMatricula('')
      setNovoSetor('')
      setAddFeedback({
        tipo: 'ok',
        msg: `✅ Colaborador efetivado adicionado à lista do RH: ${nomeTrim}.\nEle já aparece na tabela acima e na escolha de colaboradores do passo 3.`,
      })
      toast.success(`Colaborador ${nomeTrim} adicionado com sucesso!`)
    } catch (err: any) {
      setAddFeedback({
        tipo: 'erro',
        msg: `Erro ao adicionar: ${err.message}`,
      })
    }
  }

  // Salvar individual
  const salvarUm = (cid: string, silencioso = false): boolean => {
    const colab = colaboradores.find((c) => c.id === cid)
    if (!colab) return false

    const isMarcado = !!marcados[cid]
    const inicio = datasInicio[cid] || ''
    const expira = datasExpira[cid] || ''

    if (!isMarcado) {
      if (!silencioso) {
        setCardFeedbacks((prev) => ({
          ...prev,
          [cid]: {
            tipo: 'erro',
            msg: '⚠️ NÃO SALVOU — marque a caixa “tem este treinamento” deste colaborador, ou ele não entra nesta NR.',
          },
        }))
      }
      return false
    }

    if (!expira) {
      setInvalidosExpira((prev) => ({ ...prev, [cid]: true }))
      if (!silencioso) {
        setCardFeedbacks((prev) => ({
          ...prev,
          [cid]: {
            tipo: 'erro',
            msg: `⚠️ NÃO SALVOU — preencha a DATA QUE EXPIRA (vencimento) do treinamento de ${colab.nome}. A data de início é opcional, mas a de vencimento é obrigatória.`,
          },
        }))
      }
      return false
    }

    setInvalidosExpira((prev) => ({ ...prev, [cid]: false }))

    if (inicio && expira < inicio) {
      setInvalidosExpira((prev) => ({ ...prev, [cid]: true }))
      if (!silencioso) {
        setCardFeedbacks((prev) => ({
          ...prev,
          [cid]: {
            tipo: 'erro',
            msg: `⚠️ NÃO SALVOU — a data que expira (${fmtDate(expira)}) está antes da data que iniciou (${fmtDate(inicio)}). Corrija as datas de ${colab.nome}.`,
          },
        }))
      }
      return false
    }

    const agora = new Date().toLocaleString('pt-BR')
    const existenteIdx = treinamentos.findIndex((t) => t.colabId === cid && t.nr === nrSel)
    let listaAtualizada = [...treinamentos]

    if (existenteIdx >= 0) {
      listaAtualizada[existenteIdx] = {
        ...listaAtualizada[existenteIdx],
        inicio,
        expira,
        salvoEm: agora,
      }
    } else {
      listaAtualizada.push({
        uid: `t_${Date.now()}_${cid}`,
        colabId: cid,
        nome: colab.nome,
        cargo: colab.cargo || '—',
        matricula: colab.matricula || '—',
        setor: colab.setor || '—',
        nr: nrSel,
        nrTitulo: nrTitulo(nrSel),
        inicio,
        expira,
        salvoEm: agora,
      })
    }

    salvarTreinamentosNoBanco(listaAtualizada)

    if (!silencioso) {
      setCardFeedbacks((prev) => ({
        ...prev,
        [cid]: {
          tipo: 'ok',
          msg: `✅ Treinamento ${nrSel} salvo para ${colab.nome}! Expira em ${fmtDate(expira)}.`,
        },
      }))
      toast.success(`✅ ${nrSel} salvo para ${colab.nome}`)
    }

    return true
  }

  // Salvar todos os marcados
  const handleSalvarTodosMarcados = () => {
    if (!nrSel) {
      setAtribFeedback({
        tipo: 'erro',
        msg: '⚠️ Selecione uma NR no passo 2 antes de salvar.',
      })
      return
    }

    const marcadosIds = Object.keys(marcados).filter((cid) => marcados[cid])
    if (!marcadosIds.length) {
      setAtribFeedback({
        tipo: 'erro',
        msg: '⚠️ NADA SALVO — nenhum colaborador marcado como “tem este treinamento”. Marque pelo menos um colaborador no passo 3.',
      })
      return
    }

    let salvos = 0
    const falhas: string[] = []

    for (const cid of marcadosIds) {
      const ok = salvarUm(cid, true)
      const colab = colaboradores.find((c) => c.id === cid)
      const nome = colab?.nome || 'Colaborador'
      if (ok) {
        salvos++
      } else {
        falhas.push(nome)
      }
    }

    if (falhas.length > 0) {
      setAtribFeedback({
        tipo: 'erro',
        msg: `⚠️ ${salvos} colaborador(es) salvos em ${nrSel}.\nNão salvou para: ${falhas.join(', ')} — falta a DATA QUE EXPIRA (obrigatória) ou as datas estão invertidas. Corrija na linha de cada um e salve de novo.`,
      })
      toast.error(`Atenção: ${falhas.length} colaborador(es) com pendência de data`)
    } else {
      setAtribFeedback({
        tipo: 'ok',
        msg: `✅ SALVO! ${salvos} colaborador(es) com ${nrSel} — ${nrTitulo(nrSel)} registrados no controle abaixo, cada um com sua data de vencimento.`,
      })
      toast.success(`✅ Todos os ${salvos} treinamentos foram salvos com sucesso!`)
    }
  }

  // Excluir treinamento
  const handleExcluirTreino = (uid: string) => {
    if (!confirm('Deseja realmente excluir este treinamento do controle?')) return
    const novos = treinamentos.filter((t) => t.uid !== uid)
    salvarTreinamentosNoBanco(novos)
    toast.success('Treinamento excluído — controle e relatório atualizados')
  }

  // Estatísticas do Relatório
  const totalSalvos = treinamentos.length
  const validosCount = useMemo(() => treinamentos.filter((t) => statusTreino(t).k === 'valido').length, [treinamentos])
  const vencendoCount = useMemo(() => treinamentos.filter((t) => statusTreino(t).k === 'vencendo').length, [treinamentos])
  const vencidosCount = useMemo(() => treinamentos.filter((t) => statusTreino(t).k === 'vencido').length, [treinamentos])
  const percentualValidos = totalSalvos > 0 ? Math.round((validosCount / totalSalvos) * 100) : 0

  // Treinamentos filtrados para o bloco de controle
  const treinamentosFiltrados = useMemo(() => {
    const ordenados = [...treinamentos].sort((a, b) => (a.expira || '9999').localeCompare(b.expira || '9999'))
    if (filtroAtual === 'validos') return ordenados.filter((t) => statusTreino(t).k === 'valido')
    if (filtroAtual === 'vencendo') return ordenados.filter((t) => statusTreino(t).k === 'vencendo')
    if (filtroAtual === 'vencidos') return ordenados.filter((t) => statusTreino(t).k === 'vencido')
    return ordenados
  }, [treinamentos, filtroAtual])

  // Agrupamento por colaborador
  const controlePorColaborador = useMemo(() => {
    const mapa: Record<string, TreinamentoSalvo[]> = {}
    for (const t of treinamentosFiltrados) {
      if (!mapa[t.colabId]) mapa[t.colabId] = []
      mapa[t.colabId].push(t)
    }
    return mapa
  }, [treinamentosFiltrados])

  // Copiar relatório
  const copiarRelatorio = () => {
    if (!treinamentos.length) {
      toast.info('Nenhum treinamento salvo para gerar relatório.')
      return
    }

    let texto = `RELATÓRIO AUTOMÁTICO — CONTROLE DE TREINAMENTO (Hydro Reabilitação)\n`
    texto += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n`
    texto += `Colaboradores efetivados (RH): ${colaboradores.length} • Treinamentos: ${treinamentos.length}\n`
    texto += `Válidos: ${validosCount} • A vencer (30 dias): ${vencendoCount} • Vencidos: ${vencidosCount} (${percentualValidos}% válidos)\n\n`

    const ordenados = [...treinamentos].sort((a, b) => a.nome.localeCompare(b.nome))
    ordenados.forEach((t, i) => {
      const st = statusTreino(t)
      texto += `${i + 1}. ${t.nome} — ${t.nr} ${t.nrTitulo} [${st.label}]\n`
      texto += `   Iniciou: ${t.inicio ? fmtDate(t.inicio) : 'não informada'} • Expira: ${fmtDate(t.expira)} (${st.txt})\n`
      if (t.cargo) texto += `   Cargo: ${t.cargo} • Matrícula: ${t.matricula || '—'}\n`
      texto += `\n`
    })

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(() => {
        toast.success('📋 Relatório copiado para a área de transferência!')
      })
    } else {
      prompt('Copie o relatório:', texto)
    }
  }

  // Imprimir relatório
  const imprimirRelatorio = () => {
    if (!treinamentos.length) {
      toast.info('Nenhum treinamento registrado para imprimir.')
      return
    }

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório — Controle de Treinamento — Hydro Reabilitação</title>
  <style>
    body { font-family: Arial, sans-serif; color: #000; padding: 24px; font-size: 13px; line-height: 1.5; }
    h1 { font-size: 22px; margin-bottom: 4px; color: #000; }
    .sub { color: #374151; font-size: 12px; margin-bottom: 18px; }
    .stats { display: flex; gap: 16px; margin: 16px 0; border: 1px solid #ccc; padding: 12px; border-radius: 8px; }
    .stat { flex: 1; text-align: center; }
    .stat b { font-size: 20px; display: block; }
    .rel-item { border-top: 1px solid #ccc; padding: 10px 0; line-height: 1.6; }
    .badge { font-weight: 800; padding: 2px 6px; border-radius: 4px; font-size: 11px; }
    .badge.valido { background: #dcfce7; color: #166534; }
    .badge.vence { background: #fef3c7; color: #92400e; }
    .badge.vencido { background: #dc2626; color: #fff; }
    .badge.nr { background: #111827; color: #f5c518; }
  </style>
</head>
<body>
  <h1>Relatório Automático — Controle de Treinamento</h1>
  <div class="sub">Hydro Reabilitação • Segurança do Trabalho • Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
  
  <div class="stats">
    <div class="stat"><b>${totalSalvos}</b>Total Treinamentos</div>
    <div class="stat"><b style="color:#16a34a">${validosCount}</b>Válidos</div>
    <div class="stat"><b style="color:#d97706">${vencendoCount}</b>A Vencer (30d)</div>
    <div class="stat"><b style="color:#dc2626">${vencidosCount}</b>Vencidos</div>
  </div>

  <p><strong>Colaboradores Efetivados:</strong> ${colaboradores.length} &nbsp;|&nbsp; <strong>Índice de Conformidade:</strong> ${percentualValidos}% válidos</p>

  <div style="margin-top: 18px;">
    ${[...treinamentos]
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map((t, i) => {
        const st = statusTreino(t)
        return `
      <div class="rel-item">
        <b>${i + 1}. ${t.nome}</b> — <span class="badge nr">${t.nr}</span> ${t.nrTitulo}<br>
        <span>Situação: <b>${st.label}</b> (${st.txt})<br>
        Iniciou: ${t.inicio ? fmtDate(t.inicio) : 'não informada'} • Expira: <b>${fmtDate(t.expira)}</b>
        ${t.cargo ? ` • Cargo: ${t.cargo}` : ''} ${t.matricula ? ` • Matrícula: ${t.matricula}` : ''}
        • Salvo em: ${t.salvoEm}</span>
      </div>`
      })
      .join('')}
  </div>
  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>`

    const w = window.open('', '_blank')
    if (!w) {
      toast.error('Permita pop-ups para imprimir, ou use o botão Copiar relatório')
      return
    }
    w.document.write(html)
    w.document.close()
  }

  return (
    <div className="min-h-screen bg-white text-[#111827] pb-24 font-sans">
      <style>{`
        /* CSS Obrigatório Controle de Treinamento — Hydro Reabilitação */
        label { font-size: 13px; font-weight: 900; letter-spacing: .03em; color: #000; display: block; margin: 14px 0 6px; text-transform: uppercase; }
        input, select, textarea { width: 100%; border: 1.5px solid #9ca3af; border-radius: 12px; padding: 12px 13px; font-size: 15px; font-family: inherit; outline: 0; background: #fff; color: #000; font-weight: 700; }
        input:focus, select:focus { border-color: #f5c518; box-shadow: 0 0 0 3px #fef3c7; }
        input::placeholder { color: #374151 !important; opacity: 1; font-weight: 600; }
        select option { color: #000; background: #fff; font-weight: 700; }
        input[type="date"] { color: #000; font-weight: 700; }
        .card { background: #fff; border: 1.5px solid #e5e7eb; border-radius: 20px; padding: 20px 22px; box-shadow: 0 8px 30px rgba(0,0,0,.05); margin-bottom: 20px; }
        .step { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; background: #111; color: #f5c518; font-weight: 900; font-size: 15px; margin-right: 8px; vertical-align: middle; }
        .btn { border: 0; border-radius: 12px; padding: 13px 20px; font-weight: 800; font-size: 15px; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
        .btn-yellow { background: #f5c518; color: #111; }
        .btn-yellow:hover { background: #eab308; }
        .btn-dark { background: #111; color: #fff; }
        .btn-dark:hover { background: #000; }
        .btn-green { background: #16a34a; color: #fff; }
        .btn-green:hover { background: #15803d; }
        .btn-red { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
        .btn-red:hover { background: #fee2e2; }
        .btn-sm { padding: 8px 13px; font-size: 13px; border-radius: 10px; }
        .badge { display: inline-flex; align-items: center; font-weight: 800; font-size: 11px; padding: 5px 9px; border-radius: 999px; letter-spacing: .04em; text-transform: uppercase; }
        .badge.ativo { background: #dcfce7; color: #166534; }
        .badge.valido { background: #dcfce7; color: #166534; }
        .badge.vence { background: #fef3c7; color: #92400e; }
        .badge.vencido { background: #dc2626; color: #fff; }
        .badge.nr { background: #111827; color: #f5c518; }
        .nr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 10px; margin-top: 14px; }
        .nr-chip { border: 1.5px solid #9ca3af; border-radius: 12px; padding: 11px 13px; background: #fff; text-align: left; font-weight: 700; color: #000; font-size: 14px; line-height: 1.4; cursor: pointer; transition: all 0.15s ease; }
        .nr-chip:hover { border-color: #111; }
        .nr-chip.on { background: #111; color: #fff; border-color: #111; }
        .nr-chip.on b { color: #f5c518; }
        .nr-chip.on small { color: #e5e7eb; }
        .nr-chip .cnt { float: right; background: #f5c518; color: #111; border-radius: 999px; padding: 2px 9px; font-size: 12px; font-weight: 900; }
        .invalid-campo { border: 2.5px solid #dc2626 !important; background: #fef2f2 !important; }
        .atrib { border: 2px solid #fde68a; border-left: 8px solid #f59e0b; border-radius: 16px; padding: 14px 16px; margin-bottom: 12px; background: #fffbeb; }
        .atrib.salvo { border-color: #bbf7d0; border-left-color: #16a34a; background: #f0fdf4; }
      `}</style>

      {/* Conteúdo Principal */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        {/* Topo com Botão Voltar e Breadcrumbs */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-3">
          <Link
            to="/seguranca"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 font-bold text-xs shadow-2xs transition"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar para Segurança
          </Link>
          <div className="text-xs text-gray-600 font-semibold">
            Segurança &nbsp;›&nbsp; <strong className="text-black">Controle de Treinamento</strong>
          </div>
        </div>

        {/* Título Principal */}
        <div className="mb-4">
          <h1 className="text-3xl sm:text-4xl font-black text-black tracking-tight flex items-center gap-3">
            <GraduationCap className="w-9 h-9 text-amber-500" />
            Controle de Treinamento
          </h1>
          <p className="text-sm sm:text-base text-gray-900 font-medium mt-2 leading-relaxed">
            Busque os <strong>colaboradores efetivados do RH</strong>, selecione uma <strong>NR</strong>, marque{' '}
            <strong>quais colaboradores têm esse treinamento</strong> e salve <strong>de cada colaborador</strong> a{' '}
            <strong>data de vencimento (expira)</strong> — a <strong>data de início é opcional</strong>. Tudo fica salvo
            no controle, com alerta de vencidos e a vencer, e relatório automático.
          </p>
        </div>

        {/* Alerta explicativo */}
        <div className="p-4 rounded-xl border border-amber-300 border-l-6 border-l-amber-500 bg-amber-50/70 mb-5 text-gray-900">
          <strong className="text-amber-950 block font-black text-sm">Como funciona, em 3 passos:</strong>
          <p className="text-xs sm:text-sm font-semibold mt-1 leading-relaxed text-black">
            <strong>1)</strong> Busque/carregue os colaboradores efetivados do RH (status ATIVO) e deixe a lista pronta.{' '}
            &nbsp;<strong>2)</strong> Clique em uma NR da lista completa de NRs. &nbsp;<strong>3)</strong> Marque os
            colaboradores que têm essa NR, preencha a data que expira (e, se quiser, a data que iniciou) e clique em{' '}
            <strong>Salvar</strong> em cada colaborador — ou em Salvar todos os marcados.
          </p>
        </div>

        {/* =========================================================================
            PASSO 1: COLABORADORES DO RH — EFETIVADOS
           ========================================================================= */}
        <section className="card" id="rhSection">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-black flex items-center">
              <span className="step">1</span>👥 Colaboradores do RH — Efetivados
            </h2>
            <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200">
              Total efetivados: <strong>{colaboradores.length}</strong>
            </span>
          </div>

          <p className="text-sm font-semibold text-gray-900 mt-1.5 leading-relaxed">
            Somente colaboradores com status <strong>ATIVO (efetivado)</strong> entram no controle de treinamento. Use a
            busca para encontrar por nome, cargo, matrícula ou setor.
          </p>

          <div className="flex gap-2.5 flex-wrap items-end mt-3">
            <div className="flex-1 min-w-[240px]">
              <label htmlFor="buscaRH">Buscar colaborador efetivado</label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3.5" />
                <input
                  id="buscaRH"
                  value={buscaRH}
                  onChange={(e) => setBuscaRH(e.target.value)}
                  className="pl-9"
                  placeholder="Buscar por nome, cargo, matrícula ou setor..."
                />
              </div>
            </div>

            <button
              className="btn btn-dark"
              id="btnBuscarRH"
              type="button"
              onClick={() => buscarColaboradoresRH(true)}
              disabled={loadingRH}
            >
              <RefreshCw className={`w-4 h-4 ${loadingRH ? 'animate-spin' : ''}`} />
              {loadingRH ? 'Buscando no RH...' : 'Buscar do RH (efetivados)'}
            </button>
          </div>

          {/* Feedback do Passo 1 */}
          {rhFeedback && (
            <div
              className={`mt-3 p-3.5 rounded-xl text-sm font-bold border leading-relaxed whitespace-pre-line ${
                rhFeedback.tipo === 'ok'
                  ? 'bg-emerald-50 text-emerald-950 border-emerald-500'
                  : 'bg-red-50 text-red-950 border-red-500'
              }`}
            >
              {rhFeedback.msg}
            </div>
          )}

          {/* Tabela de Colaboradores Efetivados */}
          <div className="overflow-x-auto mt-4 rounded-xl border border-gray-200 shadow-2xs">
            <table className="w-full border-collapse min-w-[680px]">
              <thead>
                <tr className="bg-gray-100/80 border-b-2 border-black text-left text-xs font-black text-black uppercase">
                  <th className="p-3">Colaborador</th>
                  <th className="p-3">Cargo / Função</th>
                  <th className="p-3">Matrícula</th>
                  <th className="p-3">Setor</th>
                  <th className="p-3">Status RH</th>
                  <th className="p-3">Treinamentos salvos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {!colaboradores.length ? (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-800 font-bold p-6">
                      Nenhum colaborador carregado ainda.
                      <br />
                      Clique em “Buscar do RH (efetivados)” — ou cadastre abaixo os colaboradores efetivados para testar.
                    </td>
                  </tr>
                ) : !colaboradoresFiltrados.length ? (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-800 font-bold p-6">
                      Nenhum colaborador efetivado encontrado para esta busca.
                    </td>
                  </tr>
                ) : (
                  colaboradoresFiltrados.map((c) => {
                    const salvos = treinosPorColaborador[c.id]?.length || 0
                    return (
                      <tr key={c.id} className="hover:bg-amber-50/40 transition">
                        <td className="p-3 font-black text-black">{c.nome}</td>
                        <td className="p-3 font-semibold text-gray-900">{c.cargo || '—'}</td>
                        <td className="p-3 font-semibold text-gray-900">{c.matricula || '—'}</td>
                        <td className="p-3 font-semibold text-gray-900">{c.setor || '—'}</td>
                        <td className="p-3">
                          <span className="badge ativo">✅ ATIVO — Efetivado</span>
                        </td>
                        <td className="p-3 font-bold text-black">
                          <strong className="text-amber-900">{salvos}</strong> treinamento(s)
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Cadastro de colaborador demo */}
          <div className="mt-6 pt-5 border-t border-gray-200">
            <h3 className="text-base font-black text-black">➕ Cadastrar colaborador efetivado (demonstração)</h3>
            <p className="text-xs sm:text-sm font-semibold text-gray-800 mt-0.5 leading-relaxed">
              No sistema real esta lista vem automaticamente do RH (tabela de efetivo, status ATIVO). Aqui você pode
              cadastrar para testar o fluxo completo.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 items-end mt-2">
              <div>
                <label htmlFor="novoNome">Nome completo *</label>
                <input
                  id="novoNome"
                  value={novoNome}
                  onChange={(e) => {
                    setNovoNome(e.target.value)
                    setInvalidNovoNome(false)
                  }}
                  className={invalidNovoNome ? 'invalid-campo' : ''}
                  placeholder="Nome do colaborador"
                />
              </div>

              <div>
                <label htmlFor="novoCargo">Cargo / Função</label>
                <input
                  id="novoCargo"
                  value={novoCargo}
                  onChange={(e) => setNovoCargo(e.target.value)}
                  placeholder="Ex.: Pedreiro, Eletricista..."
                />
              </div>

              <div>
                <label htmlFor="novaMatricula">Matrícula</label>
                <input
                  id="novaMatricula"
                  value={novaMatricula}
                  onChange={(e) => setNovaMatricula(e.target.value)}
                  placeholder="Ex.: 1024"
                />
              </div>

              <div>
                <label htmlFor="novoSetor">Setor</label>
                <input
                  id="novoSetor"
                  value={novoSetor}
                  onChange={(e) => setNovoSetor(e.target.value)}
                  placeholder="Ex.: Obra / Campo"
                />
              </div>

              <button className="btn btn-yellow w-full" id="btnAddColab" type="button" onClick={handleCadastrarColaborador}>
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </div>

            {addFeedback && (
              <div
                className={`mt-3 p-3.5 rounded-xl text-sm font-bold border whitespace-pre-line ${
                  addFeedback.tipo === 'ok'
                    ? 'bg-emerald-50 text-emerald-950 border-emerald-500'
                    : 'bg-red-50 text-red-950 border-red-500'
                }`}
              >
                {addFeedback.msg}
              </div>
            )}
          </div>
        </section>

        {/* =========================================================================
            PASSO 2: SELECIONE A NR DO TREINAMENTO
           ========================================================================= */}
        <section className="card" id="nrSection">
          <h2 className="text-xl sm:text-2xl font-black text-black flex items-center">
            <span className="step">2</span>📚 Selecione a NR do treinamento
          </h2>
          <p className="text-sm font-semibold text-gray-900 mt-1.5 leading-relaxed">
            Lista com <strong>todas as NRs (NR-01 a NR-38 + OUTRO)</strong>. Clique em uma NR para abrir, logo abaixo, a
            escolha dos colaboradores que têm esse treinamento. O número no canto de cada NR é quantos colaboradores já
            têm ela salva.
          </p>

          <div className="mt-3">
            <label htmlFor="nrSelect">NR selecionada</label>
            <select id="nrSelect" value={nrSel} onChange={(e) => selecionarNR(e.target.value)}>
              <option value="">— Selecione a NR —</option>
              {NRS.map((n) => (
                <option key={n.cod} value={n.cod}>
                  {n.cod} — {n.titulo}
                </option>
              ))}
            </select>
          </div>

          <div className="nr-grid" id="nrGrid">
            {NRS.map((n) => {
              const cnt = contagemPorNR[n.cod] || 0
              const isSelected = nrSel === n.cod
              return (
                <button
                  key={n.cod}
                  type="button"
                  className={`nr-chip ${isSelected ? 'on' : ''}`}
                  onClick={() => selecionarNR(n.cod)}
                >
                  {cnt > 0 && <span className="cnt">{cnt}</span>}
                  <b className="block font-black text-base">{n.cod}</b>
                  <small className="block font-semibold text-xs mt-0.5 line-clamp-2">{n.titulo}</small>
                </button>
              )
            })}
          </div>
        </section>

        {/* =========================================================================
            PASSO 3: QUEM TEM ESTE TREINAMENTO — SALVAR DE CADA COLABORADOR
           ========================================================================= */}
        <section className="card" id="atribSection" ref={atribSectionRef}>
          <h2 className="text-xl sm:text-2xl font-black text-black flex items-center">
            <span className="step">3</span>✅ Quem tem este treinamento — salvar de cada colaborador
          </h2>

          <p className="text-sm font-semibold text-gray-900 mt-1.5 leading-relaxed" id="atribHint">
            {!nrSel ? (
              'Selecione uma NR no passo 2 para ver aqui os colaboradores efetivados.'
            ) : (
              <span>
                NR selecionada: <strong className="text-black">{nrSel} — {nrTitulo(nrSel)}</strong>. Marque os
                colaboradores que <strong>têm</strong> este treinamento, preencha a{' '}
                <strong>data que expira * (obrigatória)</strong> e a <strong>data que iniciou (opcional)</strong>, e
                clique em <strong>Salvar</strong> em cada um.
              </span>
            )}
          </p>

          <div id="atribList" className="mt-4 space-y-3">
            {!nrSel ? (
              <div className="p-8 text-center text-gray-600 font-bold border border-dashed border-gray-300 rounded-2xl bg-gray-50/50">
                Nenhuma NR selecionada ainda. Selecione uma NR no passo 2 acima.
              </div>
            ) : !colaboradores.length ? (
              <div className="p-8 text-center text-gray-600 font-bold border border-dashed border-gray-300 rounded-2xl bg-gray-50/50">
                Nenhum colaborador efetivado carregado.
                <br />
                Volte ao passo 1 e clique em "Buscar do RH (efetivados)".
              </div>
            ) : (
              colaboradores.map((c) => {
                const ex = treinamentos.find((t) => t.colabId === c.id && t.nr === nrSel)
                const st = ex ? statusTreino(ex) : null
                const isCheck = !!marcados[c.id]
                const fb = cardFeedbacks[c.id]
                const isInvExp = !!invalidosExpira[c.id]

                return (
                  <div key={c.id} className={`atrib ${ex ? 'salvo' : ''}`} data-cid={c.id}>
                    <label className="flex items-start gap-3 m-0 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-5 h-5 accent-black cursor-pointer mt-0.5 shrink-0"
                        checked={isCheck}
                        onChange={(e) => {
                          setMarcados((prev) => ({ ...prev, [c.id]: e.target.checked }))
                        }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-black text-black inline">{c.nome}</h3>
                          {ex ? (
                            <span
                              className={`badge ${
                                st?.k === 'vencido' ? 'vencido' : st?.k === 'vencendo' ? 'vence' : 'valido'
                              }`}
                            >
                              {st?.label} — já salvo
                            </span>
                          ) : (
                            <span className="badge nr">Ainda não salvo nesta NR</span>
                          )}
                        </div>

                        <div className="text-xs sm:text-sm font-semibold text-gray-800 mt-1 leading-snug">
                          {c.cargo || 'Cargo não informado'}
                          {c.matricula ? ` • Matrícula ${c.matricula}` : ''}
                          {c.setor ? ` • Setor: ${c.setor}` : ''} •{' '}
                          <strong className="text-black">RH: ATIVO (efetivado)</strong>
                        </div>
                      </div>
                    </label>

                    {/* Linha com inputs de data e salvar */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end mt-3 pt-2 border-t border-black/10">
                      <div>
                        <label className="text-xs font-black text-black">Data que iniciou (opcional)</label>
                        <input
                          type="date"
                          value={datasInicio[c.id] || ''}
                          onChange={(e) => {
                            setDatasInicio((prev) => ({ ...prev, [c.id]: e.target.value }))
                          }}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-black text-black">Data que expira / vencimento *</label>
                        <input
                          type="date"
                          value={datasExpira[c.id] || ''}
                          className={isInvExp ? 'invalid-campo' : ''}
                          onChange={(e) => {
                            setDatasExpira((prev) => ({ ...prev, [c.id]: e.target.value }))
                            setInvalidosExpira((prev) => ({ ...prev, [c.id]: false }))
                          }}
                        />
                      </div>

                      <button
                        className="btn btn-green w-full"
                        type="button"
                        onClick={() => salvarUm(c.id, false)}
                      >
                        💾 Salvar
                      </button>
                    </div>

                    {/* Linha informativa se já salvo */}
                    {ex && (
                      <p className="text-xs sm:text-sm font-bold text-gray-900 mt-2">
                        Salvo:{' '}
                        {ex.inicio ? `iniciou em ${fmtDate(ex.inicio)} • ` : 'sem data de início • '}
                        expira em <strong>{fmtDate(ex.expira)}</strong> — {st?.txt}
                      </p>
                    )}

                    {/* Feedback individual do card */}
                    {fb && (
                      <div
                        className={`mt-2 p-2.5 rounded-lg text-xs font-bold border whitespace-pre-line ${
                          fb.tipo === 'ok'
                            ? 'bg-emerald-50 text-emerald-950 border-emerald-500'
                            : 'bg-red-50 text-red-950 border-red-500'
                        }`}
                      >
                        {fb.msg}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Botão Salvar Todos */}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <button
              className="btn btn-dark"
              id="btnSalvarTodos"
              type="button"
              onClick={handleSalvarTodosMarcados}
            >
              💾 Salvar todos os marcados
            </button>
          </div>

          {/* Feedback geral do Passo 3 */}
          {atribFeedback && (
            <div
              className={`mt-3 p-3.5 rounded-xl text-sm font-bold border whitespace-pre-line ${
                atribFeedback.tipo === 'ok'
                  ? 'bg-emerald-50 text-emerald-950 border-emerald-500'
                  : 'bg-red-50 text-red-950 border-red-500'
              }`}
            >
              {atribFeedback.msg}
            </div>
          )}
        </section>

        {/* =========================================================================
            CONTROLE SALVO — TREINAMENTOS POR COLABORADOR
           ========================================================================= */}
        <section className="card" id="controleSection">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-black flex items-center gap-2">
              🗂️ Controle salvo — treinamentos por colaborador
            </h2>
            <span className="text-xs font-bold text-gray-700 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
              {totalSalvos} registro(s) salvo(s)
            </span>
          </div>

          <p className="text-sm font-semibold text-gray-900 mt-1 leading-relaxed">
            {totalSalvos > 0
              ? `${totalSalvos} treinamento(s) salvo(s) • ${validosCount} válido(s) • ${vencendoCount} a vencer em 30 dias • ${vencidosCount} vencido(s)`
              : 'Nenhum treinamento salvo ainda.'}
          </p>

          {/* Filtros rápidos */}
          <div className="flex gap-2 flex-wrap my-3">
            <button
              type="button"
              onClick={() => setFiltroAtual('todos')}
              className={`px-3 py-1.5 rounded-full text-xs font-black border transition ${
                filtroAtual === 'todos'
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-black border-gray-800 hover:bg-gray-100'
              }`}
            >
              Todos ({totalSalvos})
            </button>

            <button
              type="button"
              onClick={() => setFiltroAtual('validos')}
              className={`px-3 py-1.5 rounded-full text-xs font-black border transition ${
                filtroAtual === 'validos'
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white text-emerald-900 border-emerald-600 hover:bg-emerald-50'
              }`}
            >
              Válidos ({validosCount})
            </button>

            <button
              type="button"
              onClick={() => setFiltroAtual('vencendo')}
              className={`px-3 py-1.5 rounded-full text-xs font-black border transition ${
                filtroAtual === 'vencendo'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-amber-900 border-amber-500 hover:bg-amber-50'
              }`}
            >
              A vencer (30 dias) ({vencendoCount})
            </button>

            <button
              type="button"
              onClick={() => setFiltroAtual('vencidos')}
              className={`px-3 py-1.5 rounded-full text-xs font-black border transition ${
                filtroAtual === 'vencidos'
                  ? 'bg-red-700 text-white border-red-700'
                  : 'bg-white text-red-900 border-red-600 hover:bg-red-50'
              }`}
            >
              Vencidos ({vencidosCount})
            </button>
          </div>

          {/* Lista de Treinamentos Agrupados por Colaborador */}
          <div className="space-y-4 mt-3">
            {!totalSalvos ? (
              <div className="p-8 text-center text-gray-600 font-bold border border-dashed border-gray-300 rounded-2xl bg-gray-50/50">
                Nenhum treinamento salvo ainda.
                <br />
                Faça os passos 1, 2 e 3 acima para registrar treinamentos.
              </div>
            ) : !Object.keys(controlePorColaborador).length ? (
              <div className="p-8 text-center text-gray-600 font-bold border border-dashed border-gray-300 rounded-2xl bg-gray-50/50">
                Nenhum treinamento encontrado para o filtro selecionado ({filtroAtual}).
              </div>
            ) : (
              Object.keys(controlePorColaborador).map((cid) => {
                const lista = controlePorColaborador[cid]
                const c0 = lista[0]

                return (
                  <div
                    key={cid}
                    className="p-4 rounded-2xl border border-gray-300 bg-white shadow-xs"
                    style={{ borderLeft: '6px solid #111' }}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                      <h3 className="text-base font-black text-black flex items-center gap-2">
                        👤 {c0.nome}
                      </h3>
                      <span className="text-xs font-black bg-gray-100 text-black px-2.5 py-0.5 rounded-full border border-gray-200">
                        {lista.length} treinamento(s)
                      </span>
                    </div>

                    <div className="text-xs sm:text-sm font-semibold text-gray-800 mb-3">
                      {c0.cargo || 'Cargo não informado'}
                      {c0.matricula ? ` • Matrícula ${c0.matricula}` : ''}
                      {c0.setor ? ` • ${c0.setor}` : ''} •{' '}
                      <strong className="text-black">RH: ATIVO (efetivado)</strong>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="w-full border-collapse min-w-[560px]">
                        <thead>
                          <tr className="bg-gray-100 border-b-2 border-black text-left text-xs font-black text-black uppercase">
                            <th className="p-2.5">Treinamento (NR)</th>
                            <th className="p-2.5">Iniciou</th>
                            <th className="p-2.5">Expira</th>
                            <th className="p-2.5">Situação</th>
                            <th className="p-2.5 text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-xs sm:text-sm">
                          {lista.map((t) => {
                            const st = statusTreino(t)
                            return (
                              <tr key={t.uid} className="hover:bg-gray-50 transition">
                                <td className="p-2.5 font-bold text-black">
                                  <strong className="text-amber-950 font-black">{t.nr}</strong> — {t.nrTitulo}
                                </td>
                                <td className="p-2.5 text-gray-800 font-medium">
                                  {t.inicio ? fmtDate(t.inicio) : '— (não informada)'}
                                </td>
                                <td className="p-2.5 font-black text-black">{fmtDate(t.expira)}</td>
                                <td className="p-2.5">
                                  <span
                                    className={`badge ${
                                      st.k === 'vencido' ? 'vencido' : st.k === 'vencendo' ? 'vence' : 'valido'
                                    }`}
                                  >
                                    {st.label}
                                  </span>
                                  <span className="block text-[11px] font-bold text-gray-700 mt-0.5">{st.txt}</span>
                                </td>
                                <td className="p-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleExcluirTreino(t.uid)}
                                    className="btn btn-red btn-sm inline-flex items-center gap-1"
                                    title="Excluir este treinamento"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* =========================================================================
            RELATÓRIO AUTOMÁTICO DE TREINAMENTOS
           ========================================================================= */}
        <section
          className="card"
          id="relatorioSection"
          style={{ border: '2px solid #111827', borderRadius: '22px' }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-black flex items-center gap-2">
              📋 Relatório Automático de Treinamentos
            </h2>
            <span className="text-xs font-extrabold text-gray-700 bg-gray-100 px-3 py-1 rounded-full border border-gray-300">
              Hydro Reabilitação
            </span>
          </div>

          <p className="text-sm font-semibold text-gray-900 mt-1 leading-relaxed">
            Atualizado automaticamente a cada treinamento salvo, editado ou excluído — sem preencher de novo.
          </p>

          {/* Grade de Estatísticas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-center">
              <b className="block text-2xl font-black text-black">{totalSalvos}</b>
              <span className="text-[11px] font-black text-gray-800 uppercase tracking-wide">
                Treinamentos salvos
              </span>
            </div>

            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
              <b className="block text-2xl font-black text-emerald-700">{validosCount}</b>
              <span className="text-[11px] font-black text-emerald-900 uppercase tracking-wide">Válidos</span>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-center">
              <b className="block text-2xl font-black text-amber-700">{vencendoCount}</b>
              <span className="text-[11px] font-black text-amber-900 uppercase tracking-wide">
                A vencer (30 dias)
              </span>
            </div>

            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-center">
              <b className="block text-2xl font-black text-red-700">{vencidosCount}</b>
              <span className="text-[11px] font-black text-red-900 uppercase tracking-wide">Vencidos</span>
            </div>
          </div>

          {/* Barra de Progresso */}
          <div className="h-4 bg-gray-200 rounded-full overflow-hidden my-3">
            <div
              className="h-full bg-emerald-600 transition-all duration-500"
              style={{ width: `${percentualValidos}%` }}
            />
          </div>
          <p className="text-sm font-black text-black">
            {percentualValidos}% válidos — {validosCount} de {totalSalvos} treinamento(s)
          </p>

          {/* Conteúdo resumido do relatório */}
          <div className="mt-4 p-4 rounded-xl border border-gray-200 bg-gray-50/70">
            {!totalSalvos ? (
              <div className="text-center text-gray-600 font-bold py-4">
                O relatório aparece aqui automaticamente assim que houver treinamentos salvos.
              </div>
            ) : (
              <div>
                <p className="text-xs sm:text-sm font-semibold text-black leading-relaxed pb-3 border-b border-gray-200">
                  Resumo automático: <strong>{totalSalvos} treinamento(s)</strong> de{' '}
                  <strong>{colaboradores.length} colaborador(es) efetivado(s)</strong> —{' '}
                  <strong className="text-emerald-700">{validosCount} válido(s)</strong>,{' '}
                  <strong className="text-amber-700">{vencendoCount} a vencer em 30 dias</strong> e{' '}
                  <strong className="text-red-700">{vencidosCount} vencido(s)</strong>.
                  <br />
                  <span className="block mt-1 font-bold text-gray-800">
                    Por NR:{' '}
                    {Object.keys(contagemPorNR)
                      .sort()
                      .map((k) => `${k}: ${contagemPorNR[k]}`)
                      .join(' • ')}
                  </span>
                </p>

                <div className="divide-y divide-gray-200 mt-2 max-h-96 overflow-y-auto pr-1">
                  {[...treinamentos]
                    .sort((a, b) => a.nome.localeCompare(b.nome))
                    .map((t, i) => {
                      const st = statusTreino(t)
                      return (
                        <div key={t.uid} className="py-2.5 text-xs sm:text-sm leading-relaxed">
                          <strong className="text-black font-black">
                            {i + 1}. {t.nome}
                          </strong>{' '}
                          — <span className="badge nr">{t.nr}</span> {t.nrTitulo}
                          <div className="text-gray-800 font-medium mt-0.5">
                            Situação: <strong className="text-black">{st.label}</strong> — {st.txt}
                            <br />
                            Iniciou: {t.inicio ? fmtDate(t.inicio) : 'não informada'} • Expira:{' '}
                            <strong className="text-black">{fmtDate(t.expira)}</strong>
                            {t.cargo ? ` • Cargo: ${t.cargo}` : ''}
                            {t.matricula ? ` • Matrícula: ${t.matricula}` : ''}
                            <span className="text-gray-500 block text-[11px]">Salvo em: {t.salvoEm}</span>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Botões de Ação do Relatório */}
          <div className="flex gap-2.5 flex-wrap mt-4">
            <button className="btn btn-dark" type="button" onClick={imprimirRelatorio}>
              <Printer className="w-4 h-4" /> Imprimir / Salvar relatório em PDF
            </button>
            <button className="btn btn-yellow" type="button" onClick={copiarRelatorio}>
              <Copy className="w-4 h-4" /> Copiar relatório (texto)
            </button>
          </div>
        </section>

        {/* Rodapé da Página */}
        <footer className="mt-8 text-center text-xs font-semibold text-gray-600">
          Hydro Reabilitação — Segurança • Controle de Treinamento • Integrado ao efetivo real do RH e sincronizado no banco de dados.
        </footer>
      </main>
    </div>
  )
}

