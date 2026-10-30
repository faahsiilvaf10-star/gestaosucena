import { getWhatsappSettings } from './settings'
import { sendWhatsappTextOnServer } from './whatsapp-api'
import { supabase } from './supabase'

export interface PontoInspecaoData {
  uid: string
  titulo: string
  obs: string
  cat: string
  prio: string
  foto?: string
  corrigido: boolean
  fotoCorrecao?: string
  obsCorrecao?: string
  dataCorrecao?: string
}

export interface InspecaoRegistroData {
  data: string
  local: string
  responsavel: string
  turno: string
  area: string
  salvoEm: string
  itens: PontoInspecaoData[]
}

const formatarDataBr = (dataIso?: string): string => {
  if (!dataIso) return '—'
  const parts = dataIso.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  try {
    return new Date(dataIso + 'T12:00:00').toLocaleDateString('pt-BR')
  } catch {
    return dataIso
  }
}

/**
 * 1. Dispara mensagem imediata no grupo ao salvar/agendar nova inspeção do canteiro
 */
export async function notificarInspecaoAgendada(registro: InspecaoRegistroData) {
  try {
    const settings = await getWhatsappSettings()
    if (settings.inspecaoCanteiro?.enabled_agendamento === false) {
      console.info('[Inspeção Canteiro] Notificação de agendamento desativada nas configurações.')
      return
    }

    const targetGroup = settings.inspecaoCanteiro?.specificGroupId || settings.groupId
    if (!targetGroup || !settings.url || !settings.token) {
      console.warn('[Inspeção Canteiro] WhatsApp não configurado para envio de agendamento.')
      return
    }

    const dataInspecaoFormatada = formatarDataBr(registro.data)
    const listaItens = registro.itens
      .map((item, idx) => `${idx + 1}. *[${item.cat} - ${item.prio}]* ${item.titulo}\n   📝 _Obs:_ ${item.obs}`)
      .join('\n\n')

    let msg = settings.messageTemplates?.inspecaoCanteiroAgendada ||
      '🏗️ *NOVA INSPEÇÃO DE CANTEIRO AGENDADA* 🏗️\n\n📅 *Data da Inspeção:* {data_inspecao}\n📍 *Local / Frente:* {local}\n👤 *Responsável:* {responsavel}\n🕒 *Turno:* {turno}\n🏗️ *Área:* {area}\n⏳ *Prazo Final:* {prazo}\n\n⚠️ *Pontos de Atenção ({total_pontos}):*\n{lista_itens}\n\n_Mensagem automática - Sucena Segurança_'

    msg = msg.replaceAll('{data_inspecao}', dataInspecaoFormatada)
    msg = msg.replaceAll('{prazo}', dataInspecaoFormatada)
    msg = msg.replaceAll('{local}', registro.local || 'Canteiro Central')
    msg = msg.replaceAll('{responsavel}', registro.responsavel || 'Não informado')
    msg = msg.replaceAll('{turno}', registro.turno || 'Manhã')
    msg = msg.replaceAll('{area}', registro.area || 'Geral')
    msg = msg.replaceAll('{total_pontos}', String(registro.itens.length))
    msg = msg.replaceAll('{lista_itens}', listaItens || 'Nenhum ponto registrado.')

    await sendWhatsappTextOnServer({
      data: {
        url: settings.url,
        token: settings.token,
        instanceId: settings.instanceId,
        phone: targetGroup,
        text: msg,
      },
    })

    // Registrar no histórico de atividades do sistema
    try {
      const currentUserName = typeof window !== 'undefined' ? localStorage.getItem('sucena_user_name') || 'Segurança' : 'Segurança'
      const currentEnv = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
      await supabase.from('system_activities').insert({
        module: 'Segurança',
        action: `Nova inspeção de canteiro agendada para ${dataInspecaoFormatada} (${registro.itens.length} pontos de atenção)`,
        user_name: currentUserName,
        environment: currentEnv,
      })
    } catch (_) {}
  } catch (err) {
    console.warn('[Inspeção Canteiro] Falha ao enviar notificação de agendamento no WhatsApp:', err)
  }
}

/**
 * 2. Dispara mensagem imediata no grupo ao salvar a correção de um item
 */
