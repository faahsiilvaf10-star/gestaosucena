import Moon from 'lucide-react/dist/esm/icons/moon.js';
import Sun from 'lucide-react/dist/esm/icons/sun.js';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';

interface ThemeToggleProps {
  /** Estilo do botão: `nav` para a navbar (usa classes do WindowsNavbar.css). */
  variant?: 'nav' | 'ghost';
  className?: string;
}

/**
 * Botão que alterna entre os temas claro e escuro.
 * O ícone faz uma rotação + fade suave ao trocar de tema.
 */
export function ThemeToggle({ variant = 'nav', className }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();

  const label = isDark ? 'Ativar tema claro' : 'Ativar tema escuro';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      aria-pressed={!isDark}
      className={cn(
        variant === 'nav' ? 'nav-action-btn' : 'theme-toggle-ghost',
        className,
      )}
    >
      <span className="relative block h-4 w-4">
        <Sun
          size={16}
          strokeWidth={1.8}
          className={cn(
            'absolute inset-0 transition-all duration-300 ease-out',
            isDark
              ? 'rotate-0 scale-100 opacity-100'
              : '-rotate-90 scale-50 opacity-0',
          )}
        />
        <Moon
          size={16}
          strokeWidth={1.8}
          className={cn(
            'absolute inset-0 transition-all duration-300 ease-out',
            isDark
              ? 'rotate-90 scale-50 opacity-0'
              : 'rotate-0 scale-100 opacity-100',
          )}
        />
      </span>
    </button>
  );
}

export default ThemeToggle;