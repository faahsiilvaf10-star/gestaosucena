import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { getWhatsappSettings } from '../lib/settings'
import { sendWhatsappTextOnServer } from '../lib/whatsapp-api'

export type PurchaseOrderStatus = 'Rascunho' | 'Solicitado' | 'Em Compra' | 'Comprado' | 'Recebimento Parcial' | 'Recebido' | 'Cancelado'
export type PurchaseOrderPriority = 'Normal' | 'Urgente' | 'Crítico'

export interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  product_name: string
  category: string | null
  quantity: number
  quantity_received: number
  unit: string
  description: string | null
  notes: string | null
  image_path: string | null
  created_at: string
  updated_at: string
}

export interface PurchaseOrder {
  id: string
  order_number: number | null
  requester_user_id: string
  responsible_id: string | null
  expected_delivery_date: string
  priority: PurchaseOrderPriority
  status: PurchaseOrderStatus
  notes: string | null
  created_at: string
  updated_at: string
  received_at: string | null
  items?: PurchaseOrderItem[]
  responsible?: {
    id: string
    nome: string
    cargo: string
  }
}

export type CreatePurchaseOrderInput = Omit<PurchaseOrder, 'id' | 'order_number' | 'created_at' | 'updated_at' | 'received_at' | 'items' | 'responsible'> & {
  items: Omit<PurchaseOrderItem, 'id' | 'purchase_order_id' | 'created_at' | 'updated_at' | 'quantity_received'>[]
  responsible_ids?: string[]
}

