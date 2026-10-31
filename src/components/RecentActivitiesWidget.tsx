import Clock from 'lucide-react/dist/esm/icons/clock.js';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import Hammer from 'lucide-react/dist/esm/icons/hammer.js';
import Users from 'lucide-react/dist/esm/icons/users.js';
import Wrench from 'lucide-react/dist/esm/icons/wrench.js';
import Package from 'lucide-react/dist/esm/icons/package.js';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js';
import MapPin from 'lucide-react/dist/esm/icons/map-pin.js';
import Activity from 'lucide-react/dist/esm/icons/activity.js';
import Eye from 'lucide-react/dist/esm/icons/eye.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import Search from 'lucide-react/dist/esm/icons/search.js';
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function getActivityAuthor(act: { module?: string; action?: string; user_name?: string }): string {
  const raw = act.user_name?.trim() || '';
  const isGeneric =
    !raw ||
    raw.toLowerCase() === 'sistema' ||
    raw.toLowerCase().startsWith('sistema') ||
    raw.toLowerCase() === 'usuario' ||
    raw.toLowerCase() === 'usuário' ||
    raw.toLowerCase() === 'usuario logado' ||
    raw.toLowerCase() === 'usuário logado';

  if (!isGeneric) {
    if (raw.includes('@')) {
      return raw.split('@')[0];
    }
    return raw;
  }

  const actionLower = (act.action || '').toLowerCase();
  const mod = act.module || '';

  if (
    mod === 'RDO' ||
    actionLower.includes('jardinagem') ||
    actionLower.includes('gabião') ||
    actionLower.includes('gabiao') ||
    actionLower.includes('rdo')
  ) {
    return 'Domingues Fabrício';
  }

  if (
    mod === 'RH' ||
    actionLower.includes('presença') ||
    actionLower.includes('presenca') ||
    actionLower.includes('efetivo')
  ) {
    return 'Creriane Alcantara';
  }

  if (
    mod === 'Segurança' ||
    actionLower.includes('análise de risco') ||
    actionLower.includes('analise de risco') ||
    actionLower.includes('dds') ||
    actionLower.includes('campanha') ||
    actionLower.includes('canteiro')
  ) {
    return 'Alexssandro Chaves';
  }

  if (
    mod === 'Almoxarifado' ||
    actionLower.includes('requisição') ||
    actionLower.includes('requisicao') ||
    actionLower.includes('pedido')
  ) {
    return 'Tiago Augusto';
  }

  if (mod === 'Equipamentos') {
    return 'Pedro Melo';
  }

  return 'Fabrício Silva';
}

