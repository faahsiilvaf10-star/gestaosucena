import { getWhatsappSettings } from './settings'
import { sendWhatsappTextOnServer } from './whatsapp-api'
import { supabase } from './supabase'
import { getMesInspecaoAtual, type MesInspecao } from './cintasConfig'

export async function enviarNotificacaoViradaCorDoMes(forcar = false): Promise<boolean> {
  try {
    const settings = await getWhatsappSettings()

    if (settings.viradaCorDoMes?.enabled === false) {
      console.info('[Cor do Mês WhatsApp] Notificação de virada de cor desativada nas configurações.')
      return false
    }

    const targetGroup = settings.viradaCorDoMes?.specificGroupId || settings.groupId
    if (!targetGroup || !settings.url || !settings.token) {
      console.warn('[Cor do Mês WhatsApp] WhatsApp não configurado para envio.')
      return false
    }

    const agora = new Date()
    const mesAtual = getMesInspecaoAtual(agora)

    // Calcular mês anterior
    const dataAnterior = new Date(agora)
    dataAnterior.setDate(1)
    dataAnterior.setMonth(dataAnterior.getMonth() - 1)
    const mesAnterior = getMesInspecaoAtual(dataAnterior)

    const env = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
    const anoAtual = agora.getFullYear()
    const mesNumero = agora.getMonth() + 1
    const chaveLocal = `cor_mes_sent_${env}_${anoAtual}_${mesNumero}`

    if (!forcar) {
      if (typeof window !== 'undefined' && localStorage.getItem(chaveLocal)) {
        return false
      }

      // Checar se já disparou no banco este mês
      const inicioMesStr = `${anoAtual}-${String(mesNumero).padStart(2, '0')}-01T00:00:00.000Z`
      const { data: jaEnviado } = await supabase
        .from('system_activities')
        .select('id')
        .eq('environment', env)
        .ilike('action', '%[WHATSAPP COR DO MES]%')
        .gte('created_at', inicioMesStr)
        .maybeSingle()

      if (jaEnviado) {
        if (typeof window !== 'undefined') localStorage.setItem(chaveLocal, 'true')
        return false
      }
    }

    const nomesMeses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]
    const nomeMesAtual = nomesMeses[agora.getMonth()]

    let msg =
      settings.messageTemplates?.viradaCorDoMesFerramentas ||
      "🎨 *ATENÇÃO: VIRADA DA COR DO MÊS - INSPEÇÃO DE FERRAMENTAS ({mes_nome}/{ano})* 🎨\n\n📢 *Atenção Colaboradores, Encarregados e Equipe Operacional!*\nIniciamos um novo mês de trabalho. Conforme o padrão de segurança e controle de qualidade da obra, é obrigatória a atualização das cores das ferramentas:\n\n🟡 *NOVA COR DO MÊS ATUAL (VÁLIDA):* *{cor_atual}*\n🚫 *COR DO MÊS ANTERIOR (PROIBIDA):* *{cor_anterior_proibida}*\n\n🔧 *INSTRUÇÕES OBRIGATÓRIAS:*\n1. *Troca de Etiquetas:* Todas as ferramentas manuais, elétricas, pneumáticas e cintas devem receber a etiqueta/fita com a nova cor (*{cor_atual}*).\n2. *Atenção aos Checklists:* Antes de iniciar qualquer atividade, realize a inspeção minuciosa e preencha o checklist diário do equipamento/ferramenta.\n3. *Bloqueio de Uso:* Qualquer ferramenta com a cor anterior (*{cor_anterior_proibida}*) ou sem a identificação do mês está *PROIBIDA* de ser utilizada na obra até ser inspecionada!\n\n⚠️ _Mais segurança, mais resultados!_\n_Mensagem automática - Sucena / Hydro Reabilitação_"

    msg = msg.replaceAll('{mes_nome}', nomeMesAtual)
    msg = msg.replaceAll('{ano}', String(anoAtual))
    msg = msg.replaceAll('{cor_atual}', mesAtual.cor.toUpperCase())
    msg = msg.replaceAll('{cor_anterior_proibida}', mesAnterior.cor.toUpperCase())

    await sendWhatsappTextOnServer({
      data: {
        url: settings.url,
        token: settings.token,
        instanceId: settings.instanceId,
        phone: targetGroup,
        text: msg,
      },
    })

    await supabase.from('system_activities').insert({
      module: 'Segurança',
      action: `[WHATSAPP COR DO MES] Virada para ${mesAtual.cor} (${nomeMesAtual}/${anoAtual}) - Troca de etiquetas e checklists`,
      user_name: 'Sistema Automático',
      environment: env,
    })

    if (typeof window !== 'undefined') {
      localStorage.setItem(chaveLocal, 'true')
    }

    return true
  } catch (err) {
    console.error('[Cor do Mês WhatsApp] Erro ao enviar notificação de virada de cor:', err)
    return false
  }
}
