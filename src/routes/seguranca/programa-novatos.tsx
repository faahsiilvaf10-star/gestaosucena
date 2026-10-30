import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  type NovatoItem,
  type ColaboradorEfetivoRH,
  ETAPAS_NOVATOS,
  fmtDate,
  hojeISO,
  diasAte,
  progresso,
  statusDe,
  prazoTxt,
  carregarNovatos,
  salvarNovatos,
  carregarColaboradoresAtivosRH,
  gerarTextoRelatorioNovatos,
} from '../../lib/novatosData'
import { supabase } from '../../lib/supabase'
import {
  ArrowLeft,
  Cloud,
  GraduationCap,
  Calendar,
  User,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  Trash2,
  Printer,
  Copy,
  Sparkles,
  X,
} from 'lucide-react'

export const Route = createFileRoute('/seguranca/programa-novatos')({
  component: ProgramaNovatosComponent,
})

export function ProgramaNovatosComponent() {
  const [novatos, setNovatos] = useState<NovatoItem[]>([])
  const [colaboradoresRH, setColaboradoresRH] = useState<ColaboradorEfetivoRH[]>([])
  const [carregando, setCarregando] = useState(true)

  // Campos do formulário
  const [nome, setNome] = useState('')
  const [cargo, setCargo] = useState('')
  const [matricula, setMatricula] = useState('')
  const [admissao, setAdmissao] = useState(hojeISO())
  const [setor, setSetor] = useState('')
  const [tutor, setTutor] = useState('')
  const [prazo, setPrazo] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`
  })
  const [obs, setObs] = useState('')
  const [etapasMarcadas, setEtapasMarcadas] = useState<string[]>([])

  // Dropdowns de Autocomplete
  const [novatoDropdownOpen, setNovatoDropdownOpen] = useState(false)
  const [tutorDropdownOpen, setTutorDropdownOpen] = useState(false)
  const novatoBoxRef = useRef<HTMLDivElement>(null)
  const tutorBoxRef = useRef<HTMLDivElement>(null)

  // Filtros & Busca
  const [filtroAtual, setFiltroAtual] = useState<'todos' | 'em-integracao' | 'concluidos' | 'atrasados'>('todos')
  const [busca, setBusca] = useState('')

  // Validação & Feedbacks
  const [invalidCampos, setInvalidCampos] = useState<Record<string, boolean>>({})
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [confirmExcluir, setConfirmExcluir] = useState<Record<string, boolean>>({})

  const formSectionRef = useRef<HTMLDivElement>(null)
  const listaSectionRef = useRef<HTMLDivElement>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? null : curr))
    }, 2800)
  }

  // Carregar dados e escutar Realtime
  useEffect(() => {
    let isMounted = true

    const inicializar = async () => {
      try {
        setCarregando(true)
        const env =
          typeof window !== 'undefined'
            ? localStorage.getItem('sucena_environment') || 'barcarena'
            : 'barcarena'

        const [dadosNovatos, efetivoRH] = await Promise.all([
          carregarNovatos(env),
          carregarColaboradoresAtivosRH(),
        ])

        if (isMounted) {
          setNovatos(dadosNovatos)
          setColaboradoresRH(efetivoRH)
        }
      } catch (err) {
        console.error('[Programa Novatos] Erro ao carregar dados:', err)
      } finally {
        if (isMounted) {
          setCarregando(false)
        }
      }
    }

    inicializar()

    // Realtime novatos
    const sub = supabase
      .channel('novatos_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_settings' }, async () => {
        const env =
          typeof window !== 'undefined'
            ? localStorage.getItem('sucena_environment') || 'barcarena'
            : 'barcarena'
        const atualizado = await carregarNovatos(env)
        if (isMounted) setNovatos(atualizado)
      })
      .subscribe()

    // Realtime rh_efetivo
    const rhSub = supabase
      .channel('novatos_rh_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rh_efetivo' }, async () => {
        const rhAtualizado = await carregarColaboradoresAtivosRH()
        if (isMounted) setColaboradoresRH(rhAtualizado)
      })
      .subscribe()

    return () => {
      isMounted = false
      sub.unsubscribe()
      rhSub.unsubscribe()
    }
  }, [])

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (novatoBoxRef.current && !novatoBoxRef.current.contains(e.target as Node)) {
        setNovatoDropdownOpen(false)
      }
      if (tutorBoxRef.current && !tutorBoxRef.current.contains(e.target as Node)) {
        setTutorDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filtragem de colaboradores para busca de novato
  const colaboradoresFiltradosNovato = useMemo(() => {
    if (!nome.trim()) return colaboradoresRH.slice(0, 30)
    const q = nome.toLowerCase()
    return colaboradoresRH.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        c.cargo.toLowerCase().includes(q) ||
        c.matricula.toLowerCase().includes(q)
    )
  }, [colaboradoresRH, nome])

  // Filtragem de colaboradores para busca de tutor/padrinho
  const colaboradoresFiltradosTutor = useMemo(() => {
    if (!tutor.trim()) return colaboradoresRH.slice(0, 30)
    const q = tutor.toLowerCase()
    return colaboradoresRH.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        c.cargo.toLowerCase().includes(q) ||
        c.matricula.toLowerCase().includes(q)
    )
  }, [colaboradoresRH, tutor])

  // Ao selecionar um colaborador como Novato -> preenche automaticamente matrícula, cargo, admissão e setor
  const selecionarNovatoDoRH = (c: ColaboradorEfetivoRH) => {
    setNome(c.nome)
    setCargo(c.cargo)
    setMatricula(c.matricula)

    if (c.admissao) {
      setAdmissao(c.admissao)
      // Ajustar prazo para 30 dias após a admissão
      const [ano, mes, dia] = c.admissao.split('-').map(Number)
      if (ano && mes && dia) {
        const dPrazo = new Date(ano, mes - 1, dia)
        dPrazo.setDate(dPrazo.getDate() + 30)
        setPrazo(
          `${dPrazo.getFullYear()}-${String(dPrazo.getMonth() + 1).padStart(2, '0')}-${String(
            dPrazo.getDate()
          ).padStart(2, '0')}`
        )
      }
    }

    if (c.setor) {
      const setoresValidos = [
        'Terraplenagem',
        'Drenagem',
        'Montagem',
        'Almoxarifado',
        'Administrativo',
        'Segurança do Trabalho',
        'Gabião',
        'Jardinagem',
        'Transportes',
        'Mecânica',
      ]
      const match = setoresValidos.find((s) =>
        c.setor?.toLowerCase().includes(s.toLowerCase())
      )
      if (match) {
        setSetor(match)
      } else {
        setSetor('Outro')
      }
    }

    setNovatoDropdownOpen(false)
    setInvalidCampos((prev) => ({
      ...prev,
      nome: false,
      cargo: false,
      matricula: false,
      admissao: false,
      setor: false,
    }))
    showToast(`Colaborador ${c.nome} selecionado — dados preenchidos automaticamente!`)
  }

  // Ao selecionar um colaborador como Tutor/Padrinho
  const selecionarTutorDoRH = (c: ColaboradorEfetivoRH) => {
    setTutor(c.nome)
    setTutorDropdownOpen(false)
    setInvalidCampos((prev) => ({ ...prev, tutor: false }))
  }

  // Progresso do formulário atual
  const progressoFormPct = useMemo(() => {
    return Math.round((etapasMarcadas.length / ETAPAS_NOVATOS.length) * 100)
  }, [etapasMarcadas])

  const toggleEtapaForm = (etapa: string) => {
    setEtapasMarcadas((prev) =>
      prev.includes(etapa) ? prev.filter((e) => e !== etapa) : [...prev, etapa]
    )
  }

  // Salvar novo novato
  const salvarNovato = async () => {
    setFeedback(null)
    setInvalidCampos({})

    const faltas: string[] = []
    const novInvalidos: Record<string, boolean> = {}

    if (!nome.trim()) {
      faltas.push('NOME COMPLETO')
      novInvalidos['nome'] = true
    }
    if (!cargo.trim()) {
      faltas.push('CARGO')
      novInvalidos['cargo'] = true
    }
    if (!matricula.trim()) {
      faltas.push('MATRÍCULA')
      novInvalidos['matricula'] = true
    }
    if (!admissao) {
      faltas.push('DATA DE ADMISSÃO')
      novInvalidos['admissao'] = true
    }
    if (!setor) {
      faltas.push('SETOR')
      novInvalidos['setor'] = true
    }
    if (!tutor.trim()) {
      faltas.push('TUTOR / PADRINHO')
      novInvalidos['tutor'] = true
    }
    if (!prazo) {
      faltas.push('PRAZO DE CONCLUSÃO')
      novInvalidos['prazo'] = true
    }

    if (faltas.length) {
      setInvalidCampos(novInvalidos)
      setFeedback({
        tipo: 'erro',
        msg: `⚠️ NÃO SALVOU — falta preencher: ${faltas.join(
          ', '
        )}.\nPreencha os campos destacados em vermelho e clique em Salvar novato de novo.`,
      })
      return
    }

    const env =
      typeof window !== 'undefined'
        ? localStorage.getItem('sucena_environment') || 'barcarena'
        : 'barcarena'

    const novoRec: NovatoItem = {
      uid: `n${Date.now()}`,
      nome: nome.trim(),
      cargo: cargo.trim(),
      matricula: matricula.trim(),
      admissao,
      setor,
      tutor: tutor.trim(),
      prazo,
      obs: obs.trim() || undefined,
      etapas: [...etapasMarcadas],
      dataConclusao:
        etapasMarcadas.length >= ETAPAS_NOVATOS.length ? new Date().toLocaleString('pt-BR') : undefined,
      salvoEm: new Date().toLocaleString('pt-BR'),
    }

    const listaAtualizada = [novoRec, ...novatos]
    setNovatos(listaAtualizada)
    limparForm()

    const ok = await salvarNovatos(listaAtualizada, env)

    setFeedback({
      tipo: 'ok',
      msg: `✅ NOVATO SALVO!\n${novoRec.nome} entrou na lista abaixo como ${statusDe(
        novoRec
      )} — ${progresso(novoRec)}% da trilha (${novoRec.etapas.length} de ${
        ETAPAS_NOVATOS.length
      } etapas), com prazo até ${fmtDate(novoRec.prazo)}.\nMarque as etapas na lista para atualizar o progresso e o relatório automaticamente.${
        ok ? ' Sincronizado no Supabase.' : '\n(Salvo no armazenamento local)'
      }`,
    })

    showToast(`✅ Novato salvo — ${statusDe(novoRec)} • ${progresso(novoRec)}%`)

    setTimeout(() => {
      listaSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 500)
  }

  const limparForm = () => {
    setNome('')
    setCargo('')
    setMatricula('')
    setAdmissao(hojeISO())
    setSetor('')
    setTutor('')
    const d = new Date()
    d.setDate(d.getDate() + 30)
    setPrazo(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`
    )
    setObs('')
    setEtapasMarcadas([])
    setInvalidCampos({})
    setFeedback(null)
  }

  // Preencher com exemplo fictício
  const preencherExemplo = () => {
    setNome('Exemplo — Novato Fictício')
    setCargo('Ajudante (exemplo)')
    setMatricula('EXEMPLO-000')
    setSetor('Terraplenagem')
    setTutor('Exemplo — Tutor Fictício')
    setObs('EXEMPLO FICTÍCIO para testar a página — não é uma pessoa real.')
    setEtapasMarcadas(['Integração de segurança', 'Uso de EPI'])
    setFeedback({
      tipo: 'ok',
      msg: '✏️ EXEMPLO FICTÍCIO preenchido (não é uma pessoa real).\nConfira os campos, ajuste se quiser e clique em Salvar novato para testar — ou clique em Limpar formulário para apagar.',
    })
  }

  // Alternar etapa de novato na lista
  const toggleEtapaItem = async (uid: string, etapa: string, checked: boolean) => {
    const env =
      typeof window !== 'undefined'
        ? localStorage.getItem('sucena_environment') || 'barcarena'
        : 'barcarena'

    const listaAtualizada = novatos.map((n) => {
      if (n.uid === uid) {
        let ets = [...(n.etapas || [])]
        if (checked && !ets.includes(etapa)) {
          ets.push(etapa)
        } else if (!checked && ets.includes(etapa)) {
          ets = ets.filter((e) => e !== etapa)
        }

        const concluidoAgora = ets.length >= ETAPAS_NOVATOS.length
        return {
          ...n,
          etapas: ets,
          dataConclusao: concluidoAgora ? n.dataConclusao || new Date().toLocaleString('pt-BR') : undefined,
        }
      }
      return n
    })

    setNovatos(listaAtualizada)
    await salvarNovatos(listaAtualizada, env)

    const novatoAlterado = listaAtualizada.find((n) => n.uid === uid)
    if (novatoAlterado) {
      showToast(
        checked
          ? `✅ Etapa marcada — ${progresso(novatoAlterado)}%`
          : `Etapa desmarcada — ${progresso(novatoAlterado)}%`
      )
    }
  }

  // Excluir novato
  const excluirNovato = async (uid: string) => {
    if (!confirmExcluir[uid]) {
      setConfirmExcluir({ [uid]: true })
      setTimeout(() => {
        setConfirmExcluir((curr) => ({ ...curr, [uid]: false }))
      }, 4000)
      return
    }

    const env =
      typeof window !== 'undefined'
        ? localStorage.getItem('sucena_environment') || 'barcarena'
        : 'barcarena'

    const listaAtualizada = novatos.filter((n) => n.uid !== uid)
    setNovatos(listaAtualizada)
    setConfirmExcluir((curr) => ({ ...curr, [uid]: false }))

    await salvarNovatos(listaAtualizada, env)
    showToast('Novato excluído — relatório atualizado')
  }

  // Estatísticas de Novatos
  const stats = useMemo(() => {
    const total = novatos.length
    const conc = novatos.filter((n) => statusDe(n) === 'Concluído').length
    const em = novatos.filter((n) => statusDe(n) === 'Em integração').length
    const atr = novatos.filter((n) => statusDe(n) === 'Atrasado').length
    const pct = total ? Math.round((conc / total) * 100) : 0
    return { total, conc, em, atr, pct }
  }, [novatos])

  // Filtragem da lista
  const novatosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return novatos.filter((n) => {
      const st = statusDe(n)
      if (filtroAtual === 'em-integracao' && st !== 'Em integração') return false
      if (filtroAtual === 'concluidos' && st !== 'Concluído') return false
      if (filtroAtual === 'atrasados' && st !== 'Atrasado') return false

      if (q) {
        const texto = `${n.nome} ${n.matricula} ${n.setor} ${n.cargo} ${n.tutor}`.toLowerCase()
        if (!texto.includes(q)) return false
      }
      return true
    })
  }, [novatos, filtroAtual, busca])

  // Copiar relatório
  const copiarRelatorio = () => {
    const txt = gerarTextoRelatorioNovatos(novatos)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(() => {
        showToast('📋 Relatório copiado!')
      }).catch(() => fallbackCopiar(txt))
    } else {
      fallbackCopiar(txt)
    }
  }

  const fallbackCopiar = (txt: string) => {
    try {
      const ta = document.createElement('textarea')
      ta.value = txt
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      showToast('📋 Relatório copiado!')
    } catch {
      showToast('Não foi possível copiar automaticamente')
    }
  }

  // Imprimir relatório
  const imprimirRelatorio = () => {
    const relEl = document.getElementById('relConteudo')
    const conteudoHtml = relEl ? relEl.innerHTML : ''

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório — Programa de Novatos</title><style>body{font-family:Arial,sans-serif;color:#000;padding:24px}.rel-item{border-top:1px solid #ccc;padding:12px 0}.badge{font-weight:700}</style></head><body><h1>Relatório Automático — Programa de Novatos</h1><p>Hydro Reabilitação • Gerado em ${new Date().toLocaleString(
      'pt-BR'
    )}</p>${conteudoHtml}<script>window.onload=function(){window.print()}<\/script></body></html>`

    const w = window.open('', '_blank')
    if (!w) {
      showToast('Permita pop-ups para imprimir, ou use Copiar relatório')
      return
    }
    w.document.write(html)
    w.document.close()
  }

  return (
    <div className="nov-container flex flex-col h-full overflow-y-auto pb-24 bg-white text-[#111827]">
      <style>{`
        .nov-container {
          font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        }
        .nov-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 22px;
          padding: 20px 22px;
          box-shadow: 0 8px 30px rgba(0,0,0,.05);
          margin-bottom: 18px;
        }
        .nov-card h2 {
          font-size: 22px;
          color: #000;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .nov-hint {
          color: #111827;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.55;
          margin-bottom: 10px;
        }
        .nov-label {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: .03em;
          color: #000;
          display: block;
          margin: 14px 0 6px;
        }
        .nov-input, .nov-select, .nov-textarea {
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
        .nov-textarea {
          resize: vertical;
          min-height: 86px;
        }
        .nov-input:focus, .nov-select:focus, .nov-textarea:focus {
          border-color: #f5c518;
          box-shadow: 0 0 0 3px #fef3c7;
        }
        .nov-input::placeholder, .nov-textarea::placeholder {
          color: #374151 !important;
          opacity: 1;
          font-weight: 600;
        }
        .invalid-campo {
          border: 2.5px solid #dc2626 !important;
          background: #fef2f2 !important;
        }
        .nov-btn {
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
        .nov-btn-yellow {
          background: #f5c518;
          color: #111;
        }
        .nov-btn-yellow:hover {
          background: #eab308;
        }
        .nov-btn-dark {
          background: #111;
          color: #fff;
        }
        .nov-btn-dark:hover {
          background: #262626;
        }
        .nov-btn-ghost {
          background: #fff;
          border: 1.5px solid #9ca3af;
          color: #111;
        }
        .nov-btn-ghost:hover {
          background: #f3f4f6;
        }
        .nov-btn-red {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }
        .nov-btn-red:hover {
          background: #fee2e2;
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
        .nov-alert {
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-left: 6px solid #f59e0b;
          border-radius: 14px;
          padding: 14px 16px;
          margin-bottom: 18px;
        }
        .nov-alert b {
          color: #92400e;
        }
        .nov-alert p {
          font-size: 13px;
          color: #111;
          font-weight: 600;
          line-height: 1.5;
          margin-top: 3px;
        }
        .etapas-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 6px;
        }
        @media(max-width: 640px) {
          .etapas-grid {
            grid-template-columns: 1fr;
          }
        }
        .etapa-item {
          display: flex;
          gap: 11px;
          align-items: flex-start;
          background: #f9fafb;
          border: 1.5px solid #e5e7eb;
          border-radius: 14px;
          padding: 13px 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .etapa-item:hover {
          border-color: #f5c518;
          background: #fffbeb;
        }
        .etapa-item input {
          width: 22px;
          height: 22px;
          accent-color: #16a34a;
          flex: none;
          margin-top: 1px;
          cursor: pointer;
        }
        .etapa-item b {
          color: #000;
          font-size: 15px;
          display: block;
        }
        .etapa-item small {
          color: #374151;
          font-weight: 600;
          font-size: 12.5px;
          line-height: 1.45;
          display: block;
          margin-top: 2px;
        }
        .etapa-item.feita {
          background: #f0fdf4;
          border-color: #86efac;
        }
        .nov-progress {
          height: 16px;
          background: #e5e7eb;
          border-radius: 999px;
          overflow: hidden;
          margin: 12px 0;
        }
        .nov-progress i {
          display: block;
          height: 100%;
          background: #16a34a;
          transition: width 0.4s ease;
        }
        .nov-progress.pouco i {
          background: #f59e0b;
        }
        .nov-progress.atrasado i {
          background: #dc2626;
        }
        .nov-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin: 14px 0;
        }
        @media(max-width: 640px) {
          .nov-stats {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .stat-box {
          background: #f9fafb;
          border: 1.5px solid #e5e7eb;
          border-radius: 14px;
          padding: 14px;
          text-align: center;
        }
        .stat-box b {
          font-size: 26px;
          display: block;
          color: #000;
          font-weight: 900;
        }
        .stat-box span {
          font-size: 11px;
          color: #111;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .05em;
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
        .badge.em {
          background: #dbeafe;
          color: #1e40af;
        }
        .badge.ok {
          background: #dcfce7;
          color: #166534;
        }
        .badge.atraso {
          background: #7f1d1d;
          color: #fff;
        }
        .badge.prazo {
          background: #fef3c7;
          color: #92400e;
        }
        .filters-bar {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 12px 0;
        }
        .filters-bar button {
          border: 1.5px solid #111827;
          background: #fff;
          color: #000;
          font-weight: 800;
          border-radius: 999px;
          padding: 8px 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .filters-bar button.on {
          background: #111827;
          color: #fff;
        }
        .novato-card {
          border: 2px solid #fde68a;
          border-left: 8px solid #f59e0b;
          border-radius: 18px;
          padding: 16px;
          margin-bottom: 14px;
          background: #fffbeb;
        }
        .novato-card.done {
          border-color: #bbf7d0;
          border-left-color: #16a34a;
          background: #f0fdf4;
        }
        .novato-card.overdue {
          border-color: #fecaca;
          border-left-color: #dc2626;
          background: #fef2f2;
        }
        .novato-card h3 {
          font-size: 17px;
          color: #000;
          font-weight: 800;
        }
        .novato-card p {
          color: #111827;
          font-size: 14px;
          line-height: 1.55;
          margin-top: 5px;
          font-weight: 600;
        }
        .novato-meta {
          font-size: 13px;
          color: #111827;
          font-weight: 600;
          margin-top: 7px;
          line-height: 1.65;
        }
        .nov-note {
          border-radius: 12px;
          padding: 11px 13px;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.55;
          margin-top: 12px;
          background: #fef2f2;
          border: 1.5px solid #fca5a5;
          color: #991b1b;
        }
        .nov-note.ok-note {
          background: #f0fdf4;
          border-color: #86efac;
          color: #14532d;
        }
        .nov-note.info-note {
          background: #eff6ff;
          border-color: #93c5fd;
          color: #1e40af;
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
        .relatorio-nov {
          border: 2px solid #111827;
          border-radius: 20px;
          padding: 22px;
          background: #fff;
        }
        .relatorio-nov h2 {
          font-size: 24px;
          color: #000;
          font-weight: 700;
        }
        .rel-item {
          border-top: 1px solid #e5e7eb;
          padding: 12px 0;
        }
        .rel-item b {
          color: #000;
        }
        .rel-item span {
          color: #111827;
          font-weight: 600;
          line-height: 1.6;
          font-size: 14px;
        }
        .nov-toast {
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
          animation: novToastFade 0.3s ease-in-out;
        }
        @keyframes novToastFade {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @media print {
          .noprint, .nov-breadcrumb, .nov-alert, .nov-toast, .filters-bar {
            display: none !important;
          }
          .nov-card, .relatorio-nov {
            box-shadow: none !important;
            border: 1px solid #ccc;
            break-inside: avoid;
          }
        }
      `}</style>

      <div className="max-w-5xl w-full mx-auto px-4 py-4">
        {/* Breadcrumb & Voltar */}
        <div className="nov-breadcrumb flex items-center justify-between gap-4 mb-4 mt-1">
          <div className="text-[13px] font-semibold text-[#374151] flex items-center gap-2">
            <Link
              to="/seguranca"
              className="hover:underline flex items-center gap-1 text-[#111827] font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              Segurança
            </Link>
            <span>›</span>
            <span className="text-[#111] font-extrabold">Programa de Novatos</span>
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
          <GraduationCap className="w-9 h-9 text-[#111]" />
          Programa de Novatos
        </h1>
        <p className="text-[#111827] font-medium mb-5 leading-relaxed max-w-4xl text-sm md:text-base">
          Cadastre o novato, defina o <b>tutor / padrinho</b> e acompanhe a <b>trilha de integração</b>:
          cada etapa marcada aumenta o <b>progresso %</b>. O status é automático — <b>Em integração</b>,{' '}
          <b>Concluído</b> (todas as etapas) ou <b>Atrasado</b> (passou o prazo sem concluir).
        </p>

        {/* Alerta de Armazenamento / RH */}
        <div className="nov-alert">
          <b>ℹ️ Conexão direta com o Efetivo do RH.</b>
          <p>
            Ao digitar o <b>Nome completo do novato</b> ou clicar no campo, o sistema busca os colaboradores
            ativos no RH e <b>preenche automaticamente Matrícula, Cargo, Data de Admissão e Setor</b>.
            O campo de <b>Tutor / Padrinho</b> também busca diretamente no efetivo ativo!
          </p>
        </div>

        {/* SEÇÃO 1: FORMULÁRIO DE CADASTRO */}
        <section className="nov-card noprint" ref={formSectionRef} id="cadastroSection">
          <h2>📝 Cadastrar novato</h2>
          <p className="nov-hint">
            Preencha os dados do novato. Campos com * são obrigatórios. A trilha abaixo pode ser marcada
            já no cadastro ou depois, na lista de novatos.
          </p>

          {/* Linha 1: Nome do novato (Autocomplete RH) + Cargo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative" ref={novatoBoxRef}>
              <label htmlFor="nome" className="nov-label" style={{ marginTop: 0 }}>
                Nome completo do novato *
              </label>
              <input
                id="nome"
                className={`nov-input ${invalidCampos['nome'] ? 'invalid-campo' : ''}`}
                placeholder="Ex.: Digite ou selecione no efetivo do RH..."
                value={nome}
                onFocus={() => setNovatoDropdownOpen(true)}
                onChange={(e) => {
                  setNome(e.target.value)
                  setNovatoDropdownOpen(true)
                  if (invalidCampos['nome']) setInvalidCampos((prev) => ({ ...prev, nome: false }))
                }}
              />

              {novatoDropdownOpen && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-300 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                  <div className="p-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <span>Efetivo Ativo no RH ({colaboradoresFiltradosNovato.length})</span>
                    <button
                      type="button"
                      onClick={() => setNovatoDropdownOpen(false)}
                      className="text-gray-400 hover:text-black"
                    >
                      ✕
                    </button>
                  </div>
                  {colaboradoresFiltradosNovato.length === 0 ? (
                    <div className="p-3 text-xs text-gray-500 text-center">
                      Nenhum colaborador encontrado com "{nome}"
                    </div>
                  ) : (
                    colaboradoresFiltradosNovato.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selecionarNovatoDoRH(c)}
                        className="w-full text-left px-3 py-2 hover:bg-amber-50 border-b border-gray-100 last:border-0 transition"
                      >
                        <div className="font-bold text-gray-900 text-sm">{c.nome}</div>
                        <div className="text-xs text-gray-600 flex items-center gap-2">
                          <span>{c.cargo}</span>
                          {c.matricula && (
                            <span className="text-[11px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                              Matr: {c.matricula}
                            </span>
                          )}
                          {c.setor && (
                            <span className="text-[11px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded">
                              {c.setor}
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="cargo" className="nov-label" style={{ marginTop: 0 }}>
                Cargo *
              </label>
              <input
                id="cargo"
                className={`nov-input ${invalidCampos['cargo'] ? 'invalid-campo' : ''}`}
                placeholder="Ex.: Ajudante / Operador / Servente"
                value={cargo}
                onChange={(e) => {
                  setCargo(e.target.value)
                  if (invalidCampos['cargo']) setInvalidCampos((prev) => ({ ...prev, cargo: false }))
                }}
              />
            </div>
          </div>

          {/* Linha 2: Matrícula + Data de admissão + Setor */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-1">
            <div>
              <label htmlFor="matricula" className="nov-label">
                Matrícula *
              </label>
              <input
                id="matricula"
                className={`nov-input ${invalidCampos['matricula'] ? 'invalid-campo' : ''}`}
                placeholder="Ex.: 0000"
                value={matricula}
                onChange={(e) => {
                  setMatricula(e.target.value)
                  if (invalidCampos['matricula'])
                    setInvalidCampos((prev) => ({ ...prev, matricula: false }))
                }}
              />
            </div>

            <div>
              <label htmlFor="admissao" className="nov-label">
                Data de admissão *
              </label>
              <input
                type="date"
                id="admissao"
                className={`nov-input ${invalidCampos['admissao'] ? 'invalid-campo' : ''}`}
                value={admissao}
                onChange={(e) => {
                  setAdmissao(e.target.value)
                  if (invalidCampos['admissao'])
                    setInvalidCampos((prev) => ({ ...prev, admissao: false }))
                }}
              />
            </div>

            <div>
              <label htmlFor="setor" className="nov-label">
                Setor *
              </label>
              <select
                id="setor"
                className={`nov-select ${invalidCampos['setor'] ? 'invalid-campo' : ''}`}
                value={setor}
                onChange={(e) => {
                  setSetor(e.target.value)
                  if (invalidCampos['setor']) setInvalidCampos((prev) => ({ ...prev, setor: false }))
                }}
              >
                <option value="">Selecionar setor...</option>
                <option>Terraplenagem</option>
                <option>Drenagem</option>
                <option>Montagem</option>
                <option>Almoxarifado</option>
                <option>Administrativo</option>
                <option>Segurança do Trabalho</option>
                <option>Gabião</option>
                <option>Jardinagem</option>
                <option>Transportes</option>
                <option>Mecânica</option>
                <option>Outro</option>
              </select>
            </div>
          </div>

          {/* Linha 3: Tutor / Padrinho (Autocomplete RH) + Prazo de conclusão */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
            <div className="relative" ref={tutorBoxRef}>
              <label htmlFor="tutor" className="nov-label">
                Tutor / Padrinho *
              </label>
              <input
                id="tutor"
                className={`nov-input ${invalidCampos['tutor'] ? 'invalid-campo' : ''}`}
                placeholder="Ex.: Digite ou selecione no efetivo do RH..."
                value={tutor}
                onFocus={() => setTutorDropdownOpen(true)}
                onChange={(e) => {
                  setTutor(e.target.value)
                  setTutorDropdownOpen(true)
                  if (invalidCampos['tutor']) setInvalidCampos((prev) => ({ ...prev, tutor: false }))
                }}
              />

              {tutorDropdownOpen && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-300 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                  <div className="p-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <span>Efetivo Ativo no RH ({colaboradoresFiltradosTutor.length})</span>
                    <button
                      type="button"
                      onClick={() => setTutorDropdownOpen(false)}
                      className="text-gray-400 hover:text-black"
                    >
                      ✕
                    </button>
                  </div>
                  {colaboradoresFiltradosTutor.length === 0 ? (
                    <div className="p-3 text-xs text-gray-500 text-center">
                      Nenhum colaborador encontrado com "{tutor}"
                    </div>
                  ) : (
                    colaboradoresFiltradosTutor.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selecionarTutorDoRH(c)}
                        className="w-full text-left px-3 py-2 hover:bg-amber-50 border-b border-gray-100 last:border-0 transition"
                      >
                        <div className="font-bold text-gray-900 text-sm">{c.nome}</div>
                        <div className="text-xs text-gray-600 flex items-center gap-2">
                          <span>{c.cargo}</span>
                          {c.matricula && (
                            <span className="text-[11px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                              Matr: {c.matricula}
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="prazo" className="nov-label">
                Prazo de conclusão da integração *
              </label>
              <input
                type="date"
                id="prazo"
                className={`nov-input ${invalidCampos['prazo'] ? 'invalid-campo' : ''}`}
                value={prazo}
                onChange={(e) => {
                  setPrazo(e.target.value)
                  if (invalidCampos['prazo']) setInvalidCampos((prev) => ({ ...prev, prazo: false }))
                }}
              />
            </div>
          </div>

          {/* Observações */}
          <label htmlFor="obs" className="nov-label">
            Observações
          </label>
          <textarea
            id="obs"
            className="nov-textarea"
            placeholder="Ex.: Restrição, turno, frente de obra ou qualquer observação da integração..."
            value={obs}
            onChange={(e) => setObs(e.target.value)}
          />

          {/* Trilha de Integração — 6 Etapas */}
          <h3 className="mt-5 text-black font-bold text-lg">🛤️ Trilha de integração — etapas</h3>
          <p className="nov-hint mt-1">
            Marque as etapas já concluídas. O progresso é calculado sobre as 6 etapas: cada etapa vale
            aproximadamente 17%.
          </p>

          <div className="etapas-grid">
            {ETAPAS_NOVATOS.map((etapa, idx) => {
              const checked = etapasMarcadas.includes(etapa)
              return (
                <label
                  key={etapa}
                  className={`etapa-item ${checked ? 'feita' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleEtapaForm(etapa)}
                  />
                  <span>
                    <b>
                      {idx + 1}. {etapa}
                    </b>
                    <small>
                      {idx === 0 && 'Apresentação das regras de segurança, riscos da obra e canais de emergência.'}
                      {idx === 1 && 'Entrega, ajuste e orientação sobre o uso correto dos EPIs do cargo.'}
                      {idx === 2 && 'Primeiro Diálogo Diário de Segurança com a equipe.'}
                      {idx === 3 && 'Visita guiada ao canteiro com o tutor: acessos, saídas e áreas de risco.'}
                      {idx === 4 && 'Treinamento de Disposições Gerais e Gerenciamento de Riscos Ocupacionais (NR-01).'}
                      {idx === 5 && 'Avaliação final da integração com o tutor e a Segurança do Trabalho.'}
                    </small>
                  </span>
                </label>
              )
            })}
          </div>

          <p className="mt-3 font-extrabold text-black text-sm">
            Progresso da trilha neste cadastro: {progressoFormPct}% ({etapasMarcadas.length} de{' '}
            {ETAPAS_NOVATOS.length} etapas)
          </p>
          <div className={`nov-progress ${progressoFormPct < 50 ? 'pouco' : ''}`}>
            <i style={{ width: `${progressoFormPct}%` }} />
          </div>

          {feedback && (
            <div className={`feedback ${feedback.tipo}`} role="alert">
              {feedback.msg}
            </div>
          )}

          <div className="flex flex-wrap gap-2.5 mt-4 noprint">
            <button
              type="button"
              className="nov-btn nov-btn-dark"
              onClick={salvarNovato}
            >
              <Save className="w-4 h-4" />
              💾 Salvar novato
            </button>
            <button
              type="button"
              className="nov-btn nov-btn-ghost"
              onClick={limparForm}
            >
              <RotateCcw className="w-4 h-4" />
              Limpar formulário
            </button>
            <button
              type="button"
              className="nov-btn nov-btn-yellow"
              onClick={preencherExemplo}
            >
              <Sparkles className="w-4 h-4" />
              ✏️ Preencher com exemplo (fictício)
            </button>
          </div>

          <p className="mt-2.5 text-xs font-semibold text-[#374151] leading-relaxed">
            O botão de exemplo preenche dados <b>fictícios</b> só para testar a página (nome “Exemplo —
            Novato Fictício”, matrícula “EXEMPLO-000”). Apague e preencha com os dados reais antes de
            salvar de verdade.
          </p>
        </section>

        {/* SEÇÃO 2: NOVATOS CADASTRADOS */}
        <section className="nov-card" ref={listaSectionRef} id="listaSection">
          <h2>👥 Novatos cadastrados</h2>
          <p className="nov-hint">
            {novatos.length
              ? `${novatos.length} novato(s) • ${stats.conc} concluído(s) • ${stats.em} em integração • ${stats.atr} atrasado(s)`
              : 'Nenhum novato cadastrado ainda.'}
          </p>

          {/* Filtros */}
          <div className="filters-bar noprint">
            <button
              type="button"
              className={filtroAtual === 'todos' ? 'on' : ''}
              onClick={() => setFiltroAtual('todos')}
            >
              Todos
            </button>
            <button
              type="button"
              className={filtroAtual === 'em-integracao' ? 'on' : ''}
              onClick={() => setFiltroAtual('em-integracao')}
            >
              Em integração
            </button>
            <button
              type="button"
              className={filtroAtual === 'concluidos' ? 'on' : ''}
              onClick={() => setFiltroAtual('concluidos')}
            >
              Concluídos
            </button>
            <button
              type="button"
              className={filtroAtual === 'atrasados' ? 'on' : ''}
              onClick={() => setFiltroAtual('atrasados')}
            >
              Atrasados
            </button>
          </div>

          {/* Campo de Busca Rápida */}
          <div className="mb-4 max-w-md noprint">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
              <input
                type="text"
                className="nov-input pl-9"
                placeholder="Buscar por nome, matrícula, cargo, setor ou tutor..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>

          {/* Lista de Cards */}
          <div>
            {!novatos.length ? (
              <div className="empty-box">
                Nenhum novato cadastrado ainda.
                <br />
                Preencha o cadastro acima e clique em <b>Salvar novato</b>.
              </div>
            ) : !novatosFiltrados.length ? (
              <div className="empty-box">Nenhum novato neste filtro ou busca.</div>
            ) : (
              novatosFiltrados.map((n) => {
                const pct = progresso(n)
                const st = statusDe(n)
                const feitas = n.etapas || []
                const cardCls = st === 'Concluído' ? 'done' : st === 'Atrasado' ? 'overdue' : ''

                return (
                  <div key={n.uid} className={`novato-card ${cardCls}`}>
                    <div className="flex justify-between items-start gap-3 flex-wrap">
                      <div>
                        <h3>
                          {n.nome} &nbsp;
                          {st === 'Concluído' && <span className="badge ok">✅ CONCLUÍDO</span>}
                          {st === 'Atrasado' && <span className="badge atraso">🔴 ATRASADO</span>}
                          {st === 'Em integração' && (
                            <span className="badge em">🔵 EM INTEGRAÇÃO</span>
                          )}
                          <span className="badge prazo ml-1.5">{pct}% da trilha</span>
                        </h3>
                        <p>
                          {n.cargo} • Matrícula {n.matricula} • Setor: {n.setor}
                        </p>
                        <div className="novato-meta">
                          📅 Admissão: {fmtDate(n.admissao)} &nbsp;•&nbsp; 👤 Tutor / Padrinho:{' '}
                          <b>{n.tutor}</b>
                          <br />
                          <b>{prazoTxt(n)}</b>
                          {n.obs && (
                            <>
                              <br />
                              💬 Observações: {n.obs}
                            </>
                          )}
                          <br />
                          <span className="text-gray-500">Cadastrado em {n.salvoEm}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="nov-btn nov-btn-red text-xs py-1.5 px-3 noprint"
                        onClick={() => excluirNovato(n.uid)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {confirmExcluir[n.uid] ? 'Confirmar exclusão?' : 'Excluir'}
                      </button>
                    </div>

                    <div
                      className={`nov-progress ${
                        st === 'Atrasado' ? 'atrasado' : pct < 50 ? 'pouco' : ''
                      }`}
                    >
                      <i style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-black font-extrabold text-xs">
                      {pct}% concluído — {feitas.length} de {ETAPAS_NOVATOS.length} etapas
                    </p>

                    <div className="etapas-grid mt-2.5">
                      {ETAPAS_NOVATOS.map((e, idx) => {
                        const on = feitas.includes(e)
                        return (
                          <label
                            key={e}
                            className={`etapa-item ${on ? 'feita' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={(ev) => toggleEtapaItem(n.uid, e, ev.target.checked)}
                            />
                            <span>
                              <b>
                                {idx + 1}. {e}
                              </b>
                              <small>{on ? '✅ Concluída' : '⏳ Ainda não concluída'}</small>
                            </span>
                          </label>
                        )
                      })}
                    </div>

                    {st === 'Concluído' ? (
                      <div className="nov-note ok-note">
                        ✅ <b>Integração concluída</b>
                        {n.dataConclusao && ` em ${n.dataConclusao}`} — todas as 6 etapas foram
                        marcadas. Este novato já entrou como CONCLUÍDO no relatório abaixo.
                      </div>
                    ) : st === 'Atrasado' ? (
                      <div className="nov-note">
                        🔴 <b>ATRASADO:</b> o prazo ({fmtDate(n.prazo)}) passou sem concluir a trilha.
                        Marque as etapas restantes acima para concluir — ao marcar todas, o status vira
                        ✅ CONCLUÍDO automaticamente.
                      </div>
                    ) : (
                      <div className="nov-note info-note">
                        🔵 <b>Em integração:</b> marque as etapas da trilha acima conforme o novato for
                        concluindo. O progresso, o status e o relatório atualizam na hora.
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* SEÇÃO 3: RELATÓRIO AUTOMÁTICO */}
        <section className="relatorio-nov" id="relatorioSection">
          <h2>📋 Relatório Automático — Programa de Novatos</h2>
          <p className="text-[#111827] font-semibold text-sm leading-relaxed mt-1.5">
            Atualizado automaticamente a cada novato salvo, etapa marcada ou prazo vencido — sem
            preencher de novo.
          </p>

          <div className="nov-stats">
            <div className="stat-box">
              <b>{stats.total}</b>
              <span>Total de novatos</span>
            </div>
            <div className="stat-box">
              <b style={{ color: '#1e40af' }}>{stats.em}</b>
              <span>Em integração</span>
            </div>
            <div className="stat-box">
              <b style={{ color: '#16a34a' }}>{stats.conc}</b>
              <span>Concluídos</span>
            </div>
            <div className="stat-box">
              <b style={{ color: '#7f1d1d' }}>{stats.atr}</b>
              <span>Atrasados</span>
            </div>
          </div>

          <div className="nov-progress">
            <i style={{ width: `${stats.pct}%` }} />
          </div>
          <p className="text-black font-extrabold text-sm mb-4">
            {stats.pct}% concluído — {stats.conc} de {stats.total} novato(s) concluíram a integração
          </p>

          <div id="relConteudo">
            {!novatos.length ? (
              <div className="empty-box">
                O relatório aparece aqui automaticamente assim que houver novatos salvos.
              </div>
            ) : (
              <div>
                <p className="text-black font-semibold leading-relaxed mb-3">
                  Resumo automático: <b>{stats.total} novato(s)</b>,{' '}
                  <b style={{ color: '#16a34a' }}>{stats.conc} concluído(s)</b>,{' '}
                  <b style={{ color: '#1e40af' }}>{stats.em} em integração</b> e{' '}
                  <b style={{ color: '#7f1d1d' }}>{stats.atr} atrasado(s)</b> —{' '}
                  <b>{stats.pct}% concluído</b>.
                </p>

                {/* Grupo: Concluídos */}
                {novatos.filter((n) => statusDe(n) === 'Concluído').length > 0 && (
                  <div>
                    <h3
                      style={{ color: '#166534', fontSize: 16 }}
                      className="font-extrabold mt-3.5 mb-1"
                    >
                      ✅ Concluídos (
                      {novatos.filter((n) => statusDe(n) === 'Concluído').length})
                    </h3>
                    {novatos
                      .filter((n) => statusDe(n) === 'Concluído')
                      .map((n) => (
                        <div key={n.uid} className="rel-item">
                          <b>{n.nome}</b> — <span className="badge ok">✅ CONCLUÍDO</span>{' '}
                          <b>{progresso(n)}%</b> ({(n.etapas || []).length} de {ETAPAS_NOVATOS.length} etapas)
                          <br />
                          <span>
                            {n.cargo} • Matrícula {n.matricula} • Setor: {n.setor} • Tutor/Padrinho:{' '}
                            {n.tutor}
                            <br />
                            Admissão: {fmtDate(n.admissao)} • {prazoTxt(n)}
                            <br />
                            Etapas concluídas:{' '}
                            {(n.etapas || []).length ? n.etapas.join(' • ') : 'nenhuma ainda'}
                          </span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Grupo: Em integração */}
                {novatos.filter((n) => statusDe(n) === 'Em integração').length > 0 && (
                  <div>
                    <h3
                      style={{ color: '#1e40af', fontSize: 16 }}
                      className="font-extrabold mt-3.5 mb-1"
                    >
                      🔵 Em integração (
                      {novatos.filter((n) => statusDe(n) === 'Em integração').length})
                    </h3>
                    {novatos
                      .filter((n) => statusDe(n) === 'Em integração')
                      .map((n) => (
                        <div key={n.uid} className="rel-item">
                          <b>{n.nome}</b> — <span className="badge em">🔵 EM INTEGRAÇÃO</span>{' '}
                          <b>{progresso(n)}%</b> ({(n.etapas || []).length} de {ETAPAS_NOVATOS.length} etapas)
                          <br />
                          <span>
                            {n.cargo} • Matrícula {n.matricula} • Setor: {n.setor} • Tutor/Padrinho:{' '}
                            {n.tutor}
                            <br />
                            Admissão: {fmtDate(n.admissao)} • {prazoTxt(n)}
                            <br />
                            Etapas concluídas:{' '}
                            {(n.etapas || []).length ? n.etapas.join(' • ') : 'nenhuma ainda'}
                          </span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Grupo: Atrasados */}
                {novatos.filter((n) => statusDe(n) === 'Atrasado').length > 0 && (
                  <div>
                    <h3
                      style={{ color: '#7f1d1d', fontSize: 16 }}
                      className="font-extrabold mt-3.5 mb-1"
                    >
                      🔴 Atrasados (
                      {novatos.filter((n) => statusDe(n) === 'Atrasado').length})
                    </h3>
                    {novatos
                      .filter((n) => statusDe(n) === 'Atrasado')
                      .map((n) => (
                        <div key={n.uid} className="rel-item">
                          <b>{n.nome}</b> — <span className="badge atraso">🔴 ATRASADO</span>{' '}
                          <b>{progresso(n)}%</b> ({(n.etapas || []).length} de {ETAPAS_NOVATOS.length} etapas)
                          <br />
                          <span>
                            {n.cargo} • Matrícula {n.matricula} • Setor: {n.setor} • Tutor/Padrinho:{' '}
                            {n.tutor}
                            <br />
                            Admissão: {fmtDate(n.admissao)} • {prazoTxt(n)}
                            <br />
                            Etapas concluídas:{' '}
                            {(n.etapas || []).length ? n.etapas.join(' • ') : 'nenhuma ainda'}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2.5 mt-4 noprint">
            <button
              type="button"
              className="nov-btn nov-btn-dark"
              onClick={imprimirRelatorio}
            >
              <Printer className="w-4 h-4" />
              🖨️ Imprimir / Salvar relatório em PDF
            </button>
            <button
              type="button"
              className="nov-btn nov-btn-yellow"
              onClick={copiarRelatorio}
            >
              <Copy className="w-4 h-4" />
              📋 Copiar relatório (texto)
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-xs font-semibold text-[#374151] mt-8 leading-relaxed">
          Hydro Reabilitação — Segurança • Programa de Novatos • Dados sincronizados no Supabase e salvos localmente.
        </footer>
      </div>

      {/* Toast Notification */}
      {toastMsg && <div className="nov-toast">{toastMsg}</div>}
    </div>
  )
}
export default ProgramaNovatosComponent
