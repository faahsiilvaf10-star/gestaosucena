import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getWhatsappSettings } from '../lib/settings'
import { notificarVistoriaEquipamento20Dias, fmtDataBr } from '../lib/equipamentosVistoriaWhatsapp'
import { format } from 'date-fns'

interface EquipmentInspection {
  id: string
  opacity_report_expiry: string | null
  mechanical_report_expiry: string | null
  maintenance_plan_expiry: string | null
  tachograph_expiry: string | null
}

interface Equipment {
  id: string
  name: string
  plate_tag: string
  equipment_inspections?: EquipmentInspection | EquipmentInspection[] | null
}

interface VistoriaAlerta {
  eqId: string
  eqName: string
  plateTag: string
  docType: string
  expiry: string
  days: number
}

function getDaysRemaining(dateString: string | null | undefined): number | null {
  if (!dateString) return null
  const [year, month, day] = dateString.split('-').map(Number)
  if (!year || !month || !day) return null
  
  const target = new Date(year, month - 1, day)
  target.setHours(0, 0, 0, 0)
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const diffTime = target.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

const INTERVALO_MS = 60_000

export function VistoriaEquipamentoAlertManager() {
  const executando = useRef(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [alertasComunicado, setAlertasComunicado] = useState<VistoriaAlerta[]>([])

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

        const { data: equipments, error } = await supabase
          .from('eq_equipments')
          .select(`
            id, name, plate_tag, category,
            equipment_inspections (
              id, opacity_report_expiry, mechanical_report_expiry, maintenance_plan_expiry, tachograph_expiry
            )
          `)
          .or('category.neq.Jardinagem,category.is.null')

        if (error || !equipments) return

        const alertasEncontrados: VistoriaAlerta[] = []

        for (const eq of equipments) {
          const ins = Array.isArray(eq.equipment_inspections)
            ? eq.equipment_inspections[0]
            : eq.equipment_inspections
          if (!ins) continue

          const docs = [
            { type: 'Laudo de Opacidade', expiry: ins.opacity_report_expiry },
            { type: 'Laudo Mecânico', expiry: ins.mechanical_report_expiry },
            { type: 'Plano de Manutenção', expiry: ins.maintenance_plan_expiry },
            { type: 'Tacógrafo / ART', expiry: ins.tachograph_expiry },
          ]

          for (const doc of docs) {
            if (!doc.expiry) continue
            const dias = getDaysRemaining(doc.expiry)
            if (dias === null) continue

            // Alerta quando estiver vencendo em até 20 dias (ou vencido)
            if (dias <= 20) {
              const itemAlerta: VistoriaAlerta = {
                eqId: eq.id,
                eqName: eq.name,
                plateTag: eq.plate_tag,
                docType: doc.type,
                expiry: doc.expiry,
                days: dias,
              }
              alertasEncontrados.push(itemAlerta)

              // Disparo no WhatsApp quando faltar <= 20 dias (com lock diário anti-duplicação)
              if (settings.vistoriasEquipamentos?.enabled_20_dias !== false && dias > 0) {
                const hojeStr = format(new Date(), 'yyyy-MM-dd')
                const chaveLocal20d = `vistoria_alerta_20d_${env}_${eq.id}_${doc.type}_${doc.expiry}_${hojeStr}`

                if (!localStorage.getItem(chaveLocal20d)) {
                  const acaoMarca20d = `[ALERTA 20 DIAS] Vistoria ${doc.type} de ${eq.name} (${eq.plate_tag}) vence em ${dias} dias (${doc.expiry})`
                  
                  // Verificar se já foi enviado hoje no banco
                  const { data: jaDisparado } = await supabase
                    .from('system_activities')
                    .select('id')
                    .eq('environment', env)
                    .ilike('action', `%[WHATSAPP 20 DIAS] Vistoria ${doc.type} de ${eq.name}%`)
                    .gte('created_at', `${hojeStr}T00:00:00.000Z`)
                    .maybeSingle()

                  if (!jaDisparado) {
                    // Lock preventivo
                    await supabase.from('system_activities').insert({
                      module: 'Equipamentos',
                      action: acaoMarca20d,
                      user_name: 'Sistema Automático',
                      environment: env,
                    })

                    await notificarVistoriaEquipamento20Dias({
                      eqName: eq.name,
                      plateTag: eq.plate_tag,
                      docType: doc.type,
                      expiryDate: doc.expiry,
                      daysRemaining: dias,
                    })
                  }
                  localStorage.setItem(chaveLocal20d, 'true')
                }
              }
            }
          }
        }

        // Se houver vistorias vencendo em 20 dias, exibe o comunicado diário ao usuário
        if (alertasEncontrados.length > 0) {
          const hojeStr = format(new Date(), 'yyyy-MM-dd')
          const ultimoVisto = localStorage.getItem('last_vistoria_comunicado_date')
          if (ultimoVisto !== hojeStr) {
            setAlertasComunicado(alertasEncontrados)
            setModalAberto(true)
            try {
              const audio = new Audio('/comunicado.mp3')
              audio.play().catch(() => {})
            } catch (_) {}
          }
        }
      } catch (err) {
        console.warn('[VistoriaEquipamentoAlertManager] Erro ao verificar vistorias:', err)
      } finally {
        executando.current = false
      }
    }

    verificar()
    const timer = setInterval(verificar, INTERVALO_MS)

    const sub = supabase
      .channel('vistorias_alert_manager')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment_inspections' }, () => {
        verificar()
      })
      .subscribe()

    return () => {
      clearInterval(timer)
      sub.unsubscribe()
    }
  }, [])

  const fecharComunicado = () => {
    const hojeStr = format(new Date(), 'yyyy-MM-dd')
    localStorage.setItem('last_vistoria_comunicado_date', hojeStr)
    setModalAberto(false)
  }

  if (!modalAberto || alertasComunicado.length === 0) return null

  return (
    <div className="comunicado-overlay" role="dialog" aria-modal="true">
      <div className="comunicado flex flex-col max-h-[90vh]">
        <img src="/logo-relatorio.png" alt="Sucena" className="comunicado-logo" />

        <div className="comunicado-titulo">
          <span className="comunicado-icone" aria-hidden="true">
            ⚠️
          </span>
          <div className="min-w-0">
            <h2 className="m-0 p-0 text-[22px] font-[800] leading-tight text-[#111111]">
              Comunicado de Vistorias
            </h2>
            <p className="text-gray-500 font-semibold text-xs mt-0.5">
              Equipamentos com laudos e manutenções a vencer nos próximos 20 dias
            </p>
          </div>
        </div>

        <div className="comunicado-conteudo overflow-y-auto custom-scrollbar flex-1">
          <p className="text-gray-700 text-sm mb-3">
            Atenção equipe operacional e de manutenção: os seguintes equipamentos possuem vistorias
            com prazo limite de vencimento:
          </p>

          <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1 custom-scrollbar">
            {alertasComunicado.map((alerta, i) => {
              const isVencido = alerta.days < 0
              const isHoje = alerta.days === 0

              let badgeBg = 'bg-yellow-100 text-yellow-800 border-yellow-300'
              if (isVencido) badgeBg = 'bg-red-100 text-red-800 border-red-300'
              else if (isHoje) badgeBg = 'bg-orange-100 text-orange-800 border-orange-300'

              return (
                <div
                  key={`${alerta.eqId}_${alerta.docType}_${i}`}
                  className="flex items-center justify-between bg-amber-50/60 border border-amber-200/60 p-3 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#b8860b] text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <h4 className="font-bold text-[#111111] text-sm">
                        {alerta.eqName}{' '}
                        <span className="font-mono text-xs font-normal text-gray-500">
                          ({alerta.plateTag || 'S/ Placa'})
                        </span>
                      </h4>
                      <p className="text-xs text-gray-600 font-medium">
                        {alerta.docType} &bull; Vencimento: {fmtDataBr(alerta.expiry)}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${badgeBg}`}
                  >
                    {isVencido
                      ? `Vencido há ${Math.abs(alerta.days)}d`
                      : isHoje
                      ? 'Vence Hoje'
                      : `Faltam ${alerta.days}d`}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-sm">
            <span className="text-gray-500 font-medium">Total de alertas com &le; 20 dias:</span>
            <span className="font-bold text-lg text-[#b8860b]">{alertasComunicado.length}</span>
          </div>
        </div>

        <div className="comunicado-rodape">
          <div className="comunicado-acoes justify-end">
            <button
              type="button"
              onClick={fecharComunicado}
              className="comunicado-botao-entendi w-full sm:w-auto cursor-pointer"
            >
              Entendi
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
