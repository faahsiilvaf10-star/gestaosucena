import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  type AnaliseRiscoItem,
  carregarAnalisesRisco,
  salvarAnalisesRisco,
  diasAteValidade,
  fmtValidade,
  fmtAnexadoEm,
  fmtTamanho,
  tipoAnexo,
} from '../../lib/analiseRiscoData'
import { supabase } from '../../lib/supabase'
import { isAdmin } from '../../components/ui/VerifiedBadge'
import {
  ArrowLeft,
  Cloud,
  ShieldAlert,
  Calendar,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Eye,
  Download,
  Trash2,
  X,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/seguranca/analise-risco')({
  component: AnaliseRiscoComponent,
})

export function AnaliseRiscoComponent() {
  const [analises, setAnalises] = useState<AnaliseRiscoItem[]>([])
  const [carregando, setCarregando] = useState(true)

  // Formulário de anexos
  const [atividadeLocal, setAtividadeLocal] = useState('')
  const [statusAr, setStatusAr] = useState<'Em aberto' | 'Fechada'>('Em aberto')
  const [validaAte, setValidaAte] = useState('')
  const [pendentes, setPendentes] = useState<
    {
      nome: string
      mime: string
      rotulo: string
      icone: string
      tamanho: number
      dataUrl: string
      titulo: string
    }[]
  >([])

  // Validação e feedback
  const [invalidValidade, setInvalidValidade] = useState(false)
  const [invalidTitulos, setInvalidTitulos] = useState<Record<number, boolean>>({})
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [confirmExcluir, setConfirmExcluir] = useState<Record<string, boolean>>({})

  // Modal de fechamento (Técnico de Segurança)
  const [modalFecharItem, setModalFecharItem] = useState<AnaliseRiscoItem | null>(null)
  const [obsFechamento, setObsFechamento] = useState('')

  // Filtros e busca
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todas')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Identificação do usuário logado
  const currentUserName =
    typeof window !== 'undefined' ? localStorage.getItem('sucena_user_name') || '' : ''
  const currentUserRole =
    typeof window !== 'undefined' ? localStorage.getItem('sucena_user_role') || '' : ''

  const isTecnicoSeguranca = useMemo(() => {
    const roleLower = currentUserRole.toLowerCase()
    return (
      isAdmin(currentUserName, currentUserRole) ||
      roleLower.includes('seguran') ||
      roleLower.includes('tst') ||
      roleLower.includes('técnico') ||
      roleLower.includes('tecnico')
    )
  }, [currentUserName, currentUserRole])

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? null : curr))
    }, 2800)
  }

  // Carregar dados e escutar Realtime
  useEffect(() => {
    let isMounted = true

    const carregar = async () => {
      try {
        setCarregando(true)
        const env =
          typeof window !== 'undefined'
            ? localStorage.getItem('sucena_environment') || 'barcarena'
            : 'barcarena'
        const dados = await carregarAnalisesRisco(env)
        if (isMounted) {
          setAnalises(dados)
        }
      } catch (err) {
        console.error('[Análise de Risco] Erro ao carregar dados:', err)
      } finally {
        if (isMounted) {
          setCarregando(false)
        }
      }
    }

    carregar()

    const sub = supabase
      .channel('analise_risco_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_settings' }, () => {
        carregar()
      })
      .subscribe()

    return () => {
      isMounted = false
      sub.unsubscribe()
    }
  }, [])

  // Seleção de múltiplos arquivos
  const handleArquivosSelecionados = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    let pendentesCont = files.length
    const novos: typeof pendentes = []

    files.forEach((f) => {
      const t = tipoAnexo(f.name, f.type)
      const r = new FileReader()
      r.onload = (ev) => {
        novos.push({
          nome: f.name,
          mime: f.type || '',
          rotulo: t.rotulo,
          icone: t.icone,
          tamanho: f.size,
          dataUrl: String(ev.target?.result || ''),
          titulo: '',
        })
        pendentesCont--
        if (pendentesCont <= 0) {
          setPendentes((prev) => [...prev, ...novos])
          showToast(`📎 ${files.length} arquivo(s) escolhido(s) — preencha o Título de cada um`)
        }
      }
      r.onerror = () => {
        pendentesCont--
        showToast(`Não foi possível ler o arquivo: ${f.name}`)
      }
      r.readAsDataURL(f)
    })

    if (e.target) e.target.value = ''
  }

  const removerPendente = (idx: number) => {
    setPendentes((prev) => prev.filter((_, i) => i !== idx))
    showToast('Arquivo removido da seleção')
  }

  const handleTituloPendenteChange = (idx: number, valor: string) => {
    setPendentes((prev) => {
      const copy = [...prev]
      if (copy[idx]) copy[idx].titulo = valor
      return copy
    })
    setInvalidTitulos((prev) => ({ ...prev, [idx]: false }))
  }

  // Salvar novos anexos de análise de risco
  const salvarAnexos = async () => {
    setFeedback(null)
    setInvalidValidade(false)
    setInvalidTitulos({})

    if (!pendentes.length) {
      setFeedback({
        tipo: 'erro',
        msg: '⚠️ NADA PARA SALVAR — clique em “📎 Escolher arquivos” e escolha pelo menos 1 análise de risco já pronta antes de salvar.',
      })
      return
    }

    const faltaValidade = statusAr === 'Em aberto' && !validaAte
    const faltamTitulosIndices: number[] = []
    const novInvalidos: Record<number, boolean> = {}

    pendentes.forEach((p, i) => {
      if (!p.titulo.trim()) {
        faltamTitulosIndices.push(i)
        novInvalidos[i] = true
      }
    })

    if (faltaValidade || faltamTitulosIndices.length > 0) {
      if (faltaValidade) setInvalidValidade(true)
      if (faltamTitulosIndices.length > 0) setInvalidTitulos(novInvalidos)

      const partes: string[] = []
      if (faltaValidade) {
        partes.push(
          'a data VÁLIDA ATÉ é obrigatória quando a análise está Em aberto — escolha no campo destacado em vermelho até quando ela está válida'
        )
      }
      if (faltamTitulosIndices.length > 0) {
        partes.push(
          `o Título é obrigatório em cada anexo — falta preencher o Título de ${
            faltamTitulosIndices.length
          } arquivo(s): ${faltamTitulosIndices.map((i) => pendentes[i].nome).join(' • ')}`
        )
      }

      setFeedback({
        tipo: 'erro',
        msg: `⚠️ NÃO SALVOU — ${partes.join('.\n')}.\nCorrija o que está destacado em vermelho e clique em Salvar de novo.`,
      })
      return
    }

    const env =
      typeof window !== 'undefined'
        ? localStorage.getItem('sucena_environment') || 'barcarena'
        : 'barcarena'
    const quando = fmtAnexadoEm(new Date())

    const novosItens: AnaliseRiscoItem[] = pendentes.map((p) => ({
      id: `ar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      nome: p.nome,
      mime: p.mime,
      rotulo: p.rotulo,
      icone: p.icone,
      tamanho: p.tamanho,
      dataUrl: p.dataUrl,
      anexadoEm: quando,
      titulo: p.titulo.trim(),
      atividadeLocal: atividadeLocal.trim() || undefined,
      status: statusAr,
      validaAte: statusAr === 'Em aberto' ? validaAte : undefined,
    }))

    const listaCompleta = [...novosItens, ...analises]
    setAnalises(listaCompleta)
    setPendentes([])
    setAtividadeLocal('')
    setStatusAr('Em aberto')
    setValidaAte('')

    const ok = await salvarAnalisesRisco(listaCompleta, env)

    setFeedback({
      tipo: 'ok',
      msg: `✅ ${novosItens.length} ANÁLISE(S) DE RISCO SALVA(S)!\nArquivadas em ${quando} com status “${statusAr}”${
        statusAr === 'Em aberto' ? ` — válida até ${fmtValidade(validaAte)}` : ''
      } e já aparecem na lista abaixo, para visualizar/abrir ou baixar.${
        ok ? ' Sincronizado no Supabase.' : '\n(Salvo no armazenamento local deste aparelho)'
      }`,
    })
    showToast(`📎 ${novosItens.length} análise(s) salva(s) — anexadas em ${quando}`)
  }

  const limparSelecao = () => {
    setPendentes([])
    setAtividadeLocal('')
    setStatusAr('Em aberto')
    setValidaAte('')
    setInvalidValidade(false)
    setInvalidTitulos({})
    setFeedback(null)
  }

  // Excluir análise arquivada
  const excluirItem = async (id: string, nome: string) => {
    if (!confirmExcluir[id]) {
      setConfirmExcluir({ [id]: true })
      setTimeout(() => {
        setConfirmExcluir((curr) => ({ ...curr, [id]: false }))
      }, 4000)
      return
    }

    const env =
      typeof window !== 'undefined'
        ? localStorage.getItem('sucena_environment') || 'barcarena'
        : 'barcarena'

    const listaAtualizada = analises.filter((a) => a.id !== id)
    setAnalises(listaAtualizada)
    setConfirmExcluir((curr) => ({ ...curr, [id]: false }))

    await salvarAnalisesRisco(listaAtualizada, env)
    showToast(`Arquivo excluído: ${nome}`)
  }

  // Fechar Análise de Risco (Apenas Técnico de Segurança)
  const abrirModalFechar = (item: AnaliseRiscoItem) => {
    if (!isTecnicoSeguranca) {
      toast.error('Apenas o cargo de Técnico de Segurança pode fechar uma Análise de Risco.')
      return
    }
    setModalFecharItem(item)
    setObsFechamento('Substituída por nova Análise de Risco elaborada.')
  }

  const confirmarFechamento = async () => {
    if (!modalFecharItem) return
    const env =
      typeof window !== 'undefined'
        ? localStorage.getItem('sucena_environment') || 'barcarena'
        : 'barcarena'
    const quando = fmtAnexadoEm(new Date())

    const listaAtualizada = analises.map((a) => {
      if (a.id === modalFecharItem.id) {
        return {
          ...a,
          status: 'Fechada' as const,
          fechadaEm: quando,
          fechadaPor: currentUserName || 'Técnico de Segurança',
          fechadaObs: obsFechamento.trim() || 'Fechada pelo Técnico de Segurança',
        }
      }
      return a
    })

    setAnalises(listaAtualizada)
    await salvarAnalisesRisco(listaAtualizada, env)
    showToast(`🔒 Análise "${modalFecharItem.titulo}" marcada como FECHADA`)
    setModalFecharItem(null)
  }

  // Estatísticas
  const stats = useMemo(() => {
    const porTipo: Record<string, number> = {
      PDF: 0,
      Excel: 0,
      Word: 0,
      Imagem: 0,
      Arquivo: 0,
    }
    let abertas = 0
    let fechadas = 0

    analises.forEach((a) => {
      const t = tipoAnexo(a.nome, a.mime)
      const r = a.rotulo || t.rotulo
      const chave = porTipo[r] !== undefined ? r : 'Arquivo'
      porTipo[chave] = (porTipo[chave] || 0) + 1
      if (a.status === 'Fechada') fechadas++
      else abertas++
    })

    return { porTipo, abertas, fechadas, total: analises.length }
  }, [analises])

  // Filtragem
  const analisesFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return analises.filter((a) => {
      const t = tipoAnexo(a.nome, a.mime)
      const r = a.rotulo || t.rotulo
      const st = a.status === 'Fechada' ? 'Fechada' : 'Em aberto'

      if (filtroStatus !== 'todas' && st !== filtroStatus) return false
      if (filtroTipo !== 'todos' && r !== filtroTipo) return false

      if (
        q &&
        !String(a.nome || '').toLowerCase().includes(q) &&
        !String(a.titulo || '').toLowerCase().includes(q) &&
        !String(a.atividadeLocal || '').toLowerCase().includes(q)
      ) {
        return false
      }
      return true
    })
  }, [analises, busca, filtroStatus, filtroTipo])

  return (
    <div className="ar-container flex flex-col h-full overflow-y-auto pb-24 bg-white text-[#111827]">
      <style>{`
        .ar-container {
          font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        }
        .ar-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 22px;
          padding: 20px 22px;
          box-shadow: 0 8px 30px rgba(0,0,0,.05);
          margin-bottom: 18px;
        }
        .ar-card h2 {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 26px;
          color: #000;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .ar-hint {
          color: #111827;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.55;
          margin-bottom: 12px;
        }
        .ar-label {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: .03em;
          color: #000;
          display: block;
          margin: 14px 0 6px;
        }
        .ar-input, .ar-select {
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
        .ar-input:focus, .ar-select:focus {
          border-color: #f5c518;
          box-shadow: 0 0 0 3px #fef3c7;
        }
        .ar-input::placeholder {
          color: #374151 !important;
          opacity: 1;
          font-weight: 600;
        }
        .invalid-campo {
          border: 2.5px solid #dc2626 !important;
          background: #fef2f2 !important;
        }
        .ar-btn {
          border: 0;
          border-radius: 12px;
          padding: 13px 20px;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
        }
        .ar-btn-dark {
          background: #111;
          color: #fff;
        }
        .ar-btn-dark:hover {
          background: #262626;
        }
        .ar-btn-ghost {
          background: #fff;
          border: 1.5px solid #9ca3af;
          color: #111;
        }
        .ar-btn-ghost:hover {
          background: #f3f4f6;
        }
        .feedback {
          border-radius: 14px;
          padding: 14px 16px;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.55;
          margin-top: 14px;
          white-space: pre-line;
        }
        .feedback.erro {
          background: #fef2f2;
          border: 2px solid #dc2626;
          color: #991b1b;
        }
        .feedback.ok {
          background: #f0fdf4;
          border: 2px solid #16a34a;
          color: #14532d;
        }
        .ar-alert {
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-left: 6px solid #f59e0b;
          border-radius: 14px;
          padding: 14px 16px;
          margin-bottom: 18px;
        }
        .ar-alert b {
          color: #92400e;
        }
        .ar-alert p {
          font-size: 13px;
          color: #111;
          font-weight: 600;
          line-height: 1.5;
          margin-top: 3px;
        }
        .anexos-box {
          border: 2px dashed #2563eb;
          border-radius: 14px;
          padding: 16px;
          background: #eff6ff;
          margin-top: 4px;
          text-align: center;
        }
        .anexo-txt {
          color: #000;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.55;
          display: block;
        }
        .anexo-btn {
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
          transition: background 0.2s;
        }
        .anexo-btn:hover {
          background: #1d4ed8;
        }
        .anexo-hint {
          font-size: 12px;
          color: #1e3a8a;
          font-weight: 600;
          line-height: 1.5;
          margin-top: 10px;
        }
        .anexo-lista {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 12px;
          text-align: left;
        }
        .anexo-item, .arq-item {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          background: #fff;
          border: 1.5px solid #93c5fd;
          border-radius: 12px;
          padding: 11px 12px;
          flex-wrap: wrap;
        }
        .anexo-ic {
          font-size: 24px;
          flex: none;
          line-height: 1;
        }
        .anexo-info {
          flex: 1;
          min-width: 220px;
        }
        .anexo-info b {
          display: block;
          color: #000;
          font-size: 14px;
          font-weight: 800;
          word-break: break-all;
          line-height: 1.35;
        }
        .anexo-info span {
          display: block;
          font-size: 12.5px;
          color: #374151;
          font-weight: 700;
          line-height: 1.5;
          margin-top: 2px;
        }
        .anexo-info span.titulo-arq {
          color: #000;
          font-size: 16px;
          font-weight: 900;
        }
        .ar-titulo-pend {
          margin-top: 8px;
          padding: 9px 11px;
          font-size: 14px;
          width: 100%;
          border: 1.5px solid #9ca3af;
          border-radius: 10px;
          outline: 0;
          font-weight: 700;
        }
        .anexo-acoes {
          display: flex;
          gap: 6px;
          flex: none;
          flex-wrap: wrap;
          align-items: center;
        }
        .anexo-acoes a, .anexo-acoes button {
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
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .anexo-acoes button.del {
          border-color: #fca5a5;
          background: #fef2f2;
          color: #991b1b;
        }
        .anexo-acoes button.fechar-btn {
          border-color: #86efac;
          background: #f0fdf4;
          color: #166534;
        }
        .anexo-acoes button.fechar-btn:hover {
          background: #dcfce7;
        }
        .badge {
          display: inline-flex;
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
        .st-aberto {
          background: #fef9c3;
          color: #854d0e;
        }
        .st-fechada {
          background: #dcfce7;
          color: #166534;
        }
        .badge.val-vencida {
          background: #fee2e2;
          color: #991b1b;
        }
        .badge.val-prazo {
          background: #fef9c3;
          color: #854d0e;
        }
        .stats-anex {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin: 14px 0;
        }
        @media(max-width: 900px) {
          .stats-anex {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .stat {
          background: #f9fafb;
          border: 1.5px solid #e5e7eb;
          border-radius: 14px;
          padding: 14px;
          text-align: center;
        }
        .stat b {
          font-size: 26px;
          display: block;
          color: #000;
          font-weight: 900;
        }
        .stat span {
          font-size: 11px;
          color: #111;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .05em;
        }
        .filtros-anex {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 10px;
          margin: 14px 0;
        }
        @media(max-width: 760px) {
          .filtros-anex {
            grid-template-columns: 1fr;
          }
        }
        .empty-box {
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
        .ar-toast {
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
          animation: arToastFade 0.3s ease-in-out;
        }
        @keyframes arToastFade {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @media print {
          .noprint, .ar-breadcrumb, .ar-alert, .anexos-box, .ar-toast {
            display: none !important;
          }
          .ar-card {
            box-shadow: none !important;
            border: 1px solid #ccc;
            break-inside: avoid;
          }
        }
      `}</style>

      <div className="max-w-5xl w-full mx-auto px-4 py-4">
        {/* Breadcrumb & Voltar */}
        <div className="ar-breadcrumb flex items-center justify-between gap-4 mb-4 mt-1">
          <div className="text-[13px] font-semibold text-[#374151] flex items-center gap-2">
            <Link
              to="/seguranca"
              className="hover:underline flex items-center gap-1 text-[#111827] font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              Segurança
            </Link>
            <span>›</span>
            <span className="text-[#111] font-extrabold">Análise de Risco</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
              <Cloud className="w-3.5 h-3.5 text-amber-600" />
              Banco Supabase Conectado
            </span>
          </div>
        </div>

        {/* Header Title */}
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#111] mb-2 flex items-center gap-3">
          <ShieldAlert className="w-9 h-9 text-[#111]" />
          Análise de Risco
        </h1>
        <p className="text-[#111827] font-medium mb-5 leading-relaxed max-w-4xl text-sm md:text-base">
          Anexe <b>todas as análises de risco já prontas</b>, <b>em aberto ou fechadas</b> — arquivos
          prontos, feitos fora do sistema. Eles ficam guardados aqui para <b>visualizar/abrir ou baixar novamente</b>,
          com <b>Título em cada anexo</b> e a <b>data e a hora em que foram anexados</b>.
        </p>

        {/* Alerta de Armazenamento e Regra de Validade */}
        <div className="ar-alert">
          <b>ℹ️ Sistema conectado com alerta automático.</b>
          <p>
            Análises de risco <b>Em aberto</b> possuem acompanhamento de validade. Quando faltar{' '}
            <b>5 dias para vencer</b> ou <b>no dia em que vencer</b>, o sistema notifica no{' '}
            <b>Dashboard</b> e no grupo do <b>WhatsApp</b> automaticamente. Apenas o cargo de{' '}
            <b>Técnico de Segurança</b> tem permissão para fechar a análise para indicar que outra já foi
            feita.
          </p>
        </div>

        {/* SEÇÃO 1: FORMULÁRIO DE ANEXOS */}
        <section className="ar-card noprint" id="secAnexosAR">
          <h2>📎 Anexar Análise de Risco</h2>
          <p className="ar-hint">
            Escolha <b>vários arquivos</b> de uma vez: <b>PDF, Excel, Word, imagens e outros</b>.
            Preencha o <b>Título obrigatório de cada anexo</b>. Se a análise estiver <b>Em aberto</b>,
            informe a data <b>VÁLIDA ATÉ *</b> (obrigatória) — até quando ela está válida; se estiver{' '}
            <b>Fechada</b>, esse campo some e não é preciso.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="arAtividadeLocal" className="ar-label" style={{ marginTop: 0 }}>
                ATIVIDADE / LOCAL (OPCIONAL)
              </label>
              <input
                id="arAtividadeLocal"
                className="ar-input"
                placeholder="Ex.: Escavação de vala — Canteiro Central"
                value={atividadeLocal}
                onChange={(e) => setAtividadeLocal(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="arStatus" className="ar-label" style={{ marginTop: 0 }}>
                STATUS DA ANÁLISE *
              </label>
              <select
                id="arStatus"
                className="ar-select"
                value={statusAr}
                onChange={(e) => setStatusAr(e.target.value as 'Em aberto' | 'Fechada')}
              >
                <option value="Em aberto">Em aberto</option>
                <option value="Fechada">Fechada</option>
              </select>
            </div>

            {statusAr === 'Em aberto' && (
              <div className="sm:col-span-2 max-w-md">
                <label htmlFor="arValidaAte" className="ar-label" style={{ marginTop: 0 }}>
                  VÁLIDA ATÉ *
                </label>
                <input
                  type="date"
                  id="arValidaAte"
                  className={`ar-input ${invalidValidade ? 'invalid-campo' : ''}`}
                  value={validaAte}
                  onChange={(e) => {
                    setValidaAte(e.target.value)
                    setInvalidValidade(false)
                  }}
                />
              </div>
            )}
          </div>

          <label className="ar-label mt-4">Arquivos da análise de risco já pronta</label>
          <div className="anexos-box">
            <span className="anexo-txt">
              📎 <b>+ Anexar análise de risco já pronta (em aberto ou fechada)</b>
              <br />
              PDF, Excel, Word, imagens e outros arquivos. Pode anexar vários de uma vez.
            </span>

            <label className="anexo-btn" htmlFor="arInput">
              📎 Escolher arquivos
            </label>
            <input
              type="file"
              id="arInput"
              ref={fileInputRef}
              multiple
              accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.txt,.zip,.rar,image/*"
              style={{ display: 'none' }}
              onChange={handleArquivosSelecionados}
            />

            <p className="anexo-hint">
              ⚠️ Depois de escolher os arquivos, preencha o <b>Título obrigatório de cada anexo</b> na
              lista abaixo (é o título que identifica aquela análise) e clique em Salvar.
              <br />
              ⚠️ Se o status for <b>Em aberto</b>, preencha também a data <b>VÁLIDA ATÉ *</b> acima
              (obrigatória) — até quando a análise está válida. Se o status for <b>Fechada</b>, não é
              preciso data de validade.
            </p>

            {pendentes.length > 0 && (
              <div className="anexo-lista">
                {pendentes.map((p, i) => (
                  <div key={i} className="anexo-item">
                    <span className="anexo-ic">{p.icone}</span>
                    <div className="anexo-info">
                      <b>{p.nome}</b>
                      <span>
                        {p.rotulo} • {fmtTamanho(p.tamanho)}
                      </span>
                      <input
                        className={`ar-titulo-pend ${invalidTitulos[i] ? 'invalid-campo' : ''}`}
                        placeholder="Título desta análise de risco *"
                        value={p.titulo}
                        onChange={(e) => handleTituloPendenteChange(i, e.target.value)}
                      />
                    </div>
                    <div className="anexo-acoes">
                      <button
                        type="button"
                        className="del"
                        onClick={() => removerPendente(i)}
                      >
                        ✕ Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {feedback && (
            <div className={`feedback ${feedback.tipo}`} role="alert">
              {feedback.msg}
            </div>
          )}

          <div className="flex flex-wrap gap-2.5 mt-4 noprint">
            <button
              type="button"
              className="ar-btn ar-btn-dark"
              onClick={salvarAnexos}
            >
              💾 Salvar arquivos
            </button>
            <button
              type="button"
              className="ar-btn ar-btn-ghost"
              onClick={limparSelecao}
            >
              Limpar seleção
            </button>
          </div>
        </section>

        {/* SEÇÃO 2: LISTA DE ANÁLISES ANEXADAS */}
        <section className="ar-card">
          <h2>🗂️ Análises de risco anexadas</h2>
          <p className="ar-hint">
            Todas as análises de risco arquivadas, com <b>título, nome do arquivo, atividade/local,
            status (Em aberto ou Fechada), tipo, tamanho</b> e <b>data e hora em que foram anexadas</b>.
            Análises <b>Em aberto</b> mostram também <b>📅 Válida até</b> a data informada, com{' '}
            <b>🔴 VALIDADE VENCIDA</b> se o prazo já passou ou quantos dias faltam se ainda está dentro do
            prazo; análises <b>Fechadas</b> não mostram data de validade. Use <b>Visualizar / Abrir</b> para
            ver, <b>Baixar</b> para baixar uma cópia ou <b>Excluir arquivo</b> para apagar.
          </p>

          <div className="stats-anex">
            <div className="stat">
              <b>{stats.total}</b>
              <span>Total de arquivos</span>
            </div>
            <div className="stat">
              <b>{stats.abertas}</b>
              <span>Em aberto</span>
            </div>
            <div className="stat">
              <b>{stats.fechadas}</b>
              <span>Fechadas</span>
            </div>
            {['PDF', 'Excel', 'Word', 'Imagem', 'Arquivo'].map((r) => (
              <div key={r} className="stat">
                <b>{stats.porTipo[r] || 0}</b>
                <span>{r === 'Arquivo' ? 'Outros' : r}</span>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div className="filtros-anex noprint">
            <div>
              <label htmlFor="arBusca" className="ar-label" style={{ marginTop: 0 }}>
                BUSCAR
              </label>
              <input
                id="arBusca"
                className="ar-input"
                placeholder="🔍 Buscar pelo título ou nome do arquivo..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="arFiltroStatus" className="ar-label" style={{ marginTop: 0 }}>
                STATUS
              </label>
              <select
                id="arFiltroStatus"
                className="ar-select"
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
              >
                <option value="todas">Todas</option>
                <option value="Em aberto">Em aberto</option>
                <option value="Fechada">Fechadas</option>
              </select>
            </div>
            <div>
              <label htmlFor="arFiltroTipo" className="ar-label" style={{ marginTop: 0 }}>
                TIPO DE ARQUIVO
              </label>
              <select
                id="arFiltroTipo"
                className="ar-select"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
              >
                <option value="todos">Todos os tipos</option>
                <option value="PDF">📕 PDF</option>
                <option value="Excel">📗 Excel</option>
                <option value="Word">📘 Word</option>
                <option value="Imagem">🖼️ Imagem</option>
                <option value="Arquivo">📄 Outros arquivos</option>
              </select>
            </div>
          </div>

          {/* Lista de Arquivos */}
          <div className="flex flex-col gap-2.5 mt-3">
            {analises.length === 0 ? (
              <div className="empty-box">
                Nenhuma análise de risco arquivada ainda.
                <br />
                Escolha os arquivos acima, preencha o Título de cada um e clique em “💾 Salvar arquivos”.
              </div>
            ) : analisesFiltradas.length === 0 ? (
              <div className="empty-box">
                Nenhum arquivo encontrado com esta busca / filtro.
              </div>
            ) : (
              analisesFiltradas.map((a) => {
                const dias = diasAteValidade(a.validaAte)
                const isAberta = a.status === 'Em aberto'

                return (
                  <div key={a.id} className="arq-item">
                    <span className="anexo-ic">{a.icone}</span>
                    <div className="anexo-info">
                      <span className="titulo-arq">📋 {a.titulo || '(sem título)'}</span>
                      <b>{a.nome}</b>

                      {a.atividadeLocal && <span>📍 {a.atividadeLocal}</span>}

                      <div className="flex items-center gap-2 mt-1">
                        <span className={`badge ${a.status === 'Fechada' ? 'st-fechada' : 'st-aberto'}`}>
                          {a.status}
                        </span>
                        {a.fechadaPor && (
                          <span className="text-xs font-bold text-gray-500">
                            (Fechada por {a.fechadaPor} em {a.fechadaEm})
                          </span>
                        )}
                      </div>

                      {isAberta && (
                        <div className="mt-1">
                          {!a.validaAte ? (
                            <span className="text-xs font-bold text-gray-500">
                              📅 Válida até: não informada
                            </span>
                          ) : (
                            <span className="text-xs font-bold">
                              📅 Válida até: {fmtValidade(a.validaAte)}
                              {dias !== null && dias < 0 && (
                                <span className="badge val-vencida ml-1.5">🔴 VALIDADE VENCIDA</span>
                              )}
                              {dias === 0 && (
                                <span className="badge val-prazo ml-1.5">⏳ Vence hoje</span>
                              )}
                              {dias === 1 && (
                                <span className="badge val-prazo ml-1.5">⏳ Falta 1 dia</span>
                              )}
                              {dias !== null && dias > 1 && (
                                <span className="badge val-prazo ml-1.5">⏳ Faltam {dias} dias</span>
                              )}
                            </span>
                          )}
                        </div>
                      )}

                      <span>
                        {a.rotulo} • {fmtTamanho(a.tamanho)}
                      </span>
                      <span>📅 Anexado em {a.anexadoEm}</span>
                    </div>

                    <div className="anexo-acoes">
                      {/* Fechar Análise (Exclusivo Técnico de Segurança) */}
                      {isAberta && (
                        <>
                          {isTecnicoSeguranca ? (
                            <button
                              type="button"
                              className="fechar-btn"
                              onClick={() => abrirModalFechar(a)}
                              title="Fechar esta análise de risco para indicar que outra já foi feita"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              Fechar Análise (Outra feita)
                            </button>
                          ) : (
                            <span
                              className="text-[11px] font-bold text-gray-400 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-200 cursor-not-allowed flex items-center gap-1"
                              title="Apenas o Técnico de Segurança pode fechar a análise"
                            >
                              <Lock className="w-3 h-3" />
                              Fechamento restrito ao TST
                            </span>
                          )}
                        </>
                      )}

                      {a.dataUrl ? (
                        <a href={a.dataUrl} target="_blank" rel="noopener noreferrer">
                          <Eye className="w-3.5 h-3.5" />
                          Visualizar / Abrir
                        </a>
                      ) : (
                        <span className="text-xs font-bold text-gray-500">Sem conteúdo</span>
                      )}

                      {a.dataUrl && (
                        <a href={a.dataUrl} download={a.nome} target="_blank" rel="noopener noreferrer">
                          <Download className="w-3.5 h-3.5" />
                          Baixar
                        </a>
                      )}

                      <button
                        type="button"
                        className="del"
                        onClick={() => excluirItem(a.id, a.nome)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {confirmExcluir[a.id] ? 'Confirmar exclusão?' : 'Excluir arquivo'}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* Modal de Fechamento por Técnico de Segurança */}
        {modalFecharItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-emerald-700 font-extrabold text-lg">
                  <Lock className="w-5 h-5 text-emerald-600" />
                  Fechar Análise de Risco
                </div>
                <button
                  type="button"
                  onClick={() => setModalFecharItem(null)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-gray-700 leading-relaxed mb-4">
                Você está fechando a análise <b>"{modalFecharItem.titulo}"</b>.
                <br />
                <span className="text-xs text-gray-500 mt-1 block">
                  Esta ação indica que uma <b>nova análise de risco já foi elaborada e substituiu esta</b>.
                  O status mudará para <b>Fechada</b> e os alertas no Dashboard e WhatsApp serão
                  desativados para este item.
                </span>
              </p>

              <div className="mb-4">
                <label className="ar-label" style={{ marginTop: 0 }}>
                  Observação do Fechamento
                </label>
                <input
                  type="text"
                  className="ar-input text-sm"
                  placeholder="Ex.: Substituída por nova AR elaborada..."
                  value={obsFechamento}
                  onChange={(e) => setObsFechamento(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  className="ar-btn ar-btn-ghost text-sm py-2 px-4"
                  onClick={() => setModalFecharItem(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="ar-btn bg-emerald-600 hover:bg-emerald-700 text-white text-sm py-2 px-4 shadow-sm"
                  onClick={confirmarFechamento}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmar Fechamento
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-xs font-semibold text-[#374151] mt-8 leading-relaxed">
          Hydro Reabilitação — Segurança • Anexar Análise de Risco • Dados sincronizados no Supabase e salvos localmente.
        </footer>
      </div>

      {/* Floating Toast Notification */}
      {toastMsg && <div className="ar-toast">{toastMsg}</div>}
    </div>
  )
}
export default AnaliseRiscoComponent
