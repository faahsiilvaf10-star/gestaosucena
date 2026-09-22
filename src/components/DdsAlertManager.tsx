import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { format, addDays } from 'date-fns'
import { getWhatsappSettings } from '../lib/settings'

export function DdsAlertManager() {
  const hasRun = useRef<{ [key: string]: boolean }>({})

  useEffect(() => {
    // Verifica a cada minuto se atingiu 06:00 ou 16:00
    const interval = setInterval(() => {
      const now = new Date()
      const hour = now.getHours()
      const minute = now.getMinutes()
      const dateStr = format(now, 'yyyy-MM-dd')

      if (hour === 6 && minute === 0) {
        checkAndSend(dateStr, 'hoje')
      } else if (hour === 16 && minute === 0) {
        checkAndSend(dateStr, 'amanha')
      }
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  const checkAndSend = async (dateStr: string, tipo: 'hoje' | 'amanha') => {
    const runKey = `dds_${tipo}_${dateStr}`
    
    // Evita rodar duas vezes no mesmo minuto ou recarregar
    if (hasRun.current[runKey] || localStorage.getItem(runKey)) return
    hasRun.current[runKey] = true
    localStorage.setItem(runKey, 'true')

    try {
      const settings = await getWhatsappSettings()
      
      const enabled = tipo === 'hoje' ? settings?.ddsReminders?.enabled_0600 : settings?.ddsReminders?.enabled_1600
      if (!enabled) return

      const targetDate = tipo === 'hoje' ? new Date() : addDays(new Date(), 1)
      const targetDateStr = format(targetDate, 'yyyy-MM-dd')

      // Busca o DDS agendado
      const { data: ddsData } = await supabase
        .from('seguranca_dds')
        .select('*')
        .eq('date', targetDateStr)
        .eq('environment', typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena')
        .single()

      if (!ddsData) return

      // Busca o palestrante
      const { data: employees } = await supabase.from('hr_employees').select('id, nome')
      const palestrante = employees?.find(e => e.id === ddsData.palestrante_id)
      const palestranteNome = palestrante ? palestrante.nome : 'Não informado'

      // Monta a mensagem
      let msg = tipo === 'hoje' 
        ? (settings?.messageTemplates?.ddsHoje || '🎤 *Lembrete DDS - Hoje*\n\n👤 *Palestrante:* {palestrante}\n📅 *Data:* {data} (hoje)\n📋 {tema}\n\n_Mensagem automática - Sucena_')
        : (settings?.messageTemplates?.ddsAmanha || '🎤 *Aviso Prévio DDS - Amanhã*\n\n👤 *Palestrante:* {palestrante}\n📅 *Data:* {data} (amanhã)\n📋 {tema}\n\n_Mensagem automática - Sucena_')

      msg = msg.replace('{palestrante}', palestranteNome)
               .replace('{data}', format(targetDate, 'dd/MM/yyyy'))
               .replace('{tema}', ddsData.tema || 'TEMA A DEFINIR')

      // Envia via fetch direto (bypass SSR cors proxy issue just in case)
      let baseUrl = settings!.url.trim()
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)
      if (baseUrl.includes('painel.w-api.app')) baseUrl = 'https://api.w-api.app/v1'
      else if (baseUrl.includes('api.w-api.app') && !baseUrl.includes('/v1')) baseUrl = baseUrl + '/v1'

      const endpoint = `${baseUrl}/messages/send-text?instanceId=${settings!.instanceId}`
      const number = settings!.ddsReminders?.specificGroupId || settings!.groupId
      if (!number) return

      const payload = { number, phone: number, text: msg, message: msg }

      let res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings!.token}`,
          'apikey': settings!.token
        },
        body: JSON.stringify(payload)
      })

      if (res.status === 404) {
        const fallback = endpoint.includes('/message/') ? endpoint.replace('/message/', '/messages/') : endpoint.replace('/messages/', '/message/')
        res = await fetch(fallback, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings!.token}`,
            'apikey': settings!.token
          },
          body: JSON.stringify(payload)
        })
      }
      
      console.log(`DDS Alert (${tipo}) sent:`, res.status)

    } catch (err) {
      console.error(`Error sending DDS Alert (${tipo}):`, err)
    }
  }

  return null
}
