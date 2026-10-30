import { createContext, useContext, useEffect, ReactNode } from 'react'

export type ThemeMode = 'light'

const STORAGE_KEY = 'sucena_theme'

interface ThemeContextType {
  isDark: boolean
  theme: ThemeMode
  toggleTheme: () => void
  setTheme: (theme: ThemeMode) => void
}

/**
 * Força exclusivamente o tema claro em todo o sistema.
 * Remove resíduos de 'dark' persistidos no localStorage de celulares e computadores.
 */
function enforceLightMode() {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'light')
      window.localStorage.removeItem('theme')
    } catch {}
  }
}

export function applyThemeToDocument(_theme?: string) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const body = document.body
  root.classList.remove('dark')
  root.classList.add('light')
  if (body) {
    body.classList.remove('dark')
    body.classList.add('light')
  }
  root.style.colorScheme = 'light'
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    enforceLightMode()
    applyThemeToDocument('light')

    // Observador para remover proativamente qualquer classe .dark injetada pelo sistema ou extensões
    const observer = new MutationObserver(() => {
      const root = document.documentElement
      if (root.classList.contains('dark')) {
        root.classList.remove('dark')
        root.classList.add('light')
        root.style.colorScheme = 'light'
      }
      if (document.body && document.body.classList.contains('dark')) {
        document.body.classList.remove('dark')
        document.body.classList.add('light')
      }
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [])

  return (
    <ThemeContext.Provider
      value={{
        isDark: false,
        theme: 'light',
        toggleTheme: () => {},
        setTheme: () => {},
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

/**
 * Script inline executado imediatamente antes do primeiro paint:
 * Força a remoção de 'dark', adiciona 'light' e define colorScheme = 'light'.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{localStorage.setItem('${STORAGE_KEY}','light');localStorage.removeItem('theme');var e=document.documentElement;e.classList.remove('dark');e.classList.add('light');e.style.colorScheme='light';e.style.backgroundColor='#eef0f4';}catch(_){}})();`
