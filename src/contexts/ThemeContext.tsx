import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'sucena_theme'

interface ThemeContextType {
  isDark: boolean
  theme: ThemeMode
  toggleTheme: () => void
  setTheme: (theme: ThemeMode) => void
}

/**
 * Lê o tema persistido. Executado também por um script inline no <head>
 * (ver `THEME_BOOTSTRAP_SCRIPT`) para aplicar a classe antes do primeiro paint
 * e evitar o "flash" de tema errado.
 */
function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* localStorage bloqueado (modo privado) — segue para o fallback */
  }
  return 'light'
}

/** Injeta `THEME_BOOTSTRAP_SCRIPT` no <head> da aplicação. */
export function applyThemeToDocument(theme: ThemeMode) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.classList.toggle('light', theme === 'light')
  root.style.colorScheme = theme
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(readStoredTheme)

  // Mantém <html> e o <body> sincronizados com o estado
  useEffect(() => {
    applyThemeToDocument(theme)
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* ignora falha de escrita */
    }
  }, [theme])

  // Mantém abas múltiplas em sincronia
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      const next = event.newValue
      if (next === 'light' || next === 'dark') {
        setThemeState(next)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setTheme = useCallback((next: ThemeMode) => setThemeState(next), [])
  const toggleTheme = useCallback(
    () => setThemeState((current) => (current === 'dark' ? 'light' : 'dark')),
    [],
  )

  return (
    <ThemeContext.Provider
      value={{ isDark: theme === 'dark', theme, toggleTheme, setTheme }}
    >
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

/**
 * Script inline roda antes da hidratação do React: define a classe `dark`
 * no <html> e a cor de fundo do <body> para não haver flash de tema claro
 * quando o usuário está no tema escuro (e vice-versa).
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var M='sucena_theme_migrated_v2';if(!localStorage.getItem(M)){localStorage.setItem('${STORAGE_KEY}','light');localStorage.setItem(M,'1');}var t=localStorage.getItem('${STORAGE_KEY}');if(t!=='light'&&t!=='dark'){t='light'}var d=t==='dark';var e=document.documentElement;e.classList.toggle('dark',d);e.classList.toggle('light',!d);e.style.colorScheme=t;e.style.backgroundColor=d?'#0a0a0a':'#eef0f4';}catch(_){}})();`