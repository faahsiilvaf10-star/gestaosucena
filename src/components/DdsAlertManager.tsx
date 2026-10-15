import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { getWhatsappSettings } from '../lib/settings'
import {
  chaveDds,
  dataAlvoDds,
  dataDisparo,
  tipoDdsParaAgora,
  type TipoDds,
} from '../lib/dds/regras'

const INTERVALO_MS = 60_000
const TOLERANCIA_MINUTOS = 10

const FALLBACK_HOJE =
  '🎤 *Lembrete DDS - Hoje*\n\n👤 *Palestrante:* {palestrante}\n📅 *Data:* {data} (hoje)\n📋 {tema}\n\n_Mensagem automática - Sucena_'

const FALLBACK_AMANHA =
  '🎤 *Aviso Prévio DDS - Amanhã*\n\n👤 *Palestrante:* {palestrante}\n📅 *Data:* {data} (amanhã)\n📋 {tema}\n\n_Mensagem automática - Sucena_'

/**
 * Resolve o nome do palestrante.
 *
 * Os ids em `seguranca_dds.palestrante_id` vêm da RPC `get_system_users`
 * — é a mesma fonte que alimenta o seletor da tela de DDS. A tabela
 * `hr_employees` não existe no banco: a consulta retornava 404 e o nome
 * saía como "Não informado".
 *
 * A RPC usa a coluna `nome` (não `name`), por isso ambos são verificados.
 */
async function nomeDoPalestrante(palestranteId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_system_users')
  if (error) {
    console.error('[DDS] Erro ao buscar usuários do sistema:', error)
    return 'Não informado'
  }

  const usuarios = (data ?? []) as Array<{ id: string; nome?: string | null }>
  const encontrado = usuarios.find((u) => u.id === palestranteId)
  return encontrado?.nome || 'Não informado'
}

/**
 * Dispara o aviso do DDS às 06:00 (dia corrente) e às 16:00 (dia seguinte).
 *
 * O envio é idempotente por tipo+dia via `localStorage`, e o registro só
 * é gravado DEPOIS que a mensagem foi aceita pela API — antes isso, uma
 * falha silenciosa marcava o dia como concluído e o aviso nunca saía.
 */
export function DdsAlertManager() {
  const executando = useRef<Set<string>>(new Set())

  useEffect(() => {
    const verificar = () => {
      const agora = new Date()
      const tipo = tipoDdsParaAgora(
        agora.getHours(),
        agora.getMinutes(),
        TOLERANCIA_MINUTOS,
      )
      if (!tipo) return

      const chave = chaveDds(tipo, dataDisparo(tipo, agora))
      if (executando.current.has(chave)) return
      if (localStorage.getItem(chave)) return

      executando.current.add(chave)
      void enviar(tipo, agora, chave).finally(() => {
        executando.current.delete(chave)
      })
    }

    // Verifica imediatamente ao montar (cobre recarregar perto do horário)
    verificar()
    const intervalo = setInterval(verificar, INTERVALO_MS)
    return () => clearInterval(intervalo)
  }, [])

  const enviar = async (tipo: TipoDds, agora: Date, chave: string) => {
    try {
      const settings = await getWhatsappSettings()

      const enabled =
        tipo === 'hoje'
          ? settings?.ddsReminders?.enabled_0600
          : settings?.ddsReminders?.enabled_1600

      if (!enabled) {
        console.info(`[DDS] Lembrete das ${tipo === 'hoje' ? '06' : '16'}h desativado no Admin.`)
        return
      }

      const alvo = dataAlvoDds(tipo, agora)
      const alvoStr = format(alvo, 'yyyy-MM-dd')
      const ambiente =
        localStorage.getItem('sucena_environment') || 'barcarena'

      // maybeSingle() em vez de single(): se houver mais de um registro
      // para a mesma data, o single() lançava e nada era enviado.
      const { data: agenda, error: erroAgenda } = await supabase
        .from('seguranca_dds')
        .select('id, tema, palestrante_id, environment')
        .eq('date', alvoStr)
        .eq('environment', ambiente)
        .maybeSingle()

      if (erroAgenda) {
        console.error('[DDS] Erro ao buscar agendamento:', erroAgenda)
        return
      }

      if (!agenda) {
        console.info(`[DDS] Nenhum DDS cadastrado para ${alvoStr} em ${ambiente}.`)
        return
      }

      let palestranteNome = 'Não informado'
if (agenda.palestrante_id) {
        palestranteNome = await nomeDoPalestrante(agenda.palestrante_id)
      }

      let msg =
        tipo === 'hoje'
          ? settings?.messageTemplates?.ddsHoje || FALLBACK_HOJE
          : settings?.messageTemplates?.ddsAmanha || FALLBACK_AMANHA

      msg = msg
        .replace(/\{palestrante\}/g, palestranteNome)
        .replace(/\{data\}/g, format(alvo, 'dd/MM/yyyy'))
        .replace(/\{tema\}/g, agenda.tema || 'TEMA A DEFINIR')

      let baseUrl = (settings?.url || '').trim()
      if (!baseUrl || !settings?.token || !settings?.instanceId) {
        console.error('[DDS] Configuração do WhatsApp incompleta (url/token/instanceId).')
        return
      }

      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)
      if (baseUrl.includes('painel.w-api.app')) baseUrl = 'https://api.w-api.app/v1'
      else if (baseUrl.includes('api.w-api.app') && !baseUrl.includes('/v1')) {
        baseUrl = baseUrl + '/v1'
      }

      const endpoint = `${baseUrl}/messages/send-text?instanceId=${settings.instanceId}`
      const number = settings?.ddsReminders?.specificGroupId || settings?.groupId
      if (!number) {
        console.error('[DDS] Nenhum grupo de destino configurado.')
        return
      }

      const payload = { number, phone: number, text: msg, message: msg }

      let res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings!.token}`,
          apikey: settings!.token,
        },
        body: JSON.stringify(payload),
      })

      if (res.status === 404) {
        const fallback = endpoint.includes('/message/')
          ? endpoint.replace('/message/', '/messages/')
          : endpoint.replace('/messages/', '/message/')
        res = await fetch(fallback, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings!.token}`,
            apikey: settings!.token,
          },
          body: JSON.stringify(payload),
        })
      }

      if (res.ok) {
        // Só marca como enviado depois do sucesso
        localStorage.setItem(chave, 'true')
        console.log(`[DDS] Aviso (${tipo}) enviado com sucesso. Palestrante: ${palestranteNome}`)
      } else {
        const corpo = await res.text().catch(() => '')
        console.error(
          `[DDS] Falha ao enviar (${tipo}). HTTP ${res.status}`,
          corpo.slice(0, 200),
        )
      }
    } catch (err) {
      console.error(`[DDS] Erro inesperado no envio (${tipo}):`, err)
    }
  }

  return null
}