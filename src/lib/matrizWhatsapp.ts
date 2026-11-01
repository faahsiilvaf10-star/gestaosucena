import { getWhatsappSettings } from './settings'
import { sendWhatsappTextOnServer } from './whatsapp-api'
import { supabase } from './supabase'
import {
  CARGOS_MATRIZ,
  CargoMatrizDef,
  getMesKey,
  getMesNome,
  carregarDadosMatriz,
  carregarMasterConfigMatriz,
  getMetricasCargo,
} from './matrizResponsabilidadesData'

let isDispatchingLembreteMatriz = false
let isDispatchingFechamentoMatriz = false
let isDispatchingQuintaMatriz = false

/**
 * Normaliza cargo do colaborador para comparar com os cargos padrão da matriz
 */
function normalizarCargoParaMatriz(cargoColab: string): string | null {
  const c = cargoColab.toLowerCase().trim()
  if (c.includes('preposto')) return 'Preposto'
  if (c.includes('encarregado geral')) return 'Encarregado Geral'
  if (c.includes('encarregado i') || c.includes('encarregado 1') || c === 'encarregado') return 'Encarregado I'
  if (c.includes('encarregado ii') || c.includes('encarregado 2')) return 'Encarregado II'
  if (c.includes('tec') && c.includes('seg') && (c.includes('ii') || c.includes('2'))) return 'Téc. Segurança II'
  if (c.includes('tec') && c.includes('seg')) return 'Téc. Segurança I'
  return null
}

/**
 * Busca os colaboradores cadastrados no RH e nas atribuições manuais da matriz para associar aos cargos
 */
