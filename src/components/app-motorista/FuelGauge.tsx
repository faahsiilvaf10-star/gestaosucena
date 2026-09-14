import { Fuel, ChevronLeft, ChevronRight } from 'lucide-react'

const FUEL_VALUES = [0, 25, 50, 75, 100]
const FUEL_LABELS: Record<number, string> = { 0: 'E', 25: '1/4', 50: '1/2', 75: '3/4', 100: 'F' }

export default function FuelGauge({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const numValue = parseInt(value) || 0
  const currentIndex = FUEL_VALUES.indexOf(numValue) !== -1 ? FUEL_VALUES.indexOf(numValue) : 2

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault()
    if (currentIndex > 0) onChange(FUEL_VALUES[currentIndex - 1].toString())
  }
  
  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault()
    if (currentIndex < FUEL_VALUES.length - 1) onChange(FUEL_VALUES[currentIndex + 1].toString())
  }

  const rotation = (numValue / 100) * 180 - 90
  const rad = (rotation * Math.PI) / 180
  
  const b_xU = 100 + 70 * Math.sin(rad)
  const b_yU = 100 - 70 * Math.cos(rad)

  return (
    <div className="bg-[#111] rounded-[32px] p-6 flex flex-col items-center shadow-xl w-full">
      <div className="flex items-center gap-2 text-gray-300 mb-8">
        <Fuel size={22} className="text-gray-100" />
        <h3 className="text-lg font-bold">Nível de Combustível</h3>
      </div>

      <div className="relative w-full max-w-[280px] aspect-[5/3] mb-6">
        <svg viewBox="0 0 200 120" className="w-full h-full overflow-visible">
          {/* Arcs */}
          <path d="M 30 100 A 70 70 0 0 1 48 54" fill="none" stroke="#7f1d1d" strokeWidth="12" strokeLinecap="round" />
          <path d="M 54 48 A 70 70 0 0 1 96 31" fill="none" stroke="#78350f" strokeWidth="12" strokeLinecap="round" />
          <path d="M 104 31 A 70 70 0 0 1 146 48" fill="none" stroke="#3f6212" strokeWidth="12" strokeLinecap="round" />
          <path d="M 152 54 A 70 70 0 0 1 170 100" fill="none" stroke="#14532d" strokeWidth="12" strokeLinecap="round" />

          {/* Needle */}
          <g transform={`rotate(${rotation} 100 100)`} className="transition-transform duration-500 ease-out">
            <line x1="100" y1="100" x2="100" y2="40" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" />
            <polygon points="92,48 108,48 100,28" fill="#ef4444" />
            <circle cx="100" cy="100" r="10" fill="#ef4444" stroke="#222" strokeWidth="4" />
          </g>
        </svg>

        {/* Labels */}
        <div className="absolute inset-0 pointer-events-none">
          {FUEL_VALUES.map(val => {
            const rot = (val / 100) * 180 - 90
            const rRad = (rot * Math.PI) / 180
            const isEdge = val === 0 || val === 100
            const r = isEdge ? 40 : 45 
            const xU = 100 + r * Math.sin(rRad)
            const yU = 100 - r * Math.cos(rRad)
            
            return (
              <div 
                key={val}
                className={`absolute font-black flex items-center justify-center ${isEdge ? 'text-gray-200 text-lg' : 'bg-[#222] text-gray-300 text-xs w-9 h-9 rounded-full'}`}
                style={{ left: `${xU / 2}%`, top: `${(yU / 120) * 100}%`, transform: 'translate(-50%, -50%)' }}
              >
                {FUEL_LABELS[val]}
              </div>
            )
          })}
        </div>

        {/* Active Bubble */}
        <div 
          className="absolute bg-amber-500 text-white font-black text-[15px] w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ease-out z-10 border-[5px] border-[#111]"
          style={{ left: `${b_xU / 2}%`, top: `${(b_yU / 120) * 100}%`, transform: 'translate(-50%, -50%)' }}
        >
          {FUEL_LABELS[numValue]}
        </div>
      </div>

      <div className="flex items-center justify-between w-full max-w-[260px]">
        <button 
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="w-14 h-14 rounded-full bg-[#222] hover:bg-[#333] flex items-center justify-center text-white active:scale-95 disabled:opacity-30 disabled:active:scale-100 transition-all"
        >
          <ChevronLeft size={28} />
        </button>
        <div className="flex-1 mx-4 h-14 bg-amber-500 rounded-full flex items-center justify-center text-white font-black text-xl shadow-[0_0_15px_rgba(245,158,11,0.2)]">
          {FUEL_LABELS[numValue]}
        </div>
        <button 
          onClick={handleNext}
          disabled={currentIndex === FUEL_VALUES.length - 1}
          className="w-14 h-14 rounded-full bg-[#222] hover:bg-[#333] flex items-center justify-center text-white active:scale-95 disabled:opacity-30 disabled:active:scale-100 transition-all"
        >
          <ChevronRight size={28} />
        </button>
      </div>
    </div>
  )
}
