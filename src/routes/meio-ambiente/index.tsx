import CloudRain from 'lucide-react/dist/esm/icons/cloud-rain.js';
import Droplets from 'lucide-react/dist/esm/icons/droplets.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import Droplet from 'lucide-react/dist/esm/icons/droplet.js';
import { createFileRoute, Link } from '@tanstack/react-router'

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
          <h1 className="tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" style={{ fontSize: 'clamp(28px, 8vw, 54px)', lineHeight: '1' }}>
            Meio Ambiente
          </h1>
          <p className="text-white/ text-sm mt-1 font-medium">Gestão de recursos hídricos e resíduos</p>
        </div>

        {/* Grid of buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full max-w-6xl animate-in fade-in zoom-in-95 duration-700">
          {HUB_ITEMS.map((item, idx) => {
            const Icon = item.icon
            return (
              <Link
                key={idx}
                to={item.href}
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
