import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Clock, Wrench, ArrowRight } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function RecentActivitiesWidget() {
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('eq_movements')
        .select('*, eq_equipments(name, plate_tag)')
        .order('created_at', { ascending: false })
        .limit(4)
      
      if (error) throw error
      setActivities(data || [])
    } catch (err) {
      console.error('Error fetching activities:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActivities()

    const channel = supabase.channel('global_eq_movements')
      .on('broadcast', { event: 'eq_moved' }, () => {
        fetchActivities()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-slate-800/60 rounded-3xl p-6 flex flex-col h-full shadow-sm dark:shadow-2xl relative z-10 overflow-hidden transition-colors">
      <div className="flex items-center gap-2 mb-6 relative z-10">
        <Clock className="w-5 h-5 text-gray-400" />
        <h2 className="text-xl font-display font-semibold text-gray-900 dark:text-white tracking-tight">Atividades recentes</h2>
      </div>

      <div className="flex flex-col gap-5 flex-1 relative z-10">
        {loading ? (
          <div className="text-gray-500 dark:text-white/50 text-sm animate-pulse">Carregando atividades...</div>
        ) : activities.length === 0 ? (
          <div className="text-gray-500 dark:text-white/50 text-sm">Nenhuma atividade recente.</div>
        ) : (
          activities.map(act => {
            const isEntry = act.movement_type === 'entry'
            const eqName = act.eq_equipments?.name || 'Equipamento'
            const plate = act.eq_equipments?.plate_tag || 'S/ Placa'
            
            let dateStr = 'Data inválida'
            try {
              dateStr = formatDistanceToNow(new Date(act.created_at), { addSuffix: true, locale: ptBR })
            } catch (e) {}

            return (
              <div key={act.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Wrench className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-900 dark:text-white font-medium text-sm">
                      {isEntry ? 'Entrada:' : 'Saída:'} {eqName}
                    </span>
                    <span className="text-gray-500 dark:text-white/50 text-xs mt-0.5">
                      Placa {plate}
                    </span>
                  </div>
                </div>
                <div className="text-gray-400 dark:text-white/40 text-xs font-medium whitespace-nowrap">
                  {dateStr}
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/5 relative z-10">
        <Link to="/equipamentos/entrada-saida" className="text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white text-sm font-medium flex items-center gap-2 transition-colors inline-flex group">
          Ver todas atividades <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  )
}