async function buscarNomesPorCargo(matrizData?: any, env: string = 'barcarena'): Promise<Record<string, string[]>> {
  const mapa: Record<string, string[]> = {
    'Preposto': [],
    'preposto': [],
    'Encarregado Geral': [],
    'enc-geral': [],
    'Encarregado I': [],
    'enc-1': [],
    'Encarregado II': [],
    'enc-2': [],
    'Téc. Segurança I': [],
    'tec-1': [],
    'Téc. Segurança II': [],
    'tec-2': [],
  }

  // Tenta obter as atribuições manuais do matrizData ou da configuração mestre permanente
  let atribuicoesManual = matrizData?.atribuicoesManual || {}
  const cargosList = matrizData?.cargos && Array.isArray(matrizData.cargos) ? matrizData.cargos : CARGOS_MATRIZ

  for (const c of cargosList) {
    if (!mapa[c.nome]) mapa[c.nome] = []
    if (!mapa[c.id]) mapa[c.id] = []
  }

  if (Object.keys(atribuicoesManual).length === 0) {
    try {
      const master = await carregarMasterConfigMatriz(env)
      if (master?.atribuicoesManual && Object.keys(master.atribuicoesManual).length > 0) {
        atribuicoesManual = master.atribuicoesManual
      }
    } catch (_) {}
  }

  // 1. Mapeamento direto de atribuições manuais salvas por Nome
  if (atribuicoesManual && typeof atribuicoesManual === 'object') {
    for (const [colabNomeOuId, cargoId] of Object.entries(atribuicoesManual)) {
      if (typeof cargoId !== 'string' || !cargoId) continue
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(colabNomeOuId)
      if (!isUuid && colabNomeOuId.trim().length > 2) {
        const nomeTrim = colabNomeOuId.trim()
        if (!mapa[cargoId]) mapa[cargoId] = []
        if (!mapa[cargoId].includes(nomeTrim)) mapa[cargoId].push(nomeTrim)

        const cargoEncontrado = cargosList.find((c: any) => c.id === cargoId)
        if (cargoEncontrado?.nome) {
          if (!mapa[cargoEncontrado.nome]) mapa[cargoEncontrado.nome] = []
          if (!mapa[cargoEncontrado.nome].includes(nomeTrim)) mapa[cargoEncontrado.nome].push(nomeTrim)
        }
      }
    }
  }

  // 2. Busca do RH Efetivo no Supabase para cruzar por ID e por Nome
  try {
    const { data: rhData } = await supabase
      .from('rh_efetivo')
      .select('id, nome, cargo, status')
      .order('nome', { ascending: true })

    if (rhData && Array.isArray(rhData)) {
      for (const e of rhData) {
        const s = (e.status || '').toUpperCase().trim()
        if (s === 'INATIVO' || s === 'DEMITIDO' || s === 'DESLIGADO') continue
        if (!e.nome) continue
        const nomeTrim = e.nome.trim()

        // Verifica se há atribuição manual (por ID ou por Nome case-insensitive)
        let manualCargoId = (e.id && atribuicoesManual[e.id]) || atribuicoesManual[nomeTrim]
        if (!manualCargoId) {
          const keyNome = Object.keys(atribuicoesManual).find(k => k.trim().toLowerCase() === nomeTrim.toLowerCase())
          if (keyNome) manualCargoId = atribuicoesManual[keyNome]
        }

        if (manualCargoId) {
          if (!mapa[manualCargoId]) mapa[manualCargoId] = []
          if (!mapa[manualCargoId].includes(nomeTrim)) mapa[manualCargoId].push(nomeTrim)

          const cargoEncontrado = cargosList.find((c: any) => c.id === manualCargoId)
          if (cargoEncontrado?.nome) {
            if (!mapa[cargoEncontrado.nome]) mapa[cargoEncontrado.nome] = []
            if (!mapa[cargoEncontrado.nome].includes(nomeTrim)) mapa[cargoEncontrado.nome].push(nomeTrim)
          }
          continue // Já atribuído manualmente com prioridade máxima
        }

        // Se não possui atribuição manual, faz fallback pela normalização do cargo original
        if (e.cargo) {
          const normalizado = normalizarCargoParaMatriz(e.cargo)
          if (normalizado && mapa[normalizado]) {
            if (!mapa[normalizado].includes(nomeTrim)) {
              mapa[normalizado].push(nomeTrim)
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Matriz WhatsApp] Erro ao carregar colaboradores do RH:', err)
  }

  return mapa
}

/**
 * Obtém os nomes dos colaboradores vinculados a um cargo
 */
function obterNomesDoCargo(cargo: CargoMatrizDef, mapaNomes: Record<string, string[]>): string {
  const nomes = (mapaNomes[cargo.id] && mapaNomes[cargo.id].length > 0)
    ? mapaNomes[cargo.id]
    : (mapaNomes[cargo.nome] || [])
  return nomes.length > 0 ? nomes.join(', ') : 'Colaborador não atribuído'
}

export async function verificarEEnviarFechamentoMatrizDia1(forcar: boolean = false): Promise<boolean> {
  if (isDispatchingFechamentoMatriz) {
    return false
  }

  const hoje = new Date()
  const diaDoMes = hoje.getDate()

  // Deve disparar no dia 1 do mês (ou forçado manualmente)
  if (diaDoMes !== 1 && !forcar) {
    return false
  }

  // Mês anterior (fechado)
  const dataMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
  const mesAnteriorKey = getMesKey(dataMesAnterior)
  const mesAnteriorNome = getMesNome(dataMesAnterior)
  const mesAtualNome = getMesNome(hoje)
  const ano = dataMesAnterior.getFullYear()

  const env = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
  const syncKey = `matriz_whatsapp_fechamento_dia1_${mesAnteriorKey}_${env}`
  const localLockKey = `matriz_whatsapp_fechamento_dia1_sent_${mesAnteriorKey}_${env}`

  // Trava LocalStorage
  if (!forcar && typeof window !== 'undefined') {
    if (localStorage.getItem(localLockKey)) {
      return false
    }
  }

  isDispatchingFechamentoMatriz = true

  try {
    // Trava Supabase
    if (!forcar) {
      const { data: dbLock } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', syncKey)
        .maybeSingle()

      if (dbLock?.value && (dbLock.value.enviadoEm || dbLock.value.emProcessamento)) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(localLockKey, 'true')
        }
        return false
      }

      try {
        await supabase.from('global_settings').upsert({
          key: syncKey,
          value: { emProcessamento: true, iniciadoEm: new Date().toISOString() },
        })
      } catch (_) {}
    }

    const settings = await getWhatsappSettings()
    if (settings.matrizResponsabilidade?.enabled === false || settings.matrizResponsabilidade?.enabled_dia_1 === false) {
      console.info('[Matriz WhatsApp] Envio de fechamento do dia 1 desativado nas configurações.')
      return false
    }

    const targetGroup = settings.matrizResponsabilidade?.specificGroupId || settings.groupId
    if (!targetGroup || !settings.url || !settings.token) {
      console.warn('[Matriz WhatsApp] WhatsApp não configurado adequadamente (URL/Token/Grupo ausentes).')
      return false
    }

    // Carregar dados da Matriz do mês anterior
    const matrizData = await carregarDadosMatriz(mesAnteriorKey, env)
    const mapaNomes = await buscarNomesPorCargo(matrizData)
    const cargosList: CargoMatrizDef[] = (matrizData.cargos && matrizData.cargos.length > 0)
      ? matrizData.cargos
      : CARGOS_MATRIZ

    const concluidosList: string[] = []
    const pendentesList: string[] = []

    for (const cargo of cargosList) {
      const atividades = matrizData.atividadesPorCargo[cargo.id] || []
      const metricas = getMetricasCargo(cargo, atividades)
      const nomesStr = obterNomesDoCargo(cargo, mapaNomes)

      if (metricas.porcentagem === 100 || metricas.isConcluidoTotal) {
        concluidosList.push(`• *${cargo.nome}* (${nomesStr}) — *100% Concluído* (${metricas.marcacoesFeitas}/${metricas.totalMarcacoesPossiveis} marcas)`)
      } else {
        const ativPendentes = metricas.totalAtividades - metricas.concluidas
        pendentesList.push(`• *${cargo.nome}* (${nomesStr}) — *${metricas.porcentagem}%* (${metricas.concluidas}/${metricas.totalAtividades} ativ. concluídas • faltam ${ativPendentes})`)
      }
    }

    const listaConcluidosFormatada = concluidosList.length > 0
      ? concluidosList.join('\n')
      : '_Nenhum cargo concluiu 100% no mês anterior._'

    const listaPendentesFormatada = pendentesList.length > 0
      ? pendentesList.join('\n')
      : '_Todos os cargos concluíram 100%! Parabéns à equipe!_'

    let msg =
      settings.messageTemplates?.matrizFechamentoMesAnterior ||
      `🏁 *FECHAMENTO DA MATRIZ DE RESPONSABILIDADES ({mes_anterior_nome}/{ano})* 🏁\n\nEncerramos o mês de *{mes_anterior_nome}* e realizamos o fechamento oficial do cumprimento das metas da Matriz de Responsabilidades em Segurança do Trabalho.\n\n📊 *BALANÇO FINAL:*\n• Cargos Concluídos (100%): *{cargos_concluidos}/{total_cargos}*\n• Cargos Pendentes: *{cargos_pendentes}*\n\n🏆 *PARABÉNS AOS CONCLUINTES (100% CUMPRIDO):*\n{lista_concluidos}\n\n👏 _Parabenizamos todos os líderes e colaboradores que atingiram 100% das suas metas no mês de {mes_anterior_nome}, demonstrando responsabilidade, disciplina e compromisso exemplar com a segurança de todos!_\n\n⚠️ *CARGOS COM PENDÊNCIAS:*\n{lista_pendentes}\n\n📢 *ORIENTAÇÃO PARA O MÊS DE {mes_atual_nome}:*\n_Atenção redobrada aos que não concluíram suas atividades no mês anterior. Iniciamos agora um novo mês ({mes_atual_nome})! Contamos com mais dedicação, proatividade e acompanhamento diário das inspeções e evidências para que alcancemos 100% de conformidade neste novo ciclo!_\n\n_Mensagem automática - Sucena / Hydro Reabilitação_`

    msg = msg.replaceAll('{mes_anterior_nome}', mesAnteriorNome)
    msg = msg.replaceAll('{mes_atual_nome}', mesAtualNome)
    msg = msg.replaceAll('{ano}', String(ano))
    msg = msg.replaceAll('{total_cargos}', String(cargosList.length))
    msg = msg.replaceAll('{cargos_concluidos}', String(concluidosList.length))
    msg = msg.replaceAll('{cargos_pendentes}', String(pendentesList.length))
    msg = msg.replaceAll('{lista_concluidos}', listaConcluidosFormatada)
    msg = msg.replaceAll('{lista_pendentes}', listaPendentesFormatada)

    await sendWhatsappTextOnServer({
      data: {
        url: settings.url,
        token: settings.token,
        instanceId: settings.instanceId,
        phone: targetGroup,
        text: msg,
      },
    })

    if (typeof window !== 'undefined') {
      localStorage.setItem(localLockKey, 'true')
    }

    try {
      await supabase.from('global_settings').upsert({
        key: syncKey,
        value: {
          enviadoEm: new Date().toISOString(),
          mesAnteriorKey,
          concluidos: concluidosList.length,
          pendentes: pendentesList.length,
        },
      })
    } catch (_) {}

    try {
      await supabase.from('system_activities').insert({
        module: 'Segurança',
        action: 'Fechamento Matriz WhatsApp Dia 1',
        details: `Fechamento do mês anterior (${mesAnteriorNome}/${ano}) enviado ao WhatsApp da Matriz. Concluídos: ${concluidosList.length}/${cargosList.length}, Pendentes: ${pendentesList.length}.`,
      })
    } catch (_) {}

    console.info(`[Matriz WhatsApp] Fechamento do mês anterior (${mesAnteriorKey}) enviado com sucesso!`)
    return true
  } catch (err) {
    console.warn('[Matriz WhatsApp] Falha ao enviar fechamento do dia 1:', err)
    if (typeof window !== 'undefined') {
      localStorage.removeItem(localLockKey)
    }
    return false
  } finally {
    isDispatchingFechamentoMatriz = false
  }
}

/**
 * 2. ACOMPANHAMENTO SEMANAL (TODA QUINTA-FEIRA)
 * Mostra no grupo quem já concluiu e quem ainda falta concluir a matriz no mês vigente.
 */
export async function verificarEEnviarMatrizQuintaFeira(forcar: boolean = false): Promise<boolean> {
  if (isDispatchingQuintaMatriz) {
    return false
  }

  const hoje = new Date()
  const diaSemana = hoje.getDay() // 4 = Quinta-feira

  if (diaSemana !== 4 && !forcar) {
    return false
  }

  const diaStr = String(hoje.getDate()).padStart(2, '0')
  const mesNumStr = String(hoje.getMonth() + 1).padStart(2, '0')
  const anoStr = String(hoje.getFullYear())
  const dataFormatada = `${diaStr}/${mesNumStr}/${anoStr}`
  const dataIso = `${anoStr}-${mesNumStr}-${diaStr}`

  const mesAtualKey = getMesKey(hoje)
  const mesAtualNome = getMesNome(hoje)
  const ano = hoje.getFullYear()

  const env = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
  const syncKey = `matriz_whatsapp_quinta_${dataIso}_${env}`
  const localLockKey = `matriz_whatsapp_quinta_sent_${dataIso}_${env}`

  // Trava LocalStorage do dia
  if (!forcar && typeof window !== 'undefined') {
    if (localStorage.getItem(localLockKey)) {
      return false
    }
  }

  isDispatchingQuintaMatriz = true

  try {
    // Trava Supabase do dia
    if (!forcar) {
      const { data: dbLock } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', syncKey)
        .maybeSingle()

      if (dbLock?.value && (dbLock.value.enviadoEm || dbLock.value.emProcessamento)) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(localLockKey, 'true')
        }
        return false
      }

      try {
        await supabase.from('global_settings').upsert({
          key: syncKey,
          value: { emProcessamento: true, iniciadoEm: new Date().toISOString() },
        })
      } catch (_) {}
    }

    const settings = await getWhatsappSettings()
    if (settings.matrizResponsabilidade?.enabled === false || settings.matrizResponsabilidade?.enabled_quinta_feira === false) {
      console.info('[Matriz WhatsApp] Envio de acompanhamento de quinta-feira desativado nas configurações.')
      return false
    }

    const targetGroup = settings.matrizResponsabilidade?.specificGroupId || settings.groupId
    if (!targetGroup || !settings.url || !settings.token) {
      console.warn('[Matriz WhatsApp] WhatsApp não configurado adequadamente (URL/Token/Grupo ausentes).')
      return false
    }

    // Carregar dados da Matriz do mês atual
    const matrizData = await carregarDadosMatriz(mesAtualKey, env)
    const mapaNomes = await buscarNomesPorCargo(matrizData)
    const cargosList: CargoMatrizDef[] = (matrizData.cargos && matrizData.cargos.length > 0)
      ? matrizData.cargos
      : CARGOS_MATRIZ

    const concluidosList: string[] = []
    const pendentesList: string[] = []

    for (const cargo of cargosList) {
      const atividades = matrizData.atividadesPorCargo[cargo.id] || []
      const metricas = getMetricasCargo(cargo, atividades)
      const nomesStr = obterNomesDoCargo(cargo, mapaNomes)

      if (metricas.porcentagem === 100 || metricas.isConcluidoTotal) {
        concluidosList.push(`• *${cargo.nome}* (${nomesStr}) — *100% Concluído* (${metricas.marcacoesFeitas}/${metricas.totalMarcacoesPossiveis} marcas)`)
      } else {
        const ativPendentes = metricas.totalAtividades - metricas.concluidas
        pendentesList.push(`• *${cargo.nome}* (${nomesStr}) — *${metricas.porcentagem}%* (${metricas.concluidas}/${metricas.totalAtividades} ativ. concluídas • faltam ${ativPendentes})`)
      }
    }

    const listaConcluidosFormatada = concluidosList.length > 0
      ? concluidosList.join('\n')
      : '_Nenhum cargo concluiu 100% ainda neste mês._'

    const listaPendentesFormatada = pendentesList.length > 0
      ? pendentesList.join('\n')
      : '_Todos os cargos já concluíram 100%! Parabéns à equipe!_'

    let msg =
      settings.messageTemplates?.matrizAcompanhamentoQuintaFeira ||
      `📅 *ACOMPANHAMENTO SEMANAL: MATRIZ DE RESPONSABILIDADES ({mes_nome}/{ano})* 📅\n\nOlá, equipe! Hoje é quinta-feira ({data}), dia de acompanhamento semanal do preenchimento das atividades da Matriz de Segurança do Trabalho.\n\n📊 *SITUAÇÃO ATUAL DA MATRIZ:*\n• Cargos Concluídos (100%): *{cargos_concluidos}/{total_cargos}*\n• Cargos Pendentes: *{cargos_pendentes}*\n\n✅ *JÁ CONCLUÍDOS (100%):*\n{lista_concluidos}\n\n⏳ *PENDENTES / EM ANDAMENTO:*\n{lista_pendentes}\n\n💡 *LEMBRETE:*\n_Aproveitem os próximos dias para atualizar suas inspeções, registrar as evidências e não acumular atividades para a última hora._\n\n_Mensagem automática - Sucena / Hydro Reabilitação_`

    msg = msg.replaceAll('{mes_nome}', mesAtualNome)
    msg = msg.replaceAll('{ano}', String(ano))
    msg = msg.replaceAll('{data}', dataFormatada)
    msg = msg.replaceAll('{total_cargos}', String(cargosList.length))
    msg = msg.replaceAll('{cargos_concluidos}', String(concluidosList.length))
    msg = msg.replaceAll('{cargos_pendentes}', String(pendentesList.length))
    msg = msg.replaceAll('{lista_concluidos}', listaConcluidosFormatada)
    msg = msg.replaceAll('{lista_pendentes}', listaPendentesFormatada)

    await sendWhatsappTextOnServer({
      data: {
        url: settings.url,
        token: settings.token,
        instanceId: settings.instanceId,
        phone: targetGroup,
        text: msg,
      },
    })

    if (typeof window !== 'undefined') {
      localStorage.setItem(localLockKey, 'true')
    }

    try {
      await supabase.from('global_settings').upsert({
        key: syncKey,
        value: {
          enviadoEm: new Date().toISOString(),
          dataIso,
          mesAtualKey,
          concluidos: concluidosList.length,
          pendentes: pendentesList.length,
        },
      })
    } catch (_) {}

    try {
      await supabase.from('system_activities').insert({
        module: 'Segurança',
        action: 'Acompanhamento Matriz WhatsApp Quinta-feira',
        details: `Acompanhamento semanal de quinta-feira (${dataFormatada}) enviado ao WhatsApp da Matriz (${mesAtualNome}/${ano}). Concluídos: ${concluidosList.length}/${cargosList.length}, Pendentes: ${pendentesList.length}.`,
      })
    } catch (_) {}

    console.info(`[Matriz WhatsApp] Acompanhamento de quinta-feira (${dataIso}) enviado com sucesso!`)
    return true
  } catch (err) {
    console.warn('[Matriz WhatsApp] Falha ao enviar acompanhamento de quinta-feira:', err)
    if (typeof window !== 'undefined') {
      localStorage.removeItem(localLockKey)
    }
    return false
  } finally {
    isDispatchingQuintaMatriz = false
  }
}

