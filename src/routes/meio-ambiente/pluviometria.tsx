import { createFileRoute } from '@tanstack/react-router'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { useTheme } from '../../contexts/ThemeContext'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { Save, Download } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export const Route = createFileRoute('/meio-ambiente/pluviometria')({
  component: PluviometriaPage,
})

const MONTHS = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
]

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function PluviometriaPage() {
  const { isDark } = useTheme()
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState<Record<string, string>>({}) // key: 'YYYY-MM-DD', value: string
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const setor = 'CAMPO'

  useEffect(() => {
    fetchData()
  }, [year])

  const fetchData = async () => {
    setIsLoading(true)
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`
    
    const { data: dbData, error } = await supabase
      .from('pluviometria_registros')
      .select('data_registro, volume_mm')
      .gte('data_registro', startDate)
      .lte('data_registro', endDate)
      .eq('setor', setor)

    if (error) {
      console.error('Erro ao buscar dados:', error)
      toast.error('Erro ao carregar os dados de pluviometria.')
    } else if (dbData) {
      const map: Record<string, string> = {}
      dbData.forEach(row => {
        // Agora aceitamos o 0 explícito!
        map[row.data_registro] = String(row.volume_mm)
      })
      setData(map)
    }
    setIsLoading(false)
  }

  const handleValueChange = (monthIdx: number, day: number, val: string) => {
    // Permitir apenas números, pontos e vírgulas
    if (!/^[\d.,]*$/.test(val)) return

    const monthStr = String(monthIdx + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    const dateKey = `${year}-${monthStr}-${dayStr}`

    setData(prev => ({
      ...prev,
      [dateKey]: val
    }))
  }

  const saveAll = async () => {
    setIsSaving(true)
    
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`
    
    // 1. Buscar todos os registros do ano para mapear os IDs e limpar duplicatas
    const { data: existingRecords } = await supabase
      .from('pluviometria_registros')
      .select('id, data_registro')
      .gte('data_registro', startDate)
      .lte('data_registro', endDate)
      .eq('setor', setor)

    const idMap = new Map<string, number>()
    const duplicatesToDelete: number[] = []

    if (existingRecords) {
      existingRecords.forEach(r => {
        if (idMap.has(r.data_registro)) {
          duplicatesToDelete.push(r.id)
        } else {
          idMap.set(r.data_registro, r.id)
        }
      })
    }

    // 2. Deletar duplicatas se existirem
    if (duplicatesToDelete.length > 0) {
      await supabase.from('pluviometria_registros').delete().in('id', duplicatesToDelete)
    }

    const toUpdate: any[] = []; const toInsert: any[] = [];
    const toDelete: string[] = []

    Object.entries(data).forEach(([date, volStr]) => {
      const cleanVal = volStr.trim()
      if (cleanVal === '') {
        toDelete.push(date)
      } else {
        const parsed = parseFloat(cleanVal.replace(',', '.'))
        const record: any = {
          data_registro: date,
          volume_mm: isNaN(parsed) ? 0 : parsed,
          setor: setor
        }
        if (idMap.has(date)) {
          record.id = idMap.get(date)
        }
        if (record.id) { toUpdate.push(record) } else { toInsert.push(record) }
      }
    })

    let hasError = false
    let errorMsg = ''

    if (toDelete.length > 0) {
      const { error } = await supabase
        .from('pluviometria_registros')
        .delete()
        .in('data_registro', toDelete)
        .eq('setor', setor)
      
      if (error) {
        console.error('Erro ao deletar vazios:', error)
        hasError = true
        errorMsg = error.message
      }
    }

    if (toUpsert.length > 0) {
      const { error } = await supabase
        .from('pluviometria_registros')
        .upsert(toUpsert) // Sem onConflict, pois estamos passando o ID se existir

      if (error) {
        console.error('Erro ao salvar:', error)
        hasError = true
        errorMsg = error.message
      }
    }

    if (hasError) {
      toast.error(`Erro ao salvar: ${errorMsg}`)
    } else {
      toast.success('Registros salvos com sucesso!')
    }
    
    // Forçar atualização do estado local com o que realmente está no banco
    await fetchData()
    
    setIsSaving(false)
  }

  // Calculate row totals and grand total
  const monthTotals = useMemo(() => {
    const totals = Array(12).fill(0)
    Object.entries(data).forEach(([date, volStr]) => {
      if (!date.startsWith(`${year}-`)) return
      const vol = parseFloat(volStr.replace(',', '.')) || 0
      const [, mStr] = date.split('-')
      const mIdx = parseInt(mStr, 10) - 1
      totals[mIdx] += vol
    })
    return totals
  }, [data, year])

  const grandTotal = useMemo(() => {
    return monthTotals.reduce((acc, curr) => acc + curr, 0)
  }, [monthTotals])

  const chartData = useMemo(() => {
    return MONTHS.map((month, idx) => ({
      name: month.substring(0, 3), // JAN, FEV...
      precipitacao: monthTotals[idx]
    }))
  }, [monthTotals])

  const generatePDF = async () => {
    const doc = new jsPDF('landscape', 'mm', 'a4')

    const createDocument = (logoImg?: HTMLImageElement) => {
      // Configurações do cabeçalho
      doc.setFontSize(16)
      doc.text('Relatório de Controle de Precipitação', 14, 25)
      
      doc.setFontSize(10)
      doc.text(`Setor: ${setor}`, 14, 32)
      doc.text(`Ano: ${year}`, 14, 37)
      doc.text(`Total Anual Acumulado: ${grandTotal} mm`, 14, 42)

      if (logoImg) {
        try {
          doc.addImage(logoImg, 'PNG', 240, 12, 40, 15)
        } catch (e) {
          console.warn('Não foi possível adicionar a logo', e)
        }
      }

      const head = [['MÊS/DIA', ...Array.from({ length: 31 }).map((_, i) => String(i + 1)), 'TOTAL']]

      const body = MONTHS.map((month, mIdx) => {
        const daysInMonth = getDaysInMonth(year, mIdx)
        const row: any[] = [month]

        for (let day = 1; day <= 31; day++) {
          if (day > daysInMonth) {
            row.push({ content: '', styles: { fillColor: [200, 200, 200] } })
          } else {
            const dateKey = `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const valStr = data[dateKey] ?? ''
            
            let fillColor = [255, 255, 255] // Default
            if (valStr !== '') {
              const num = parseFloat(valStr.replace(',', '.')) || 0
              if (num === 0) fillColor = [220, 38, 38] // red-600
              else if (num > 0) fillColor = [22, 163, 74] // green-600
            }
            
            row.push({ 
              content: valStr !== '' && (parseFloat(valStr.replace(',', '.')) || 0) > 0 ? valStr : '',
              styles: { fillColor, textColor: fillColor[0] === 255 ? [0, 0, 0] : [255, 255, 255] }
            })
          }
        }
        // Total mensal
        row.push({ content: String(monthTotals[mIdx]), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } })
        
        return row
      })

      autoTable(doc, {
        startY: 50,
        head: head,
        body: body,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [21, 128, 61], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { halign: 'left', cellWidth: 20, fontStyle: 'bold' }
        }
      })

      doc.save(`Pluviometria_${setor}_${year}.pdf`)
    }

    const img = new Image()
    img.onload = () => createDocument(img)
    img.onerror = () => createDocument()
    img.src = '/logo-relatorio.png'
  }

  return (
    <div className={`-mx-4 md:-mx-12 lg:-mx-24 xl:-mx-32 min-h-screen overflow-hidden flex flex-col justify-start relative transition-colors duration-300 ${isDark ? 'bg-[#0a0a0c] text-white' : 'bg-[#f4f3f0] text-gray-900'}`}>
      
      <div className="max-w-[1600px] mx-auto w-full px-4 lg:px-16 pt-10 pb-20 relative z-10 flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight uppercase">Planilha de Controle de Precipitação</h1>
            <div className="flex gap-4 mt-4">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold uppercase ${isDark ? 'text-green-500' : 'text-green-700'}`}>SETOR</span>
                <span className={`text-sm font-bold border px-3 py-1 rounded ${isDark ? 'border-white/20' : 'border-black/20'}`}>{setor}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold uppercase ${isDark ? 'text-green-500' : 'text-green-700'}`}>PERÍODO</span>
                <span className={`text-sm font-bold border px-3 py-1 rounded ${isDark ? 'border-white/20' : 'border-black/20'}`}>08:00H ÀS 08:00H</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <h2 className="text-3xl font-bold">ANO {year}</h2>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button 
                  onClick={() => setYear(y => y - 1)}
                  className={`px-3 py-1 rounded font-bold text-sm border hover:bg-white/5 transition-colors ${isDark ? 'border-white/20' : 'border-black/20'}`}
                >
                  - ANO
                </button>
                <button 
                  onClick={() => setYear(y => y + 1)}
                  className={`px-3 py-1 rounded font-bold text-sm border hover:bg-white/5 transition-colors ${isDark ? 'border-white/20' : 'border-black/20'}`}
                >
                  + ANO
                </button>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={generatePDF}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded flex items-center justify-center gap-2 transition-colors shadow-lg"
                  title="Baixar Relatório em PDF"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button 
                  onClick={saveAll}
                  disabled={isSaving}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="w-full overflow-x-auto rounded-xl border border-white/10 shadow-2xl bg-black/40 backdrop-blur-md">
          {isLoading ? (
            <div className="flex justify-center items-center h-[400px]">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
            </div>
          ) : (
            <div style={{ minWidth: '1000px' }}>
              <table className="w-full text-xs font-bold text-center border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 border-b border-r border-white/20 bg-green-700/80 text-white uppercase text-left w-24">MÊS/DIA</th>
                    {Array.from({ length: 31 }).map((_, i) => (
                      <th key={i} className="p-2 border-b border-r border-white/20 bg-green-700/80 text-white w-8">
                        {i + 1}
                      </th>
                    ))}
                    <th className="p-2 border-b border-white/20 bg-green-700/80 text-white w-20 leading-tight">TOTAL<br/>MENSAL</th>
                  </tr>
                </thead>
                <tbody>
                  {MONTHS.map((monthName, mIdx) => {
                    const daysInMonth = getDaysInMonth(year, mIdx)
                    return (
                      <tr key={monthName} className="border-b border-white/10">
                        <td className="p-2 border-r border-white/20 text-left bg-black/60 text-white">
                          {monthName}
                        </td>
                        {Array.from({ length: 31 }).map((_, dIdx) => {
                          const day = dIdx + 1
                          if (day > daysInMonth) {
                            return <td key={day} className="border-r border-white/20 bg-black/80"></td>
                          }
                          const dateKey = `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                          const valStr = data[dateKey] ?? ''
                          
                          let bgColor = 'bg-transparent hover:bg-white/5' // Vazio
                          if (valStr !== '') {
                            const numericVal = parseFloat(valStr.replace(',', '.')) || 0
                            if (numericVal === 0) {
                              bgColor = 'bg-red-600 hover:bg-red-500' // Zero
                            } else if (numericVal > 0) {
                              bgColor = 'bg-green-600 hover:bg-green-500' // Maior que zero
                            }
                          }
                          
                          // Calcular dia da semana (0 = Dom, 1 = Seg...)
                          const dateObj = new Date(year, mIdx, day)
                          const dayOfWeekIdx = dateObj.getDay()
                          const daysOfWek = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
                          const dayLetter = daysOfWek[dayOfWeekIdx]
                          
                          return (
                            <td key={day} className={`border-r border-white/20 p-0 transition-colors ${bgColor} relative`}>
                              <div className="absolute top-0.5 left-0 w-full text-[9px] text-center opacity-60 pointer-events-none font-medium leading-none">
                                {dayLetter}
                              </div>
                              <input 
                                type="text"
                                value={valStr}
                                onChange={(e) => handleValueChange(mIdx, day, e.target.value)}
                                className="w-full h-full px-0.5 pb-0.5 pt-3.5 bg-transparent text-center text-white outline-none focus:bg-white/20"
                                style={{ minHeight: '34px' }}
                              />
                            </td>
                          )
                        })}
                        <td className="p-2 bg-black/60 text-white text-lg font-bold">
                          {monthTotals[mIdx]}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="flex justify-between items-end p-4 bg-black/80 border-t border-white/20">
                <div className="flex flex-col gap-2 text-[10px] sm:text-xs text-white font-medium tracking-wide uppercase">
                  <div className="flex items-center gap-3"><div className="w-4 h-4 bg-red-600 shadow-sm"></div> SEM COLETA</div>
                  <div className="flex items-center gap-3"><div className="w-4 h-4 bg-green-600 shadow-sm"></div> VALOR ACUMULADO PARA O DIA POSTERIOR</div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-4xl font-bold text-green-500">{grandTotal}</span>
                  <span className="text-sm border border-green-500/50 px-2 py-0.5 rounded text-green-500 mt-1">TOTAL ANUAL</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chart Section */}
        <div className={`mt-8 backdrop-blur-md rounded-3xl p-8 shadow-2xl w-full border ${isDark ? 'bg-black/40 border-white/10' : 'bg-white border-black/10'}`}>
          <div className="flex items-center gap-2 mb-8">
             <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
               <div className="w-4 h-4 text-green-500">🌧️</div> 
             </div>
             <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Pluviometria Mensal — {year}</h3>
          </div>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#ffffff10" : "#00000010"} vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke={isDark ? "#ffffff50" : "#00000040"} 
                  tick={{ fill: isDark ? '#ffffff80' : '#4b5563', fontSize: 12, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke={isDark ? "#ffffff50" : "#00000040"} 
                  tick={{ fill: isDark ? '#ffffff80' : '#4b5563', fontSize: 12 }} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${value} mm`}
                />
                <Tooltip 
                  cursor={{ fill: isDark ? '#ffffff05' : '#00000005' }}
                  contentStyle={{ backgroundColor: isDark ? '#121214' : '#ffffff', borderColor: isDark ? '#ffffff10' : '#e5e7eb', borderRadius: '12px' }}
                  labelStyle={{ color: isDark ? '#ffffff80' : '#6b7280', marginBottom: '4px' }}
                  formatter={(value: number) => [`${value} mm`, 'Precipitação']}
                />
                <Bar dataKey="precipitacao" radius={[4, 4, 0, 0]} maxBarSize={60}>
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill="#16a34a" // green-600
                      className="transition-all duration-300 hover:opacity-80"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  )
}
