import { createFileRoute } from '@tanstack/react-router'
import { useTheme } from '../../contexts/ThemeContext'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { Save } from 'lucide-react'

export const Route = createFileRoute('/meio-ambiente/caixa-dagua')({
  component: CaixaDaguaPage,
})

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

function CaixaDaguaPage() {
  const { isDark } = useTheme()
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState<Record<string, string>>({}) // key: 'YYYY-MM-W', value: string
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const setor = 'GERAL'

  useEffect(() => {
    fetchData()
  }, [year])

  const fetchData = async () => {
    setIsLoading(true)
    // Procurar por todos os registros desse ano
    const { data: dbData, error } = await supabase
      .from('caixa_dagua_registros')
      .select('data_registro, volume_litros')
      .like('data_registro', `${year}-%`)

    if (error) {
      console.error('Erro ao buscar dados:', error)
      toast.error('Erro ao carregar os dados.')
    } else if (dbData) {
      const map: Record<string, string> = {}
      dbData.forEach(row => {
        if (Number(row.volume_litros) !== 0) {
          map[row.data_registro] = String(row.volume_litros)
        }
      })
      setData(map)
    }
    setIsLoading(false)
  }

  const handleValueChange = (monthIdx: number, week: number, val: string) => {
    // Permitir apenas números, pontos e vírgulas
    if (!/^[\d.,]*$/.test(val)) return

    const monthStr = String(monthIdx + 1).padStart(2, '0')
    const dateKey = `${year}-${monthStr}-${week}`

    setData(prev => ({
      ...prev,
      [dateKey]: val
    }))
  }

  const saveAll = async () => {
    setIsSaving(true)
    const records = Object.entries(data).map(([dateKey, volStr]) => ({
      data_registro: dateKey,
      volume_litros: volStr === '' ? 0 : (parseFloat(volStr.replace(',', '.')) || 0),
      setor: setor
    }))

    if (records.length === 0) {
      setIsSaving(false)
      return toast.info('Não há dados para salvar.')
    }

    const { error } = await supabase
      .from('caixa_dagua_registros')
      .upsert(records, { onConflict: 'data_registro' })

    if (error) {
      console.error('Erro ao salvar:', error)
      toast.error('Erro ao salvar os registros.')
    } else {
      toast.success('Registros salvos com sucesso!')
    }
    setIsSaving(false)
  }

  // Calculate row totals and grand total
  const monthTotals = useMemo(() => {
    const totals = Array(12).fill(0)
    Object.entries(data).forEach(([dateKey, volStr]) => {
      if (!dateKey.startsWith(`${year}-`)) return
      const vol = parseFloat(volStr.replace(',', '.')) || 0
      const [, mStr] = dateKey.split('-')
      const mIdx = parseInt(mStr, 10) - 1
      totals[mIdx] += vol
    })
    return totals
  }, [data, year])

  const grandTotal = useMemo(() => {
    return monthTotals.reduce((acc, curr) => acc + curr, 0)
  }, [monthTotals])

  return (
    <div className={`-mx-4 md:-mx-12 lg:-mx-24 xl:-mx-32 min-h-screen flex flex-col justify-start relative transition-colors duration-300 ${isDark ? 'bg-[#0a0a0c]' : 'bg-[#f4f3f0]'}`}>
      
      <div className="max-w-[1200px] mx-auto w-full px-4 lg:px-16 pt-10 pb-20 relative z-10 flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-6">
          <div>
            <h1 className={`text-2xl lg:text-3xl font-bold tracking-tight uppercase flex items-center gap-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                 <span className="text-xl">💧</span>
              </div>
              GRÁFICO - ABASTECIMENTO CAIXA D'ÁGUA
            </h1>
          </div>
          
          <div className="flex items-center gap-6">
            <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>ANO {year}</h2>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button 
                  onClick={() => setYear(y => y - 1)}
                  className={`px-3 py-1 rounded font-bold text-sm border hover:bg-white/5 transition-colors ${isDark ? 'text-white border-white/20' : 'text-gray-900 border-black/20'}`}
                >
                  - ANO
                </button>
                <button 
                  onClick={() => setYear(y => y + 1)}
                  className={`px-3 py-1 rounded font-bold text-sm border hover:bg-white/5 transition-colors ${isDark ? 'text-white border-white/20' : 'text-gray-900 border-black/20'}`}
                >
                  + ANO
                </button>
              </div>
              <button 
                onClick={saveAll}
                disabled={isSaving}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>

        {/* Table Wrapper */}
        <div className="w-full overflow-hidden rounded-md border border-[#1a4b6d] shadow-2xl bg-[#0d0d0d] font-sans">
          {isLoading ? (
            <div className="flex justify-center items-center h-[400px]">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="w-full">
              <table className="w-full text-sm text-center border-collapse text-white">
                <thead>
                  <tr className="bg-[#1a4b6d]">
                    <th className="p-3 border-b border-r border-[#1a4b6d] font-bold text-left w-32">Mês</th>
                    <th className="p-3 border-b border-r border-[#1a4b6d] font-bold w-1/5">Sem 01</th>
                    <th className="p-3 border-b border-r border-[#1a4b6d] font-bold w-1/5">Sem 02</th>
                    <th className="p-3 border-b border-r border-[#1a4b6d] font-bold w-1/5">Sem 03</th>
                    <th className="p-3 border-b border-r border-[#1a4b6d] font-bold w-1/5">Sem 04</th>
                    <th className="p-3 border-b border-[#1a4b6d] font-bold w-32">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {MONTHS.map((monthName, mIdx) => {
                    const rowBg = mIdx % 2 === 0 ? 'bg-[#151515]' : 'bg-[#0d0d0d]'
                    return (
                      <tr key={monthName} className={`border-b border-[#1a4b6d]/30 transition-colors hover:bg-white/5 ${rowBg}`}>
                        <td className="p-3 border-r border-[#1a4b6d]/30 font-bold text-left whitespace-nowrap">
                          {monthName}
                        </td>
                        {[1, 2, 3, 4].map((week) => {
                          const dateKey = `${year}-${String(mIdx + 1).padStart(2, '0')}-${week}`
                          const valStr = data[dateKey] ?? ''
                          
                          return (
                            <td key={week} className="border-r border-[#1a4b6d]/30 p-0 relative">
                              <input 
                                type="text"
                                value={valStr}
                                onChange={(e) => handleValueChange(mIdx, week, e.target.value)}
                                className="w-full h-full p-3 bg-transparent text-center text-white outline-none focus:bg-white/10 transition-colors"
                                placeholder=""
                              />
                            </td>
                          )
                        })}
                        <td className="p-3 font-bold text-base">
                          {monthTotals[mIdx]}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="flex justify-end items-center p-4 bg-[#0a0a0c] border-t border-[#1a4b6d] gap-4">
                <span className="text-sm font-bold text-white/50 uppercase tracking-widest">
                  TOTAL ACUMULADO ANO (LITROS)
                </span>
                <span className="text-2xl font-bold text-[#1a4b6d]">
                  {grandTotal}
                </span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
