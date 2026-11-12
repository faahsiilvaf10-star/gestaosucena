import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { supabase } from '../../lib/supabase'
import {
  filtrarMotoristasEfetivo,
  filtrarEquipamentosPesados,
  carregarVinculosCracha,
  carregarMapaEquipamentoParaMotoristas,
  migrarVinculosLegados,
  vincularEquipamento,
  desvincularEquipamento,
  salvarVinculosCracha,
  type MotoristaRH,
  type EquipamentoItem,
} from '../../lib/equipamentos/crachaVinculado'
import {
  Truck,
  Search,
  Plus,
  X,
  Check,
  Printer,
  ArrowLeft,
  RefreshCw,
  User,
  Users,
  Layers,
  Trash2,
} from 'lucide-react'

export const Route = createFileRoute('/equipamentos/cracha-vinculado')({
  component: CrachaVinculadoComponent,
})

type Aba = 'motoristas' | 'equipamentos'

export function CrachaVinculadoComponent() {
  const [motoristas, setMotoristas] = useState<MotoristaRH[]>([])
  const [equipamentos, setEquipamentos] = useState<EquipamentoItem[]>([])
  // Mapa: { [motorista_id]: equipamento_id[] }
  const [vinculos, setVinculos] = useState<Record<string, string[]>>({})
  // Mapa invertido: { [equipamento_id]: motorista_id[] }
  const [vinculosInvertido, setVinculosInvertido] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  // Aba ativa
  const [aba, setAba] = useState<Aba>('motoristas')

  // Filtros — Motoristas
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'com_vinculo' | 'sem_vinculo'>('todos')
  const [filtroCargo, setFiltroCargo] = useState('todos')
  const [mostrarTodosColabs, setMostrarTodosColabs] = useState(false)

  // Filtros — Equipamentos
  const [buscaEquip, setBuscaEquip] = useState('')

  // Modal de Vínculo
  const [modalMotorista, setModalMotorista] = useState<MotoristaRH | null>(null)
  const [selecionadosModal, setSelecionadosModal] = useState<string[]>([])
  const [buscaEquipModal, setBuscaEquipModal] = useState('')

  const env =
    typeof window !== 'undefined'
      ? localStorage.getItem('sucena_environment') || 'barcarena'
      : 'barcarena'

  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToastMsg({ msg, type })
    setTimeout(() => setToastMsg(null), 3400)
  }, [])

  // ── Carrega dados iniciais ──────────────────────────────────────────────────
  const carregarDados = useCallback(async () => {
    setLoading(true)
    try {
      const [rhRes, eqRes, mapaDir, mapaInv] = await Promise.all([
        supabase
          .from('rh_efetivo')
          .select('id, nome, cargo, status, matricula, foto_url')
          .order('nome', { ascending: true }),
        supabase
          .from('eq_equipments')
          .select('id, name, plate_tag, type, category, status')
          .order('name', { ascending: true }),
        carregarVinculosCracha(env),
        carregarMapaEquipamentoParaMotoristas(env),
      ])

      if (rhRes.error) console.error('[RH Efetivo]', rhRes.error)
      if (eqRes.error) console.error('[Equipamentos]', eqRes.error)

      setMotoristas((rhRes.data as MotoristaRH[]) || [])
      setEquipamentos((eqRes.data as EquipamentoItem[]) || [])
      setVinculos(mapaDir || {})
      setVinculosInvertido(mapaInv || {})

      // Migração silenciosa de legado (roda somente se tabela existir e legado existir)
      migrarVinculosLegados(env).catch(() => {})
    } catch (err) {
      console.error('Falha ao carregar dados:', err)
      showToast('❌ Erro ao conectar com o banco de dados.', 'err')
    } finally {
      setLoading(false)
    }
  }, [env, showToast])

  useEffect(() => { carregarDados() }, [carregarDados])

  // ── Computed ────────────────────────────────────────────────────────────────
  const motoristasBase = useMemo(() => {
    if (mostrarTodosColabs) {
      return motoristas.filter((m) => {
        const s = (m.status || '').toUpperCase()
        return !s.includes('DEMITIDO') && !s.includes('INATIVO') && !s.includes('DESLIGADO')
      })
    }
    return filtrarMotoristasEfetivo(motoristas)
  }, [motoristas, mostrarTodosColabs])

  const equipamentosPesados = useMemo(() => filtrarEquipamentosPesados(equipamentos), [equipamentos])

  const mapaEquipamentos = useMemo(() => {
    const map = new Map<string, EquipamentoItem>()
    for (const eq of equipamentos) map.set(eq.id, eq)
    return map
  }, [equipamentos])

  const mapaMotoristas = useMemo(() => {
    const map = new Map<string, MotoristaRH>()
    for (const m of motoristas) map.set(m.id, m)
    return map
  }, [motoristas])

  const listaCargos = useMemo(() => {
    const cSet = new Set<string>()
    for (const m of motoristasBase) if (m.cargo) cSet.add(m.cargo)
    return Array.from(cSet).sort()
  }, [motoristasBase])

  const motoristasFiltrados = useMemo(() => {
    return motoristasBase.filter((m) => {
      const q = busca.toLowerCase().trim()
      const matchBusca =
        !q ||
        m.nome.toLowerCase().includes(q) ||
        (m.matricula && m.matricula.toLowerCase().includes(q)) ||
        (m.cargo && m.cargo.toLowerCase().includes(q))
      const matchCargo = filtroCargo === 'todos' || m.cargo === filtroCargo
      const qtdVinc = (vinculos[m.id] || []).length
      let matchStatus = true
      if (filtroStatus === 'com_vinculo') matchStatus = qtdVinc > 0
      if (filtroStatus === 'sem_vinculo') matchStatus = qtdVinc === 0
      return matchBusca && matchCargo && matchStatus
    })
  }, [motoristasBase, busca, filtroCargo, filtroStatus, vinculos])

  const equipamentosFiltrados = useMemo(() => {
    const q = buscaEquip.toLowerCase().trim()
    return equipamentosPesados.filter((eq) =>
      !q ||
      eq.name.toLowerCase().includes(q) ||
      (eq.plate_tag && eq.plate_tag.toLowerCase().includes(q)) ||
      (eq.type && eq.type.toLowerCase().includes(q))
    )
  }, [equipamentosPesados, buscaEquip])

  const metricas = useMemo(() => {
    const total = motoristasBase.length
    let comVinculo = 0
    const setEquipsVinc = new Set<string>()
    for (const m of motoristasBase) {
      const v = vinculos[m.id] || []
      if (v.length > 0) { comVinculo++; v.forEach((id) => setEquipsVinc.add(id)) }
    }
    return {
      total,
      comVinculo,
      semVinculo: total - comVinculo,
      totalEquipamentosPesados: equipamentosPesados.length,
      equipsVinculados: setEquipsVinc.size,
    }
  }, [motoristasBase, vinculos, equipamentosPesados])

  // ── Ações ───────────────────────────────────────────────────────────────────
  const handleDesvincularEquipamento = useCallback(async (motoristaId: string, equipId: string, nomeMotorista: string) => {
    // Otimista: atualiza estado imediatamente
    const atuais = vinculos[motoristaId] || []
    const novosEquips = atuais.filter((id) => id !== equipId)
    setVinculos((prev) => ({ ...prev, [motoristaId]: novosEquips }))
    setVinculosInvertido((prev) => ({
      ...prev,
      [equipId]: (prev[equipId] || []).filter((id) => id !== motoristaId),
    }))

    setSaving(true)
    const eq = mapaEquipamentos.get(equipId)
    const ok = await desvincularEquipamento(motoristaId, equipId, env)
    setSaving(false)

    if (ok) {
      showToast(`✓ "${eq?.name || 'Equipamento'}" desvinculado de ${nomeMotorista}.`)
    } else {
      // Reverte
      setVinculos((prev) => ({ ...prev, [motoristaId]: atuais }))
      showToast('⚠️ Falha ao desvincular. Tente novamente.', 'err')
    }
  }, [vinculos, mapaEquipamentos, env, showToast])

  const handleAbrirModal = useCallback((m: MotoristaRH) => {
    setModalMotorista(m)
    setSelecionadosModal(vinculos[m.id] || [])
    setBuscaEquipModal('')
  }, [vinculos])

  const handleSalvarModal = useCallback(async () => {
    if (!modalMotorista) return

    const motId = modalMotorista.id
    const anteriores = vinculos[motId] || []

    // Atualiza otimista
    setVinculos((prev) => ({ ...prev, [motId]: selecionadosModal }))

    // Atualiza mapa invertido otimista
    setVinculosInvertido((prev) => {
      const novo = { ...prev }
      // Remove este motorista de todos os equipamentos anteriores
      for (const eqId of anteriores) {
        novo[eqId] = (novo[eqId] || []).filter((id) => id !== motId)
      }
      // Adiciona para os novos selecionados
      for (const eqId of selecionadosModal) {
        if (!novo[eqId]) novo[eqId] = []
        if (!novo[eqId].includes(motId)) novo[eqId].push(motId)
      }
      return novo
    })

    setModalMotorista(null)
    setSaving(true)

    const ok = await salvarVinculosCracha(
      { ...vinculos, [motId]: selecionadosModal },
      env,
      motId
    )
    setSaving(false)

    if (ok) {
      showToast(`✓ ${selecionadosModal.length} equipamento(s) vinculado(s) a ${modalMotorista.nome}.`)
    } else {
      // Reverte
      setVinculos((prev) => ({ ...prev, [motId]: anteriores }))
      showToast('⚠️ Falha ao salvar. Tente novamente.', 'err')
    }
  }, [modalMotorista, vinculos, selecionadosModal, env, showToast])

  const toggleEquipamentoModal = useCallback((equipId: string) => {
    setSelecionadosModal((prev) =>
      prev.includes(equipId) ? prev.filter((id) => id !== equipId) : [...prev, equipId]
    )
  }, [])

  // ── Impressão ───────────────────────────────────────────────────────────────
  const handleImprimir = () => {
    const w = window.open('', '_blank')
    if (!w) { showToast('Permita pop-ups para imprimir.', 'err'); return }
    const dataHora = new Date().toLocaleString('pt-BR')
    let linhasHtml = ''
    for (const m of motoristasFiltrados) {
      const eqIds = vinculos[m.id] || []
      const nomesEquips = eqIds
        .map((id) => { const eq = mapaEquipamentos.get(id); return eq ? `<b>${eq.name}</b> (${eq.plate_tag || 'S/P'}) — ${eq.type}` : id })
        .join('<br>')
      linhasHtml += `
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:10px;font-weight:bold;">${m.nome}</td>
          <td style="padding:10px;color:#4b5563;">${m.matricula || '-'}</td>
          <td style="padding:10px;color:#4b5563;">${m.cargo}</td>
          <td style="padding:10px;">${nomesEquips || '<span style="color:#9ca3af;">Nenhum</span>'}</td>
        </tr>`
    }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Relatório – Crachá Vinculado</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px}h1{font-size:22px;margin:0 0 4px}p{font-size:13px;color:#6b7280;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;font-size:13px}th{background:#f3f4f6;padding:10px;text-align:left;font-weight:800;border-bottom:2px solid #d1d5db}</style>
      </head><body>
      <h1>Gestão Sucena — Crachá Vinculado (Equipamentos Pesados)</h1>
      <p>Gerado em: ${dataHora}</p>
      <table><thead><tr><th>Motorista / Colaborador</th><th>Matrícula</th><th>Cargo</th><th>Equipamentos Pesados</th></tr></thead>
      <tbody>${linhasHtml}</tbody></table>
      <script>window.print();</script></body></html>`)
    w.document.close()
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 pb-16">
      {/* Toast */}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 font-bold text-sm px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300 ${
          toastMsg.type === 'err' ? 'bg-red-600 text-white' : 'bg-[#111] text-white'
        }`}>
          {toastMsg.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/equipamentos"
              className="w-10 h-10 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition shadow-2xs"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-amber-400 text-black">
                  <Truck className="w-5 h-5" />
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                  Crachá Vinculado
                </h1>
                <span className="text-xs font-black uppercase tracking-wider bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full border border-gray-200">
                  Equipamentos Pesados
                </span>
                {saving && (
                  <span className="text-xs font-bold text-amber-600 animate-pulse ml-1">Salvando…</span>
                )}
              </div>
              <p className="text-xs sm:text-sm font-semibold text-gray-500 mt-0.5">
                Vincule motoristas do RH aos equipamentos pesados (cada motorista pode ter mais de um equipamento).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={carregarDados}
              disabled={loading}
              className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer shadow-2xs"
              title="Recarregar Dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleImprimir}
              className="bg-[#111] hover:bg-black text-white font-bold text-xs sm:text-sm rounded-xl py-2.5 px-4 shadow-xs flex items-center gap-2 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Imprimir Relatório
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full mt-6 space-y-6">
        {/* Métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-5 shadow-xs">
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-500 block">Total de Motoristas</span>
            <div className="text-2xl sm:text-3xl font-black text-black mt-1">{metricas.total}</div>
            <span className="text-xs font-semibold text-gray-500 mt-0.5 block">No quadro do RH efetivo</span>
          </div>
          <div className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-5 shadow-xs">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 block">Com Crachá Vinculado</span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 mt-1">{metricas.comVinculo}</div>
            <span className="text-xs font-semibold text-emerald-600/80 mt-0.5 block">Equipamento(s) atribuído(s)</span>
          </div>
          <div className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-5 shadow-xs">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 block">Sem Vínculo</span>
            <div className="text-2xl sm:text-3xl font-black text-amber-700 mt-1">{metricas.semVinculo}</div>
            <span className="text-xs font-semibold text-amber-600/80 mt-0.5 block">Aguardando atribuição</span>
          </div>
          <div className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-5 shadow-xs">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 block">Equipamentos Pesados</span>
            <div className="text-2xl sm:text-3xl font-black text-blue-700 mt-1">
              {metricas.equipsVinculados} / {metricas.totalEquipamentosPesados}
            </div>
            <span className="text-xs font-semibold text-blue-600/80 mt-0.5 block">Pesados vinculados na frota</span>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => setAba('motoristas')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-extrabold rounded-xl transition ${
              aba === 'motoristas' ? 'bg-white text-black shadow-xs' : 'text-gray-500 hover:text-black'
            }`}
          >
            <User className="w-4 h-4" /> Por Motorista
          </button>
          <button
            type="button"
            onClick={() => setAba('equipamentos')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-extrabold rounded-xl transition ${
              aba === 'equipamentos' ? 'bg-white text-black shadow-xs' : 'text-gray-500 hover:text-black'
            }`}
          >
            <Truck className="w-4 h-4" /> Por Equipamento
          </button>
        </div>

        {/* ── ABA: POR MOTORISTA ── */}
        {aba === 'motoristas' && (
          <>
            {/* Filtros */}
            <div className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-6 relative">
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar motorista por nome ou matrícula..."
                    className="w-full border-2 border-gray-200 rounded-2xl px-4 py-2.5 pl-10 text-sm font-bold text-black placeholder-gray-400 outline-none focus:border-amber-400 transition"
                  />
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  {busca && (
                    <button type="button" onClick={() => setBusca('')} className="absolute right-3 top-3 text-gray-400 hover:text-black">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="sm:col-span-3">
                  <select
                    value={filtroCargo}
                    onChange={(e) => setFiltroCargo(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-2xl px-3 py-2.5 text-sm font-bold text-gray-800 outline-none focus:border-amber-400 transition bg-white"
                  >
                    <option value="todos">Todos os Cargos ({motoristasBase.length})</option>
                    {listaCargos.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-3 flex items-center bg-gray-100 p-1 rounded-2xl">
                  {(['todos', 'com_vinculo', 'sem_vinculo'] as const).map((val, i) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFiltroStatus(val)}
                      className={`flex-1 py-1.5 text-xs font-extrabold rounded-xl transition ${
                        filtroStatus === val
                          ? `bg-white shadow-xs ${i === 1 ? 'text-emerald-700' : i === 2 ? 'text-amber-700' : 'text-black'}`
                          : 'text-gray-500 hover:text-black'
                      }`}
                    >
                      {val === 'todos' ? 'Todos' : val === 'com_vinculo' ? 'Vinculados' : 'Sem Vínculo'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 flex-wrap gap-2 text-xs font-semibold text-gray-600">
                <span>Exibindo <b>{motoristasFiltrados.length}</b> de <b>{motoristasBase.length}</b> colaboradores</span>
                <button
                  type="button"
                  onClick={() => setMostrarTodosColabs(!mostrarTodosColabs)}
                  className="text-amber-700 font-extrabold hover:underline cursor-pointer flex items-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5" />
                  {mostrarTodosColabs ? 'Exibir apenas Motoristas e Operadores' : 'Ver todos os colaboradores do RH (incluir outros cargos)'}
                </button>
              </div>
            </div>

            {/* Skeleton */}
            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs animate-pulse space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gray-200" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-gray-200 rounded-md w-3/4" />
                        <div className="h-3 bg-gray-200 rounded-md w-1/2" />
                      </div>
                    </div>
                    <div className="h-10 bg-gray-100 rounded-2xl" />
                  </div>
                ))}
              </div>
            )}

            {/* Grid de motoristas */}
            {!loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {motoristasFiltrados.length === 0 ? (
                  <div className="col-span-full bg-white border border-gray-200 rounded-3xl p-12 text-center shadow-xs">
                    <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-gray-800">Nenhum motorista encontrado</h3>
                    <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                      Ajuste os filtros de pesquisa ou utilize a opção para incluir outros cargos do RH efetivo.
                    </p>
                    <button
                      type="button"
                      onClick={() => setMostrarTodosColabs(true)}
                      className="mt-4 text-amber-600 font-bold text-sm hover:underline"
                    >
                      Ver todos os colaboradores do RH
                    </button>
                  </div>
                ) : (
                  motoristasFiltrados.map((m) => {
                    const equipsIdsVinculados = vinculos[m.id] || []
                    const temVinculo = equipsIdsVinculados.length > 0

                    return (
                      <div
                        key={m.id}
                        className="bg-white border border-gray-200 hover:border-amber-400 rounded-3xl p-5 sm:p-6 shadow-xs transition-all duration-200 flex flex-col justify-between"
                      >
                        <div>
                          {/* Info do motorista */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3.5 min-w-0">
                              {m.foto_url ? (
                                <img src={m.foto_url} alt={m.nome} className="w-13 h-13 rounded-2xl object-cover border-2 border-gray-100 shadow-xs shrink-0" />
                              ) : (
                                <div className="w-13 h-13 rounded-2xl bg-amber-100 border border-amber-300 text-amber-900 font-black text-lg flex items-center justify-center shrink-0 shadow-2xs">
                                  {m.nome.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <h3 className="font-extrabold text-black text-base sm:text-lg leading-tight truncate">{m.nome}</h3>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-full border border-gray-200 truncate max-w-[200px]">
                                    {m.cargo}
                                  </span>
                                  {m.matricula && (
                                    <span className="text-xs font-semibold text-gray-500">
                                      Matrícula: <b>{m.matricula}</b>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <span className={`text-[11px] font-black uppercase px-2.5 py-1 rounded-full shrink-0 ${
                              temVinculo
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {temVinculo ? `${equipsIdsVinculados.length} vinculado(s)` : 'Sem crachá'}
                            </span>
                          </div>

                          {/* Equipamentos vinculados */}
                          <div className="mt-4 pt-3.5 border-t border-gray-100">
                            <span className="text-[11px] font-black uppercase tracking-wider text-gray-500 block mb-2">
                              Equipamentos Pesados Vinculados
                            </span>
                            {equipsIdsVinculados.length === 0 ? (
                              <div className="p-3 rounded-2xl bg-gray-50 border border-dashed border-gray-200 text-xs font-semibold text-gray-500 italic">
                                Nenhum equipamento pesado vinculado a este motorista.
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {equipsIdsVinculados.map((eqId) => {
                                  const eq = mapaEquipamentos.get(eqId)
                                  const emOp = eq?.status === 'Em operação'
                                  return (
                                    <div key={eqId} className="inline-flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-2xl py-1.5 px-3 shadow-2xs text-xs font-bold text-black transition group">
                                      <span className={`w-2 h-2 rounded-full shrink-0 ${emOp ? 'bg-emerald-500' : 'bg-amber-500'}`} title={eq?.status || ''} />
                                      <div className="flex flex-col">
                                        <span className="font-extrabold text-black leading-tight">{eq?.name || 'Equipamento'}</span>
                                        <span className="text-[10px] text-gray-500 font-normal leading-tight">{eq?.plate_tag || 'S/P'} • {eq?.type || 'Pesado'}</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleDesvincularEquipamento(m.id, eqId, m.nome)}
                                        title={`Desvincular ${eq?.name || 'equipamento'}`}
                                        className="w-4 h-4 rounded-full bg-gray-200 hover:bg-red-500 hover:text-white text-gray-600 flex items-center justify-center transition cursor-pointer ml-1"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Ação */}
                        <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-500">
                            {temVinculo ? 'Pode vincular mais equipamentos' : 'Clique para atribuir os equipamentos'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAbrirModal(m)}
                            className="bg-amber-400 hover:bg-amber-500 text-black font-extrabold text-xs sm:text-sm rounded-xl py-2 px-3.5 shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            {temVinculo ? 'Gerenciar Equipamentos' : 'Vincular Equipamento'}
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </>
        )}

        {/* ── ABA: POR EQUIPAMENTO ── */}
        {aba === 'equipamentos' && (
          <>
            {/* Filtro por equipamento */}
            <div className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-5 shadow-xs">
              <div className="relative max-w-md">
                <input
                  type="text"
                  value={buscaEquip}
                  onChange={(e) => setBuscaEquip(e.target.value)}
                  placeholder="Buscar equipamento por nome, placa ou tipo..."
                  className="w-full border-2 border-gray-200 rounded-2xl px-4 py-2.5 pl-10 text-sm font-bold text-black placeholder-gray-400 outline-none focus:border-amber-400 transition"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                {buscaEquip && (
                  <button type="button" onClick={() => setBuscaEquip('')} className="absolute right-3 top-3 text-gray-400 hover:text-black">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-xs font-semibold text-gray-500 mt-2">
                Exibindo <b>{equipamentosFiltrados.length}</b> de <b>{equipamentosPesados.length}</b> equipamentos pesados
              </p>
            </div>

            {/* Skeleton */}
            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs animate-pulse space-y-4">
                    <div className="h-5 bg-gray-200 rounded-md w-2/3" />
                    <div className="h-4 bg-gray-100 rounded-md w-1/3" />
                    <div className="space-y-2">
                      <div className="h-10 bg-gray-100 rounded-2xl" />
                      <div className="h-10 bg-gray-100 rounded-2xl" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Grid por equipamento */}
            {!loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {equipamentosFiltrados.length === 0 ? (
                  <div className="col-span-full bg-white border border-gray-200 rounded-3xl p-12 text-center shadow-xs">
                    <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-gray-800">Nenhum equipamento pesado encontrado</h3>
                    <p className="text-sm text-gray-500 mt-1">Verifique os filtros ou o cadastro de equipamentos.</p>
                  </div>
                ) : (
                  equipamentosFiltrados.map((eq) => {
                    const motoristaIds = vinculosInvertido[eq.id] || []
                    const emOp = eq.status === 'Em operação'

                    return (
                      <div
                        key={eq.id}
                        className="bg-white border border-gray-200 hover:border-blue-400 rounded-3xl p-5 sm:p-6 shadow-xs transition-all duration-200 flex flex-col justify-between"
                      >
                        <div>
                          {/* Header do equipamento */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                                <Truck className="w-6 h-6 text-blue-600" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-extrabold text-black text-base sm:text-lg leading-tight truncate">{eq.name}</h3>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-full border border-gray-200">
                                    {eq.plate_tag || 'Sem Placa'}
                                  </span>
                                  <span className="text-xs font-semibold text-gray-500">
                                    {eq.type} • {eq.category}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                                emOp ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {eq.status}
                              </span>
                              <span className={`text-[11px] font-black uppercase px-2.5 py-1 rounded-full ${
                                motoristaIds.length > 0
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : 'bg-gray-100 text-gray-600 border border-gray-200'
                              }`}>
                                {motoristaIds.length > 0 ? `${motoristaIds.length} colaborador(es)` : 'Sem operador'}
                              </span>
                            </div>
                          </div>

                          {/* Colaboradores vinculados */}
                          <div className="mt-4 pt-3.5 border-t border-gray-100">
                            <span className="text-[11px] font-black uppercase tracking-wider text-gray-500 block mb-2 flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5" /> Colaboradores Vinculados
                            </span>
                            {motoristaIds.length === 0 ? (
                              <div className="p-3 rounded-2xl bg-gray-50 border border-dashed border-gray-200 text-xs font-semibold text-gray-500 italic">
                                Nenhum colaborador vinculado a este equipamento.
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                {motoristaIds.map((motId) => {
                                  const mot = mapaMotoristas.get(motId)
                                  if (!mot) return null
                                  return (
                                    <div key={motId} className="flex items-center justify-between gap-2 bg-blue-50/60 border border-blue-100 rounded-2xl py-2 px-3">
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        {mot.foto_url ? (
                                          <img src={mot.foto_url} alt={mot.nome} className="w-8 h-8 rounded-xl object-cover border border-blue-200 shrink-0" />
                                        ) : (
                                          <div className="w-8 h-8 rounded-xl bg-blue-100 border border-blue-200 text-blue-800 font-black text-xs flex items-center justify-center shrink-0">
                                            {mot.nome.slice(0, 2).toUpperCase()}
                                          </div>
                                        )}
                                        <div className="min-w-0">
                                          <div className="font-extrabold text-sm text-black truncate">{mot.nome}</div>
                                          <div className="text-[10px] text-gray-500 font-semibold">
                                            {mot.cargo}{mot.matricula ? ` • ${mot.matricula}` : ''}
                                          </div>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleDesvincularEquipamento(motId, eq.id, mot.nome)}
                                        title={`Desvincular ${mot.nome}`}
                                        className="w-7 h-7 rounded-xl bg-white hover:bg-red-500 hover:text-white text-gray-500 border border-gray-200 flex items-center justify-center transition cursor-pointer shrink-0"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de Vinculação */}
      {modalMotorista && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-gray-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/70">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-xl bg-amber-400 text-black"><Truck className="w-5 h-5" /></span>
                <div>
                  <h3 className="font-extrabold text-lg text-black leading-tight">Vincular Equipamentos</h3>
                  <p className="text-xs font-semibold text-gray-600 mt-0.5">
                    Motorista: <b>{modalMotorista.nome}</b> ({modalMotorista.cargo})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalMotorista(null)}
                className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Search */}
            <div className="p-4 border-b border-gray-100 bg-white">
              <div className="relative">
                <input
                  type="text"
                  value={buscaEquipModal}
                  onChange={(e) => setBuscaEquipModal(e.target.value)}
                  placeholder="Pesquisar por nome, placa ou tipo de equipamento..."
                  className="w-full border-2 border-gray-200 rounded-2xl px-4 py-2 pl-10 text-xs sm:text-sm font-bold text-black placeholder-gray-400 outline-none focus:border-amber-400"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-gray-500 mt-2 px-1">
                <span>{selecionadosModal.length} equipamento(s) selecionado(s)</span>
                {selecionadosModal.length > 0 && (
                  <button type="button" onClick={() => setSelecionadosModal([])} className="text-red-600 hover:underline font-bold">
                    Limpar seleção
                  </button>
                )}
              </div>
            </div>

            {/* Modal Equipment List */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1 divide-y divide-gray-100">
              {equipamentosPesados
                .filter((eq) => {
                  const q = buscaEquipModal.toLowerCase().trim()
                  if (!q) return true
                  return (
                    eq.name.toLowerCase().includes(q) ||
                    (eq.plate_tag && eq.plate_tag.toLowerCase().includes(q)) ||
                    (eq.type && eq.type.toLowerCase().includes(q))
                  )
                })
                .map((eq) => {
                  const selecionado = selecionadosModal.includes(eq.id)
                  const emOp = eq.status === 'Em operação'
                  // Outros motoristas vinculados a este equipamento (exceto o atual)
                  const outrosVinculados = (vinculosInvertido[eq.id] || []).filter((id) => id !== modalMotorista.id)

                  return (
                    <label
                      key={eq.id}
                      onClick={() => toggleEquipamentoModal(eq.id)}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                        selecionado ? 'bg-amber-50/80 border-amber-400 shadow-2xs' : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition ${
                          selecionado ? 'bg-amber-500 border-amber-500 text-black' : 'border-gray-300 bg-white'
                        }`}>
                          {selecionado && <Check className="w-4 h-4 stroke-[3]" />}
                        </div>
                        <div>
                          <div className="font-extrabold text-sm text-black flex items-center gap-2">
                            <span>{eq.name}</span>
                            <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                              {eq.plate_tag || 'Sem Placa'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 font-semibold block mt-0.5">{eq.type} • {eq.category}</span>
                          {outrosVinculados.length > 0 && (
                            <span className="text-[10px] text-blue-600 font-bold block mt-0.5">
                              + {outrosVinculados.length} outro(s) colaborador(es) vinculado(s)
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        emOp ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {eq.status}
                      </span>
                    </label>
                  )
                })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50/70 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalMotorista(null)}
                className="px-4 py-2.5 rounded-xl text-gray-700 font-bold text-xs sm:text-sm hover:bg-gray-200 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarModal}
                disabled={saving}
                className="bg-amber-400 hover:bg-amber-500 text-black font-extrabold text-xs sm:text-sm rounded-xl py-2.5 px-5 shadow-xs flex items-center gap-2 transition cursor-pointer disabled:opacity-60"
              >
                <Check className="w-4 h-4" />
                {saving ? 'Salvando…' : 'Confirmar e Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
