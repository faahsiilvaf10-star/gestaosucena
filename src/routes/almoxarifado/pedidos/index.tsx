import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search, ShoppingCart, Clock, Package, AlertTriangle, ArrowLeft } from 'lucide-react'
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders'
import { StatusBadge } from '@/components/pedidos/StatusBadge'
import { format } from 'date-fns'
import { isPast, isToday, differenceInDays } from 'date-fns'

export const Route = createFileRoute('/almoxarifado/pedidos/')({
  component: PedidosPage,
})

function PedidosPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const { data: pedidos, isLoading } = usePurchaseOrders()

  const filteredPedidos = pedidos?.filter(pedido => {
    const matchesSearch = 
      pedido.order_number?.toString().includes(searchTerm) ||
      pedido.responsible?.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pedido.items?.some(item => item.product_name.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = statusFilter === 'Todos' || pedido.status === statusFilter

    return matchesSearch && matchesStatus
  }) || []

  // Calcular métricas
  const totalPedidos = pedidos?.length || 0
  const solicitados = pedidos?.filter(p => p.status === 'Solicitado').length || 0
  const emCompra = pedidos?.filter(p => p.status === 'Em Compra').length || 0
  const aguardandoRecebimento = pedidos?.filter(p => ['Comprado', 'Recebimento Parcial'].includes(p.status)).length || 0
  const recebidos = pedidos?.filter(p => p.status === 'Recebido').length || 0

  const getAtrasoInfo = (dateString: string, status: string) => {
    if (status === 'Recebido' || status === 'Cancelado' || status === 'Rascunho') return null
    
    const date = new Date(dateString)
    
    if (isToday(date)) {
      return <span className="text-amber-600 font-medium text-xs ml-2">Hoje</span>
    }
    
    if (isPast(date)) {
      const days = differenceInDays(new Date(), date)
      return (
        <span className="inline-flex items-center text-red-600 font-medium text-xs ml-2 bg-red-50 px-1.5 py-0.5 rounded">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Atrasado {days} {days === 1 ? 'dia' : 'dias'}
        </span>
      )
    }
    
    return null
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Link to="/almoxarifado" className="hover:text-foreground transition-colors flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Almoxarifado
            </Link>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShoppingCart className="w-8 h-8 text-primary" />
            Pedidos de Compra
          </h2>
          <p className="text-muted-foreground">
            Solicitações, acompanhamento e recebimento de materiais
          </p>
        </div>
        
        <Button 
          size="lg" 
          className="w-full sm:w-auto shadow-sm"
          onClick={() => navigate({ to: '/almoxarifado/pedidos/novo' })}
        >
          <Plus className="mr-2 h-5 w-5" />
          NOVO PEDIDO
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col justify-center">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Total de Pedidos</h3>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{isLoading ? '-' : totalPedidos}</div>
        </div>
        
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col justify-center border-l-4 border-l-blue-500">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Solicitados</h3>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold">{isLoading ? '-' : solicitados}</div>
        </div>
        
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col justify-center border-l-4 border-l-amber-500">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Em Compra</h3>
            <ShoppingCart className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold">{isLoading ? '-' : emCompra}</div>
        </div>
        
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col justify-center border-l-4 border-l-purple-500">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Aguardando Recebimento</h3>
            <Package className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold">{isLoading ? '-' : aguardandoRecebimento}</div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col justify-center border-l-4 border-l-green-500">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Recebidos</h3>
            <Package className="h-4 w-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold">{isLoading ? '-' : recebidos}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar pedido, item ou responsável..."
            className="pl-9 bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex w-full sm:w-auto gap-2 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
          {['Todos', 'Solicitados', 'Em Compra', 'Comprados', 'Recebimento Parcial', 'Recebidos', 'Cancelados'].map((status) => (
            <Button 
              key={status} 
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className="whitespace-nowrap"
            >
              {status}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabela de Resultados (Desktop) */}
      <div className="hidden md:block rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Pedido</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Itens</th>
                <th className="px-4 py-3 font-medium">Previsão</th>
                <th className="px-4 py-3 font-medium">Responsável</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Carregando pedidos...
                  </td>
                </tr>
              ) : filteredPedidos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum pedido encontrado.
                  </td>
                </tr>
              ) : (
                filteredPedidos.map((pedido) => (
                  <tr key={pedido.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {pedido.order_number ? String(pedido.order_number).padStart(4, '0') : 'Rascunho'}
                    </td>
                    <td className="px-4 py-3">
                      {format(new Date(pedido.created_at), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      {pedido.items?.length || 0} itens
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {format(new Date(pedido.expected_delivery_date), 'dd/MM/yyyy')}
                      {getAtrasoInfo(pedido.expected_delivery_date, pedido.status)}
                    </td>
                    <td className="px-4 py-3">
                      {pedido.responsible?.nome || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={pedido.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/almoxarifado/pedidos/${pedido.id}`}>
                        <Button variant="ghost" size="sm">Ver pedido</Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lista em Cards (Mobile) */}
      <div className="md:hidden space-y-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando pedidos...</div>
        ) : filteredPedidos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado.</div>
        ) : (
          filteredPedidos.map((pedido) => (
            <div key={pedido.id} className="bg-card border rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-lg">
                    Pedido {pedido.order_number ? String(pedido.order_number).padStart(4, '0') : 'Rascunho'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(pedido.created_at), 'dd/MM/yyyy')}
                  </div>
                </div>
                <StatusBadge status={pedido.status} />
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t">
                <div>
                  <span className="text-muted-foreground block">Itens</span>
                  <span className="font-medium">{pedido.items?.length || 0} itens</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Previsão</span>
                  <span className="font-medium flex items-center">
                    {format(new Date(pedido.expected_delivery_date), 'dd/MM/yyyy')}
                  </span>
                  <div>{getAtrasoInfo(pedido.expected_delivery_date, pedido.status)}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block">Responsável</span>
                  <span className="font-medium">{pedido.responsible?.nome || '-'}</span>
                </div>
              </div>
              
              <div className="pt-2">
                <Link to={`/almoxarifado/pedidos/${pedido.id}`}>
                  <Button variant="outline" className="w-full">Ver Pedido</Button>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  )
}