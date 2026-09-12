import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface ThemeContextType {
  isDark: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false) // Default to light

  useEffect(() => {
    // Load preference on mount
    const saved = localStorage.getItem('sucena_theme')
    if (saved) {
      const isDarkMode = saved === 'dark'
      setIsDark(isDarkMode)
      if (isDarkMode) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    } else {
      // If no preference, default is light (false)
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const toggleTheme = () => {
    setIsDark((prev) => {
      const newTheme = !prev
      localStorage.setItem('sucena_theme', newTheme ? 'dark' : 'light')
      
      // Update global body classes for Tailwind's `dark:` classes
      if (newTheme) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      
      return newTheme
    })
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
