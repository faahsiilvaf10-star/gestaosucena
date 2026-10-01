import Package from 'lucide-react/dist/esm/icons/package.js';
import ReceiptText from 'lucide-react/dist/esm/icons/receipt-text.js';
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart.js';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js';
import Sprout from 'lucide-react/dist/esm/icons/sprout.js';
import MapPin from 'lucide-react/dist/esm/icons/map-pin.js';
import { createFileRoute, Link } from '@tanstack/react-router'

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
    <div className="flex flex-col h-full overflow-y-auto pb-24 custom-scrollbar bg-transparent">
      <div className="max-w-5xl w-full mx-auto flex flex-col items-center justify-start mt-2">
        
        {/* Title */}
        <div className="flex flex-col items-center justify-center mb-4 mt-2 animate-in fade-in slide-in-from-top-4 duration-500 w-full px-1">
          <h1
            className="tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] text-center"
            style={{ fontSize: 'clamp(28px, 8vw, 54px)', lineHeight: '1' }}
          >
            Almoxarifado
          </h1>
          <p className="text-white/ text-sm mt-2 font-medium text-center">
            Controle de estoque, notas fiscais e requisições
          </p>
        </div>

        {/* Grid — 1 col mobile, 2 col sm, 3 col lg */}
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