/**
 * 3. LEMBRETE DE 10 DIAS ANTES DO FIM DO MÊS
 * Verifica se faltam 10 dias ou menos para encerrar o mês e dispara o resumo da Matriz no WhatsApp.
 */
export async function verificarEEnviarLembreteMatrizMes(forcar: boolean = false): Promise<boolean> {
  if (isDispatchingLembreteMatriz) {
    return false
  }

  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mesNum = hoje.getMonth() + 1
  const ultimoDia = new Date(ano, mesNum, 0).getDate()
  const diaAtual = hoje.getDate()
  const diasRestantes = ultimoDia - diaAtual

  // Regra: faltando 10 dias ou menos para finalizar o mês (diasRestantes <= 10)
  const deveDisparar = diasRestantes <= 10 && diasRestantes >= 0
  if (!deveDisparar && !forcar) {
    return false
  }

  const env = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
  const mesKey = getMesKey(hoje)
  const syncKey = `matriz_whatsapp_10dias_${mesKey}_${env}`
  const localLockKey = `matriz_whatsapp_sent_${mesKey}_${env}`

  // Trava 2: LocalStorage síncrono
  if (!forcar && typeof window !== 'undefined') {
    const jaEnviado = localStorage.getItem(localLockKey)
    if (jaEnviado) {
      return false
    }
  }

  isDispatchingLembreteMatriz = true

  try {
    // Trava 3: Supabase
    if (!forcar) {
      const { data: dbLock } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', syncKey)
        .maybeSingle()

      if (dbLock?.value && (dbLock.value.enviadoEm || dbLock.value.emProcessamento)) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(localLockKey, 'true')
        }
        return false
      }

      // Reserva trava imediatamente
      try {
        await supabase.from('global_settings').upsert({
          key: syncKey,
          value: { emProcessamento: true, iniciadoEm: new Date().toISOString() },
        })
      } catch (_) {}
    }

    // Configurações do WhatsApp
    const settings = await getWhatsappSettings()
    if (settings.matrizResponsabilidade?.enabled === false) {
      console.info('[Matriz WhatsApp] Notificação da Matriz desativada nas configurações.')
      return false
    }

    const targetGroup = settings.matrizResponsabilidade?.specificGroupId || settings.groupId
    if (!targetGroup || !settings.url || !settings.token) {
      console.warn('[Matriz WhatsApp] WhatsApp não configurado adequadamente (URL/Token/Grupo ausentes).')
      return false
    }

    // Carregar dados da Matriz e do RH
    const matrizData = await carregarDadosMatriz(mesKey, env)
    const mapaNomes = await buscarNomesPorCargo(matrizData)
    const cargosList: CargoMatrizDef[] = (matrizData.cargos && matrizData.cargos.length > 0)
      ? matrizData.cargos
      : CARGOS_MATRIZ

    const concluidosList: string[] = []
    const pendentesList: string[] = []

    for (const cargo of cargosList) {
      const atividades = matrizData.atividadesPorCargo[cargo.id] || []
      const metricas = getMetricasCargo(cargo, atividades)
      const nomesStr = obterNomesDoCargo(cargo, mapaNomes)

      if (metricas.porcentagem === 100 || metricas.isConcluidoTotal) {
        concluidosList.push(`• *${cargo.nome}* (${nomesStr}) — *100% Concluído* (${metricas.marcacoesFeitas}/${metricas.totalMarcacoesPossiveis} marcas)`)
      } else {
        const ativPendentes = metricas.totalAtividades - metricas.concluidas
        pendentesList.push(`• *${cargo.nome}* (${nomesStr}) — *${metricas.porcentagem}%* (${metricas.concluidas}/${metricas.totalAtividades} ativ. concluídas • faltam ${ativPendentes})`)
      }
    }

    const listaConcluidosFormatada = concluidosList.length > 0
      ? concluidosList.join('\n')
      : '_Nenhum cargo concluiu 100% ainda._'

    const listaPendentesFormatada = pendentesList.length > 0
      ? pendentesList.join('\n')
      : '_Todos os cargos já concluíram 100%! Parabéns à equipe!_'

    let msg =
      settings.messageTemplates?.matrizResponsabilidadeLembrete ||
      `📋 *LEMBRETE: MATRIZ DE RESPONSABILIDADES ({mes_nome}/{ano})* 📋\n\n⏳ *Faltam {dias_restantes} dia(s) para finalizar o mês!*\nPor favor, verifiquem o preenchimento das atividades do seu cargo na Matriz de Segurança.\n\n📊 *SITUAÇÃO ATUAL:*\n• Cargos Concluídos (100%): *{cargos_concluidos}/{total_cargos}*\n• Cargos Pendentes: *{cargos_pendentes}*\n\n✅ *JÁ PREENCHERAM / CONCLUÍDOS:*\n{lista_concluidos}\n\n⏳ *FALTA PREENCHER / PENDENTES:*\n{lista_pendentes}\n\n🔗 _Acesse o sistema e atualize as atividades da sua função antes do fechamento do mês!_\n_Mensagem automática - Sucena / Hydro Reabilitação_`

    msg = msg.replaceAll('{mes_nome}', getMesNome(hoje))
    msg = msg.replaceAll('{ano}', String(ano))
    msg = msg.replaceAll('{dias_restantes}', String(diasRestantes))
    msg = msg.replaceAll('{total_cargos}', String(cargosList.length))
    msg = msg.replaceAll('{cargos_concluidos}', String(concluidosList.length))
    msg = msg.replaceAll('{cargos_pendentes}', String(pendentesList.length))
    msg = msg.replaceAll('{lista_concluidos}', listaConcluidosFormatada)
    msg = msg.replaceAll('{lista_pendentes}', listaPendentesFormatada)

    // Disparar texto no WhatsApp
    await sendWhatsappTextOnServer({
      data: {
        url: settings.url,
        token: settings.token,
        instanceId: settings.instanceId,
        phone: targetGroup,
        text: msg,
      },
    })

    // Registrar sucesso
    if (typeof window !== 'undefined') {
      localStorage.setItem(localLockKey, 'true')
    }

    const registroLock = {
      enviadoEm: new Date().toISOString(),
      mesKey,
      diasRestantes,
      concluidos: concluidosList.length,
      pendentes: pendentesList.length,
    }

    try {
      await supabase.from('global_settings').upsert({
        key: syncKey,
        value: registroLock,
      })
    } catch (_) {}

    try {
      await supabase.from('system_activities').insert({
        module: 'Segurança',
        action: 'Lembrete Matriz WhatsApp',
        details: `Lembrete de final de mês (${diasRestantes} dias restantes) enviado ao WhatsApp da Matriz de Responsabilidades. Concluídos: ${concluidosList.length}/${cargosList.length}.`,
      })
    } catch (_) {}

    console.info(`[Matriz WhatsApp] Lembrete do mês ${mesKey} enviado com sucesso!`)
    return true
  } catch (err) {
    console.warn('[Matriz WhatsApp] Falha ao enviar lembrete:', err)
    if (typeof window !== 'undefined') {
      localStorage.removeItem(localLockKey)
    }
    return false
  } finally {
    isDispatchingLembreteMatriz = false
  }
}

/**
 * 4. DISPARADOR GERAL DE VERIFICAÇÃO DA MATRIZ
 * Executa as 3 rotinas automáticas de verificação da matriz (Dia 1, Toda Quinta e 10 Dias).
 */
export async function verificarEEnviarTodasNotificacoesMatriz(forcar: boolean = false): Promise<void> {
  try {
    // 1. Fechamento dia 1º
    await verificarEEnviarFechamentoMatrizDia1(forcar).catch(err => {
      console.warn('[Matriz WhatsApp] Erro na verificação do dia 1:', err)
    })

    // 2. Acompanhamento semanal de quinta-feira
    await verificarEEnviarMatrizQuintaFeira(forcar).catch(err => {
      console.warn('[Matriz WhatsApp] Erro na verificação de quinta-feira:', err)
    })

    // 3. Lembrete de fim de mês (10 dias)
    await verificarEEnviarLembreteMatrizMes(forcar).catch(err => {
      console.warn('[Matriz WhatsApp] Erro na verificação de 10 dias:', err)
    })
  } catch (err) {
    console.warn('[Matriz WhatsApp] Erro ao verificar notificações da Matriz:', err)
  }
}
