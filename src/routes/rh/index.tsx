import { createFileRoute, Link } from '@tanstack/react-router'
import { Users, ClipboardList, FileBarChart, CalendarDays } from 'lucide-react'

export const Route = createFileRoute('/rh/')({
  component: RhHub,
})

const HUB_ITEMS = [
  { name: 'Efetivo', icon: Users, href: '/rh/efetivo', desc: 'Colaboradores cadastrados' },
  { name: 'Relatório de Presença', icon: ClipboardList, href: '/rh/relatorio-presenca', desc: 'Relatórios consolidados' },
  { name: 'Lista de Presença', icon: FileBarChart, href: '/rh/lista-presenca', desc: 'Registro diário' },
  { name: 'Calendário Hydro', icon: CalendarDays, href: '/rh/calendario-hydro', desc: 'Escala de trabalho' },
]

function RhHub() {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-transparent">
      <div className="max-w-4xl w-full mx-auto flex flex-col items-center justify-start mt-2">
        
        {/* Title */}
        <div className="flex flex-col items-center justify-center mb-6 sm:mb-8 mt-2 animate-in fade-in slide-in-from-top-4 duration-500 w-full px-1">
          <h1
            className="font-display italic tracking-tight text-gray-900 dark:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] text-center"
            style={{ fontSize: 'clamp(26px, 8vw, 54px)', lineHeight: '1' }}
          >
            Recursos Humanos
          </h1>
          <p className="text-gray-900 dark:text-white/70 text-sm mt-2 font-medium text-center">
            Gestão de efetivo, presenças e calendário
          </p>
        </div>

        {/* Grid — 1 col mobile, 2 col sm+ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 w-full animate-in fade-in zoom-in-95 duration-700">
          {HUB_ITEMS.map((item, idx) => {
            const Icon = item.icon
            return (
              <Link
                key={idx}
                to={item.href as any}
                className="group flex items-center sm:flex-col sm:items-center sm:justify-center sm:text-center
                           gap-4 sm:gap-4
                           py-4 sm:py-10 px-4 sm:px-6 rounded-2xl sm:rounded-3xl transition-all duration-300
                           bg-white text-black shadow-md hover:shadow-xl hover:-translate-y-1 sm:hover:-translate-y-2
                           relative overflow-hidden active:scale-[0.98]"
                style={{ minHeight: 72 }}
              >
                <Icon
                  size={32}
                  className="text-black opacity-90 group-hover:scale-110 transition-transform duration-300 relative z-10 flex-shrink-0 sm:w-12 sm:h-12"
                  strokeWidth={1.5}
                />
                <div className="flex flex-col min-w-0 sm:items-center">
                  <span className="text-xl sm:text-3xl md:text-4xl font-display italic tracking-tight relative z-10 overflow-wrap-anywhere">
                    {item.name}
                  </span>
                  <span className="text-xs text-black/50 mt-0.5 sm:text-center">
                    {item.desc}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
