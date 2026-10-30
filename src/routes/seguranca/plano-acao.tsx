import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  type PlanoAcaoItem,
  type PrioridadePlano,
  type StatusPlano,
  type OrigemPlano,
  type ColaboradorRH,
  ORIGENS_PLANO,
  PRIORIDADES_PLANO,
  hojeISO,
  fmtData,
  diasParaPrazo,
  isVencido,
  statusEfetivo,
  prazoInfo,
  gerarTextoRelatorio,
  comprimirImagem,
  carregarPlanosAcao,
  salvarPlanosAcao,
  carregarColaboradoresAtivosRH,
  getDbKeyPlano,
} from '../../lib/planoAcaoData'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, CheckCircle2, Cloud, Search, Users, Check } from 'lucide-react'

export const Route = createFileRoute('/seguranca/plano-acao')({
  component: PlanoAcaoComponent,
})

export function PlanoAcaoComponent() {
  const [registros, setRegistros] = useState<PlanoAcaoItem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtroAtual, setFiltroAtual] = useState<string>('Todos')
  const [buscaTexto, setBuscaTexto] = useState<string>('')

  // Colaboradores RH
  const [colaboradoresRH, setColaboradoresRH] = useState<ColaboradorRH[]>([])
  const [carregandoRH, setCarregandoRH] = useState(true)
  const [responsavelDropdownOpen, setResponsavelDropdownOpen] = useState(false)
  const [responsavelCargo, setResponsavelCargo] = useState<string>('')
  const responsavelBoxRef = useRef<HTMLDivElement>(null)

  // Form states
  const [origem, setOrigem] = useState<string>('')
  const [referencia, setReferencia] = useState<string>('')
  const [acao, setAcao] = useState<string>('')
  const [responsavel, setResponsavel] = useState<string>('')
  const [dataAbertura, setDataAbertura] = useState<string>(() => hojeISO())
  const [prazo, setPrazo] = useState<string>('')
  const [prioridadeSel, setPrioridadeSel] = useState<PrioridadePlano>('Média')
  const [statusSel, setStatusSel] = useState<StatusPlano>('Pendente')
  const [observacoes, setObservacoes] = useState<string>('')

  // Feedback states
  const [feedbackForm, setFeedbackForm] = useState<{
    tipo: 'ok' | 'erro' | 'info'
    msg: string
  } | null>(null)
  const [invalidCampos, setInvalidCampos] = useState<Record<string, boolean>>({})

  // Conclusão inline states per card (id -> { feito: string, foto: string, erro?: string })
  const [evidenciasPendentes, setEvidenciasPendentes] = useState<
    Record<string, { foto: string; feito: string; feedback?: { tipo: 'ok' | 'erro'; msg: string } }>
  >({})

  // Toast state
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [feedbackRelatorio, setFeedbackRelatorio] = useState<{
    tipo: 'ok' | 'erro'
    msg: string
  } | null>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? null : curr))
    }, 3200)
  }

  // Close dropdown on outside click
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

  // Load initial data and RH collaborators
  useEffect(() => {
    let isMounted = true

    const carregar = async () => {
      try {
        const [dados, rh] = await Promise.all([
          carregarPlanosAcao(),
          carregarColaboradoresAtivosRH(),
        ])
        if (isMounted) {
          setRegistros(dados)
          setColaboradoresRH(rh)
          setCarregando(false)
          setCarregandoRH(false)
        }
      } catch (err) {
        console.error('Erro ao carregar planos de ação:', err)
        if (isMounted) {
          setCarregando(false)
          setCarregandoRH(false)
        }
      }
    }
    carregar()

    // Realtime sync for planos de ação
    const dbKey = getDbKeyPlano()
    const channel = supabase
      .channel(`rt_${dbKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'global_settings',
          filter: `key=eq.${dbKey}`,
        },
        (payload: any) => {
          if (payload?.new?.value && Array.isArray(payload.new.value)) {
            setRegistros(payload.new.value)
          }
        }
      )
      .subscribe()

    // Realtime sync for rh_efetivo
    const rhChannel = supabase
      .channel('rt_rh_plano_acao')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rh_efetivo' },
        async () => {
          const rhAtualizado = await carregarColaboradoresAtivosRH()
          if (isMounted) setColaboradoresRH(rhAtualizado)
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
      supabase.removeChannel(rhChannel)
    }
  }, [])

  // Filter collaborators for responsible field
  const colaboradoresFiltradosResp = useMemo(() => {
    const q = responsavel.trim().toLowerCase()
    if (!q) return colaboradoresRH.slice(0, 35)
    return colaboradoresRH.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        c.cargo.toLowerCase().includes(q) ||
        (c.matricula && c.matricula.toLowerCase().includes(q))
    )
  }, [colaboradoresRH, responsavel])

  // Persist helper
  const atualizarRegistros = async (novos: PlanoAcaoItem[]) => {
    setRegistros(novos)
    await salvarPlanosAcao(novos)
  }

  // Handle Create Form Submit
  const handleSalvarPlano = async (e: React.FormEvent) => {
    e.preventDefault()
    const novosInvalidos: Record<string, boolean> = {}
    const erros: string[] = []

    if (!origem) {
      erros.push('• Origem: selecione Desvio, Inspeção, Ocorrência, Auditoria, DDS ou Outro.')
      novosInvalidos.origem = true
    }
    if (!acao.trim()) {
      erros.push('• Ação a executar: descreva a ação.')
      novosInvalidos.acao = true
    }
    if (!responsavel.trim()) {
      erros.push('• Responsável: selecione ou informe quem vai executar a ação a partir do RH.')
      novosInvalidos.responsavel = true
    }
    if (!prazo) {
      erros.push('• Prazo: o prazo é obrigatório.')
      novosInvalidos.prazo = true
    }

    setInvalidCampos(novosInvalidos)

    if (erros.length) {
      setFeedbackForm({
        tipo: 'erro',
        msg: 'Não foi possível salvar. Corrija:\n' + erros.join('\n'),
      })
      return
    }

    const novoItem: PlanoAcaoItem = {
      id: `pa-${Date.now().toString(36)}-${Math.floor(Math.random() * 10000)}`,
      origem: origem as OrigemPlano,
      referencia: referencia.trim(),
      acao: acao.trim(),
      responsavel: responsavel.trim(),
      responsavelCargo: responsavelCargo.trim() || undefined,
      dataAbertura: dataAbertura || hojeISO(),
      prazo,
      prioridade: prioridadeSel,
      status: statusSel,
      observacoes: observacoes.trim(),
      feito: '',
      evidenciaFoto: '',
      concluidoEm: '',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    }

    const novos = [novoItem, ...registros]
    await atualizarRegistros(novos)

    const st = statusEfetivo(novoItem)
    const pi = prazoInfo(novoItem)
    setFeedbackForm({
      tipo: 'ok',
      msg: `✅ Plano de ação salvo! A ação entrou na lista abaixo como ${st}${isVencido(novoItem) ? ' (prazo já vencido — Atrasado)' : ''} — ${pi.texto}.`,
    })
    showToast('Plano de ação salvo')

    // Reset fields
    setOrigem('')
    setReferencia('')
    setAcao('')
    setResponsavel('')
    setResponsavelCargo('')
    setResponsavelDropdownOpen(false)
    setDataAbertura(hojeISO())
    setPrazo('')
    setPrioridadeSel('Média')
    setStatusSel('Pendente')
    setObservacoes('')
    setInvalidCampos({})
  }

  const handleLimparForm = () => {
    setOrigem('')
    setReferencia('')
    setAcao('')
    setResponsavel('')
    setResponsavelCargo('')
    setResponsavelDropdownOpen(false)
    setDataAbertura(hojeISO())
    setPrazo('')
    setPrioridadeSel('Média')
    setStatusSel('Pendente')
    setObservacoes('')
    setFeedbackForm(null)
    setInvalidCampos({})
  }

  // Handle Photo selection for conclusion
  const handleUploadFotoConclusao = async (id: string, file?: File) => {
    if (!file) return
    try {
      const dataUrl = await comprimirImagem(file, 1200, 0.78)
      setEvidenciasPendentes((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          foto: dataUrl,
          feito: prev[id]?.feito || '',
          feedback: {
            tipo: 'ok',
            msg: '📷 Foto da evidência anexada. Agora preencha “o que foi feito” e clique em Salvar conclusão.',
          },
        },
      }))
    } catch (err) {
      console.error('Erro ao ler foto:', err)
      setEvidenciasPendentes((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          feedback: {
            tipo: 'erro',
            msg: 'Erro ao processar imagem. Tente uma foto menor.',
          },
        },
      }))
    }
  }

  // Handle Conclude action
  const handleConcluirAcao = async (id: string) => {
    const pend = evidenciasPendentes[id] || { foto: '', feito: '' }
    const feito = (pend.feito || '').trim()
    const foto = pend.foto || ''
    const erros: string[] = []

    if (!foto) erros.push('• Falta a foto da evidência / conclusão.')
    if (!feito) erros.push('• Falta preencher “o que foi feito na conclusão”.')

    if (erros.length) {
      setEvidenciasPendentes((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          feedback: {
            tipo: 'erro',
            msg: 'Não foi possível concluir. Corrija:\n' + erros.join('\n'),
          },
        },
      }))
      return
    }

    const novos = registros.map((r) => {
      if (r.id === id) {
        return {
          ...r,
          status: 'Concluído' as StatusPlano,
          feito,
          evidenciaFoto: foto,
          concluidoEm: hojeISO(),
          atualizadoEm: new Date().toISOString(),
        }
      }
      return r
    })

    await atualizarRegistros(novos)
    setEvidenciasPendentes((prev) => {
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
    showToast('Ação concluída ✅')
  }

  // Handle Reopen action
  const handleReabrirAcao = async (id: string) => {
    const novos = registros.map((r) => {
      if (r.id === id) {
        return {
          ...r,
          status: 'Em andamento' as StatusPlano,
          feito: '',
          evidenciaFoto: '',
          concluidoEm: '',
          atualizadoEm: new Date().toISOString(),
        }
      }
      return r
    })
    await atualizarRegistros(novos)
    showToast('Ação reaberta (Em andamento)')
  }

  // Handle Delete action
  const handleExcluirAcao = async (id: string) => {
    if (!window.confirm('Tem certeza de que deseja excluir este plano de ação?')) return
    const novos = registros.filter((r) => r.id !== id)
    await atualizarRegistros(novos)
    setEvidenciasPendentes((prev) => {
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
    showToast('Registro excluído')
  }

  // Copy text report
  const handleCopiarRelatorio = () => {
    const txt = gerarTextoRelatorio(registros)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(
        () => {
          setFeedbackRelatorio({
            tipo: 'ok',
            msg: '✅ Relatório copiado como texto. Cole onde precisar (WhatsApp, e-mail, documento).',
          })
          showToast('Relatório copiado')
        },
        () => {
          setFeedbackRelatorio({
            tipo: 'erro',
            msg: 'Não foi possível copiar automaticamente neste navegador.',
          })
        }
      )
    } else {
      setFeedbackRelatorio({
        tipo: 'erro',
        msg: 'Área de transferência não suportada neste ambiente.',
      })
    }
  }

  // Filtered actions list
  const listaFiltrada = useMemo(() => {
    const q = buscaTexto.trim().toLowerCase()
    return registros.filter((r) => {
      const st = statusEfetivo(r)
      const venc = isVencido(r)

      if (filtroAtual === 'Pendentes' && st !== 'Pendente') return false
      if (filtroAtual === 'Em andamento' && st !== 'Em andamento') return false
      if (filtroAtual === 'Concluídos' && st !== 'Concluído') return false
      if (filtroAtual === 'Vencidos' && !venc) return false

      if (q) {
        const full = `${r.origem} ${r.referencia || ''} ${r.acao} ${r.responsavel} ${r.responsavelCargo || ''} ${r.observacoes || ''}`.toLowerCase()
        if (!full.includes(q)) return false
      }

      return true
    })
  }, [registros, filtroAtual, buscaTexto])

  // Statistics
  const total = registros.length
  const concluidas = registros.filter((r) => r.status === 'Concluído').length
  const vencidas = registros.filter(isVencido).length
  const percConcluidas = total ? Math.round((concluidas / total) * 100) : 0

  const contagemHelper = (chave: keyof PlanoAcaoItem, ordem: string[]) => {
    const m: Record<string, number> = {}
    registros.forEach((r) => {
      const k = String(r[chave] || '—')
      m[k] = (m[k] || 0) + 1
    })
    const ks = Object.keys(m)
    if (!ks.length) return 'Nenhuma ação registrada.'
    ks.sort((a, b) => (ordem.indexOf(a) + 1 || 99) - (ordem.indexOf(b) + 1 || 99) || m[b] - m[a])
    return ks
      .map((k) => `${k}: ${m[k]} (${total ? Math.round((m[k] / total) * 100) : 0}%)`)
      .join('  •  ')
  }

  const relStatusTexto = useMemo(() => {
    const mSt: Record<string, number> = {}
    registros.forEach((r) => {
      const s = statusEfetivo(r)
      mSt[s] = (mSt[s] || 0) + 1
    })
    const ks = Object.keys(mSt)
    return ks.length ? ks.map((k) => `${k}: ${mSt[k]}`).join('  •  ') : 'Nenhuma ação registrada.'
  }, [registros])

  const relVencimentosTexto = useMemo(() => {
    const abertas = registros
      .filter((r) => r.status !== 'Concluído')
      .slice()
      .sort((a, b) => (diasParaPrazo(a.prazo) ?? 9999) - (diasParaPrazo(b.prazo) ?? 9999))
      .slice(0, 5)

    return abertas.length
      ? abertas.map((r) => `${r.acao} — ${prazoInfo(r).texto}`).join('  •  ')
      : 'Nenhuma ação com prazo em aberto.'
  }, [registros])

  return (
    <div className="plano-acao-page w-full min-h-screen bg-white text-[#111827]">
      <style>{`
        .plano-acao-page * { box-sizing: border-box; }
        .plano-acao-page {
          font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
          color: #111827;
          background: #fff;
          padding: 18px 24px 90px;
          min-width: 0;
        }
        .plano-acao-page a { color: inherit; text-decoration: none; }
        .plano-acao-page button { font-family: inherit; cursor: pointer; }
        
        .plano-acao-page .crumb {
          margin: 12px 0 6px;
          color: #374151;
          font-size: 13px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .plano-acao-page .crumb b { color: #111; }
        .plano-acao-page h1 {
          font-size: 38px;
          letter-spacing: -.03em;
          color: #111;
          font-weight: 900;
          line-height: 1.15;
          margin-top: 4px;
        }
        .plano-acao-page .sub {
          color: #111827;
          font-weight: 500;
          margin: 8px 0 18px;
          line-height: 1.55;
          font-size: 15px;
        }
        .plano-acao-page .alert {
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-left: 6px solid #f59e0b;
          border-radius: 14px;
          padding: 14px 16px;
          margin-bottom: 18px;
        }
        .plano-acao-page .alert b { color: #92400e; }
        .plano-acao-page .alert p {
          font-size: 13.5px;
          color: #111;
          font-weight: 600;
          line-height: 1.5;
          margin-top: 3px;
        }
        .plano-acao-page .card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 22px;
          padding: 22px 24px;
          box-shadow: 0 8px 30px rgba(0,0,0,.05);
          margin-bottom: 20px;
        }
        .plano-acao-page .card h2 {
          font-size: 24px;
          font-weight: 900;
          color: #000;
          margin-bottom: 6px;
        }
        .plano-acao-page .card p.hint {
          color: #111827;
          font-size: 14.5px;
          font-weight: 600;
          line-height: 1.55;
          margin-bottom: 12px;
        }
        .plano-acao-page label {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: .03em;
          color: #000;
          display: block;
          margin: 14px 0 6px;
        }
        .plano-acao-page input,
        .plano-acao-page select,
        .plano-acao-page textarea {
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
        .plano-acao-page textarea { resize: vertical; min-height: 86px; }
        .plano-acao-page textarea.tall { min-height: 110px; }
        .plano-acao-page input:focus,
        .plano-acao-page select:focus,
        .plano-acao-page textarea:focus {
          border-color: #f5c518;
          box-shadow: 0 0 0 3px #fef3c7;
        }
        .plano-acao-page input::placeholder,
        .plano-acao-page textarea::placeholder {
          color: #374151 !important;
          opacity: 1;
          font-weight: 600;
        }
        .plano-acao-page select { color: #000; }
        .plano-acao-page select option { color: #000; background: #fff; font-weight: 700; }
        .plano-acao-page input[type="date"] { color: #000; font-weight: 700; }
        .plano-acao-page input[type="date"]::-webkit-datetime-edit { color: #000; font-weight: 700; }
        
        .plano-acao-page .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
        .plano-acao-page .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0 16px; }
        @media(max-width: 760px) {
          .plano-acao-page .grid2, .plano-acao-page .grid3 { grid-template-columns: 1fr; }
          .plano-acao-page h1 { font-size: 30px; }
        }

        .plano-acao-page .btn {
          border: 0;
          border-radius: 12px;
          padding: 13px 20px;
          font-weight: 800;
          font-size: 15px;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .plano-acao-page .btn-yellow { background: #f5c518; color: #111; }
        .plano-acao-page .btn-yellow:hover { background: #eab308; }
        .plano-acao-page .btn-dark { background: #111; color: #fff; }
        .plano-acao-page .btn-dark:hover { background: #262626; }
        .plano-acao-page .btn-ghost { background: #fff; border: 1.5px solid #9ca3af; color: #111; }
        .plano-acao-page .btn-ghost:hover { background: #f3f4f6; border-color: #111; }
        .plano-acao-page .btn-green { background: #16a34a; color: #fff; }
        .plano-acao-page .btn-green:hover { background: #15803d; }
        .plano-acao-page .btn-red { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
        .plano-acao-page .btn-red:hover { background: #fee2e2; }

        .plano-acao-page .prio { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .plano-acao-page .prio button {
          border: 1.5px solid #111;
          background: #fff;
          color: #000;
          font-weight: 800;
          border-radius: 999px;
          padding: 10px 6px;
          font-size: 14px;
          transition: 0.15s;
        }
        .plano-acao-page .prio button.on[data-p="Baixa"] { background: #22c55e; border-color: #22c55e; color: #fff; }
        .plano-acao-page .prio button.on[data-p="Média"] { background: #f5c518; border-color: #f5c518; color: #111; }
        .plano-acao-page .prio button.on[data-p="Alta"] { background: #f97316; border-color: #f97316; color: #fff; }
        .plano-acao-page .prio button.on[data-p="Crítica"] { background: #dc2626; border-color: #dc2626; color: #fff; }

        .plano-acao-page .status-pills { display: flex; gap: 8px; flex-wrap: wrap; }
        .plano-acao-page .spill {
          border: 1.5px solid #9ca3af;
          background: #fff;
          color: #000;
          font-weight: 800;
          font-size: 13px;
          border-radius: 999px;
          padding: 8px 16px;
          transition: 0.15s;
        }
        .plano-acao-page .spill:hover { border-color: #111; }
        .plano-acao-page .spill.on { background: #111827; border-color: #111827; color: #fff; }

        .plano-acao-page .feedback {
          border-radius: 14px;
          padding: 14px 16px;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.55;
          margin-top: 14px;
          white-space: pre-line;
        }
        .plano-acao-page .feedback.erro { background: #fef2f2; border: 2px solid #dc2626; color: #991b1b; }
        .plano-acao-page .feedback.ok { background: #f0fdf4; border: 2px solid #16a34a; color: #14532d; }
        .plano-acao-page .feedback.info { background: #fffbeb; border: 2px solid #f59e0b; color: #92400e; }
        .plano-acao-page .invalid-campo { border: 2.5px solid #dc2626 !important; background: #fef2f2 !important; }

        .plano-acao-page .lock-note {
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
        .plano-acao-page .lock-note b { color: #000; }

        .plano-acao-page .filters { display: flex; gap: 8px; flex-wrap: wrap; margin: 14px 0; }
        .plano-acao-page .filters button {
          border: 1.5px solid #111827;
          background: #fff;
          color: #000;
          font-weight: 800;
          border-radius: 999px;
          padding: 8px 16px;
          transition: 0.15s;
        }
        .plano-acao-page .filters button.on { background: #111827; color: #fff; }

        .plano-acao-page .acao {
          border: 2px solid #e5e7eb;
          border-left: 8px solid #2563eb;
          border-radius: 18px;
          padding: 18px 20px;
          margin-bottom: 14px;
          background: #fff;
          transition: box-shadow 0.2s ease;
        }
        .plano-acao-page .acao:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.06); }
        .plano-acao-page .acao.done { border-color: #bbf7d0; border-left-color: #16a34a; background: #f0fdf4; }
        .plano-acao-page .acao.overdue { border-color: #fecaca; border-left-color: #dc2626; background: #fef2f2; }
        .plano-acao-page .acao.doing { border-color: #bfdbfe; border-left-color: #2563eb; background: #eff6ff; }
        .plano-acao-page .acao h3 { font-size: 17px; font-weight: 900; color: #000; line-height: 1.4; }
        .plano-acao-page .acao p { color: #111827; font-size: 14px; line-height: 1.55; margin-top: 5px; font-weight: 600; }
        .plano-acao-page .meta { font-size: 13.5px; color: #111827; font-weight: 600; margin-top: 7px; line-height: 1.7; }
        
        .plano-acao-page .badge {
          display: inline-flex !important;
          align-items: center !important;
          width: auto !important;
          max-width: max-content !important;
          background: #fef3c7;
          color: #92400e;
          font-weight: 800 !important;
          font-size: 11px !important;
          padding: 6px 10px !important;
          border-radius: 999px !important;
          letter-spacing: .04em !important;
          text-transform: uppercase !important;
          margin: 2px 6px 2px 0 !important;
          box-shadow: none !important;
          border: none !important;
        }
        .plano-acao-page .badge.pend { background: #fee2e2 !important; color: #991b1b !important; }
        .plano-acao-page .badge.ok { background: #dcfce7 !important; color: #166534 !important; }
        .plano-acao-page .badge.crit { background: #dc2626 !important; color: #fff !important; }
        .plano-acao-page .badge.alta { background: #fee2e2 !important; color: #991b1b !important; }
        .plano-acao-page .badge.media { background: #fef3c7 !important; color: #92400e !important; }
        .plano-acao-page .badge.baixa { background: #dbeafe !important; color: #1e40af !important; }
        .plano-acao-page .badge.venc { background: #7f1d1d !important; color: #fff !important; }
        .plano-acao-page .badge.fluxo { background: #dbeafe !important; color: #1e40af !important; }
        .plano-acao-page .badge.origem { background: #111827 !important; color: #fff !important; }

        .plano-acao-page .prazo-line { font-weight: 800; font-size: 14px; margin-top: 8px; color: #000; }
        .plano-acao-page .prazo-line.vencido { color: #991b1b; }
        .plano-acao-page .prazo-line.hoje { color: #92400e; }
        .plano-acao-page .prazo-line.ok { color: #166534; }

        .plano-acao-page .conclusao { border-top: 1px dashed #9ca3af; margin-top: 14px; padding-top: 14px; }
        .plano-acao-page .conclusao h4 { font-size: 15.5px; font-weight: 900; color: #000; margin-bottom: 4px; }
        .plano-acao-page .photo {
          border: 2px dashed #6b7280;
          border-radius: 14px;
          padding: 16px;
          text-align: center;
          background: #fff;
          cursor: pointer;
          display: block;
          margin: 8px 0;
          transition: all 0.2s;
        }
        .plano-acao-page .photo:hover { border-color: #f5c518; background: #fffbeb; }
        .plano-acao-page .photo input { display: none; }
        .plano-acao-page .photo img { width: 100%; max-height: 240px; object-fit: cover; border-radius: 10px; }
        .plano-acao-page .photo .ph-txt { color: #000; font-size: 14px; font-weight: 600; line-height: 1.55; }
        
        .plano-acao-page .foto-box {
          border: 1.5px solid #9ca3af;
          border-radius: 14px;
          padding: 12px;
          background: #fff;
          margin-top: 10px;
        }
        .plano-acao-page .foto-box b {
          font-size: 12px;
          letter-spacing: .05em;
          text-transform: uppercase;
          color: #000;
          display: block;
          margin-bottom: 8px;
        }
        .plano-acao-page .foto-box img {
          width: 100%;
          max-height: 240px;
          object-fit: cover;
          border-radius: 10px;
          background: #f3f4f6;
          display: block;
        }

        .plano-acao-page .corr-feedback {
          border-radius: 12px;
          padding: 11px 13px;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.5;
          margin-top: 10px;
          white-space: pre-line;
        }
        .plano-acao-page .corr-feedback.erro { background: #fef2f2; border: 2px solid #dc2626; color: #991b1b; }
        .plano-acao-page .corr-feedback.ok { background: #f0fdf4; border: 2px solid #16a34a; color: #14532d; }

        .plano-acao-page .empty {
          border: 1px dashed #d1d5db;
          border-radius: 16px;
          padding: 26px;
          text-align: center;
          color: #374151;
          font-weight: 600;
          font-size: 14.5px;
          line-height: 1.6;
          background: #fff;
        }

        .plano-acao-page .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin: 16px 0;
        }
        @media(max-width: 640px) {
          .plano-acao-page .stats { grid-template-columns: repeat(2, 1fr); }
        }
        .plano-acao-page .stat {
          background: #f9fafb;
          border: 1.5px solid #e5e7eb;
          border-radius: 14px;
          padding: 14px;
          text-align: center;
        }
        .plano-acao-page .stat b { font-size: 28px; display: block; color: #000; font-weight: 900; }
        .plano-acao-page .stat span { font-size: 11.5px; color: #111; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; }

        .plano-acao-page .progress {
          height: 16px;
          background: #e5e7eb;
          border-radius: 999px;
          overflow: hidden;
          margin: 14px 0;
        }
        .plano-acao-page .progress i {
          display: block;
          height: 100%;
          background: #16a34a;
          border-radius: 999px;
          transition: width 0.4s ease;
        }

        .plano-acao-page .relatorio {
          border: 2px solid #111827;
          border-radius: 22px;
          padding: 22px;
          background: #fff;
        }
        .plano-acao-page .relatorio h2 { font-size: 24px; color: #000; font-weight: 900; }
        .plano-acao-page .rel-item { border-top: 1px solid #e5e7eb; padding: 12px 0; }
        .plano-acao-page .rel-item b { color: #000; font-size: 14px; }
        .plano-acao-page .rel-item p { font-size: 14px; font-weight: 600; color: #111827; line-height: 1.6; margin-top: 4px; }

        .plano-acao-page .toast-plano {
          position: fixed;
          left: 50%;
          bottom: 24px;
          transform: translateX(-50%);
          background: #111;
          color: #fff;
          padding: 12px 20px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 700;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          z-index: 1000;
          max-width: 92vw;
          text-align: center;
          animation: fadeInSlide 0.3s ease;
        }
        @keyframes fadeInSlide {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }

        .plano-acao-page footer {
          color: #374151;
          font-weight: 600;
          font-size: 12.5px;
          text-align: center;
          margin-top: 32px;
          line-height: 1.6;
        }

        @media print {
          .noprint, .plano-acao-page .crumb, .plano-acao-page .alert, .plano-acao-page .filters {
            display: none !important;
          }
          .plano-acao-page { padding: 0 !important; margin: 0 !important; }
        }
      `}</style>

      {/* Breadcrumb & Navigation */}
      <div className="crumb noprint">
        <Link
          to="/seguranca"
          className="hover:underline flex items-center gap-1.5 font-bold text-[#111827]"
        >
          <ArrowLeft className="w-4 h-4 text-[#111827]" />
          Segurança
        </Link>
        <span>&nbsp;›&nbsp;</span>
        <b>Plano de Ação</b>
      </div>

      <h1>✅ Plano de Ação</h1>
      <p className="sub">
        Transforme <b>desvios, inspeções, ocorrências, auditorias e DDS</b> em ações com{' '}
        <b>responsável, prazo e prioridade</b> — e acompanhe cada uma até a conclusão, com{' '}
        <b>evidência</b>. Uma ação só vira <b>Concluída</b> depois de anexar a{' '}
        <b>foto da conclusão</b>, preencher <b>“o que foi feito”</b> e clicar em{' '}
        <b>Salvar conclusão</b>.
      </p>

      {/* Cloud DB Banner */}
      <div className="alert noprint">
        <div className="flex items-center gap-2">
          <Cloud className="w-5 h-5 text-[#b45309]" />
          <b>Sistema Conectado ao Banco de Dados (Supabase).</b>
        </div>
        <p>
          Os registros são salvos com segurança no banco de dados e sincronizados em tempo real.
          Qualquer alteração feita por você ou outro usuário é refletida instantaneamente.
        </p>
      </div>

      {/* Form: Novo Plano de Ação */}
      <section className="card noprint" id="novoPlano">
        <h2>➕ Novo Plano de Ação</h2>
        <p className="hint">
          Preencha os campos abaixo. O <b>prazo é obrigatório</b> — sem ele a ação não é salva.
        </p>

        <form onSubmit={handleSalvarPlano} noValidate>
          <div className="grid2">
            <div>
              <label htmlFor="origem">ORIGEM *</label>
              <select
                id="origem"
                value={origem}
                onChange={(e) => {
                  setOrigem(e.target.value)
                  if (invalidCampos.origem) {
                    setInvalidCampos((prev) => ({ ...prev, origem: false }))
                  }
                }}
                className={invalidCampos.origem ? 'invalid-campo' : ''}
                required
              >
                <option value="">Selecione a origem…</option>
                {ORIGENS_PLANO.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="referencia">REFERÊNCIA / Nº (OPCIONAL)</label>
              <input
                id="referencia"
                type="text"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="Ex.: nº do desvio, da inspeção ou da ocorrência"
              />
            </div>
          </div>

          <div>
            <label htmlFor="acao">AÇÃO A EXECUTAR *</label>
            <textarea
              id="acao"
              className={`tall ${invalidCampos.acao ? 'invalid-campo' : ''}`}
              value={acao}
              onChange={(e) => {
                setAcao(e.target.value)
                if (invalidCampos.acao) {
                  setInvalidCampos((prev) => ({ ...prev, acao: false }))
                }
              }}
              placeholder="Descreva a ação que precisa ser executada…"
            />
          </div>

          <div className="grid3">
            {/* Responsável com busca no efetivo do RH */}
            <div className="relative z-30" ref={responsavelBoxRef}>
              <label htmlFor="responsavel">RESPONSÁVEL (EFETIVO RH) *</label>
              <div className="relative">
                <input
                  id="responsavel"
                  type="text"
                  value={responsavel}
                  onFocus={() => setResponsavelDropdownOpen(true)}
                  onChange={(e) => {
                    setResponsavel(e.target.value)
                    setResponsavelCargo('')
                    setResponsavelDropdownOpen(true)
                    if (invalidCampos.responsavel) {
                      setInvalidCampos((prev) => ({ ...prev, responsavel: false }))
                    }
                  }}
                  className={invalidCampos.responsavel ? 'invalid-campo pr-9' : 'pr-9'}
                  placeholder="Buscar colaborador ativo no RH..."
                  autoComplete="off"
                />
                <Search className="w-4 h-4 text-gray-400 absolute right-3 top-3.5 pointer-events-none" />
              </div>

              {responsavelCargo && (
                <div className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                  <span className="text-blue-600 font-extrabold">✓ Efetivo RH:</span>
                  <span className="font-semibold text-gray-800 truncate">{responsavelCargo}</span>
                </div>
              )}

              {/* Dropdown de Colaboradores do RH */}
              {responsavelDropdownOpen && (
                <div className="absolute z-50 left-0 w-80 sm:w-96 max-w-[92vw] mt-1 bg-white border-2 border-[#111827] rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                  <div className="p-2 text-[11px] font-extrabold text-gray-700 uppercase tracking-wider bg-amber-50 border-b border-amber-200 flex items-center justify-between sticky top-0 z-10">
                    <span>👥 Colaboradores Ativos no RH ({colaboradoresFiltradosResp.length})</span>
                    {carregandoRH && (
                      <span className="text-amber-700 animate-pulse font-bold">Carregando...</span>
                    )}
                  </div>
                  {colaboradoresFiltradosResp.length === 0 ? (
                    <div className="p-3 text-xs text-gray-600 text-center font-medium">
                      Nenhum colaborador encontrado com esse termo.
                      <div className="mt-1 text-[11px] text-gray-500">
                        Você pode digitar o nome livremente no campo acima.
                      </div>
                    </div>
                  ) : (
                    colaboradoresFiltradosResp.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setResponsavel(c.nome)
                          setResponsavelCargo(c.cargo)
                          setResponsavelDropdownOpen(false)
                          if (invalidCampos.responsavel) {
                            setInvalidCampos((prev) => ({ ...prev, responsavel: false }))
                          }
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-amber-100/80 border-b border-gray-100 last:border-0 transition flex flex-col items-start gap-0.5 cursor-pointer"
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="text-sm font-bold text-black truncate">{c.nome}</span>
                          <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0">
                            ATIVO
                          </span>
                        </div>
                        <span className="text-xs text-gray-700 font-semibold truncate w-full">
                          {c.cargo} {c.matricula ? `• Matrícula: ${c.matricula}` : ''}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="dataAbertura">DATA DE ABERTURA</label>
              <input
                id="dataAbertura"
                type="date"
                value={dataAbertura}
                onChange={(e) => setDataAbertura(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="prazo">PRAZO (OBRIGATÓRIO) *</label>
              <input
                id="prazo"
                type="date"
                value={prazo}
                onChange={(e) => {
                  setPrazo(e.target.value)
                  if (invalidCampos.prazo) {
                    setInvalidCampos((prev) => ({ ...prev, prazo: false }))
                  }
                }}
                className={invalidCampos.prazo ? 'invalid-campo' : ''}
                required
              />
            </div>
          </div>

          <div className="grid2">
            <div>
              <label>PRIORIDADE *</label>
              <div className="prio" id="prioBtns">
                {PRIORIDADES_PLANO.map((p) => (
                  <button
                    key={p}
                    type="button"
                    data-p={p}
                    className={prioridadeSel === p ? 'on' : ''}
                    onClick={() => setPrioridadeSel(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label>STATUS INICIAL</label>
              <div className="status-pills" id="statusPills">
                <button
                  type="button"
                  data-s="Pendente"
                  className={`spill ${statusSel === 'Pendente' ? 'on' : ''}`}
                  onClick={() => {
                    setStatusSel('Pendente')
                    setFeedbackForm(null)
                  }}
                >
                  Pendente
                </button>
                <button
                  type="button"
                  data-s="Em andamento"
                  className={`spill ${statusSel === 'Em andamento' ? 'on' : ''}`}
                  onClick={() => {
                    setStatusSel('Em andamento')
                    setFeedbackForm(null)
                  }}
                >
                  Em andamento
                </button>
                <button
                  type="button"
                  data-s="Concluído"
                  className="spill opacity-60"
                  onClick={() => {
                    setFeedbackForm({
                      tipo: 'info',
                      msg: '“Concluído” não pode ser marcado aqui.\nUma ação só vira Concluída na lista abaixo, com foto da evidência + “o que foi feito” + Salvar conclusão.',
                    })
                  }}
                >
                  Concluído
                </button>
                <button
                  type="button"
                  data-s="Atrasado"
                  className="spill opacity-60"
                  onClick={() => {
                    setFeedbackForm({
                      tipo: 'info',
                      msg: '“Atrasado” é automático: ele aparece sozinho quando o prazo vence sem a ação estar concluída.\nEscolha Pendente ou Em andamento como status inicial.',
                    })
                  }}
                >
                  Atrasado
                </button>
              </div>
              <p className="lock-note">
                <b>Regra:</b> “Concluído” <b>não</b> pode ser marcado aqui — ele só aparece depois
                da conclusão com foto + “o que foi feito” + <b>Salvar conclusão</b>. “Atrasado” é
                automático quando o prazo vence sem conclusão.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="observacoes">OBSERVAÇÕES (OPCIONAL)</label>
            <textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Detalhes, local, área, orientação complementar…"
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
            <button className="btn btn-yellow" type="submit">
              💾 Salvar plano de ação
            </button>
            <button className="btn btn-ghost" type="button" onClick={handleLimparForm}>
              Limpar formulário
            </button>
          </div>

          {feedbackForm && (
            <div className={`feedback ${feedbackForm.tipo}`} role="alert">
              {feedbackForm.msg}
            </div>
          )}
        </form>
      </section>

      {/* Ações Registradas */}
      <section className="card noprint">
        <h2>📋 Ações registradas</h2>
        <p className="hint">
          Use os filtros para acompanhar o que está pendente, em andamento, concluído ou vencido. O
          prazo mostra a contagem automática: <b>“Faltam X dias”</b>, <b>“Vence hoje”</b> ou{' '}
          <b>“VENCIDO”</b>.
        </p>

        {/* Busca rápida */}
        <div style={{ marginTop: '10px', marginBottom: '8px' }}>
          <input
            type="text"
            placeholder="🔍 Buscar por ação, responsável, cargo, origem ou referência..."
            value={buscaTexto}
            onChange={(e) => setBuscaTexto(e.target.value)}
            style={{ fontWeight: 600, fontSize: '14.5px' }}
          />
        </div>

        {/* Filtros rápidos */}
        <div className="filters" id="filtros">
          {['Todos', 'Pendentes', 'Em andamento', 'Concluídos', 'Vencidos'].map((f) => (
            <button
              key={f}
              type="button"
              className={filtroAtual === f ? 'on' : ''}
              onClick={() => setFiltroAtual(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Lista de Ações */}
        <div id="listaAcoes">
          {carregando ? (
            <div className="empty">Carregando planos de ação do banco de dados...</div>
          ) : !listaFiltrada.length ? (
            <div className="empty">
              {registros.length
                ? 'Nenhuma ação neste filtro. Ajuste o filtro ou busca acima para ver as demais ações.'
                : 'Nenhum plano de ação registrado ainda.\nPreencha o formulário acima e clique em “Salvar plano de ação”.'}
            </div>
          ) : (
            listaFiltrada.map((r) => {
              const st = statusEfetivo(r)
              const pi = prazoInfo(r)
              const venc = isVencido(r)
              const cardCls =
                r.status === 'Concluído' ? 'done' : venc ? 'overdue' : st === 'Em andamento' ? 'doing' : ''

              const pendFoto = evidenciasPendentes[r.id]?.foto
              const pendFeito = evidenciasPendentes[r.id]?.feito ?? ''
              const pendFb = evidenciasPendentes[r.id]?.feedback

              return (
                <article key={r.id} className={`acao ${cardCls}`} data-id={r.id}>
                  <div>
                    {st === 'Concluído' ? (
                      <span className="badge ok">Concluído</span>
                    ) : st === 'Atrasado' ? (
                      <span className="badge venc">Atrasado / Vencido</span>
                    ) : st === 'Em andamento' ? (
                      <span className="badge fluxo">Em andamento</span>
                    ) : (
                      <span className="badge pend">Pendente</span>
                    )}

                    {r.prioridade === 'Crítica' ? (
                      <span className="badge crit">Crítica</span>
                    ) : r.prioridade === 'Alta' ? (
                      <span className="badge alta">Alta</span>
                    ) : r.prioridade === 'Média' ? (
                      <span className="badge media">Média</span>
                    ) : (
                      <span className="badge baixa">Baixa</span>
                    )}

                    <span className="badge origem">{r.origem}</span>
                  </div>

                  <h3 style={{ marginTop: '8px' }}>{r.acao}</h3>

                  <div className="meta">
                    👤 <b>Responsável:</b> {r.responsavel}
                    {r.responsavelCargo && (
                      <span className="text-gray-600 font-semibold"> ({r.responsavelCargo})</span>
                    )}{' '}
                    &nbsp;•&nbsp; 📅 <b>Abertura:</b> {fmtData(r.dataAbertura)} &nbsp;•&nbsp; ⏰{' '}
                    <b>Prazo:</b> {fmtData(r.prazo)}
                    {r.referencia && (
                      <>
                        {' '}
                        &nbsp;•&nbsp; 🔖 <b>Ref.:</b> {r.referencia}
                      </>
                    )}
                  </div>

                  {r.observacoes && <p>📝 {r.observacoes}</p>}

                  <div className={`prazo-line ${pi.classe}`}>{pi.texto}</div>

                  {r.status === 'Concluído' ? (
                    <div className="conclusao">
                      <h4>✅ Conclusão registrada em {fmtData(r.concluidoEm)}</h4>
                      <p>
                        <b>O que foi feito:</b> {r.feito || 'Ação executada.'}
                      </p>
                      {r.evidenciaFoto && (
                        <div className="foto-box">
                          <b>📷 Evidência / foto da conclusão</b>
                          <img src={r.evidenciaFoto} alt="Foto da conclusão" />
                        </div>
                      )}
                      <div
                        style={{
                          display: 'flex',
                          gap: '10px',
                          flexWrap: 'wrap',
                          marginTop: '12px',
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => handleReabrirAcao(r.id)}
                        >
                          ↩ Reabrir ação
                        </button>
                        <button
                          type="button"
                          className="btn btn-red"
                          onClick={() => handleExcluirAcao(r.id)}
                        >
                          🗑 Excluir registro
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="conclusao">
                      <h4>🏁 Concluir esta ação</h4>
                      <p style={{ fontSize: '13.5px' }}>
                        Para concluir é obrigatório: <b>foto da evidência</b> +{' '}
                        <b>“o que foi feito”</b> + clicar em <b>Salvar conclusão</b>. Sem isso a
                        ação continua Pendente / Em andamento.
                      </p>

                      <label htmlFor={`feito-${r.id}`}>O QUE FOI FEITO NA CONCLUSÃO *</label>
                      <textarea
                        id={`feito-${r.id}`}
                        value={pendFeito}
                        onChange={(e) =>
                          setEvidenciasPendentes((prev) => ({
                            ...prev,
                            [r.id]: {
                              ...prev[r.id],
                              feito: e.target.value,
                              foto: prev[r.id]?.foto || '',
                            },
                          }))
                        }
                        placeholder="Descreva o que foi feito para concluir esta ação…"
                      />

                      <label>FOTO DA EVIDÊNCIA / CONCLUSÃO *</label>
                      <label className={`photo ${pendFoto ? 'has' : ''}`}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleUploadFotoConclusao(r.id, e.target.files[0])
                            }
                          }}
                        />
                        {pendFoto ? (
                          <div>
                            <img src={pendFoto} alt="Evidência" />
                            <span
                              style={{
                                display: 'block',
                                marginTop: '6px',
                                fontSize: '12px',
                                fontWeight: 700,
                                color: '#2563eb',
                              }}
                            >
                              Clique para trocar de foto
                            </span>
                          </div>
                        ) : (
                          <span className="ph-txt">
                            📷 <b>Clique para anexar a foto da conclusão</b>
                            <br />
                            Foto da ação executada / evidência do que foi corrigido.
                          </span>
                        )}
                      </label>

                      <div
                        style={{
                          display: 'flex',
                          gap: '10px',
                          flexWrap: 'wrap',
                          marginTop: '12px',
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-green"
                          onClick={() => handleConcluirAcao(r.id)}
                        >
                          ✅ Salvar conclusão
                        </button>
                        <button
                          type="button"
                          className="btn btn-red"
                          onClick={() => handleExcluirAcao(r.id)}
                        >
                          🗑 Excluir registro
                        </button>
                      </div>

                      {pendFb && (
                        <div className={`corr-feedback ${pendFb.tipo}`} role="alert">
                          {pendFb.msg}
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

      {/* Relatório Automático */}
      <section className="card relatorio" id="relatorioSec">
        <h2>📊 Relatório automático — Plano de Ação</h2>
        <p className="hint">Atualiza sozinho a cada ação salva, concluída ou excluída.</p>

        <div className="stats">
          <div className="stat">
            <b>{total}</b>
            <span>Total de ações</span>
          </div>
          <div className="stat">
            <b>{concluidas}</b>
            <span>Concluídas</span>
          </div>
          <div className="stat">
            <b>{percConcluidas}%</b>
            <span>% concluído</span>
          </div>
          <div className="stat">
            <b>{vencidas}</b>
            <span>Vencidas</span>
          </div>
        </div>

        <div className="progress">
          <i style={{ width: `${percConcluidas}%` }} />
        </div>

        <div className="rel-item">
          <b>Por prioridade</b>
          <p>{contagemHelper('prioridade', ['Crítica', 'Alta', 'Média', 'Baixa'])}</p>
        </div>

        <div className="rel-item">
          <b>Por origem</b>
          <p>
            {contagemHelper('origem', [
              'Desvio',
              'Inspeção',
              'Ocorrência',
              'Auditoria',
              'DDS',
              'Outro',
            ])}
          </p>
        </div>

        <div className="rel-item">
          <b>Por status</b>
          <p>{relStatusTexto}</p>
        </div>

        <div className="rel-item">
          <b>Próximos vencimentos</b>
          <p>{relVencimentosTexto}</p>
        </div>

        <div
          style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}
          className="noprint"
        >
          <button className="btn btn-dark" type="button" onClick={() => window.print()}>
            🖨️ Imprimir / Salvar em PDF
          </button>
          <button className="btn btn-yellow" type="button" onClick={handleCopiarRelatorio}>
            📋 Copiar relatório (texto)
          </button>
        </div>

        {feedbackRelatorio && (
          <div className={`feedback ${feedbackRelatorio.tipo}`} role="alert">
            {feedbackRelatorio.msg}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer>
        Hydro Reabilitação — Sucena • Segurança › Plano de Ação • Registros sincronizados com o
        Banco de Dados (Supabase).
      </footer>

      {/* Toast */}
      {toastMsg && <div className="toast-plano">{toastMsg}</div>}
    </div>
  )
}
