import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeftRight, Truck, ListChecks, ClipboardCheck, MapPin } from 'lucide-react'

export const Route = createFileRoute('/equipamentos/')({
  component: EquipamentosHub,
})

const HUB_ITEMS = [
  { name: 'Entrada e Saída', icon: ArrowLeftRight, href: '/equipamentos/entrada-saida', desc: 'Registrar movimentações' },
  { name: 'Painel do Motorista', icon: MapPin, href: '/equipamentos/painel-motorista', desc: 'Acompanhamento de rotas e atividades' },
  { name: 'App Motorista', icon: Truck, href: '/equipamentos/app-motorista', desc: 'Aplicativo do motorista' },
  { name: 'Parte Diária', icon: Truck, href: '/equipamentos/parte-diaria', desc: 'Relatório diário' },
  { name: 'Todos os Equipamentos', icon: ListChecks, href: '/equipamentos/todos', desc: 'Visualizar a frota completa' },
  { name: 'Vistoria de Equipamentos', icon: ClipboardCheck, href: '/equipamentos/vistoria', desc: 'Laudos e manutenções' },
]

function EquipamentosHub() {
  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="max-w-4xl w-full mx-auto flex flex-col items-center justify-start mt-8 sm:mt-12">
        
        {/* Title */}
        <div className="flex flex-col items-center justify-center mb-6 sm:mb-8 mt-4 sm:mt-6 animate-in fade-in slide-in-from-top-4 duration-500 w-full px-1">
          <h1
            className="font-display italic tracking-tight text-gray-900 dark:text-white drop-shadow-md text-center py-4"
            style={{ fontSize: 'clamp(28px, 8vw, 54px)', lineHeight: 'normal' }}
          >
            Equipamentos
          </h1>
          <p className="text-gray-900 dark:text-white/70 text-sm mt-2 font-medium text-center">
            Controle de frotas, movimentações e vistorias
          </p>
        </div>

        {/* Grid — 1 col mobile, 2 col tablet+ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 w-full animate-in fade-in zoom-in-95 duration-700">
          {HUB_ITEMS.map((item, idx) => {
            const Icon = item.icon
            return (
              <Link
                key={idx}
                to={item.href as any}
                className="group flex items-center sm:flex-col sm:items-center sm:justify-center gap-4 sm:gap-4
                           py-5 px-5 sm:py-10 sm:px-6 rounded-2xl sm:rounded-3xl transition-all duration-300
                           bg-white text-black shadow-md hover:shadow-xl hover:-translate-y-1 sm:hover:-translate-y-2
                           relative overflow-hidden active:scale-[0.98]"
                style={{ minHeight: 72 }}
              >
                <Icon
                  size={36}
                  className="text-black opacity-90 group-hover:scale-110 transition-transform duration-300 relative z-10 flex-shrink-0 sm:w-12 sm:h-12"
                  strokeWidth={1.5}
                />
                <div className="flex flex-col min-w-0 sm:items-center">
                  <span className="text-xl sm:text-3xl md:text-4xl font-display italic tracking-tight relative z-10 sm:text-center overflow-wrap-anywhere">
                    {item.name}
                  </span>
                  <span className="text-sm text-black/50 mt-0.5 sm:mt-1 sm:text-center">
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
