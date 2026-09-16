import { createFileRoute, Link } from '@tanstack/react-router'
import { CloudRain, Droplets, Trash2, Droplet } from 'lucide-react'

export const Route = createFileRoute('/meio-ambiente/')({
  component: MeioAmbienteHub,
})

const HUB_ITEMS = [
  { name: 'Pluviometria', icon: CloudRain, href: '/meio-ambiente/pluviometria' },
  { name: 'Caixa D\'Água', icon: Droplet, href: '/meio-ambiente/caixa-dagua' },
  { name: 'Resíduos e Efluentes', icon: Trash2, href: '/meio-ambiente/residuos' },
  { name: 'Consumo Abastecimento', icon: Droplets, href: '/meio-ambiente/consumo' },
]

function MeioAmbienteHub() {
  return (
    <div className="flex flex-col h-full overflow-y-auto pb-24 custom-scrollbar bg-transparent">
      <div className="max-w-6xl w-full h-full mx-auto flex flex-col items-center justify-start mt-2">
        
        {/* Title */}
        <div className="flex flex-col items-center justify-center mb-4 mt-2 animate-in fade-in slide-in-from-top-4 duration-500">
          <h1 className="font-display italic tracking-tight text-gray-900 dark:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" style={{ fontSize: 'clamp(28px, 8vw, 54px)', lineHeight: '1' }}>
            Meio Ambiente
          </h1>
          <p className="text-gray-900 dark:text-white/70 text-sm mt-1 font-medium">Gestão de recursos hídricos e resíduos</p>
        </div>

        {/* Grid of buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full max-w-6xl animate-in fade-in zoom-in-95 duration-700">
          {HUB_ITEMS.map((item, idx) => {
            const Icon = item.icon
            return (
              <Link
                key={idx}
                to={item.href}
                className="group relative flex flex-col items-center justify-center p-3 rounded-[32px] bg-white transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-1 border border-gray-100"
              >
                <div className="mb-6 transition-transform duration-500 group-hover:scale-110">
                  <Icon className="w-10 h-10 text-gray-900" strokeWidth={1.5} />
                </div>
                <h3 className="font-serif italic text-2xl text-gray-900 tracking-wide font-medium text-center whitespace-pre-line leading-tight">
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
