import { createFileRoute } from '@tanstack/react-router'
import { useTheme } from '../../contexts/ThemeContext'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { Save, Download } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

export const Route = createFileRoute('/meio-ambiente/residuos')({
  component: ResiduosPage,
})

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const SHORT_MONTHS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
]

const CATEGORIES = [
  { id: 'papel_kg', label: 'PAPEL(KG)', color: '#3b82f6' }, // Azul
  { id: 'plastico_kg', label: 'PLÁSTICO(KG)', color: '#ef4444' }, // Vermelho
  { id: 'nao_reciclavel_kg', label: 'NÃO RECICLÁVEL(KG)', color: '#64748b' }, // Cinza
  { id: 'metal_kg', label: 'METAL(KG)', color: '#eab308' }, // Amarelo
  { id: 'organico_kg', label: 'ORGÂNICO(KG)', color: '#8b4513' }, // Marrom
]

function ResiduosPage() {
  const { isDark } = useTheme()
  const [year, setYear] = useState(new Date().getFullYear())
  
  const [data, setData] = useState<Record<string, Record<string, string>>>({})
  const [efluentesData, setEfluentesData] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const setor = 'GERAL'

  useEffect(() => {
    fetchData()
  }, [year])

  const fetchData = async () => {
    setIsLoading(true)
    
    const [residuosRes, efluentesRes] = await Promise.all([
      supabase.from('residuos_registros').select('*').like('data_registro', `${year}-%`),
      supabase.from('efluentes_registros').select('*').like('data_registro', `${year}-%`)
    ])

    let hasError = false

    if (residuosRes.error) {
      console.error('Erro ao buscar residuos:', residuosRes.error)
      hasError = true
    } else if (residuosRes.data) {
      const map: Record<string, Record<string, string>> = {}
      residuosRes.data.forEach(row => {
        map[row.data_registro] = {
          papel_kg: row.papel_kg ? String(row.papel_kg) : '',
          plastico_kg: row.plastico_kg ? String(row.plastico_kg) : '',
          nao_reciclavel_kg: row.nao_reciclavel_kg ? String(row.nao_reciclavel_kg) : '',
          metal_kg: row.metal_kg ? String(row.metal_kg) : '',
          organico_kg: row.organico_kg ? String(row.organico_kg) : '',
        }
      })
      setData(map)
    }

    if (efluentesRes.error) {
      console.error('Erro ao buscar efluentes:', efluentesRes.error)
      hasError = true
    } else if (efluentesRes.data) {
      const eMap: Record<string, string> = {}
      efluentesRes.data.forEach(row => {
        eMap[row.data_registro] = row.volume_m3 ? String(row.volume_m3) : ''
      })
      setEfluentesData(eMap)
    }

    if (hasError) {
      toast.error('Erro ao carregar os dados.')
    }

    setIsLoading(false)
  }

  const handleValueChange = (monthIdx: number, catId: string, val: string) => {
    if (!/^[\d.,]*$/.test(val)) return
    const monthStr = String(monthIdx + 1).padStart(2, '0')
    const dateKey = `${year}-${monthStr}`

    setData(prev => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || {}),
        [catId]: val
      }
    }))
  }

  const handleEfluentesChange = (monthIdx: number, val: string) => {
    if (!/^[\d.,]*$/.test(val)) return
    const monthStr = String(monthIdx + 1).padStart(2, '0')
    const dateKey = `${year}-${monthStr}`
    setEfluentesData(prev => ({ ...prev, [dateKey]: val }))
  }

  const saveAll = async () => {
    setIsSaving(true)
    const records = Object.entries(data).map(([dateKey, values]) => {
      const parseVal = (v?: string) => v === '' || v === undefined ? 0 : (parseFloat(v.replace(',', '.')) || 0)
      return {
        data_registro: dateKey,
        papel_kg: parseVal(values.papel_kg),
        plastico_kg: parseVal(values.plastico_kg),
        nao_reciclavel_kg: parseVal(values.nao_reciclavel_kg),
        metal_kg: parseVal(values.metal_kg),
        organico_kg: parseVal(values.organico_kg),
        setor: setor
      }
    })

    const efluentesRecords = Object.entries(efluentesData).map(([dateKey, val]) => {
      return {
        data_registro: dateKey,
        volume_m3: val === '' ? 0 : parseFloat(val.replace(',', '.')) || 0,
        setor: setor
      }
    })

    if (records.length === 0 && efluentesRecords.length === 0) {
      setIsSaving(false)
      return toast.info('Não há dados para salvar.')
    }

    const promises = []
    if (records.length > 0) {
      promises.push(supabase.from('residuos_registros').upsert(records, { onConflict: 'data_registro' }))
    }
    if (efluentesRecords.length > 0) {
      promises.push(supabase.from('efluentes_registros').upsert(efluentesRecords, { onConflict: 'data_registro' }))
    }

    const results = await Promise.all(promises)
    const hasError = results.some(res => res.error)

    if (hasError) {
      console.error('Erro ao salvar:', results.filter(r => r.error))
      toast.error('Erro ao salvar os registros.')
    } else {
      toast.success('Registros salvos com sucesso!')
    }
    setIsSaving(false)
  }

  // Calculate row totals for Resíduos
  const rowTotals = useMemo(() => {
    return MONTHS.map((_, mIdx) => {
      const monthStr = String(mIdx + 1).padStart(2, '0')
      const dateKey = `${year}-${monthStr}`
      const values = data[dateKey] || {}
      
      let total = 0
      CATEGORIES.forEach(cat => {
        const valStr = values[cat.id]
        if (valStr) {
          total += parseFloat(valStr.replace(',', '.')) || 0
        }
      })
      return total
    })
  }, [data, year])

  // Grand total sum for Resíduos
  const grandTotal = useMemo(() => {
    return rowTotals.reduce((acc, curr) => acc + curr, 0)
  }, [rowTotals])

  // Chart Data preparation
  const chartDataResiduos = useMemo(() => {
    return SHORT_MONTHS.map((month, mIdx) => {
      const monthStr = String(mIdx + 1).padStart(2, '0')
      const dateKey = `${year}-${monthStr}`
      const values = data[dateKey] || {}
      
      return {
        name: month,
        papel_kg: parseFloat(values.papel_kg?.replace(',', '.') || '0'),
        plastico_kg: parseFloat(values.plastico_kg?.replace(',', '.') || '0'),
        nao_reciclavel_kg: parseFloat(values.nao_reciclavel_kg?.replace(',', '.') || '0'),
        metal_kg: parseFloat(values.metal_kg?.replace(',', '.') || '0'),
        organico_kg: parseFloat(values.organico_kg?.replace(',', '.') || '0'),
      }
    })
  }, [data, year])

  const chartDataEfluentes = useMemo(() => {
    return SHORT_MONTHS.map((month, mIdx) => {
      const monthStr = String(mIdx + 1).padStart(2, '0')
      const dateKey = `${year}-${monthStr}`
      const val = efluentesData[dateKey] || '0'
      
      return {
        name: month,
        volume: parseFloat(val.replace(',', '.') || '0')
      }
    })
  }, [efluentesData, year])

  const chartThemeColors = {
    text: isDark ? '#e2e8f0' : '#1e293b',
    grid: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  }

  const generatePDF = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4')

    const createDocument = (logoImg?: HTMLImageElement) => {
      // Configurações do cabeçalho
      doc.setFontSize(16)
      doc.text('Relatório de Resíduos e Efluentes', 14, 25)
      
      doc.setFontSize(10)
      doc.text(`Setor: ${setor}`, 14, 32)
      doc.text(`Ano: ${year}`, 14, 37)
      doc.text(`Total de Resíduos Anual: ${grandTotal > 0 ? grandTotal.toFixed(2).replace(/\.00$/, '') : 0} KG`, 14, 42)

      if (logoImg) {
        try {
          doc.addImage(logoImg, 'PNG', 240, 12, 40, 15)
        } catch (e) {
          console.warn('Não foi possível adicionar a logo', e)
        }
      }

      // Tabela de Resíduos
      doc.setFontSize(12)
      doc.text('RESÍDUOS', 14, 52)

      const headResiduos = [['Mês', 'PAPEL(KG)', 'PLÁSTICO(KG)', 'NÃO RECICLÁVEL(KG)', 'METAL(KG)', 'ORGÂNICO(KG)', 'Total']]
      const bodyResiduos = MONTHS.map((month, mIdx) => {
        const row = [month]
        CATEGORIES.forEach(cat => {
          const val = data[`${year}-${String(mIdx + 1).padStart(2, '0')}`]?.[cat.id] ?? ''
          row.push(val)
        })
        row.push(rowTotals[mIdx] > 0 ? rowTotals[mIdx].toFixed(2).replace(/\.00$/, '') : '0')
        return row
      })

      autoTable(doc, {
        startY: 56,
        head: headResiduos,
        body: bodyResiduos,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [26, 75, 109], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } }
      })

      const finalY = (doc as any).lastAutoTable.finalY || 56

      // Tabela de Efluentes
      doc.setFontSize(12)
      doc.text('EFLUENTES SANITÁRIOS', 14, finalY + 12)

      const headEfluentes = [['Mês', 'Efluentes Sanitários (m³)']];
      const bodyEfluentes = MONTHS.map((month, mIdx) => {
        const val = efluentesData[`${year}-${String(mIdx + 1).padStart(2, '0')}`] ?? ''
        return [month, val]
      })

      autoTable(doc, {
        startY: finalY + 16,
        head: headEfluentes,
        body: bodyEfluentes,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [26, 75, 109], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } }
      })

      doc.save(`Residuos_Efluentes_${setor}_${year}.pdf`)
    }

    const img = new Image()
    img.onload = () => createDocument(img)
    img.onerror = () => createDocument()
    img.src = '/logo-relatorio.png'
  }

  return (
    <div className={`-mx-4 md:-mx-12 lg:-mx-24 xl:-mx-32 min-h-screen flex flex-col justify-start relative transition-colors duration-300 ${isDark ? 'bg-[#0a0a0c]' : 'bg-[#f4f3f0]'}`}>
      
      <div className="max-w-[1600px] mx-auto w-full px-4 lg:px-16 pt-10 pb-20 relative z-10 flex flex-col gap-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className={`text-2xl lg:text-3xl font-bold tracking-tight uppercase flex items-center gap-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                 <span className="text-xl">♻️</span>
              </div>
              RESÍDUOS E EFLUENTES
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

        {isLoading ? (
          <div className="flex justify-center items-center h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            {/* Image Coletores */}
            <div className="w-full flex justify-center animate-in fade-in slide-in-from-top-4 duration-1000">
              <img 
                src="/coletores.png" 
                alt="Coletores de Resíduos" 
                className={`max-w-[90%] md:max-w-[450px] h-auto object-contain transition-transform duration-700 hover:scale-105 ${isDark ? 'drop-shadow-[0_10px_30px_rgba(255,255,255,0.1)]' : 'drop-shadow-[0_20px_40px_rgba(0,0,0,0.15)]'}`}
              />
            </div>

            {/* Resíduos Table */}
            <div className="flex flex-col w-full -mt-8 relative z-30">
              <h3 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>RESÍDUOS</h3>
              <div className="w-full overflow-hidden rounded-md border border-[#1a4b6d] shadow-2xl bg-white font-sans relative z-20">
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-sm text-center border-collapse text-black min-w-[1000px]">
                    <thead>
                      <tr className="bg-[#1a4b6d] text-white">
                        <th className="p-3 border-b border-r border-[#1a4b6d] font-bold text-left w-32">Mês</th>
                        {CATEGORIES.map(cat => (
                          <th key={cat.id} className="p-3 border-b border-r border-[#1a4b6d] font-bold w-1/6">{cat.label}</th>
                        ))}
                        <th className="p-3 border-b border-[#1a4b6d] font-bold w-40">Total de Resíduos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MONTHS.map((monthName, mIdx) => {
                        const rowBg = mIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        return (
                          <tr key={monthName} className={`border-b border-[#1a4b6d]/30 transition-colors hover:bg-black/5 ${rowBg}`}>
                            <td className="p-3 border-r border-[#1a4b6d]/30 font-bold text-left whitespace-nowrap">
                              {monthName}
                            </td>
                            {CATEGORIES.map((cat) => {
                              const monthStr = String(mIdx + 1).padStart(2, '0')
                              const dateKey = `${year}-${monthStr}`
                              const valStr = data[dateKey]?.[cat.id] ?? ''
                              
                              return (
                                <td key={cat.id} className="border-r border-[#1a4b6d]/30 p-0 relative">
                                  <input 
                                    type="text"
                                    value={valStr}
                                    onChange={(e) => handleValueChange(mIdx, cat.id, e.target.value)}
                                    className="w-full h-full p-3 bg-transparent text-center text-black outline-none focus:bg-black/5 transition-colors"
                                    placeholder=""
                                  />
                                </td>
                              )
                            })}
                            <td className="p-3 font-bold text-base bg-[#f8fafc]">
                              {rowTotals[mIdx] > 0 ? rowTotals[mIdx].toFixed(2).replace(/\.00$/, '') : 0}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div className="flex justify-end items-center p-4 bg-white border-t border-[#1a4b6d] gap-4">
                    <span className="text-sm font-bold text-black/50 uppercase tracking-widest">
                      TOTAL ACUMULADO ANO (KG)
                    </span>
                    <span className="text-2xl font-bold text-[#1a4b6d]">
                      {grandTotal > 0 ? grandTotal.toFixed(2).replace(/\.00$/, '') : 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Efluentes Table */}
            <div className="flex flex-col w-full mt-8">
              <h3 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>EFLUENTES SANITÁRIOS</h3>
              <div className="w-full overflow-hidden rounded-md border border-[#1a4b6d] shadow-2xl bg-white font-sans relative z-20">
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-sm text-center border-collapse text-black min-w-[600px]">
                    <thead>
                      <tr className="bg-[#1a4b6d] text-white">
                        <th className="p-3 border-b border-r border-[#1a4b6d] font-bold text-left w-32">Mês</th>
                        <th className="p-3 border-b border-[#1a4b6d] font-bold">Efluentes Sanitários (m³)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MONTHS.map((monthName, mIdx) => {
                        const rowBg = mIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        const monthStr = String(mIdx + 1).padStart(2, '0')
                        const dateKey = `${year}-${monthStr}`
                        const valStr = efluentesData[dateKey] ?? ''

                        return (
                          <tr key={monthName} className={`border-b border-[#1a4b6d]/30 transition-colors hover:bg-black/5 ${rowBg}`}>
                            <td className="p-3 border-r border-[#1a4b6d]/30 font-bold text-left whitespace-nowrap">
                              {monthName}
                            </td>
                            <td className="p-0 relative">
                              <input 
                                type="text"
                                value={valStr}
                                onChange={(e) => handleEfluentesChange(mIdx, e.target.value)}
                                className="w-full h-full p-3 bg-transparent text-center text-black outline-none focus:bg-black/5 transition-colors"
                                placeholder=""
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="flex flex-col gap-8 w-full mt-12">
              {/* Resíduos Chart */}
              <div className={`flex-1 rounded-md border shadow-xl p-6 ${isDark ? 'bg-[#111] border-white/10' : 'bg-white border-[#1a4b6d]/20'}`}>
                <h3 className={`text-lg font-bold mb-6 ${isDark ? 'text-white' : 'text-[#1a4b6d]'}`}>
                  Resíduos por Mês (KG)
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartDataResiduos} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartThemeColors.grid} />
                      <XAxis dataKey="name" stroke={chartThemeColors.text} fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke={chartThemeColors.text} fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                        contentStyle={{ backgroundColor: isDark ? '#1a1a1a' : '#fff', borderColor: isDark ? '#333' : '#e2e8f0', color: chartThemeColors.text }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                      {CATEGORIES.map(cat => (
                        <Bar key={cat.id} dataKey={cat.id} name={cat.label} fill={cat.color} radius={[2, 2, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Efluentes Chart */}
              <div className={`flex-1 rounded-md border shadow-xl p-6 ${isDark ? 'bg-[#111] border-white/10' : 'bg-white border-[#1a4b6d]/20'}`}>
                <h3 className={`text-lg font-bold mb-6 ${isDark ? 'text-white' : 'text-[#1a4b6d]'}`}>
                  Efluentes Sanitários por Mês (m³)
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartDataEfluentes} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartThemeColors.grid} />
                      <XAxis dataKey="name" stroke={chartThemeColors.text} fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke={chartThemeColors.text} fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                        contentStyle={{ backgroundColor: isDark ? '#1a1a1a' : '#fff', borderColor: isDark ? '#333' : '#e2e8f0', color: chartThemeColors.text }}
                      />
                      <Bar dataKey="volume" name="Efluentes Sanitários (m³)" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
