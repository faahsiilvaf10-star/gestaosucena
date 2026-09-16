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
    <div className="space-y-6 animate-in fade-in duration-500 pb-12 w-full">
      <div className="max-w-4xl w-full mx-auto flex flex-col items-center justify-start mt-2">
        
        {/* Title */}
        <div className="flex flex-col items-center justify-center mb-4 mt-2 animate-in fade-in slide-in-from-top-4 duration-500 w-full px-1">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full animate-in fade-in zoom-in-95 duration-700">
          {HUB_ITEMS.map((item, idx) => {
            const Icon = item.icon
            return (
              <Link
                key={idx}
                to={item.href as any}
                className="group relative flex flex-row items-center justify-start py-4 px-5 rounded-[24px] bg-white transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-1 border border-gray-100"
              >
                <div className="mr-4 transition-transform duration-500 group-hover:scale-110 shrink-0 flex items-center justify-center">
                  <Icon className="w-8 h-8 text-gray-900" strokeWidth={1.5} />
                </div>
                <h3 className="font-serif italic text-xl text-gray-900 tracking-wide font-medium text-left leading-tight">
                  {item.name.replace('\n', ' ')}
                </h3>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
