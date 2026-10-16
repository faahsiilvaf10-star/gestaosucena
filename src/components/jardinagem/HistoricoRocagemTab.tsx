import { useState, useMemo } from 'react'
import Calendar from 'lucide-react/dist/esm/icons/calendar.js'
import Layers from 'lucide-react/dist/esm/icons/layers.js'
import MapPin from 'lucide-react/dist/esm/icons/map-pin.js'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js'
import Copy from 'lucide-react/dist/esm/icons/copy.js'
import Search from 'lucide-react/dist/esm/icons/search.js'
import ArrowUpDown from 'lucide-react/dist/esm/icons/arrow-up-down.js'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link.js'
import Table from 'lucide-react/dist/esm/icons/table.js'
import Check from 'lucide-react/dist/esm/icons/check.js'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw.js'
import { toast } from 'sonner'
import {
  RocagemEntry,
  RocagemCycle,
  formatM2,
  getAvailableCycles
} from '../../lib/jardinagemRocagem'

interface HistoricoRocagemTabProps {
  records: RocagemEntry[]
  loading: boolean
  onSelectDate: (date: string) => void
  onRefresh: () => void
}

export function HistoricoRocagemTab({
  records,
  loading,
  onSelectDate,
  onRefresh
}: HistoricoRocagemTabProps) {
  // Lista de ciclos disponíveis
  const availableCycles = useMemo(() => {
    return getAvailableCycles(records)
  }, [records])

  // Ciclo selecionado (padrão é o mais recente)
  const [selectedCycleId, setSelectedCycleId] = useState<string>(() => {
    return availableCycles[0]?.id || ''
  })

  // Se o ciclo selecionado não existir mais, volta pro primeiro
  const currentCycle = useMemo(() => {
    const found = availableCycles.find(c => c.id === selectedCycleId)
    return found || availableCycles[0]
  }, [availableCycles, selectedCycleId])

  const [viewMode, setViewMode] = useState<'faixa-berma' | 'cronologica' | 'matriz'>('faixa-berma')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFaixaFilter, setSelectedFaixaFilter] = useState<string>('todas')
  const [copied, setCopied] = useState(false)

  // Registros pertencentes ao ciclo atual
  const cycleRecords = useMemo(() => {
    if (!currentCycle) return []
    return records
      .filter(r => r.date >= currentCycle.startDate && r.date <= currentCycle.endDate)
      // Ordenação rigorosamente na data crescente
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [records, currentCycle])

  // Registros filtrados pela busca
  const filteredRecords = useMemo(() => {
    return cycleRecords.filter(r => {
      const term = searchTerm.toLowerCase().trim()
      const matchesSearch = !term ||
        r.faixa.toLowerCase().includes(term) ||
        r.berma.toLowerCase().includes(term) ||
        r.date.includes(term)

      const matchesFaixa = selectedFaixaFilter === 'todas' || r.faixa === selectedFaixaFilter

      return matchesSearch && matchesFaixa
    })
  }, [cycleRecords, searchTerm, selectedFaixaFilter])

  // Total geral do ciclo
  const totalGeralM2 = useMemo(() => {
    return cycleRecords.reduce((sum, r) => sum + r.value, 0)
  }, [cycleRecords])

  // Total filtrado
  const totalFiltradoM2 = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + r.value, 0)
  }, [filteredRecords])

  // Métricas do ciclo
  const diasUnicos = useMemo(() => {
    return new Set(cycleRecords.map(r => r.date)).size
  }, [cycleRecords])

  const faixasUnicas = useMemo(() => {
    return Array.from(new Set(cycleRecords.map(r => r.faixa))).sort()
  }, [cycleRecords])

  const bermasUnicas = useMemo(() => {
    return Array.from(new Set(cycleRecords.map(r => r.berma))).sort()
  }, [cycleRecords])

  // Agrupamento separado por Faixa e depois por Berma (com datas em ordem crescente)
  const groupedByFaixaAndBerma = useMemo(() => {
    const groups: Record<string, {
      totalFaixaM2: number;
      bermas: Record<string, {
        totalBermaM2: number;
        items: RocagemEntry[];
      }>;
    }> = {}

    // Processa os registros filtrados mantendo a data crescente
    filteredRecords.forEach(record => {
      const f = record.faixa || 'Sem Faixa'
      const b = record.berma || 'Sem Berma'

      if (!groups[f]) {
        groups[f] = { totalFaixaM2: 0, bermas: {} }
      }
      groups[f].totalFaixaM2 += record.value

      if (!groups[f].bermas[b]) {
        groups[f].bermas[b] = { totalBermaM2: 0, items: [] }
      }
      groups[f].bermas[b].totalBermaM2 += record.value
      groups[f].bermas[b].items.push(record)
    })

    // Garante que dentro de cada berma a ordem das datas é crescente
    Object.keys(groups).forEach(fKey => {
      Object.keys(groups[fKey].bermas).forEach(bKey => {
        groups[fKey].bermas[bKey].items.sort((a, b) => a.date.localeCompare(b.date))
      })
    })

    return groups
  }, [filteredRecords])

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
  }

  const formatLongDate = (dateStr: string) => {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-')
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
    const weekDays = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
    return `${d}/${m}/${y.slice(-2)} (${weekDays[date.getDay()]})`
  }

  // Copiar relatório formatado em texto
  const handleCopyReport = () => {
    if (!currentCycle) return

    let text = `🌱 *HISTÓRICO DE ROÇAGEM - PERÍODO ${currentCycle.label.toUpperCase()}*\n`
    text += `📊 Total do Período: ${formatM2(totalGeralM2)} m²\n`
    text += `📅 Dias Trabalhados: ${diasUnicos} dias | Lançamentos: ${cycleRecords.length}\n\n`

    Object.keys(groupedByFaixaAndBerma).sort().forEach(faixa => {
      const fData = groupedByFaixaAndBerma[faixa]
      text += `📍 *${faixa.toUpperCase()}* — Total: ${formatM2(fData.totalFaixaM2)} m²\n`

      Object.keys(fData.bermas).sort().forEach(berma => {
        const bData = fData.bermas[berma]
        text += `  • *${berma}:* ${formatM2(bData.totalBermaM2)} m²\n`
        bData.items.forEach(it => {
          text += `    - ${formatDateDisplay(it.date)}: ${formatM2(it.value)} m²\n`
        })
      })
      text += `\n`
    })

    text += `_Relatório gerado em ${new Date().toLocaleDateString('pt-BR')} via Gestão Sucena_`

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      toast.success('Relatório de roçagem copiado com sucesso!')
      setTimeout(() => setCopied(false), 2500)
    }).catch(() => {
      toast.error('Erro ao copiar relatório.')
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Barra Superior de Seleção do Ciclo e Ações */}
      <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Calendar className="text-emerald-600" size={20} />
            <h2 className="text-xl font-bold text-gray-900">Período de Medição (Ciclo 16 a 15)</h2>
          </div>
          <p className="text-xs text-gray-500">
            A soma em m² é acumulada rigorosamente do dia 16 do mês de início até o dia 15 do mês seguinte.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Seletor de Ciclo */}
          <div className="relative">
            <select
              value={currentCycle?.id || ''}
              onChange={e => setSelectedCycleId(e.target.value)}
              className="bg-[#faf9f6] border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 appearance-none pr-9 cursor-pointer shadow-sm hover:border-gray-400 transition-colors"
            >
              {availableCycles.map(c => (
                <option key={c.id} value={c.id}>
                  {c.label} ({c.monthName})
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 text-xs">
              ▼
            </div>
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors shadow-sm"
            title="Atualizar dados"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleCopyReport}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm shadow-emerald-600/20"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copiado!' : 'Copiar Resumo'}
          </button>
        </div>
      </div>

      {/* KPI Cards do Ciclo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total em m² */}
        <div className="bg-gradient-to-br from-emerald-50 to-green-50/50 border border-emerald-200 rounded-3xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Total Roçado no Período
            </span>
            <span className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs">
              m²
            </span>
          </div>
          <div className="text-3xl sm:text-4xl font-extrabold text-emerald-950 tracking-tight">
            {formatM2(totalGeralM2)}
            <span className="text-base font-semibold text-emerald-700 ml-1">m²</span>
          </div>
          <p className="text-[11px] text-emerald-700 mt-2 flex items-center gap-1 font-medium">
            <Sparkles size={13} /> Ciclo {currentCycle?.label}
          </p>
        </div>

        {/* Dias com Roçagem */}
        <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Dias com Registro
            </span>
            <Calendar size={18} className="text-gray-400" />
          </div>
          <div className="text-3xl font-extrabold text-gray-900 tracking-tight">
            {diasUnicos}
            <span className="text-sm font-normal text-gray-500 ml-1.5">dias</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            {cycleRecords.length} lançamentos individuais
          </p>
        </div>

        {/* Faixas Trabalhadas */}
        <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Faixas Atendidas
            </span>
            <Layers size={18} className="text-gray-400" />
          </div>
          <div className="text-3xl font-extrabold text-gray-900 tracking-tight">
            {faixasUnicas.length}
            <span className="text-sm font-normal text-gray-500 ml-1.5">faixas</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-2 truncate" title={faixasUnicas.join(', ')}>
            {faixasUnicas.length > 0 ? faixasUnicas.join(', ') : 'Nenhuma'}
          </p>
        </div>

        {/* Bermas Trabalhadas */}
        <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Bermas Atendidas
            </span>
            <MapPin size={18} className="text-gray-400" />
          </div>
          <div className="text-3xl font-extrabold text-gray-900 tracking-tight">
            {bermasUnicas.length}
            <span className="text-sm font-normal text-gray-500 ml-1.5">bermas</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            Média: {diasUnicos > 0 ? formatM2(Math.round(totalGeralM2 / diasUnicos)) : '0'} m²/dia
          </p>
        </div>
      </div>

      {/* Controles de Visualização e Filtros */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Alternância de Modo de Exibição */}
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('faixa-berma')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'faixa-berma'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Layers size={14} className="text-emerald-600" />
            Por Faixa e Berma
          </button>

          <button
            onClick={() => setViewMode('cronologica')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'cronologica'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ArrowUpDown size={14} className="text-emerald-600" />
            Data Crescente (Tabela)
          </button>

          <button
            onClick={() => setViewMode('matriz')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'matriz'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Table size={14} className="text-emerald-600" />
            Resumo Consolidado
          </button>
        </div>

        {/* Filtros rápidos: busca e faixa */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro por Faixa */}
          <div className="relative">
            <select
              value={selectedFaixaFilter}
              onChange={e => setSelectedFaixaFilter(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-medium text-gray-700 outline-none appearance-none pr-7 cursor-pointer"
            >
              <option value="todas">Todas as Faixas</option>
              {faixasUnicas.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-[10px]">
              ▼
            </div>
          </div>

          {/* Busca textual */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs w-full sm:w-56 focus-within:border-emerald-500 focus-within:bg-white transition-all">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Buscar berma, faixa..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent outline-none w-full text-xs text-gray-800 placeholder-gray-400"
            />
          </div>
        </div>
      </div>

      {/* Conteúdo Principal conforme viewMode */}
      {cycleRecords.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-3xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <Calendar size={28} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Nenhum registro de roçagem neste período</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
            Não foram encontrados lançamentos de roçagem entre <strong>{currentCycle?.label}</strong>.
            Lançamentos feitos na aba "Registro Diário" com datas nesse intervalo aparecerão aqui automaticamente.
          </p>
        </div>
      ) : viewMode === 'faixa-berma' ? (
        /* VISUALIZAÇÃO 1: SEPARADA POR FAIXA E BERMA (COM ORDEM EM DATA CRESCENTE) */
        <div className="flex flex-col gap-5">
          {Object.keys(groupedByFaixaAndBerma).length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-500 text-sm">
              Nenhum registro corresponde aos filtros selecionados.
            </div>
          ) : (
            Object.keys(groupedByFaixaAndBerma).sort().map(faixaKey => {
              const faixaGroup = groupedByFaixaAndBerma[faixaKey]
              const bermasKeys = Object.keys(faixaGroup.bermas).sort()

              return (
                <div
                  key={faixaKey}
                  className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm transition-all"
                >
                  {/* Cabeçalho da Faixa */}
                  <div className="bg-gradient-to-r from-emerald-50/70 via-gray-50 to-white px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-extrabold flex items-center justify-center text-sm shadow-sm">
                        {faixaKey.replace(/\D/g, '') || 'F'}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-gray-900 tracking-tight">
                          {faixaKey}
                        </h3>
                        <span className="text-xs text-gray-500">
                          {bermasKeys.length} {bermasKeys.length === 1 ? 'berma trabalhada' : 'bermas trabalhadas'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-medium">Subtotal da Faixa:</span>
                      <span className="px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 font-extrabold text-sm border border-emerald-200">
                        {formatM2(faixaGroup.totalFaixaM2)} m²
                      </span>
                    </div>
                  </div>

                  {/* Lista de Bermas dentro desta Faixa */}
                  <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {bermasKeys.map(bermaKey => {
                      const bermaGroup = faixaGroup.bermas[bermaKey]

                      return (
                        <div
                          key={bermaKey}
                          className="bg-[#faf9f6] border border-gray-200 rounded-2xl p-4 flex flex-col justify-between hover:border-emerald-300 transition-colors"
                        >
                          <div>
                            {/* Título da Berma e Subtotal */}
                            <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-gray-200">
                              <span className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
                                <MapPin size={14} className="text-emerald-600 shrink-0" />
                                {bermaKey}
                              </span>
                              <span className="text-xs font-bold text-emerald-700 bg-white px-2.5 py-0.5 rounded-lg border border-emerald-200 shadow-2xs">
                                {formatM2(bermaGroup.totalBermaM2)} m²
                              </span>
                            </div>

                            {/* Entradas organizadas em ordem na data crescente */}
                            <div className="flex flex-col gap-2">
                              {bermaGroup.items.map((item, itIdx) => (
                                <div
                                  key={`${item.date}-${itIdx}`}
                                  className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-gray-100 text-xs hover:border-gray-300 transition-colors group"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-700">
                                      {formatDateDisplay(item.date)}
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                      {formatLongDate(item.date).split('(')[1]?.replace(')', '') || ''}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-gray-900">
                                      {formatM2(item.value)} m²
                                    </span>
                                    <button
                                      onClick={() => onSelectDate(item.date)}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                                      title="Abrir RDO desta data"
                                    >
                                      <ExternalLink size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="mt-3 pt-2 text-[10px] text-gray-400 text-right">
                            {bermaGroup.items.length} {bermaGroup.items.length === 1 ? 'registro' : 'registros'} ordenados por data crescente
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      ) : viewMode === 'cronologica' ? (
        /* VISUALIZAÇÃO 2: TABELA CRONOLÓGICA (DATA CRESCENTE 16 A 15) */
        <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-4 bg-[#faf9f6] border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              <ArrowUpDown size={14} className="text-emerald-600" />
              Lançamentos Ordenados por Data Crescente (Dia 16 ao 15)
            </span>
            <span className="text-xs font-semibold text-gray-500">
              {filteredRecords.length} lançamentos encontrados
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200 font-semibold">
                <tr>
                  <th className="px-6 py-3.5">Data (Crescente)</th>
                  <th className="px-6 py-3.5">Dia da Semana</th>
                  <th className="px-6 py-3.5">Faixa</th>
                  <th className="px-6 py-3.5">Berma</th>
                  <th className="px-6 py-3.5 text-right">Quantidade (m²)</th>
                  <th className="px-6 py-3.5 text-right">Acumulado no Ciclo</th>
                  <th className="px-6 py-3.5 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(() => {
                  let runningTotal = 0
                  return filteredRecords.map((rec, idx) => {
                    runningTotal += rec.value

                    return (
                      <tr key={`${rec.date}-${idx}`} className="hover:bg-emerald-50/40 transition-colors">
                        <td className="px-6 py-3.5 font-bold text-gray-900">
                          {formatDateDisplay(rec.date)}
                        </td>
                        <td className="px-6 py-3.5 text-xs text-gray-500 capitalize">
                          {formatLongDate(rec.date).split('(')[1]?.replace(')', '') || ''}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {rec.faixa}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 border border-gray-200">
                            {rec.berma}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right font-extrabold text-gray-900">
                          {formatM2(rec.value)} m²
                        </td>
                        <td className="px-6 py-3.5 text-right font-semibold text-emerald-700 text-xs">
                          {formatM2(runningTotal)} m²
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <button
                            onClick={() => onSelectDate(rec.date)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-all"
                            title="Ver relatório deste dia"
                          >
                            <ExternalLink size={12} />
                            Ver RDO
                          </button>
                        </td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
              <tfoot className="bg-gray-50 font-bold border-t-2 border-gray-200">
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-gray-700 uppercase text-xs">
                    Total Acumulado Filtrado
                  </td>
                  <td className="px-6 py-4 text-right text-emerald-800 text-base font-extrabold">
                    {formatM2(totalFiltradoM2)} m²
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* VISUALIZAÇÃO 3: MATRIZ CONSOLIDADA POR FAIXA E BERMA */
        <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-4 bg-[#faf9f6] border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              <Table size={14} className="text-emerald-600" />
              Quadro Consolidado de Medição por Faixa e Berma
            </span>
            <span className="text-xs text-gray-500 font-semibold">
              Período {currentCycle?.label}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200 font-semibold">
                <tr>
                  <th className="px-6 py-3.5">Faixa</th>
                  <th className="px-6 py-3.5">Berma</th>
                  <th className="px-6 py-3.5 text-center">Dias Atendidos</th>
                  <th className="px-6 py-3.5 text-right">Área Total Roçada (m²)</th>
                  <th className="px-6 py-3.5 text-right">% do Período</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.keys(groupedByFaixaAndBerma).sort().map(faixa => {
                  const fData = groupedByFaixaAndBerma[faixa]
                  return Object.keys(fData.bermas).sort().map((berma, bIdx) => {
                    const bData = fData.bermas[berma]
                    const pct = totalGeralM2 > 0 ? (bData.totalBermaM2 / totalGeralM2) * 100 : 0

                    return (
                      <tr key={`${faixa}-${berma}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3 font-bold text-gray-900">
                          {bIdx === 0 ? faixa : ''}
                        </td>
                        <td className="px-6 py-3 font-medium text-gray-700">
                          {berma}
                        </td>
                        <td className="px-6 py-3 text-center text-xs text-gray-500">
                          {bData.items.length} {bData.items.length === 1 ? 'dia' : 'dias'}
                        </td>
                        <td className="px-6 py-3 text-right font-extrabold text-emerald-800">
                          {formatM2(bData.totalBermaM2)} m²
                        </td>
                        <td className="px-6 py-3 text-right text-xs font-semibold text-gray-500">
                          {pct.toFixed(1)}%
                        </td>
                      </tr>
                    )
                  })
                })}
              </tbody>
              <tfoot className="bg-emerald-50/70 font-extrabold text-emerald-950 border-t-2 border-emerald-200">
                <tr>
                  <td colSpan={3} className="px-6 py-4 uppercase text-xs">
                    Total Geral do Período ({currentCycle?.label})
                  </td>
                  <td className="px-6 py-4 text-right text-base text-emerald-900 font-extrabold">
                    {formatM2(totalGeralM2)} m²
                  </td>
                  <td className="px-6 py-4 text-right text-xs">
                    100.0%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
