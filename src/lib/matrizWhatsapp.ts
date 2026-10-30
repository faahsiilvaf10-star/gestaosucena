import { getWhatsappSettings } from './settings'
import { sendWhatsappTextOnServer } from './whatsapp-api'
import { supabase } from './supabase'
import {
  CARGOS_MATRIZ,
  getMesKey,
  getMesNome,
  carregarDadosMatriz,
  getMetricasCargo,
} from './matrizResponsabilidadesData'

let isDispatchingLembreteMatriz = false

/**
 * Normaliza cargo do colaborador para comparar com os 6 cargos da matriz
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
 * Busca os colaboradores cadastrados no RH para associar aos 6 cargos
 */
async function buscarNomesPorCargo(): Promise<Record<string, string[]>> {
  const mapa: Record<string, string[]> = {
    'Preposto': [],
    'Encarregado Geral': [],
    'Encarregado I': [],
    'Encarregado II': [],
    'Téc. Segurança I': [],
    'Téc. Segurança II': [],
  }

  try {
    const { data: rhData } = await supabase
      .from('rh_efetivo')
      .select('nome, cargo, status')
      .order('nome', { ascending: true })

    if (rhData && Array.isArray(rhData)) {
      for (const e of rhData) {
        const s = (e.status || '').toUpperCase().trim()
        if (s === 'INATIVO' || s === 'DEMITIDO' || s === 'DESLIGADO') continue
        if (!e.nome || !e.cargo) continue

        const normalizado = normalizarCargoParaMatriz(e.cargo)
        if (normalizado && mapa[normalizado]) {
          if (!mapa[normalizado].includes(e.nome.trim())) {
            mapa[normalizado].push(e.nome.trim())
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
 * Verifica se faltam 10 dias ou menos para encerrar o mês e dispara o resumo da Matriz no WhatsApp.
 * Possui travas em 3 níveis (Memória, LocalStorage e Supabase) para garantir envio único no ciclo.
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
    const [matrizData, nomesRH] = await Promise.all([
      carregarDadosMatriz(mesKey, env),
      buscarNomesPorCargo(),
    ])

    const concluidosList: string[] = []
    const pendentesList: string[] = []

    for (const cargo of CARGOS_MATRIZ) {
      const atividades = matrizData.atividadesPorCargo[cargo.id] || []
      const metricas = getMetricasCargo(cargo, atividades)
      const nomes = nomesRH[cargo.nome] || []
      const nomesStr = nomes.length > 0 ? nomes.join(', ') : 'Colaborador não atribuído'

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
    msg = msg.replaceAll('{total_cargos}', String(CARGOS_MATRIZ.length))
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
        details: `Lembrete de final de mês (${diasRestantes} dias restantes) enviado ao WhatsApp da Matriz de Responsabilidades. Concluídos: ${concluidosList.length}/${CARGOS_MATRIZ.length}.`,
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

