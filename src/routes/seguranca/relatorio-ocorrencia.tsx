import React, { useState, useEffect, useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  type OcorrenciaArquivo,
  fmtAnexadoEm,
  fmtTamanho,
  tipoAnexo,
  carregarArquivosOcorrencia,
  salvarArquivosOcorrencia,
  getDbKeyOcorrencias,
} from '../../lib/ocorrenciaData'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Cloud, AlertTriangle } from 'lucide-react'

export const Route = createFileRoute('/seguranca/relatorio-ocorrencia')({
  component: RelatorioOcorrenciaComponent,
})

export function RelatorioOcorrenciaComponent() {
  const [arquivos, setArquivos] = useState<OcorrenciaArquivo[]>([])
  const [carregando, setCarregando] = useState(true)

  // Form states
  const [tituloArquivo, setTituloArquivo] = useState('')
  const [pendentes, setPendentes] = useState<
    {
      nome: string
      mime: string
      rotulo: string
      icone: string
      tamanho: number
      dataUrl: string
    }[]
  >([])

  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')

  // Feedback & Toast
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [confirmExcluir, setConfirmExcluir] = useState<Record<number, boolean>>({})

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
        const dados = await carregarArquivosOcorrencia()
        if (isMounted) {
          setArquivos(dados)
        }
      } catch (err) {
        console.error('[Ocorrência] Erro ao carregar dados:', err)
      } finally {
        if (isMounted) {
          setCarregando(false)
        }
      }
    }

    carregar()

    const dbKey = getDbKeyOcorrencias()
    const canal = supabase
      .channel('realtime_ocorrencias_arquivos')
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
            setArquivos(payload.new.value as OcorrenciaArquivo[])
          }
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(canal)
    }
  }, [])

  // Manipular upload de arquivos pendentes
  const handleFileChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(ev.target.files || [])
    if (!files.length) return

    let pend = files.length
    files.forEach((f) => {
      const t = tipoAnexo(f.name, f.type)
      const r = new FileReader()
      r.onload = (e) => {
        setPendentes((prev) => [
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

  const removerPendente = (idx: number) => {
    setPendentes((prev) => prev.filter((_, i) => i !== idx))
    showToast('Arquivo removido da seleção')
  }

  const limparSelecao = () => {
    setPendentes([])
    setTituloArquivo('')
    setFeedback(null)
  }

  const salvarArquivos = async () => {
    if (!pendentes.length) {
      setFeedback({
        tipo: 'erro',
        msg: '⚠️ NADA PARA SALVAR — clique em “📎 Escolher arquivos” e escolha pelo menos 1 arquivo antes de salvar.',
      })
      return
    }

    const quando = fmtAnexadoEm(new Date())
    const titulo = tituloArquivo.trim()
    const novos: OcorrenciaArquivo[] = pendentes.map((a) => ({
      nome: a.nome,
      mime: a.mime,
      rotulo: a.rotulo,
      icone: a.icone,
      tamanho: a.tamanho,
      dataUrl: a.dataUrl,
      anexadoEm: quando,
      titulo: titulo || undefined,
    }))

    const atualizados = [...novos, ...arquivos]
    setArquivos(atualizados)
    setPendentes([])
    setTituloArquivo('')

    const ok = await salvarArquivosOcorrencia(atualizados)
    setFeedback({
      tipo: 'ok',
      msg: `✅ ${novos.length} ARQUIVO(S) SALVO(S)!\nArquivados em ${quando} e já aparecem na lista de arquivos salvos abaixo, para visualizar/abrir ou baixar.${
        ok ? '' : '\n(Salvo no armazenamento local do navegador — sincronizará com a nuvem assim que conectado).'
      }`,
    })
    showToast(`📎 ${novos.length} arquivo(s) salvo(s) — anexados em ${quando}`)
  }

  const handleExcluirArquivo = async (idx: number, nome: string) => {
    if (!confirmExcluir[idx]) {
      setConfirmExcluir((prev) => ({ ...prev, [idx]: true }))
      setTimeout(() => {
        setConfirmExcluir((prev) => ({ ...prev, [idx]: false }))
      }, 4000)
      return
    }

    const atualizados = arquivos.filter((_, i) => i !== idx)
    setArquivos(atualizados)
    await salvarArquivosOcorrencia(atualizados)
    showToast(`Arquivo excluído: ${nome}`)
  }

  // Estatísticas por tipo
  const statsPorTipo = useMemo(() => {
    const porTipo: Record<string, number> = {
      PDF: 0,
      Excel: 0,
      Word: 0,
      Imagem: 0,
      Arquivo: 0,
    }
    arquivos.forEach((a) => {
      const t = tipoAnexo(a.nome, a.mime)
      const r = a.rotulo || t.rotulo
      const chave = porTipo[r] !== undefined ? r : 'Arquivo'
      porTipo[chave] = (porTipo[chave] || 0) + 1
    })
    return porTipo
  }, [arquivos])

  // Arquivos filtrados
  const arquivosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return arquivos.filter((a, idx) => {
      const t = tipoAnexo(a.nome, a.mime)
      const r = a.rotulo || t.rotulo
      if (filtroTipo !== 'todos' && r !== filtroTipo) return false
      if (
        q &&
        !String(a.nome || '').toLowerCase().includes(q) &&
        !String(a.titulo || '').toLowerCase().includes(q)
      ) {
        return false
      }
      return true
    })
  }, [arquivos, busca, filtroTipo])

  return (
    <div className="oc-container flex flex-col h-full overflow-y-auto pb-24 bg-white text-[#111827]">
      <style>{`
        .oc-container {
          font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        }
        .oc-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 22px;
          padding: 20px 22px 22px;
          box-shadow: 0 8px 30px rgba(0,0,0,.05);
          margin-bottom: 18px;
        }
        .oc-card h2 {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 27px;
          color: #000;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .oc-card p.hint {
          color: #111827;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.55;
        }
        .oc-label {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: .03em;
          color: #000;
          display: block;
          margin: 14px 0 6px;
        }
        .oc-input, .oc-select {
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
        .oc-input:focus, .oc-select:focus {
          border-color: #f5c518;
          box-shadow: 0 0 0 3px #fef3c7;
        }
        .oc-input::placeholder {
          color: #374151 !important;
          opacity: 1;
          font-weight: 600;
        }
        .oc-btn {
          border: 0;
          border-radius: 12px;
          padding: 13px 20px;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .oc-btn-dark {
          background: #111;
          color: #fff;
        }
        .oc-btn-dark:hover {
          background: #27272a;
        }
        .oc-btn-ghost {
          background: #fff;
          border: 1.5px solid #9ca3af;
          color: #111;
        }
        .oc-btn-ghost:hover {
          background: #f3f4f6;
        }
        .oc-anexos-box {
          border: 2px dashed #2563eb;
          border-radius: 14px;
          padding: 16px;
          background: #eff6ff;
          margin-top: 4px;
          text-align: center;
        }
        .oc-anexo-txt {
          color: #000;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.55;
          display: block;
        }
        .oc-anexo-txt b {
          font-weight: 900;
        }
        .oc-anexo-btn {
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
        .oc-anexo-btn:hover {
          background: #1d4ed8;
        }
        .oc-anexo-hint {
          font-size: 12px;
          color: #1e3a8a;
          font-weight: 600;
          line-height: 1.5;
          margin-top: 10px;
        }
        .oc-anexo-lista {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 12px;
          text-align: left;
        }
        .oc-anexo-item, .oc-arq-item {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          background: #fff;
          border: 1.5px solid #93c5fd;
          border-radius: 12px;
          padding: 11px 12px;
          flex-wrap: wrap;
        }
        .oc-anexo-ic {
          font-size: 24px;
          flex: none;
          line-height: 1;
        }
        .oc-anexo-info {
          flex: 1;
          min-width: 220px;
        }
        .oc-anexo-info b {
          display: block;
          color: #000;
          font-size: 14px;
          font-weight: 800;
          word-break: break-all;
          line-height: 1.35;
        }
        .oc-anexo-info span {
          display: block;
          font-size: 12.5px;
          color: #374151;
          font-weight: 700;
          line-height: 1.5;
          margin-top: 2px;
        }
        .oc-anexo-info span.titulo-arq {
          color: #000;
          font-size: 13.5px;
        }
        .oc-anexo-acoes {
          display: flex;
          gap: 6px;
          flex: none;
          flex-wrap: wrap;
        }
        .oc-anexo-acoes a, .oc-anexo-acoes button {
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
        .oc-anexo-acoes button.del {
          border-color: #fca5a5;
          background: #fef2f2;
          color: #991b1b;
        }
        .oc-feedback {
          border-radius: 14px;
          padding: 14px 16px;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.55;
          margin-top: 14px;
          white-space: pre-line;
        }
        .oc-feedback.erro {
          background: #fef2f2;
          border: 2px solid #dc2626;
          color: #991b1b;
        }
        .oc-feedback.ok {
          background: #f0fdf4;
          border: 2px solid #16a34a;
          color: #14532d;
        }
        .oc-stats {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 10px;
          margin: 14px 0;
        }
        @media(max-width: 900px) {
          .oc-stats {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media(max-width: 520px) {
          .oc-stats {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .oc-stat {
          background: #f9fafb;
          border: 1.5px solid #e5e7eb;
          border-radius: 14px;
          padding: 14px;
          text-align: center;
        }
        .oc-stat b {
          font-size: 26px;
          display: block;
          color: #000;
        }
        .oc-stat span {
          font-size: 11px;
          color: #111;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .05em;
        }
        .oc-filtros {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 10px;
          margin: 14px 0;
        }
        @media(max-width: 760px) {
          .oc-filtros {
            grid-template-columns: 1fr;
          }
        }
        .oc-arq-lista {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .oc-empty {
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
        .oc-toast {
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
          animation: ocToastFade 0.3s ease-in-out;
        }
        @keyframes ocToastFade {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @media print {
          .noprint, .oc-breadcrumb, .oc-alert-banner, .oc-anexos-box {
            display: none !important;
          }
          .oc-card {
            box-shadow: none !important;
            break-inside: avoid;
            border: 1px solid #ccc;
          }
        }
      `}</style>

      <div className="max-w-5xl w-full mx-auto px-4 py-4">
        {/* Breadcrumb & Voltar */}
        <div className="oc-breadcrumb flex items-center justify-between gap-4 mb-4 mt-1">
          <div className="text-[13px] font-semibold text-[#374151] flex items-center gap-2">
            <Link
              to="/seguranca"
              className="hover:underline flex items-center gap-1 text-[#111827] font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              Segurança
            </Link>
            <span>›</span>
            <span className="text-[#111] font-extrabold">Relatório de Ocorrência</span>
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
          📎 Relatório de Ocorrência
        </h1>
        <p className="text-[#111827] font-medium mb-5 leading-relaxed max-w-4xl text-sm md:text-base">
          Página <b>só para arquivar anexos de ocorrência</b>: escolha <b>vários arquivos</b> —{' '}
          <b>PDF, Excel, Word, imagens e outros</b> — e eles ficam <b>salvos</b> aqui para{' '}
          <b>visualizar/abrir ou baixar</b> quando precisar, com a{' '}
          <b>data e a hora em que foram anexados</b>. Não há registro de ocorrência nesta página — só o
          arquivo de anexos.
        </p>

        {/* Alerta de sincronização */}
        <div className="oc-alert-banner bg-[#fffbeb] border border-[#fde68a] border-l-4 border-l-[#f59e0b] rounded-xl p-3.5 mb-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <b className="text-[#92400e] text-sm block">Segurança do Trabalho — Hydro Reabilitação</b>
            <p className="text-xs md:text-sm text-[#111] font-semibold mt-0.5 leading-snug">
              Os arquivos anexados são salvos com segurança no <b>Supabase</b> com sincronização em
              tempo real e espelhados em cache local no navegador para disponibilidade imediata.
            </p>
          </div>
        </div>

        {/* ===== SEÇÃO 1: ANEXAR ARQUIVOS ===== */}
        <section className="oc-card" id="novoArquivoSection">
          <h2>📎 Anexar arquivos</h2>
          <p className="hint">
            Escolha um ou vários arquivos de uma vez. Se quiser, escreva um <b>título/descrição</b> para
            identificar os arquivos (opcional) — ele aparece junto de cada arquivo salvo.
          </p>

          <label className="oc-label" htmlFor="tituloArquivo">
            Título / descrição dos arquivos (opcional)
          </label>
          <input
            id="tituloArquivo"
            className="oc-input"
            placeholder="Ex.: Relatório da ocorrência, fotos da vistoria, planilha de controle..."
            value={tituloArquivo}
            onChange={(e) => setTituloArquivo(e.target.value)}
          />

          <label className="oc-label">Arquivos da ocorrência</label>
          <div className="oc-anexos-box">
            <span className="oc-anexo-txt">
              📎 <b>+ Anexar arquivos de ocorrência</b>
              <br />
              PDF, Excel, Word, imagens e outros arquivos. Pode anexar vários de uma vez.
            </span>
            <label className="oc-anexo-btn" htmlFor="arqInput">
              📎 Escolher arquivos
            </label>
            <input
              type="file"
              id="arqInput"
              multiple
              accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.txt,.zip,.rar,image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <p className="oc-anexo-hint">
              Os arquivos ficam salvos e sincronizados com segurança no Supabase e em cache no
              navegador.
            </p>

            {pendentes.length > 0 && (
              <div className="oc-anexo-lista" id="pendentesLista">
                {pendentes.map((a, i) => (
                  <div key={i} className="oc-anexo-item">
                    <span className="oc-anexo-ic">{a.icone}</span>
                    <div className="oc-anexo-info">
                      <b>{a.nome}</b>
                      <span>
                        {a.rotulo} • {fmtTamanho(a.tamanho)}
                      </span>
                    </div>
                    <div className="oc-anexo-acoes">
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
            <div className={`oc-feedback ${feedback.tipo}`} role="alert" aria-live="polite">
              {feedback.msg}
            </div>
          )}

          <div className="flex gap-2.5 flex-wrap mt-4 noprint">
            <button
              type="button"
              className="oc-btn oc-btn-dark"
              id="btnSalvar"
              onClick={salvarArquivos}
            >
              💾 Salvar arquivos
            </button>
            <button
              type="button"
              className="oc-btn oc-btn-ghost"
              id="btnLimpar"
              onClick={limparSelecao}
            >
              Limpar seleção
            </button>
          </div>
        </section>

        {/* ===== SEÇÃO 2: ARQUIVOS SALVOS ===== */}
        <section className="oc-card" id="arquivosSection">
          <h2>🗂️ Arquivos salvos</h2>
          <p className="hint">
            Todos os arquivos arquivados, com <b>nome, tipo, tamanho</b> e{' '}
            <b>data e hora em que foram anexados</b>. Use <b>Visualizar / Abrir</b> para ver o arquivo,{' '}
            <b>Baixar</b> para baixar uma cópia ou <b>Excluir arquivo</b> para apagar.
          </p>

          <div className="oc-stats" id="arqStats">
            <div className="oc-stat">
              <b>{arquivos.length}</b>
              <span>Total de arquivos</span>
            </div>
            <div className="oc-stat">
              <b>{statsPorTipo['PDF']}</b>
              <span>PDF</span>
            </div>
            <div className="oc-stat">
              <b>{statsPorTipo['Excel']}</b>
              <span>Excel</span>
            </div>
            <div className="oc-stat">
              <b>{statsPorTipo['Word']}</b>
              <span>Word</span>
            </div>
            <div className="oc-stat">
              <b>{statsPorTipo['Imagem']}</b>
              <span>Imagem</span>
            </div>
            <div className="oc-stat">
              <b>{statsPorTipo['Arquivo']}</b>
              <span>Outros</span>
            </div>
          </div>

          <div className="oc-filtros noprint">
            <input
              id="arqBusca"
              className="oc-input"
              placeholder="🔍 Buscar pelo nome ou título do arquivo..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <select
              id="arqFiltroTipo"
              className="oc-select"
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

          <div className="oc-arq-lista" id="arqLista">
            {carregando ? (
              <div className="oc-empty">Carregando arquivos de ocorrência...</div>
            ) : !arquivos.length ? (
              <div className="oc-empty">
                Nenhum arquivo arquivado ainda.
                <br />
                Escolha os arquivos acima e clique em “💾 Salvar arquivos”.
              </div>
            ) : !arquivosFiltrados.length ? (
              <div className="oc-empty">Nenhum arquivo encontrado com esta busca / filtro.</div>
            ) : (
              arquivosFiltrados.map((a, idx) => {
                const t = tipoAnexo(a.nome, a.mime)
                const icone = a.icone || t.icone
                const rotulo = a.rotulo || t.rotulo
                const quando = a.anexadoEm
                  ? `📅 Anexado em ${a.anexadoEm}`
                  : '📅 Data de anexo não registrada'

                return (
                  <div key={idx} className="oc-arq-item">
                    <span className="oc-anexo-ic">{icone}</span>
                    <div className="oc-anexo-info">
                      <b>{a.nome}</b>
                      {a.titulo && <span className="titulo-arq">{a.titulo}</span>}
                      <span>
                        {rotulo} • {fmtTamanho(a.tamanho)}
                      </span>
                      <span>{quando}</span>
                    </div>
                    <div className="oc-anexo-acoes">
                      {a.dataUrl ? (
                        <>
                          <a href={a.dataUrl} target="_blank" rel="noopener noreferrer">
                            👁️ Visualizar / Abrir
                          </a>
                          <a
                            href={a.dataUrl}
                            download={a.nome}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            ⬇️ Baixar
                          </a>
                        </>
                      ) : (
                        <span className="text-xs font-bold text-gray-500">Sem conteúdo</span>
                      )}
                      <button
                        type="button"
                        className="del"
                        onClick={() => handleExcluirArquivo(idx, a.nome)}
                      >
                        {confirmExcluir[idx]
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

        {/* Rodapé institucional */}
        <footer className="text-[#374151] font-semibold text-xs text-center mt-7 leading-relaxed">
          Hydro Reabilitação — Segurança • Relatório de Ocorrência • Arquivos sincronizados com o
          banco de dados Supabase.
        </footer>
      </div>

      {/* Toast Notification */}
      {toastMsg && <div className="oc-toast">{toastMsg}</div>}
    </div>
  )
}

