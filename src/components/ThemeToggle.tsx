interface ThemeToggleProps {
  /** Estilo do botão: `nav` para a navbar (usa classes do WindowsNavbar.css). */
  variant?: 'nav' | 'ghost';
  className?: string;
}

/**
 * Sistema opera exclusivamente no tema claro por definição.
 * O componente retorna nulo para não permitir alteração de tema.
 */
export function ThemeToggle(_props: ThemeToggleProps) {
  return null;
}

export default ThemeToggle;
