import React, { useState, useEffect, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import { ShieldAlert, AlertTriangle, ArrowRight, Clock, CheckCircle2 } from 'lucide-react'

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
  category?: string
  equipment_inspections?: EquipmentInspection | EquipmentInspection[] | null
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

function formatDateBr(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  const [year, month, day] = dateString.split('-')
  return `${day}/${month}/${year}`
}

export function DashboardVistoriasBanner() {
  const { isDark } = useTheme()
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = async () => {
    try {
      const env =
        typeof window !== 'undefined'
          ? localStorage.getItem('sucena_environment') || 'barcarena'
          : 'barcarena'

      const { data, error } = await supabase
        .from('eq_equipments')
        .select(`
          id, name, plate_tag, category,
          equipment_inspections (
            id, opacity_report_expiry, mechanical_report_expiry, maintenance_plan_expiry, tachograph_expiry
          )
        `)
        .or(`environment.eq.${env},environment.is.null`)
        .or('category.neq.Jardinagem,category.is.null')

      if (!error && data) {
        setEquipments(data)
      }
    } catch (err) {
      console.warn('[DashboardVistoriasBanner] Erro ao carregar vistorias:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()

    const sub = supabase
      .channel('dash_vistorias_banner')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment_inspections' }, () => {
        carregar()
      })
      .subscribe()

    return () => {
      sub.unsubscribe()
    }
  }, [])

  const alerts = useMemo(() => {
    const list: Array<{
      eq: Equipment
      docType: string
      expiry: string
      days: number
      priority: number // 0 = vencido, 1 = vence hoje, 2 = até 20 dias
    }> = []

    equipments.forEach((eq) => {
      const ins = Array.isArray(eq.equipment_inspections)
        ? eq.equipment_inspections[0]
        : eq.equipment_inspections
      if (!ins) return

      const docs = [
        { type: 'Laudo de Opacidade', expiry: ins.opacity_report_expiry },
        { type: 'Laudo Mecânico', expiry: ins.mechanical_report_expiry },
        { type: 'Plano de Manutenção', expiry: ins.maintenance_plan_expiry },
        { type: 'Tacógrafo / ART', expiry: ins.tachograph_expiry },
      ]

      docs.forEach((doc) => {
        if (!doc.expiry) return
        const days = getDaysRemaining(doc.expiry)
        if (days !== null && days <= 20) {
          let priority = 2
          if (days < 0) priority = 0
          else if (days === 0) priority = 1

          list.push({
            eq,
            docType: doc.type,
            expiry: doc.expiry,
            days,
            priority,
          })
        }
      })
    })

    return list.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return a.days - b.days
    })
  }, [equipments])

  if (loading || alerts.length === 0) {
    return null
  }

  const vencidosCount = alerts.filter((a) => a.days < 0).length
  const vencerHojeCount = alerts.filter((a) => a.days === 0).length
  const proximosCount = alerts.filter((a) => a.days > 0).length

  return (
    <div
      className={`rounded-2xl border p-4 md:p-5 shadow-sm transition-all mb-4 ${
        vencidosCount > 0
          ? isDark
            ? 'bg-gradient-to-r from-red-950/40 via-red-900/20 to-red-950/40 border-red-500/40'
            : 'bg-gradient-to-r from-red-50 via-amber-50/50 to-red-50 border-red-300'
          : isDark
          ? 'bg-gradient-to-r from-amber-950/40 via-yellow-900/20 to-amber-950/40 border-amber-500/40'
          : 'bg-gradient-to-r from-amber-50 via-yellow-50/60 to-amber-50 border-amber-300'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-black/5 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
              vencidosCount > 0
                ? 'bg-red-500 text-white'
                : 'bg-amber-500 text-white'
            }`}
          >
            <ShieldAlert size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base md:text-lg leading-tight text-[#1c1d21] dark:text-white">
                Vistorias e Laudos de Equipamentos a Vencer
              </h3>
              <span
                className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                  vencidosCount > 0
                    ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 border border-red-300 dark:border-red-800'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                }`}
              >
                {alerts.length} {alerts.length === 1 ? 'pendência' : 'pendências'}
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
              Equipamentos com laudo vencendo nos próximos <strong>20 dias</strong> ou já expirados:
            </p>
          </div>
        </div>

        <Link
          to="/equipamentos/vistoria"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#0866ff] hover:bg-blue-600 text-white transition-colors shadow-sm self-start md:self-auto cursor-pointer"
        >
          <span>Abrir Controle de Vistorias</span>
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* Grid com os equipamentos pendentes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
        {alerts.map((alerta, idx) => {
          const isVencido = alerta.days < 0
          const isHoje = alerta.days === 0

          return (
            <div
              key={`${alerta.eq.id}_${alerta.docType}_${idx}`}
              className={`p-3 rounded-xl border flex flex-col justify-between gap-2 transition-transform hover:scale-[1.01] ${
                isVencido
                  ? isDark
                    ? 'bg-red-950/30 border-red-500/30 text-red-300'
                    : 'bg-red-50 border-red-200 text-red-900'
                  : isHoje
                  ? isDark
                    ? 'bg-orange-950/30 border-orange-500/30 text-orange-300'
                    : 'bg-orange-50 border-orange-200 text-orange-900'
                  : isDark
                  ? 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                  : 'bg-amber-50/80 border-amber-200 text-amber-900'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm leading-tight text-[#111] dark:text-white">
                    {alerta.eq.name}{' '}
                    <span className="font-mono text-xs font-semibold opacity-75">
                      ({alerta.eq.plate_tag || 'S/ Placa'})
                    </span>
                  </h4>
                  <p className="text-xs font-semibold opacity-90 mt-0.5">
                    {alerta.docType}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                    isVencido
                      ? 'bg-red-200 text-red-800 border-red-300 dark:bg-red-900/60 dark:text-red-200'
                      : isHoje
                      ? 'bg-orange-200 text-orange-800 border-orange-300 dark:bg-orange-900/60 dark:text-orange-200'
                      : 'bg-amber-200 text-amber-900 border-amber-300 dark:bg-amber-900/60 dark:text-amber-200'
                  }`}
                >
                  {isVencido
                    ? `Vencido há ${Math.abs(alerta.days)}d`
                    : isHoje
                    ? 'Vence Hoje'
                    : `Faltam ${alerta.days}d`}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-current/10 opacity-80">
                <span>Vencimento:</span>
                <span className="font-mono font-bold">{formatDateBr(alerta.expiry)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

