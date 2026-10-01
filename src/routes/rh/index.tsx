import Users from 'lucide-react/dist/esm/icons/users.js';
import ClipboardList from 'lucide-react/dist/esm/icons/clipboard-list.js';
import FileBarChart from 'lucide-react/dist/esm/icons/file-chart-column-increasing.js';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.js';
import { createFileRoute, Link } from '@tanstack/react-router'

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
    <div className="flex flex-col h-full overflow-y-auto pb-24 custom-scrollbar bg-transparent">
      <div className="max-w-4xl w-full mx-auto flex flex-col items-center justify-start mt-2">
        
        {/* Title */}
        <div className="flex flex-col items-center justify-center mb-4 mt-2 animate-in fade-in slide-in-from-top-4 duration-500 w-full px-1">
          <h1
            className="tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] text-center"
            style={{ fontSize: 'clamp(26px, 8vw, 54px)', lineHeight: '1' }}
          >
            Recursos Humanos
          </h1>
          <p className="text-white/ text-sm mt-2 font-medium text-center">
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
                className="group relative flex flex-col items-center justify-center p-6 h-40 rounded-[32px] liquid-card-effect transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              >
                <div className="mb-4 transition-transform duration-500 group-hover:scale-110 z-10">
                  <Icon className="w-10 h-10 text-current opacity-90" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl tracking-wide font-medium text-center whitespace-pre-line leading-tight z-10 text-current">
                  {item.name}
                </h3>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