export function usePurchaseOrders() {
  return useQuery({
    queryKey: ['purchase_orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('al_purchase_orders')
        .select(`
          *,
          items:al_purchase_order_items(*)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching purchase orders:', error)
        throw error
      }

      const { data: usersData } = await supabase.rpc('get_active_system_users')
      const usersMap = new Map((usersData || []).map((u: any) => [u.id, u]))

      return data.map((order: any) => ({
        ...order,
        responsible: order.responsible_id && usersMap.has(order.responsible_id)
          ? usersMap.get(order.responsible_id)
          : null
      })) as PurchaseOrder[]
    },
  })
}

export function usePurchaseOrderById(id: string) {
  return useQuery({
    queryKey: ['purchase_orders', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('al_purchase_orders')
        .select(`
          *,
          items:al_purchase_order_items(*)
        `)
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error fetching purchase order:', error)
        throw error
      }

      const { data: usersData } = await supabase.rpc('get_active_system_users')
      const usersMap = new Map((usersData || []).map((u: any) => [u.id, u]))

      return {
        ...data,
        responsible: data.responsible_id && usersMap.has(data.responsible_id)
          ? usersMap.get(data.responsible_id)
          : null
      } as PurchaseOrder
    },
    enabled: !!id,
  })
}

export function useNextPurchaseOrderNumber() {
  return useQuery({
    queryKey: ['next_purchase_order_number'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('al_purchase_orders')
        .select('order_number')
        .not('order_number', 'is', null)
        .order('order_number', { ascending: false })
        .limit(1)

      if (error) {
        console.error('Error fetching next order number:', error)
        return 1 // Fallback
      }

      if (!data || data.length === 0) return 1
      return (data[0].order_number || 0) + 1
    },
  })
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreatePurchaseOrderInput) => {
      const { items, responsible_ids, ...orderData } = input
      
      // se tiver múltiplos, gravamos o primeiro no responsible_id por retrocompatibilidade
      if (responsible_ids && responsible_ids.length > 0) {
        orderData.responsible_id = responsible_ids[0]
      }

      // Criar o pedido
      const { data: order, error: orderError } = await supabase
        .from('al_purchase_orders')
        .insert(orderData)
        .select()
        .single()

      if (orderError) throw orderError

      // Criar os múltiplos responsáveis se existirem
      if (responsible_ids && responsible_ids.length > 0) {
        const responsiblesToInsert = responsible_ids.map(id => ({
          purchase_order_id: order.id,
          responsible_id: id
        }))
        const { error: respError } = await supabase
          .from('al_purchase_order_responsibles')
          .insert(responsiblesToInsert)
          
        if (respError) console.error("Erro ao inserir multiplos responsaveis:", respError)
      }

      // Criar os itens
      if (items && items.length > 0) {
        const itemsToInsert = items.map(item => ({
          ...item,
          purchase_order_id: order.id
        }))

        const { error: itemsError } = await supabase
          .from('al_purchase_order_items')
          .insert(itemsToInsert)

        if (itemsError) {
          // Em um cenário real, deveríamos fazer rollback aqui
          throw itemsError
        }
      }

      return order
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] })
      toast.success('Pedido criado com sucesso!')
    },
    onError: (error) => {
      console.error('Erro ao criar pedido:', error)
      toast.error('Erro ao criar o pedido de compra.')
    }
  })
}

export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: Partial<PurchaseOrder> }) => {
      const { data, error } = await supabase
        .from('al_purchase_orders')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] })
      queryClient.invalidateQueries({ queryKey: ['purchase_orders', variables.id] })
    },
    onError: (error) => {
      console.error('Erro ao atualizar pedido:', error)
      toast.error('Erro ao atualizar o pedido.')
    }
  })
}

export function useUpdatePurchaseOrderItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: Partial<PurchaseOrderItem> }) => {
      const { data, error } = await supabase
        .from('al_purchase_order_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] })
    }
  })
}

export function useUploadItemImage() {
  return useMutation({
    mutationFn: async ({ file, path }: { file: File, path: string }) => {
      const { data, error } = await supabase.storage
        .from('purchase-order-items')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (error) {
        console.error('Error uploading image:', error)
        throw error
      }

      const { data: { publicUrl } } = supabase.storage
        .from('purchase-order-items')
        .getPublicUrl(data.path)

      return publicUrl
    },
    onError: (error) => {
      console.error('Erro ao fazer upload da imagem:', error)
      toast.error('Erro ao fazer upload da imagem.')
    }
  })
}

/**
 * Retorna os pedidos onde o usuário logado é responsável.
 * Busca na tabela de múltiplos responsáveis (al_purchase_order_responsibles).
 */
export function usePurchaseOrdersByCurrentUser() {
  return useQuery({
    queryKey: ['purchase_orders_mine'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      // IDs dos pedidos onde o usuário é responsável
      const { data: respRows } = await supabase
        .from('al_purchase_order_responsibles')
        .select('purchase_order_id')
        .eq('responsible_id', user.id)

      // Também pedidos onde responsible_id legado = user.id
      const orderIds = (respRows || []).map((r: any) => r.purchase_order_id)

      if (orderIds.length === 0) {
        // fallback: busca pelo campo legado responsible_id
        const { data, error } = await supabase
          .from('al_purchase_orders')
          .select('*, items:al_purchase_order_items(*)')
          .eq('responsible_id', user.id)
          .order('created_at', { ascending: false })
        if (error) throw error
        
        const { data: usersData } = await supabase.rpc('get_active_system_users')
        const usersMap = new Map((usersData || []).map((u: any) => [u.id, u]))
        
        return (data || []).map((order: any) => ({
          ...order,
          responsible: order.responsible_id && usersMap.has(order.responsible_id)
            ? usersMap.get(order.responsible_id)
            : null
        })) as PurchaseOrder[]
      }

      const { data, error } = await supabase
        .from('al_purchase_orders')
        .select('*, items:al_purchase_order_items(*)')
        .in('id', orderIds)
        .order('created_at', { ascending: false })

      if (error) throw error

      const { data: usersData } = await supabase.rpc('get_active_system_users')
      const usersMap = new Map((usersData || []).map((u: any) => [u.id, u]))

      return (data || []).map((order: any) => ({
        ...order,
        responsible: order.responsible_id && usersMap.has(order.responsible_id)
          ? usersMap.get(order.responsible_id)
          : null
      })) as PurchaseOrder[]
    },
  })
}

/**
 * Altera o status de um pedido e envia mensagem WhatsApp ao grupo.
 */
export function useUpdateStatusWithWhatsApp() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      orderId,
      orderNumber,
      newStatus,
      changedByName,
    }: {
      orderId: string
      orderNumber: number | null
      newStatus: PurchaseOrderStatus
      changedByName: string
    }) => {
      // 1. Atualiza no banco
      const { error } = await supabase
        .from('al_purchase_orders')
        .update({ status: newStatus, ...(newStatus === 'Recebido' ? { received_at: new Date().toISOString() } : {}) })
        .eq('id', orderId)

      if (error) throw error

      // 2. Envia WhatsApp
      try {
        const wSettings = await getWhatsappSettings()
        const targetPhone = wSettings?.purchaseOrders?.specificGroupId || wSettings?.groupId
        if (wSettings?.url && wSettings?.token && wSettings?.instanceId && targetPhone) {
          const numStr = orderNumber ? String(orderNumber).padStart(4, '0') : 'Rascunho'
          const msg = `🔄 *Status do Pedido Atualizado*\n\n📋 *Pedido #${numStr}*\n📊 *Novo Status:* ${newStatus}\n👤 *Alterado por:* ${changedByName}\n\n_Mensagem Automática - G. Sucena_`

          await sendWhatsappTextOnServer({
            data: {
              url: wSettings.url,
              instanceId: wSettings.instanceId,
              token: wSettings.token,
              phone: targetPhone,
              text: msg,
            }
          })
        }
      } catch (wpErr) {
        // Não bloqueia o fluxo se WhatsApp falhar
        console.error('WhatsApp notify failed:', wpErr)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] })
      queryClient.invalidateQueries({ queryKey: ['purchase_orders_mine'] })
      toast.success('Status atualizado!')
    },
    onError: (error) => {
      console.error('Erro ao atualizar status:', error)
      toast.error('Erro ao atualizar o status.')
    }
  })
}
