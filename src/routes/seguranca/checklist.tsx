import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  type ChecklistModelo,
  type ChecklistExecucao,
  type ChecklistAnexo,
  type ChecklistStore,
  type StatusItemChecklist,
  hojeISO,
  fmtDate,
  uid,
  fmtTam,
  tipoArq,
  calcConformidade,
  listarPendencias,
  gerarTextoRelatorioChecklist,
  carregarChecklistStore,
  salvarChecklistStore,
  getDbKeyChecklist,
} from '../../lib/checklistData'
import {
  type ColaboradorRH,
  carregarColaboradoresAtivosRH,
  comprimirImagem,
} from '../../lib/planoAcaoData'
import { supabase } from '../../lib/supabase'
import {
  ArrowLeft,
  Cloud,
  Search,
  Users,
  AlertTriangle,
  ClipboardCheck,
  Paperclip,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Trash2,
  Printer,
  Copy,
  Plus,
} from 'lucide-react'

export const Route = createFileRoute('/seguranca/checklist')({
  component: ChecklistComponent,
})

export function ChecklistComponent() {
  const [store, setStore] = useState<ChecklistStore>({
    modelos: [],
    execucoes: [],
    pendenciasResolvidas: {},
    anexos: [],
  })
  const [carregando, setCarregando] = useState(true)
  const [abaAtiva, setAbaAtiva] = useState<'principal' | 'anexos'>('principal')

  // Colaboradores RH
  const [colaboradoresRH, setColaboradoresRH] = useState<ColaboradorRH[]>([])
  const [carregandoRH, setCarregandoRH] = useState(true)
  const [executorDropdownOpen, setExecutorDropdownOpen] = useState(false)
  const executorBoxRef = useRef<HTMLDivElement>(null)

  // 1) Criar Modelo state
  const [nomeModelo, setNomeModelo] = useState('')
  const [novoItemTexto, setNovoItemTexto] = useState('')
  const [rascunhoItens, setRascunhoItens] = useState<string[]>([])
  const [modeloFeedback, setModeloFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(
    null
  )
  const [nomeModeloInvalido, setNomeModeloInvalido] = useState(false)
  const [novoItemInvalido, setNovoItemInvalido] = useState(false)

  // 2) Executar Checklist state
  const [selModeloUid, setSelModeloUid] = useState('')
  const [execData, setExecData] = useState(() => hojeISO())
  const [execExecutor, setExecExecutor] = useState('')
  const [execLocal, setExecLocal] = useState('')
  const [execObs, setExecObs] = useState('')
  const [execDraft, setExecDraft] = useState<
    Record<string, { status: StatusItemChecklist | ''; obs: string; foto: string }>
  >({})
  const [execFeedback, setExecFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(
    null
  )
  const [invalidExecCampos, setInvalidExecCampos] = useState<Record<string, boolean>>({})

  // 3) Pendências state
  const [filtroPend, setFiltroPend] = useState<'todas' | 'pendentes' | 'resolvidas'>('todas')

  // 4) Histórico & Relatório feedback
  const [relFeedback, setRelFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)
  const [confirmExcluirExec, setConfirmExcluirExec] = useState<Record<string, boolean>>({})

  // 6) Anexos state
  const [anexNome, setAnexNome] = useState('')
  const [anexLocal, setAnexLocal] = useState('')
  const [anexData, setAnexData] = useState('')
  const [pendAnex, setPendAnex] = useState<
    {
      nome: string
      mime: string
      rotulo: string
      icone: string
      tamanho: number
      dataUrl: string
    }[]
  >([])
  const [anexBusca, setAnexBusca] = useState('')
  const [anexFiltroTipo, setAnexFiltroTipo] = useState('todos')
  const [anexFeedback, setAnexFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)
  const [confirmExcluirAnexo, setConfirmExcluirAnexo] = useState<Record<string, boolean>>({})

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? null : curr))
    }, 3200)
  }

  // Fechar dropdown de executor ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (executorBoxRef.current && !executorBoxRef.current.contains(e.target as Node)) {
        setExecutorDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Carregar dados iniciais e colaboradores RH
  useEffect(() => {
    let isMounted = true

    const carregar = async () => {
      try {
        setCarregando(true)
        const [dadosStore, listaRH] = await Promise.all([
          carregarChecklistStore(),
          carregarColaboradoresAtivosRH(),
        ])
        if (isMounted) {
          setStore(dadosStore)
          setColaboradoresRH(listaRH)
        }
      } catch (err) {
        console.error('[Checklist] Erro ao carregar dados:', err)
      } finally {
        if (isMounted) {
          setCarregando(false)
          setCarregandoRH(false)
        }
      }
    }

    carregar()

    // Subscription realtime no Supabase
    const dbKey = getDbKeyChecklist()
    const canal = supabase
      .channel('realtime_checklist')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'global_settings',
          filter: `key=eq.${dbKey}`,
        },
        (payload: any) => {
          if (payload.new && payload.new.value && typeof payload.new.value === 'object') {
            const val = payload.new.value as Partial<ChecklistStore>
            setStore({
              modelos: Array.isArray(val.modelos) ? val.modelos : [],
              execucoes: Array.isArray(val.execucoes) ? val.execucoes : [],
              pendenciasResolvidas:
                val.pendenciasResolvidas && typeof val.pendenciasResolvidas === 'object'
                  ? val.pendenciasResolvidas
                  : {},
              anexos: Array.isArray(val.anexos) ? val.anexos : [],
            })
          }
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(canal)
    }
  }, [])

  // Helper para salvar estado da store no Supabase + LocalStorage
  const persistStore = async (novo: ChecklistStore) => {
    setStore(novo)
    await salvarChecklistStore(novo)
  }

  // ==========================================
  // 1) MODELOS
  // ==========================================
  const adicionarItemRascunho = () => {
    const v = novoItemTexto.trim()
    if (!v) {
      setNovoItemInvalido(true)
      return
    }
    setNovoItemInvalido(false)
    setRascunhoItens((prev) => [...prev, v])
    setNovoItemTexto('')
  }

  const removerItemRascunho = (idx: number) => {
    setRascunhoItens((prev) => prev.filter((_, i) => i !== idx))
  }

  const salvarModelo = async () => {
    setNomeModeloInvalido(false)
    const nome = nomeModelo.trim()
    const faltas: string[] = []

    if (!nome) {
      faltas.push('NOME DO CHECKLIST')
      setNomeModeloInvalido(true)
    }
    if (!rascunhoItens.length) {
      faltas.push('pelo menos 1 ITEM no modelo')
    }

    if (faltas.length) {
      setModeloFeedback({
        tipo: 'erro',
        msg: `⚠️ MODELO NÃO SALVO — falta: ${faltas.join(' + ')}.`,
      })
      return
    }

    const novoModelo: ChecklistModelo = {
      uid: uid('m'),
      nome,
      itens: rascunhoItens.map((t) => ({ uid: uid('i'), texto: t })),
      criadoEm: new Date().toLocaleString('pt-BR'),
    }

    const novosModelos = [novoModelo, ...store.modelos]
    const novaStore = { ...store, modelos: novosModelos }
    await persistStore(novaStore)

    setNomeModelo('')
    setRascunhoItens([])
    setNovoItemTexto('')
    setModeloFeedback({
      tipo: 'ok',
      msg: `✅ MODELO SALVO!\n“${novoModelo.nome}” com ${novoModelo.itens.length} item(ns) já está na lista de modelos e disponível para execução abaixo.`,
    })
    showToast(`✅ Modelo “${novoModelo.nome}” salvo`)
  }

  const limparModelo = () => {
    setNomeModelo('')
    setNovoItemTexto('')
    setRascunhoItens([])
    setNomeModeloInvalido(false)
    setNovoItemInvalido(false)
    setModeloFeedback(null)
  }

  const excluirModelo = async (mUid: string) => {
    const m = store.modelos.find((x) => x.uid === mUid)
    const usados = store.execucoes.filter((e) => e.modeloUid === mUid).length

    if (usados > 0) {
      showToast(`⚠️ Modelo usado em ${usados} execução(ões) — não pode ser excluído`)
      return
    }

    if (!window.confirm(`Excluir o modelo “${m ? m.nome : ''}”?`)) return

    const novosModelos = store.modelos.filter((x) => x.uid !== mUid)
    const novaStore = { ...store, modelos: novosModelos }
    await persistStore(novaStore)

    if (selModeloUid === mUid) {
      setSelModeloUid('')
      setExecDraft({})
    }
    showToast('Modelo excluído')
  }

  // ==========================================
  // 2) EXECUÇÃO
  // ==========================================
  const modeloSelecionado = useMemo(() => {
    return store.modelos.find((m) => m.uid === selModeloUid) || null
  }, [store.modelos, selModeloUid])

  const marcarItem = (itemUid: string, status: StatusItemChecklist) => {
    setExecDraft((prev) => {
      const atual = prev[itemUid] || { status: '', obs: '', foto: '' }
      return {
        ...prev,
        [itemUid]: { ...atual, status },
      }
    })
    if (status === 'NC') {
      showToast('❌ Item Não conforme — preencha a observação e envie a foto')
    }
  }

  const handleObsItem = (itemUid: string, v: string) => {
    setExecDraft((prev) => {
      const atual = prev[itemUid] || { status: '', obs: '', foto: '' }
      return {
        ...prev,
        [itemUid]: { ...atual, obs: v },
      }
    })
  }

  const handleFotoItem = async (e: React.ChangeEvent<HTMLInputElement>, itemUid: string) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const base64 = await comprimirImagem(file, 800, 0.7)
      setExecDraft((prev) => {
        const atual = prev[itemUid] || { status: '', obs: '', foto: '' }
        return {
          ...prev,
          [itemUid]: { ...atual, foto: base64 },
        }
      })
      showToast('📷 Foto anexada ao item')
    } catch {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setExecDraft((prev) => {
          const atual = prev[itemUid] || { status: '', obs: '', foto: '' }
          return {
            ...prev,
            [itemUid]: { ...atual, foto: ev.target?.result as string },
          }
        })
        showToast('📷 Foto anexada ao item')
      }
      reader.readAsDataURL(file)
    }
  }

  const salvarExecucao = async () => {
    const novosInvalidos: Record<string, boolean> = {}
    const faltas: string[] = []

    if (!modeloSelecionado) {
      faltas.push('escolher o MODELO')
      novosInvalidos.modelo = true
    }
    if (!execData) {
      faltas.push('DATA DA EXECUÇÃO')
      novosInvalidos.data = true
    }
    if (!execExecutor.trim()) {
      faltas.push('EXECUTOR')
      novosInvalidos.executor = true
    }
    if (!execLocal.trim()) {
      faltas.push('LOCAL / FRENTE DE OBRA')
      novosInvalidos.local = true
    }

    const itensExec: {
      itemUid: string
      texto: string
      status: StatusItemChecklist
      obs: string
      foto?: string
    }[] = []

    if (modeloSelecionado) {
      modeloSelecionado.itens.forEach((it, i) => {
        const d = execDraft[it.uid] || { status: '', obs: '', foto: '' }
        if (!d.status) {
          faltas.push(`marcar o item ${i + 1} (“${it.texto}”)`)
        } else if (d.status === 'NC') {
          if (!d.obs.trim()) {
            faltas.push(`observação do item ${i + 1} (Não conforme)`)
          }
          if (!d.foto) {
            faltas.push(`foto do item ${i + 1} (Não conforme)`)
          }
        }
        if (d.status) {
          itensExec.push({
            itemUid: it.uid,
            texto: it.texto,
            status: d.status as StatusItemChecklist,
            obs: d.obs.trim(),
            foto: d.foto || undefined,
          })
        }
      })
    }

    if (faltas.length) {
      setInvalidExecCampos(novosInvalidos)
      setExecFeedback({
        tipo: 'erro',
        msg: `⚠️ EXECUÇÃO NÃO SALVA — falta: ${faltas.join(' • ')}.`,
      })
      return
    }

    setInvalidExecCampos({})
    const calc = calcConformidade(itensExec)

    const novaExec: ChecklistExecucao = {
      uid: uid('e'),
      modeloUid: modeloSelecionado!.uid,
      modeloNome: modeloSelecionado!.nome,
      data: execData,
      executor: execExecutor.trim(),
      local: execLocal.trim(),
      obsGeral: execObs.trim() || undefined,
      itens: itensExec,
      conf: calc.conf,
      nc: calc.nc,
      na: calc.na,
      pct: calc.pct,
      salvoEm: new Date().toLocaleString('pt-BR'),
    }

    const novasExecucoes = [novaExec, ...store.execucoes]
    const novaStore = { ...store, execucoes: novasExecucoes }
    await persistStore(novaStore)

    setExecDraft({})
    setSelModeloUid('')
    setExecExecutor('')
    setExecLocal('')
    setExecObs('')
    setExecData(hojeISO())

    const msgSucesso = `✅ CHECKLIST EXECUTADO E SALVO NO HISTÓRICO!\nModelo: ${
      novaExec.modeloNome
    } • Conformidade: ${
      novaExec.pct === null ? '— (todos os itens Não se aplica)' : novaExec.pct + '%'
    } (${novaExec.conf} conforme / ${novaExec.nc} não conforme / ${novaExec.na} não se aplica).${
      novaExec.nc
        ? `\n⚠️ ${novaExec.nc} pendência(s) gerada(s) automaticamente — veja a seção 3 abaixo.`
        : ''
    }`

    setExecFeedback({
      tipo: 'ok',
      msg: msgSucesso,
    })
    showToast(`✅ Execução salva — conformidade ${novaExec.pct === null ? '—' : novaExec.pct + '%'}`)
  }

  const limparExecucao = () => {
    setExecDraft({})
    setSelModeloUid('')
    setExecExecutor('')
    setExecLocal('')
    setExecObs('')
    setExecData(hojeISO())
    setInvalidExecCampos({})
    setExecFeedback(null)
  }

  // ==========================================
  // 3) PENDÊNCIAS
  // ==========================================
  const todasPendencias = useMemo(() => {
    return listarPendencias(store.execucoes, store.pendenciasResolvidas)
  }, [store.execucoes, store.pendenciasResolvidas])

  const pendenciasFiltradas = useMemo(() => {
    if (filtroPend === 'pendentes') return todasPendencias.filter((p) => !p.resolvida)
    if (filtroPend === 'resolvidas') return todasPendencias.filter((p) => p.resolvida)
    return todasPendencias
  }, [todasPendencias, filtroPend])

  const abertasCount = useMemo(() => {
    return todasPendencias.filter((p) => !p.resolvida).length
  }, [todasPendencias])

  const resolverPendencia = async (chave: string) => {
    const novasPendResolvidas = {
      ...store.pendenciasResolvidas,
      [chave]: { em: new Date().toLocaleString('pt-BR') },
    }
    const novaStore = { ...store, pendenciasResolvidas: novasPendResolvidas }
    await persistStore(novaStore)
    showToast('✅ Pendência marcada como resolvida')
  }

  const reabrirPendencia = async (chave: string) => {
    const novasPendResolvidas = { ...store.pendenciasResolvidas }
    delete novasPendResolvidas[chave]
    const novaStore = { ...store, pendenciasResolvidas: novasPendResolvidas }
    await persistStore(novaStore)
    showToast('↩️ Pendência voltou para PENDENTE')
  }

  // ==========================================
  // 4) HISTÓRICO
  // ==========================================
  const excluirExecucao = async (eUid: string) => {
    if (
      !confirmExcluirExec[eUid] &&
      !window.confirm(
        'Excluir esta execução do histórico? As pendências dos itens Não conforme dela também somem da lista.'
      )
    )
      return

    const novasExec = store.execucoes.filter((e) => e.uid !== eUid)
    const novasPend = { ...store.pendenciasResolvidas }
    Object.keys(novasPend).forEach((k) => {
      if (k.startsWith(`${eUid}|`)) {
        delete novasPend[k]
      }
    })

    const novaStore = {
      ...store,
      execucoes: novasExec,
      pendenciasResolvidas: novasPend,
    }
    await persistStore(novaStore)
    showToast('Execução excluída — relatório atualizado')
  }

  // ==========================================
  // 5) RELATÓRIO
  // ==========================================
  const totalExecucoes = store.execucoes.length
  let totalConf = 0
  let totalNC = 0
  let totalNA = 0
  const porModelo: Record<
    string,
    { exec: number; conf: number; nc: number; na: number }
  > = {}

  store.execucoes.forEach((e) => {
    totalConf += e.conf
    totalNC += e.nc
    totalNA += e.na
    const pm = (porModelo[e.modeloNome] = porModelo[e.modeloNome] || {
      exec: 0,
      conf: 0,
      nc: 0,
      na: 0,
    })
    pm.exec++
    pm.conf += e.conf
    pm.nc += e.nc
    pm.na += e.na
  })

  const totalAvaliados = totalConf + totalNC
  const pctGeral = totalAvaliados ? Math.round((totalConf / totalAvaliados) * 100) : null

  const copiarRelatorio = () => {
    const txt = gerarTextoRelatorioChecklist(store.execucoes, store.pendenciasResolvidas)
    const ok = () => {
      setRelFeedback({
        tipo: 'ok',
        msg: 'Relatório copiado como texto. Cole onde precisar.',
      })
      showToast('📋 Relatório copiado!')
    }
    const erro = () => {
      window.prompt('Copie o relatório:', txt)
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(ok, erro)
    } else {
      erro()
    }
  }

  const imprimirRelatorio = () => {
    window.print()
  }

  // ==========================================
  // 6) ANEXOS
  // ==========================================
  const handleAnexInput = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(ev.target.files || [])
    if (!files.length) return

    let pend = files.length
    files.forEach((f) => {
      const t = tipoArq(f.name, f.type)
      const r = new FileReader()
      r.onload = (e) => {
        setPendAnex((prev) => [
          ...prev,
          {
            nome: f.name,
            mime: f.type || '',
            rotulo: t.rotulo,
            icone: t.icone,
            tamanho: f.size,
            dataUrl: e.target?.result as string,
          },
        ])
        pend--
        if (pend <= 0) {
          showToast(`📎 ${files.length} arquivo(s) escolhido(s) — clique em Salvar arquivos`)
        }
      }
      r.onerror = () => {
        pend--
        showToast(`Não foi possível ler o arquivo: ${f.name}`)
      }
      r.readAsDataURL(f)
    })
    ev.target.value = ''
  }

  const salvarAnexos = async () => {
    if (!pendAnex.length) {
      setAnexFeedback({
        tipo: 'erro',
        msg: '⚠️ NADA PARA SALVAR — clique em “📎 Escolher arquivos” e escolha pelo menos 1 checklist preenchido antes de salvar.',
      })
      return
    }

    const agora = new Date()
    const quando =
      String(agora.getDate()).padStart(2, '0') +
      '/' +
      String(agora.getMonth() + 1).padStart(2, '0') +
      '/' +
      agora.getFullYear() +
      ' às ' +
      String(agora.getHours()).padStart(2, '0') +
      ':' +
      String(agora.getMinutes()).padStart(2, '0')

    const novos: ChecklistAnexo[] = pendAnex.map((a) => ({
      id: uid('arq'),
      nome: a.nome,
      mime: a.mime,
      rotulo: a.rotulo,
      icone: a.icone,
      tamanho: a.tamanho,
      dataUrl: a.dataUrl,
      anexadoEm: quando,
      titulo: anexNome.trim() || undefined,
      local: anexLocal.trim() || undefined,
      dataChecklist: anexData || undefined,
    }))

    const novosAnexos = [...novos, ...store.anexos]
    const novaStore = { ...store, anexos: novosAnexos }
    await persistStore(novaStore)

    setPendAnex([])
    setAnexNome('')
    setAnexLocal('')
    setAnexData('')
    setAnexFeedback({
      tipo: 'ok',
      msg: `✅ ${novos.length} CHECKLIST(S) PREENCHIDO(S) SALVO(S)!\nArquivados em ${quando} e já aparecem na lista abaixo, para visualizar/abrir ou baixar.`,
    })
    showToast(`📎 ${novos.length} checklist(s) salvo(s) — anexados em ${quando}`)
  }

  const limparAnexos = () => {
    setPendAnex([])
    setAnexNome('')
    setAnexLocal('')
    setAnexData('')
    setAnexFeedback(null)
  }

  const excluirAnexo = async (idx: number, nome: string) => {
    if (!confirmExcluirAnexo[idx]) {
      setConfirmExcluirAnexo((prev) => ({ ...prev, [idx]: true }))
      setTimeout(() => {
        setConfirmExcluirAnexo((prev) => ({ ...prev, [idx]: false }))
      }, 4000)
      return
    }

    const novosAnexos = store.anexos.filter((_, i) => i !== idx)
    const novaStore = { ...store, anexos: novosAnexos }
    await persistStore(novaStore)
    showToast(`Arquivo excluído: ${nome}`)
  }

  const anexosFiltrados = useMemo(() => {
    const busca = anexBusca.trim().toLowerCase()
    return store.anexos.filter((a) => {
      const t = tipoArq(a.nome, a.mime)
      const r = a.rotulo || t.rotulo
      if (anexFiltroTipo !== 'todos' && r !== anexFiltroTipo) return false
      if (
        busca &&
        !String(a.nome || '').toLowerCase().includes(busca) &&
        !String(a.titulo || '').toLowerCase().includes(busca) &&
        !String(a.local || '').toLowerCase().includes(busca)
      ) {
        return false
      }
      return true
    })
  }, [store.anexos, anexBusca, anexFiltroTipo])

  const statsPorTipo = useMemo(() => {
    const porTipo: Record<string, number> = {
      PDF: 0,
      Excel: 0,
      Word: 0,
      Imagem: 0,
      Arquivo: 0,
    }
    store.anexos.forEach((a) => {
      const t = tipoArq(a.nome, a.mime)
      const r = a.rotulo || t.rotulo
      const chave = porTipo[r] !== undefined ? r : 'Arquivo'
      porTipo[chave] = (porTipo[chave] || 0) + 1
    })
    return porTipo
  }, [store.anexos])

  // Colaboradores RH para autocomplete
  const colaboradoresFiltrados = useMemo(() => {
    const q = execExecutor.toLowerCase().trim()
    if (!q) return colaboradoresRH.slice(0, 10)
    return colaboradoresRH
      .filter((c) => c.nome.toLowerCase().includes(q) || c.cargo.toLowerCase().includes(q))
      .slice(0, 15)
  }, [colaboradoresRH, execExecutor])

  return (
    <div className="ck-container flex flex-col h-full overflow-y-auto pb-24 bg-white text-[#111827]">
      <style>{`
        .ck-container {
          font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        }
        .ck-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 22px;
          padding: 20px 22px;
          box-shadow: 0 8px 30px rgba(0,0,0,.05);
          margin-bottom: 18px;
        }
        .ck-card h2 {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 24px;
          color: #000;
          margin-bottom: 6px;
        }
        .ck-card p.hint {
          color: #111827;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.55;
          margin-bottom: 12px;
        }
        .ck-label {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: .03em;
          color: #000;
          display: block;
          margin: 14px 0 6px;
        }
        .ck-input, .ck-select, .ck-textarea {
          width: 100%;
          border: 1.5px solid #9ca3af;
          border-radius: 12px;
          padding: 12px 13px;
          font-size: 15px;
          font-family: inherit;
          outline: 0;
          background: #fff;
          color: #000;
          font-weight: 700;
        }
        .ck-textarea {
          resize: vertical;
          min-height: 80px;
        }
        .ck-input:focus, .ck-select:focus, .ck-textarea:focus {
          border-color: #f5c518;
          box-shadow: 0 0 0 3px #fef3c7;
        }
        .ck-input::placeholder, .ck-textarea::placeholder {
          color: #374151 !important;
          opacity: 1;
          font-weight: 600;
        }
        .ck-grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        @media(max-width: 900px) {
          .ck-grid2 {
            grid-template-columns: 1fr;
          }
        }
        .ck-grid3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        @media(max-width: 900px) {
          .ck-grid3 {
            grid-template-columns: 1fr;
          }
        }
        .ck-btn {
          border: 0;
          border-radius: 12px;
          padding: 13px 20px;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .ck-btn-yellow {
          background: #f5c518;
          color: #111;
        }
        .ck-btn-yellow:hover {
          background: #eab308;
        }
        .ck-btn-dark {
          background: #111;
          color: #fff;
        }
        .ck-btn-dark:hover {
          background: #27272a;
        }
        .ck-btn-ghost {
          background: #fff;
          border: 1.5px solid #9ca3af;
          color: #111;
        }
        .ck-btn-ghost:hover {
          background: #f3f4f6;
        }
        .ck-btn-green {
          background: #16a34a;
          color: #fff;
        }
        .ck-btn-green:hover {
          background: #15803d;
        }
        .ck-btn-red {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }
        .ck-btn-red:hover {
          background: #fee2e2;
        }
        .ck-feedback {
          border-radius: 14px;
          padding: 14px 16px;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.55;
          margin-top: 14px;
          white-space: pre-line;
        }
        .ck-feedback.erro {
          background: #fef2f2;
          border: 2px solid #dc2626;
          color: #991b1b;
        }
        .ck-feedback.ok {
          background: #f0fdf4;
          border: 2px solid #16a34a;
          color: #14532d;
        }
        .ck-invalid-campo {
          border: 2.5px solid #dc2626 !important;
          background: #fef2f2 !important;
        }
        .ck-item-row {
          display: flex;
          gap: 10px;
          align-items: center;
          border: 1.5px solid #e5e7eb;
          border-radius: 12px;
          padding: 10px 12px;
          margin-bottom: 8px;
          background: #fff;
        }
        .ck-item-row span {
          flex: 1;
          font-weight: 700;
          color: #000;
          font-size: 14px;
          line-height: 1.45;
        }
        .ck-item-row .rm {
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #dc2626;
          border-radius: 10px;
          padding: 7px 11px;
          font-weight: 800;
          font-size: 13px;
          flex: none;
          cursor: pointer;
        }
        .ck-modelo {
          border: 2px solid #fde68a;
          border-radius: 18px;
          padding: 16px;
          margin-bottom: 12px;
          background: #fffbeb;
        }
        .ck-modelo h3 {
          font-size: 16px;
          color: #000;
          font-weight: 800;
        }
        .ck-modelo p {
          color: #111827;
          font-size: 14px;
          line-height: 1.55;
          margin-top: 5px;
          font-weight: 600;
        }
        .ck-modelo ul {
          margin: 8px 0 0 20px;
          color: #111827;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.7;
          list-style-type: disc;
        }
        .ck-modelo ul li b {
          color: #000;
        }
        .ck-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin: 14px 0;
        }
        @media(max-width: 640px) {
          .ck-stats {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .ck-stat {
          background: #f9fafb;
          border: 1.5px solid #e5e7eb;
          border-radius: 14px;
          padding: 14px;
          text-align: center;
        }
        .ck-stat b {
          font-size: 26px;
          display: block;
          color: #000;
        }
        .ck-stat span {
          font-size: 11px;
          color: #111;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .05em;
        }
        .ck-badge {
          display: inline-flex !important;
          width: auto !important;
          max-width: max-content !important;
          align-items: center;
          background: #fef3c7;
          color: #92400e;
          font-weight: 800;
          font-size: 11px;
          padding: 6px 9px;
          border-radius: 999px;
          letter-spacing: .04em;
          text-transform: uppercase;
        }
        .ck-badge.ok {
          background: #dcfce7;
          color: #166534;
        }
        .ck-badge.nc {
          background: #fee2e2;
          color: #991b1b;
        }
        .ck-badge.na {
          background: #e5e7eb;
          color: #374151;
        }
        .ck-badge.pend {
          background: #fee2e2;
          color: #991b1b;
        }
        .ck-badge.resolvida {
          background: #dcfce7;
          color: #166534;
        }
        .ck-exec-item {
          border: 1.5px solid #e5e7eb;
          border-radius: 16px;
          padding: 14px 16px;
          margin-bottom: 12px;
          background: #fff;
        }
        .ck-exec-item.nc {
          border-color: #fca5a5;
          background: #fef2f2;
        }
        .ck-exec-item .q {
          font-weight: 800;
          color: #000;
          font-size: 15px;
          line-height: 1.5;
        }
        .ck-mark-btns {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 10px;
        }
        .ck-mark-btns button {
          border: 1.5px solid #111;
          background: #fff;
          color: #000;
          font-weight: 800;
          border-radius: 999px;
          padding: 9px 16px;
          font-size: 14px;
          cursor: pointer;
        }
        .ck-mark-btns button.on-c {
          background: #16a34a;
          border-color: #16a34a;
          color: #fff;
        }
        .ck-mark-btns button.on-nc {
          background: #dc2626;
          border-color: #dc2626;
          color: #fff;
        }
        .ck-mark-btns button.on-na {
          background: #6b7280;
          border-color: #6b7280;
          color: #fff;
        }
        .ck-nc-extra {
          display: none;
          margin-top: 12px;
          border-top: 1px dashed #fca5a5;
          padding-top: 12px;
        }
        .ck-nc-extra.show {
          display: block;
        }
        .ck-photo {
          border: 2px dashed #6b7280;
          border-radius: 14px;
          padding: 14px;
          text-align: center;
          background: #fff;
          cursor: pointer;
          display: block;
          margin: 0;
        }
        .ck-photo:hover {
          border-color: #f5c518;
          background: #fffbeb;
        }
        .ck-photo input {
          display: none;
        }
        .ck-pend {
          border: 2px solid #fecaca;
          border-left: 8px solid #dc2626;
          border-radius: 18px;
          padding: 16px;
          margin-bottom: 12px;
          background: #fef2f2;
        }
        .ck-pend.resolvida {
          border-color: #bbf7d0;
          border-left-color: #16a34a;
          background: #f0fdf4;
        }
        .ck-pend h3 {
          font-size: 16px;
          color: #000;
          font-weight: 800;
        }
        .ck-pend p {
          color: #111827;
          font-size: 14px;
          line-height: 1.55;
          margin-top: 5px;
          font-weight: 600;
        }
        .ck-pend img {
          width: 100%;
          max-width: 320px;
          height: 170px;
          object-fit: cover;
          border-radius: 10px;
          margin-top: 10px;
          border: 1.5px solid #9ca3af;
        }
        .ck-exec-card {
          border: 2px solid #e5e7eb;
          border-radius: 18px;
          padding: 16px;
          margin-bottom: 12px;
          background: #fff;
        }
        .ck-exec-card h3 {
          font-size: 16px;
          color: #000;
          font-weight: 800;
        }
        .ck-exec-card p {
          color: #111827;
          font-size: 14px;
          line-height: 1.55;
          margin-top: 5px;
          font-weight: 600;
        }
        .ck-progress {
          height: 16px;
          background: #e5e7eb;
          border-radius: 999px;
          overflow: hidden;
          margin: 12px 0;
        }
        .ck-progress i {
          display: block;
          height: 100%;
          background: #16a34a;
          transition: width .4s ease-in-out;
        }
        .ck-relatorio {
          border: 2px solid #111827;
          border-radius: 20px;
          padding: 22px;
          background: #fff;
        }
        .ck-relatorio h2 {
          font-size: 24px;
          color: #000;
        }
        .ck-rel-item {
          border-top: 1px solid #e5e7eb;
          padding: 12px 0;
        }
        .ck-rel-item b {
          color: #000;
        }
        table.ck-audit {
          width: 100%;
          border-collapse: collapse;
          min-width: 520px;
        }
        table.ck-audit th {
          text-align: left;
          font-size: 14px;
          font-weight: 900;
          color: #000;
          padding: 12px 10px;
          border-bottom: 2px solid #111;
        }
        table.ck-audit td {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          padding: 11px 10px;
          border-bottom: 1px solid #e5e7eb;
          vertical-align: top;
          line-height: 1.5;
        }
        table.ck-audit td b {
          color: #000;
        }
        .ck-empty {
          border: 1px dashed #d1d5db;
          border-radius: 16px;
          padding: 22px;
          text-align: center;
          color: #374151;
          font-weight: 600;
          font-size: 14px;
          line-height: 1.6;
          background: #fff;
        }
        .ck-tabs {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }
        .ck-tabbtn {
          border: 2px solid #111;
          border-radius: 999px;
          padding: 12px 20px;
          font-weight: 800;
          font-size: 15px;
          background: #fff;
          color: #111;
          cursor: pointer;
          transition: all 0.2s;
        }
        .ck-tabbtn.active {
          background: #111;
          color: #fff;
        }
        .ck-anexos-box {
          border: 2px dashed #2563eb;
          border-radius: 14px;
          padding: 16px;
          background: #eff6ff;
          margin-top: 4px;
          text-align: center;
        }
        .ck-anexo-txt {
          color: #000;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.55;
          display: block;
        }
        .ck-anexo-txt b {
          font-weight: 900;
        }
        .ck-anexo-btn {
          display: block;
          width: 100%;
          background: #2563eb;
          color: #fff;
          border: 0;
          border-radius: 12px;
          padding: 13px 14px;
          font-weight: 800;
          font-size: 15px;
          text-align: center;
          cursor: pointer;
          margin-top: 12px;
        }
        .ck-anexo-btn:hover {
          background: #1d4ed8;
        }
        .ck-anexo-hint {
          font-size: 12px;
          color: #1e3a8a;
          font-weight: 600;
          line-height: 1.5;
          margin-top: 10px;
        }
        .ck-anexo-lista {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 12px;
          text-align: left;
        }
        .ck-anexo-item, .ck-arq-item {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          background: #fff;
          border: 1.5px solid #93c5fd;
          border-radius: 12px;
          padding: 11px 12px;
          flex-wrap: wrap;
        }
        .ck-anexo-ic {
          font-size: 24px;
          flex: none;
          line-height: 1;
        }
        .ck-anexo-info {
          flex: 1;
          min-width: 220px;
        }
        .ck-anexo-info b {
          display: block;
          color: #000;
          font-size: 14px;
          font-weight: 800;
          word-break: break-all;
          line-height: 1.35;
        }
        .ck-anexo-info span {
          display: block;
          font-size: 12.5px;
          color: #374151;
          font-weight: 700;
          line-height: 1.5;
          margin-top: 2px;
        }
        .ck-anexo-info span.titulo-arq {
          color: #000;
          font-size: 13.5px;
        }
        .ck-anexo-acoes {
          display: flex;
          gap: 6px;
          flex: none;
          flex-wrap: wrap;
        }
        .ck-anexo-acoes a, .ck-anexo-acoes button {
          border-radius: 8px;
          padding: 8px 11px;
          font-size: 12px;
          font-weight: 800;
          border: 1.5px solid #2563eb;
          background: #eff6ff;
          color: #1e40af;
          text-decoration: none;
          cursor: pointer;
          font-family: inherit;
        }
        .ck-anexo-acoes button.del {
          border-color: #fca5a5;
          background: #fef2f2;
          color: #991b1b;
        }
        .ck-stats-anex {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 10px;
          margin: 14px 0;
        }
        @media(max-width: 900px) {
          .ck-stats-anex {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media(max-width: 520px) {
          .ck-stats-anex {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .ck-filtros-anex {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 10px;
          margin: 14px 0;
        }
        @media(max-width: 760px) {
          .ck-filtros-anex {
            grid-template-columns: 1fr;
          }
        }
        .ck-arq-lista {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ck-toast {
          position: fixed;
          left: 50%;
          bottom: 24px;
          transform: translateX(-50%);
          background: #111;
          color: #fff;
          padding: 12px 22px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 700;
          z-index: 60;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          max-width: 92vw;
          text-align: center;
          animation: ckToastFade 0.3s ease-in-out;
        }
        @keyframes ckToastFade {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @media print {
          .noprint, .ck-tabs, .ck-btn-row, .ck-breadcrumb, .ck-alert-banner, .ck-mark-btns, .ck-anexos-box {
            display: none !important;
          }
          .ck-card {
            box-shadow: none !important;
            break-inside: avoid;
            border: 1px solid #ccc;
          }
        }
      `}</style>

      <div className="max-w-5xl w-full mx-auto px-4 py-4">
        {/* Breadcrumb & Voltar */}
        <div className="ck-breadcrumb flex items-center justify-between gap-4 mb-4 mt-1">
          <div className="text-[13px] font-semibold text-[#374151] flex items-center gap-2">
            <Link
              to="/seguranca"
              className="hover:underline flex items-center gap-1 text-[#111827] font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              Segurança
            </Link>
            <span>›</span>
            <span className="text-[#111] font-extrabold">Check List</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
              <Cloud className="w-3.5 h-3.5 text-amber-600" />
              Banco Supabase Conectado
            </span>
          </div>
        </div>

        {/* Header Title */}
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#111] mb-2">
          ✅ Check List
        </h1>
        <p className="text-[#111827] font-medium mb-5 leading-relaxed max-w-4xl text-sm md:text-base">
          Crie <b>modelos de checklist</b> com os itens que quiser, <b>execute</b> um checklist marcando
          cada item como <b>Conforme</b>, <b>Não conforme</b> ou <b>Não se aplica</b> — item{' '}
          <b>Não conforme</b> pede <b>foto + observação</b> e gera <b>automaticamente uma pendência</b>. O{' '}
          <b>histórico</b> mostra a <b>% de conformidade</b> de cada execução e o{' '}
          <b>relatório automático</b> traz a conformidade geral e por modelo.
        </p>

        {/* Alerta de sincronização */}
        <div className="ck-alert-banner bg-[#fffbeb] border border-[#fde68a] border-l-4 border-l-[#f59e0b] rounded-xl p-3.5 mb-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <b className="text-[#92400e] text-sm block">Segurança do Trabalho — Hydro Reabilitação</b>
            <p className="text-xs md:text-sm text-[#111] font-semibold mt-0.5 leading-snug">
              Os modelos, execuções, pendências e anexos ficam salvos e sincronizados em tempo real no{' '}
              <b>Supabase</b> com suporte a cache local para funcionamento rápido e offline.
            </p>
          </div>
        </div>

        {/* Tabs de navegação */}
        <div className="ck-tabs noprint">
          <button
            type="button"
            className={`ck-tabbtn ${abaAtiva === 'principal' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('principal')}
          >
            ✅ Check Lists
          </button>
          <button
            type="button"
            className={`ck-tabbtn ${abaAtiva === 'anexos' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('anexos')}
          >
            📎 Anexar Check List Preenchido{' '}
            {store.anexos.length > 0 && `(${store.anexos.length})`}
          </button>
        </div>

        {abaAtiva === 'principal' ? (
          <>
            {/* ===== 1) CRIAR MODELO ===== */}
            <section className="ck-card" id="secModelo">
              <h2>📋 1 — Criar modelo de checklist</h2>
              <p className="hint">
                Dê um nome ao checklist e adicione os itens que devem ser verificados. Depois de salvar, o
                modelo aparece na lista abaixo e fica disponível para execução.
              </p>

              <div className="ck-grid2">
                <div>
                  <label className="ck-label" htmlFor="nomeModelo">
                    NOME DO CHECKLIST *
                  </label>
                  <input
                    id="nomeModelo"
                    className={`ck-input ${nomeModeloInvalido ? 'ck-invalid-campo' : ''}`}
                    placeholder="Ex.: Checklist Diário de EPI (exemplo — apague e escreva o seu)"
                    value={nomeModelo}
                    onChange={(e) => {
                      setNomeModelo(e.target.value)
                      if (nomeModeloInvalido) setNomeModeloInvalido(false)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        document.getElementById('novoItem')?.focus()
                      }
                    }}
                  />

                  <label className="ck-label" htmlFor="novoItem">
                    ADICIONAR ITEM AO MODELO
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="novoItem"
                      className={`ck-input ${novoItemInvalido ? 'ck-invalid-campo' : ''}`}
                      placeholder="Ex.: Capacete com jugular em uso (exemplo)"
                      value={novoItemTexto}
                      onChange={(e) => {
                        setNovoItemTexto(e.target.value)
                        if (novoItemInvalido) setNovoItemInvalido(false)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          adicionarItemRascunho()
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="ck-btn ck-btn-dark shrink-0"
                      onClick={adicionarItemRascunho}
                    >
                      + Adicionar
                    </button>
                  </div>

                  <div className="mt-3.5" id="listaItensRascunho">
                    {!rascunhoItens.length ? (
                      <div className="ck-empty text-xs md:text-sm">
                        Nenhum item adicionado ainda.
                        <br />
                        Digite um item acima e clique em <b>+ Adicionar</b>.
                      </div>
                    ) : (
                      rascunhoItens.map((it, i) => (
                        <div key={i} className="ck-item-row">
                          <span>
                            {i + 1}. {it}
                          </span>
                          <button
                            type="button"
                            className="rm"
                            onClick={() => removerItemRascunho(i)}
                          >
                            ✕ Remover
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {modeloFeedback && (
                    <div className={`ck-feedback ${modeloFeedback.tipo}`}>
                      {modeloFeedback.msg}
                    </div>
                  )}

                  <div className="flex gap-2.5 mt-3.5 flex-wrap">
                    <button
                      type="button"
                      className="ck-btn ck-btn-yellow"
                      onClick={salvarModelo}
                    >
                      💾 Salvar modelo
                    </button>
                    <button
                      type="button"
                      className="ck-btn ck-btn-ghost"
                      onClick={limparModelo}
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                <div>
                  <label className="ck-label">MODELOS SALVOS</label>
                  <div className="space-y-3">
                    {!store.modelos.length ? (
                      <div className="ck-empty">
                        Nenhum modelo criado ainda.
                        <br />
                        Crie o primeiro modelo ao lado.
                      </div>
                    ) : (
                      store.modelos.map((m) => (
                        <div key={m.uid} className="ck-modelo">
                          <div className="flex justify-between gap-2.5 items-start flex-wrap">
                            <div>
                              <h3>📋 {m.nome}</h3>
                              <p>
                                {m.itens.length} item(ns) • Criado em {m.criadoEm}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="ck-btn ck-btn-red text-xs py-1.5 px-3"
                              onClick={() => excluirModelo(m.uid)}
                            >
                              Excluir
                            </button>
                          </div>
                          <ul>
                            {m.itens.map((it) => (
                              <li key={it.uid}>
                                <b>{it.texto}</b>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* ===== 2) EXECUTAR CHECKLIST ===== */}
            <section className="ck-card" id="secExecucao">
              <h2>▶️ 2 — Executar checklist</h2>
              <p className="hint">
                Escolha o modelo, preencha data, executor e local e marque cada item. Item{' '}
                <b>Não conforme</b> exige <b>foto + observação</b> para salvar.
              </p>

              <div className="ck-grid3">
                <div>
                  <label className="ck-label" htmlFor="selModelo">
                    MODELO *
                  </label>
                  <select
                    id="selModelo"
                    className={`ck-select ${invalidExecCampos.modelo ? 'ck-invalid-campo' : ''}`}
                    value={selModeloUid}
                    onChange={(e) => {
                      setSelModeloUid(e.target.value)
                      setExecDraft({})
                      if (invalidExecCampos.modelo) {
                        setInvalidExecCampos((prev) => ({ ...prev, modelo: false }))
                      }
                    }}
                  >
                    <option value="">Selecione um modelo...</option>
                    {store.modelos.map((m) => (
                      <option key={m.uid} value={m.uid}>
                        {m.nome} ({m.itens.length} itens)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="ck-label" htmlFor="execData">
                    DATA DA EXECUÇÃO *
                  </label>
                  <input
                    type="date"
                    id="execData"
                    className={`ck-input ${invalidExecCampos.data ? 'ck-invalid-campo' : ''}`}
                    value={execData}
                    onChange={(e) => {
                      setExecData(e.target.value)
                      if (invalidExecCampos.data) {
                        setInvalidExecCampos((prev) => ({ ...prev, data: false }))
                      }
                    }}
                  />
                </div>

                {/* Executor com busca no RH */}
                <div className="relative" ref={executorBoxRef}>
                  <label className="ck-label" htmlFor="execExecutor">
                    EXECUTOR *
                  </label>
                  <div className="relative">
                    <input
                      id="execExecutor"
                      className={`ck-input pr-10 ${
                        invalidExecCampos.executor ? 'ck-invalid-campo' : ''
                      }`}
                      placeholder="Nome de quem executou o checklist"
                      value={execExecutor}
                      onFocus={() => setExecutorDropdownOpen(true)}
                      onChange={(e) => {
                        setExecExecutor(e.target.value)
                        setExecutorDropdownOpen(true)
                        if (invalidExecCampos.executor) {
                          setInvalidExecCampos((prev) => ({ ...prev, executor: false }))
                        }
                      }}
                    />
                    <div
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer"
                      onClick={() => setExecutorDropdownOpen(!executorDropdownOpen)}
                    >
                      <Search className="w-4 h-4" />
                    </div>
                  </div>

                  {executorDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto">
                      <div className="p-2 border-b border-gray-100 flex items-center justify-between text-xs font-bold text-gray-500 bg-gray-50">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" /> Efetivo Ativo do RH
                        </span>
                        {carregandoRH && <span>Carregando...</span>}
                      </div>
                      {colaboradoresFiltrados.length === 0 ? (
                        <div className="p-3 text-xs text-gray-500 text-center font-medium">
                          Nenhum colaborador encontrado com esse nome. Digite livremente.
                        </div>
                      ) : (
                        colaboradoresFiltrados.map((c) => (
                          <div
                            key={c.id}
                            className="px-3 py-2 text-sm hover:bg-amber-50 cursor-pointer border-b border-gray-50 flex items-center justify-between transition-colors"
                            onClick={() => {
                              setExecExecutor(c.nome)
                              setExecutorDropdownOpen(false)
                              if (invalidExecCampos.executor) {
                                setInvalidExecCampos((prev) => ({ ...prev, executor: false }))
                              }
                            }}
                          >
                            <div>
                              <span className="font-bold text-gray-900 block leading-snug">
                                {c.nome}
                              </span>
                              <span className="text-xs text-gray-500 font-medium">
                                {c.cargo} {c.matricula ? `• Matr.: ${c.matricula}` : ''}
                              </span>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                              RH
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="ck-grid2">
                <div>
                  <label className="ck-label" htmlFor="execLocal">
                    LOCAL / FRENTE DE OBRA *
                  </label>
                  <input
                    id="execLocal"
                    className={`ck-input ${invalidExecCampos.local ? 'ck-invalid-campo' : ''}`}
                    placeholder="Ex.: Canteiro — Bloco A"
                    value={execLocal}
                    onChange={(e) => {
                      setExecLocal(e.target.value)
                      if (invalidExecCampos.local) {
                        setInvalidExecCampos((prev) => ({ ...prev, local: false }))
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="ck-label" htmlFor="execObs">
                    OBSERVAÇÃO GERAL (OPCIONAL)
                  </label>
                  <input
                    id="execObs"
                    className="ck-input"
                    placeholder="Observação geral da execução, se houver"
                    value={execObs}
                    onChange={(e) => setExecObs(e.target.value)}
                  />
                </div>
              </div>

              {/* Itens do Checklist */}
              <div className="mt-4" id="areaItensExec">
                {!modeloSelecionado ? (
                  <div className="ck-empty">
                    Selecione um modelo acima para ver os itens do checklist aqui.
                  </div>
                ) : (
                  <div>
                    <label className="ck-label">
                      ITENS DO CHECKLIST — {modeloSelecionado.nome.toUpperCase()}
                    </label>
                    <div className="space-y-3 mt-2">
                      {modeloSelecionado.itens.map((it, i) => {
                        const d = execDraft[it.uid] || { status: '', obs: '', foto: '' }
                        const isNC = d.status === 'NC'

                        return (
                          <div
                            key={it.uid}
                            className={`ck-exec-item ${isNC ? 'nc' : ''}`}
                            data-item={it.uid}
                          >
                            <div className="q">
                              {i + 1}. {it.texto}
                            </div>
                            <div className="ck-mark-btns">
                              <button
                                type="button"
                                className={d.status === 'C' ? 'on-c' : ''}
                                onClick={() => marcarItem(it.uid, 'C')}
                              >
                                ✅ Conforme
                              </button>
                              <button
                                type="button"
                                className={d.status === 'NC' ? 'on-nc' : ''}
                                onClick={() => marcarItem(it.uid, 'NC')}
                              >
                                ❌ Não conforme
                              </button>
                              <button
                                type="button"
                                className={d.status === 'NA' ? 'on-na' : ''}
                                onClick={() => marcarItem(it.uid, 'NA')}
                              >
                                ➖ Não se aplica
                              </button>
                            </div>

                            {/* Extra para NC */}
                            <div className={`ck-nc-extra ${isNC ? 'show' : ''}`}>
                              <label className="ck-label">OBSERVAÇÃO DO ITEM NÃO CONFORME *</label>
                              <textarea
                                className="ck-textarea"
                                placeholder="Descreva o que foi encontrado de errado neste item..."
                                value={d.obs}
                                onChange={(e) => handleObsItem(it.uid, e.target.value)}
                              />

                              <label className="ck-label" style={{ marginTop: '12px' }}>
                                FOTO DO ITEM NÃO CONFORME *
                              </label>
                              <label
                                className={`ck-photo ${d.foto ? 'has' : ''}`}
                                htmlFor={`foto-${it.uid}`}
                              >
                                <input
                                  type="file"
                                  id={`foto-${it.uid}`}
                                  accept="image/*"
                                  capture="environment"
                                  onChange={(e) => handleFotoItem(e, it.uid)}
                                />
                                {d.foto ? (
                                  <img
                                    src={d.foto}
                                    alt="Foto do item"
                                    className="max-h-[200px] w-full object-cover rounded-xl"
                                  />
                                ) : (
                                  <span className="ph-txt">
                                    📷 <b>Clique para tirar / enviar a foto</b>
                                    <br />
                                    A foto é obrigatória para item Não conforme.
                                  </span>
                                )}
                              </label>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {execFeedback && (
                <div className={`ck-feedback ${execFeedback.tipo}`}>{execFeedback.msg}</div>
              )}

              <div className="flex gap-2.5 mt-3.5 flex-wrap">
                <button
                  type="button"
                  className="ck-btn ck-btn-green"
                  onClick={salvarExecucao}
                >
                  💾 Salvar execução no histórico
                </button>
                <button
                  type="button"
                  className="ck-btn ck-btn-ghost"
                  onClick={limparExecucao}
                >
                  Limpar execução
                </button>
              </div>
            </section>

            {/* ===== 3) PENDÊNCIAS ===== */}
            <section className="ck-card" id="secPendencias">
              <h2>⚠️ 3 — Pendências geradas (itens Não conforme)</h2>
              <p className="hint">
                Cada item marcado como <b>Não conforme</b> gera automaticamente uma pendência aqui. Resolva
                a pendência no campo e clique em <b>Marcar como resolvida</b>.
              </p>

              <div className="flex gap-2 flex-wrap mb-3">
                <button
                  type="button"
                  className={`ck-btn ${filtroPend === 'todas' ? 'ck-btn-dark' : 'ck-btn-ghost'}`}
                  onClick={() => setFiltroPend('todas')}
                >
                  Todas
                </button>
                <button
                  type="button"
                  className={`ck-btn ${
                    filtroPend === 'pendentes' ? 'ck-btn-dark' : 'ck-btn-ghost'
                  }`}
                  onClick={() => setFiltroPend('pendentes')}
                >
                  Pendentes
                </button>
                <button
                  type="button"
                  className={`ck-btn ${
                    filtroPend === 'resolvidas' ? 'ck-btn-dark' : 'ck-btn-ghost'
                  }`}
                  onClick={() => setFiltroPend('resolvidas')}
                >
                  Resolvidas
                </button>
              </div>

              <div className="space-y-3">
                {!todasPendencias.length ? (
                  <div className="ck-empty">
                    Nenhuma pendência gerada ainda.
                    <br />
                    Quando um item for marcado como <b>Não conforme</b> numa execução, a pendência aparece
                    aqui automaticamente.
                  </div>
                ) : !pendenciasFiltradas.length ? (
                  <div className="ck-empty">
                    Nenhuma pendência neste filtro. ({abertasCount} aberta(s) no total.)
                  </div>
                ) : (
                  pendenciasFiltradas.map((p) => {
                    const isResolvida = p.resolvida
                    return (
                      <div
                        key={p.chave}
                        className={`ck-pend ${isResolvida ? 'resolvida' : ''}`}
                      >
                        <div className="flex justify-between gap-2.5 items-start flex-wrap">
                          <div>
                            <h3>
                              ❌ {p.item.texto} &nbsp;
                              {isResolvida ? (
                                <span className="ck-badge resolvida">✅ RESOLVIDA</span>
                              ) : (
                                <span className="ck-badge pend">⏳ PENDENTE</span>
                              )}
                            </h3>
                            <p>
                              Checklist: <b>{p.modeloNome}</b> • Executado em {fmtDate(p.data)} por{' '}
                              {p.executor}
                              <br />
                              📍 {p.local}
                            </p>
                          </div>
                          {isResolvida ? (
                            <button
                              type="button"
                              className="ck-btn ck-btn-ghost text-xs py-1.5 px-3"
                              onClick={() => reabrirPendencia(p.chave)}
                            >
                              ↩️ Voltar para pendente
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="ck-btn ck-btn-green text-xs py-1.5 px-3"
                              onClick={() => resolverPendencia(p.chave)}
                            >
                              ✅ Marcar como resolvida
                            </button>
                          )}
                        </div>

                        <p className="mt-2 text-sm">
                          <b>Observação do executor:</b> {p.item.obs || '—'}
                        </p>

                        {p.item.foto && (
                          <img
                            src={p.item.foto}
                            alt="Foto do item não conforme"
                            className="mt-2.5 rounded-xl border border-gray-400 max-h-44 object-cover"
                          />
                        )}

                        {isResolvida && p.resolucao && (
                          <p className="mt-2 text-sm text-emerald-800 font-bold">
                            ✅ Resolvida em: {p.resolucao.em}
                          </p>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </section>

            {/* ===== 4) HISTÓRICO ===== */}
            <section className="ck-card" id="secHistorico">
              <h2>🕘 4 — Histórico de checklists executados</h2>
              <p className="hint">
                {store.execucoes.length
                  ? `${store.execucoes.length} execução(ões) no histórico • ${store.execucoes.reduce(
                      (s, e) => s + e.nc,
                      0
                    )} item(ns) Não conforme no total`
                  : 'Nenhuma execução registrada ainda.'}
              </p>

              <div className="space-y-4">
                {!store.execucoes.length ? (
                  <div className="ck-empty">
                    Nenhuma execução registrada ainda.
                    <br />
                    Execute um checklist na seção 2 acima e clique em Salvar execução no histórico.
                  </div>
                ) : (
                  store.execucoes.map((e) => {
                    const pctTxt =
                      e.pct === null
                        ? '— (todos os itens Não se aplica)'
                        : `${e.pct}% de conformidade`
                    const barWidth = e.pct === null ? 0 : e.pct
                    const badgeClass =
                      e.pct === null ? 'na' : e.pct >= 70 ? 'ok' : 'nc'

                    return (
                      <div key={e.uid} className="ck-exec-card">
                        <div className="flex justify-between gap-2.5 items-start flex-wrap">
                          <div>
                            <h3>
                              📋 {e.modeloNome} &nbsp;
                              <span className={`ck-badge ${badgeClass}`}>{pctTxt}</span>
                            </h3>
                            <p>
                              📅 {fmtDate(e.data)} • 👷 Executor: {e.executor} • 📍 {e.local}
                              <br />
                              ✅ {e.conf} conforme • ❌ {e.nc} não conforme • ➖ {e.na} não se aplica
                              {e.obsGeral && (
                                <>
                                  <br />
                                  💬 Observação geral: {e.obsGeral}
                                </>
                              )}
                              <br />
                              <span className="text-[#374151]">Salvo em {e.salvoEm}</span>
                            </p>
                          </div>
                          <button
                            type="button"
                            className="ck-btn ck-btn-red text-xs py-1.5 px-3"
                            onClick={() => excluirExecucao(e.uid)}
                          >
                            Excluir
                          </button>
                        </div>

                        <div className="ck-progress">
                          <i style={{ width: `${barWidth}%` }}></i>
                        </div>

                        <div className="overflow-x-auto mt-2.5">
                          <table className="ck-audit">
                            <thead>
                              <tr>
                                <th>Item</th>
                                <th>Resultado</th>
                                <th>Observação</th>
                                <th>Foto</th>
                              </tr>
                            </thead>
                            <tbody>
                              {e.itens.map((it, idx) => (
                                <tr key={idx}>
                                  <td>
                                    <b>{it.texto}</b>
                                  </td>
                                  <td>
                                    {it.status === 'C' ? (
                                      <span className="ck-badge ok">✅ Conforme</span>
                                    ) : it.status === 'NC' ? (
                                      <span className="ck-badge nc">❌ Não conforme</span>
                                    ) : (
                                      <span className="ck-badge na">➖ Não se aplica</span>
                                    )}
                                  </td>
                                  <td>{it.obs || '—'}</td>
                                  <td>{it.foto ? '📷 anexada' : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </section>

            {/* ===== 5) RELATÓRIO ===== */}
            <section className="ck-card ck-relatorio" id="secRelatorio">
              <h2>📊 5 — Relatório automático</h2>
              <p className="hint">
                Atualiza sozinho a cada modelo criado, execução salva ou pendência resolvida.
              </p>

              <div className="ck-stats">
                <div className="ck-stat">
                  <b>{totalExecucoes}</b>
                  <span>Execuções</span>
                </div>
                <div className="ck-stat">
                  <b>{totalAvaliados}</b>
                  <span>Itens avaliados</span>
                </div>
                <div className="ck-stat">
                  <b>{pctGeral === null ? '—' : `${pctGeral}%`}</b>
                  <span>% Conformidade geral</span>
                </div>
                <div className="ck-stat">
                  <b>{abertasCount}</b>
                  <span>Pendências abertas</span>
                </div>
              </div>

              <div className="ck-progress">
                <i style={{ width: `${pctGeral === null ? 0 : pctGeral}%` }}></i>
              </div>

              <p className="font-bold text-[#000] text-sm md:text-base">
                {pctGeral === null
                  ? 'Sem execuções ainda (ou todos os itens marcados como Não se aplica).'
                  : `${pctGeral}% de conformidade geral — ${totalConf} conforme de ${totalAvaliados} item(ns) avaliado(s) (${totalNC} não conforme • ${totalNA} não se aplica).`}
              </p>

              <div className="mt-4">
                {!store.execucoes.length ? (
                  <div className="ck-empty">
                    O relatório aparece aqui automaticamente assim que houver execuções salvas.
                  </div>
                ) : (
                  <>
                    <p className="text-[#000] font-semibold leading-relaxed">
                      Resumo automático: <b>{store.execucoes.length} execução(ões)</b>,{' '}
                      <b className="text-emerald-600">{totalConf} item(ns) conforme</b>,{' '}
                      <b className="text-red-600">{totalNC} não conforme</b>, {totalNA} não se aplica,{' '}
                      <b>{todasPendencias.length} pendência(s) gerada(s)</b> ({abertasCount} aberta(s) •{' '}
                      {todasPendencias.length - abertasCount} resolvida(s)).
                    </p>

                    <h3 className="mt-3.5 font-bold text-[#000] text-base">Conformidade por modelo</h3>
                    {Object.keys(porModelo).map((nome) => {
                      const pm = porModelo[nome]
                      const av = pm.conf + pm.nc
                      const pc = av ? Math.round((pm.conf / av) * 100) : null
                      return (
                        <div key={nome} className="ck-rel-item">
                          <b>{nome}</b> — {pm.exec} execução(ões) •{' '}
                          {pc === null ? '— (sem itens avaliados)' : `${pc}% de conformidade`}
                          <br />
                          <span className="text-xs md:text-sm text-gray-700">
                            {pm.conf} conforme • {pm.nc} não conforme • {pm.na} não se aplica
                          </span>
                        </div>
                      )
                    })}

                    <h3 className="mt-3.5 font-bold text-[#000] text-base">Execuções</h3>
                    {store.execucoes.map((e, i) => {
                      const ncItens = e.itens.filter((it) => it.status === 'NC')
                      return (
                        <div key={e.uid} className="ck-rel-item">
                          <b>
                            {i + 1}. {e.modeloNome}
                          </b>{' '}
                          — {e.pct === null ? '—' : `${e.pct}% de conformidade`}
                          <br />
                          <span className="text-xs md:text-sm text-gray-700">
                            {fmtDate(e.data)} • Executor: {e.executor} • Local: {e.local}
                            <br />✅ {e.conf} conforme • ❌ {e.nc} não conforme • ➖ {e.na} não se aplica
                          </span>
                          {ncItens.length > 0 && (
                            <div className="mt-1 text-xs text-red-700 font-medium">
                              Itens Não conforme:{' '}
                              {ncItens
                                .map((it) => `${it.texto} (${it.obs || 'sem observação'})`)
                                .join(' • ')}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </>
                )}
              </div>

              <div className="noprint flex gap-2.5 mt-4 flex-wrap">
                <button
                  type="button"
                  className="ck-btn ck-btn-dark"
                  onClick={imprimirRelatorio}
                >
                  🖨️ Imprimir / Salvar em PDF
                </button>
                <button
                  type="button"
                  className="ck-btn ck-btn-yellow"
                  onClick={copiarRelatorio}
                >
                  📋 Copiar relatório (texto)
                </button>
              </div>

              {relFeedback && (
                <div className={`ck-feedback ${relFeedback.tipo}`}>{relFeedback.msg}</div>
              )}
            </section>
          </>
        ) : (
          /* ===== 6) ABA ANEXOS ===== */
          <section className="ck-card" id="secAnexos">
            <button
              type="button"
              className="ck-btn ck-btn-ghost noprint mb-3.5"
              onClick={() => setAbaAtiva('principal')}
            >
              ← Voltar para a tela de checklists
            </button>

            <h2>📎 Anexar Check List Preenchido</h2>
            <p className="hint">
              Esta aba serve <b>só para anexar checklists já preenchidos e fechados</b> — arquivos prontos,
              feitos fora do sistema. Escolha <b>vários arquivos</b> de uma vez:{' '}
              <b>PDF, Excel, Word, imagens e outros</b>. Eles ficam salvos aqui para{' '}
              <b>visualizar/abrir ou baixar</b>, com a <b>data e a hora em que foram anexados</b>.
            </p>

            <div className="ck-grid3">
              <div>
                <label className="ck-label" htmlFor="anexNome">
                  NOME DO CHECKLIST (OPCIONAL)
                </label>
                <input
                  id="anexNome"
                  className="ck-input"
                  placeholder="Ex.: Checklist Diário de EPI"
                  value={anexNome}
                  onChange={(e) => setAnexNome(e.target.value)}
                />
              </div>
              <div>
                <label className="ck-label" htmlFor="anexLocal">
                  LOCAL / FRENTE (OPCIONAL)
                </label>
                <input
                  id="anexLocal"
                  className="ck-input"
                  placeholder="Ex.: Canteiro — Bloco A"
                  value={anexLocal}
                  onChange={(e) => setAnexLocal(e.target.value)}
                />
              </div>
              <div>
                <label className="ck-label" htmlFor="anexData">
                  DATA DO CHECKLIST PREENCHIDO (OPCIONAL)
                </label>
                <input
                  type="date"
                  id="anexData"
                  className="ck-input"
                  value={anexData}
                  onChange={(e) => setAnexData(e.target.value)}
                />
              </div>
            </div>

            <label className="ck-label">Arquivos do checklist preenchido</label>
            <div className="ck-anexos-box">
              <span className="ck-anexo-txt">
                📎 <b>+ Anexar checklist já preenchido e fechado</b>
                <br />
                PDF, Excel, Word, imagens e outros arquivos. Pode anexar vários de uma vez.
              </span>
              <label className="ck-anexo-btn" htmlFor="anexInput">
                📎 Escolher arquivos
              </label>
              <input
                type="file"
                id="anexInput"
                multiple
                accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.txt,.zip,.rar,image/*"
                className="hidden"
                onChange={handleAnexInput}
              />
              <p className="ck-anexo-hint">
                Os arquivos ficam salvos e sincronizados com segurança no Supabase e em cache no
                navegador.
              </p>

              {pendAnex.length > 0 && (
                <div className="ck-anexo-lista">
                  {pendAnex.map((a, i) => (
                    <div key={i} className="ck-anexo-item">
                      <span className="ck-anexo-ic">{a.icone}</span>
                      <div className="ck-anexo-info">
                        <b>{a.nome}</b>
                        <span>
                          {a.rotulo} • {fmtTam(a.tamanho)}
                        </span>
                      </div>
                      <div className="ck-anexo-acoes">
                        <button
                          type="button"
                          className="del"
                          onClick={() => {
                            setPendAnex((prev) => prev.filter((_, idx) => idx !== i))
                            showToast('Arquivo removido da seleção')
                          }}
                        >
                          ✕ Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {anexFeedback && (
              <div className={`ck-feedback ${anexFeedback.tipo}`}>{anexFeedback.msg}</div>
            )}

            <div className="flex gap-2.5 flex-wrap mt-4 noprint">
              <button
                type="button"
                className="ck-btn ck-btn-dark"
                onClick={salvarAnexos}
              >
                💾 Salvar arquivos
              </button>
              <button
                type="button"
                className="ck-btn ck-btn-ghost"
                onClick={limparAnexos}
              >
                Limpar seleção
              </button>
            </div>

            <h2 className="mt-7">🗂️ Checklists preenchidos salvos</h2>
            <p className="hint">
              Todos os checklists preenchidos arquivados, com{' '}
              <b>nome do arquivo, nome do checklist, local, data do checklist, tipo, tamanho</b> e{' '}
              <b>data e hora em que foram anexados</b>. Use <b>Visualizar / Abrir</b> para ver,{' '}
              <b>Baixar</b> para baixar uma cópia ou <b>Excluir arquivo</b> para apagar.
            </p>

            <div className="ck-stats-anex">
              <div className="ck-stat">
                <b>{store.anexos.length}</b>
                <span>Total de arquivos</span>
              </div>
              <div className="ck-stat">
                <b>{statsPorTipo['PDF']}</b>
                <span>PDF</span>
              </div>
              <div className="ck-stat">
                <b>{statsPorTipo['Excel']}</b>
                <span>Excel</span>
              </div>
              <div className="ck-stat">
                <b>{statsPorTipo['Word']}</b>
                <span>Word</span>
              </div>
              <div className="ck-stat">
                <b>{statsPorTipo['Imagem']}</b>
                <span>Imagem</span>
              </div>
              <div className="ck-stat">
                <b>{statsPorTipo['Arquivo']}</b>
                <span>Outros</span>
              </div>
            </div>

            <div className="ck-filtros-anex noprint">
              <input
                id="anexBusca"
                className="ck-input"
                placeholder="🔍 Buscar pelo nome do arquivo ou do checklist..."
                value={anexBusca}
                onChange={(e) => setAnexBusca(e.target.value)}
              />
              <select
                id="anexFiltroTipo"
                className="ck-select"
                value={anexFiltroTipo}
                onChange={(e) => setAnexFiltroTipo(e.target.value)}
              >
                <option value="todos">Todos os tipos</option>
                <option value="PDF">📕 PDF</option>
                <option value="Excel">📗 Excel</option>
                <option value="Word">📘 Word</option>
                <option value="Imagem">🖼️ Imagem</option>
                <option value="Arquivo">📄 Outros arquivos</option>
              </select>
            </div>

            <div className="ck-arq-lista">
              {!store.anexos.length ? (
                <div className="ck-empty">
                  Nenhum checklist preenchido arquivado ainda.
                  <br />
                  Escolha os arquivos acima e clique em “💾 Salvar arquivos”.
                </div>
              ) : !anexosFiltrados.length ? (
                <div className="ck-empty">
                  Nenhum arquivo encontrado com esta busca / filtro.
                </div>
              ) : (
                anexosFiltrados.map((a, idx) => {
                  const t = tipoArq(a.nome, a.mime)
                  const icone = a.icone || t.icone
                  const rotulo = a.rotulo || t.rotulo
                  const quando = a.anexadoEm
                    ? `📅 Anexado em ${a.anexadoEm}`
                    : '📅 Data de anexo não registrada'

                  return (
                    <div key={idx} className="ck-arq-item">
                      <span className="ck-anexo-ic">{icone}</span>
                      <div className="ck-anexo-info">
                        <b>{a.nome}</b>
                        {a.titulo && <span className="titulo-arq">✅ {a.titulo}</span>}
                        {(a.local || a.dataChecklist) && (
                          <span>
                            {[
                              a.local ? `📍 ${a.local}` : '',
                              a.dataChecklist ? `🗓️ Data do checklist: ${fmtDate(a.dataChecklist)}` : '',
                            ]
                              .filter(Boolean)
                              .join(' • ')}
                          </span>
                        )}
                        <span>
                          {rotulo} • {fmtTam(a.tamanho)}
                        </span>
                        <span>{quando}</span>
                      </div>
                      <div className="ck-anexo-acoes">
                        {a.dataUrl ? (
                          <>
                            <a href={a.dataUrl} target="_blank" rel="noopener noreferrer">
                              👁️ Visualizar / Abrir
                            </a>
                            <a href={a.dataUrl} download={a.nome} target="_blank" rel="noopener noreferrer">
                              ⬇️ Baixar
                            </a>
                          </>
                        ) : (
                          <span className="text-xs font-bold text-gray-500">
                            Sem conteúdo
                          </span>
                        )}
                        <button
                          type="button"
                          className="del"
                          onClick={() => excluirAnexo(idx, a.nome)}
                        >
                          {confirmExcluirAnexo[idx]
                            ? 'Clique de novo para confirmar a exclusão'
                            : '🗑️ Excluir arquivo'}
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>
        )}

        {/* Rodapé institucional */}
        <footer className="text-[#374151] font-semibold text-xs text-center mt-7 leading-relaxed">
          Hydro Reabilitação • Sucena — Segurança › Check List • Dados sincronizados com o banco de
          dados Supabase.
        </footer>
      </div>

      {/* Toast Notification */}
      {toastMsg && <div className="ck-toast">{toastMsg}</div>}
    </div>
  )
}

