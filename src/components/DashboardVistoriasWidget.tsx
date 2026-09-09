import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import { AlertTriangle, Clock, ShieldAlert, ArrowRight, ShieldCheck } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'

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
  if (!dateString) return ''
  const [year, month, day] = dateString.split('-')
  return `${day}/${month}/${year}`
}

export function DashboardVistoriasWidget() {
  const { isDark } = useTheme()
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)

  const fetchInspections = async () => {
    try {
      const { data, error } = await supabase
        .from('eq_equipments')
        .select(`
          id, name, plate_tag,
          equipment_inspections (
            id, opacity_report_expiry, mechanical_report_expiry, maintenance_plan_expiry, tachograph_expiry
          )
        `)
      if (!error && data) {
        setEquipments(data)
      }
    } catch (err) {
      console.error('Error fetching vistorias for dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInspections()

    const sub = supabase
      .channel('dash_vistorias')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment_inspections' }, () => {
        fetchInspections()
      })
      .subscribe()

    return () => {
      sub.unsubscribe()
    }
  }, [])

  const alerts = useMemo(() => {
    const list: Array<{
      eq: Equipment,
      docType: string,
      expiry: string,
      days: number,
      priority: number // 0 for expired, 1 for expires today, 2 for 1-10 days
    }> = []

    equipments.forEach(eq => {
      const ins = Array.isArray(eq.equipment_inspections) ? eq.equipment_inspections[0] : eq.equipment_inspections
      if (!ins) return

      const docs = [
        { type: 'Laudo Opacidade', expiry: ins.opacity_report_expiry },
        { type: 'Laudo Mecânico', expiry: ins.mechanical_report_expiry },
        { type: 'Plano Manutenção', expiry: ins.maintenance_plan_expiry },
        { type: 'Tacógrafo', expiry: ins.tachograph_expiry }
      ]

      docs.forEach(doc => {
        if (!doc.expiry) return
        const days = getDaysRemaining(doc.expiry)
        if (days !== null && days <= 10) {
          let priority = 2
          if (days < 0) priority = 0
          else if (days === 0) priority = 1

          list.push({
            eq,
            docType: doc.type,
            expiry: doc.expiry,
            days,
            priority
          })
        }
      })
    })

    // Sort by priority (0 first), then by days ascending
    return list.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return a.days - b.days
    })
  }, [equipments])

  if (loading) {
    return (
      <Card className="flex flex-col overflow-hidden shadow-md h-full">
        <CardHeader className="pb-2 border-b border-border/50">
          <CardTitle className="text-[10px] uppercase tracking-widest flex items-center gap-2">
            <ShieldAlert size={14} className="text-muted-foreground" /> 
            Vistorias Próximas do Vencimento
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-6 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </CardContent>
      </Card>
    )
  }

  // If no alerts, don't fill the page with empty state, just show a minimal card
  if (alerts.length === 0) {
    return (
      <Card className="flex flex-col overflow-hidden shadow-md h-full bg-white/40 dark:bg-black/20">
        <CardHeader className="pb-2 border-b border-border/50">
          <CardTitle className="text-[10px] uppercase tracking-widest flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-green-500" /> 
              Vistorias da Frota
            </div>
            <Link to="/equipamentos/vistoria" className="hover:text-primary transition-colors">Ver todas &rarr;</Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-6 flex flex-col items-center justify-center text-center opacity-70">
          <ShieldCheck size={32} className="mb-2 text-green-500 opacity-50" />
          <p className="text-sm font-medium">Nenhuma vistoria próxima do vencimento.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col overflow-hidden shadow-md h-full">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex justify-between items-center">
          <CardTitle className="text-[10px] uppercase tracking-widest flex items-center gap-2">
            <ShieldAlert size={14} className="text-yellow-500" /> 
            Vistorias a Vencer
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 px-2 py-0.5 rounded-full">
              {alerts.length}
            </span>
            <Link to="/equipamentos/vistoria" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors">
              Ver tudo &rarr;
            </Link>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 overflow-hidden flex flex-col max-h-[400px]">
        <div className="overflow-y-auto custom-scrollbar p-4 space-y-3">
          {alerts.map((alert, idx) => {
            const isExpired = alert.days < 0
            const isToday = alert.days === 0
            
            let colorClasses = isDark ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' : 'bg-yellow-50 border-yellow-200 text-yellow-700'
            if (isExpired) colorClasses = isDark ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-red-50 border-red-200 text-red-700'
            else if (isToday) colorClasses = isDark ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' : 'bg-orange-50 border-orange-200 text-orange-700'

            return (
              <div key={idx} className={`rounded-xl border p-4 shadow-sm flex flex-col gap-3 ${colorClasses}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {isExpired ? <AlertTriangle size={16} /> : <Clock size={16} />}
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {isExpired ? 'Vencido' : isToday ? 'Vence Hoje' : 'Próxima do Vencimento'}
                    </span>
                  </div>
                  <Link 
                    to="/equipamentos/vistoria"
                    className="text-[10px] font-bold uppercase flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
                  >
                    Ver <ArrowRight size={12} />
                  </Link>
                </div>
                
                <div>
                  <div className="font-bold text-lg leading-tight">{alert.eq.name}</div>
                  <div className="font-mono text-xs uppercase opacity-70">{alert.eq.plate_tag}</div>
                </div>

                <div className="flex items-end justify-between border-t border-current/10 pt-3 mt-1">
                  <div>
                    <div className="text-xs font-semibold opacity-90">{alert.docType}</div>
                    <div className="text-xs opacity-70 mt-0.5">Vencimento: {formatDateBr(alert.expiry)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs opacity-70 mb-0.5">{isExpired ? 'Vencido há' : 'Faltam'}</div>
                    <div className="font-bold font-display text-lg leading-none">
                      {Math.abs(alert.days)} {Math.abs(alert.days) === 1 ? 'dia' : 'dias'}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
