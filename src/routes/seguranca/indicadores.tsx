import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  type IndicadorConfig,
  type IndicadoresStore,
  INDICADORES_LISTA,
  EXEMPLO_INDICADORES,
  fmtMes,
  prevMes,
  mesAtualISO,
  fmtNum,
  statusDe,
  variacaoTxt,
  calcularTFTG,
  gerarTextoRelatorioIndicadores,
  carregarIndicadoresStore,
  salvarIndicadoresStore,
  getDbKeyIndicadores,
} from '../../lib/indicadoresData'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Cloud, BarChart3, Printer, Copy, Sparkles, Save, RotateCcw, Calculator, Trash2 } from 'lucide-react'

export const Route = createFileRoute('/seguranca/indicadores')({
  component: IndicadoresComponent,
})

export function IndicadoresComponent() {
  const [store, setStore] = useState<IndicadoresStore>({})
  const [carregando, setCarregando] = useState(true)

  // Meses ativos
  const [mesInput, setMesInput] = useState<string>(mesAtualISO())
  const [mesExibir, setMesExibir] = useState<string>(mesAtualISO())

  // Campos do formulário
  const [valoresForm, setValoresForm] = useState<Record<string, string>>({})
  const [metasForm, setMetasForm] = useState<Record<string, string>>({})
  const [invalidosCampos, setInvalidosCampos] = useState<Record<string, boolean>>({})

  // Calculadora
  const [hht, setHht] = useState<string>('')
  const [diasPerdidos, setDiasPerdidos] = useState<string>('')

  // Gráfico e filtros
  const [graficoInd, setGraficoInd] = useState<string>('tf')
  const [filtroAno, setFiltroAno] = useState<string>('')
  const [buscaHistorico, setBuscaHistorico] = useState<string>('')

  // Feedbacks e toasters
  const [formFeedback, setFormFeedback] = useState<{ tipo: 'ok' | 'erro' | 'info'; msg: string } | null>(null)
  const [relFeedback, setRelFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [confirmExcluir, setConfirmExcluir] = useState<Record<string, boolean>>({})

  const formRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? null : curr))
    }, 2800)
  }

  // Obter última meta registrada para um indicador
  const ultimaMeta = (indId: string, currentStore = store): number | null => {
    const meses = Object.keys(currentStore).sort()
    for (let i = meses.length - 1; i >= 0; i--) {
      const r = currentStore[meses[i]]
      if (r?.metas && r.metas[indId] != null && !isNaN(r.metas[indId]!)) {
        return r.metas[indId]!
      }
    }
    return null
  }

  // Preencher campos do form para um mês
  const preencherFormParaMes = (m: string, currentStore = store) => {
    const rec = currentStore[m]
    const novosValores: Record<string, string> = {}
    const novasMetas: Record<string, string> = {}

    INDICADORES_LISTA.forEach((ind) => {
      const v = rec?.valores?.[ind.id]
      novosValores[ind.id] = v !== undefined && v !== null ? String(v) : ''

      const mVal = rec?.metas?.[ind.id]
      const metaPad = mVal !== undefined && mVal !== null ? mVal : ultimaMeta(ind.id, currentStore) ?? ind.metaPadrao
      novasMetas[ind.id] = String(metaPad)
    })

    setValoresForm(novosValores)
    setMetasForm(novasMetas)
    setInvalidosCampos({})
  }

  // Carregar dados iniciais e escutar mudanças no Supabase
  useEffect(() => {
    let isMounted = true

    const inicializar = async () => {
      try {
        setCarregando(true)
        const dados = await carregarIndicadoresStore()
        if (isMounted) {
          setStore(dados)
          const mAtual = mesAtualISO()
          preencherFormParaMes(mAtual, dados)
        }
      } catch (err) {
        console.error('[Indicadores] Falha ao carregar:', err)
      } finally {
        if (isMounted) {
          setCarregando(false)
        }
      }
    }

    inicializar()

    // Realtime channel
    const dbKey = getDbKeyIndicadores()
    const channel = supabase
      .channel(`indicadores-realtime-${Date.now()}`)
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
            const novaStore = payload.new.value as IndicadoresStore
            setStore(novaStore)
          }
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [])

  // Ao alterar mesInput, atualiza formulário
  const handleMesInputChange = (novoMes: string) => {
    setMesInput(novoMes)
    if (novoMes) {
      preencherFormParaMes(novoMes)
    }
  }

  // Salvar mês no banco
  const salvarMes = async () => {
    setFormFeedback(null)
    setInvalidosCampos({})

    const faltas: string[] = []
    const invalidos: string[] = []
    const novInvalidos: Record<string, boolean> = {}

    if (!mesInput) {
      faltas.push('MÊS / ANO')
      novInvalidos['mesInput'] = true
    }

    const valores: Record<string, number> = {}
    const metas: Record<string, number> = {}
    let temValor = false

    INDICADORES_LISTA.forEach((ind) => {
      const vStr = String(valoresForm[ind.id] ?? '').trim()
      const mStr = String(metasForm[ind.id] ?? '').trim()

      if (vStr !== '') {
        const vNum = Number(vStr.replace(',', '.'))
        if (isNaN(vNum)) {
          invalidos.push(`${ind.nome} (valor inválido)`)
          novInvalidos[`v-${ind.id}`] = true
        } else if (vNum < 0) {
          invalidos.push(`${ind.nome} (valor negativo)`)
          novInvalidos[`v-${ind.id}`] = true
        } else {
          valores[ind.id] = vNum
          temValor = true
        }
      }

      if (mStr !== '') {
        const mNum = Number(mStr.replace(',', '.'))
        if (isNaN(mNum)) {
          invalidos.push(`Meta de ${ind.nome} (inválida)`)
          novInvalidos[`m-${ind.id}`] = true
        } else if (mNum < 0) {
          invalidos.push(`Meta de ${ind.nome} (negativa)`)
          novInvalidos[`m-${ind.id}`] = true
        } else {
          metas[ind.id] = mNum
        }
      } else {
        metas[ind.id] = ind.metaPadrao
      }
    })

    if (!temValor) {
      faltas.push('pelo menos UM VALOR de indicador')
    }

    if (faltas.length || invalidos.length) {
      setInvalidosCampos(novInvalidos)
      let msg = '⚠️ NÃO SALVOU — '
      if (faltas.length) msg += 'falta preencher: ' + faltas.join(', ') + '. '
      if (invalidos.length) msg += 'Corrija: ' + invalidos.join('; ') + '.'
      setFormFeedback({ tipo: 'erro', msg })
      return
    }

    const jaExistia = !!store[mesInput]
    const novaStore: IndicadoresStore = {
      ...store,
      [mesInput]: {
        valores,
        metas,
        salvoEm: new Date().toISOString(),
      },
    }

    setStore(novaStore)
    setMesExibir(mesInput)

    const ok = await salvarIndicadoresStore(novaStore)

    setFormFeedback({
      tipo: 'ok',
      msg: `✅ MÊS ${fmtMes(mesInput).toUpperCase()} SALVO${jaExistia ? ' (valores atualizados)' : ''}!\nOs cards, o gráfico, o histórico e o relatório mensal foram atualizados.${
        ok ? ' Sincronizado no Supabase.' : '\n(Salvo localmente neste aparelho)'
      }`,
    })
    showToast(`✅ Mês ${fmtMes(mesInput)} salvo — relatório atualizado`)

    setTimeout(() => {
      cardsRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 400)
  }

  // Preencher exemplo fictício
  const preencherExemplo = () => {
    const novosValores: Record<string, string> = {}
    const novasMetas: Record<string, string> = {}
    INDICADORES_LISTA.forEach((ind) => {
      novosValores[ind.id] = String(EXEMPLO_INDICADORES[ind.id] ?? '')
      novasMetas[ind.id] = String(ind.metaPadrao)
    })
    setValoresForm(novosValores)
    setMetasForm(novasMetas)
    setFormFeedback({
      tipo: 'info',
      msg: '✨ Formulário preenchido com VALORES DE EXEMPLO (fictícios, só para testar a página).\nNada foi salvo ainda — confira, altere o que quiser e clique em Salvar mês para guardar. Apague os valores de exemplo antes de usar com dados reais.',
    })
  }

  // Limpar formulário
  const limparForm = () => {
    const novasMetas: Record<string, string> = {}
    INDICADORES_LISTA.forEach((ind) => {
      novasMetas[ind.id] = String(ind.metaPadrao)
    })
    setValoresForm({})
    setMetasForm(novasMetas)
    setHht('')
    setDiasPerdidos('')
    setInvalidosCampos({})
    setFormFeedback(null)
  }

  // Calcular TF / TG
  const calcularTF_TG = () => {
    const hhtNum = Number(hht.replace(',', '.'))
    const diasNum = Number(diasPerdidos.replace(',', '.'))
    const acidStr = String(valoresForm['acidentes'] ?? '').trim()
    const acidNum = acidStr !== '' ? Number(acidStr.replace(',', '.')) : NaN

    const erros: string[] = []
    if (!hht || isNaN(hhtNum) || hhtNum <= 0) erros.push('informe a HHT (maior que zero)')
    if (acidStr === '' || isNaN(acidNum) || acidNum < 0) erros.push('informe o Nº DE ACIDENTES acima')
    if (diasPerdidos === '' || isNaN(diasNum) || diasNum < 0) erros.push('informe os DIAS PERDIDOS (use 0 se não houve)')

    if (erros.length) {
      setFormFeedback({ tipo: 'erro', msg: `⚠️ NÃO CALCULOU — ${erros.join('; ')}.` })
      return
    }

    const { tf, tg } = calcularTFTG(hhtNum, acidNum, diasNum)
    setValoresForm((prev) => ({
      ...prev,
      tf: tf.toFixed(2),
      tg: tg.toFixed(2),
    }))

    setFormFeedback({
      tipo: 'ok',
      msg: `🧮 TF e TG calculados: TF = ${fmtNum(tf, 2)} • TG = ${fmtNum(tg, 2)}.\nConfira os valores e clique em Salvar mês para guardar.`,
    })
  }

  // Carregar mês do histórico
  const carregarMesHistorico = (m: string) => {
    setMesInput(m)
    setMesExibir(m)
    preencherFormParaMes(m)
    setFormFeedback({
      tipo: 'info',
      msg: `📂 Mês ${fmtMes(m)} carregado no formulário para editar. Altere os valores e clique em Salvar mês.`,
    })
    formRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Excluir mês do histórico
  const excluirMesHistorico = async (m: string) => {
    if (!confirmExcluir[m]) {
      setConfirmExcluir({ [m]: true })
      setTimeout(() => {
        setConfirmExcluir((curr) => ({ ...curr, [m]: false }))
      }, 4000)
      return
    }

    const novaStore = { ...store }
    delete novaStore[m]
    setStore(novaStore)
    setConfirmExcluir((curr) => ({ ...curr, [m]: false }))

    if (mesExibir === m) {
      const rest = Object.keys(novaStore).sort()
      const novoExibir = rest.length ? rest[rest.length - 1] : mesAtualISO()
      setMesExibir(novoExibir)
      setMesInput(novoExibir)
      preencherFormParaMes(novoExibir, novaStore)
    }

    await salvarIndicadoresStore(novaStore)
    showToast(`Mês ${fmtMes(m)} excluído — relatório atualizado`)
  }

  // Copiar relatório
  const copiarRelatorio = () => {
    const txt = gerarTextoRelatorioIndicadores(store, mesExibir)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(() => {
        setRelFeedback({
          tipo: 'ok',
          msg: `📋 Relatório de ${fmtMes(mesExibir)} copiado! Cole onde quiser (WhatsApp, e-mail, documento).`,
        })
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
      setRelFeedback({
        tipo: 'ok',
        msg: `📋 Relatório de ${fmtMes(mesExibir)} copiado! Cole onde quiser.`,
      })
      showToast('📋 Relatório copiado!')
    } catch {
      setRelFeedback({
        tipo: 'erro',
        msg: '⚠️ Não foi possível copiar automaticamente. Selecione o texto na tela e copie com Ctrl+C.',
      })
    }
  }

  // Dados do mês em exibição
  const recExibir = store[mesExibir]
  const recAnterior = store[prevMes(mesExibir)]

  // Lista de anos disponíveis para filtro
  const anosDisponiveis = useMemo(() => {
    const anos = new Set<string>()
    Object.keys(store).forEach((m) => {
      const a = m.split('-')[0]
      if (a) anos.add(a)
    })
    return Array.from(anos).sort().reverse()
  }, [store])

  // Meses ordenados para histórico
  const mesesHistorico = useMemo(() => {
    const meses = Object.keys(store).sort().reverse()
    const q = buscaHistorico.trim().toLowerCase()

    return meses.filter((m) => {
      if (filtroAno && m.split('-')[0] !== filtroAno) return false
      if (q) {
        const r = store[m]
        const valoresTxt = INDICADORES_LISTA.map((ind) => fmtNum(r?.valores?.[ind.id], ind.casas)).join(' ')
        const txtCompleto = `${fmtMes(m)} ${valoresTxt}`.toLowerCase()
        if (!txtCompleto.includes(q)) return false
      }
      return true
    })
  }, [store, filtroAno, buscaHistorico])

  // Gráfico de evolução dos últimos 12 meses
  const dadosGrafico = useMemo(() => {
    const meses = Object.keys(store).sort().slice(-12)
    const indAtual = INDICADORES_LISTA.find((x) => x.id === graficoInd) || INDICADORES_LISTA[0]
    if (!meses.length) return null

    const valores = meses.map((m) => {
      const r = store[m]
      const v = r?.valores?.[indAtual.id]
      return v !== undefined && v !== null ? v : null
    })

    const metas = meses.map((m) => {
      const r = store[m]
      const met = r?.metas?.[indAtual.id]
      return met !== undefined && met !== null ? met : indAtual.metaPadrao
    })

    const recEx = store[mesExibir]
    const metaEx = recEx?.metas?.[indAtual.id] ?? ultimaMeta(indAtual.id) ?? indAtual.metaPadrao

    const numeros = valores.filter((v): v is number => v !== null)
    const maxV = Math.max(...numeros, metaEx || 0, 1)
    const metaPct = maxV > 0 ? (metaEx / maxV) * 100 : 0

    return {
      meses,
      valores,
      metas,
      metaEx,
      metaPct,
      maxV,
      indAtual,
    }
  }, [store, graficoInd, mesExibir])

  // Estatísticas do relatório
  const statsRelatorio = useMemo(() => {
    if (!recExibir) {
      return {
        dentro: 0,
        comDados: 0,
        acidentes: '—',
        dds: '—',
        inspecoes: '—',
      }
    }

    let dentro = 0
    let comDados = 0
    INDICADORES_LISTA.forEach((ind) => {
      const v = recExibir.valores?.[ind.id]
      if (v !== null && v !== undefined) {
        comDados++
        const st = statusDe(ind, v, recExibir.metas?.[ind.id] ?? ind.metaPadrao)
        if (st.dentro === true) dentro++
      }
    })

    return {
      dentro,
      comDados,
      acidentes: fmtNum(recExibir.valores?.acidentes, 0),
      dds: fmtNum(recExibir.valores?.dds, 0),
      inspecoes: fmtNum(recExibir.valores?.inspecoes, 0),
    }
  }, [recExibir])

  return (
    <div className="ind-container flex flex-col h-full overflow-y-auto pb-24 bg-white text-[#111827]">
      <style>{`
        .ind-container {
          font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        }
        .ind-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 20px;
          padding: 20px 22px;
          box-shadow: 0 8px 30px rgba(0,0,0,.05);
          margin-bottom: 18px;
        }
        .ind-card h2 {
          font-size: 22px;
          color: #000;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .ind-hint {
          color: #111827;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.55;
          margin-bottom: 12px;
        }
        .ind-label {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: .03em;
          color: #000;
          display: block;
          margin: 14px 0 6px;
        }
        .ind-input, .ind-select {
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
        .ind-input:focus, .ind-select:focus {
          border-color: #f5c518;
          box-shadow: 0 0 0 3px #fef3c7;
        }
        .ind-input::placeholder {
          color: #374151 !important;
          opacity: 1;
          font-weight: 600;
        }
        .invalid-campo {
          border: 2.5px solid #dc2626 !important;
          background: #fef2f2 !important;
        }
        .ind-btn {
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
        .ind-btn-yellow {
          background: #f5c518;
          color: #111;
        }
        .ind-btn-yellow:hover {
          background: #eab308;
        }
        .ind-btn-dark {
          background: #111;
          color: #fff;
        }
        .ind-btn-dark:hover {
          background: #262626;
        }
        .ind-btn-ghost {
          background: #fff;
          border: 1.5px solid #9ca3af;
          color: #111;
        }
        .ind-btn-ghost:hover {
          background: #f3f4f6;
        }
        .ind-btn-red {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }
        .ind-btn-red:hover {
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
        .feedback.info {
          background: #fffbeb;
          border: 2px solid #f59e0b;
          color: #92400e;
        }
        .alert-box {
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-left: 6px solid #f59e0b;
          border-radius: 14px;
          padding: 14px 16px;
          margin-bottom: 18px;
        }
        .alert-box b {
          color: #92400e;
        }
        .alert-box p {
          font-size: 13px;
          color: #111;
          font-weight: 600;
          line-height: 1.5;
          margin-top: 3px;
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
        /* Grid de cards de indicadores */
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }
        @media(max-width: 1250px) {
          .cards-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media(max-width: 680px) {
          .cards-grid {
            grid-template-columns: 1fr;
          }
        }
        .ind-item {
          border: 2px solid #e5e7eb;
          border-radius: 18px;
          padding: 16px;
          background: #fff;
        }
        .ind-item.dentro {
          border-color: #86efac;
        }
        .ind-item.fora {
          border-color: #fca5a5;
        }
        .ind-item.sem {
          border-color: #e5e7eb;
        }
        .ind-item h3 {
          font-size: 16px;
          color: #000;
          line-height: 1.3;
          font-weight: 800;
        }
        .ind-item .desc {
          font-size: 13px;
          color: #111827;
          font-weight: 600;
          line-height: 1.5;
          margin-top: 4px;
          min-height: 38px;
        }
        .ind-item .valor {
          font-size: 38px;
          font-weight: 900;
          color: #000;
          line-height: 1.1;
          margin: 8px 0 2px;
        }
        .ind-item .valor small {
          font-size: 15px;
          color: #374151;
          font-weight: 800;
        }
        .ind-item .meta-linha {
          font-size: 13px;
          font-weight: 700;
          color: #111827;
          margin-top: 4px;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          font-weight: 800;
          font-size: 11px;
          padding: 6px 9px;
          border-radius: 999px;
          letter-spacing: .04em;
          text-transform: uppercase;
        }
        .badge.ok {
          background: #dcfce7;
          color: #166534;
        }
        .badge.ruim {
          background: #fee2e2;
          color: #991b1b;
        }
        .badge.cinza {
          background: #f3f4f6;
          color: #374151;
        }
        .variacao-txt {
          font-size: 13px;
          font-weight: 700;
          color: #111827;
          margin-top: 8px;
          line-height: 1.5;
        }
        .minibar {
          height: 12px;
          background: #e5e7eb;
          border-radius: 999px;
          overflow: hidden;
          margin-top: 10px;
          position: relative;
        }
        .minibar i {
          display: block;
          height: 100%;
          background: #2563eb;
        }
        .minibar i.bom {
          background: #16a34a;
        }
        .minibar i.ruim {
          background: #dc2626;
        }
        .minibar .marca-meta {
          position: absolute;
          top: -2px;
          bottom: -2px;
          width: 3px;
          background: #111;
        }
        /* Formulário */
        .form-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0 18px;
        }
        @media(max-width: 1250px) {
          .form-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media(max-width: 680px) {
          .form-grid {
            grid-template-columns: 1fr;
          }
        }
        .campo-ind {
          border: 1.5px solid #e5e7eb;
          border-radius: 16px;
          padding: 14px 16px;
          margin-bottom: 14px;
          background: #fff;
        }
        .campo-ind b.titulo {
          font-size: 15px;
          color: #000;
          display: block;
        }
        .campo-ind span.dica {
          font-size: 12.5px;
          color: #111827;
          font-weight: 600;
          line-height: 1.5;
          display: block;
          margin-top: 3px;
        }
        .dupla {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 10px;
        }
        .dupla label {
          margin: 0 0 5px;
          font-size: 12px;
          font-weight: 800;
          display: block;
          color: #111;
        }
        /* Gráfico CSS */
        .graf-wrap {
          display: flex;
          align-items: flex-end;
          gap: 14px;
          height: 230px;
          padding: 18px 6px 0;
          border-bottom: 3px solid #111;
          position: relative;
          margin-top: 8px;
        }
        .meta-linha-graf {
          position: absolute;
          left: 0;
          right: 0;
          border-top: 3px dashed #dc2626;
          z-index: 2;
        }
        .meta-linha-graf span {
          position: absolute;
          right: 0;
          top: -22px;
          background: #fee2e2;
          color: #991b1b;
          font-size: 12px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 999px;
          white-space: nowrap;
        }
        .barra-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          height: 100%;
          min-width: 0;
        }
        .barra-col .b-valor {
          font-size: 13px;
          font-weight: 900;
          color: #000;
          margin-bottom: 5px;
          text-align: center;
        }
        .barra {
          width: 100%;
          max-width: 64px;
          background: #2563eb;
          border-radius: 8px 8px 0 0;
          min-height: 4px;
          transition: height 0.3s ease;
        }
        .barra.atual {
          background: #f5c518;
          border: 2px solid #111;
          border-bottom: 0;
        }
        .barra-col .b-mes {
          font-size: 12px;
          font-weight: 800;
          color: #111827;
          margin-top: 8px;
          text-align: center;
        }
        .legenda {
          display: flex;
          gap: 18px;
          flex-wrap: wrap;
          font-size: 13px;
          font-weight: 700;
          color: #111827;
          margin-top: 12px;
        }
        .legenda i {
          display: inline-block;
          width: 14px;
          height: 14px;
          border-radius: 4px;
          vertical-align: -2px;
          margin-right: 6px;
        }
        /* Tabela Histórico */
        table.tab {
          width: 100%;
          border-collapse: collapse;
          min-width: 760px;
        }
        table.tab th {
          text-align: left;
          font-size: 13px;
          font-weight: 900;
          color: #000;
          padding: 11px 10px;
          border-bottom: 2px solid #111;
          white-space: nowrap;
        }
        table.tab td {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          padding: 11px 10px;
          border-bottom: 1px solid #e5e7eb;
          vertical-align: middle;
          line-height: 1.5;
          white-space: nowrap;
        }
        table.tab td b {
          color: #000;
        }
        .scroll-x {
          overflow-x: auto;
        }
        /* Relatório */
        .relatorio {
          border: 2px solid #111827;
          border-radius: 20px;
          padding: 22px;
          background: #fff;
        }
        .relatorio h2 {
          font-size: 24px;
          color: #000;
          font-weight: 700;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin: 14px 0;
        }
        @media(max-width: 640px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .stat-item {
          background: #f9fafb;
          border: 1.5px solid #e5e7eb;
          border-radius: 14px;
          padding: 14px;
          text-align: center;
        }
        .stat-item b {
          font-size: 26px;
          display: block;
          color: #000;
          font-weight: 900;
        }
        .stat-item span {
          font-size: 11px;
          color: #111;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .05em;
        }
        .rel-item {
          border-top: 1px solid #e5e7eb;
          padding: 12px 0;
        }
        .rel-item b {
          color: #000;
        }
        .ind-toast {
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
          animation: indToastFade 0.3s ease-in-out;
        }
        @keyframes indToastFade {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @media print {
          .noprint, .ind-breadcrumb, .alert-box, .ind-toast {
            display: none !important;
          }
          .ind-card, .relatorio {
            box-shadow: none !important;
            border: 1px solid #ccc;
            break-inside: avoid;
          }
          .cards-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
      `}</style>

      <div className="max-w-5xl w-full mx-auto px-4 py-4">
        {/* Breadcrumb & Voltar */}
        <div className="ind-breadcrumb flex items-center justify-between gap-4 mb-4 mt-1">
          <div className="text-[13px] font-semibold text-[#374151] flex items-center gap-2">
            <Link
              to="/seguranca"
              className="hover:underline flex items-center gap-1 text-[#111827] font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              Segurança
            </Link>
            <span>›</span>
            <span className="text-[#111] font-extrabold">Indicadores</span>
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
          <BarChart3 className="w-9 h-9 text-[#111]" />
          Indicadores de Segurança
        </h1>
        <p className="text-[#111827] font-medium mb-5 leading-relaxed max-w-4xl text-sm md:text-base">
          Acompanhe os <b>principais indicadores de segurança mês a mês</b>: TF, TG, acidentes, quase
          acidentes, DDS, desvios, treinamentos vencidos e inspeções. Preencha os valores do mês, defina a{' '}
          <b>meta de cada indicador</b> e veja na hora se está <b>🟢 dentro da meta</b> ou{' '}
          <b>🔴 fora da meta</b>, com comparativo com o mês anterior.
        </p>

        {/* Alerta de Armazenamento / Standalone */}
        <div className="alert-box">
          <b>ℹ️ Sistema com persistência em tempo real.</b>
          <p>
            Os valores ficam salvos no <b>Supabase</b> (com sincronização em tempo real entre todos os
            dispositivos) e possuem fallback para o armazenamento local (localStorage). Você pode carregar,
            editar ou excluir qualquer mês histórico a qualquer momento.
          </p>
        </div>

        {/* SEÇÃO 1: FORMULÁRIO */}
        <section className="ind-card noprint" ref={formRef} id="formSection">
          <h2>✏️ Registrar valores do mês</h2>
          <p className="ind-hint">
            Escolha o mês, preencha os valores e a meta de cada indicador e clique em <b>Salvar mês</b>.
            Salvar um mês que já existe <b>atualiza</b> os valores dele. A meta pode mudar de um mês para o outro.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-2xl mb-4">
            <div>
              <label htmlFor="mesInput" className="ind-label" style={{ marginTop: 0 }}>
                Mês / Ano *
              </label>
              <input
                type="month"
                id="mesInput"
                className={`ind-input ${invalidosCampos['mesInput'] ? 'invalid-campo' : ''}`}
                value={mesInput}
                onChange={(e) => handleMesInputChange(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="mesExibir" className="ind-label" style={{ marginTop: 0 }}>
                Mês em exibição (cards, gráfico e relatório)
              </label>
              <input
                type="month"
                id="mesExibir"
                className="ind-input"
                value={mesExibir}
                onChange={(e) => {
                  if (e.target.value) setMesExibir(e.target.value)
                }}
              />
            </div>
          </div>

          <div className="form-grid">
            {INDICADORES_LISTA.map((ind) => (
              <div key={ind.id} className="campo-ind">
                <b className="titulo">{ind.nome}</b>
                <span className="dica">{ind.dica}</span>
                <div className="dupla">
                  <div>
                    <label htmlFor={`v-${ind.id}`}>Valor do mês</label>
                    <input
                      type="number"
                      id={`v-${ind.id}`}
                      className={`ind-input ${invalidosCampos[`v-${ind.id}`] ? 'invalid-campo' : ''}`}
                      min="0"
                      step={ind.casas ? 0.01 : 1}
                      placeholder={`Ex.: ${fmtNum(ind.metaPadrao, ind.casas)}`}
                      value={valoresForm[ind.id] ?? ''}
                      onChange={(e) =>
                        setValoresForm((prev) => ({ ...prev, [ind.id]: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor={`m-${ind.id}`}>Meta do mês</label>
                    <input
                      type="number"
                      id={`m-${ind.id}`}
                      className={`ind-input ${invalidosCampos[`m-${ind.id}`] ? 'invalid-campo' : ''}`}
                      min="0"
                      step={ind.casas ? 0.01 : 1}
                      placeholder="Meta"
                      value={metasForm[ind.id] ?? ''}
                      onChange={(e) =>
                        setMetasForm((prev) => ({ ...prev, [ind.id]: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Calculadora TF / TG */}
          <div className="ind-card" style={{ background: '#f9fafb', marginBottom: 14 }}>
            <h3 className="text-base font-bold text-black flex items-center gap-2">
              <Calculator className="w-5 h-5 text-amber-600" />
              Calculadora de TF e TG (opcional)
            </h3>
            <p className="ind-hint mt-1.5">
              Se preferir, informe as horas trabalhadas e os dias perdidos e clique em <b>Calcular TF / TG</b>{' '}
              — os campos de TF e TG acima são preenchidos automaticamente. Fórmulas:{' '}
              <b>TF = nº de acidentes × 1.000.000 ÷ HHT</b> &nbsp;•&nbsp;{' '}
              <b>TG = dias perdidos × 1.000.000 ÷ HHT</b>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-2xl">
              <div>
                <label htmlFor="hhtInput" className="ind-label" style={{ marginTop: 0 }}>
                  Horas-homem trabalhadas (HHT)
                </label>
                <input
                  type="number"
                  id="hhtInput"
                  className="ind-input"
                  min="0"
                  step="1"
                  placeholder="Ex.: 48000"
                  value={hht}
                  onChange={(e) => setHht(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="diasPerdidosInput" className="ind-label" style={{ marginTop: 0 }}>
                  Dias perdidos (afastamentos)
                </label>
                <input
                  type="number"
                  id="diasPerdidosInput"
                  className="ind-input"
                  min="0"
                  step="1"
                  placeholder="Ex.: 12"
                  value={diasPerdidos}
                  onChange={(e) => setDiasPerdidos(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3">
              <button
                type="button"
                className="ind-btn ind-btn-ghost text-sm py-2.5 px-4"
                onClick={calcularTF_TG}
              >
                🧮 Calcular TF / TG
              </button>
            </div>
          </div>

          {/* Feedback Form */}
          {formFeedback && (
            <div className={`feedback ${formFeedback.tipo}`} role="alert">
              {formFeedback.msg}
            </div>
          )}

          {/* Botões Ação */}
          <div className="flex flex-wrap gap-2.5 mt-4">
            <button type="button" className="ind-btn ind-btn-dark" onClick={salvarMes}>
              <Save className="w-4 h-4" />
              Salvar mês
            </button>
            <button type="button" className="ind-btn ind-btn-yellow" onClick={preencherExemplo}>
              <Sparkles className="w-4 h-4" />
              Preencher com exemplo (fictício)
            </button>
            <button type="button" className="ind-btn ind-btn-ghost" onClick={limparForm}>
              <RotateCcw className="w-4 h-4" />
              Limpar formulário
            </button>
          </div>

          <p className="ind-hint mt-3">
            💡 <b>Exemplo fictício:</b> o botão amarelo só preenche o formulário com números de exemplo,
            para testar a página — <b>não salva nada sozinho</b>. Para guardar o exemplo, clique em{' '}
            <b>Salvar mês</b> depois. Apague os valores de exemplo antes de usar com dados reais.
          </p>
        </section>

        {/* SEÇÃO 2: CARDS DE INDICADORES */}
        <section ref={cardsRef} id="cardsSection" className="mb-6">
          <h2 className="text-2xl font-bold text-black mb-1">
            📌 Indicadores — <span>{fmtMes(mesExibir)}</span>
          </h2>
          <p className="ind-hint">
            🟢 <b>Dentro da meta</b> = verde &nbsp;•&nbsp; 🔴 <b>Fora da meta</b> = vermelho. A seta compara
            com o mês anterior, quando houver dados salvos.
          </p>

          <div className="cards-grid">
            {INDICADORES_LISTA.map((ind) => {
              const valor = recExibir?.valores?.[ind.id] ?? null
              const meta =
                recExibir?.metas?.[ind.id] ??
                ultimaMeta(ind.id) ??
                ind.metaPadrao
              const st = statusDe(ind, valor, meta)
              const prevV = recAnterior?.valores?.[ind.id] ?? null

              let pctBar = 0
              let barCls = ''
              if (valor !== null && meta !== null && meta > 0) {
                pctBar = Math.min(100, Math.max(0, (valor / meta) * 100))
                barCls = st.dentro === true ? 'bom' : st.dentro === false ? 'ruim' : ''
              } else if (valor !== null && meta === 0) {
                pctBar = valor === 0 ? 0 : 100
                barCls = valor === 0 ? 'bom' : 'ruim'
              }

              const metaPct =
                meta !== null && meta > 0 && valor !== null
                  ? Math.min(100, (meta / Math.max(valor, meta)) * 100)
                  : null

              const sinalMeta = ind.dir === 'menor' ? '≤' : '≥'

              return (
                <div key={ind.id} className={`ind-item ${st.cls}`}>
                  <h3>{ind.nome}</h3>
                  <p className="desc">{ind.desc}</p>
                  <div className="valor">
                    {valor === null ? '—' : fmtNum(valor, ind.casas)}
                    {valor !== null && ind.unidade && <small> {ind.unidade}</small>}
                  </div>
                  <div>
                    {st.cls === 'sem' ? (
                      <span className="badge cinza">{st.badge}</span>
                    ) : st.dentro ? (
                      <span className="badge ok">🟢 Dentro da meta</span>
                    ) : (
                      <span className="badge ruim">🔴 Fora da meta</span>
                    )}
                  </div>
                  <div className="meta-linha">
                    Meta do mês: {sinalMeta} {fmtNum(meta, ind.casas)}
                  </div>
                  <div className="minibar" title="Valor em relação à meta">
                    <i className={barCls} style={{ width: `${pctBar}%` }} />
                    {metaPct !== null && (
                      <span className="marca-meta" style={{ left: `${metaPct}%` }} />
                    )}
                  </div>
                  <p className="variacao-txt">{variacaoTxt(ind, valor, prevV)}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* SEÇÃO 3: GRÁFICO CSS DE BARRAS */}
        <section className="ind-card" id="graficoSection">
          <h2>📈 Evolução — gráfico de barras</h2>
          <p className="ind-hint">
            Gráfico desenhado em CSS puro, sem bibliotecas pesadas. Escolha o indicador e veja a evolução
            dos últimos meses salvos. A linha tracejada vermelha é a <b>meta do mês em exibição</b>.
          </p>

          <div className="max-w-md mb-2">
            <label htmlFor="graficoSelect" className="ind-label" style={{ marginTop: 0 }}>
              Indicador do gráfico
            </label>
            <select
              id="graficoSelect"
              className="ind-select"
              value={graficoInd}
              onChange={(e) => setGraficoInd(e.target.value)}
            >
              {INDICADORES_LISTA.map((ind) => (
                <option key={ind.id} value={ind.id}>
                  {ind.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="graf-wrap">
            {!dadosGrafico ? (
              <div className="empty-box w-full">
                Nenhum mês salvo ainda — o gráfico aparece após o primeiro mês salvo.
              </div>
            ) : (
              <>
                {dadosGrafico.metaEx !== null && (
                  <div
                    className="meta-linha-graf"
                    style={{ bottom: `${dadosGrafico.metaPct}%` }}
                  >
                    <span>
                      Meta: {fmtNum(dadosGrafico.metaEx, dadosGrafico.indAtual.casas)}
                    </span>
                  </div>
                )}
                {dadosGrafico.meses.map((m, i) => {
                  const v = dadosGrafico.valores[i]
                  const hBar = v === null ? 0 : Math.max(2, (v / dadosGrafico.maxV) * 100)
                  return (
                    <div key={m} className="barra-col">
                      <div className="b-valor">
                        {v === null ? '—' : fmtNum(v, dadosGrafico.indAtual.casas)}
                      </div>
                      <div
                        className={`barra ${m === mesExibir ? 'atual' : ''}`}
                        style={{ height: `${hBar}%` }}
                        title={`${fmtMes(m)}: ${fmtNum(v, dadosGrafico.indAtual.casas)}`}
                      />
                      <div className="b-mes">{fmtMes(m)}</div>
                    </div>
                  )
                })}
              </>
            )}
          </div>

          <div className="legenda">
            <span>
              <i style={{ background: '#2563eb' }} />
              Meses anteriores
            </span>
            <span>
              <i style={{ background: '#f5c518', border: '1.5px solid #111' }} />
              Mês em exibição
            </span>
            <span>
              <i style={{ background: '#dc2626', height: 3, verticalAlign: 'middle' }} />
              Meta do mês em exibição
            </span>
          </div>

          {dadosGrafico && (
            <p className="ind-hint mt-2.5">
              Indicador: {dadosGrafico.indAtual.nome} • {dadosGrafico.meses.length} mês(es) no gráfico •
              Meta do mês em exibição ({fmtMes(mesExibir)}):{' '}
              {dadosGrafico.indAtual.dir === 'menor' ? '≤' : '≥'}{' '}
              {fmtNum(dadosGrafico.metaEx, dadosGrafico.indAtual.casas)}.
            </p>
          )}
        </section>

        {/* SEÇÃO 4: HISTÓRICO */}
        <section className="ind-card" id="historicoSection">
          <h2>📚 Histórico de meses salvos</h2>
          <p className="ind-hint">
            Todos os meses registrados nesta página. Use o filtro por ano e a busca para localizar um
            mês. <b>Carregar</b> abre o mês no formulário para editar; <b>Excluir</b> pede confirmação em
            dois cliques.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md noprint mb-3">
            <div>
              <label htmlFor="histAno" className="ind-label" style={{ marginTop: 0 }}>
                Filtrar por ano
              </label>
              <select
                id="histAno"
                className="ind-select"
                value={filtroAno}
                onChange={(e) => setFiltroAno(e.target.value)}
              >
                <option value="">Todos os anos</option>
                {anosDisponiveis.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="histBusca" className="ind-label" style={{ marginTop: 0 }}>
                Buscar histórico
              </label>
              <input
                type="text"
                id="histBusca"
                className="ind-input"
                placeholder="Ex.: out/2026..."
                value={buscaHistorico}
                onChange={(e) => setBuscaHistorico(e.target.value)}
              />
            </div>
          </div>

          <div className="scroll-x mt-3">
            <table className="tab">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>TF</th>
                  <th>TG</th>
                  <th>Acid.</th>
                  <th>Quase acid.</th>
                  <th>DDS</th>
                  <th>Desv. abertos</th>
                  <th>Desv. fechados</th>
                  <th>Trein. venc.</th>
                  <th>Inspeções</th>
                  <th className="noprint">Ações</th>
                </tr>
              </thead>
              <tbody>
                {!mesesHistorico.length ? (
                  <tr>
                    <td colSpan={11} className="text-center py-6 text-[#374151]">
                      {Object.keys(store).length
                        ? 'Nenhum mês encontrado neste filtro.'
                        : 'Nenhum mês salvo ainda.'}
                    </td>
                  </tr>
                ) : (
                  mesesHistorico.map((m) => {
                    const r = store[m]
                    return (
                      <tr key={m}>
                        <td>
                          <b>{fmtMes(m)}</b>
                        </td>
                        {INDICADORES_LISTA.map((ind) => (
                          <td key={ind.id}>
                            {fmtNum(r?.valores?.[ind.id], ind.casas)}
                          </td>
                        ))}
                        <td className="noprint">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              className="ind-btn ind-btn-ghost py-1.5 px-3 text-xs"
                              onClick={() => carregarMesHistorico(m)}
                            >
                              Carregar
                            </button>
                            <button
                              type="button"
                              className="ind-btn ind-btn-red py-1.5 px-3 text-xs flex items-center gap-1"
                              onClick={() => excluirMesHistorico(m)}
                            >
                              <Trash2 className="w-3 h-3" />
                              {confirmExcluir[m] ? 'Confirmar exclusão?' : 'Excluir'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <p className="ind-hint mt-2.5">
            {Object.keys(store).length
              ? `${Object.keys(store).length} mês(es) salvo(s) • exibindo ${mesesHistorico.length}.`
              : 'Nenhum mês salvo ainda.'}
          </p>
        </section>

        {/* SEÇÃO 5: RELATÓRIO MENSAL AUTOMÁTICO */}
        <section className="relatorio" id="relatorioSection">
          <h2>📋 Relatório Mensal Automático — {fmtMes(mesExibir)}</h2>
          <p className="ind-hint">
            Atualizado automaticamente a cada mês salvo ou excluído — sem preencher de novo. Inclui o
            comparativo com o mês anterior, quando houver dados.
          </p>

          <div className="stats-grid">
            <div className="stat-item">
              <b>{`${statsRelatorio.dentro} / ${statsRelatorio.comDados}`}</b>
              <span>Indicadores dentro da meta</span>
            </div>
            <div className="stat-item">
              <b>{statsRelatorio.acidentes}</b>
              <span>Acidentes no mês</span>
            </div>
            <div className="stat-item">
              <b>{statsRelatorio.dds}</b>
              <span>DDS realizadas</span>
            </div>
            <div className="stat-item">
              <b>{statsRelatorio.inspecoes}</b>
              <span>Inspeções realizadas</span>
            </div>
          </div>

          {!recExibir ? (
            <div className="empty-box">
              Sem dados salvos para {fmtMes(mesExibir)} ainda.
              <br />
              Preencha o formulário acima e clique em <b>Salvar mês</b>, ou escolha outro mês em exibição.
            </div>
          ) : (
            <div>
              <p className="text-black font-semibold leading-relaxed mb-4">
                Resumo de {fmtMes(mesExibir)}:{' '}
                <b>
                  {statsRelatorio.dentro} de {statsRelatorio.comDados} indicador(es) com dados dentro da
                  meta
                </b>
                {statsRelatorio.comDados < INDICADORES_LISTA.length &&
                  ` (${INDICADORES_LISTA.length - statsRelatorio.comDados} sem dados neste mês)`}
                .
                {recAnterior ? (
                  <>
                    <br />
                    Comparativo com {fmtMes(prevMes(mesExibir))}: veja a variação de cada indicador abaixo.
                  </>
                ) : (
                  <>
                    <br />
                    Não há mês anterior salvo ({fmtMes(prevMes(mesExibir))}), por isso o comparativo
                    aparece como “sem mês anterior”.
                  </>
                )}
              </p>

              {INDICADORES_LISTA.map((ind, i) => {
                const v = recExibir.valores?.[ind.id] ?? null
                const meta = recExibir.metas?.[ind.id] ?? ind.metaPadrao
                const st = statusDe(ind, v, meta)
                const prevV = recAnterior?.valores?.[ind.id] ?? null

                let comp: string
                if (v === null) {
                  comp = 'Sem valor neste mês.'
                } else if (prevV === null || prevV === undefined) {
                  comp = `Sem mês anterior salvo para comparar (${fmtMes(prevMes(mesExibir))}).`
                } else {
                  const d = v - prevV
                  const sinal = d > 0 ? '+' : d < 0 ? '−' : ''
                  const sentido =
                    d === 0
                      ? 'sem alteração'
                      : (ind.dir === 'menor' ? d < 0 : d > 0)
                      ? 'melhorou'
                      : 'piorou'
                  comp = `${sinal}${fmtNum(Math.abs(d), ind.casas)} vs ${fmtMes(prevMes(mesExibir))} (${fmtNum(
                    prevV,
                    ind.casas
                  )}) — ${sentido}.`
                }

                return (
                  <div key={ind.id} className="rel-item">
                    <b>
                      {i + 1}. {ind.nome}
                    </b>{' '}
                    —{' '}
                    {v === null ? (
                      <b>SEM DADOS</b>
                    ) : st.dentro === true ? (
                      <b style={{ color: '#16a34a' }}>🟢 DENTRO DA META</b>
                    ) : st.dentro === false ? (
                      <b style={{ color: '#dc2626' }}>🔴 FORA DA META</b>
                    ) : (
                      <b>SEM META</b>
                    )}
                    <br />
                    <span className="text-sm">
                      Valor: <b>{fmtNum(v, ind.casas)}</b> • Meta:{' '}
                      {ind.dir === 'menor' ? '≤' : '≥'} {fmtNum(meta, ind.casas)}
                      <br />
                      Comparativo com o mês anterior: {comp}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {relFeedback && (
            <div className={`feedback ${relFeedback.tipo}`} role="alert">
              {relFeedback.msg}
            </div>
          )}

          <div className="flex flex-wrap gap-2.5 mt-4 noprint">
            <button
              type="button"
              className="ind-btn ind-btn-dark"
              onClick={() => window.print()}
            >
              <Printer className="w-4 h-4" />
              🖨️ Imprimir / Salvar relatório em PDF
            </button>
            <button
              type="button"
              className="ind-btn ind-btn-yellow"
              onClick={copiarRelatorio}
            >
              <Copy className="w-4 h-4" />
              📋 Copiar relatório (texto)
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-xs font-semibold text-[#374151] mt-8 leading-relaxed">
          Hydro Reabilitação — Segurança • Indicadores • Dados persistidos com segurança no Supabase e em cache local.
        </footer>
      </div>

      {/* Toast Notification */}
      {toastMsg && <div className="ind-toast">{toastMsg}</div>}
    </div>
  )
}
export default IndicadoresComponent

