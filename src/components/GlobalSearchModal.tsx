import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { MENU_ITEMS } from './WindowsNavbar'
import { useNavigate } from '@tanstack/react-router'
import { useTheme } from '../contexts/ThemeContext'

interface GlobalSearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { isDark } = useTheme()

  const filteredItems = MENU_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : prev))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredItems.length > 0) {
          handleSelect(filteredItems[selectedIndex])
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredItems, selectedIndex])

  const handleSelect = (item: typeof MENU_ITEMS[0]) => {
    if (item.href !== '#') {
      navigate({ to: item.href as any })
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      <div 
        className={`relative w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border ${
          isDark 
            ? 'bg-[#111111] border-white/10' 
            : 'bg-white border-black/10'
        } animate-in fade-in zoom-in-95 duration-200`}
      >
        {/* Search Input */}
        <div className={`flex items-center px-4 py-4 border-b ${isDark ? 'border-white/10' : 'border-black/5'}`}>
          <Search size={24} className={isDark ? 'text-white/40' : 'text-black/40'} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar páginas..."
            className={`flex-1 mx-4 bg-transparent outline-none text-xl ${
              isDark 
                ? 'text-white placeholder:text-white/30' 
                : 'text-gray-900 placeholder:text-gray-400'
            }`}
          />
          <button 
            onClick={onClose}
            className={`p-1.5 rounded-md ${
              isDark 
                ? 'hover:bg-white/10 text-white/50 hover:text-white' 
                : 'hover:bg-black/5 text-black/50 hover:text-black'
            } transition-colors`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filteredItems.length > 0 ? (
            filteredItems.map((item, index) => {
              const Icon = item.icon
              const isSelected = index === selectedIndex
              
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-colors text-left ${
                    isSelected
                      ? isDark
                        ? 'bg-white/10'
                        : 'bg-gray-100'
                      : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${
                    item.isEmergency 
                      ? 'bg-red-500/20 text-red-500' 
                      : isDark
                        ? 'bg-white/5 text-white/70'
                        : 'bg-gray-100 text-gray-600'
                  }`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1">
                    <div className={`font-semibold ${
                      item.isEmergency 
                        ? 'text-red-500' 
                        : isDark
                          ? 'text-white'
                          : 'text-gray-900'
                    }`}>
                      {item.label}
                    </div>
                    <div className={`text-xs ${
                      isDark ? 'text-white/40' : 'text-gray-500'
                    }`}>
                      {item.href !== '#' ? `Ir para ${item.href}` : 'Em desenvolvimento'}
                    </div>
                  </div>
                  
                  {isSelected && (
                    <div className={`text-xs px-2 py-1 rounded ${
                      isDark ? 'bg-white/10 text-white/50' : 'bg-gray-200 text-gray-500'
                    }`}>
                      ↵ Enter
                    </div>
                  )}
                </button>
              )
            })
          ) : (
            <div className={`py-12 text-center ${
              isDark ? 'text-white/40' : 'text-gray-500'
            }`}>
              Nenhuma página encontrada.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