export function RecentActivitiesWidget() {
  const [loading, setLoading] = useState(true)
  const [moduleFilter, setModuleFilter] = useState<string>('TODAS')
  const [allActivities, setAllActivities] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalSearch, setModalSearch] = useState('')
  const [modalModuleFilter, setModalModuleFilter] = useState('TODAS')

  const modules = ['TODAS', 'RDO', 'RH', 'Equipamentos', 'Almoxarifado', 'Segurança', 'Meio Ambiente']

  const fetchActivities = async () => {
    try {
      const environment = typeof window !== 'undefined'
        ? localStorage.getItem('sucena_environment') || 'barcarena'
        : 'barcarena'

      const [activitiesRes, movementsRes] = await Promise.all([
        supabase
          .from('system_activities')
          .select('id, module, action, user_name, created_at')
          .eq('environment', environment)
          .neq('module', 'System')
          .not('action', 'ilike', 'CRASH:%')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('eq_movements')
          .select('id, movement_type, created_by, created_at, eq_equipments!inner(name, plate_tag, environment)')
          .eq('eq_equipments.environment', environment)
          .order('created_at', { ascending: false })
          .limit(100)
      ])

      if (activitiesRes.error) {
        console.error('Erro ao buscar system_activities:', activitiesRes.error)
      }
      if (movementsRes.error) {
        console.error('Erro ao buscar eq_movements:', movementsRes.error)
      }

      const movementActivities = (movementsRes.data || []).map((movement: any) => {
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

      const loggedActivities = (activitiesRes.data || []).filter((activity: any) => {
        if (activity.module === 'System' || activity.action?.startsWith('CRASH:')) return false
        if (activity.module !== 'Equipamentos') return true
        return !/^(Entrada|Saída):/.test(activity.action || '')
      })

      const combined = [...loggedActivities, ...movementActivities]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setAllActivities(combined)
    } catch (err) {
      console.error('Erro ao buscar atividades do sistema:', err)
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isModalOpen])

  // Exibir exatamente 10 atividades no card do widget
  const filteredActivities = moduleFilter === 'TODAS'
    ? allActivities.slice(0, 10)
    : allActivities.filter(a => a.module === moduleFilter).slice(0, 10)

  // Filtragem da janela modal
  const modalActivities = allActivities.filter((act) => {
    const matchesModule = modalModuleFilter === 'TODAS' || act.module === modalModuleFilter
    if (!matchesModule) return false
    if (!modalSearch.trim()) return true
    const term = modalSearch.toLowerCase()
    const actionMatch = act.action?.toLowerCase().includes(term)
    const authorName = getActivityAuthor(act)
    const userMatch = authorName.toLowerCase().includes(term)
    const moduleMatch = act.module?.toLowerCase().includes(term)
    return actionMatch || userMatch || moduleMatch
  })

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

  const openModalWithModule = (module: string) => {
    setModalModuleFilter(module)
    setModalSearch('')
    setIsModalOpen(true)
  }

  return (
    <>
      <div className="bg-[#fffbeb] dark:bg-[#1c180e] border border-[#fde68a] dark:border-[#854d0e]/30 rounded-3xl p-6 flex flex-col h-full shadow-sm dark:shadow-2xl relative z-10 overflow-hidden transition-colors">
        <div className="flex items-center justify-between mb-4 relative z-10 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#5f6472] dark:text-gray-400" />
            <h2 className="text-xl font-semibold text-[#1c1d21] dark:text-white tracking-tight">Atividades recentes</h2>
          </div>
          
          <div className="flex items-center gap-2">
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="bg-white dark:bg-[#2a2a2b] border border-[#e5e7eb] dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm font-medium outline-none focus:border-[#0866ff] text-[#1c1d21] dark:text-gray-200"
            >
              {modules.map(mod => (
                <option key={mod} value={mod}>
                  {mod === 'TODAS' ? 'Exibir todas' : mod}
                </option>
              ))}
            </select>

            {/* Botão Ver mais com ícone */}
            <button
              type="button"
              onClick={() => openModalWithModule(moduleFilter)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#2a2a2b] hover:bg-amber-100/70 dark:hover:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/60 rounded-lg text-sm font-semibold transition-all shadow-xs cursor-pointer"
              title="Abrir janela com todas as atividades"
            >
              <Eye size={16} className="text-amber-700 dark:text-amber-400" />
              <span className="hidden sm:inline">Ver mais</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 flex-1 relative z-10">
          {loading ? (
            <div className="text-gray-600 dark:text-white/70 text-sm animate-pulse">Carregando atividades...</div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-gray-600 dark:text-white/70 text-sm">Nenhuma atividade encontrada.</div>
          ) : (
            filteredActivities.map(act => {
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
                    <p className="text-sm font-semibold text-[#1c1d21] dark:text-white truncate">
                      {act.action}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-white/70 truncate">
                      {act.module} • {getActivityAuthor(act)}
                    </p>
                  </div>
                  <div className="text-xs font-medium text-gray-500 dark:text-white/70 whitespace-nowrap pt-1">
                    {dateStr}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-amber-200/60 dark:border-slate-800/60 relative z-10 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-500 dark:text-white/60">
            Mostrando 10 atividades mais recentes
          </div>
          <button
            type="button"
            onClick={() => openModalWithModule(moduleFilter)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-100 hover:underline cursor-pointer group"
          >
            <span>Ver todas ({allActivities.length})</span>
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>

      {/* JANELA MODAL MOSTRANDO TODAS AS ATIVIDADES */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-3 sm:p-6 transition-all"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-[#151619] border border-gray-200 dark:border-white/10 rounded-3xl shadow-2xl flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header do Modal */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 dark:border-white/10 bg-gray-50/80 dark:bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  <Clock size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold text-[#1c1d21] dark:text-white">
                      Todas as Atividades do Sistema
                    </h2>
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50">
                      {allActivities.length} registradas
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Feed completo de registros do sistema em tempo real
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl hover:bg-gray-200/70 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors cursor-pointer"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Barra de Filtro e Busca */}
            <div className="p-4 sm:px-6 border-b border-gray-100 dark:border-white/10 bg-gray-50/40 dark:bg-transparent flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por descrição, usuário ou módulo..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-[#1f2024] border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-amber-500 text-gray-900 dark:text-white placeholder-gray-400 transition-colors"
                />
              </div>
              <select
                value={modalModuleFilter}
                onChange={(e) => setModalModuleFilter(e.target.value)}
                className="bg-white dark:bg-[#1f2024] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-amber-500 text-gray-900 dark:text-white"
              >
                {modules.map(mod => (
                  <option key={mod} value={mod}>
                    {mod === 'TODAS' ? 'Todos os módulos' : mod}
                  </option>
                ))}
              </select>
            </div>

            {/* Lista de Atividades do Modal */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 custom-scrollbar">
              {loading ? (
                <div className="flex justify-center items-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                </div>
              ) : modalActivities.length === 0 ? (
                <div className="text-center py-16 text-gray-500 dark:text-gray-400 text-sm">
                  Nenhuma atividade encontrada com os filtros selecionados.
                </div>
              ) : (
                modalActivities.map(act => {
                  let dateStr = 'Data inválida'
                  let exactDate = ''
                  try {
                    if (act.created_at) {
                      const d = new Date(act.created_at)
                      dateStr = formatDistanceToNow(d, { addSuffix: true, locale: ptBR })
                      exactDate = format(d, 'dd/MM/yyyy HH:mm')
                    }
                  } catch (e) {}

                  return (
                    <div
                      key={act.id}
                      className="flex items-start gap-3.5 p-3 sm:p-3.5 rounded-2xl hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors border border-gray-100/80 dark:border-white/5"
                    >
                      <div className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 ${getModuleBg(act.module)}`}>
                        {getModuleIcon(act.module)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1c1d21] dark:text-white leading-snug">
                          {act.action}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                          <span className="font-bold text-amber-700 dark:text-amber-400">{act.module}</span>
                          <span>•</span>
                          <span className="font-medium text-gray-800 dark:text-gray-200">{getActivityAuthor(act)}</span>
                          {exactDate && (
                            <>
                              <span>•</span>
                              <span>{exactDate}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-xs font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap pt-0.5 shrink-0">
                        {dateStr}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="p-4 sm:px-6 border-t border-gray-100 dark:border-white/10 bg-gray-50/80 dark:bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Feed de atividades em tempo real</span>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200/70 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
