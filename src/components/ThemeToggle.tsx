import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme()

  return (
    <div 
      className={`flex items-center rounded-full p-0.5 cursor-pointer border transition-colors ${
        isDark ? 'bg-[#18181b] border-white/10' : 'bg-gray-200 border-black/5 shadow-inner'
      }`}
      onClick={toggleTheme}
    >
      <div className={`rounded-full p-1 transition-all ${isDark ? 'bg-[#27272a] shadow-sm' : ''}`}>
        <Moon size={14} className={`transition-colors ${isDark ? 'text-blue-300' : 'text-gray-400'}`} />
      </div>
      <div className={`rounded-full p-1 transition-all ${!isDark ? 'bg-white shadow-sm' : ''}`}>
        <Sun size={14} className={`transition-colors ${!isDark ? 'text-amber-500' : 'text-white/30'}`} />
      </div>
    </div>
  )
}
