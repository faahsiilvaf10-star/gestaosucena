import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  type NaoConformidadeItem,
  type ClassificacaoNC,
  type StatusNC,
  CLASSIFICACOES_NC,
  STATUS_NC_LISTA,
  hojeISO,
  fmtData,
  contarPorCampo,
  gerarTextoRelatorioNC,
  carregarNCs,
  salvarNCs,
  getDbKeyNC,
} from '../../lib/naoConformidadeData'
import {
  type ColaboradorRH,
  carregarColaboradoresAtivosRH,
  comprimirImagem,
} from '../../lib/planoAcaoData'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, CheckCircle2, Cloud, Search, Users, AlertTriangle } from 'lucide-react'

export const Route = createFileRoute('/seguranca/nao-conformidade')({
  component: NaoConformidadeComponent,
})

export function NaoConformidadeComponent() {
  const [ncs, setNcs] = useState<NaoConformidadeItem[]>([])
  const [carregando, setCarregando] = useState(true)

  // Filtros
  const [buscaTexto, setBuscaTexto] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('')
  const [filtroClassif, setFiltroClassif] = useState<string>('')

  // Colaboradores RH
  const [colaboradoresRH, setColaboradoresRH] = useState<ColaboradorRH[]>([])
  const [carregandoRH, setCarregandoRH] = useState(true)
  const [responsavelDropdownOpen, setResponsavelDropdownOpen] = useState(false)
  const responsavelBoxRef = useRef<HTMLDivElement>(null)

  // Form states
  const [numero, setNumero] = useState('')
  const [data, setData] = useState(() => hojeISO())
  const [local, setLocal] = useState('')
  const [norma, setNorma] = useState('')
  const [descricao, setDescricao] = useState('')
  const [fotoData, setFotoData] = useState('')
  const [classificacao, setClassificacao] = useState<ClassificacaoNC | ''>('')
  const [prazo, setPrazo] = useState('')
  const [causa, setCausa] = useState('')
  const [acao, setAcao] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [responsavelCargo, setResponsavelCargo] = useState('')
  const [status, setStatus] = useState<StatusNC>('Aberta')

  // Feedback states
  const [feedbackForm, setFeedbackForm] = useState<{
    tipo: 'ok' | 'erro'
    msg: string
  } | null>(null)
  const [invalidCampos, setInvalidCampos] = useState<Record<string, boolean>>({})

  // Verificação de eficácia por card: cardId -> { open: boolean, eficaz: 'sim' | 'nao' | null, obs: string, feedback?: { tipo: 'ok' | 'erro' | 'info'; msg: string } }
  const [verifEstados, setVerifEstados] = useState<
    Record<
      string,
      {
        open: boolean
        eficaz: 'sim' | 'nao' | null
        obs: string
        feedback?: { tipo: 'ok' | 'erro' | 'info'; msg: string }
      }
    >
  >({})

  // Exclusão em 2 passos
  const [confirmExcluir, setConfirmExcluir] = useState<Record<string, boolean>>({})

  // Toast & feedback relatório
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [feedbackRel, setFeedbackRel] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? null : curr))
    }, 3200)
  }

  // Fechar dropdown de responsável ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        responsavelBoxRef.current &&
        !responsavelBoxRef.current.contains(e.target as Node)
      ) {
        setResponsavelDropdownOpen(false)
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
        const [dadosNCs, listaRH] = await Promise.all([
          carregarNCs(),
          carregarColaboradoresAtivosRH(),
        ])
        if (isMounted) {
          setNcs(dadosNCs)
          setColaboradoresRH(listaRH)
        }
      } catch (err) {
        console.error('[NC] Erro ao carregar dados:', err)
      } finally {
        if (isMounted) {
          setCarregando(false)
          setCarregandoRH(false)
        }
      }
    }

    carregar()

    // Realtime subscription no Supabase global_settings
    const dbKey = getDbKeyNC()
    const canal = supabase
      .channel('realtime_nao_conformidade')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'global_settings',
          filter: `key=eq.${dbKey}`,
        },
        (payload: any) => {
          if (payload.new && payload.new.value && Array.isArray(payload.new.value)) {
            setNcs(payload.new.value as NaoConformidadeItem[])
          }
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(canal)
    }
  }, [])

  // Limpar formulário
  const limparForm = () => {
    setNumero('')
    setData(hojeISO())
    setLocal('')
    setNorma('')
    setDescricao('')
    setFotoData('')
    setClassificacao('')
    setPrazo('')
    setCausa('')
    setAcao('')
    setResponsavel('')
    setResponsavelCargo('')
    setStatus('Aberta')
    setInvalidCampos({})
    setFeedbackForm(null)
  }

  // Manipular anexo de foto
  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type || !file.type.startsWith('image/')) {
      setFeedbackForm({
        tipo: 'erro',
        msg: 'O arquivo escolhido não é uma imagem. Escolha uma foto (JPG, PNG ou similar).',
      })
      e.target.value = ''
      return
    }

    try {
      const base64 = await comprimirImagem(file, 900, 0.75)
      setFotoData(base64)
    } catch {
      const reader = new FileReader()
      reader.onload = () => {
        setFotoData(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removerFoto = () => {
    setFotoData('')
  }

  // Salvar nova NC
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const vNumero = numero.trim()
    const vLocal = local.trim()
    const vNorma = norma.trim()
    const vDescricao = descricao.trim()
    const vCausa = causa.trim()
    const vAcao = acao.trim()
    const vResponsavel = responsavel.trim()

    const novosInvalidos: Record<string, boolean> = {}
    const faltando: string[] = []

    if (!vNumero) {
      faltando.push('Nº da NC')
      novosInvalidos.numero = true
    }
    if (!data) {
      faltando.push('Data')
      novosInvalidos.data = true
    }
    if (!vLocal) {
      faltando.push('Local')
      novosInvalidos.local = true
    }
    if (!vDescricao) {
      faltando.push('Descrição da não conformidade')
      novosInvalidos.descricao = true
    }
    if (!classificacao) {
      faltando.push('Classificação')
      novosInvalidos.classificacao = true
    }
    if (!prazo) {
      faltando.push('Prazo para correção')
      novosInvalidos.prazo = true
    }
    if (!vResponsavel) {
      faltando.push('Responsável pela correção')
      novosInvalidos.responsavel = true
    }

    if (ncs.some((n) => n.numero.toLowerCase() === vNumero.toLowerCase())) {
      setInvalidCampos({ numero: true })
      setFeedbackForm({
        tipo: 'erro',
        msg: `Já existe uma NC com o número “${vNumero}”. Use outro número.`,
      })
      return
    }

    if (faltando.length > 0) {
      setInvalidCampos(novosInvalidos)
      setFeedbackForm({
        tipo: 'erro',
        msg: `Preencha os campos obrigatórios antes de salvar:\n• ${faltando.join('\n• ')}`,
      })
      return
    }

    if (prazo && data && prazo < data) {
      setInvalidCampos({ prazo: true })
      setFeedbackForm({
        tipo: 'erro',
        msg: 'O prazo para correção não pode ser anterior à data da NC.',
      })
      return
    }

    const novaNC: NaoConformidadeItem = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      numero: vNumero,
      data,
      local: vLocal,
      norma: vNorma,
      descricao: vDescricao,
      foto: fotoData || undefined,
      classificacao: classificacao as ClassificacaoNC,
      prazo,
      causa: vCausa || undefined,
      acao: vAcao || undefined,
      responsavel: vResponsavel,
      responsavelCargo: responsavelCargo || undefined,
      status,
      verificacao: null,
      criadoEm: hojeISO(),
    }

    const atualizados = [novaNC, ...ncs]
    setNcs(atualizados)
    limparForm()

    const ok = await salvarNCs(atualizados)
    if (ok) {
      setFeedbackForm({
        tipo: 'ok',
        msg: `Não conformidade ${novaNC.numero} salva com status “${novaNC.status}”. Ela já aparece no histórico e no relatório abaixo.`,
      })
      showToast(`NC ${novaNC.numero} salva com sucesso no banco de dados.`)
    } else {
      setFeedbackForm({
        tipo: 'ok',
        msg: `Não conformidade ${novaNC.numero} salva localmente (offline). Sincronizará quando a conexão retornar.`,
      })
      showToast(`NC ${novaNC.numero} salva localmente.`)
    }
  }

  // Mudar status simples (ex.: para 'Em tratamento')
  const handleMudarStatus = async (id: string, novoStatus: StatusNC) => {
    const atualizados = ncs.map((n) => (n.id === id ? { ...n, status: novoStatus } : n))
    setNcs(atualizados)
    await salvarNCs(atualizados)
    showToast(`NC colocada em ${novoStatus}.`)
  }

  // Excluir NC
  const handleExcluir = async (id: string, numeroNC: string) => {
    if (!confirmExcluir[id]) {
      setConfirmExcluir((prev) => ({ ...prev, [id]: true }))
      setTimeout(() => {
        setConfirmExcluir((prev) => ({ ...prev, [id]: false }))
      }, 4000)
      return
    }

    const atualizados = ncs.filter((n) => n.id !== id)
    setNcs(atualizados)
    await salvarNCs(atualizados)
    showToast(`NC ${numeroNC} excluída com sucesso.`)
  }

  // Toggle drawer de verificação
  const toggleVerifDrawer = (id: string) => {
    setVerifEstados((prev) => {
      const atual = prev[id]
      const novoOpen = !atual?.open
      const resets: Record<string, any> = {}
      Object.keys(prev).forEach((k) => {
        resets[k] = { ...prev[k], open: false }
      })
      resets[id] = {
        open: novoOpen,
        eficaz: null,
        obs: atual?.obs || '',
        feedback: undefined,
      }
      return resets
    })
  }

  // Confirmar verificação de eficácia
  const handleSalvarVerificacao = async (id: string) => {
    const estado = verifEstados[id]
    const targetNC = ncs.find((n) => n.id === id)
    if (!targetNC) return

    if (!estado || !estado.eficaz) {
      setVerifEstados((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          feedback: {
            tipo: 'erro',
            msg: 'Escolha se a ação corretiva foi eficaz (Sim) ou não (Não) antes de salvar a verificação.',
          },
        },
      }))
      return
    }

    const obsTrim = (estado.obs || '').trim()
    if (!obsTrim) {
      setVerifEstados((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          feedback: {
            tipo: 'erro',
            msg: 'Preencha a observação da verificação (o que foi conferido e o resultado).',
          },
        },
      }))
      return
    }

    const novoStatus: StatusNC = estado.eficaz === 'sim' ? 'Fechada' : 'Em tratamento'
    const atualizados = ncs.map((n) =>
      n.id === id
        ? {
            ...n,
            status: novoStatus,
            verificacao: {
              eficaz: estado.eficaz as 'sim' | 'nao',
              obs: obsTrim,
              data: hojeISO(),
            },
          }
        : n
    )

    setNcs(atualizados)
    await salvarNCs(atualizados)

    const msgSucesso =
      estado.eficaz === 'sim'
        ? `Verificação registrada: ação eficaz. NC ${targetNC.numero} FECHADA.`
        : `Verificação registrada: ação NÃO eficaz. NC ${targetNC.numero} voltou para EM TRATAMENTO — é preciso nova ação corretiva.`

    setVerifEstados((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        feedback: {
          tipo: estado.eficaz === 'sim' ? 'ok' : 'info',
          msg: msgSucesso,
        },
      },
    }))

    showToast(`Verificação da NC ${targetNC.numero} registrada.`)

    setTimeout(() => {
      setVerifEstados((prev) => ({
        ...prev,
        [id]: { ...prev[id], open: false },
      }))
    }, 1500)
  }

  // Lista filtrada
  const ncsFiltradas = useMemo(() => {
    const q = buscaTexto.toLowerCase().trim()
    return ncs.filter((n) => {
      if (filtroStatus && n.status !== filtroStatus) return false
      if (filtroClassif && n.classificacao !== filtroClassif) return false
      if (q) {
        const alvo = [n.numero, n.local, n.norma, n.responsavel, n.descricao]
          .join(' ')
          .toLowerCase()
        if (!alvo.includes(q)) return false
      }
      return true
    })
  }, [ncs, buscaTexto, filtroStatus, filtroClassif])

  // Colaboradores RH filtrados para o dropdown
  const colaboradoresFiltrados = useMemo(() => {
    const q = responsavel.toLowerCase().trim()
    if (!q) return colaboradoresRH.slice(0, 10)
    return colaboradoresRH
      .filter((c) => c.nome.toLowerCase().includes(q) || c.cargo.toLowerCase().includes(q))
      .slice(0, 15)
  }, [colaboradoresRH, responsavel])

  // Dados do relatório
  const totalNCs = ncs.length
  const porStatus = useMemo(() => contarPorCampo(ncs, 'status'), [ncs])
  const porClassif = useMemo(() => contarPorCampo(ncs, 'classificacao'), [ncs])
  const fechadas = porStatus['Fechada'] || 0
  const abertasTratamento = (porStatus['Aberta'] || 0) + (porStatus['Em tratamento'] || 0)
  const verificadas = porStatus['Verificada'] || 0
  const pctFechadas = totalNCs ? Math.round((fechadas / totalNCs) * 100) : 0

  const handleCopiarRelatorio = () => {
    const texto = gerarTextoRelatorioNC(ncs)
    const ok = () => {
      setFeedbackRel({
        tipo: 'ok',
        msg: 'Relatório copiado como texto. Cole onde precisar (documento, e-mail ou mensagem).',
      })
      showToast('Relatório copiado com sucesso!')
    }
    const erro = () => {
      setFeedbackRel({
        tipo: 'erro',
        msg: 'Não foi possível copiar automaticamente neste navegador. Selecione o texto e copie com Ctrl+C.',
      })
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(ok, erro)
    } else {
      const ta = document.createElement('textarea')
      ta.value = texto
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        ok()
      } catch {
        erro()
      }
      document.body.removeChild(ta)
    }
  }

  return (
    <div className="nc-container flex flex-col h-full overflow-y-auto pb-24 bg-white text-[#111827]">
      <style>{`
        .nc-container {
          font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        }
        .nc-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 22px;
          padding: 20px 22px;
          box-shadow: 0 8px 30px rgba(0,0,0,.05);
          margin-bottom: 18px;
        }
        .nc-card h2 {
          font-size: 24px;
          font-weight: 800;
          color: #000;
          margin-bottom: 4px;
        }
        .nc-card .hint {
          color: #111827;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.55;
          margin-bottom: 14px;
        }
        .nc-label {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: .03em;
          color: #000;
          display: block;
          margin: 14px 0 6px;
        }
        .nc-input, .nc-select, .nc-textarea {
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
        .nc-textarea {
          resize: vertical;
          min-height: 86px;
        }
        .nc-input:focus, .nc-select:focus, .nc-textarea:focus {
          border-color: #f5c518;
          box-shadow: 0 0 0 3px #fef3c7;
        }
        .nc-input::placeholder, .nc-textarea::placeholder {
          color: #374151 !important;
          opacity: 1;
          font-weight: 600;
        }
        .nc-grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0 16px;
        }
        .nc-grid3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 0 16px;
        }
        @media(max-width: 760px) {
          .nc-grid2, .nc-grid3 {
            grid-template-columns: 1fr;
          }
        }
        .nc-btn {
          border: 0;
          border-radius: 12px;
          padding: 13px 20px;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .nc-btn-yellow {
          background: #f5c518;
          color: #111;
        }
        .nc-btn-yellow:hover {
          background: #eab308;
        }
        .nc-btn-dark {
          background: #111;
          color: #fff;
        }
        .nc-btn-dark:hover {
          background: #27272a;
        }
        .nc-btn-ghost {
          background: #fff;
          border: 1.5px solid #9ca3af;
          color: #111;
        }
        .nc-btn-ghost:hover {
          background: #f3f4f6;
        }
        .nc-btn-green {
          background: #16a34a;
          color: #fff;
        }
        .nc-btn-green:hover {
          background: #15803d;
        }
        .nc-btn-red {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }
        .nc-btn-red:hover {
          background: #fee2e2;
        }
        .nc-btn-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 18px;
        }
        .nc-feedback {
          border-radius: 14px;
          padding: 14px 16px;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.55;
          margin-top: 14px;
          white-space: pre-line;
        }
        .nc-feedback.erro {
          background: #fef2f2;
          border: 2px solid #dc2626;
          color: #991b1b;
        }
        .nc-feedback.ok {
          background: #f0fdf4;
          border: 2px solid #16a34a;
          color: #14532d;
        }
        .nc-feedback.info {
          background: #fffbeb;
          border: 2px solid #f59e0b;
          color: #92400e;
        }
        .nc-invalid-campo {
          border: 2.5px solid #dc2626 !important;
          background: #fef2f2 !important;
        }
        .nc-classif {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .nc-classif button {
          border: 1.5px solid #111;
          background: #fff;
          color: #000;
          font-weight: 800;
          border-radius: 999px;
          padding: 11px 6px;
          font-size: 14px;
          cursor: pointer;
        }
        .nc-classif button.on-menor {
          background: #f59e0b;
          border-color: #f59e0b;
          color: #fff;
        }
        .nc-classif button.on-maior {
          background: #ea580c;
          border-color: #ea580c;
          color: #fff;
        }
        .nc-classif button.on-critica {
          background: #dc2626;
          border-color: #dc2626;
          color: #fff;
        }
        .nc-photo {
          border: 2px dashed #6b7280;
          border-radius: 14px;
          padding: 14px;
          text-align: center;
          background: #fff;
          cursor: pointer;
          display: block;
          margin: 0;
        }
        .nc-photo:hover {
          border-color: #f5c518;
          background: #fffbeb;
        }
        .nc-lock-note {
          border: 1.5px solid #fde68a;
          background: #fffbeb;
          border-radius: 12px;
          padding: 11px 13px;
          font-size: 13.5px;
          font-weight: 600;
          color: #111827;
          line-height: 1.55;
          margin-top: 12px;
        }
        .nc-filters {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 12px 0;
        }
        .nc-filters button {
          border: 1.5px solid #111827;
          background: #fff;
          color: #000;
          font-weight: 800;
          border-radius: 999px;
          padding: 8px 14px;
          cursor: pointer;
        }
        .nc-filters button.on {
          background: #111827;
          color: #fff;
        }
        .nc-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin: 14px 0;
        }
        @media(max-width: 640px) {
          .nc-stats {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .nc-stat {
          background: #f9fafb;
          border: 1.5px solid #e5e7eb;
          border-radius: 14px;
          padding: 14px;
          text-align: center;
        }
        .nc-stat b {
          font-size: 26px;
          display: block;
          color: #000;
        }
        .nc-stat span {
          font-size: 11px;
          color: #111;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .05em;
        }
        .nc-badge {
          display: inline-flex !important;
          width: auto !important;
          max-width: max-content !important;
          align-items: center;
          font-weight: 800;
          font-size: 11px;
          padding: 6px 9px;
          border-radius: 999px;
          letter-spacing: .04em;
          text-transform: uppercase;
        }
        .nc-badge.aberta {
          background: #fee2e2;
          color: #991b1b;
        }
        .nc-badge.tratamento {
          background: #fef3c7;
          color: #92400e;
        }
        .nc-badge.verificada {
          background: #dbeafe;
          color: #1e40af;
        }
        .nc-badge.fechada {
          background: #dcfce7;
          color: #166534;
        }
        .nc-badge.menor {
          background: #fef3c7;
          color: #92400e;
        }
        .nc-badge.maior {
          background: #ffedd5;
          color: #9a3412;
        }
        .nc-badge.critica {
          background: #dc2626;
          color: #fff;
        }
        .nc-card-item {
          border: 2px solid #e5e7eb;
          border-left: 8px solid #f59e0b;
          border-radius: 18px;
          padding: 16px;
          margin-bottom: 14px;
          background: #fff;
        }
        .nc-card-item.fechada {
          border-color: #bbf7d0;
          border-left-color: #16a34a;
          background: #f0fdf4;
        }
        .nc-card-item.critica {
          border-color: #fecaca;
          border-left-color: #dc2626;
        }
        .nc-card-item h3 {
          font-size: 17px;
          font-weight: 800;
          color: #000;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }
        .nc-card-item p {
          color: #111827;
          font-size: 14px;
          line-height: 1.55;
          margin-top: 6px;
          font-weight: 600;
        }
        .nc-meta {
          font-size: 13px;
          color: #111827;
          font-weight: 600;
          margin-top: 7px;
          line-height: 1.7;
        }
        .nc-foto-box {
          border: 1.5px solid #9ca3af;
          border-radius: 14px;
          padding: 10px;
          background: #fff;
          margin-top: 12px;
          max-width: 420px;
        }
        .nc-foto-box b {
          font-size: 12px;
          letter-spacing: .05em;
          text-transform: uppercase;
          color: #000;
          display: block;
          margin-bottom: 8px;
        }
        .nc-foto-box img {
          width: 100%;
          max-height: 220px;
          object-fit: cover;
          border-radius: 10px;
          display: block;
        }
        .nc-verif {
          border: 1.5px solid #bfdbfe;
          background: #eff6ff;
          border-radius: 14px;
          padding: 14px;
          margin-top: 12px;
        }
        .nc-verif h4 {
          color: #000;
          font-size: 15px;
          font-weight: 800;
          margin-bottom: 4px;
        }
        .nc-verif p {
          font-size: 13px;
          color: #111827;
          font-weight: 600;
          line-height: 1.5;
        }
        .nc-verif .eficaz {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 10px 0;
        }
        .nc-verif .eficaz button {
          border: 1.5px solid #111;
          background: #fff;
          color: #000;
          font-weight: 800;
          border-radius: 999px;
          padding: 9px 18px;
          cursor: pointer;
        }
        .nc-verif .eficaz button.on-sim {
          background: #16a34a;
          border-color: #16a34a;
          color: #fff;
        }
        .nc-verif .eficaz button.on-nao {
          background: #dc2626;
          border-color: #dc2626;
          color: #fff;
        }
        .nc-note {
          border-radius: 12px;
          padding: 11px 13px;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.55;
          margin-top: 12px;
          background: #f0fdf4;
          border: 1.5px solid #86efac;
          color: #14532d;
        }
        .nc-note.warn {
          background: #fffbeb;
          border-color: #fcd34d;
          color: #92400e;
        }
        .nc-relatorio {
          border: 2px solid #111827;
          border-radius: 20px;
          padding: 22px;
          background: #fff;
        }
        .nc-relatorio h2 {
          font-size: 24px;
          font-weight: 800;
          color: #000;
        }
        .nc-progress {
          height: 16px;
          background: #e5e7eb;
          border-radius: 999px;
          overflow: hidden;
          margin: 12px 0;
        }
        .nc-progress i {
          display: block;
          height: 100%;
          background: #16a34a;
          transition: width .4s ease-in-out;
        }
        .nc-rel-item {
          border-top: 1px solid #e5e7eb;
          padding: 12px 0;
        }
        .nc-rel-item b {
          color: #000;
        }
        .nc-rel-item p {
          color: #111827;
          font-weight: 600;
          font-size: 14px;
          line-height: 1.6;
          margin-top: 4px;
        }
        .nc-empty {
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
        .nc-toast {
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
          animation: ncToastFade 0.3s ease-in-out;
        }
        @keyframes ncToastFade {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @media print {
          .noprint, .nc-filters, .nc-btn-row, .nc-breadcrumb, .nc-alert-banner {
            display: none !important;
          }
          .nc-card {
            box-shadow: none !important;
            break-inside: avoid;
            border: 1px solid #ccc;
          }
        }
      `}</style>

      <div className="max-w-5xl w-full mx-auto px-4 py-4">
        {/* Breadcrumb & Voltar */}
        <div className="nc-breadcrumb flex items-center justify-between gap-4 mb-4 mt-1">
          <div className="text-[13px] font-semibold text-[#374151] flex items-center gap-2">
            <Link
              to="/seguranca"
              className="hover:underline flex items-center gap-1 text-[#111827] font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              Segurança
            </Link>
            <span>›</span>
            <span className="text-[#111] font-extrabold">Relatório de Não Conformidade</span>
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
          📋 Relatório de Não Conformidade
        </h1>
        <p className="text-[#111827] font-medium mb-5 leading-relaxed max-w-4xl text-sm md:text-base">
          Registre a <b>não conformidade</b>, a <b>causa raiz</b> e a <b>ação corretiva</b>, com{' '}
          <b>responsável</b> e <b>prazo</b>. A NC só é <b>Fechada</b> depois da{' '}
          <b>verificação da eficácia</b> da ação corretiva — se a ação não foi eficaz, a NC volta para{' '}
          <b>Em tratamento</b>.
        </p>

        {/* Alerta de sincronização */}
        <div className="nc-alert-banner bg-[#fffbeb] border border-[#fde68a] border-l-4 border-l-[#f59e0b] rounded-xl p-3.5 mb-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <b className="text-[#92400e] text-sm block">Segurança do Trabalho — Hydro Reabilitação</b>
            <p className="text-xs md:text-sm text-[#111] font-semibold mt-0.5 leading-snug">
              Os registros são salvos com sincronização em tempo real no <b>Supabase</b> e armazenados
              em cache local para acesso rápido e garantia offline.
            </p>
          </div>
        </div>

        {/* ===== FORMULÁRIO NOVA NC ===== */}
        <section className="nc-card" id="novaNc">
          <h2>Nova Não Conformidade</h2>
          <p className="hint">
            Preencha os campos obrigatórios (*). A classificação define a prioridade do tratamento. O status
            inicial é <b>Aberta</b> — o status <b>Fechada</b> só aparece depois da verificação da eficácia.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="nc-grid3">
              <div>
                <label className="nc-label" htmlFor="fNumero">
                  Nº da NC *
                </label>
                <input
                  id="fNumero"
                  className={`nc-input ${invalidCampos.numero ? 'nc-invalid-campo' : ''}`}
                  placeholder="Ex.: NC-2026-001"
                  value={numero}
                  onChange={(e) => {
                    setNumero(e.target.value)
                    if (invalidCampos.numero) {
                      setInvalidCampos((prev) => ({ ...prev, numero: false }))
                    }
                  }}
                />
              </div>

              <div>
                <label className="nc-label" htmlFor="fData">
                  Data *
                </label>
                <input
                  id="fData"
                  type="date"
                  className={`nc-input ${invalidCampos.data ? 'nc-invalid-campo' : ''}`}
                  value={data}
                  onChange={(e) => {
                    setData(e.target.value)
                    if (invalidCampos.data) {
                      setInvalidCampos((prev) => ({ ...prev, data: false }))
                    }
                  }}
                />
              </div>

              <div>
                <label className="nc-label" htmlFor="fLocal">
                  Local *
                </label>
                <input
                  id="fLocal"
                  className={`nc-input ${invalidCampos.local ? 'nc-invalid-campo' : ''}`}
                  placeholder="Ex.: Canteiro — Bloco A, 2º pavimento"
                  value={local}
                  onChange={(e) => {
                    setLocal(e.target.value)
                    if (invalidCampos.local) {
                      setInvalidCampos((prev) => ({ ...prev, local: false }))
                    }
                  }}
                />
              </div>
            </div>

            <div>
              <label className="nc-label" htmlFor="fNorma">
                Norma / requisito não atendido
              </label>
              <input
                id="fNorma"
                className="nc-input"
                placeholder="Ex.: NR-35, item 35.5.1 — trabalho em altura"
                value={norma}
                onChange={(e) => setNorma(e.target.value)}
              />
            </div>

            <div>
              <label className="nc-label" htmlFor="fDescricao">
                Descrição da não conformidade *
              </label>
              <textarea
                id="fDescricao"
                className={`nc-textarea ${invalidCampos.descricao ? 'nc-invalid-campo' : ''}`}
                placeholder="Descreva o que foi encontrado, onde e em que condição."
                value={descricao}
                onChange={(e) => {
                  setDescricao(e.target.value)
                  if (invalidCampos.descricao) {
                    setInvalidCampos((prev) => ({ ...prev, descricao: false }))
                  }
                }}
              />
            </div>

            <div>
              <label className="nc-label">Evidência / foto</label>
              <label
                className={`nc-photo ${fotoData ? 'has' : ''}`}
                htmlFor="fFoto"
              >
                <input
                  type="file"
                  id="fFoto"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFotoChange}
                />
                {fotoData ? (
                  <div className="w-full flex flex-col items-center">
                    <img
                      src={fotoData}
                      alt="Prévia da evidência"
                      className="max-h-[220px] w-full object-cover rounded-xl"
                    />
                  </div>
                ) : (
                  <div className="py-4">
                    <b className="text-sm text-[#000] block mb-1">📷 Anexar evidência / foto</b>
                    <span className="text-xs text-[#374151] font-semibold">
                      Clique para escolher uma imagem do desvio ou da não conformidade.
                    </span>
                  </div>
                )}
              </label>

              {fotoData && (
                <div className="nc-btn-row mt-2">
                  <button
                    type="button"
                    className="nc-btn nc-btn-ghost text-xs py-2 px-3"
                    onClick={removerFoto}
                  >
                    Remover foto
                  </button>
                </div>
              )}
            </div>

            <div className="nc-grid2">
              <div>
                <label className="nc-label">Classificação *</label>
                <div className="nc-classif">
                  <button
                    type="button"
                    className={classificacao === 'Menor' ? 'on-menor' : ''}
                    onClick={() => {
                      setClassificacao('Menor')
                      if (invalidCampos.classificacao) {
                        setInvalidCampos((prev) => ({ ...prev, classificacao: false }))
                      }
                    }}
                  >
                    Menor
                  </button>
                  <button
                    type="button"
                    className={classificacao === 'Maior' ? 'on-maior' : ''}
                    onClick={() => {
                      setClassificacao('Maior')
                      if (invalidCampos.classificacao) {
                        setInvalidCampos((prev) => ({ ...prev, classificacao: false }))
                      }
                    }}
                  >
                    Maior
                  </button>
                  <button
                    type="button"
                    className={classificacao === 'Crítica' ? 'on-critica' : ''}
                    onClick={() => {
                      setClassificacao('Crítica')
                      if (invalidCampos.classificacao) {
                        setInvalidCampos((prev) => ({ ...prev, classificacao: false }))
                      }
                    }}
                  >
                    Crítica
                  </button>
                </div>
              </div>

              <div>
                <label className="nc-label" htmlFor="fPrazo">
                  Prazo para correção *
                </label>
                <input
                  id="fPrazo"
                  type="date"
                  className={`nc-input ${invalidCampos.prazo ? 'nc-invalid-campo' : ''}`}
                  value={prazo}
                  onChange={(e) => {
                    setPrazo(e.target.value)
                    if (invalidCampos.prazo) {
                      setInvalidCampos((prev) => ({ ...prev, prazo: false }))
                    }
                  }}
                />
              </div>
            </div>

            <div>
              <label className="nc-label" htmlFor="fCausa">
                Causa raiz
              </label>
              <textarea
                id="fCausa"
                className="nc-textarea"
                placeholder="Qual foi a causa raiz? (Ex.: falta de treinamento, procedimento desatualizado, falha de supervisão...)"
                value={causa}
                onChange={(e) => setCausa(e.target.value)}
              />
            </div>

            <div>
              <label className="nc-label" htmlFor="fAcao">
                Ação corretiva
              </label>
              <textarea
                id="fAcao"
                className="nc-textarea"
                placeholder="O que será feito para corrigir a não conformidade e evitar que se repita?"
                value={acao}
                onChange={(e) => setAcao(e.target.value)}
              />
            </div>

            <div className="nc-grid2">
              {/* Responsável com autocomplete RH */}
              <div className="relative" ref={responsavelBoxRef}>
                <label className="nc-label" htmlFor="fResponsavel">
                  Responsável pela correção *
                </label>
                <div className="relative">
                  <input
                    id="fResponsavel"
                    className={`nc-input pr-10 ${invalidCampos.responsavel ? 'nc-invalid-campo' : ''}`}
                    placeholder="Nome do responsável (busque no RH)"
                    value={responsavel}
                    onFocus={() => setResponsavelDropdownOpen(true)}
                    onChange={(e) => {
                      setResponsavel(e.target.value)
                      setResponsavelDropdownOpen(true)
                      if (invalidCampos.responsavel) {
                        setInvalidCampos((prev) => ({ ...prev, responsavel: false }))
                      }
                    }}
                  />
                  <div
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer"
                    onClick={() => setResponsavelDropdownOpen(!responsavelDropdownOpen)}
                  >
                    <Search className="w-4 h-4" />
                  </div>
                </div>

                {responsavelCargo && (
                  <p className="text-xs text-amber-700 font-bold mt-1">
                    Cargo: {responsavelCargo}
                  </p>
                )}

                {/* Dropdown de sugestões do RH */}
                {responsavelDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto">
                    <div className="p-2 border-b border-gray-100 flex items-center justify-between text-xs font-bold text-gray-500 bg-gray-50">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> Efetivo Ativo do RH
                      </span>
                      {carregandoRH && <span>Carregando...</span>}
                    </div>
                    {colaboradoresFiltrados.length === 0 ? (
                      <div className="p-3 text-xs text-gray-500 text-center font-medium">
                        Nenhum colaborador encontrado com esse nome. Você pode digitar manualmente.
                      </div>
                    ) : (
                      colaboradoresFiltrados.map((c) => (
                        <div
                          key={c.id}
                          className="px-3 py-2 text-sm hover:bg-amber-50 cursor-pointer border-b border-gray-50 flex items-center justify-between transition-colors"
                          onClick={() => {
                            setResponsavel(c.nome)
                            setResponsavelCargo(c.cargo)
                            setResponsavelDropdownOpen(false)
                            if (invalidCampos.responsavel) {
                              setInvalidCampos((prev) => ({ ...prev, responsavel: false }))
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

              <div>
                <label className="nc-label" htmlFor="fStatus">
                  Status inicial
                </label>
                <select
                  id="fStatus"
                  className="nc-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StatusNC)}
                >
                  <option value="Aberta">Aberta</option>
                  <option value="Em tratamento">Em tratamento</option>
                  <option value="Verificada">Verificada</option>
                </select>
                <p className="text-[12.5px] text-[#374151] font-semibold mt-1.5 leading-relaxed">
                  “Fechada” não aparece aqui: uma NC só fecha após a verificação da eficácia, no histórico
                  abaixo.
                </p>
              </div>
            </div>

            <div className="nc-lock-note">
              <b>🔒 Regra de fechamento:</b> para uma NC virar <b>Fechada</b> é preciso registrar a{' '}
              <b>verificação da eficácia</b> (eficaz: sim ou não + observação). Se a ação <b>não foi eficaz</b>, a
              NC volta automaticamente para <b>Em tratamento</b>.
            </div>

            <div className="nc-btn-row">
              <button type="submit" className="nc-btn nc-btn-yellow">
                💾 Salvar Não Conformidade
              </button>
              <button type="button" className="nc-btn nc-btn-ghost" onClick={limparForm}>
                Limpar formulário
              </button>
            </div>

            {feedbackForm && (
              <div className={`nc-feedback ${feedbackForm.tipo}`} role="alert">
                {feedbackForm.msg}
              </div>
            )}
          </form>
        </section>

        {/* ===== HISTÓRICO DE NÃO CONFORMIDADES ===== */}
        <section className="nc-card" id="historico">
          <h2>Histórico de Não Conformidades</h2>
          <p className="hint">
            Todas as NCs registradas. Use os filtros por status e classificação, ou busque por número, local,
            norma ou responsável.
          </p>

          <div className="flex gap-2.5 flex-wrap items-center">
            <input
              id="buscaNc"
              className="nc-input flex-1 min-w-[220px]"
              placeholder="Buscar por nº, local, norma, responsável..."
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
            />
            <select
              id="filtroClassif"
              className="nc-select w-auto min-w-[170px]"
              value={filtroClassif}
              onChange={(e) => setFiltroClassif(e.target.value)}
            >
              <option value="">Todas as classificações</option>
              <option value="Menor">Menor</option>
              <option value="Maior">Maior</option>
              <option value="Crítica">Crítica</option>
            </select>
          </div>

          <div className="nc-filters">
            <button
              type="button"
              className={filtroStatus === '' ? 'on' : ''}
              onClick={() => setFiltroStatus('')}
            >
              Todas
            </button>
            <button
              type="button"
              className={filtroStatus === 'Aberta' ? 'on' : ''}
              onClick={() => setFiltroStatus('Aberta')}
            >
              Abertas
            </button>
            <button
              type="button"
              className={filtroStatus === 'Em tratamento' ? 'on' : ''}
              onClick={() => setFiltroStatus('Em tratamento')}
            >
              Em tratamento
            </button>
            <button
              type="button"
              className={filtroStatus === 'Verificada' ? 'on' : ''}
              onClick={() => setFiltroStatus('Verificada')}
            >
              Verificadas
            </button>
            <button
              type="button"
              className={filtroStatus === 'Fechada' ? 'on' : ''}
              onClick={() => setFiltroStatus('Fechada')}
            >
              Fechadas
            </button>
          </div>

          <div className="mt-4">
            {carregando ? (
              <div className="nc-empty">Carregando não conformidades...</div>
            ) : ncsFiltradas.length === 0 ? (
              <div className="nc-empty">
                Nenhuma não conformidade encontrada com esses filtros.
                <br />
                Registre a primeira NC no formulário acima — os campos começam em branco para preencher.
              </div>
            ) : (
              ncsFiltradas.map((n) => {
                const isFechada = n.status === 'Fechada'
                const isCritica = n.classificacao === 'Crítica'
                const cardClass = isFechada ? 'fechada' : isCritica ? 'critica' : ''
                const vEstado = verifEstados[n.id] || { open: false, eficaz: null, obs: '' }

                const badgeClassifCls =
                  n.classificacao === 'Menor'
                    ? 'menor'
                    : n.classificacao === 'Maior'
                      ? 'maior'
                      : 'critica'

                const badgeStatusCls =
                  n.status === 'Aberta'
                    ? 'aberta'
                    : n.status === 'Em tratamento'
                      ? 'tratamento'
                      : n.status === 'Verificada'
                        ? 'verificada'
                        : 'fechada'

                return (
                  <article key={n.id} className={`nc-card-item ${cardClass}`}>
                    <h3>
                      <span>{n.numero}</span>
                      <span className={`nc-badge ${badgeClassifCls}`}>{n.classificacao}</span>
                      <span className={`nc-badge ${badgeStatusCls}`}>{n.status}</span>
                    </h3>

                    <div className="nc-meta">
                      📅 Data: <b>{fmtData(n.data)}</b> &nbsp;•&nbsp; 📍 Local: <b>{n.local}</b>{' '}
                      &nbsp;•&nbsp; ⏰ Prazo: <b>{fmtData(n.prazo)}</b>
                      <br />
                      👤 Responsável: <b>{n.responsavel}</b>{' '}
                      {n.responsavelCargo && `(${n.responsavelCargo})`} &nbsp;•&nbsp; 📏 Norma / requisito:{' '}
                      <b>{n.norma || '—'}</b>
                    </div>

                    <p>
                      <b>Descrição:</b> {n.descricao}
                    </p>
                    {n.causa && (
                      <p>
                        <b>Causa raiz:</b> {n.causa}
                      </p>
                    )}
                    {n.acao && (
                      <p>
                        <b>Ação corretiva:</b> {n.acao}
                      </p>
                    )}

                    {n.foto && (
                      <div className="nc-foto-box">
                        <b>📷 Evidência / foto</b>
                        <img src={n.foto} alt={`Evidência da NC ${n.numero}`} />
                      </div>
                    )}

                    {n.verificacao && (
                      <div className={`nc-note ${n.verificacao.eficaz === 'sim' ? '' : 'warn'}`}>
                        <b>Verificação da eficácia ({fmtData(n.verificacao.data)}):</b>{' '}
                        {n.verificacao.eficaz === 'sim'
                          ? 'ação eficaz — NC fechada.'
                          : 'ação NÃO eficaz — NC voltou para Em tratamento.'}
                        {n.verificacao.obs && (
                          <>
                            <br />
                            Observação: {n.verificacao.obs}
                          </>
                        )}
                      </div>
                    )}

                    {/* Botões de Ação */}
                    <div className="nc-btn-row">
                      {n.status !== 'Fechada' && (
                        <>
                          <button
                            type="button"
                            className="nc-btn nc-btn-dark"
                            onClick={() => toggleVerifDrawer(n.id)}
                          >
                            ✔️ Verificar eficácia
                          </button>
                          {n.status !== 'Em tratamento' && (
                            <button
                              type="button"
                              className="nc-btn nc-btn-ghost"
                              onClick={() => handleMudarStatus(n.id, 'Em tratamento')}
                            >
                              Em tratamento
                            </button>
                          )}
                        </>
                      )}

                      <button
                        type="button"
                        className="nc-btn nc-btn-red"
                        onClick={() => handleExcluir(n.id, n.numero)}
                      >
                        {confirmExcluir[n.id] ? '⚠️ Confirmar exclusão?' : '🗑️ Excluir'}
                      </button>
                    </div>

                    {/* Drawer Verificação da Eficácia */}
                    {vEstado.open && (
                      <div className="nc-verif">
                        <h4>✔️ Verificação da eficácia</h4>
                        <p>
                          A NC só fecha se a ação corretiva foi <b>eficaz</b>. Se não foi eficaz, ela volta para{' '}
                          <b>Em tratamento</b> para nova ação.
                        </p>

                        <div className="eficaz">
                          <button
                            type="button"
                            className={vEstado.eficaz === 'sim' ? 'on-sim' : ''}
                            onClick={() =>
                              setVerifEstados((prev) => ({
                                ...prev,
                                [n.id]: { ...prev[n.id], eficaz: 'sim' },
                              }))
                            }
                          >
                            ✅ Sim, foi eficaz
                          </button>
                          <button
                            type="button"
                            className={vEstado.eficaz === 'nao' ? 'on-nao' : ''}
                            onClick={() =>
                              setVerifEstados((prev) => ({
                                ...prev,
                                [n.id]: { ...prev[n.id], eficaz: 'nao' },
                              }))
                            }
                          >
                            ❌ Não, não foi eficaz
                          </button>
                        </div>

                        <label className="nc-label" style={{ marginTop: '10px' }}>
                          Observação da verificação *
                        </label>
                        <textarea
                          className="nc-textarea"
                          placeholder="Ex.: ação conferida em campo em 30/10/2026; o problema não se repetiu."
                          value={vEstado.obs}
                          onChange={(e) => {
                            const val = e.target.value
                            setVerifEstados((prev) => ({
                              ...prev,
                              [n.id]: { ...prev[n.id], obs: val },
                            }))
                          }}
                        />

                        <div className="nc-btn-row">
                          <button
                            type="button"
                            className="nc-btn nc-btn-green"
                            onClick={() => handleSalvarVerificacao(n.id)}
                          >
                            Salvar verificação
                          </button>
                          <button
                            type="button"
                            className="nc-btn nc-btn-ghost"
                            onClick={() => toggleVerifDrawer(n.id)}
                          >
                            Cancelar
                          </button>
                        </div>

                        {vEstado.feedback && (
                          <div className={`nc-feedback ${vEstado.feedback.tipo}`} style={{ marginTop: '10px' }}>
                            {vEstado.feedback.msg}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                )
              })
            )}
          </div>
        </section>

        {/* ===== RELATÓRIO AUTOMÁTICO ===== */}
        <section className="nc-card" id="relatorioSec">
          <div className="nc-relatorio" id="relatorioBox">
            <h2>📊 Relatório automático — Não Conformidades</h2>
            <p className="text-[#111827] font-semibold text-sm mt-1.5" id="relData">
              Gerado em {new Date().toLocaleDateString('pt-BR')} às{' '}
              {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — atualiza
              automaticamente a cada registro.
            </p>

            <div className="nc-stats">
              <div className="nc-stat">
                <b>{totalNCs}</b>
                <span>Total de NCs</span>
              </div>
              <div className="nc-stat">
                <b>{abertasTratamento}</b>
                <span>Abertas / em tratamento</span>
              </div>
              <div className="nc-stat">
                <b>{verificadas}</b>
                <span>Verificadas</span>
              </div>
              <div className="nc-stat">
                <b>{fechadas}</b>
                <span>Fechadas</span>
              </div>
            </div>

            <div className="nc-progress">
              <i style={{ width: `${pctFechadas}%` }}></i>
            </div>
            <p className="text-sm font-bold text-[#000]">{pctFechadas}% das NCs fechadas</p>

            <div className="mt-4">
              {totalNCs === 0 ? (
                <div className="nc-rel-item">
                  <p>
                    Nenhuma NC registrada ainda. O relatório será preenchido automaticamente quando a
                    primeira não conformidade for salva.
                  </p>
                </div>
              ) : (
                <>
                  <div className="nc-rel-item">
                    <b>Por classificação</b>
                    <p>
                      {CLASSIFICACOES_NC.map((c) => (
                        <span key={c} className="mr-4">
                          {c}: <b>{porClassif[c] || 0}</b>
                        </span>
                      ))}
                    </p>
                  </div>

                  <div className="nc-rel-item">
                    <b>Por status</b>
                    <p>
                      {STATUS_NC_LISTA.map((s) => (
                        <span key={s} className="mr-4">
                          {s}: <b>{porStatus[s] || 0}</b>
                        </span>
                      ))}
                    </p>
                  </div>

                  <div className="nc-rel-item">
                    <b>Lista de NCs</b>
                    <div className="mt-1 space-y-1">
                      {ncs.map((n) => (
                        <p key={n.id} className="text-xs md:text-sm">
                          • <b>{n.numero}</b> — {n.classificacao} — {n.status} — {fmtData(n.data)} —{' '}
                          {n.local} — Resp.: {n.responsavel} — Prazo: {fmtData(n.prazo)}
                        </p>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="nc-btn-row noprint">
            <button
              type="button"
              className="nc-btn nc-btn-dark"
              onClick={() => window.print()}
            >
              🖨️ Imprimir / Salvar em PDF
            </button>
            <button
              type="button"
              className="nc-btn nc-btn-yellow"
              onClick={handleCopiarRelatorio}
            >
              📋 Copiar relatório (texto)
            </button>
          </div>

          {feedbackRel && (
            <div className={`nc-feedback ${feedbackRel.tipo}`} role="status">
              {feedbackRel.msg}
            </div>
          )}
        </section>

        {/* Rodapé institucional */}
        <footer className="text-[#374151] font-semibold text-xs text-center mt-7 leading-relaxed">
          Hydro Reabilitação — Sucena • Segurança • Relatório de Não Conformidade • Sincronizado com
          banco de dados Supabase.
        </footer>
      </div>

      {/* Toast Notification */}
      {toastMsg && <div className="nc-toast">{toastMsg}</div>}
    </div>
  )
}

