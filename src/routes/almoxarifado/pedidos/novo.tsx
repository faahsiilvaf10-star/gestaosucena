import { createFileRoute, Link } from '@tanstack/react-router'
import { PurchaseOrderForm } from '@/components/pedidos/PurchaseOrderForm'
import { ArrowLeft, ShoppingCart } from 'lucide-react'

export const Route = createFileRoute('/almoxarifado/pedidos/novo')({
  component: NovoPedidoPage,
})

function NovoPedidoPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Link to="/almoxarifado/pedidos" className="hover:text-foreground transition-colors flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Pedidos de Compra
            </Link>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShoppingCart className="w-8 h-8 text-primary" />
            Novo Pedido de Compra
          </h2>
          <p className="text-muted-foreground">
            Crie uma nova solicitação. O número do pedido será gerado automaticamente.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <PurchaseOrderForm />
      </div>
    </div>
  )
}
