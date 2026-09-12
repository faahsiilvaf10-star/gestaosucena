import { createFileRoute, Link } from '@tanstack/react-router'
import { Package, ReceiptText, ShoppingCart, ShieldCheck, Sprout, MapPin } from 'lucide-react'

export const Route = createFileRoute('/almoxarifado/')({
  component: AlmoxarifadoHub,
})

const HUB_ITEMS = [
  { name: 'Estoque', icon: Package, href: '/almoxarifado/estoque', desc: 'Produtos e insumos' },
  { name: 'Notas Fiscais', icon: ReceiptText, href: '/almoxarifado/notas-fiscais', desc: 'Documentos fiscais' },
  { name: 'Pedidos', icon: ShoppingCart, href: '/almoxarifado/pedidos', desc: 'Compras e solicitações' },
  { name: 'Requisição', icon: ShieldCheck, href: '/almoxarifado/requisicoes', desc: 'EPIs e materiais' },
  { name: 'Adubo', icon: Sprout, href: '/almoxarifado/adubo', desc: 'Controle de adubação' },
  { name: 'Aspersores', icon: MapPin, href: '/almoxarifado/aspersores', desc: 'Mapa de irrigação' },
]

function AlmoxarifadoHub() {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-transparent">
      <div className="max-w-5xl w-full mx-auto flex flex-col items-center justify-start mt-2">
        
        {/* Title */}
        <div className="flex flex-col items-center justify-center mb-6 sm:mb-8 mt-2 animate-in fade-in slide-in-from-top-4 duration-500 w-full px-1">
          <h1
            className="font-display italic tracking-tight text-gray-900 dark:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] text-center"
            style={{ fontSize: 'clamp(28px, 8vw, 54px)', lineHeight: '1' }}
          >
            Almoxarifado
          </h1>
          <p className="text-gray-900 dark:text-white/70 text-sm mt-2 font-medium text-center">
            Controle de estoque, notas fiscais e requisições
          </p>
        </div>

        {/* Grid — 1 col mobile, 2 col sm, 3 col lg */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 w-full animate-in fade-in zoom-in-95 duration-700">
          {HUB_ITEMS.map((item, idx) => {
            const Icon = item.icon
            return (
              <Link
                key={idx}
                to={item.href as any}
                className="group flex items-center sm:flex-col sm:items-center sm:justify-center
                           gap-4 sm:gap-3
                           py-4 sm:py-8 px-4 sm:px-6 rounded-2xl sm:rounded-3xl transition-all duration-300
                           bg-white text-black shadow-md hover:shadow-xl hover:-translate-y-1 sm:hover:-translate-y-2
                           relative overflow-hidden active:scale-[0.98]"
                style={{ minHeight: 68 }}
              >
                <Icon
                  size={32}
                  className="text-black opacity-90 group-hover:scale-110 transition-transform duration-300 relative z-10 flex-shrink-0 sm:w-12 sm:h-12 sm:mb-1"
                  strokeWidth={1.5}
                />
                <div className="flex flex-col min-w-0 sm:items-center">
                  <span className="text-xl sm:text-3xl lg:text-4xl font-display italic tracking-tight relative z-10 sm:text-center">
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
