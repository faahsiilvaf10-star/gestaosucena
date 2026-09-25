import { useTheme } from '../contexts/ThemeContext'

export function GlobalBackground() {
  const { isDark } = useTheme()

  return (
    <div className={`fixed inset-0 z-[-1] overflow-hidden pointer-events-none transition-colors duration-300 ${isDark ? 'bg-[#09090b]' : 'bg-[#d4d4d8]'}`}>
      {/* Background Effects */}
      <div className={`absolute top-[-20%] left-[-10%] w-[70%] h-[70%] blur-[150px] rounded-full transition-colors duration-300 ${isDark ? 'bg-blue-600/20' : 'bg-blue-400/20'}`}></div>
      <div className={`absolute top-[-20%] right-[-10%] w-[60%] h-[60%] blur-[150px] rounded-full transition-colors duration-300 ${isDark ? 'bg-purple-600/20' : 'bg-purple-400/20'}`}></div>
      
      {/* Grid Pattern */}
      <div 
        className={`absolute inset-0 transition-opacity duration-300 ${isDark ? 'opacity-[0.03]' : 'opacity-[0.05]'}`} 
        style={{
          backgroundImage: `linear-gradient(to right, ${isDark ? '#ffffff' : '#000000'} 1px, transparent 1px), linear-gradient(to bottom, ${isDark ? '#ffffff' : '#000000'} 1px, transparent 1px)`,
          backgroundSize: '4rem 4rem'
        }}
      ></div>

      {/* Floating Squares */}
      <div className={`absolute top-[25%] left-[12%] w-8 h-8 border transition-colors duration-300 ${isDark ? 'border-white/10' : 'border-black/10'}`}></div>
      <div className={`absolute top-[35%] left-[8%] w-6 h-6 border transition-colors duration-300 ${isDark ? 'border-white/10' : 'border-black/10'}`}></div>
      <div className={`absolute top-[15%] right-[28%] w-10 h-10 border transition-colors duration-300 ${isDark ? 'border-white/10' : 'border-black/10'}`}></div>
      <div className={`absolute top-[40%] right-[12%] w-12 h-12 border transition-colors duration-300 ${isDark ? 'border-white/10' : 'border-black/10'}`}></div>
      <div className={`absolute top-[25%] right-[5%] w-6 h-6 border transition-colors duration-300 ${isDark ? 'border-white/10' : 'border-black/10'}`}></div>
    </div>
  )
}
