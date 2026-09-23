import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Clock, MapPin, AlertCircle, History } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

interface EquipmentHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  vehicleId: string
  vehicleName: string
}

export function EquipmentHistoryModal({ isOpen, onClose, vehicleId, vehicleName }: EquipmentHistoryModalProps) {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOpen || !vehicleId) return

    const fetchHistory = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('eq_status_history')
        .select('*')
        .eq('equipment_id', vehicleId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setHistory(data)
      }
      setLoading(false)
    }

    fetchHistory()
  }, [isOpen, vehicleId])

  if (!isOpen) return null

  // Agrupar por data
  const groupedHistory = history.reduce((acc: any, item: any) => {
    const date = format(new Date(item.created_at), 'dd/MM/yyyy')
    if (!acc[date]) acc[date] = []
    acc[date].push(item)
    return acc
  }, {})

  return createPortal(
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 sm:p-6 transition-opacity"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col transform transition-all relative overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <History size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Histórico Completo</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{vehicleName}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-gray-50/30 dark:bg-transparent">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              Nenhum histórico encontrado para este equipamento.
            </div>
          ) : (
            <div className="space-y-8">
              {Object.keys(groupedHistory).map((date) => (
                <div key={date}>
                  <div className="sticky top-0 z-10 -mx-4 px-4 py-2 sm:-mx-6 sm:px-6 bg-gray-50/90 dark:bg-[#121214]/90 backdrop-blur-sm">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-full px-4 py-1 inline-block shadow-sm">
                      {date}
                    </h3>
                  </div>
                  <div className="mt-4 relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 dark:before:via-zinc-700 before:to-transparent">
                    {groupedHistory[date].map((item: any, idx: number) => {
                      const isStatusChange = item.new_status !== item.previous_status;
                      const hasLocation = item.latitude && item.longitude;
                      
                      return (
                        <div key={item.id} className="relative flex items-start gap-4 group">
                          <div className={`absolute -left-[28px] mt-1 h-3 w-3 rounded-full border-2 ${
                            item.new_status?.toLowerCase().includes('jornada') ? 'border-green-500 bg-white dark:bg-black' :
                            item.new_status?.toLowerCase().includes('anomalia') ? 'border-red-500 bg-white dark:bg-black' :
                            item.new_status?.toLowerCase().includes('manuten') ? 'border-orange-500 bg-white dark:bg-black' :
                            'border-indigo-500 bg-white dark:bg-black'
                          } transition-colors group-hover:scale-125 z-10 ring-4 ring-gray-50 dark:ring-[#121214]`} />
                          
                          <div className="flex-1 bg-white dark:bg-zinc-800/50 rounded-xl p-3 sm:p-4 border border-gray-100 dark:border-zinc-700/50 shadow-sm hover:border-indigo-500/30 dark:hover:border-indigo-500/30 transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-bold text-gray-900 dark:text-white">
                                {item.new_status || 'Status Atualizado'}
                              </span>
                              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 font-medium bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                                <Clock size={12} />
                                {format(new Date(item.created_at), 'HH:mm')}
                              </span>
                            </div>
                            
                            {isStatusChange && item.previous_status && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Status anterior: <span className="line-through opacity-70">{item.previous_status}</span>
                              </p>
                            )}
                            
                            {item.observation && (
                              <div className="mt-2 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 p-2 rounded-lg flex gap-2">
                                <AlertCircle size={14} className="text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-yellow-800 dark:text-yellow-200/80">{item.observation}</p>
                              </div>
                            )}

                            {hasLocation && (
                              <div className="mt-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                <MapPin size={12} />
                                <a 
                                  href={`https://maps.google.com/?q=${item.latitude},${item.longitude}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="hover:underline"
                                >
                                  Ver Localização
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
