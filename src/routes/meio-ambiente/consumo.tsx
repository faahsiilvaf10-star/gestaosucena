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

export const Route = createFileRoute('/meio-ambiente/consumo')({
  component: ConsumoAbastecimentoPage,
})

const data = [
  { name: 'Ponto 82', volume: 8500 },
  { name: 'Ponto 3D', volume: 6200 },
  { name: 'Ponto 3C', volume: 11200 },
  { name: 'Ponto 46', volume: 4800 },
]

function ConsumoAbastecimentoPage() {
  const { isDark } = useTheme()

  return (
    <div className={`-mx-4 md:-mx-12 lg:-mx-24 xl:-mx-32 min-h-screen overflow-hidden flex flex-col justify-start relative transition-colors duration-300 ${isDark ? 'bg-black text-white' : 'bg-[#f4f3f0] text-gray-900'}`}>
      
      <div className="max-w-[1600px] mx-auto w-full px-8 lg:px-16 flex flex-col lg:flex-row items-start justify-between gap-12 relative z-10 pt-10 pb-20">
        
        {/* Left Side: Text and Chart */}
        <div className="flex-1 w-full flex flex-col gap-8 animate-in fade-in slide-in-from-left-8 duration-700">
          <div>
            <h1 className={`text-[54px] font-display italic tracking-tight leading-none mb-2 ${isDark ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]' : 'text-gray-900 drop-shadow-sm'}`}>
              Consumo & Abastecimento
            </h1>
            <p className={`text-lg font-medium ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
              Monitoramento em tempo real dos principais pontos de captação.
            </p>
          </div>

          {/* Chart Container */}
          <div className={`backdrop-blur-md rounded-3xl p-8 shadow-2xl h-[450px] w-full mt-4 relative overflow-hidden group transition-colors duration-300 ${isDark ? 'bg-[#0a0a0c]/80 border border-white/5' : 'bg-white/80 border border-black/5'}`}>
             {/* Decorative glow */}
             <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-[100px] pointer-events-none transition-opacity duration-700 opacity-50 group-hover:opacity-100" />
             
             <h3 className={`text-xl font-bold mb-6 ${isDark ? 'text-white/90' : 'text-gray-800'}`}>Volume Diário (Litros)</h3>
             
             <ResponsiveContainer width="100%" height="85%">
               <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                 />
                 <Tooltip 
                   cursor={{ fill: isDark ? '#ffffff05' : '#00000005' }}
                   contentStyle={{ backgroundColor: isDark ? '#121214' : '#ffffff', borderColor: isDark ? '#ffffff10' : '#e5e7eb', borderRadius: '12px', color: isDark ? '#fff' : '#111827', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                   itemStyle={{ color: '#eab308', fontWeight: 'bold' }}
                   labelStyle={{ color: isDark ? '#ffffff80' : '#6b7280', marginBottom: '4px' }}
                 />
                 <Bar dataKey="volume" radius={[6, 6, 0, 0]} maxBarSize={80}>
                    {data.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={index === 2 ? '#eab308' : (isDark ? '#ffffff20' : '#e5e7eb')} 
                        className="transition-all duration-300 hover:opacity-80"
                      />
                    ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
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
