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
    <div className="flex flex-col h-full overflow-hidden bg-transparent">
      <div className="max-w-6xl w-full h-full mx-auto flex flex-col items-center justify-start mt-2">
        
        {/* Title */}
        <div className="flex flex-col items-center justify-center mb-8 mt-2 animate-in fade-in slide-in-from-top-4 duration-500">
          <h1 className="font-display italic tracking-tight text-gray-900 dark:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" style={{ fontSize: 'clamp(28px, 8vw, 54px)', lineHeight: '1' }}>
            Meio Ambiente
          </h1>
          <p className="text-gray-900 dark:text-white/70 text-sm mt-1 font-medium">Gestão de recursos hídricos e resíduos</p>
        </div>

        {/* Grid of buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 w-full max-w-6xl animate-in fade-in zoom-in-95 duration-700">
          {HUB_ITEMS.map((item, idx) => {
            const Icon = item.icon
            return (
              <Link
                key={idx}
                to={item.href}
                className="group flex flex-col items-center justify-center py-12 px-6 rounded-3xl transition-all duration-300
                           bg-white text-black shadow-lg hover:shadow-xl hover:-translate-y-2 relative overflow-hidden"
              >
                <Icon size={48} className="mb-4 text-black opacity-90 group-hover:scale-110 transition-transform duration-300 relative z-10" strokeWidth={1.5} />
                <span className="text-3xl md:text-3xl font-display italic tracking-tight relative z-10 text-center">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
