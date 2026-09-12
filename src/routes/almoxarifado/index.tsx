import { createFileRoute, Link } from '@tanstack/react-router'
import { Package, ReceiptText, ShoppingCart, ShieldCheck, Sprout, MapPin } from 'lucide-react'

export const Route = createFileRoute('/almoxarifado/')({
  component: AlmoxarifadoHub,
})

const HUB_ITEMS = [
  { name: 'Estoque', icon: Package, href: '/almoxarifado/estoque' },
  { name: 'Notas Fiscais', icon: ReceiptText, href: '/almoxarifado/notas-fiscais' },
  { name: 'Pedidos', icon: ShoppingCart, href: '/almoxarifado/pedidos' },
  { name: 'Requisição', icon: ShieldCheck, href: '/almoxarifado/requisicoes' },
  { name: 'Adubo', icon: Sprout, href: '/almoxarifado/adubo' },
  { name: 'Aspersores', icon: MapPin, href: '/almoxarifado/aspersores' },
]

function AlmoxarifadoHub() {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-transparent">
      <div className="max-w-6xl w-full h-full mx-auto flex flex-col items-center justify-start mt-2">
        
        {/* Title */}
        <div className="flex flex-col items-center justify-center mb-8 mt-2 animate-in fade-in slide-in-from-top-4 duration-500">
          <h1 className="text-[54px] font-display italic tracking-tight text-gray-900 dark:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" style={{ lineHeight: '1' }}>
            Almoxarifado
          </h1>
          <p className="text-gray-900 dark:text-white/70 text-sm mt-1 font-medium">Controle de estoque, notas fiscais e requisições</p>
        </div>

        {/* Grid of buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 w-full max-w-5xl animate-in fade-in zoom-in-95 duration-700">
          {HUB_ITEMS.map((item, idx) => {
            const Icon = item.icon
            return (
              <Link
                key={idx}
                to={item.href}
                className="group flex flex-col items-center justify-center py-8 px-6 rounded-3xl transition-all duration-300
                           bg-white text-black shadow-lg hover:shadow-xl hover:-translate-y-2 relative overflow-hidden"
              >
                
                <Icon size={48} className="mb-4 text-black opacity-90 group-hover:scale-110 transition-transform duration-300 relative z-10" strokeWidth={1.5} />
                <span className="text-4xl font-display italic tracking-tight relative z-10">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}


