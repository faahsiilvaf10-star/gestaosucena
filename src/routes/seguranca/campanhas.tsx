import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useMemo, useEffect } from 'react'
import { CAMPANHAS_ANUAIS, getCampanhaAtual, type CampanhaData } from '@/lib/campanhasData'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Search,
  Printer,
  Copy,
  X,
  Heart,
  ZoomIn,
  Calendar,
  AlertTriangle,
} from 'lucide-react'

export const Route = createFileRoute('/seguranca/campanhas')({
  component: CampanhasPage,
})

function normTxt(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function CampanhasPage() {
  const [busca, setBusca] = useState('')
  const [filtroArte, setFiltroArte] = useState<'todas' | 'com' | 'sem'>('todas')
  const [modalMes, setModalMes] = useState<CampanhaData | null>(null)

  // Campanha atual (destaque)
  const campanhaAtual = useMemo(() => getCampanhaAtual(), [])

  // Filtragem
  const campanhasFiltradas = useMemo(() => {
    const q = normTxt(busca.trim())
    return CAMPANHAS_ANUAIS.filter((c) => {
      const matchBusca =
        !q ||
        normTxt(`${c.mes} ${c.camp} ${c.tema} ${c.desc} ${c.frase}`).includes(q)

      const matchArte =
        filtroArte === 'todas' ||
        (filtroArte === 'com' && c.arte) ||
        (filtroArte === 'sem' && !c.arte)

      return matchBusca && matchArte
    })
  }, [busca, filtroArte])

  // Fechar modal com tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalMes(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Copiar resumo anual
  const copiarResumo = () => {
    let s =
      'CAMPANHAS DE CONSCIENTIZAÇÃO — CALENDÁRIO ANUAL (Hydro Reabilitação / Sucena Empreendimentos)\n\n'
    CAMPANHAS_ANUAIS.forEach((m) => {
      s += `${m.mes} — ${m.camp}\nConscientização: ${m.tema}\n${m.desc}\nFrase: "${m.frase}"\n\n`
    })

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(s).then(() => {
        toast.success('📋 Resumo do ano copiado para a área de transferência!')
      })
    } else {
      prompt('Copie o resumo anual:', s)
    }
  }

  // Imprimir resumo anual
  const imprimirResumo = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-white text-[#111827] pb-24 font-sans">
      <style>{`
        /* CSS da página Campanhas — Segurança (Hydro Reabilitação) */
        label { font-size: 13px; font-weight: 900; letter-spacing: .03em; color: #000; display: block; margin: 14px 0 6px; text-transform: uppercase; }
        input, select { width: 100%; border: 1.5px solid #9ca3af; border-radius: 12px; padding: 12px 13px; font-size: 15px; font-family: inherit; outline: 0; background: #fff; color: #000; font-weight: 700; }
        input:focus, select:focus { border-color: #f5c518; box-shadow: 0 0 0 3px #fef3c7; }
        input::placeholder { color: #374151 !important; opacity: 1; font-weight: 600; }
        select option { color: #000; background: #fff; font-weight: 700; }
        .card { background: #fff; border: 1.5px solid #e5e7eb; border-radius: 20px; padding: 20px 22px; box-shadow: 0 8px 30px rgba(0,0,0,.05); margin-bottom: 20px; }
        .btn { border: 0; border-radius: 12px; padding: 13px 20px; font-weight: 800; font-size: 15px; cursor: pointer; transition: all .15s ease; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
        .btn-yellow { background: #f5c518; color: #111; }
        .btn-yellow:hover { background: #eab308; }
        .btn-dark { background: #111; color: #fff; }
        .btn-dark:hover { background: #000; }
        .btn-sm { padding: 8px 14px; font-size: 13px; border-radius: 10px; }
        .pill { display: inline-flex; align-items: center; font-weight: 900; font-size: 11.5px; padding: 5px 11px; border-radius: 999px; letter-spacing: .04em; text-transform: uppercase; color: #fff; }
        .destaque { border: 2px solid #111827; border-radius: 22px; overflow: hidden; margin-bottom: 20px; background: #fff; box-shadow: 0 10px 34px rgba(0,0,0,.08); }
        .mes { border: 1.5px solid #e5e7eb; border-radius: 20px; overflow: hidden; background: #fff; display: flex; flex-direction: column; box-shadow: 0 6px 22px rgba(0,0,0,.05); transition: transform .2s ease, box-shadow .2s ease; }
        .mes:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(0,0,0,.09); }
        .imgbox { height: 290px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: zoom-in; }
        .imgbox img { width: 100%; height: 100%; object-fit: contain; display: block; }
        .semarte { height: 290px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; text-align: center; padding: 20px; background: linear-gradient(160deg, #ffffff, #e5e7eb); color: #111; }
        .dot { display: inline-block; width: 14px; height: 14px; border-radius: 50%; vertical-align: -2px; margin-right: 7px; border: 1px solid #9ca3af; }
        @media print {
          .noprint { display: none !important; }
        }
      `}</style>

      {/* Conteúdo Principal */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        {/* Topo com Botão Voltar e Breadcrumbs */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-3 noprint">
          <Link
            to="/seguranca"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 font-bold text-xs shadow-2xs transition"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar para Segurança
          </Link>
          <div className="text-xs text-gray-600 font-semibold">
            Segurança &nbsp;›&nbsp; <strong className="text-black">Campanhas</strong>
          </div>
        </div>

        {/* Título Principal */}
        <div className="mb-4">
          <h1 className="text-3xl sm:text-4xl font-black text-black tracking-tight flex items-center gap-3">
            <Heart className="w-9 h-9 text-rose-600" />
            🎗️ Campanhas de Segurança e Saúde
          </h1>
          <p className="text-sm sm:text-base text-gray-900 font-medium mt-2 leading-relaxed">
            Calendário anual das <strong>campanhas de conscientização</strong> da Sucena Empreendimentos: <strong>uma campanha para cada mês do ano</strong>, com a <strong>arte oficial de cada mês</strong> e, na descrição de cada mês, <strong>qual é a conscientização</strong> daquele mês. Clique em uma arte para ampliar e ver todos os detalhes.
          </p>
        </div>

        {/* Alerta explicativo */}
        <div className="p-4 rounded-xl border border-amber-300 border-l-6 border-l-amber-500 bg-amber-50/70 mb-5 text-gray-900 noprint">
          <strong className="text-amber-950 block font-black text-sm">⚠️ Janeiro Branco:</strong>
          <p className="text-xs sm:text-sm font-semibold mt-1 leading-relaxed text-black">
            De janeiro a dezembro são 12 campanhas. Você enviou as artes de <strong>fevereiro a dezembro (11 artes)</strong> — todas estão nesta página, cada uma no seu mês. A arte de <strong>janeiro (Janeiro Branco — saúde mental)</strong> não foi enviada, então o card de janeiro ficou reservado, sem imagem, até você mandar a arte oficial dele. Nenhuma imagem foi inventada.
          </p>
        </div>

        {/* =========================================================================
            DESTAQUE: CAMPANHA DESTE MÊS (CALCULADO AUTOMATICAMENTE)
           ========================================================================= */}
        <div className="destaque">
          <div
            className="h-3 w-full"
            style={{ background: campanhaAtual.stripGradient || campanhaAtual.cor }}
          />
          <div className="grid grid-cols-1 md:grid-cols-12 gap-0">
            {/* Imagem em destaque */}
            <div className="md:col-span-5 bg-gray-50 flex items-center justify-center p-3 border-b md:border-b-0 md:border-r border-gray-200">
              {campanhaAtual.imagem ? (
                <img
                  src={campanhaAtual.imagem}
                  alt={`Arte oficial — ${campanhaAtual.camp}`}
                  className="w-full max-h-96 object-contain cursor-zoom-in"
                  onClick={() => setModalMes(campanhaAtual)}
                />
              ) : (
                <div className="semarte w-full min-h-[300px]">
                  <div className="text-6xl">🎗️</div>
                  <b className="text-xl text-black">JANEIRO BRANCO</b>
                  <span className="text-xs font-bold text-gray-600">
                    Arte oficial ainda não enviada.
                  </span>
                </div>
              )}
            </div>

            {/* Informações da campanha deste mês */}
            <div className="md:col-span-7 p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <span className="pill" style={{ background: campanhaAtual.cor }}>
                  📍 Campanha deste mês ({campanhaAtual.mes})
                </span>

                <h2 className="text-2xl sm:text-3xl font-black text-black mt-3 leading-tight">
                  {campanhaAtual.camp}
                </h2>

                <div className="mt-3">
                  <span className="text-xs font-black uppercase text-gray-600 block">
                    Conscientização do Mês:
                  </span>
                  <p className="text-sm sm:text-base font-black text-black leading-snug">
                    {campanhaAtual.tema}
                  </p>
                </div>

                <p className="text-xs sm:text-sm font-semibold text-gray-800 leading-relaxed mt-3">
                  {campanhaAtual.desc}
                </p>

                <p className="text-xs sm:text-sm font-bold text-black italic mt-3 border-l-4 border-amber-400 pl-3 py-1 bg-amber-50/60 rounded-r">
                  “{campanhaAtual.frase}”
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-200 noprint">
                <button
                  type="button"
                  className="btn btn-dark btn-sm"
                  onClick={() => setModalMes(campanhaAtual)}
                >
                  <ZoomIn className="w-4 h-4" /> Ver detalhes / Ampliar arte
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            CALENDÁRIO ANUAL DE CAMPANHAS — MÊS A MÊS
           ========================================================================= */}
        <section className="card" id="calendarioSection">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-black flex items-center gap-2">
              📅 Calendário anual de campanhas — mês a mês
            </h2>
            <span className="text-xs font-bold text-gray-700 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
              12 meses
            </span>
          </div>

          <p className="text-sm font-semibold text-gray-900 mt-1 leading-relaxed">
            Use a busca para encontrar um mês, uma cor ou um tema (ex.: câncer, sangue, trânsito, saúde mental). Clique na arte ou em <strong>Ver detalhes</strong> para ampliar a imagem e ler a descrição completa da conscientização daquele mês.
          </p>

          {/* Barra de Busca e Filtro */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end mt-4 noprint">
            <div className="sm:col-span-8">
              <label htmlFor="buscaCamp">Buscar campanha</label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3.5" />
                <input
                  id="buscaCamp"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                  placeholder="Buscar por mês, cor ou tema de conscientização..."
                />
              </div>
            </div>

            <div className="sm:col-span-4">
              <label htmlFor="filtroArte">Mostrar</label>
              <select
                id="filtroArte"
                value={filtroArte}
                onChange={(e) => setFiltroArte(e.target.value as any)}
              >
                <option value="todas">Todas as campanhas (12 meses)</option>
                <option value="com">Somente com arte oficial</option>
                <option value="sem">Somente sem arte enviada</option>
              </select>
            </div>
          </div>

          {/* Contador de resultados */}
          <p className="text-xs sm:text-sm font-black text-black mt-3 mb-2">
            Mostrando {campanhasFiltradas.length} de 12 campanhas — 11 com arte oficial enviada e 1 aguardando arte (janeiro).
          </p>

          {/* Grade com os 12 meses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
            {campanhasFiltradas.map((c) => (
              <article key={c.n} className="mes">
                {/* Faixa temática */}
                <div
                  className="h-2.5 w-full"
                  style={{ background: c.stripGradient || c.cor }}
                />

                {/* Imagem ou Sem Arte */}
                {c.imagem ? (
                  <div className="imgbox" onClick={() => setModalMes(c)}>
                    <img
                      src={c.imagem}
                      alt={`Arte oficial — ${c.camp}`}
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="semarte">
                    <div className="text-5xl">🎗️</div>
                    <b className="text-lg text-black">JANEIRO<br />BRANCO</b>
                    <span className="text-xs font-bold text-gray-700">
                      Arte oficial ainda não enviada.<br />
                      Espaço reservado para a arte deste mês<br />
                      — nenhuma imagem foi inventada.
                    </span>
                  </div>
                )}

                {/* Corpo do card */}
                <div className="p-4 flex flex-col gap-2 flex-1 justify-between">
                  <div>
                    <span className="pill" style={{ background: c.cor }}>
                      {c.mes} • Mês {c.n} de 12
                    </span>

                    <h3 className="text-lg font-black text-black mt-2 leading-tight">
                      {c.mes}
                    </h3>

                    <div className="text-base font-black leading-tight" style={{ color: c.cor }}>
                      {c.camp}
                    </div>

                    <div className="text-xs sm:text-sm font-black text-black mt-1 leading-snug">
                      💡 Conscientização: {c.tema}
                    </div>

                    <p className="text-xs font-semibold text-gray-800 leading-relaxed mt-1 line-clamp-3">
                      {c.desc}
                    </p>

                    <p className="text-[11px] font-bold text-black italic mt-1.5 border-l-2 border-amber-400 pl-2">
                      “{c.frase}”
                    </p>
                  </div>

                  <div className="pt-2 border-t border-gray-100 noprint">
                    <button
                      type="button"
                      className="btn btn-dark btn-sm w-full"
                      onClick={() => setModalMes(c)}
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                      {c.arte ? 'Ver detalhes / Ampliar arte' : 'Ver detalhes'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {!campanhasFiltradas.length && (
            <div className="p-8 text-center text-gray-600 font-bold border border-dashed border-gray-300 rounded-2xl bg-gray-50/50 mt-4">
              Nenhuma campanha encontrada para esta busca.
              <br />
              Limpe o campo de busca para ver todos os 12 meses de novo.
            </div>
          )}
        </section>

        {/* =========================================================================
            RESUMO DO ANO — TODAS AS CAMPANHAS
           ========================================================================= */}
        <section className="card" id="resumoSection">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-black flex items-center gap-2">
              🗓️ Resumo do ano — todas as campanhas
            </h2>
            <span className="text-xs font-extrabold text-gray-700 bg-gray-100 px-3 py-1 rounded-full border border-gray-300">
              Sucena Empreendimentos
            </span>
          </div>

          <p className="text-sm font-semibold text-gray-900 mt-1 leading-relaxed">
            Visão rápida de todos os meses, com a campanha (cor) e qual é a conscientização de cada um. Use este resumo para planejar DDS, murais e ações de cada mês.
          </p>

          <div className="overflow-x-auto mt-4 rounded-xl border border-gray-200">
            <table className="w-full border-collapse min-w-[680px]">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-black text-left text-xs font-black text-black uppercase">
                  <th className="p-3">Mês</th>
                  <th className="p-3">Campanha</th>
                  <th className="p-3">Conscientização</th>
                  <th className="p-3">Arte oficial</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {CAMPANHAS_ANUAIS.map((m) => (
                  <tr key={m.n} className="hover:bg-amber-50/40 transition">
                    <td className="p-3 font-black text-black">{m.mes}</td>
                    <td className="p-3 font-bold text-black flex items-center">
                      <span className="dot" style={{ background: m.cor }} />
                      <strong style={{ color: m.cor }}>{m.camp}</strong>
                    </td>
                    <td className="p-3 font-semibold text-gray-900">{m.tema}</td>
                    <td className="p-3 font-bold text-xs">
                      {m.arte ? (
                        <span className="text-emerald-700">✅ Arte enviada</span>
                      ) : (
                        <span className="text-amber-700">⏳ Aguardando arte oficial</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2.5 flex-wrap mt-4 noprint">
            <button className="btn btn-dark" type="button" onClick={imprimirResumo}>
              <Printer className="w-4 h-4" /> Imprimir / Salvar em PDF
            </button>
            <button className="btn btn-yellow" type="button" onClick={copiarResumo}>
              <Copy className="w-4 h-4" /> Copiar resumo do ano (texto)
            </button>
          </div>
        </section>

        {/* Rodapé da Página */}
        <footer className="mt-8 text-center text-xs font-semibold text-gray-600">
          Hydro Reabilitação — Segurança • Campanhas • Artes oficiais da Sucena Empreendimentos enviadas para fevereiro a dezembro. O card de janeiro (Janeiro Branco — saúde mental) ficou reservado, sem imagem, até a arte oficial ser enviada.
        </footer>
      </main>

      {/* =========================================================================
          MODAL DETALHADO / AMPLIAR ARTE
         ========================================================================= */}
      {modalMes && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          style={{ zIndex: 9999999 }}
          onClick={() => setModalMes(null)}
        >
          <div
            className="relative w-full max-w-4xl bg-white rounded-2xl overflow-hidden shadow-2xl my-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Faixa temática */}
            <div
              className="h-3 w-full"
              style={{ background: modalMes.stripGradient || modalMes.cor }}
            />

            {/* Botão fechar */}
            <button
              onClick={() => setModalMes(null)}
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-black text-white flex items-center justify-center hover:bg-gray-800 transition z-10"
              title="Fechar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Lado da Imagem */}
              <div className="bg-gray-100 flex items-center justify-center p-4">
                {modalMes.imagem ? (
                  <img
                    src={modalMes.imagem}
                    alt={`Arte oficial — ${modalMes.camp}`}
                    className="max-h-[75vh] w-full object-contain rounded-xl"
                  />
                ) : (
                  <div className="semarte w-full min-h-[350px]">
                    <div className="text-6xl">🎗️</div>
                    <b className="text-xl text-black">JANEIRO BRANCO</b>
                    <span className="text-xs font-bold text-gray-600">
                      Arte oficial ainda não enviada.<br />
                      Espaço reservado para a arte deste mês.
                    </span>
                  </div>
                )}
              </div>

              {/* Lado do Texto */}
              <div className="p-6 flex flex-col justify-between">
                <div>
                  <span className="pill" style={{ background: modalMes.cor }}>
                    {modalMes.mes} • Mês {modalMes.n} de 12
                  </span>

                  <h2 className="text-2xl sm:text-3xl font-black text-black mt-3 leading-tight">
                    {modalMes.camp}
                  </h2>

                  <div className="mt-3">
                    <span className="text-xs font-black uppercase text-gray-600 block">
                      Conscientização:
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-black leading-snug">
                      {modalMes.tema}
                    </h3>
                  </div>

                  <p className="text-xs sm:text-sm font-semibold text-gray-800 leading-relaxed mt-3">
                    {modalMes.desc}
                  </p>

                  <p className="text-xs sm:text-sm font-bold text-black italic mt-3 border-l-4 border-amber-400 pl-3 py-1 bg-amber-50 rounded-r">
                    “{modalMes.frase}”
                  </p>
                </div>

                <div className="mt-6 pt-3 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setModalMes(null)}
                    className="btn btn-dark w-full"
                  >
                    Fechar Detalhes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

