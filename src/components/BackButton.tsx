import { ArrowLeft } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'

interface BackButtonProps {
  /** Optional override route to navigate back to */
  to?: string
  /** Optional label. Defaults to 'Voltar' */
  label?: string
}

/**
 * Reusable back-navigation button.
 * Place it at the top of any page component.
 * On mobile and desktop it renders at the top-left corner of the page content.
 */
export function BackButton({ to, label = 'Voltar' }: BackButtonProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (to) {
      navigate({ to: to as any })
    } else {
      window.history.back()
    }
  }

  return (
    <button
      onClick={handleClick}
      aria-label={label}
      className="
        inline-flex items-center gap-2
        mb-4
        text-sm font-semibold
        text-gray-600 dark:text-white/60
        hover:text-gray-900 dark:hover:text-white
        transition-colors duration-200
        group
      "
    >
      <span className="
        flex items-center justify-center
        w-8 h-8 rounded-full
        bg-gray-100 dark:bg-white/10
        group-hover:bg-gray-200 dark:group-hover:bg-white/20
        transition-colors duration-200
      ">
        <ArrowLeft size={16} strokeWidth={2} />
      </span>
      <span>{label}</span>
    </button>
  )
}