export async function notificarItemCorrigido(
  item: PontoInspecaoData,
  registro: InspecaoRegistroData,
  usuarioNome: string
) {
  try {
    const settings = await getWhatsappSettings()
    if (settings.inspecaoCanteiro?.enabled_correcao_item === false) {
      console.info('[Inspeção Canteiro] Notificação de correção de item desativada nas configurações.')
      return
    }

    const targetGroup = settings.inspecaoCanteiro?.specificGroupId || settings.groupId
    if (!targetGroup || !settings.url || !settings.token) {
      console.warn('[Inspeção Canteiro] WhatsApp não configurado para envio de correções.')
      return
    }

    const dataInspecaoFormatada = formatarDataBr(registro.data)
    const totalPontos = registro.itens.length
    const totalCorrigidos = registro.itens.filter((i) => i.corrigido).length
    const porcentagem = totalPontos > 0 ? Math.round((totalCorrigidos / totalPontos) * 100) : 0

    let msg = settings.messageTemplates?.inspecaoCanteiroCorrecao ||
      '✅ *ITEM DE INSPEÇÃO DE CANTEIRO CORRIGIDO*\n\n🏗️ *Ponto:* {titulo_item}\n📂 *Categoria:* {categoria}\n🚨 *Prioridade:* {prioridade}\n📍 *Local:* {local}\n📅 *Prazo:* {prazo}\n\n🛠️ *O que foi feito na correção:*\n{o_que_foi_feito}\n\n👤 *Atualizado por:* {usuario}\n🕒 *Concluído em:* {data_correcao}\n📊 *Progresso da Inspeção:* {total_corrigidos}/{total_pontos} itens corrigidos ({porcentagem}%)\n\n_Mensagem automática - Sucena Segurança_'

    msg = msg.replaceAll('{titulo_item}', item.titulo || 'Ponto de Atenção')
    msg = msg.replaceAll('{categoria}', item.cat || 'Geral')
    msg = msg.replaceAll('{prioridade}', item.prio || 'Atenção')
    msg = msg.replaceAll('{local}', registro.local || 'Canteiro')
    msg = msg.replaceAll('{prazo}', dataInspecaoFormatada)
    msg = msg.replaceAll('{o_que_foi_feito}', item.obsCorrecao || 'Correção realizada conforme instruído.')
    msg = msg.replaceAll('{usuario}', usuarioNome || 'Inspetor / Segurança')
    msg = msg.replaceAll('{data_correcao}', item.dataCorrecao || new Date().toLocaleString('pt-BR'))
    msg = msg.replaceAll('{total_corrigidos}', String(totalCorrigidos))
    msg = msg.replaceAll('{total_pontos}', String(totalPontos))
    msg = msg.replaceAll('{porcentagem}', String(porcentagem))

    await sendWhatsappTextOnServer({
      data: {
        url: settings.url,
        token: settings.token,
        instanceId: settings.instanceId,
        phone: targetGroup,
        text: msg,
      },
    })

    // Registrar no histórico de atividades
    try {
      const currentEnv = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
      await supabase.from('system_activities').insert({
        module: 'Segurança',
        action: `Item de canteiro corrigido: "${item.titulo}" por ${usuarioNome}`,
        user_name: usuarioNome,
        environment: currentEnv,
      })
    } catch (_) {}
  } catch (err) {
    console.warn('[Inspeção Canteiro] Falha ao enviar notificação de correção no WhatsApp:', err)
  }
}

/**
 * 3. Dispara mensagem no dia da inspeção às 07:00 da manhã
 */
export async function notificarDiaInspecao(registro: InspecaoRegistroData) {
  try {
    const settings = await getWhatsappSettings()
    if (settings.inspecaoCanteiro?.enabled_dia_inspecao_0700 === false) {
      console.info('[Inspeção Canteiro] Notificação matinal das 07h desativada nas configurações.')
      return
    }

    const targetGroup = settings.inspecaoCanteiro?.specificGroupId || settings.groupId
    if (!targetGroup || !settings.url || !settings.token) {
      console.warn('[Inspeção Canteiro] WhatsApp não configurado para envio de lembrete matinal.')
      return
    }

    const dataInspecaoFormatada = formatarDataBr(registro.data)
    const totalPontos = registro.itens.length
    const totalCorrigidos = registro.itens.filter((i) => i.corrigido).length
    const totalPendentes = totalPontos - totalCorrigidos

    const pendencias = registro.itens
      .filter((i) => !i.corrigido)
      .map((item, idx) => `${idx + 1}. ⏳ *[${item.cat} - ${item.prio}]* ${item.titulo}\n   📝 _Pendente:_ ${item.obs}`)
      .join('\n\n')

    let msg = settings.messageTemplates?.inspecaoCanteiroDia ||
      '🚨 *HOJE É DIA DE INSPEÇÃO DE CANTEIRO (07:00)* 🚨\n\n📅 *Data:* {data_inspecao} (Hoje)\n📍 *Local:* {local}\n👤 *Responsável:* {responsavel}\n🕒 *Turno:* {turno}\n🏗️ *Área:* {area}\n\n📊 *Situação Atual:*\n• Total de pontos: {total_pontos}\n• ✅ Corrigidos: {total_corrigidos}\n• ⏳ Pendentes: {total_pendentes}\n\n{lista_pendencias}\n\n_Favor verificar os pontos pendentes antes da fiscalização._\n_Mensagem automática - Sucena Segurança_'

    msg = msg.replaceAll('{data_inspecao}', dataInspecaoFormatada)
    msg = msg.replaceAll('{local}', registro.local || 'Canteiro')
    msg = msg.replaceAll('{responsavel}', registro.responsavel || 'Não informado')
    msg = msg.replaceAll('{turno}', registro.turno || 'Manhã')
    msg = msg.replaceAll('{area}', registro.area || 'Geral')
    msg = msg.replaceAll('{total_pontos}', String(totalPontos))
    msg = msg.replaceAll('{total_corrigidos}', String(totalCorrigidos))
    msg = msg.replaceAll('{total_pendentes}', String(totalPendentes))
    msg = msg.replaceAll('{lista_pendencias}', pendencias ? `*Itens pendentes a verificar:*\n${pendencias}` : '✅ Todos os pontos foram corrigidos com antecedência!')

    await sendWhatsappTextOnServer({
      data: {
        url: settings.url,
        token: settings.token,
        instanceId: settings.instanceId,
        phone: targetGroup,
        text: msg,
      },
    })
  } catch (err) {
    console.warn('[Inspeção Canteiro] Falha ao enviar lembrete matinal das 07h no WhatsApp:', err)
  }
}
