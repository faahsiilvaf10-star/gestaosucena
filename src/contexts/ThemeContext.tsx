import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface ThemeContextType {
  isDark: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(true) // Always dark

  useEffect(() => {
    // Force dark mode
    document.documentElement.classList.add('dark')
    localStorage.setItem('sucena_theme', 'dark')
    setIsDark(true)
  }, [])

  const toggleTheme = () => {
    // Do nothing, theme is locked to dark
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
