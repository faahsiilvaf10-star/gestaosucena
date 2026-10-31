import React, { useState, useEffect, useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { supabase } from '../../lib/supabase'
import {
  CARGOS_MATRIZ,
  FORMS_URL_MATRIZ,
  type CargoMatrizDef,
  type AtividadeMatriz,
  type ColaboradorMatrizRH,
  type MatrizDbRecord,
  getMesKey,
  getMesLabel,
  getMetricasCargo,
  getMetricasGerais,
  carregarDadosMatriz,
  salvarDadosMatriz,
  ehPersonalizada,
} from '../../lib/matrizResponsabilidadesData'
import { verificarEEnviarLembreteMatrizMes } from '../../lib/matrizWhatsapp'
import { isAdmin } from '../../components/ui/VerifiedBadge'
import {
  ArrowLeft,
  ExternalLink,
  Printer,
  Copy,
  Plus,
  Trash2,
  Check,
  Search,
  ShieldCheck,
  Edit3,
  CopyPlus,
  UserPlus,
  X,
  Palette,
  Layers,
  Sparkles,
} from 'lucide-react'

export const Route = createFileRoute('/seguranca/matriz-responsabilidade')({
  component: MatrizResponsabilidadeComponent,
})

const EMOJI_SUGESTOES = [
  '🏛️', '⚛️', '⛑️', '🪖', '🛡️', '🏗️', '📋', '🚜', '⚡', '👷', '🔧', '🎯',
  '📑', '⭐', '⚙️', '🚀', '📦', '💡', '🏭', '🏷️', '🛠️', '🚛', '🌲', '🦺'
]

const CORES_SUGESTOES = [
  '#3b82f6', '#a855f7', '#f97316', '#22c55e', '#f43f5e', '#ec4899',
  '#eab308', '#06b6d4', '#6366f1', '#14b8a6', '#64748b'
]

function normalizarCargoParaMatriz(cargoColab: string): string | null {
  const c = (cargoColab || '').toLowerCase().trim()
  if (c.includes('preposto')) return 'Preposto'
  if (c.includes('encarregado geral')) return 'Encarregado Geral'
  if (c.includes('encarregado i') || c.includes('encarregado 1') || c === 'encarregado') return 'Encarregado I'
  if (c.includes('encarregado ii') || c.includes('encarregado 2')) return 'Encarregado II'
  if (c.includes('tec') && c.includes('seg') && (c.includes('ii') || c.includes('2'))) return 'Téc. Segurança II'
  if (c.includes('tec') && c.includes('seg')) return 'Téc. Segurança I'
  return null
}

export function MatrizResponsabilidadeComponent() {
  const [mesAtualKey] = useState<string>(() => getMesKey())
  const [atividadesPorCargo, setAtividadesPorCargo] = useState<Record<string, AtividadeMatriz[]>>({})
  const [cargos, setCargos] = useState<CargoMatrizDef[]>(CARGOS_MATRIZ)
  const [tituloMatriz, setTituloMatriz] = useState<string>('Matriz de Responsabilidades')
  const [iconeMatriz, setIconeMatriz] = useState<string>('📋')
  const [atribuicoesManual, setAtribuicoesManual] = useState<Record<string, string>>({})
  const [atribuicoesAtividades, setAtribuicoesAtividades] = useState<Record<string, string[]>>({})

  const [colaboradoresRH, setColaboradoresRH] = useState<ColaboradorMatrizRH[]>([])
  const [customColaboradores, setCustomColaboradores] = useState<ColaboradorMatrizRH[]>([])
  const [selectedCargoId, setSelectedCargoId] = useState<string | null>(null)
  const [salvoFlash, setSalvoFlash] = useState<string>('')
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // Status de Admin
  const [isUserAdmin, setIsUserAdmin] = useState<boolean>(false)

  // RH section filters
  const [buscaRH, setBuscaRH] = useState<string>('')
  const [filtroCargo, setFiltroCargo] = useState<string>('')
  const [rhFeedback, setRhFeedback] = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null)

  // Adicionar colaborador form
  const [novoNome, setNovoNome] = useState<string>('')
  const [novoCargo, setNovoCargo] = useState<string>('')
  const [addFeedback, setAddFeedback] = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null)

  // Modais de Administração
  const [modalEditar, setModalEditar] = useState<{
    isOpen: boolean
    cargoId?: string
    nome: string
    icone: string
    cor: string
    isGeneralTitle?: boolean
  }>({ isOpen: false, nome: '', icone: '📋', cor: '#3b82f6' })

  const [modalDuplicar, setModalDuplicar] = useState<{
    isOpen: boolean
    cargoBaseId?: string
    nome: string
    icone: string
    cor: string
  }>({ isOpen: false, nome: '', icone: '📋', cor: '#3b82f6' })

  const [modalAtribuirColab, setModalAtribuirColab] = useState<{
    isOpen: boolean
    colab: ColaboradorMatrizRH | null
    cargoId: string
    atividades: string[]
  }>({ isOpen: false, colab: null, cargoId: '', atividades: [] })

  const env = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'

  // Exibir toast temporário
  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev))
    }, 2800)
  }

  // Verifica permissão de Admin
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const isMock = typeof window !== 'undefined' && window.location.search.includes('mock=true')
      const name = data?.user?.user_metadata?.full_name || (isMock ? 'Fabrício Silva' : '')
      const role = data?.user?.user_metadata?.role || (isMock ? 'Admin' : '')
      setIsUserAdmin(isMock || isAdmin(name, role))
    })
  }, [])

  // 1. Carregar dados da Matriz e Colaboradores do RH
  useEffect(() => {
    let mounted = true

    async function carregarTudo() {
      // Carregar matriz
      const matrizDb = await carregarDadosMatriz(mesAtualKey, env)
      if (mounted) {
        setAtividadesPorCargo(matrizDb.atividadesPorCargo || {})
        if (matrizDb.cargos && matrizDb.cargos.length > 0) {
          setCargos(matrizDb.cargos)
        }
        if (matrizDb.customColaboradores) {
          setCustomColaboradores(matrizDb.customColaboradores)
        }
        if (matrizDb.atribuicoesManual) {
          setAtribuicoesManual(matrizDb.atribuicoesManual)
        }
        if (matrizDb.atribuicoesAtividades) {
          setAtribuicoesAtividades(matrizDb.atribuicoesAtividades)
        }
        if (matrizDb.tituloMatriz) {
          setTituloMatriz(matrizDb.tituloMatriz)
        }
        if (matrizDb.iconeMatriz) {
          setIconeMatriz(matrizDb.iconeMatriz)
        }
      }

      // Carregar colaboradores do RH (Carrega TODOS do efetivo para o Admin poder atribuir)
      try {
        const { data: rhData } = await supabase
          .from('rh_efetivo')
          .select('id, nome, cargo, status')
          .order('nome', { ascending: true })

        if (mounted && rhData) {
          const list: ColaboradorMatrizRH[] = []
          for (const item of rhData) {
            const statusUpper = (item.status || '').toUpperCase().trim()
            if (statusUpper === 'INATIVO' || statusUpper === 'DEMITIDO' || statusUpper === 'DESLIGADO') continue
            if (!item.nome) continue

            list.push({
              id: item.id || `rh_${item.nome}`,
              nome: item.nome.trim(),
              cargo: item.cargo ? item.cargo.trim() : 'Geral',
              status: 'ATIVO — Efetivado',
            })
          }
          setColaboradoresRH(list)
        }
      } catch (err) {
        console.warn('[Matriz] Erro ao carregar RH:', err)
      }

      // Verificar lembrete do WhatsApp em segundo plano
      verificarEEnviarLembreteMatrizMes(false).catch(() => { })
    }

    carregarTudo()

    return () => {
      mounted = false
    }
  }, [mesAtualKey, env])

  // Colaboradores combinados (RH real + Cadastrados manualmente)
  const todosColaboradores = useMemo(() => {
    const combinados = [...colaboradoresRH]
    const ids = new Set(colaboradoresRH.map((c) => c.id))
    for (const custom of customColaboradores) {
      if (!ids.has(custom.id)) {
        combinados.push(custom)
      }
    }
    return combinados
  }, [colaboradoresRH, customColaboradores])

  // Identifica o cargo de matriz atribuído a um colaborador
  const getCargoMatrizDoColaborador = (colab: ColaboradorMatrizRH): CargoMatrizDef | null => {
    // 1. Atribuição manual explícita (por id ou nome)
    const manualId = atribuicoesManual[colab.id] || atribuicoesManual[colab.nome]
    if (manualId) {
      const found = cargos.find((c) => c.id === manualId)
      if (found) return found
    }

    // 2. Correspondência direta de nome do cargo
    const direto = cargos.find((c) => c.nome.toLowerCase() === colab.cargo.toLowerCase())
    if (direto) return direto

    // 3. Normalização clássica
    const norm = normalizarCargoParaMatriz(colab.cargo)
    if (norm) {
      const found = cargos.find((c) => c.nome.toLowerCase() === norm.toLowerCase())
      if (found) return found
    }

    return null
  }

  // Nomes de colaboradores por cargo
  const nomesPorCargo = useMemo(() => {
    const mapa: Record<string, string[]> = {}
    for (const c of cargos) {
      mapa[c.nome] = []
    }

    for (const colab of todosColaboradores) {
      const cargoMatriz = getCargoMatrizDoColaborador(colab)
      if (cargoMatriz && mapa[cargoMatriz.nome]) {
        if (!mapa[cargoMatriz.nome].includes(colab.nome)) {
          mapa[cargoMatriz.nome].push(colab.nome)
        }
      }
    }

    return mapa
  }, [todosColaboradores, cargos, atribuicoesManual])

  // Lista de cargos únicos para filtros
  const listaCargosFiltro = useMemo(() => {
    const nomes = new Set<string>()
    for (const c of cargos) nomes.add(c.nome)
    for (const colab of todosColaboradores) {
      if (colab.cargo) nomes.add(colab.cargo)
    }
    return Array.from(nomes).sort()
  }, [cargos, todosColaboradores])

  // Filtro de colaboradores visíveis na tabela RH
  const colaboradoresVisiveis = useMemo(() => {
    const q = buscaRH.trim().toLowerCase()
    return todosColaboradores.filter((c) => {
      const cargoMatriz = getCargoMatrizDoColaborador(c)
      const matchCargo =
        !filtroCargo ||
        c.cargo === filtroCargo ||
        (cargoMatriz && cargoMatriz.nome === filtroCargo)
      const matchNome = !q || c.nome.toLowerCase().includes(q)
      return matchCargo && matchNome
    })
  }, [todosColaboradores, buscaRH, filtroCargo, cargos, atribuicoesManual])

  // Salvar estado atual no banco e localmente
  const persistirMatriz = async (
    novoAtiv: Record<string, AtividadeMatriz[]>,
    novoCustomColabs?: ColaboradorMatrizRH[],
    novosCargos?: CargoMatrizDef[],
    novasAtribuicoesManual?: Record<string, string>,
    novasAtribuicoesAtiv?: Record<string, string[]>,
    novoTitulo?: string,
    novoIcone?: string,
    msgToast?: string | null
  ) => {
    const ativFinal = novoAtiv || atividadesPorCargo
    const colabsFinal = novoCustomColabs || customColaboradores
    const cargosFinal = novosCargos || cargos
    const manualFinal = novasAtribuicoesManual || atribuicoesManual
    const ativsAtribuicoesFinal = novasAtribuicoesAtiv || atribuicoesAtividades
    const tituloFinal = novoTitulo || tituloMatriz
    const iconeFinal = novoIcone || iconeMatriz

    setAtividadesPorCargo(ativFinal)
    if (novoCustomColabs) setCustomColaboradores(colabsFinal)
    if (novosCargos) setCargos(cargosFinal)
    if (novasAtribuicoesManual) setAtribuicoesManual(manualFinal)
    if (novasAtribuicoesAtiv) setAtribuicoesAtividades(ativsAtribuicoesFinal)
    if (novoTitulo) setTituloMatriz(tituloFinal)
    if (novoIcone) setIconeMatriz(iconeFinal)

    const payload: MatrizDbRecord = {
      cargos: cargosFinal,
      atividadesPorCargo: ativFinal,
      customColaboradores: colabsFinal,
      atribuicoesManual: manualFinal,
      atribuicoesAtividades: ativsAtribuicoesFinal,
      tituloMatriz: tituloFinal,
      iconeMatriz: iconeFinal,
    }

    await salvarDadosMatriz(payload, mesAtualKey, env)
    setSalvoFlash(`✓ Salvo automaticamente — ${new Date().toLocaleTimeString('pt-BR')}`)

    if (msgToast) {
      showToast(msgToast)
    }
  }

  // Marcar bolinha (0 a 3)
  const handleMarcarBolinha = (cargoId: string, ativIndex: number, dotIndex: number) => {
    const lista = [...(atividadesPorCargo[cargoId] || [])]
    const ativ = { ...lista[ativIndex] }
    if (!ativ) return

    const alvo = dotIndex + 1
    ativ.marks = ativ.marks === alvo ? dotIndex : alvo
    ativ.marks = Math.max(0, Math.min(3, ativ.marks))
    lista[ativIndex] = ativ

    const novoMap = {
      ...atividadesPorCargo,
      [cargoId]: lista,
    }

    const concluida = ativ.marks >= 3
    const toastAlerta = concluida ? `✅ Atividade concluída (3/3): ${ativ.nome}` : null
    persistirMatriz(novoMap, undefined, undefined, undefined, undefined, undefined, undefined, toastAlerta)
  }

  // Adicionar nova atividade personalizada ao cargo
  const handleAdicionarAtividade = (cargoId: string) => {
    const nome = window.prompt('Nome da nova atividade:')
    if (nome === null) return
    const trimmed = nome.trim()
    if (!trimmed) {
      showToast('⚠️ Escreva o nome da atividade para adicionar')
      return
    }

    const lista = [...(atividadesPorCargo[cargoId] || [])]
    lista.push({
      nome: trimmed,
      marks: 0,
      pers: true,
    })

    const novoMap = {
      ...atividadesPorCargo,
      [cargoId]: lista,
    }

    persistirMatriz(novoMap, undefined, undefined, undefined, undefined, undefined, undefined, `➕ Atividade adicionada: ${trimmed} (0/3)`)
  }

  // Excluir atividade
  const handleRemoverAtividade = (cargoId: string, ativIndex: number) => {
    const lista = [...(atividadesPorCargo[cargoId] || [])]
    const ativ = lista[ativIndex]
    if (!ativ) return

    if (!window.confirm(`Deseja realmente remover a atividade "${ativ.nome}"?`)) {
      return
    }

    lista.splice(ativIndex, 1)
    const novoMap = {
      ...atividadesPorCargo,
      [cargoId]: lista,
    }

    persistirMatriz(novoMap, undefined, undefined, undefined, undefined, undefined, undefined, `🗑 Atividade excluída: ${ativ.nome}`)
  }

  // ------------------------------------------------------------------------
  // FUNÇÕES DE ADMINISTRAÇÃO: DUPLICAR E EDITAR MATRIZ / CARGOS
  // ------------------------------------------------------------------------
  const handleAbrirEditar = (c?: CargoMatrizDef, isGeneralTitle = false) => {
    if (isGeneralTitle) {
      setModalEditar({
        isOpen: true,
        nome: tituloMatriz,
        icone: iconeMatriz,
        cor: '#3b82f6',
        isGeneralTitle: true,
      })
    } else if (c) {
      setModalEditar({
        isOpen: true,
        cargoId: c.id,
        nome: c.nome,
        icone: c.icone,
        cor: c.cor,
        isGeneralTitle: false,
      })
    }
  }

  const handleSalvarEdicao = () => {
    if (modalEditar.isGeneralTitle) {
      const novoTit = modalEditar.nome.trim() || 'Matriz de Responsabilidades'
      const novoIco = modalEditar.icone.trim() || '📋'
      persistirMatriz(atividadesPorCargo, undefined, undefined, undefined, undefined, novoTit, novoIco, '✅ Título e ícone da Matriz atualizados!')
      setModalEditar({ isOpen: false, nome: '', icone: '📋', cor: '' })
      return
    }

    if (!modalEditar.cargoId) return
    const novoNomeTrim = modalEditar.nome.trim()
    if (!novoNomeTrim) {
      showToast('⚠️ O título não pode ficar vazio.')
      return
    }

    const novosCargos = cargos.map((c) => {
      if (c.id === modalEditar.cargoId) {
        return {
          ...c,
          nome: novoNomeTrim,
          icone: modalEditar.icone || c.icone,
          cor: modalEditar.cor || c.cor,
        }
      }
      return c
    })

    persistirMatriz(atividadesPorCargo, undefined, novosCargos, undefined, undefined, undefined, undefined, `✅ Matriz/Cargo "${novoNomeTrim}" atualizado com sucesso!`)
    setModalEditar({ isOpen: false, nome: '', icone: '📋', cor: '' })
  }

  const handleAbrirDuplicar = (cargoBase?: CargoMatrizDef) => {
    const base = cargoBase || cargos[0]
    setModalDuplicar({
      isOpen: true,
      cargoBaseId: base ? base.id : '',
      nome: base ? `${base.nome} (Cópia)` : 'Nova Matriz',
      icone: base ? base.icone : '📋',
      cor: base ? base.cor : '#3b82f6',
    })
  }

  const handleConfirmarDuplicacao = () => {
    const nomeTrim = modalDuplicar.nome.trim()
    if (!nomeTrim) {
      showToast('⚠️ Defina um título para a nova matriz.')
      return
    }

    const baseCargo = cargos.find((c) => c.id === modalDuplicar.cargoBaseId)
    const baseAtividades = baseCargo && atividadesPorCargo[baseCargo.id]
      ? atividadesPorCargo[baseCargo.id].map((a) => a.nome)
      : baseCargo ? baseCargo.atividades : ['Atividade Inicial 1', 'Atividade Inicial 2']

    const novoId = `matriz_custom_${Date.now()}`
    const novoCargoObj: CargoMatrizDef = {
      id: novoId,
      nome: nomeTrim,
      icone: modalDuplicar.icone || '📋',
      cor: modalDuplicar.cor || '#3b82f6',
      total: baseAtividades.length,
      atividades: baseAtividades,
      custom: true,
    }

    const novosCargos = [...cargos, novoCargoObj]
    const novoAtivMap = {
      ...atividadesPorCargo,
      [novoId]: baseAtividades.map((nome) => ({
        nome,
        marks: 0,
        pers: true,
      })),
    }

    persistirMatriz(novoAtivMap, undefined, novosCargos, undefined, undefined, undefined, undefined, `✨ Nova Matriz "${nomeTrim}" criada e duplicada com sucesso!`)
    setModalDuplicar({ isOpen: false, nome: '', icone: '📋', cor: '' })
  }

  const handleExcluirCargoMatriz = (cargoId: string, cargoNome: string) => {
    if (cargos.length <= 1) {
      showToast('⚠️ A matriz deve manter ao menos um cargo.')
      return
    }
    if (!window.confirm(`Deseja realmente remover a matriz/cargo "${cargoNome}"? O histórico deste item será excluído.`)) {
      return
    }

    const novosCargos = cargos.filter((c) => c.id !== cargoId)
    const novoAtivMap = { ...atividadesPorCargo }
    delete novoAtivMap[cargoId]

    const novasAtribuicoes = { ...atribuicoesManual }
    for (const [k, v] of Object.entries(novasAtribuicoes)) {
      if (v === cargoId) delete novasAtribuicoes[k]
    }

    if (selectedCargoId === cargoId) {
      setSelectedCargoId(null)
    }

    persistirMatriz(novoAtivMap, undefined, novosCargos, novasAtribuicoes, undefined, undefined, undefined, `🗑 Matriz "${cargoNome}" removida com sucesso.`)
  }

  // ------------------------------------------------------------------------
  // ATRIBUIÇÃO MANUAL DE COLABORADOR E ATIVIDADES
  // ------------------------------------------------------------------------
  const handleAbrirAtribuirColab = (colab: ColaboradorMatrizRH) => {
    const cargoMatriz = getCargoMatrizDoColaborador(colab)
    const ativsAtribuidas = atribuicoesAtividades[colab.id] || atribuicoesAtividades[colab.nome] || []
    setModalAtribuirColab({
      isOpen: true,
      colab,
      cargoId: cargoMatriz ? cargoMatriz.id : cargos[0]?.id || '',
      atividades: ativsAtribuidas,
    })
  }

  const handleSalvarAtribuicaoColab = () => {
    if (!modalAtribuirColab.colab) return
    const { colab, cargoId, atividades } = modalAtribuirColab

    const novasAtribuicoesManual = { ...atribuicoesManual }
    const novasAtribuicoesAtiv = { ...atribuicoesAtividades }

    if (cargoId) {
      novasAtribuicoesManual[colab.id] = cargoId
      novasAtribuicoesManual[colab.nome] = cargoId
    } else {
      delete novasAtribuicoesManual[colab.id]
      delete novasAtribuicoesManual[colab.nome]
    }

    if (atividades.length > 0) {
      novasAtribuicoesAtiv[colab.id] = atividades
      novasAtribuicoesAtiv[colab.nome] = atividades
    } else {
      delete novasAtribuicoesAtiv[colab.id]
      delete novasAtribuicoesAtiv[colab.nome]
    }

    const cargoDestino = cargos.find((c) => c.id === cargoId)
    persistirMatriz(
      atividadesPorCargo,
      undefined,
      undefined,
      novasAtribuicoesManual,
      novasAtribuicoesAtiv,
      undefined,
      undefined,
      `✅ Colaborador "${colab.nome}" atribuído a "${cargoDestino?.nome || 'Nenhum'}" com ${atividades.length} atividade(s)!`
    )
    setModalAtribuirColab({ isOpen: false, colab: null, cargoId: '', atividades: [] })
  }

  // Cadastrar colaborador manual (Admin pode cadastrar qualquer cargo)
  const handleCadastrarColaborador = () => {
    setAddFeedback(null)
    const nome = novoNome.trim()
    const cargoEscolhido = novoCargo.trim()

    if (!nome) {
      setAddFeedback({
        msg: '⚠️ NÃO ADICIONOU — preencha o NOME COMPLETO do colaborador.',
        tipo: 'erro',
      })
      return
    }

    if (!cargoEscolhido) {
      setAddFeedback({
        msg: '⚠️ NÃO ADICIONOU — selecione ou digite o CARGO do colaborador.',
        tipo: 'erro',
      })
      return
    }

    const novoColab: ColaboradorMatrizRH = {
      id: `custom_${Date.now()}`,
      nome,
      cargo: cargoEscolhido,
      status: 'ATIVO — Efetivado',
    }

    const novaLista = [...customColaboradores, novoColab]

    // Se o cargo digitado corresponder a um cargo da matriz, vincula
    const matchedCargo = cargos.find((c) => c.nome.toLowerCase() === cargoEscolhido.toLowerCase())
    const novasAtribuicoesManual = { ...atribuicoesManual }
    if (matchedCargo) {
      novasAtribuicoesManual[novoColab.id] = matchedCargo.id
      novasAtribuicoesManual[novoColab.nome] = matchedCargo.id
    }

    persistirMatriz(atividadesPorCargo, novaLista, undefined, novasAtribuicoesManual)

    setNovoNome('')
    setNovoCargo('')
    setAddFeedback({
      msg: `✅ Colaborador adicionado: ${nome} — ${cargoEscolhido}.\nEle já aparece na lista e no preenchimento da matriz.`,
      tipo: 'ok',
    })
  }

  // Buscar do RH feedback
  const handleAcaoBuscarRH = () => {
    if (colaboradoresRH.length === 0) {
      setRhFeedback({
        msg: `ℹ️ BUSCA NO RH FEITA — nenhum colaborador ativo encontrado no momento.\nVocê pode cadastrar no formulário logo abaixo.`,
        tipo: 'erro',
      })
    } else {
      setRhFeedback({
        msg: `✅ Busca feita: ${colaboradoresRH.length} colaborador(es) ativos encontrados no RH. O Administrador pode atribuir qualquer um deles a qualquer cargo da matriz.`,
        tipo: 'ok',
      })
    }
  }

  // Métricas gerais do relatório
  const totais = useMemo(() => {
    return getMetricasGerais(atividadesPorCargo, cargos)
  }, [atividadesPorCargo, cargos])

  // Cargo selecionado atual
  const cargoAtivo = useMemo(() => {
    if (!selectedCargoId) return null
    return cargos.find((c) => c.id === selectedCargoId) || null
  }, [selectedCargoId, cargos])

  const atividadesCargoAtivo = useMemo(() => {
    if (!cargoAtivo) return []
    return atividadesPorCargo[cargoAtivo.id] || []
  }, [cargoAtivo, atividadesPorCargo])

  const metricasCargoAtivo = useMemo(() => {
    if (!cargoAtivo) return null
    return getMetricasCargo(cargoAtivo, atividadesCargoAtivo)
  }, [cargoAtivo, atividadesCargoAtivo])

  // Colaboradores atribuídos ao cargo ativo
  const colaboradoresDoCargoAtivo = useMemo(() => {
    if (!cargoAtivo) return []
    return todosColaboradores.filter((c) => {
      const target = getCargoMatrizDoColaborador(c)
      return target && target.id === cargoAtivo.id
    })
  }, [cargoAtivo, todosColaboradores, atribuicoesManual])

  // Gerar texto do relatório
  const gerarTextoRelatorio = (): string => {
    let s = `RELATÓRIO AUTOMÁTICO — ${tituloMatriz.toUpperCase()} (${getMesLabel()})\n`
    s += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n`
    s += `Progresso geral: ${totais.pctGeral}% — ${totais.marcTotal} de ${totais.marcMax} marcações • ${totais.feitasTotal} de ${totais.ativTotal} atividades concluídas (3/3)\n\n`

    for (const c of cargos) {
      const ativs = atividadesPorCargo[c.id] || []
      const m = getMetricasCargo(c, ativs)
      const nomes = nomesPorCargo[c.nome] || []
      s += `${c.icone} ${c.nome}: ${m.marcacoesFeitas}/${m.totalMarcacoesPossiveis} marcações — ${m.concluidas}/${m.totalAtividades} atividades (${m.porcentagem}%)\n`
      if (nomes.length > 0) {
        s += `  Colaborador(es): ${nomes.join(', ')}\n`
      }
      for (const a of ativs) {
        s += `  [${a.marks || 0}/3] ${a.nome}${a.pers ? ' (personalizada)' : ''}${a.marks >= 3 ? ' — ✅ CONCLUÍDA' : ''}\n`
      }
      s += '\n'
    }
    return s
  }

  // Copiar relatório
  const handleCopiarRelatorio = () => {
    const texto = gerarTextoRelatorio()
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(() => {
        showToast('📋 Relatório copiado para a área de transferência!')
      })
    } else {
      window.prompt('Copie o relatório:', texto)
    }
  }

  // Imprimir relatório
  const handleImprimirRelatorio = () => {
    const w = window.open('', '_blank')
    if (!w) {
      showToast('Permita pop-ups para imprimir ou use Copiar relatório')
      return
    }

    let conteudoHtml = ''
    for (const c of cargos) {
      const ativs = atividadesPorCargo[c.id] || []
      const m = getMetricasCargo(c, ativs)
      const nomes = nomesPorCargo[c.nome] || []
      conteudoHtml += `
        <div style="border-top:1px solid #ccc; padding:12px 0; line-height:1.6">
          <b style="font-size:16px">${c.icone} ${c.nome}</b> — ${m.marcacoesFeitas} de ${m.totalMarcacoesPossiveis} marcações • ${m.concluidas} de ${m.totalAtividades} atividades concluídas (3/3) — <b>${m.porcentagem}%</b><br>
          ${nomes.length ? `Colaborador(es): <b>${nomes.join(', ')}</b><br>` : ''}
          ${ativs
          .map((a) => {
            const bol = '●'.repeat(a.marks || 0) + '○'.repeat(Math.max(0, 3 - (a.marks || 0)))
            return `${bol} ${a.marks || 0}/3 — ${a.nome}${a.pers ? ' (personalizada)' : ''}${a.marks >= 3 ? ' — <b>✅ CONCLUÍDA</b>' : ' — ⏳ pendente'}`
          })
          .join('<br>')}
        </div>
      `
    }

    w.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Relatório — ${tituloMatriz}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #000; padding: 24px; }
          h1 { margin-bottom: 4px; }
          p { color: #555; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <h1>Relatório — ${tituloMatriz} — ${getMesLabel()}</h1>
        <p>Hydro Reabilitação • Gerado em ${new Date().toLocaleString('pt-BR')}</p>
        <div>${conteudoHtml}</div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `)
    w.document.close()
  }

  return (
    <div className="min-h-screen bg-white text-[#111827] font-sans pb-24 px-4 sm:px-6 lg:px-8">
      {/* Toast flutuante */}
      {toastMsg && (
        <div className="fixed left-1/2 bottom-8 -translate-x-1/2 bg-[#111] text-white px-5 py-3 rounded-full text-sm font-bold shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {toastMsg}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="py-4 text-[13px] font-semibold text-gray-700 flex items-center gap-1.5 flex-wrap">
        <Link to="/seguranca" className="hover:text-black hover:underline">
          Segurança
        </Link>
        <span>›</span>
        <span className="text-black font-black">{tituloMatriz}</span>
        {isUserAdmin && (
          <span className="ml-2 inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full text-xs font-black">
            👑 Painel Admin Ativo
          </span>
        )}
      </div>

      {/* ============================================================== */}
      {/* VISTA DETALHE DO CARGO (ao clicar em um card)                  */}
      {/* ============================================================== */}
      {selectedCargoId && cargoAtivo && metricasCargoAtivo ? (
        <section className="animate-in fade-in duration-300 max-w-5xl mx-auto py-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setSelectedCargoId(null)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="inline-flex items-center gap-2 bg-white border border-gray-400 text-black hover:border-black font-black text-sm rounded-xl px-4 py-2 transition shadow-xs cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar para todos os cargos
            </button>

            {isUserAdmin && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAbrirEditar(cargoAtivo)}
                  className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-black text-xs sm:text-sm rounded-xl px-3.5 py-2 transition cursor-pointer"
                >
                  <Edit3 className="w-4 h-4 text-amber-700" /> Editar Título e Ícone
                </button>
                <button
                  type="button"
                  onClick={() => handleAbrirDuplicar(cargoAtivo)}
                  className="inline-flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 font-black text-xs sm:text-sm rounded-xl px-3.5 py-2 transition cursor-pointer"
                >
                  <CopyPlus className="w-4 h-4 text-purple-700" /> Duplicar Matriz
                </button>
              </div>
            )}
          </div>

          {/* Cabeçalho do Detalhe */}
          <div className="flex flex-wrap items-center gap-4 mt-5 justify-between">
            <div className="flex items-center gap-3.5">
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gray-50 border border-gray-300 flex items-center justify-center text-3xl sm:text-4xl shadow-inner shrink-0"
              >
                {cargoAtivo.icone}
              </div>
              <div>
                <h2
                  className="font-bold text-black text-2xl sm:text-4xl tracking-tight leading-tight flex items-center gap-2"
                  style={{ fontFamily: 'Georgia, Times New Roman, serif' }}
                >
                  {cargoAtivo.nome}
                </h2>
                <div className="text-sm sm:text-base font-bold text-gray-900 mt-1">
                  {metricasCargoAtivo.concluidas}/{atividadesCargoAtivo.length} atividades concluídas •{' '}
                  {metricasCargoAtivo.marcacoesFeitas}/{metricasCargoAtivo.totalMarcacoesPossiveis} marcações
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <a
                href={FORMS_URL_MATRIZ}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-extrabold text-sm sm:text-base rounded-2xl px-5 py-3.5 shadow-md flex items-center gap-2 transition"
              >
                📋 Preencher Forms ↗
              </a>
              <span className="bg-[#111] text-white font-black text-lg sm:text-xl rounded-full px-5 py-2.5 min-w-[70px] text-center shadow-xs">
                {metricasCargoAtivo.porcentagem}%
              </span>
            </div>
          </div>

          {/* Barra de Progresso do Detalhe */}
          <div className="h-3.5 bg-gray-200 rounded-full overflow-hidden my-5">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${metricasCargoAtivo.porcentagem}%`,
                background: cargoAtivo.cor,
              }}
            />
          </div>

          {/* SEÇÃO: Colaboradores Atribuídos a este cargo */}
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-sm mb-6">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <h3 className="font-bold text-lg sm:text-xl text-black flex items-center gap-2">
                👥 Colaboradores Atribuídos ({colaboradoresDoCargoAtivo.length})
              </h3>
              {isUserAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    const primeiroNaoAtribuido = todosColaboradores.find(
                      (c) => getCargoMatrizDoColaborador(c)?.id !== cargoAtivo.id
                    ) || todosColaboradores[0]
                    if (primeiroNaoAtribuido) {
                      setModalAtribuirColab({
                        isOpen: true,
                        colab: primeiroNaoAtribuido,
                        cargoId: cargoAtivo.id,
                        atividades: [],
                      })
                    } else {
                      showToast('Nenhum colaborador encontrado no RH.')
                    }
                  }}
                  className="bg-amber-400 hover:bg-amber-500 text-black font-black text-xs sm:text-sm rounded-xl px-4 py-2 flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" /> + Atribuir Colaborador
                </button>
              )}
            </div>

            {colaboradoresDoCargoAtivo.length === 0 ? (
              <p className="text-gray-500 text-sm font-semibold italic">
                Nenhum colaborador atribuído a este cargo ainda. O Administrador pode atribuir qualquer pessoa da equipe.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {colaboradoresDoCargoAtivo.map((colab) => (
                  <div
                    key={colab.id}
                    className="inline-flex items-center gap-2 bg-gray-100 border border-gray-300 rounded-full py-1.5 px-3.5 text-xs sm:text-sm font-bold text-gray-900 shadow-2xs"
                  >
                    <span>👤 {colab.nome}</span>
                    <span className="text-gray-500 font-normal">({colab.cargo})</span>
                    {isUserAdmin && (
                      <button
                        type="button"
                        title="Desvincular deste cargo"
                        onClick={() => {
                          const novasAtribuicoes = { ...atribuicoesManual }
                          delete novasAtribuicoes[colab.id]
                          delete novasAtribuicoes[colab.nome]
                          persistirMatriz(
                            atividadesPorCargo,
                            undefined,
                            undefined,
                            novasAtribuicoes,
                            undefined,
                            undefined,
                            undefined,
                            `Colaborador "${colab.nome}" desvinculado de ${cargoAtivo.nome}`
                          )
                        }}
                        className="w-4 h-4 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center transition cursor-pointer ml-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card com as Atividades */}
          <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden mb-6">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 border-b border-gray-200 bg-gray-50/50">
              <h3
                className="text-xl sm:text-2xl font-bold text-black"
                style={{ fontFamily: 'Georgia, Times New Roman, serif' }}
              >
                Atividades ({atividadesCargoAtivo.length})
              </h3>
              <button
                type="button"
                onClick={() => handleAdicionarAtividade(cargoAtivo.id)}
                className="bg-[#16a34a] hover:bg-[#15803d] text-white font-black text-sm rounded-xl px-4 py-2 flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </div>

            <div className="divide-y divide-gray-200">
              {atividadesCargoAtivo.length === 0 ? (
                <div className="p-6 text-center text-gray-500 font-bold">
                  Nenhuma atividade neste cargo. Clique em + Adicionar para criar uma.
                </div>
              ) : (
                atividadesCargoAtivo.map((ativ, idx) => {
                  const marks = ativ.marks || 0
                  const isConcluida = marks >= 3

                  // Colaboradores especificamente atribuídos a esta atividade
                  const colabsDestaAtiv = colaboradoresDoCargoAtivo.filter((c) => {
                    const ativs = atribuicoesAtividades[c.id] || atribuicoesAtividades[c.nome]
                    return ativs && ativs.includes(ativ.nome)
                  })

                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3.5 sm:py-4 transition-colors ${isConcluida ? 'bg-green-50/60' : 'bg-white hover:bg-gray-50/70'
                        }`}
                    >
                      {/* 3 Bolinhas Interativas */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {[0, 1, 2].map((k) => {
                          const isDotOn = k < marks
                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() => handleMarcarBolinha(cargoAtivo.id, idx, k)}
                              title={`Marcação ${k + 1} de 3`}
                              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-[2.5px] font-black text-xs sm:text-sm flex items-center justify-center transition-all cursor-pointer ${isDotOn
                                ? 'bg-[#16a34a] border-[#16a34a] text-white shadow-xs'
                                : 'bg-white border-gray-500 text-transparent hover:border-[#16a34a] hover:scale-105'
                                }`}
                            >
                              {isDotOn ? '✓' : ''}
                            </button>
                          )
                        })}
                      </div>

                      {/* Informações da Atividade */}
                      <div className="flex-1 min-w-0">
                        <div className="text-black font-extrabold text-sm sm:text-base leading-snug flex items-center flex-wrap gap-2">
                          <span>{ativ.nome}</span>
                          {ativ.pers && (
                            <span className="inline-block bg-[#ede9fe] text-[#6d28d9] border border-[#c4b5fd] font-extrabold text-[10px] rounded-full px-2 py-0.5 lowercase">
                              personalizada
                            </span>
                          )}
                        </div>

                        {colabsDestaAtiv.length > 0 && (
                          <div className="text-xs text-purple-800 font-bold mt-0.5">
                            Responsável(is): {colabsDestaAtiv.map((c) => c.nome).join(', ')}
                          </div>
                        )}

                        <div className="text-xs sm:text-sm font-bold text-gray-800 mt-1">
                          {marks}/3 marcações
                          {marks >= 3 ? (
                            <span className="text-[#15803d] font-black ml-1.5">
                              — ✅ CONCLUÍDA
                            </span>
                          ) : marks > 0 ? (
                            <span className="text-gray-900 font-semibold ml-1.5">
                              — ⏳ em andamento, faltam {3 - marks}
                            </span>
                          ) : (
                            <span className="text-gray-600 font-semibold ml-1.5">
                              — ⏳ pendente
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Botão de Excluir */}
                      <button
                        type="button"
                        onClick={() => handleRemoverAtividade(cargoAtivo.id, idx)}
                        title="Excluir esta atividade"
                        className="w-9 h-9 rounded-full border border-red-300 bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center shrink-0 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Flash de Salvo Automático */}
          <div className="text-[#15803d] font-black text-sm min-h-[22px] px-1">
            {salvoFlash}
          </div>

          {/* Aviso Automático */}
          <div className="flex items-center gap-3 bg-[#f0fdf4] border border-[#86efac] rounded-2xl p-4 mt-2 text-[#14532d] font-bold text-sm sm:text-base leading-relaxed">
            <span className="text-xl">💾</span>
            <span>
              Suas marcações são salvas automaticamente no banco de dados. O progresso fica
              registrado até o fim do mês.
            </span>
          </div>
        </section>
      ) : (
        /* ============================================================== */
        /* VISTA PRINCIPAL — GRADE DE CARGOS, RH E RELATÓRIO MENSAL       */
        /* ============================================================== */
        <div className="animate-in fade-in duration-300 max-w-7xl mx-auto">
          {/* Cabeçalho da Matriz */}
          <div className="flex flex-wrap items-start justify-between gap-4 mt-2">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-3xl sm:text-4xl">{iconeMatriz}</span>
                <h1
                  className="font-bold italic text-black text-3xl sm:text-5xl tracking-tight leading-tight"
                  style={{ fontFamily: 'Georgia, Times New Roman, serif' }}
                >
                  {tituloMatriz}
                </h1>
                {isUserAdmin && (
                  <button
                    type="button"
                    onClick={() => handleAbrirEditar(undefined, true)}
                    title="Editar título e ícone da matriz"
                    className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-gray-900 font-bold mt-2 text-base sm:text-lg">
                Selecione uma função para visualizar e atualizar o progresso das atividades.
              </p>
              <p className="text-amber-800 font-bold italic text-sm sm:text-base mt-1">
                * Progresso zerado no dia 01 de cada mês.
              </p>
              <div className="inline-flex items-center bg-[#111] text-[#f5c518] font-black text-xs uppercase tracking-wider rounded-full px-3.5 py-1.5 mt-3 shadow-xs">
                📅 Mês atual: {getMesLabel()} — progresso deste mês
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {isUserAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => handleAbrirDuplicar()}
                    className="bg-amber-400 hover:bg-amber-500 text-black font-black text-sm sm:text-base rounded-2xl px-5 py-3.5 shadow-md inline-flex items-center gap-2 transition shrink-0 cursor-pointer"
                  >
                    <CopyPlus className="w-5 h-5" /> Duplicar Matriz
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalDuplicar({
                        isOpen: true,
                        cargoBaseId: '',
                        nome: 'Nova Matriz / Cargo',
                        icone: '📋',
                        cor: '#3b82f6',
                      })
                    }}
                    className="bg-gray-900 hover:bg-black text-white font-black text-sm sm:text-base rounded-2xl px-5 py-3.5 shadow-md inline-flex items-center gap-2 transition shrink-0 cursor-pointer"
                  >
                    <Plus className="w-5 h-5 text-amber-400" /> Criar Novo Cargo
                  </button>
                </>
              )}
              <a
                href={FORMS_URL_MATRIZ}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-extrabold text-sm sm:text-base rounded-2xl px-5 py-3.5 shadow-lg inline-flex items-center gap-2 transition shrink-0"
              >
                📋 Preencher Forms ↗
              </a>
            </div>
          </div>

          {/* Grade de Cargos / Matrizes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
            {cargos.map((c) => {
              const ativs = atividadesPorCargo[c.id] || []
              const m = getMetricasCargo(c, ativs)
              const nomes = nomesPorCargo[c.nome] || []

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-3xl p-6 text-left relative shadow-sm hover:shadow-lg transition-all duration-200 border-[2.5px] group flex flex-col justify-between"
                  style={{ borderColor: c.cor }}
                >
                  <div>
                    {/* Botões de Ação Admin no Topo do Card */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center text-3xl shadow-inner">
                        {c.icone}
                      </div>

                      <div className="flex items-center gap-1">
                        {isUserAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAbrirEditar(c)
                              }}
                              title="Editar Ícone e Título"
                              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-amber-100 text-gray-700 hover:text-amber-900 flex items-center justify-center transition cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAbrirDuplicar(c)
                              }}
                              title="Duplicar Matriz / Cargo"
                              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-900 flex items-center justify-center transition cursor-pointer"
                            >
                              <CopyPlus className="w-4 h-4" />
                            </button>
                            {cargos.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleExcluirCargoMatriz(c.id, c.nome)
                                }}
                                title="Excluir Cargo"
                                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-red-100 text-gray-700 hover:text-red-600 flex items-center justify-center transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                        <span className="bg-[#7c3aed] text-white font-black text-[11px] rounded-full px-2.5 py-0.5 shadow-xs ml-1">
                          {c.custom ? 'Personalizada' : 'Padrão'}
                        </span>
                      </div>
                    </div>

                    <h3
                      className="text-2xl font-bold text-black"
                      style={{ fontFamily: 'Georgia, Times New Roman, serif' }}
                    >
                      {c.nome}
                    </h3>

                    <div className="text-gray-900 font-extrabold text-sm mt-2 flex items-center gap-1.5">
                      📁 {m.totalAtividades} atividades
                    </div>

                    <div className="text-gray-700 font-semibold text-xs mt-1.5 line-clamp-2 min-h-[32px]">
                      {nomes.length > 0 ? (
                        <span>👤 {nomes.join(', ')}</span>
                      ) : (
                        <span className="text-gray-400 italic">
                          Nenhum colaborador atribuído ainda
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-wider text-black">
                        PROGRESSO
                      </span>
                      <b className="text-base font-black text-black">{m.porcentagem}%</b>
                    </div>

                    <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden mt-1.5">
                      <div
                        className="h-full rounded-full transition-all duration-400"
                        style={{
                          width: `${m.porcentagem}%`,
                          background: c.cor,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-3 text-[11.5px] font-bold text-gray-800">
                      <span>
                        {m.marcacoesFeitas}/{m.totalMarcacoesPossiveis} marcas • {m.concluidas}/{m.totalAtividades} concl.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCargoId(c.id)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className="font-black text-black underline hover:text-[#7c3aed] cursor-pointer"
                      >
                        Abrir detalhes →
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ============================================================== */}
          {/* SEÇÃO RH: Todos os colaboradores e atribuição livre pelo Admin */}
          {/* ============================================================== */}
          <section className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm mt-8">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-black flex items-center gap-2">
                  👥 Colaboradores & Atribuição de Atividades na Matriz
                </h2>
                <p className="text-sm font-semibold text-gray-900 mt-1 leading-relaxed">
                  O Administrador pode <b>atribuir qualquer colaborador</b> para <b>qualquer cargo ou atividade</b> manualmente.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAcaoBuscarRH}
                className="bg-[#111] hover:bg-black text-white font-black text-sm rounded-xl py-2.5 px-4 shadow-xs transition cursor-pointer"
              >
                🔍 Atualizar do RH ({colaboradoresRH.length})
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mt-4 items-end">
              <div className="sm:col-span-7">
                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                  Buscar por nome
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={buscaRH}
                    onChange={(e) => setBuscaRH(e.target.value)}
                    placeholder="Buscar colaborador da equipe..."
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 text-sm font-bold text-black placeholder-gray-500 outline-none focus:border-amber-400"
                  />
                  <Search className="w-4 h-4 text-gray-500 absolute right-3.5 top-3" />
                </div>
              </div>

              <div className="sm:col-span-5">
                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                  Filtrar por cargo
                </label>
                <select
                  value={filtroCargo}
                  onChange={(e) => setFiltroCargo(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 text-sm font-bold text-black outline-none focus:border-amber-400 bg-white cursor-pointer"
                >
                  <option value="">Todos os cargos da equipe</option>
                  {listaCargosFiltro.map((nome) => (
                    <option key={nome} value={nome}>
                      {nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {rhFeedback && (
              <div
                className={`p-4 rounded-xl text-sm font-bold mt-4 whitespace-pre-line border-2 ${rhFeedback.tipo === 'ok'
                  ? 'bg-green-50 text-green-900 border-green-500'
                  : 'bg-red-50 text-red-900 border-red-500'
                  }`}
              >
                {rhFeedback.msg}
              </div>
            )}

            {/* Tabela de Colaboradores RH */}
            <div className="overflow-x-auto mt-4 border border-gray-200 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-black bg-gray-50">
                    <th className="py-3 px-4 text-xs font-black uppercase text-black">
                      Colaborador
                    </th>
                    <th className="py-3 px-4 text-xs font-black uppercase text-black">
                      Cargo Original (RH)
                    </th>
                    <th className="py-3 px-4 text-xs font-black uppercase text-black">
                      Atribuição na Matriz
                    </th>
                    <th className="py-3 px-4 text-xs font-black uppercase text-black">
                      Status
                    </th>
                    {isUserAdmin && (
                      <th className="py-3 px-4 text-xs font-black uppercase text-black text-right">
                        Ação do Admin
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm font-semibold">
                  {colaboradoresVisiveis.length === 0 ? (
                    <tr>
                      <td colSpan={isUserAdmin ? 5 : 4} className="py-6 px-4 text-center text-gray-500 font-bold">
                        {todosColaboradores.length === 0
                          ? 'Nenhum colaborador carregado ainda. Clique em "Atualizar do RH" ou cadastre abaixo.'
                          : 'Nenhum colaborador encontrado com os filtros atuais.'}
                      </td>
                    </tr>
                  ) : (
                    colaboradoresVisiveis.map((c) => {
                      const cargoMatriz = getCargoMatrizDoColaborador(c)
                      const ativsAtribuidas = atribuicoesAtividades[c.id] || atribuicoesAtividades[c.nome] || []

                      return (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4 text-black font-extrabold">{c.nome}</td>
                          <td className="py-3 px-4 text-gray-700 font-bold">{c.cargo}</td>
                          <td className="py-3 px-4">
                            {cargoMatriz ? (
                              <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-950 border border-amber-300 font-bold text-xs rounded-full px-3 py-1">
                                <span>{cargoMatriz.icone}</span>
                                <b>{cargoMatriz.nome}</b>
                                {ativsAtribuidas.length > 0 && (
                                  <span className="bg-purple-600 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                                    {ativsAtribuidas.length} ativ.
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs italic">
                                Não atribuído à matriz
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs font-black px-2.5 py-1 rounded-full uppercase">
                              <Check className="w-3.5 h-3.5" /> ATIVO
                            </span>
                          </td>
                          {isUserAdmin && (
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleAbrirAtribuirColab(c)}
                                className="bg-amber-400 hover:bg-amber-500 text-black font-black text-xs rounded-xl px-3 py-1.5 transition shadow-2xs cursor-pointer inline-flex items-center gap-1"
                              >
                                ⚙️ Atribuir Cargo / Atividades
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Formulário para Cadastrar Colaborador Manualmente */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-base sm:text-lg font-black text-black">
                ➕ Cadastrar colaborador manualmente
              </h3>
              <p className="text-xs sm:text-sm font-semibold text-gray-700 mt-1">
                Adicione qualquer colaborador para a matriz e selecione o cargo desejado.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mt-3 items-end">
                <div className="sm:col-span-6">
                  <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                    Nome completo *
                  </label>
                  <input
                    type="text"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    placeholder="Nome completo do colaborador"
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 text-sm font-bold text-black placeholder-gray-500 outline-none focus:border-amber-400"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                    Cargo na Matriz *
                  </label>
                  <select
                    value={novoCargo}
                    onChange={(e) => setNovoCargo(e.target.value)}
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 text-sm font-bold text-black outline-none focus:border-amber-400 bg-white cursor-pointer"
                  >
                    <option value="">— Selecione o cargo —</option>
                    {cargos.map((c) => (
                      <option key={c.id} value={c.nome}>
                        {c.icone} {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleCadastrarColaborador}
                    className="w-full bg-[#f5c518] hover:bg-[#eab308] text-black font-black text-sm rounded-xl py-3 px-4 shadow-xs transition cursor-pointer"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {addFeedback && (
                <div
                  className={`p-4 rounded-xl text-sm font-bold mt-4 whitespace-pre-line border-2 ${addFeedback.tipo === 'ok'
                    ? 'bg-green-50 text-green-900 border-green-500'
                    : 'bg-red-50 text-red-900 border-red-500'
                    }`}
                >
                  {addFeedback.msg}
                </div>
              )}
            </div>
          </section>

          {/* ============================================================== */}
          {/* SEÇÃO RELATÓRIO AUTOMÁTICO — MATRIZ DO MÊS                     */}
          {/* ============================================================== */}
          <section className="bg-white border-2 border-black rounded-3xl p-6 sm:p-8 shadow-sm mt-8">
            <h2 className="text-xl sm:text-2xl font-black text-black">
              📊 Relatório Automático — {tituloMatriz} do mês
            </h2>
            <p className="text-sm font-semibold text-gray-900 mt-1 leading-relaxed">
              Atualizado automaticamente a cada preenchimento salvo. No dia 01 de cada mês o
              progresso começa zerado de novo.
            </p>

            {/* 4 Cards de Estatísticas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
                <b className="text-2xl sm:text-3xl font-black text-black block">
                  {totais.totalCargos}
                </b>
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-gray-800">
                  Cargos da matriz
                </span>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
                <b className="text-2xl sm:text-3xl font-black text-black block">
                  {totais.ativTotal}
                </b>
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-gray-800">
                  Atividades no total
                </span>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
                <b className="text-2xl sm:text-3xl font-black text-black block">
                  {totais.feitasTotal}
                </b>
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-gray-800">
                  Atividades concluídas (3/3)
                </span>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
                <b className="text-2xl sm:text-3xl font-black text-black block">
                  {totais.marcTotal}/{totais.marcMax}
                </b>
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-gray-800">
                  Marcações feitas
                </span>
              </div>
            </div>

            {/* Progresso Geral */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center mt-3">
              <b className="text-3xl font-black text-black block">{totais.pctGeral}%</b>
              <span className="text-xs font-black uppercase tracking-wider text-gray-800">
                Progresso geral — sobre o total de marcações (atividades × 3)
              </span>
            </div>

            <div className="h-3.5 bg-gray-200 rounded-full overflow-hidden my-4">
              <div
                className="h-full bg-[#16a34a] rounded-full transition-all duration-400"
                style={{ width: `${totais.pctGeral}%` }}
              />
            </div>

            {/* Itens do Relatório */}
            <div className="divide-y divide-gray-200 border-t border-gray-200 mt-4">
              {cargos.map((c) => {
                const ativs = atividadesPorCargo[c.id] || []
                const m = getMetricasCargo(c, ativs)
                const nomes = nomesPorCargo[c.nome] || []

                return (
                  <div key={c.id} className="py-3.5 leading-relaxed text-sm">
                    <div className="text-black font-extrabold text-base">
                      {c.icone} {c.nome} —{' '}
                      <span className="font-bold text-gray-800">
                        {m.marcacoesFeitas} de {m.totalMarcacoesPossiveis} marcações • {m.concluidas}{' '}
                        de {m.totalAtividades} atividade(s) concluída(s) (3/3) —{' '}
                      </span>
                      <b>{m.porcentagem}%</b>
                    </div>

                    {nomes.length > 0 && (
                      <div className="text-xs font-bold text-gray-700 mt-0.5">
                        Colaborador(es): <b className="text-black">{nomes.join(', ')}</b>
                      </div>
                    )}

                    <div className="mt-2 space-y-1 pl-2">
                      {ativs.map((a, idx) => {
                        const marks = a.marks || 0
                        const bol = '●'.repeat(marks) + '○'.repeat(Math.max(0, 3 - marks))
                        return (
                          <div key={idx} className="text-xs sm:text-sm font-semibold text-gray-800">
                            <span className="font-mono text-black mr-1">{bol}</span> {marks}/3 —{' '}
                            <span className="text-black font-bold">{a.nome}</span>
                            {a.pers && <span className="text-purple-700 italic"> (personalizada)</span>}
                            {marks >= 3 ? (
                              <span className="text-green-700 font-extrabold ml-1">
                                — ✅ CONCLUÍDA
                              </span>
                            ) : (
                              <span className="text-gray-500 ml-1">— ⏳ pendente</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Ações do Relatório */}
            <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleImprimirRelatorio}
                className="bg-[#111] hover:bg-black text-white font-black text-sm rounded-xl py-3 px-5 shadow-xs flex items-center gap-2 transition cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Imprimir / Salvar em PDF
              </button>
              <button
                type="button"
                onClick={handleCopiarRelatorio}
                className="bg-[#f5c518] hover:bg-[#eab308] text-black font-black text-sm rounded-xl py-3 px-5 shadow-xs flex items-center gap-2 transition cursor-pointer"
              >
                <Copy className="w-4 h-4" /> Copiar relatório (texto)
              </button>
            </div>
          </section>

          {/* Rodapé informativo */}
          <footer className="text-center text-xs font-semibold text-gray-500 mt-10 leading-relaxed max-w-4xl mx-auto">
            Hydro Reabilitação — Segurança • {tituloMatriz} • O preenchimento fica salvo
            com segurança no banco de dados e separado por mês. No dia 01 de cada mês o progresso
            começa zerado de novo, mantendo o histórico de meses anteriores acessível.
          </footer>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: EDITAR ÍCONE E TÍTULO                                  */}
      {/* ============================================================== */}
      {modalEditar.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-xl font-black text-black flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-500" />
                {modalEditar.isGeneralTitle ? 'Editar Matriz Principal' : 'Editar Ícone e Título'}
              </h3>
              <button
                type="button"
                onClick={() => setModalEditar({ isOpen: false, nome: '', icone: '📋', cor: '' })}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                  Título / Nome
                </label>
                <input
                  type="text"
                  value={modalEditar.nome}
                  onChange={(e) => setModalEditar({ ...modalEditar, nome: e.target.value })}
                  placeholder="Nome do cargo ou matriz..."
                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 text-sm font-bold text-black outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                  Ícone Atual ({modalEditar.icone})
                </label>
                <input
                  type="text"
                  value={modalEditar.icone}
                  onChange={(e) => setModalEditar({ ...modalEditar, icone: e.target.value })}
                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-2 text-2xl text-center mb-2 outline-none focus:border-amber-400"
                />
                <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 rounded-xl border border-gray-200 max-h-24 overflow-y-auto">
                  {EMOJI_SUGESTOES.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setModalEditar({ ...modalEditar, icone: emoji })}
                      className={`w-9 h-9 text-lg rounded-lg flex items-center justify-center transition cursor-pointer ${modalEditar.icone === emoji
                        ? 'bg-amber-400 border-2 border-amber-600 scale-110 shadow-xs'
                        : 'hover:bg-gray-200'
                        }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {!modalEditar.isGeneralTitle && (
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                    Cor de Destaque
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {CORES_SUGESTOES.map((cor) => (
                      <button
                        key={cor}
                        type="button"
                        onClick={() => setModalEditar({ ...modalEditar, cor })}
                        style={{ backgroundColor: cor }}
                        className={`w-7 h-7 rounded-full transition-transform cursor-pointer shadow-xs ${modalEditar.cor === cor ? 'ring-3 ring-black scale-115' : 'hover:scale-105'
                          }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setModalEditar({ isOpen: false, nome: '', icone: '📋', cor: '' })}
                className="px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarEdicao}
                className="px-5 py-2.5 text-sm font-black text-black bg-amber-400 hover:bg-amber-500 rounded-xl transition shadow-xs cursor-pointer"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: DUPLICAR MATRIZ / CARGO                                */}
      {/* ============================================================== */}
      {modalDuplicar.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-xl font-black text-black flex items-center gap-2">
                <CopyPlus className="w-5 h-5 text-purple-600" />
                Duplicar Matriz / Criar Novo Cargo
              </h3>
              <button
                type="button"
                onClick={() => setModalDuplicar({ isOpen: false, nome: '', icone: '📋', cor: '' })}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                  Copiar Atividades da Matriz Base
                </label>
                <select
                  value={modalDuplicar.cargoBaseId}
                  onChange={(e) => {
                    const base = cargos.find((c) => c.id === e.target.value)
                    setModalDuplicar({
                      ...modalDuplicar,
                      cargoBaseId: e.target.value,
                      cor: base ? base.cor : modalDuplicar.cor,
                      icone: base ? base.icone : modalDuplicar.icone,
                    })
                  }}
                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 text-sm font-bold text-black outline-none focus:border-amber-400 bg-white cursor-pointer"
                >
                  <option value="">— Criar em branco (atividades padrão) —</option>
                  {cargos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icone} {c.nome} ({c.atividades.length} atividades)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                  Título da Nova Matriz *
                </label>
                <input
                  type="text"
                  value={modalDuplicar.nome}
                  onChange={(e) => setModalDuplicar({ ...modalDuplicar, nome: e.target.value })}
                  placeholder="Ex.: Líder de Frente, Manutenção, etc."
                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 text-sm font-bold text-black outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                  Ícone Escolhido ({modalDuplicar.icone})
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 rounded-xl border border-gray-200 max-h-24 overflow-y-auto">
                  {EMOJI_SUGESTOES.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setModalDuplicar({ ...modalDuplicar, icone: emoji })}
                      className={`w-9 h-9 text-lg rounded-lg flex items-center justify-center transition cursor-pointer ${modalDuplicar.icone === emoji
                        ? 'bg-purple-600 text-white border-2 border-purple-800 scale-110 shadow-xs'
                        : 'hover:bg-gray-200'
                        }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                  Cor de Destaque
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {CORES_SUGESTOES.map((cor) => (
                    <button
                      key={cor}
                      type="button"
                      onClick={() => setModalDuplicar({ ...modalDuplicar, cor })}
                      style={{ backgroundColor: cor }}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer shadow-xs ${modalDuplicar.cor === cor ? 'ring-3 ring-black scale-115' : 'hover:scale-105'
                        }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setModalDuplicar({ isOpen: false, nome: '', icone: '📋', cor: '' })}
                className="px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarDuplicacao}
                className="px-5 py-2.5 text-sm font-black text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition shadow-xs cursor-pointer"
              >
                ✨ Criar Matriz Duplicada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: ATRIBUIR COLABORADOR A CARGO E ATIVIDADES             */}
      {/* ============================================================== */}
      {modalAtribuirColab.isOpen && modalAtribuirColab.colab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-black text-black flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-amber-500" />
                  Atribuir à Matriz
                </h3>
                <p className="text-xs font-bold text-gray-600 mt-0.5">
                  Colaborador: <b className="text-black">{modalAtribuirColab.colab.nome}</b> (Cargo original: {modalAtribuirColab.colab.cargo})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalAtribuirColab({ isOpen: false, colab: null, cargoId: '', atividades: [] })}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                  Cargo na Matriz de Responsabilidade
                </label>
                <select
                  value={modalAtribuirColab.cargoId}
                  onChange={(e) => {
                    setModalAtribuirColab({
                      ...modalAtribuirColab,
                      cargoId: e.target.value,
                      atividades: [], // reseta atividades ao mudar cargo
                    })
                  }}
                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 text-sm font-bold text-black outline-none focus:border-amber-400 bg-white cursor-pointer"
                >
                  <option value="">— Não atribuído a nenhum cargo —</option>
                  {cargos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icone} {c.nome} ({c.atividades.length} atividades)
                    </option>
                  ))}
                </select>
              </div>

              {modalAtribuirColab.cargoId && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-black uppercase tracking-wider text-black">
                      Atividades Específicas do Colaborador
                    </label>
                    {(() => {
                      const cargoTarget = cargos.find((c) => c.id === modalAtribuirColab.cargoId)
                      const ativs = (atividadesPorCargo[modalAtribuirColab.cargoId] || []).map((a) => a.nome)
                      const allSelected = ativs.length > 0 && ativs.every((n) => modalAtribuirColab.atividades.includes(n))

                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setModalAtribuirColab({
                              ...modalAtribuirColab,
                              atividades: allSelected ? [] : ativs,
                            })
                          }}
                          className="text-xs font-black text-amber-700 hover:underline cursor-pointer"
                        >
                          {allSelected ? 'Desmarcar todas' : 'Selecionar todas'}
                        </button>
                      )
                    })()}
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto p-2 bg-gray-50 rounded-xl border border-gray-200">
                    {(atividadesPorCargo[modalAtribuirColab.cargoId] || []).length === 0 ? (
                      <p className="text-xs text-gray-500 italic p-2">Nenhuma atividade cadastrada neste cargo.</p>
                    ) : (
                      (atividadesPorCargo[modalAtribuirColab.cargoId] || []).map((ativ, idx) => {
                        const checked = modalAtribuirColab.atividades.includes(ativ.nome)
                        return (
                          <label
                            key={idx}
                            className={`flex items-center gap-2 p-2 rounded-lg transition cursor-pointer text-xs sm:text-sm font-bold ${checked ? 'bg-amber-100 text-amber-950' : 'bg-white hover:bg-gray-100 text-gray-800'
                              }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...modalAtribuirColab.atividades, ativ.nome]
                                  : modalAtribuirColab.atividades.filter((n) => n !== ativ.nome)
                                setModalAtribuirColab({
                                  ...modalAtribuirColab,
                                  atividades: next,
                                })
                              }}
                              className="rounded text-amber-500 focus:ring-amber-400"
                            />
                            <span>{ativ.nome}</span>
                          </label>
                        )
                      })
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1 italic">
                    * Se nenhuma atividade for selecionada, o colaborador será associado a todas as atividades do cargo.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setModalAtribuirColab({ isOpen: false, colab: null, cargoId: '', atividades: [] })}
                className="px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarAtribuicaoColab}
                className="px-5 py-2.5 text-sm font-black text-black bg-amber-400 hover:bg-amber-500 rounded-xl transition shadow-xs cursor-pointer"
              >
                Salvar Atribuição
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
