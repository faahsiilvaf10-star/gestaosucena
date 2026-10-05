import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js';
import Calendar from 'lucide-react/dist/esm/icons/calendar.js';
import Package from 'lucide-react/dist/esm/icons/package.js';
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart.js';
import User from 'lucide-react/dist/esm/icons/user.js';
import AlertCircle from 'lucide-react/dist/esm/icons/circle-alert.js';
import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.js';
import History from 'lucide-react/dist/esm/icons/history.js';
import Download from 'lucide-react/dist/esm/icons/download.js';
import ZoomIn from 'lucide-react/dist/esm/icons/zoom-in.js';
import { createFileRoute, Link } from '@tanstack/react-router'
import { usePurchaseOrderById, useUpdatePurchaseOrder, useUpdatePurchaseOrderItem, useUpdateStatusWithWhatsApp, type PurchaseOrderStatus } from '@/hooks/usePurchaseOrders'
import { StatusBadge } from '@/components/pedidos/StatusBadge'
import { PriorityBadge } from '@/components/pedidos/PriorityBadge'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'

export const Route = createFileRoute('/almoxarifado/pedidos/$id')({
  component: PedidoDetailsPage,
})

function PedidoDetailsPage() {
  const { id } = Route.useParams()
  const { data: pedido, isLoading } = usePurchaseOrderById(id)
  const updateOrder = useUpdatePurchaseOrder()
  const updateItem = useUpdatePurchaseOrderItem()
  const updateStatus = useUpdateStatusWithWhatsApp()

  const { data: currentUserInfo } = useQuery({
    queryKey: ['current_user_info'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      return {
        id: user.id,
        name: user.user_metadata?.full_name || user.email || 'Usuário',
        isAdmin: user.user_metadata?.role?.toLowerCase().includes('admin') || user.user_metadata?.role?.toLowerCase().includes('diretor')
      }
    }
  })

  const currentUserName = currentUserInfo?.name || 'Usuário'
  
  const isRequester = pedido?.requester_user_id === currentUserInfo?.id
  const isResponsible = pedido?.responsibles?.some(r => r.id === currentUserInfo?.id) || pedido?.responsible?.id === currentUserInfo?.id
  const isAdmin = currentUserInfo?.isAdmin

  const canChangeAnyStatus = isResponsible || isAdmin
  const canCancelOnly = isRequester && !canChangeAnyStatus
  const canChangeStatusAtAll = canChangeAnyStatus || canCancelOnly

  const ALL_STATUSES: PurchaseOrderStatus[] = [
    'Rascunho', 'Solicitado', 'Em Compra', 'Comprado', 'Recebimento Parcial', 'Recebido', 'Cancelado'
  ]

  const [isReceiving, setIsReceiving] = useState(false)
  const [receiveModalOpen, setReceiveModalOpen] = useState(false)
  const [receiveData, setReceiveData] = useState<Record<string, number>>({})
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)

  const handleDownloadImage = async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `imagem-${Date.now()}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    } catch (e) {
      window.open(url, '_blank')
    }
  }

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

            {/* Alterar status */}
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-2">Alterar Status</p>
              
              {!canChangeStatusAtAll ? (
                <div className="text-sm bg-muted/50 p-2 rounded text-muted-foreground text-center">
                  Você não tem permissão para alterar este status.
                </div>
              ) : (
                <Select
                  value={pedido.status}
                  onValueChange={(val) => updateStatus.mutate({
                    orderId: pedido.id,
                    orderNumber: pedido.order_number,
                    newStatus: val as PurchaseOrderStatus,
                    changedByName: currentUserName,
                  })}
                  disabled={updateStatus.isPending}
                >
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {canCancelOnly ? (
                      // Se for só requisitante (e não admin/responsável), 
                      // só pode manter o status atual ou Cancelar.
                      [pedido.status, 'Cancelado'].filter((v, i, a) => a.indexOf(v) === i).map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))
                    ) : (
                      // Responsáveis/Admins podem ver todos
                      ALL_STATUSES.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            
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
                {pedido.responsibles && pedido.responsibles.length > 0 ? (
                  pedido.responsibles.map((resp, idx) => (
                    <div key={idx} className={idx > 0 ? "mt-3" : ""}>
                      <div className="font-medium text-base">{resp.nome}</div>
                      <div className="text-xs text-muted-foreground">{resp.cargo || 'Cargo não informado'}</div>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="font-medium text-base">{pedido.responsible?.nome || '-'}</div>
                    <div className="text-xs text-muted-foreground">{pedido.responsible?.cargo || 'Cargo não informado'}</div>
                  </>
                )}
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

        {/* Lista de Itens (Estilo Nota / Cupom) */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-card border-2 border-dashed rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-dashed flex justify-between items-center bg-muted/10">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-muted-foreground" />
                Itens Solicitados
              </h3>
              <span className="text-sm font-bold bg-muted px-3 py-1 rounded-full">
                {pedido.items?.length || 0} {(pedido.items?.length || 0) === 1 ? 'item' : 'itens'}
              </span>
            </div>
            
            <div className="p-2 sm:p-5">
              {pedido.items?.map((item, index) => {
                const percRecebido = Math.min(100, Math.round(((Number(item.quantity_received) || 0) / Number(item.quantity)) * 100))
                
                return (
                  <div key={item.id} className="flex flex-col sm:flex-row items-start gap-4 p-3 hover:bg-muted/30 transition-colors rounded-lg mb-2">
                    {/* Imagem do item */}
                    {item.image_path ? (
                      <div 
                        className="w-16 h-16 bg-muted rounded-md overflow-hidden border flex-shrink-0 cursor-pointer relative group"
                        onClick={() => setFullscreenImage(item.image_path!.startsWith('http') ? item.image_path! : supabase.storage.from('purchase-order-items').getPublicUrl(item.image_path!).data.publicUrl)}
                        title="Ver imagem ampliada"
                      >
                        <img 
                          src={item.image_path.startsWith('http') ? item.image_path : supabase.storage.from('purchase-order-items').getPublicUrl(item.image_path).data.publicUrl} 
                          alt={item.product_name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ZoomIn className="w-6 h-6 text-white drop-shadow-md" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-muted/50 rounded-md border border-dashed flex items-center justify-center flex-shrink-0 text-[10px] text-muted-foreground text-center px-1">
                        Sem Foto
                      </div>
                    )}
                    
                    {/* Detalhes na Nota */}
                    <div className="flex-1 w-full flex flex-col justify-center min-h-[4rem]">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <h4 className="font-bold text-base text-foreground leading-tight">
                            <span className="text-muted-foreground font-normal text-sm mr-2">{String(index+1).padStart(2, '0')}</span>
                            {item.product_name}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-0.5">Cat: {item.category || '-'}</p>
                        </div>
                        
                        <div className="text-right shrink-0 flex flex-col items-end">
                          <div className="text-lg font-bold bg-muted/40 px-2 py-0.5 rounded">{item.quantity} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span></div>
                        </div>
                      </div>
                      
                      {item.description && (
                        <div className="text-xs text-muted-foreground mt-2 italic border-l-2 border-muted pl-2">
                          {item.description}
                        </div>
                      )}
                      
                      {(pedido.status === 'Recebido' || pedido.status === 'Recebimento Parcial') && (
                        <div className="pt-3 mt-2 border-t border-dashed">
                          <div className="flex justify-between text-[11px] mb-1 font-medium">
                            <span>Progresso:</span>
                            <span>{item.quantity_received || 0} de {item.quantity}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full ${percRecebido === 100 ? 'bg-green-500' : 'bg-primary'}`} 
                              style={{ width: `${percRecebido}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
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

      {/* Fullscreen Image Modal */}
      <Dialog open={!!fullscreenImage} onOpenChange={(open) => !open && setFullscreenImage(null)}>
        <DialogContent className="max-w-4xl p-1 bg-transparent border-none shadow-none focus-visible:outline-none">
          {fullscreenImage && (
            <div className="relative flex flex-col items-center justify-center">
              <div className="relative group rounded-xl overflow-hidden shadow-2xl bg-black/80 ring-1 ring-white/10">
                <img 
                  src={fullscreenImage} 
                  alt="Imagem ampliada" 
                  className="max-h-[80vh] w-auto object-contain" 
                />
                
                {/* Ações que aparecem no hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-6">
                  <Button 
                    className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md shadow-xl rounded-full px-6 flex items-center gap-2"
                    onClick={() => handleDownloadImage(fullscreenImage)}
                  >
                    <Download className="w-4 h-4" />
                    Baixar Imagem
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
