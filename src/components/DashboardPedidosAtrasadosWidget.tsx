import React, { useState, useEffect, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import {
  ShoppingCart,
  AlertCircle,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Package,
  User,
  Loader2,
} from 'lucide-react'
import { differenceInDays, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { WhatsAppIcon } from './WhatsAppIcon'
import { sendDelayedPurchaseOrderWhatsappNotification } from '../lib/whatsappHelpers'
import { toast } from 'sonner'
import { StatusBadge } from './pedidos/StatusBadge'
import { PriorityBadge } from './pedidos/PriorityBadge'

export interface DelayedPurchaseOrder {
  id: string
  order_number: number | null
  expected_delivery_date: string
  status: string
  priority: string
  notes: string | null
  created_at: string
  requester_user_id: string
  items: Array<{
    id: string
    product_name: string
    quantity: number
    unit: string
    description?: string | null
    image_path?: string | null
  }>
  responsibles: Array<{
    id: string
    nome: string
    cargo?: string
    telefone?: string
    phone?: string
  }>
  requesterName?: string
  diasAtraso: number
}

export function DashboardPedidosAtrasadosWidget() {
  const [delayedOrders, setDelayedOrders] = useState<DelayedPurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(0)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const pageSize = 3

  const fetchDelayedOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('al_purchase_orders')
        .select(`
          id,
          order_number,
          expected_delivery_date,
          status,
          priority,
          notes,
          created_at,
          requester_user_id,
          responsible_id,
          items:al_purchase_order_items(id, product_name, quantity, unit, description, image_path),
          al_purchase_order_responsibles(responsible_id)
        `)
        .not('status', 'in', '("Recebido","Cancelado","Rascunho")')
        .order('expected_delivery_date', { ascending: true })

      if (error) {
        console.error('Erro ao buscar pedidos em atraso no dashboard:', error)
        return
      }

      const { data: usersData } = await supabase.rpc('get_active_system_users')
      const usersMap = new Map((usersData || []).map((u: any) => [u.id, u]))

      const now = new Date()
      now.setHours(0, 0, 0, 0)

      const lateList: DelayedPurchaseOrder[] = []

      for (const order of data || []) {
        if (!order.expected_delivery_date) continue
        const expDate = parseISO(order.expected_delivery_date)
        expDate.setHours(0, 0, 0, 0)

        // Se a data de entrega é anterior a hoje, está em atraso
        if (expDate.getTime() < now.getTime()) {
          const diffDays = Math.max(1, differenceInDays(now, expDate))

          const respIds = order.al_purchase_order_responsibles?.map((r: any) => r.responsible_id) || []
          if (order.responsible_id && !respIds.includes(order.responsible_id)) {
            respIds.push(order.responsible_id)
          }

          const responsibles = respIds.map((id: string) => usersMap.get(id)).filter(Boolean)
          const requester = usersMap.get(order.requester_user_id)

          lateList.push({
            id: order.id,
            order_number: order.order_number,
            expected_delivery_date: order.expected_delivery_date,
            status: order.status,
            priority: order.priority,
            notes: order.notes,
            created_at: order.created_at,
            requester_user_id: order.requester_user_id,
            items: order.items || [],
            responsibles,
            requesterName: requester?.nome || 'Requisitante',
            diasAtraso: diffDays,
          })
        }
      }

      setDelayedOrders(lateList)
    } catch (err) {
      console.error('Falha geral ao carregar pedidos em atraso no dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDelayedOrders()

    const handleRtUpdate = () => {
      fetchDelayedOrders()
    }
    window.addEventListener('sucena_dashboard_realtime_update', handleRtUpdate)

    const channel = supabase
      .channel(`dash_delayed_orders_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'al_purchase_orders' }, () => {
        fetchDelayedOrders()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'al_purchase_order_items' }, () => {
        fetchDelayedOrders()
      })
      .subscribe()

    const interval = setInterval(fetchDelayedOrders, 30000)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('sucena_dashboard_realtime_update', handleRtUpdate)
      clearInterval(interval)
    }
  }, [])

  const totalDelayed = delayedOrders.length
  const totalPages = Math.ceil(totalDelayed / pageSize)
  const currentItems = useMemo(() => {
    const start = currentPage * pageSize
    return delayedOrders.slice(start, start + pageSize)
  }, [delayedOrders, currentPage, pageSize])

  const handleResendWhatsApp = async (e: React.MouseEvent, order: DelayedPurchaseOrder) => {
    e.preventDefault()
    e.stopPropagation()
    setResendingId(order.id)
    const num = order.order_number ? `#${String(order.order_number).padStart(4, '0')}` : ''
    const toastId = toast.loading(`Reenviando alerta do pedido ${num} no WhatsApp...`)
    try {
      const res = await sendDelayedPurchaseOrderWhatsappNotification(
        order,
        order.requesterName,
        order.responsibles
      )
      if (res.success) {
        toast.success(`Alerta do pedido ${num} reenviado no WhatsApp com sucesso!`, { id: toastId })
      } else {
        toast.error(res.error || 'Falha ao reenviar no WhatsApp.', { id: toastId })
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao reenviar alerta no WhatsApp.', { id: toastId })
    } finally {
      setResendingId(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-card rounded-xl border p-5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-600 flex items-center justify-center">
            <ShoppingCart className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Pedidos em Atraso</h3>
            <p className="text-xs text-muted-foreground">Carregando pedidos de compra...</p>
          </div>
        </div>
        <div className="py-6 text-center text-xs text-muted-foreground">Verificando prazos...</div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-xs flex flex-col justify-between transition-all">
      {/* Cabeçalho do Widget */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-xs">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground tracking-tight flex items-center gap-2">
                Pedidos em Atraso
                {totalDelayed > 0 ? (
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-800">
                    {totalDelayed} {totalDelayed === 1 ? 'atrasado' : 'atrasados'}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    Em dia
                  </span>
                )}
              </h3>
              <p className="text-xs text-muted-foreground font-medium">Almoxarifado & Compras Pendentes</p>
            </div>
          </div>

          <Link
            to="/almoxarifado/pedidos"
            className="text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1 hover:underline transition shrink-0"
          >
            Ver todos <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Estado: Sem pedidos atrasados */}
        {totalDelayed === 0 ? (
          <div className="text-center py-6 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-dashed border-emerald-200 dark:border-emerald-800/40 my-2">
            <CheckCircle2 className="w-9 h-9 text-emerald-600 dark:text-emerald-400 mx-auto mb-2 opacity-90" />
            <p className="text-xs font-bold text-emerald-950 dark:text-emerald-200">Nenhum pedido em atraso</p>
            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5">
              Todos os pedidos de compra estão dentro do prazo previsto de entrega!
            </p>
            <Link
              to="/almoxarifado/pedidos"
              className="inline-flex items-center gap-1 mt-3 px-3 py-1.5 text-xs font-bold bg-background text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 shadow-xs transition"
            >
              Consultar Pedidos <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5 my-2">
            {currentItems.map((order) => {
              const numStr = order.order_number ? String(order.order_number).padStart(4, '0') : 'Rascunho'
              const respNames = order.responsibles.map((r) => r.nome).join(', ') || 'Nenhum'
              const itemsPreview = order.items.map((it) => `${it.quantity} ${it.unit || 'UN'} ${it.product_name}`).join(', ')

              return (
                <div
                  key={order.id}
                  className="p-3 bg-red-50/40 dark:bg-red-950/20 rounded-xl border border-red-200/80 dark:border-red-900/40 flex flex-col gap-2 hover:border-red-400 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-foreground">
                        Pedido #{numStr}
                      </span>
                      <StatusBadge status={order.status as any} />
                      <PriorityBadge priority={order.priority as any} />
                    </div>

                    <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {order.diasAtraso} {order.diasAtraso === 1 ? 'dia atrasado' : 'dias atrasados'}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground line-clamp-1">
                    <strong className="text-foreground">Itens:</strong> {itemsPreview || 'Nenhum item'}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-red-200/50 dark:border-red-900/30">
                    <div className="flex items-center gap-1 truncate max-w-[200px]" title={`Responsável: ${respNames}`}>
                      <User className="w-3 h-3 shrink-0" />
                      <span className="truncate">{respNames}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleResendWhatsApp(e, order)}
                        disabled={resendingId === order.id}
                        title="Reenviar alerta deste pedido em atraso no WhatsApp"
                        className="h-7 px-2.5 bg-[#25D366] hover:bg-[#1DA851] text-white rounded-lg font-bold text-[11px] flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {resendingId === order.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <WhatsAppIcon className="w-3.5 h-3.5 fill-white" />
                        )}
                        <span>WhatsApp</span>
                      </button>

                      <Link
                        to={`/almoxarifado/pedidos/${order.id}`}
                        className="h-7 px-2 bg-background border hover:bg-muted text-foreground rounded-lg font-semibold text-[11px] flex items-center gap-1 transition-colors"
                      >
                        <span>Abrir</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Paginação se houver mais que pageSize */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-border text-xs text-muted-foreground">
          <span>
            Página {currentPage + 1} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 cursor-pointer"
              title="Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 cursor-pointer"
              title="Próximo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
