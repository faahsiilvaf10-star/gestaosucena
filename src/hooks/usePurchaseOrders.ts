import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

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
}

export function usePurchaseOrders() {
  return useQuery({
    queryKey: ['purchase_orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('al_purchase_orders')
        .select(`
          *,
          items:al_purchase_order_items(*),
          responsible:rh_efetivo(id, nome, cargo)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching purchase orders:', error)
        throw error
      }

      return data as PurchaseOrder[]
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
          items:al_purchase_order_items(*),
          responsible:rh_efetivo(id, nome, cargo)
        `)
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error fetching purchase order:', error)
        throw error
      }

      return data as PurchaseOrder
    },
    enabled: !!id,
  })
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreatePurchaseOrderInput) => {
      const { items, ...orderData } = input
      
      // Criar o pedido
      const { data: order, error: orderError } = await supabase
        .from('al_purchase_orders')
        .insert(orderData)
        .select()
        .single()

      if (orderError) throw orderError

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
