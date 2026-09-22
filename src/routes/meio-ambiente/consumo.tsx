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
import { Calendar, Download } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../../lib/supabase'
import { DateInput } from '../../components/ui/DateInput'

export const Route = createFileRoute('/meio-ambiente/consumo')({
  component: ConsumoAbastecimentoPage,
})

function ConsumoAbastecimentoPage() {
  const { isDark } = useTheme()
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })
  const [history, setHistory] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      let query = supabase.from('eq_status_history').select(`
        id,
        created_at,
        new_status,
        eq_equipments (
          name,
          plate_tag
        )
      `).like('new_status', 'Abastecimento - %').order('created_at', { ascending: false })
      
      if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00.000Z`)
      }
      if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59.999Z`)
      }
      
      const { data, error } = await query
      
      if (!error && data) {
        setHistory(data)
      } else {
        console.error("Erro ao buscar histórico:", error)
      }
      setIsLoading(false)
    }
    fetchData()
  }, [startDate, endDate])

  const chartData = useMemo(() => {
    const counts: Record<string, number> = {}
    
    // Pontos padrão para sempre aparecerem no gráfico
    counts['Ponto 82'] = 0
    counts['Ponto 3D'] = 0
    counts['Ponto 3C'] = 0
    counts['Ponto 46'] = 0

    history.forEach(row => {
      const pointName = row.new_status.replace('Abastecimento - ', '').trim()
      if (counts[pointName] === undefined) {
        counts[pointName] = 0
      }
      // Adicionando 1 viagem para o gráfico
      counts[pointName] += 1
    })

    return Object.entries(counts).map(([name, viagens]) => ({ name, viagens }))
  }, [history])

  const generatePDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable').catch(()=>({default:null}));
    const doc = new jsPDF()
    
    // Configurações do cabeçalho
    doc.setFontSize(20)
    doc.text('Relatório de Consumo & Abastecimento', 14, 22)
    
    doc.setFontSize(11)
    doc.text(`Período: ${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} até ${new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}`, 14, 30)
    doc.text(`Total de Registros: ${history.length}`, 14, 36)

    // Corpo da tabela
    const tableData = history.map(row => [
      `${new Date(row.created_at).toLocaleDateString('pt-BR')} às ${new Date(row.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}`,
      row.new_status.replace('Abastecimento - ', ''),
      `${row.eq_equipments?.name || 'Desconhecido'} ${row.eq_equipments?.plate_tag ? `(${row.eq_equipments.plate_tag})` : ''}`
    ])

    autoTable(doc, {
      startY: 45,
      head: [['Data / Horário', 'Ponto de Captação', 'Caminhão Pipa']],
      body: tableData,
      theme: isDark ? 'grid' : 'striped',
      headStyles: { fillColor: [234, 179, 8], textColor: 255 }, // Amarelo Sucena
    })

    doc.save(`relatorio_consumo_${startDate}_a_${endDate}.pdf`)
  }

  return (
    <div className={`-mx-4 md:-mx-12 lg:-mx-24 xl:-mx-32 min-h-screen overflow-hidden flex flex-col justify-start relative transition-colors duration-300 ${isDark ? 'bg-black text-white' : 'bg-[#f4f3f0] text-gray-900'}`}>
      
      <div className="max-w-[1600px] mx-auto w-full px-8 lg:px-16 flex flex-col lg:flex-row items-start justify-between gap-12 relative z-10 pt-10 pb-20">
        
        {/* Left Side: Text and Chart */}
        <div className="flex-1 w-full flex flex-col gap-8 animate-in fade-in slide-in-from-left-8 duration-700">
          <div>
            <h1 className={`tracking-tight leading-none mb-2 ${isDark ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]' : 'text-gray-900 drop-shadow-sm'}`}
              style={{ fontSize: 'clamp(24px, 7vw, 54px)' }}
            >
              Consumo & Abastecimento
            </h1>
            <p className={`text-lg font-medium ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
              Monitoramento em tempo real dos principais pontos de captação.
            </p>
          </div>

          {/* Chart Container */}
          <div className={`backdrop-blur-md rounded-3xl p-8 shadow-2xl w-full mt-4 relative overflow-hidden group transition-colors duration-300 ${isDark ? 'bg-[#0a0a0c]/80 border border-white/5' : 'bg-white/80 border border-black/5'}`}>
             {/* Decorative glow */}
             <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-[100px] pointer-events-none transition-opacity duration-700 opacity-50 group-hover:opacity-100" />
             
             <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 relative z-10">
               <h3 className={`text-xl font-bold ${isDark ? 'text-white/90' : 'text-gray-800'}`}>Total de Viagens (Abastecimento)</h3>
               
               <div className="flex items-center gap-2">
                 <DateInput
                   value={startDate}
                   onChange={setStartDate}
                   className={`px-3 py-1.5 text-sm rounded-lg border outline-none transition-colors w-full sm:w-[130px] ${isDark ? 'bg-white/5 border-white/10 text-white focus:border-yellow-500' : 'bg-black/5 border-black/10 text-gray-900 focus:border-yellow-500'}`}
                   title="Data Inicial"
                 />
                 <span className={`text-sm ${isDark ? 'text-white/50' : 'text-gray-500'}`}>até</span>
                 <DateInput
                   value={endDate}
                   onChange={setEndDate}
                   className={`px-3 py-1.5 text-sm rounded-lg border outline-none transition-colors w-full sm:w-[130px] ${isDark ? 'bg-white/5 border-white/10 text-white focus:border-yellow-500' : 'bg-black/5 border-black/10 text-gray-900 focus:border-yellow-500'}`}
                   title="Data Final"
                 />
                 <button 
                   onClick={generatePDF}
                   disabled={isLoading || history.length === 0}
                   className={`ml-2 p-1.5 rounded-lg border transition-colors flex items-center justify-center ${isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-black/5 border-black/10 text-gray-900 hover:bg-black/10'} disabled:opacity-50 disabled:cursor-not-allowed`}
                   title="Baixar Relatório em PDF"
                 >
                   <Download className="w-5 h-5 text-yellow-500" />
                 </button>
               </div>
             </div>
             
             <div className="h-[350px]">
               {isLoading ? (
                 <div className="w-full h-full flex items-center justify-center">
                   <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-500"></div>
                 </div>
               ) : (
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#ffffff15" : "#00000010"} vertical={false} />
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
                       allowDecimals={false}
                     />
                     <Tooltip 
                       cursor={{ fill: isDark ? '#ffffff05' : '#00000005' }}
                       contentStyle={{ backgroundColor: isDark ? '#121214' : '#ffffff', borderColor: isDark ? '#ffffff10' : '#e5e7eb', borderRadius: '12px', color: isDark ? '#fff' : '#111827', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                       itemStyle={{ color: '#eab308', fontWeight: 'bold' }}
                       labelStyle={{ color: isDark ? '#ffffff80' : '#6b7280', marginBottom: '4px' }}
                       formatter={(value: number) => [`${value} viagens`, 'Registros']}
                     />
                     <Bar dataKey="viagens" radius={[6, 6, 0, 0]} maxBarSize={80}>
                        {chartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={index === 2 ? '#eab308' : (isDark ? '#ffffff20' : '#e5e7eb')} 
                            className="transition-all duration-300 hover:opacity-80"
                          />
                        ))}
                     </Bar>
                   </BarChart>
                 </ResponsiveContainer>
               )}
             </div>

             {/* Detailed Table */}
             <div className="mt-8 pt-6 border-t border-gray-200 dark:border-white/10 relative z-10">
               <h4 className={`text-lg font-bold mb-4 ${isDark ? 'text-white/80' : 'text-gray-700'}`}>Detalhamento de Viagens</h4>
               <div className="overflow-x-auto overflow-y-auto max-h-[300px]">
                 <table className="w-full text-left border-collapse">
                   <thead className="sticky top-0 bg-white/90 dark:bg-black/90 backdrop-blur-md z-10">
                     <tr className={`border-b text-sm ${isDark ? 'border-white/10 text-white/50' : 'border-gray-200 text-gray-500'}`}>
                       <th className="pb-3 pr-4 font-medium">Data / Horário</th>
                       <th className="pb-3 pr-4 font-medium">Ponto de Captação</th>
                       <th className="pb-3 pr-4 font-medium">Caminhão Pipa</th>
                     </tr>
                   </thead>
                   <tbody>
                     {isLoading ? (
                       <tr><td colSpan={3} className="py-4 text-center text-sm opacity-50">Carregando...</td></tr>
                     ) : history.length === 0 ? (
                       <tr><td colSpan={3} className="py-4 text-center text-sm opacity-50">Nenhum registro encontrado neste período.</td></tr>
                     ) : (
                       history.map(row => (
                         <tr key={row.id} className={`border-b last:border-0 ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                           <td className="py-3 pr-4 text-sm whitespace-nowrap">
                             {new Date(row.created_at).toLocaleDateString('pt-BR')} às {new Date(row.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
                           </td>
                           <td className="py-3 pr-4 text-sm font-medium">
                             {row.new_status.replace('Abastecimento - ', '')}
                           </td>
                           <td className="py-3 pr-4 text-sm">
                             {row.eq_equipments?.name || 'Desconhecido'} {row.eq_equipments?.plate_tag ? `(${row.eq_equipments.plate_tag})` : ''}
                           </td>
                         </tr>
                       ))
                     )}
                   </tbody>
                 </table>
               </div>
             </div>
          </div>
        </div>

        {/* Right Side: Image */}
        <div className="flex-1 w-full flex justify-center items-center relative animate-in fade-in slide-in-from-right-8 duration-1000 delay-100 mt-16 lg:mt-24">
           {/* Subtle glow behind the truck */}
           <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] rounded-full blur-[100px] pointer-events-none ${isDark ? 'bg-yellow-500/10' : 'bg-yellow-500/20'}`} />
           <img 
             src="/caminhao-final.png" 
             alt="Caminhão Pipa Sucena" 
             className={`w-full max-w-[900px] object-contain relative z-10 hover:scale-105 transition-transform duration-700 ${isDark ? 'drop-shadow-[0_20px_50px_rgba(0,0,0,0.7)]' : 'drop-shadow-[0_20px_50px_rgba(0,0,0,0.2)]'}`} 
           />
        </div>

      </div>
    </div>
  )
}
