import { useTheme } from '../contexts/ThemeContext'
import { useEffect, useState } from 'react'
import { getGlobalAppearanceSettings } from '../lib/settings'

const DEFAULT_LIGHT_BG = `linear-gradient(rgba(120, 130, 160, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(120, 130, 160, 0.07) 1px, transparent 1px), linear-gradient(135deg, #e4e8f1 0%, #eceef4 45%, #f7ece2 100%)`

export function GlobalBackground() {
  const { isDark } = useTheme()
  const [bgCss, setBgCss] = useState('')
  const [bgOpacity, setBgOpacity] = useState(100)

  useEffect(() => {
    getGlobalAppearanceSettings().then(settings => {
      if (settings?.backgroundCss) {
        setBgCss(settings.backgroundCss)
      }
      if (settings?.opacity !== undefined) {
        setBgOpacity(settings.opacity)
      }
      if (settings?.darkCardOpacity !== undefined) {
        document.documentElement.style.setProperty('--dark-card-opacity', String(settings.darkCardOpacity / 100))
      }
      if (settings?.lightCardOpacity !== undefined) {
        document.documentElement.style.setProperty('--light-card-opacity', String(settings.lightCardOpacity / 100))
      }
    }).catch(console.error)
  }, [])

  // O fundo é definido pelo Admin para o tema CLARO. No escuro usamos a
  // camada procedural para preservar o visual original.
  const isCustomBg = !!bgCss && bgCss !== DEFAULT_LIGHT_BG
  const isImage = bgCss.includes('url')

  const useCustomBg = isCustomBg && !isDark
  let customStyle = {}
  if (useCustomBg) {
    customStyle = {
      backgroundImage: bgCss,
      backgroundSize: isImage && !bgCss.includes('background-size') ? 'cover' : '24px 24px, 24px 24px, 100% 100%',
      backgroundPosition: 'center center',
      backgroundAttachment: 'fixed',
      backgroundRepeat: 'no-repeat',
      opacity: bgOpacity / 100
    }
  }

  return (
    <div
      className={`fixed inset-0 z-[-1] overflow-hidden pointer-events-none transition-colors duration-300 ${!useCustomBg ? (isDark ? 'bg-[#09090b]' : 'bg-[#e4e8f1]') : 'bg-[#f2f3f7]'}`}
    >
      {useCustomBg ? (
        <div className="absolute inset-0 transition-opacity duration-300" style={customStyle} />
      ) : (
        <>
          {/* Background Effects */}
          <div className={`absolute top-[-20%] left-[-10%] w-[70%] h-[70%] blur-[150px] rounded-full transition-colors duration-300 ${isDark ? 'bg-blue-600/20' : 'bg-blue-300/30'}`}></div>
          <div className={`absolute top-[-20%] right-[-10%] w-[60%] h-[60%] blur-[150px] rounded-full transition-colors duration-300 ${isDark ? 'bg-purple-600/20' : 'bg-amber-300/30'}`}></div>
          <div className={`absolute bottom-[-25%] left-[20%] w-[70%] h-[60%] blur-[150px] rounded-full transition-colors duration-300 ${isDark ? 'bg-indigo-600/15' : 'bg-rose-200/40'}`}></div>
          
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
        </>
      )}
    </div>
  )
}
