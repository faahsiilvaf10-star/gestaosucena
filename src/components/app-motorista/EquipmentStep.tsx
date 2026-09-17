import { useState, useEffect } from 'react'
import { Search, Truck, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import MercosulPlate from './MercosulPlate'

export default function EquipmentStep({ onSelect, onBack }: { onSelect: (equipmentId: string) => void, onBack?: () => void }) {
  const [equipments, setEquipments] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEquipments()
  }, [])

  const fetchEquipments = async () => {
    try {
      const { data, error } = await supabase
        .from('eq_equipments').select('*').eq('environment', typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena')
        .eq('category', 'Equipamento Pesado')
        .order('name', { ascending: true })
      
      if (error) throw error
      setEquipments(data || [])
    } catch (err) {
      console.error('Error fetching equipments', err)
    } finally {
      setLoading(false)
    }
  }

  const lastEquipmentId = localStorage.getItem('app_motorista_last_equipment')

  const filteredEq = equipments.filter(eq => 
    (eq.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (eq.plate_tag || '').toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => {
    if (a.id === lastEquipmentId) return -1
    if (b.id === lastEquipmentId) return 1
    return 0
  })

  const handleSelect = (eq: any) => {
    if (eq.status === 'Manutenção' || eq.status === 'Interditado') {
      alert('Equipamento indisponível para operação.')
      return
    }
    // TODO: Verify if another driver is using this equipment today
    
    // Save to local storage for the wizard flow
    localStorage.setItem('app_motorista_equipment_id', eq.id)
    onSelect(eq.id)
  }

  const getStatusColor = (status: string) => {
    if (status === 'Disponível') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200'
    if (status === 'Operando') return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-blue-200'
    if (status === 'Manutenção') return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-red-200'
    if (status === 'Interditado') return 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400 border-gray-300'
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400 border-yellow-200'
  }

  const getStatusDot = (status: string) => {
    if (status === 'Disponível') return 'bg-emerald-500'
    if (status === 'Operando') return 'bg-blue-500'
    if (status === 'Manutenção') return 'bg-red-500'
    if (status === 'Interditado') return 'bg-gray-500'
    return 'bg-yellow-500'
  }

  return (
    <div className="min-h-full flex flex-col p-6 bg-gray-50 dark:bg-zinc-950">
      
      <div className="mb-6">
        <button onClick={onBack} className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4 flex items-center gap-1 active:opacity-70">
          &larr; Voltar
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">SELECIONE O <br/> EQUIPAMENTO</h1>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Pesquisar equipamento, prefixo ou placa"
          className="w-full h-14 pl-12 pr-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm text-base font-medium"
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-12 custom-scrollbar">
        {loading ? (
          <div className="text-center py-10 text-gray-500">Buscando equipamentos...</div>
        ) : filteredEq.length === 0 ? (
          <div className="text-center py-10 text-gray-500">Nenhum equipamento encontrado.</div>
        ) : (
          filteredEq.map(eq => (
            <button
              key={eq.id}
              onClick={() => handleSelect(eq)}
              className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-all text-left flex items-start gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                <Truck className="text-gray-500 dark:text-gray-400" size={24} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 min-w-0">
                    <span className="truncate">{eq.name}</span>
                    {eq.id === lastEquipmentId && (
                      <span className="flex-shrink-0 text-[10px] uppercase font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-800">
                        Recomendado
                      </span>
                    )}
                  </h3>
                  <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold ${getStatusColor(eq.status)}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(eq.status)}`}></span>
                    {eq.status || 'Disponível'}
                  </span>
                </div>
                
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 truncate">
                  {eq.type || 'Equipamento'}
                </p>
                
                <div className="flex items-center gap-2 mt-2">
                  <MercosulPlate plate={eq.plate_tag} />
                </div>

                {(eq.status === 'Manutenção' || eq.status === 'Interditado') && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
                    <AlertTriangle size={14} />
                    Necessita autorização administrativa
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </div>

    </div>
  )
}
