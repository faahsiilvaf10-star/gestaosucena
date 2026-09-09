import { createFileRoute, Link } from '@tanstack/react-router'
import { Users, ClipboardList, FileBarChart, CalendarDays } from 'lucide-react'

export const Route = createFileRoute('/rh/')({
  component: RhHub,
})

const HUB_ITEMS = [
  { name: 'Efetivo', icon: Users, href: '/rh/efetivo' },
  { name: 'Relatório de Presença', icon: ClipboardList, href: '#' },
  { name: 'Lista de Presença', icon: FileBarChart, href: '/rh/lista-presenca' },
  { name: 'Calendário Hydro', icon: CalendarDays, href: '#' },
]

function RhHub() {
  return (
    <div className="flex flex-col h-full p-4 md:p-8 overflow-hidden bg-transparent">
      <div className="max-w-6xl w-full h-full mx-auto flex flex-col items-center justify-center">
        
        {/* Title */}
        <div className="flex items-center gap-4 mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
          <h1 className="text-5xl font-display italic tracking-tight text-gray-900 dark:text-white">Recursos Humanos</h1>
        </div>

        {/* Grid of buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 w-full max-w-4xl animate-in fade-in zoom-in-95 duration-700">
          {HUB_ITEMS.map((item, idx) => {
            const Icon = item.icon
            return (
              <Link
                key={idx}
                to={item.href}
                className="group flex flex-col items-center text-center justify-center py-12 px-6 rounded-3xl transition-all duration-300
                           bg-white text-black shadow-lg hover:shadow-xl hover:-translate-y-2 relative overflow-hidden"
              >
                <Icon size={48} className="mb-4 text-black opacity-90 group-hover:scale-110 transition-transform duration-300 relative z-10" strokeWidth={1.5} />
                <span className="text-3xl md:text-4xl font-display italic tracking-tight relative z-10">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
