import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getWhatsappSettings } from '../lib/settings'
import { notificarDiaInspecao, type InspecaoRegistroData } from '../lib/inspecaoCanteiroWhatsapp'

const INTERVALO_MS = 60_000

function getHojeIso(): string {
  const d = new Date()
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export function CanteiroAlertManager() {
  const executando = useRef(false)

  useEffect(() => {
    const verificar = async () => {
      if (executando.current) return

      const agora = new Date()
      // Disparo programado para as 07:00 da manhã em diante (durante o dia de inspeção)
      if (agora.getHours() < 7) return

      const hoje = getHojeIso()
      const env = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
      const chaveLocal = `canteiro_alerta_0700_${env}_${hoje}`

      if (localStorage.getItem(chaveLocal)) return

      executando.current = true

      try {
        const settings = await getWhatsappSettings()
        if (settings.inspecaoCanteiro?.enabled_dia_inspecao_0700 === false) {
          return
        }

        // Buscar inspeções salvas no banco
        const { data: dbData } = await supabase
          .from('global_settings')
          .select('value')
          .eq('key', `canteiro_inspecoes_${env}`)
          .maybeSingle()

        let lista: InspecaoRegistroData[] = []
        if (dbData?.value) {
          try {
            lista = typeof dbData.value === 'string' ? JSON.parse(dbData.value) : dbData.value
          } catch (_) {
            lista = []
          }
        }

        // Encontrar inspeções marcadas para a data de hoje
        const inspecoesHoje = lista.filter((ins) => ins.data === hoje)
        if (inspecoesHoje.length === 0) {
          return
        }

        // Verificar trava distribuída no banco via system_activities para não duplicar envio entre abas/usuários
        const acaoMarca = `[ALERTA 07:00] Inspeção de canteiro do dia ${hoje}`
        const { data: jaDisparado } = await supabase
          .from('system_activities')
          .select('id')
          .eq('environment', env)
          .eq('action', acaoMarca)
          .maybeSingle()

        if (jaDisparado) {
          localStorage.setItem(chaveLocal, 'true')
          return
        }

        // Marcar trava no banco imediatamente
        await supabase.from('system_activities').insert({
          module: 'Segurança',
          action: acaoMarca,
          user_name: 'Sistema Automático (07:00)',
          environment: env,
        })

        // Enviar notificação para cada inspeção agendada para hoje
        for (const inspecao of inspecoesHoje) {
          await notificarDiaInspecao(inspecao)
        }

        localStorage.setItem(chaveLocal, 'true')
      } catch (err) {
        console.warn('[CanteiroAlertManager] Erro ao verificar lembrete matinal:', err)
      } finally {
        executando.current = false
      }
    }

    verificar()
    const timer = setInterval(verificar, INTERVALO_MS)
    return () => clearInterval(timer)
  }, [])

  return null
}
