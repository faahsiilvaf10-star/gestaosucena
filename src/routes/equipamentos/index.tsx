import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeftRight, Truck, ListChecks, ClipboardCheck, MapPin } from 'lucide-react'

export const Route = createFileRoute('/equipamentos/')({
  component: EquipamentosHub,
})

const HUB_ITEMS = [
  { name: 'Entrada e Saída', icon: ArrowLeftRight, href: '/equipamentos/entrada-saida', desc: 'Registrar movimentações' },

  { name: 'App Motorista', icon: Truck, href: '/equipamentos/app-motorista', desc: 'Aplicativo do motorista' },
  { name: 'Parte Diária', icon: Truck, href: '/equipamentos/parte-diaria', desc: 'Relatório diário' },
  { name: 'Todos os Equipamentos', icon: ListChecks, href: '/equipamentos/todos', desc: 'Visualizar a frota completa' },
  { name: 'Vistoria de Equipamentos', icon: ClipboardCheck, href: '/equipamentos/vistoria', desc: 'Laudos e manutenções' },
]

function EquipamentosHub() {
  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="max-w-4xl w-full mx-auto flex flex-col items-center justify-start mt-2 sm:mt-4">
        
        {/* Title */}
        <div className="flex flex-col items-center justify-center mb-4 mt-2 animate-in fade-in slide-in-from-top-4 duration-500 w-full px-1">
          <h1
            className="tracking-tight text-gray-900 dark:text-white drop-shadow-md text-center py-1"
            style={{ fontSize: 'clamp(28px, 8vw, 54px)', lineHeight: 'normal' }}
          >
            Equipamentos
          </h1>
          <p className="text-gray-900 dark:text-white/70 text-sm mt-2 font-medium text-center">
            Controle de frotas, movimentações e vistorias
          </p>
        </div>

        {/* Grid — 1 col mobile, 2 col tablet+ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full animate-in fade-in zoom-in-95 duration-700">
          {HUB_ITEMS.map((item, idx) => {
            const Icon = item.icon
            return (
              <Link
                key={idx}
                to={item.href as any}
                className="group relative flex flex-col items-center justify-center p-3 rounded-[32px] bg-white transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-1 border border-gray-100"
              >
                <div className="mb-6 transition-transform duration-500 group-hover:scale-110">
                  <Icon className="w-10 h-10 text-gray-900" strokeWidth={1.5} />
                </div>
                <h3 className="text-2xl text-gray-900 tracking-wide font-medium text-center whitespace-pre-line leading-tight">
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
