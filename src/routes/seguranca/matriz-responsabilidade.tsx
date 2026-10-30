import React, { useState, useEffect, useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { supabase } from '../../lib/supabase'
import {
  CARGOS_MATRIZ,
  FORMS_URL_MATRIZ,
  type CargoMatrizDef,
  type AtividadeMatriz,
  type ColaboradorMatrizRH,
  type MatrizDbRecord,
  getMesKey,
  getMesLabel,
  getMetricasCargo,
  getMetricasGerais,
  carregarDadosMatriz,
  salvarDadosMatriz,
  ehPersonalizada,
} from '../../lib/matrizResponsabilidadesData'
import { verificarEEnviarLembreteMatrizMes } from '../../lib/matrizWhatsapp'
import { ArrowLeft, ExternalLink, Printer, Copy, Plus, Trash2, Check, Search, ShieldCheck } from 'lucide-react'

export const Route = createFileRoute('/seguranca/matriz-responsabilidade')({
  component: MatrizResponsabilidadeComponent,
})

function normalizarCargoParaMatriz(cargoColab: string): string | null {
  const c = (cargoColab || '').toLowerCase().trim()
  if (c.includes('preposto')) return 'Preposto'
  if (c.includes('encarregado geral')) return 'Encarregado Geral'
  if (c.includes('encarregado i') || c.includes('encarregado 1') || c === 'encarregado') return 'Encarregado I'
  if (c.includes('encarregado ii') || c.includes('encarregado 2')) return 'Encarregado II'
  if (c.includes('tec') && c.includes('seg') && (c.includes('ii') || c.includes('2'))) return 'Téc. Segurança II'
  if (c.includes('tec') && c.includes('seg')) return 'Téc. Segurança I'
  return null
}

export function MatrizResponsabilidadeComponent() {
  const [mesAtualKey] = useState<string>(() => getMesKey())
  const [atividadesPorCargo, setAtividadesPorCargo] = useState<Record<string, AtividadeMatriz[]>>({})
  const [colaboradoresRH, setColaboradoresRH] = useState<ColaboradorMatrizRH[]>([])
  const [customColaboradores, setCustomColaboradores] = useState<ColaboradorMatrizRH[]>([])
  const [selectedCargoId, setSelectedCargoId] = useState<string | null>(null)
  const [salvoFlash, setSalvoFlash] = useState<string>('')
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // RH section filters
  const [buscaRH, setBuscaRH] = useState<string>('')
  const [filtroCargo, setFiltroCargo] = useState<string>('')
  const [rhFeedback, setRhFeedback] = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null)

  // Adicionar colaborador form
  const [novoNome, setNovoNome] = useState<string>('')
  const [novoCargo, setNovoCargo] = useState<string>('')
  const [addFeedback, setAddFeedback] = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null)

  const env = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'

  // Exibir toast temporário
  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev))
    }, 2800)
  }

  // 1. Carregar dados da Matriz e Colaboradores do RH
  useEffect(() => {
    let mounted = true

    async function carregarTudo() {
      // Carregar matriz
      const matrizDb = await carregarDadosMatriz(mesAtualKey, env)
      if (mounted) {
        setAtividadesPorCargo(matrizDb.atividadesPorCargo)
        if (matrizDb.customColaboradores) {
          setCustomColaboradores(matrizDb.customColaboradores)
        }
      }

      // Carregar colaboradores do RH
      try {
        const { data: rhData } = await supabase
          .from('rh_efetivo')
          .select('id, nome, cargo, status')
          .order('nome', { ascending: true })

        if (mounted && rhData) {
          const list: ColaboradorMatrizRH[] = []
          for (const item of rhData) {
            const statusUpper = (item.status || '').toUpperCase().trim()
            if (statusUpper === 'INATIVO' || statusUpper === 'DEMITIDO' || statusUpper === 'DESLIGADO') continue
            if (!item.nome || !item.cargo) continue

            const cargoMatriz = normalizarCargoParaMatriz(item.cargo)
            if (cargoMatriz) {
              list.push({
                id: item.id || `rh_${Math.random()}`,
                nome: item.nome.trim(),
                cargo: cargoMatriz,
                status: 'ATIVO — Efetivado',
              })
            }
          }
          setColaboradoresRH(list)
        }
      } catch (err) {
        console.warn('[Matriz] Erro ao carregar RH:', err)
      }

      // Verificar lembrete do WhatsApp em segundo plano
      verificarEEnviarLembreteMatrizMes(false).catch(() => {})
    }

    carregarTudo()

    return () => {
      mounted = false
    }
  }, [mesAtualKey, env])

  // Colaboradores combinados (RH real + Cadastrados na tela)
  const todosColaboradores = useMemo(() => {
    const combinados = [...colaboradoresRH]
    const ids = new Set(colaboradoresRH.map((c) => c.id))
    for (const custom of customColaboradores) {
      if (!ids.has(custom.id)) {
        combinados.push(custom)
      }
    }
    return combinados
  }, [colaboradoresRH, customColaboradores])

  // Nomes de colaboradores por cargo
  const nomesPorCargo = useMemo(() => {
    const mapa: Record<string, string[]> = {}
    for (const cargo of CARGOS_MATRIZ) {
      mapa[cargo.nome] = todosColaboradores
        .filter((c) => c.cargo === cargo.nome)
        .map((c) => c.nome)
    }
    return mapa
  }, [todosColaboradores])

  // Filtro de colaboradores visíveis na tabela RH
  const colaboradoresVisiveis = useMemo(() => {
    const q = buscaRH.trim().toLowerCase()
    return todosColaboradores.filter((c) => {
      const matchCargo = !filtroCargo || c.cargo === filtroCargo
      const matchNome = !q || c.nome.toLowerCase().includes(q)
      return matchCargo && matchNome
    })
  }, [todosColaboradores, buscaRH, filtroCargo])

  // Salvar estado atual no banco e localmente
  const persistirMatriz = async (
    novoAtiv: Record<string, AtividadeMatriz[]>,
    novoCustomColabs?: ColaboradorMatrizRH[],
    msgToast?: string | null
  ) => {
    setAtividadesPorCargo(novoAtiv)
    if (novoCustomColabs) {
      setCustomColaboradores(novoCustomColabs)
    }

    const payload: MatrizDbRecord = {
      atividadesPorCargo: novoAtiv,
      customColaboradores: novoCustomColabs || customColaboradores,
    }

    await salvarDadosMatriz(payload, mesAtualKey, env)
    setSalvoFlash(`✓ Salvo automaticamente — ${new Date().toLocaleTimeString('pt-BR')}`)

    if (msgToast) {
      showToast(msgToast)
    }
  }

  // Marcar bolinha (0 a 3)
  const handleMarcarBolinha = (cargoId: string, ativIndex: number, dotIndex: number) => {
    const lista = [...(atividadesPorCargo[cargoId] || [])]
    const ativ = { ...lista[ativIndex] }
    if (!ativ) return

    const alvo = dotIndex + 1
    // Se clicar na bolinha já marcada, desmarca uma (ex: clicar na 3 quando está 3 vai para 2)
    ativ.marks = ativ.marks === alvo ? dotIndex : alvo
    ativ.marks = Math.max(0, Math.min(3, ativ.marks))
    lista[ativIndex] = ativ

    const novoMap = {
      ...atividadesPorCargo,
      [cargoId]: lista,
    }

    const concluida = ativ.marks >= 3
    const toastAlerta = concluida ? `✅ Atividade concluída (3/3): ${ativ.nome}` : null
    persistirMatriz(novoMap, undefined, toastAlerta)
  }

  // Adicionar nova atividade personalizada ao cargo
  const handleAdicionarAtividade = (cargoId: string) => {
    const nome = window.prompt('Nome da nova atividade:')
    if (nome === null) return
    const trimmed = nome.trim()
    if (!trimmed) {
      showToast('⚠️ Escreva o nome da atividade para adicionar')
      return
    }

    const lista = [...(atividadesPorCargo[cargoId] || [])]
    lista.push({
      nome: trimmed,
      marks: 0,
      pers: true,
    })

    const novoMap = {
      ...atividadesPorCargo,
      [cargoId]: lista,
    }

    persistirMatriz(novoMap, undefined, `➕ Atividade adicionada: ${trimmed} (0/3)`)
  }

  // Excluir atividade
  const handleRemoverAtividade = (cargoId: string, ativIndex: number) => {
    const lista = [...(atividadesPorCargo[cargoId] || [])]
    const ativ = lista[ativIndex]
    if (!ativ) return

    if (!window.confirm(`Deseja realmente remover a atividade "${ativ.nome}"?`)) {
      return
    }

    lista.splice(ativIndex, 1)
    const novoMap = {
      ...atividadesPorCargo,
      [cargoId]: lista,
    }

    persistirMatriz(novoMap, undefined, `🗑 Atividade excluída: ${ativ.nome}`)
  }

  // Cadastrar colaborador
  const handleCadastrarColaborador = () => {
    setAddFeedback(null)
    const nome = novoNome.trim()
    const cargo = novoCargo.trim()

    if (!nome) {
      setAddFeedback({
        msg: '⚠️ NÃO ADICIONOU — preencha o NOME COMPLETO do colaborador.',
        tipo: 'erro',
      })
      return
    }

    if (!cargo) {
      setAddFeedback({
        msg: '⚠️ NÃO ADICIONOU — selecione o CARGO. Só são aceitos os 6 cargos da matriz.',
        tipo: 'erro',
      })
      return
    }

    const ehCargoValido = CARGOS_MATRIZ.some((c) => c.nome === cargo)
    if (!ehCargoValido) {
      setAddFeedback({
        msg: '⚠️ Cargo fora da matriz — só entram os 6 cargos.',
        tipo: 'erro',
      })
      return
    }

    const novoColab: ColaboradorMatrizRH = {
      id: `custom_${Date.now()}`,
      nome,
      cargo,
      status: 'ATIVO — Efetivado',
    }

    const novaLista = [...customColaboradores, novoColab]
    persistirMatriz(atividadesPorCargo, novaLista)

    setNovoNome('')
    setNovoCargo('')
    setAddFeedback({
      msg: `✅ Colaborador adicionado: ${nome} — ${cargo}.\nEle já aparece na lista, no cartão do cargo e no preenchimento.`,
      tipo: 'ok',
    })
  }

  // Buscar do RH feedback
  const handleAcaoBuscarRH = () => {
    if (colaboradoresRH.length === 0) {
      setRhFeedback({
        msg: `ℹ️ BUSCA NO RH FEITA — nenhum colaborador dos 6 cargos foi encontrado diretamente com status ATIVO.\nNo sistema real, esta busca traz somente os colaboradores efetivados cujo cargo é Preposto, Encarregado Geral, Encarregado I, Encarregado II, Téc. Segurança I ou Téc. Segurança II — nenhum outro cargo.\nVocê pode cadastrar no formulário logo abaixo.`,
        tipo: 'erro',
      })
    } else {
      setRhFeedback({
        msg: `✅ Busca feita: ${colaboradoresRH.length} colaborador(es) encontrado(s) no RH, somente dos 6 cargos da matriz.`,
        tipo: 'ok',
      })
    }
  }

  // Métricas gerais do relatório
  const totais = useMemo(() => {
    return getMetricasGerais(atividadesPorCargo)
  }, [atividadesPorCargo])

  // Cargo selecionado atual
  const cargoAtivo = useMemo(() => {
    if (!selectedCargoId) return null
    return CARGOS_MATRIZ.find((c) => c.id === selectedCargoId) || null
  }, [selectedCargoId])

  const atividadesCargoAtivo = useMemo(() => {
    if (!cargoAtivo) return []
    return atividadesPorCargo[cargoAtivo.id] || []
  }, [cargoAtivo, atividadesPorCargo])

  const metricasCargoAtivo = useMemo(() => {
    if (!cargoAtivo) return null
    return getMetricasCargo(cargoAtivo, atividadesCargoAtivo)
  }, [cargoAtivo, atividadesCargoAtivo])

  // Gerar texto do relatório
  const gerarTextoRelatorio = (): string => {
    let s = `RELATÓRIO AUTOMÁTICO — MATRIZ DE RESPONSABILIDADES (${getMesLabel()})\n`
    s += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n`
    s += `Progresso geral: ${totais.pctGeral}% — ${totais.marcTotal} de ${totais.marcMax} marcações • ${totais.feitasTotal} de ${totais.ativTotal} atividades concluídas (3/3)\n\n`

    for (const c of CARGOS_MATRIZ) {
      const ativs = atividadesPorCargo[c.id] || []
      const m = getMetricasCargo(c, ativs)
      const nomes = nomesPorCargo[c.nome] || []
      s += `${c.nome}: ${m.marcacoesFeitas}/${m.totalMarcacoesPossiveis} marcações — ${m.concluidas}/${m.totalAtividades} atividades (${m.porcentagem}%)\n`
      if (nomes.length > 0) {
        s += `  Colaborador(es): ${nomes.join(', ')}\n`
      }
      for (const a of ativs) {
        s += `  [${a.marks || 0}/3] ${a.nome}${a.pers ? ' (personalizada)' : ''}${a.marks >= 3 ? ' — ✅ CONCLUÍDA' : ''}\n`
      }
      s += '\n'
    }
    return s
  }

  // Copiar relatório
  const handleCopiarRelatorio = () => {
    const texto = gerarTextoRelatorio()
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(() => {
        showToast('📋 Relatório copiado para a área de transferência!')
      })
    } else {
      window.prompt('Copie o relatório:', texto)
    }
  }

  // Imprimir relatório
  const handleImprimirRelatorio = () => {
    const w = window.open('', '_blank')
    if (!w) {
      showToast('Permita pop-ups para imprimir ou use Copiar relatório')
      return
    }

    let conteudoHtml = ''
    for (const c of CARGOS_MATRIZ) {
      const ativs = atividadesPorCargo[c.id] || []
      const m = getMetricasCargo(c, ativs)
      const nomes = nomesPorCargo[c.nome] || []
      conteudoHtml += `
        <div style="border-top:1px solid #ccc; padding:12px 0; line-height:1.6">
          <b style="font-size:16px">${c.nome}</b> — ${m.marcacoesFeitas} de ${m.totalMarcacoesPossiveis} marcações • ${m.concluidas} de ${m.totalAtividades} atividades concluídas (3/3) — <b>${m.porcentagem}%</b><br>
          ${nomes.length ? `Colaborador(es): <b>${nomes.join(', ')}</b><br>` : ''}
          ${ativs
            .map((a) => {
              const bol = '●'.repeat(a.marks || 0) + '○'.repeat(Math.max(0, 3 - (a.marks || 0)))
              return `${bol} ${a.marks || 0}/3 — ${a.nome}${a.pers ? ' (personalizada)' : ''}${a.marks >= 3 ? ' — <b>✅ CONCLUÍDA</b>' : ' — ⏳ pendente'}`
            })
            .join('<br>')}
        </div>
      `
    }

    w.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Relatório — Matriz de Responsabilidades</title>
        <style>
          body { font-family: Arial, sans-serif; color: #000; padding: 24px; }
          h1 { margin-bottom: 4px; }
          p { color: #555; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <h1>Relatório — Matriz de Responsabilidades — ${getMesLabel()}</h1>
        <p>Hydro Reabilitação • Gerado em ${new Date().toLocaleString('pt-BR')}</p>
        <div>${conteudoHtml}</div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `)
    w.document.close()
  }

  return (
    <div className="min-h-screen bg-white text-[#111827] font-sans pb-24 px-4 sm:px-6 lg:px-8">
      {/* Toast flutuante */}
      {toastMsg && (
        <div className="fixed left-1/2 bottom-8 -translate-x-1/2 bg-[#111] text-white px-5 py-3 rounded-full text-sm font-bold shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {toastMsg}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="py-4 text-[13px] font-semibold text-gray-700 flex items-center gap-1.5">
        <Link to="/seguranca" className="hover:text-black hover:underline">
          Segurança
        </Link>
        <span>›</span>
        <span className="text-black font-black">Matriz de Responsabilidades</span>
      </div>

      {/* ============================================================== */}
      {/* VISTA DETALHE DO CARGO (ao clicar em um card)                  */}
      {/* ============================================================== */}
      {selectedCargoId && cargoAtivo && metricasCargoAtivo ? (
        <section className="animate-in fade-in duration-300 max-w-5xl mx-auto py-2">
          <button
            type="button"
            onClick={() => {
              setSelectedCargoId(null)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="inline-flex items-center gap-2 bg-white border border-gray-400 text-black hover:border-black font-black text-sm rounded-xl px-4 py-2 transition shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>

          {/* Cabeçalho do Detalhe */}
          <div className="flex flex-wrap items-center gap-4 mt-4 justify-between">
            <div className="flex items-center gap-3.5">
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gray-50 border border-gray-300 flex items-center justify-center text-3xl sm:text-4xl shadow-inner shrink-0"
              >
                {cargoAtivo.icone}
              </div>
              <div>
                <h2
                  className="font-bold text-black text-2xl sm:text-4xl tracking-tight leading-tight"
                  style={{ fontFamily: 'Georgia, Times New Roman, serif' }}
                >
                  {cargoAtivo.nome}
                </h2>
                <div className="text-sm sm:text-base font-bold text-gray-900 mt-1">
                  {metricasCargoAtivo.concluidas}/{atividadesCargoAtivo.length} atividades concluídas •{' '}
                  {metricasCargoAtivo.marcacoesFeitas}/{metricasCargoAtivo.totalMarcacoesPossiveis} marcações
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <a
                href={FORMS_URL_MATRIZ}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-extrabold text-sm sm:text-base rounded-2xl px-5 py-3.5 shadow-md flex items-center gap-2 transition"
              >
                📋 Preencher Forms ↗
              </a>
              <span className="bg-[#111] text-white font-black text-lg sm:text-xl rounded-full px-5 py-2.5 min-w-[70px] text-center shadow-xs">
                {metricasCargoAtivo.porcentagem}%
              </span>
            </div>
          </div>

          {/* Barra de Progresso do Detalhe */}
          <div className="h-3.5 bg-gray-200 rounded-full overflow-hidden my-5">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${metricasCargoAtivo.porcentagem}%`,
                background: cargoAtivo.cor,
              }}
            />
          </div>

          {/* Card com as Atividades */}
          <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden mb-6">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 border-b border-gray-200 bg-gray-50/50">
              <h3
                className="text-xl sm:text-2xl font-bold text-black"
                style={{ fontFamily: 'Georgia, Times New Roman, serif' }}
              >
                Atividades
              </h3>
              <button
                type="button"
                onClick={() => handleAdicionarAtividade(cargoAtivo.id)}
                className="bg-[#16a34a] hover:bg-[#15803d] text-white font-black text-sm rounded-xl px-4 py-2 flex items-center gap-1.5 transition shadow-xs"
              >
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </div>

            <div className="divide-y divide-gray-200">
              {atividadesCargoAtivo.length === 0 ? (
                <div className="p-6 text-center text-gray-500 font-bold">
                  Nenhuma atividade neste cargo. Clique em + Adicionar para criar uma.
                </div>
              ) : (
                atividadesCargoAtivo.map((ativ, idx) => {
                  const marks = ativ.marks || 0
                  const isConcluida = marks >= 3

                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3.5 sm:py-4 transition-colors ${
                        isConcluida ? 'bg-green-50/60' : 'bg-white hover:bg-gray-50/70'
                      }`}
                    >
                      {/* 3 Bolinhas Interativas */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {[0, 1, 2].map((k) => {
                          const isDotOn = k < marks
                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() => handleMarcarBolinha(cargoAtivo.id, idx, k)}
                              title={`Marcação ${k + 1} de 3`}
                              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-[2.5px] font-black text-xs sm:text-sm flex items-center justify-center transition-all ${
                                isDotOn
                                  ? 'bg-[#16a34a] border-[#16a34a] text-white shadow-xs'
                                  : 'bg-white border-gray-500 text-transparent hover:border-[#16a34a] hover:scale-105'
                              }`}
                            >
                              {isDotOn ? '✓' : ''}
                            </button>
                          )
                        })}
                      </div>

                      {/* Informações da Atividade */}
                      <div className="flex-1 min-w-0">
                        <div className="text-black font-extrabold text-sm sm:text-base leading-snug flex items-center flex-wrap gap-2">
                          <span>{ativ.nome}</span>
                          {ativ.pers && (
                            <span className="inline-block bg-[#ede9fe] text-[#6d28d9] border border-[#c4b5fd] font-extrabold text-[10px] rounded-full px-2 py-0.5 lowercase">
                              personalizada
                            </span>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-gray-800 mt-1">
                          {marks}/3 marcações
                          {marks >= 3 ? (
                            <span className="text-[#15803d] font-black ml-1.5">
                              — ✅ CONCLUÍDA
                            </span>
                          ) : marks > 0 ? (
                            <span className="text-gray-900 font-semibold ml-1.5">
                              — ⏳ em andamento, faltam {3 - marks}
                            </span>
                          ) : (
                            <span className="text-gray-600 font-semibold ml-1.5">
                              — ⏳ pendente
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Botão de Excluir */}
                      <button
                        type="button"
                        onClick={() => handleRemoverAtividade(cargoAtivo.id, idx)}
                        title="Excluir esta atividade"
                        className="w-9 h-9 rounded-full border border-red-300 bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center shrink-0 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Flash de Salvo Automático */}
          <div className="text-[#15803d] font-black text-sm min-h-[22px] px-1">
            {salvoFlash}
          </div>

          {/* Aviso Automático */}
          <div className="flex items-center gap-3 bg-[#f0fdf4] border border-[#86efac] rounded-2xl p-4 mt-2 text-[#14532d] font-bold text-sm sm:text-base leading-relaxed">
            <span className="text-xl">💾</span>
            <span>
              Suas marcações são salvas automaticamente no banco de dados. O progresso fica
              registrado até o fim do mês.
            </span>
          </div>

          <p className="text-xs sm:text-sm text-gray-900 font-bold mt-4 leading-relaxed">
            Como concluir: cada atividade tem <b>3 bolinhas</b> — clique para marcar 1/3, 2/3 e 3/3.
            Só com <b>3/3</b> a atividade fica concluída. Clique de novo na última bolinha marcada
            para desmarcar uma. O progresso do cargo é calculado sobre o total de marcações
            (atividades × 3).
          </p>
        </section>
      ) : (
        /* ============================================================== */
        /* VISTA PRINCIPAL — GRADE DE CARGOS, RH E RELATÓRIO MENSAL       */
        /* ============================================================== */
        <div className="animate-in fade-in duration-300 max-w-7xl mx-auto">
          {/* Cabeçalho da Matriz */}
          <div className="flex flex-wrap items-start justify-between gap-4 mt-2">
            <div>
              <h1
                className="font-bold italic text-black text-3xl sm:text-5xl tracking-tight leading-tight"
                style={{ fontFamily: 'Georgia, Times New Roman, serif' }}
              >
                Matriz de Responsabilidades
              </h1>
              <p className="text-gray-900 font-bold mt-2 text-base sm:text-lg">
                Selecione uma função para visualizar o progresso.
              </p>
              <p className="text-amber-800 font-bold italic text-sm sm:text-base mt-1">
                * Progresso zerado no dia 01 de cada mês.
              </p>
              <div className="inline-flex items-center bg-[#111] text-[#f5c518] font-black text-xs uppercase tracking-wider rounded-full px-3.5 py-1.5 mt-3 shadow-xs">
                📅 Mês atual: {getMesLabel()} — progresso deste mês
              </div>
            </div>

            <a
              href={FORMS_URL_MATRIZ}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-extrabold text-base rounded-2xl px-6 py-4 shadow-lg inline-flex items-center gap-2.5 transition shrink-0"
            >
              📋 Preencher Forms ↗
            </a>
          </div>

          {/* Grade dos 6 Cargos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
            {CARGOS_MATRIZ.map((c) => {
              const ativs = atividadesPorCargo[c.id] || []
              const m = getMetricasCargo(c, ativs)
              const nomes = nomesPorCargo[c.nome] || []

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedCargoId(c.id)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="bg-white rounded-3xl p-6 text-left relative shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border-[2.5px] group cursor-pointer"
                  style={{ borderColor: c.cor }}
                >
                  <span className="absolute top-4 right-4 bg-[#7c3aed] text-white font-black text-xs rounded-full px-3 py-1 shadow-xs">
                    Seu cargo
                  </span>

                  <div className="w-16 h-16 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-3xl shadow-inner mb-4">
                    {c.icone}
                  </div>

                  <h3
                    className="text-2xl font-bold text-black"
                    style={{ fontFamily: 'Georgia, Times New Roman, serif' }}
                  >
                    {c.nome}
                  </h3>

                  <div className="text-gray-900 font-extrabold text-sm mt-2 flex items-center gap-1.5">
                    📁 {m.totalAtividades} atividades
                  </div>

                  <div className="text-gray-700 font-semibold text-xs mt-1.5 line-clamp-2 min-h-[32px]">
                    {nomes.length > 0 ? (
                      <span>👤 {nomes.join(', ')}</span>
                    ) : (
                      <span className="text-gray-400 italic">
                        Nenhum colaborador deste cargo cadastrado ainda
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <span className="text-[11px] font-black uppercase tracking-wider text-black">
                      PROGRESSO
                    </span>
                    <b className="text-base font-black text-black">{m.porcentagem}%</b>
                  </div>

                  <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden mt-1.5">
                    <div
                      className="h-full rounded-full transition-all duration-400"
                      style={{
                        width: `${m.porcentagem}%`,
                        background: c.cor,
                      }}
                    />
                  </div>

                  <div className="text-[11.5px] font-bold text-gray-800 mt-3 pt-2 border-t border-gray-100">
                    {m.marcacoesFeitas} de {m.totalMarcacoesPossiveis} marcações • {m.concluidas} de{' '}
                    {m.totalAtividades} atividade(s) concluída(s) (3/3) —{' '}
                    <span className="underline group-hover:text-black">clique para abrir</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* ============================================================== */}
          {/* SEÇÃO RH: Somente os 6 cargos da matriz                        */}
          {/* ============================================================== */}
          <section className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm mt-8">
            <h2 className="text-xl sm:text-2xl font-black text-black flex items-center gap-2">
              👥 Buscar somente estes cargos — colaboradores para preenchimento
            </h2>
            <p className="text-sm font-semibold text-gray-900 mt-2 leading-relaxed">
              A busca traz <b>somente</b> os colaboradores cujo cargo é um destes 6 da matriz:{' '}
              <b>Preposto, Encarregado Geral, Encarregado I, Encarregado II, Téc. Segurança I e Téc. Segurança II</b>.{' '}
              Colaborador de qualquer outro cargo <b>não entra</b> no preenchimento da matriz.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mt-4 items-end">
              <div className="sm:col-span-6">
                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                  Buscar por nome
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={buscaRH}
                    onChange={(e) => setBuscaRH(e.target.value)}
                    placeholder="Buscar por nome do colaborador..."
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 text-sm font-bold text-black placeholder-gray-500 outline-none focus:border-amber-400"
                  />
                  <Search className="w-4 h-4 text-gray-500 absolute right-3.5 top-3" />
                </div>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                  Filtrar por cargo (só os 6 da matriz)
                </label>
                <select
                  value={filtroCargo}
                  onChange={(e) => setFiltroCargo(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 text-sm font-bold text-black outline-none focus:border-amber-400 bg-white"
                >
                  <option value="">Todos os 6 cargos da matriz</option>
                  {CARGOS_MATRIZ.map((c) => (
                    <option key={c.id} value={c.nome}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={handleAcaoBuscarRH}
                  className="w-full bg-[#111] hover:bg-black text-white font-black text-sm rounded-xl py-3 px-4 shadow-xs transition"
                >
                  🔍 Buscar do RH
                </button>
              </div>
            </div>

            {rhFeedback && (
              <div
                className={`p-4 rounded-xl text-sm font-bold mt-4 whitespace-pre-line border-2 ${
                  rhFeedback.tipo === 'ok'
                    ? 'bg-green-50 text-green-900 border-green-500'
                    : 'bg-red-50 text-red-900 border-red-500'
                }`}
              >
                {rhFeedback.msg}
              </div>
            )}

            {/* Tabela de Colaboradores RH */}
            <div className="overflow-x-auto mt-4 border border-gray-200 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-black bg-gray-50">
                    <th className="py-3 px-4 text-xs font-black uppercase text-black">
                      Colaborador
                    </th>
                    <th className="py-3 px-4 text-xs font-black uppercase text-black">
                      Cargo (matriz)
                    </th>
                    <th className="py-3 px-4 text-xs font-black uppercase text-black">
                      Status RH
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm font-semibold">
                  {colaboradoresVisiveis.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 px-4 text-center text-gray-500 font-bold">
                        {todosColaboradores.length === 0
                          ? 'Nenhum colaborador destes 6 cargos carregado ainda. Clique em "Buscar do RH" ou cadastre abaixo.'
                          : 'Nenhum colaborador encontrado com os filtros atuais.'}
                      </td>
                    </tr>
                  ) : (
                    colaboradoresVisiveis.map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-black font-extrabold">{c.nome}</td>
                        <td className="py-3 px-4 text-black font-bold">{c.cargo}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs font-black px-2.5 py-1 rounded-full uppercase">
                            <Check className="w-3.5 h-3.5" /> ATIVO — Efetivado
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Formulário para Cadastrar Colaborador */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-base sm:text-lg font-black text-black">
                ➕ Cadastrar colaborador (demonstração)
              </h3>
              <p className="text-xs sm:text-sm font-semibold text-gray-700 mt-1">
                No sistema real esta lista vem do RH. Aqui, o campo Cargo <b>só aceita os 6 cargos da matriz</b> — não há nenhum outro cargo para escolher.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mt-3 items-end">
                <div className="sm:col-span-6">
                  <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                    Nome completo *
                  </label>
                  <input
                    type="text"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    placeholder="Nome do colaborador"
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 text-sm font-bold text-black placeholder-gray-500 outline-none focus:border-amber-400"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                    Cargo * (só os 6 da matriz)
                  </label>
                  <select
                    value={novoCargo}
                    onChange={(e) => setNovoCargo(e.target.value)}
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 text-sm font-bold text-black outline-none focus:border-amber-400 bg-white"
                  >
                    <option value="">— Selecione (só os 6 cargos) —</option>
                    {CARGOS_MATRIZ.map((c) => (
                      <option key={c.id} value={c.nome}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleCadastrarColaborador}
                    className="w-full bg-[#f5c518] hover:bg-[#eab308] text-black font-black text-sm rounded-xl py-3 px-4 shadow-xs transition"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {addFeedback && (
                <div
                  className={`p-4 rounded-xl text-sm font-bold mt-4 whitespace-pre-line border-2 ${
                    addFeedback.tipo === 'ok'
                      ? 'bg-green-50 text-green-900 border-green-500'
                      : 'bg-red-50 text-red-900 border-red-500'
                  }`}
                >
                  {addFeedback.msg}
                </div>
              )}
            </div>
          </section>

          {/* ============================================================== */}
          {/* SEÇÃO RELATÓRIO AUTOMÁTICO — MATRIZ DO MÊS                     */}
          {/* ============================================================== */}
          <section className="bg-white border-2 border-black rounded-3xl p-6 sm:p-8 shadow-sm mt-8">
            <h2 className="text-xl sm:text-2xl font-black text-black">
              📊 Relatório Automático — Matriz do mês
            </h2>
            <p className="text-sm font-semibold text-gray-900 mt-1 leading-relaxed">
              Atualizado automaticamente a cada preenchimento salvo. No dia 01 de cada mês o
              progresso começa zerado de novo.
            </p>

            {/* 4 Cards de Estatísticas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
                <b className="text-2xl sm:text-3xl font-black text-black block">
                  {totais.totalCargos}
                </b>
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-gray-800">
                  Cargos da matriz
                </span>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
                <b className="text-2xl sm:text-3xl font-black text-black block">
                  {totais.ativTotal}
                </b>
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-gray-800">
                  Atividades no total
                </span>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
                <b className="text-2xl sm:text-3xl font-black text-black block">
                  {totais.feitasTotal}
                </b>
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-gray-800">
                  Atividades concluídas (3/3)
                </span>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
                <b className="text-2xl sm:text-3xl font-black text-black block">
                  {totais.marcTotal}/{totais.marcMax}
                </b>
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-gray-800">
                  Marcações feitas
                </span>
              </div>
            </div>

            {/* Progresso Geral */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center mt-3">
              <b className="text-3xl font-black text-black block">{totais.pctGeral}%</b>
              <span className="text-xs font-black uppercase tracking-wider text-gray-800">
                Progresso geral — sobre o total de marcações (atividades × 3)
              </span>
            </div>

            <div className="h-3.5 bg-gray-200 rounded-full overflow-hidden my-4">
              <div
                className="h-full bg-[#16a34a] rounded-full transition-all duration-400"
                style={{ width: `${totais.pctGeral}%` }}
              />
            </div>

            {/* Itens do Relatório */}
            <div className="divide-y divide-gray-200 border-t border-gray-200 mt-4">
              {CARGOS_MATRIZ.map((c) => {
                const ativs = atividadesPorCargo[c.id] || []
                const m = getMetricasCargo(c, ativs)
                const nomes = nomesPorCargo[c.nome] || []

                return (
                  <div key={c.id} className="py-3.5 leading-relaxed text-sm">
                    <div className="text-black font-extrabold text-base">
                      {c.nome} —{' '}
                      <span className="font-bold text-gray-800">
                        {m.marcacoesFeitas} de {m.totalMarcacoesPossiveis} marcações • {m.concluidas}{' '}
                        de {m.totalAtividades} atividade(s) concluída(s) (3/3) —{' '}
                      </span>
                      <b>{m.porcentagem}%</b>
                    </div>

                    {nomes.length > 0 && (
                      <div className="text-xs font-bold text-gray-700 mt-0.5">
                        Colaborador(es): <b className="text-black">{nomes.join(', ')}</b>
                      </div>
                    )}

                    <div className="mt-2 space-y-1 pl-2">
                      {ativs.map((a, idx) => {
                        const marks = a.marks || 0
                        const bol = '●'.repeat(marks) + '○'.repeat(Math.max(0, 3 - marks))
                        return (
                          <div key={idx} className="text-xs sm:text-sm font-semibold text-gray-800">
                            <span className="font-mono text-black mr-1">{bol}</span> {marks}/3 —{' '}
                            <span className="text-black font-bold">{a.nome}</span>
                            {a.pers && <span className="text-purple-700 italic"> (personalizada)</span>}
                            {marks >= 3 ? (
                              <span className="text-green-700 font-extrabold ml-1">
                                — ✅ CONCLUÍDA
                              </span>
                            ) : (
                              <span className="text-gray-500 ml-1">— ⏳ pendente</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Ações do Relatório */}
            <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleImprimirRelatorio}
                className="bg-[#111] hover:bg-black text-white font-black text-sm rounded-xl py-3 px-5 shadow-xs flex items-center gap-2 transition"
              >
                <Printer className="w-4 h-4" /> Imprimir / Salvar em PDF
              </button>
              <button
                type="button"
                onClick={handleCopiarRelatorio}
                className="bg-[#f5c518] hover:bg-[#eab308] text-black font-black text-sm rounded-xl py-3 px-5 shadow-xs flex items-center gap-2 transition"
              >
                <Copy className="w-4 h-4" /> Copiar relatório (texto)
              </button>
            </div>
          </section>

          {/* Rodapé informativo */}
          <footer className="text-center text-xs font-semibold text-gray-500 mt-10 leading-relaxed max-w-4xl mx-auto">
            Hydro Reabilitação — Segurança • Matriz de Responsabilidades • O preenchimento fica salvo
            com segurança no banco de dados e separado por mês. No dia 01 de cada mês o progresso
            começa zerado de novo, mantendo o histórico de meses anteriores acessível.
          </footer>
        </div>
      )}
    </div>
  )
}

