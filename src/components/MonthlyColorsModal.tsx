import React from 'react'
import { X } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { ColorOption, useMonthlyColors } from '../hooks/useMonthlyColors'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const COLOR_MAP: Record<ColorOption, { name: string, bg: string, ring: string, glow: string }> = {
  red: { name: 'Vermelha', bg: 'bg-[#ef4444]', ring: 'ring-[#ef4444]', glow: 'drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]' },
  blue: { name: 'Azul', bg: 'bg-[#3b82f6]', ring: 'ring-[#3b82f6]', glow: 'drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]' },
  yellow: { name: 'Amarela', bg: 'bg-[#eab308]', ring: 'ring-[#eab308]', glow: 'drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]' },
  green: { name: 'Verde', bg: 'bg-[#22c55e]', ring: 'ring-[#22c55e]', glow: 'drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]' }
}

export function MonthlyColorsModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { isDark } = useTheme()
  const { colors, updateColor } = useMonthlyColors()

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" 
      style={{ zIndex: 99999 }}
      onClick={onClose}
    >
      
      {/* Outer Modal Container with Golden Glow Border */}
      <div 
        className={`relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl p-5 md:p-6 
          ${isDark ? 'bg-[#0f1014] text-white shadow-[0_0_1px_1px_rgba(201,168,76,0.2),0_10px_40px_-10px_rgba(0,0,0,0.8)]' : 'bg-gray-900 text-white shadow-[0_0_1px_1px_rgba(201,168,76,0.3),0_10px_40px_-10px_rgba(0,0,0,0.5)]'}
        `}
        onClick={e => e.stopPropagation()}
      >
        
        {/* Subtle top golden light */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-px bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent opacity-80" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-2 bg-[#c9a84c] blur-[10px] opacity-20" />

        <button 
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className={`absolute top-4 right-4 md:top-6 md:right-6 p-2 rounded-full transition-colors hover:bg-white/10 z-50 cursor-pointer`}
          title="Fechar"
        >
          <X size={20} />
        </button>

        <div className="text-center mb-6 relative">
          <h2 className="text-2xl md:text-3xl font-bold font-sans tracking-tight mb-1">Cor proibida de cada mês</h2>
          {/* Decorative glowing line under title */}
          <div className="mx-auto mt-3 w-32 h-[2px] bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent opacity-60" />
          <div className="mx-auto -mt-[2px] w-12 h-[2px] bg-[#c9a84c] drop-shadow-[0_0_4px_rgba(201,168,76,0.8)]" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
          {MONTHS.map((month, index) => {
            const activeColor = colors?.[index] || 'red'
            const activeColorData = COLOR_MAP[activeColor] || COLOR_MAP.red
            
            return (
              <div 
                key={month} 
                className={`p-3 md:p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 md:gap-3 transition-colors 
                  bg-[#16171b] border-white/5 hover:border-white/10
                `}
              >
                <div className="text-center">
                  <h3 className="font-bold text-[15px] md:text-[16px] leading-tight mb-0.5">{month}</h3>
                  <p className="text-[11px] text-white/50">{activeColorData.name}</p>
                </div>
                
                <div className="flex items-center justify-center gap-2.5 h-8">
                  {(Object.keys(COLOR_MAP) as ColorOption[]).map(color => {
                    const isActive = activeColor === color
                    const colorData = COLOR_MAP[color]
                    
                    return (
                      <div
                        key={color}
                        className={`
                          rounded-full flex items-center justify-center 
                          ${colorData.bg} 
                          ${isActive 
                            ? `w-7 h-7 ring-[1px] ring-offset-[3px] ring-offset-[#16171b] ${colorData.ring} ${colorData.glow}` 
                            : 'w-4 h-4 md:w-5 md:h-5 opacity-50'
                          }
                        `}
                        title={colorData.name}
                      />
                    )
                  })}
                </div>

              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
