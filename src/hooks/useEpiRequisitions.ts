import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

export interface EpiRequisitionInput {
  authorizer_id: string
  employee_id: string
  reason: string | null
  destination_area: string | null
  items: {
    product_id: string
    quantity: number
  }[]
  receipt_image_base64?: string
}

export function useCreateEpiRequisition() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: EpiRequisitionInput) => {
      const { items, receipt_image_base64, ...reqData } = input
      
      // Fazer upload da imagem (comprovante) se existir
      let receipt_image_url = null
      if (receipt_image_base64) {
        try {
          // Convert base64 to Blob (browser-compatible, no Buffer needed)
          const res = await fetch(receipt_image_base64)
          const blob = await res.blob()
          const fileName = `receipt_${Date.now()}_${Math.random().toString(36).substring(7)}.png`
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('epi-requisitions')
            .upload(fileName, blob, {
              contentType: 'image/png',
              cacheControl: '3600',
              upsert: false
            })

          if (uploadError) {
             console.warn("Bucket epi-requisitions pode não existir. Imagem não salva, mas processo continua.", uploadError)
          } else if (uploadData) {
             const { data: { publicUrl } } = supabase.storage
               .from('epi-requisitions')
               .getPublicUrl(uploadData.path)
             receipt_image_url = publicUrl
          }
        } catch(e) {
          console.error("Erro ao fazer upload da imagem", e)
        }
      }

      // Criar a requisição
      const { data: requisition, error: reqError } = await supabase
        .from('al_epi_requisitions')
        .insert({
           ...reqData,
           receipt_image_url
        })
        .select()
        .single()

      if (reqError) throw reqError

      // Criar os itens
      if (items && items.length > 0) {
        const itemsToInsert = items.map(item => ({
          ...item,
          requisition_id: requisition.id
        }))

        const { error: itemsError } = await supabase
          .from('al_epi_requisition_items')
          .insert(itemsToInsert)

        if (itemsError) throw itemsError
      }

      return requisition
    },
    onSuccess: () => {
      // Invalida os produtos para refletir a nova quantidade em estoque
      queryClient.invalidateQueries({ queryKey: ['al_products'] })
      queryClient.invalidateQueries({ queryKey: ['epi_requisitions'] })
      toast.success('Requisição de EPI criada com sucesso!')
    },
    onError: (error) => {
      console.error('Erro ao criar requisição:', error)
      toast.error('Erro ao registrar a requisição. Tente novamente.')
    }
  })
}

export function useLastEpiRequisition(employee_id?: string, product_id?: string) {
  return useQuery({
    queryKey: ['last_epi_requisition', employee_id, product_id],
    queryFn: async () => {
      if (!employee_id || !product_id) return null;

      const { data, error } = await supabase
        .from('al_epi_requisition_items')
        .select(`
          created_at,
          requisition:al_epi_requisitions!inner(employee_id)
        `)
        .eq('product_id', product_id)
        .eq('al_epi_requisitions.employee_id', employee_id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) {
         console.error(error)
         return null
      }
      return data?.[0] || null
    },
    enabled: !!employee_id && !!product_id
  })
}

export function useEpiProducts() {
  return useQuery({
    queryKey: ['al_products_epi_uniforme'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('al_products')
        .select('*, category:al_categories(name)')
        .eq('status', 'Ativo')
        // Ideally we would filter by category name "EPI" or "Uniforme" but we'll fetch them and filter
      
      if (error) throw error
      
      // Filter the ones belonging to EPI or Uniforme
      return (data || []).filter(p => {
         const catName = p.category?.name?.toLowerCase() || ''
         return catName.includes('epi') || catName.includes('uniforme') || p.subcategory?.toLowerCase().includes('uniforme') || p.subcategory?.toLowerCase().includes('epi')
      })
    }
  })
}

export function useDeleteEpiRequisition() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      // 1. Fetch items of this requisition to return them to stock
      const { data: items, error: fetchError } = await supabase
        .from('al_epi_requisition_items')
        .select('*')
        .eq('requisition_id', id)
      
      if (fetchError) throw fetchError;

      // 2. Return items to stock
      if (items && items.length > 0) {
        for (const item of items) {
          const { data: prod } = await supabase
            .from('al_products')
            .select('current_quantity')
            .eq('id', item.product_id)
            .single()

          if (prod) {
            await supabase
              .from('al_products')
              .update({ current_quantity: Number(prod.current_quantity) + Number(item.quantity) })
              .eq('id', item.product_id)
          }
        }
      }

      // 3. Delete the requisition (this will cascade delete the items in the DB)
      const { error: deleteError } = await supabase
        .from('al_epi_requisitions')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epi_requisitions_list'] })
      queryClient.invalidateQueries({ queryKey: ['al_products'] })
      toast.success('Requisição excluída e itens retornados ao estoque.')
    },
    onError: (error) => {
      console.error(error)
      toast.error('Erro ao excluir requisição.')
    }
  })
}
