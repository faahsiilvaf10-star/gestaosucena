import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Clock, ArrowRight, Hammer, Users, Wrench, Package, ShieldCheck, MapPin, Activity } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function RecentActivitiesWidget() {
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchActivities = async () => {
    try {
      const environment = typeof window !== 'undefined'
        ? localStorage.getItem('sucena_environment') || 'barcarena'
        : 'barcarena'

      const { data, error } = await supabase
        .from('system_activities').select('id, module, action, user_name, created_at').eq('environment', environment)
        .order('created_at', { ascending: false })
        .limit(12)

      const { data: movements, error: movementsError } = await supabase
        .from('eq_movements')
        .select('id, movement_type, created_by, created_at, eq_equipments!inner(name, plate_tag, environment)')
        .eq('eq_equipments.environment', environment)
        .order('created_at', { ascending: false })
        .limit(6)
      
      if (error) throw error
      if (movementsError) throw movementsError

      const movementActivities = (movements || []).map((movement: any) => {
        const equipment = movement.eq_equipments
        const equipmentName = equipment?.name || 'Equipamento'
        const plate = equipment?.plate_tag ? ` (Placa: ${equipment.plate_tag})` : ''
        const isEntry = movement.movement_type === 'entry'

        return {
          id: `movement-${movement.id}`,
          module: 'Equipamentos',
          action: `${isEntry ? 'Entrada' : 'Saída'}: ${equipmentName}${plate}`,
          user_name: movement.created_by,
          created_at: movement.created_at,
          movement_id: movement.id,
        }
      })

      const loggedActivities = (data || []).filter((activity: any) => {
        if (activity.module !== 'Equipamentos') return true
        return !/^(Entrada|Saída):/.test(activity.action || '')
      })

      setActivities(
        [...loggedActivities, ...movementActivities]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 6)
      )
    } catch (err) {
      console.error('Error fetching system activities:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActivities()

    const channel = supabase.channel('global_system_activities')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_activities' }, () => {
        fetchActivities()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'eq_movements' }, () => {
        fetchActivities()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const getModuleIcon = (module: string) => {
    switch (module) {
      case 'RDO': return <Hammer size={16} className="text-orange-600" />;
      case 'RH': return <Users size={16} className="text-blue-600" />;
      case 'Equipamentos': return <Wrench size={16} className="text-teal-600" />;
      case 'Almoxarifado': return <Package size={16} className="text-indigo-600" />;
      case 'Segurança': return <ShieldCheck size={16} className="text-red-600" />;
      case 'Meio Ambiente': return <MapPin size={16} className="text-green-600" />;
      default: return <Activity size={16} className="text-gray-600" />;
    }
  }

  const getModuleBg = (module: string) => {
    switch (module) {
      case 'RDO': return 'bg-orange-100 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/50';
      case 'RH': return 'bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50';
      case 'Equipamentos': return 'bg-teal-100 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800/50';
      case 'Almoxarifado': return 'bg-indigo-100 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/50';
      case 'Segurança': return 'bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800/50';
      case 'Meio Ambiente': return 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800/50';
      default: return 'bg-gray-100 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800/50';
    }
  }

  return (
    <div className="bg-[#fffbeb] dark:bg-[#1c180e] border border-[#fde68a] dark:border-[#854d0e]/30 rounded-3xl p-6 flex flex-col h-full shadow-sm dark:shadow-2xl relative z-10 overflow-hidden transition-colors">
      <div className="flex items-center gap-2 mb-6 relative z-10">
        <Clock className="w-5 h-5 text-gray-400" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">Atividades recentes</h2>
      </div>

      <div className="flex flex-col gap-4 flex-1 relative z-10">
        {loading ? (
          <div className="text-gray-500 dark:text-white/50 text-sm animate-pulse">Carregando atividades...</div>
        ) : activities.length === 0 ? (
          <div className="text-gray-500 dark:text-white/50 text-sm">Nenhuma atividade recente.</div>
        ) : (
          activities.map(act => {
            let dateStr = 'Data inválida'
            try {
              if (act.created_at) {
                dateStr = formatDistanceToNow(new Date(act.created_at), { addSuffix: true, locale: ptBR })
              }
            } catch (e) {}

            return (
              <div key={act.id} className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 ${getModuleBg(act.module)}`}>
                  {getModuleIcon(act.module)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {act.action}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-white/50 truncate">
                    {act.module} {act.user_name && `• ${act.user_name.includes('@') ? act.user_name.split('@')[0] : act.user_name}`}
                  </p>
                </div>
                <div className="text-xs font-medium text-gray-400 dark:text-white/40 whitespace-nowrap pt-1">
                  {dateStr}
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800/60 relative z-10">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white transition-colors">
          As atividades de todo o sistema aparecem aqui em tempo real.
        </div>
      </div>
    </div>
  )
}
