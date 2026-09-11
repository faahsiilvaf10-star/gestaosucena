import { createFileRoute, Link } from '@tanstack/react-router'
import { usePurchaseOrderById, useUpdatePurchaseOrder, useUpdatePurchaseOrderItem } from '@/hooks/usePurchaseOrders'
import { StatusBadge } from '@/components/pedidos/StatusBadge'
import { PriorityBadge } from '@/components/pedidos/PriorityBadge'
import { ArrowLeft, Calendar, Package, ShoppingCart, User, AlertCircle, FileText, CheckCircle2, History } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/almoxarifado/pedidos/$id')({
  component: PedidoDetailsPage,
})

function PedidoDetailsPage() {
  const { id } = Route.useParams()
  const { data: pedido, isLoading } = usePurchaseOrderById(id)
  const updateOrder = useUpdatePurchaseOrder()
  const updateItem = useUpdatePurchaseOrderItem()

  const [isReceiving, setIsReceiving] = useState(false)
  const [receiveModalOpen, setReceiveModalOpen] = useState(false)
  const [receiveData, setReceiveData] = useState<Record<string, number>>({})

  if (isLoading) {
    return <div className="p-8 flex justify-center text-muted-foreground">Carregando detalhes do pedido...</div>
  }

  if (!pedido) {
    return <div className="p-8 flex justify-center text-destructive">Pedido não encontrado.</div>
  }

  const isLate = pedido.status !== 'Recebido' && pedido.status !== 'Cancelado' && pedido.status !== 'Rascunho' && new Date(pedido.expected_delivery_date) < new Date()

  // Handler para receber os itens
  const handleReceive = async () => {
    setIsReceiving(true)
    try {
      let allFullyReceived = true
      
      // Atualizar as quantidades recebidas
      for (const item of pedido.items || []) {
        const toReceive = receiveData[item.id] || 0
        if (toReceive > 0) {
          const newTotal = (Number(item.quantity_received) || 0) + Number(toReceive)
          
          if (newTotal > Number(item.quantity)) {
            toast.error(`Quantidade de "${item.product_name}" não pode ultrapassar o solicitado (${item.quantity}).`)
            setIsReceiving(false)
            return
          }
          
          await updateItem.mutateAsync({
            id: item.id,
            updates: { quantity_received: newTotal }
          })
          
          if (newTotal < Number(item.quantity)) {
            allFullyReceived = false
          }
        } else if (Number(item.quantity_received) < Number(item.quantity)) {
          allFullyReceived = false
        }
      }

      // Atualizar status do pedido
      const newStatus = allFullyReceived ? 'Recebido' : 'Recebimento Parcial'
      
      await updateOrder.mutateAsync({
        id: pedido.id,
        updates: { 
          status: newStatus,
          ...(newStatus === 'Recebido' ? { received_at: new Date().toISOString() } : {})
        }
      })

      setReceiveModalOpen(false)
      toast.success('Recebimento registrado com sucesso!')
      
    } catch (error) {
      console.error(error)
      toast.error('Erro ao registrar recebimento.')
    } finally {
      setIsReceiving(false)
    }
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Link to="/almoxarifado/pedidos" className="hover:text-foreground transition-colors flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Voltar para Pedidos
            </Link>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Pedido {pedido.order_number ? String(pedido.order_number).padStart(4, '0') : 'Rascunho'}
          </h2>
        </div>
        
        <div className="flex gap-2">
          {pedido.status !== 'Recebido' && pedido.status !== 'Cancelado' && pedido.status !== 'Rascunho' && (
            <Dialog open={receiveModalOpen} onOpenChange={setReceiveModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary shadow-md">
                  <Package className="w-4 h-4 mr-2" />
                  REGISTRAR RECEBIMENTO
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Registrar Recebimento de Materiais</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Informe a quantidade que está sendo recebida agora. Deixe em zero para os itens que não chegaram.
                  </p>
                  
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-left">
                        <tr>
                          <th className="p-3">Produto</th>
                          <th className="p-3 text-center">Solicitado</th>
                          <th className="p-3 text-center">Já Recebido</th>
                          <th className="p-3 text-center">A Receber Agora</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {pedido.items?.map(item => {
                          const faltam = Number(item.quantity) - Number(item.quantity_received || 0)
                          const isFullyReceived = faltam <= 0
                          
                          return (
                            <tr key={item.id} className={isFullyReceived ? 'bg-muted/30 opacity-60' : ''}>
                              <td className="p-3 font-medium">{item.product_name} <span className="text-muted-foreground text-xs">{item.unit}</span></td>
                              <td className="p-3 text-center">{item.quantity}</td>
                              <td className="p-3 text-center">{item.quantity_received || 0}</td>
                              <td className="p-3">
                                <Input 
                                  type="number" 
                                  className="w-24 mx-auto text-center h-8"
                                  min="0"
                                  max={faltam}
                                  step="any"
                                  disabled={isFullyReceived}
                                  placeholder={faltam.toString()}
                                  value={receiveData[item.id] !== undefined ? receiveData[item.id] : ''}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? 0 : Number(e.target.value)
                                    setReceiveData(prev => ({...prev, [item.id]: val}))
                                  }}
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setReceiveModalOpen(false)}>Cancelar</Button>
                  <Button onClick={handleReceive} disabled={isReceiving}>
                    {isReceiving ? 'Registrando...' : 'Confirmar Recebimento'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Button variant="outline" onClick={() => window.print()}>Imprimir</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Resumo lateral */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
              <AlertCircle className="w-5 h-5 text-muted-foreground" />
              Status Atual
            </h3>
            <div className="flex justify-between items-center">
              <StatusBadge status={pedido.status} />
              <PriorityBadge priority={pedido.priority} />
            </div>
            {isLate && (
              <div className="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 p-3 rounded-lg text-sm font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Pedido Atrasado
              </div>
            )}
            
            <div className="pt-4 space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Solicitado em</p>
                  <p className="font-medium">{format(new Date(pedido.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Package className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Previsão</p>
                  <p className="font-medium">{format(new Date(pedido.expected_delivery_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                </div>
              </div>
              {pedido.received_at && (
                <div className="flex items-start gap-3 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-4 h-4 mt-0.5" />
                  <div>
                    <p className="text-xs">Recebido em</p>
                    <p className="font-medium">{format(new Date(pedido.received_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
              <User className="w-5 h-5 text-muted-foreground" />
              Envolvidos
            </h3>
            
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Responsável pelo Pedido</p>
                <div className="font-medium text-base">{pedido.responsible?.nome || '-'}</div>
                <div className="text-xs text-muted-foreground">{pedido.responsible?.cargo || 'Cargo não informado'}</div>
              </div>
            </div>
          </div>
          
          {pedido.notes && (
            <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                <FileText className="w-5 h-5 text-muted-foreground" />
                Observações Gerais
              </h3>
              <p className="text-sm whitespace-pre-wrap">{pedido.notes}</p>
            </div>
          )}
        </div>

        {/* Lista de Itens */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b bg-muted/20 flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-muted-foreground" />
                Itens Solicitados
                <span className="text-sm font-normal bg-background px-2 py-0.5 rounded-full border">
                  {pedido.items?.length || 0}
                </span>
              </h3>
            </div>
            
            <div className="divide-y">
              {pedido.items?.map((item, index) => {
                const percRecebido = Math.min(100, Math.round(((Number(item.quantity_received) || 0) / Number(item.quantity)) * 100))
                
                return (
                  <div key={item.id} className="p-5 hover:bg-muted/30 transition-colors">
                    <div className="flex flex-col sm:flex-row gap-5">
                      {item.image_path ? (
                        <div className="w-24 h-24 bg-muted rounded-lg overflow-hidden border flex-shrink-0">
                          {/* supabase storage fetcher (na vida real usar a url publica) */}
                          <img 
                            src={supabase.storage.from('purchase-order-items').getPublicUrl(item.image_path).data.publicUrl} 
                            alt={item.product_name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-24 h-24 bg-muted/50 rounded-lg border border-dashed flex items-center justify-center flex-shrink-0 text-muted-foreground">
                          Sem Foto
                        </div>
                      )}
                      
                      <div className="flex-1 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-lg text-foreground">
                              <span className="text-muted-foreground font-normal text-sm mr-2">{String(index+1).padStart(2, '0')}</span>
                              {item.product_name}
                            </h4>
                            <p className="text-sm text-muted-foreground">Categoria: {item.category}</p>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-2xl font-bold">{item.quantity} <span className="text-sm font-normal text-muted-foreground">{item.unit}</span></div>
                          </div>
                        </div>
                        
                        {item.description && (
                          <div className="text-sm bg-muted/30 p-2 rounded border">
                            <span className="font-medium block text-xs text-muted-foreground mb-1">Especificação:</span>
                            {item.description}
                          </div>
                        )}
                        
                        {(pedido.status === 'Recebido' || pedido.status === 'Recebimento Parcial') && (
                          <div className="pt-2">
                            <div className="flex justify-between text-xs mb-1">
                              <span>Progresso de recebimento:</span>
                              <span className="font-medium">{item.quantity_received || 0} de {item.quantity}</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                              <div 
                                className={`h-full ${percRecebido === 100 ? 'bg-green-500' : 'bg-primary'}`} 
                                style={{ width: `${percRecebido}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          
          {/* Histórico simplificado */}
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4 print:hidden">
            <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
              <History className="w-5 h-5 text-muted-foreground" />
              Linha do Tempo
            </h3>
            
            <div className="relative border-l-2 border-muted ml-3 space-y-6 pt-2 pb-2">
              <div className="relative pl-6">
                <div className="absolute w-3 h-3 bg-primary rounded-full -left-[7px] top-1.5 ring-4 ring-card"></div>
                <div className="font-medium">Pedido Solicitado</div>
                <div className="text-sm text-muted-foreground">{format(new Date(pedido.created_at), "dd/MM/yyyy 'às' HH:mm")}</div>
              </div>
              
              {pedido.received_at && (
                <div className="relative pl-6">
                  <div className="absolute w-3 h-3 bg-green-500 rounded-full -left-[7px] top-1.5 ring-4 ring-card"></div>
                  <div className="font-medium">Recebimento Finalizado</div>
                  <div className="text-sm text-muted-foreground">{format(new Date(pedido.received_at), "dd/MM/yyyy 'às' HH:mm")}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
