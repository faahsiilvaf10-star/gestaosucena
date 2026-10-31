import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getWhatsappSettings } from '../lib/settings'
import {
  type AnaliseRiscoItem,
  carregarAnalisesRisco,
  diasAteValidade,
} from '../lib/analiseRiscoData'
import {
  notificarAnaliseRiscoVencendo5Dias,
  notificarAnaliseRiscoVencendoHoje,
} from '../lib/analiseRiscoWhatsapp'

const INTERVALO_MS = 60_000

export function AnaliseRiscoAlertManager() {
  const executando = useRef(false)

  useEffect(() => {
    const verificar = async () => {
      if (executando.current) return

      const env =
        typeof window !== 'undefined'
          ? localStorage.getItem('sucena_environment') || 'barcarena'
          : 'barcarena'

      executando.current = true

      try {
        const settings = await getWhatsappSettings()

        // Carregar análises salvas
        const analises = await carregarAnalisesRisco(env)
        const abertas = analises.filter((a) => a.status === 'Em aberto' && a.validaAte)

        for (const item of abertas) {
          const dias = diasAteValidade(item.validaAte)
          if (dias === null) continue

          // 1. Alerta de 5 dias
          if (dias <= 5 && dias > 0 && settings.analiseRisco?.enabled_5_dias !== false) {
            const chaveLocal5d = `ar_alerta_5d_${env}_${item.id}_${item.validaAte}`
            if (!localStorage.getItem(chaveLocal5d)) {
              const acaoMarca5d = `[ALERTA 5 DIAS] Análise de Risco ${item.id} (${item.validaAte})`
              const { data: jaDisparado } = await supabase
                .from('system_activities')
                .select('id')
                .eq('environment', env)
                .eq('action', acaoMarca5d)
                .maybeSingle()

              if (!jaDisparado) {
                // Registrar lock no banco antes de disparar para evitar concorrência
                await supabase.from('system_activities').insert({
                  module: 'Segurança',
                  action: acaoMarca5d,
                  user_name: 'Alexssandro Chaves',
                  environment: env,
                })
                await notificarAnaliseRiscoVencendo5Dias(item)
              }
              localStorage.setItem(chaveLocal5d, 'true')
            }
          }

          // 2. Alerta no dia em que vence (dias === 0)
          if (dias === 0 && settings.analiseRisco?.enabled_dia_vencimento !== false) {
            const chaveLocalHoje = `ar_alerta_hoje_${env}_${item.id}_${item.validaAte}`
            if (!localStorage.getItem(chaveLocalHoje)) {
              const acaoMarcaHoje = `[ALERTA HOJE] Análise de Risco ${item.id} (${item.validaAte})`
              const { data: jaDisparadoHoje } = await supabase
                .from('system_activities')
                .select('id')
                .eq('environment', env)
                .eq('action', acaoMarcaHoje)
                .maybeSingle()

              if (!jaDisparadoHoje) {
                await supabase.from('system_activities').insert({
                  module: 'Segurança',
                  action: acaoMarcaHoje,
                  user_name: 'Alexssandro Chaves',
                  environment: env,
                })
                await notificarAnaliseRiscoVencendoHoje(item)
              }
              localStorage.setItem(chaveLocalHoje, 'true')
            }
          }
        }
      } catch (err) {
        console.warn('[AnaliseRiscoAlertManager] Erro ao processar alertas de validade:', err)
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
