import X from 'lucide-react/dist/esm/icons/x.js';
import Loader2 from 'lucide-react/dist/esm/icons/loader-circle.js';
import Save from 'lucide-react/dist/esm/icons/save.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import AlertTriangle from 'lucide-react/dist/esm/icons/triangle-alert.js';
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { sendStockQuantityChangeWhatsappNotification } from '../../lib/whatsappHelpers'
import { getWhatsappSettings } from '../../lib/settings'

interface Category {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  description: string | null
  current_quantity: number
  min_stock: number
  unit_of_measure: string
  internal_code: string | null
  category_id: string | null
  location: string | null
  al_categories?: { name: string } | null
}

interface EditItemModalProps {
  product: Product
  userName: string
  onClose: () => void
  onSuccess: () => void
}

export function EditItemModal({ product, userName, onClose, onSuccess }: EditItemModalProps) {
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [sendingNotification, setSendingNotification] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [formData, setFormData] = useState({
    name: product.name,
    description: product.description || '',
    current_quantity: product.current_quantity,
    min_stock: product.min_stock,
    category_id: product.category_id || '',
    location: product.location || '',
  })

  const originalQuantity = product.current_quantity

  useEffect(() => {
    async function loadCategories() {
      const { data } = await supabase.from('al_categories').select('*').order('name')
      if (data) setCategories(data)
    }
    loadCategories()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'current_quantity' || name === 'min_stock' ? Number(value) : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const quantityChanged = formData.current_quantity !== originalQuantity

      // Update product
      const { error } = await supabase
        .from('al_products')
        .update({
          name: formData.name,
          description: formData.description,
          current_quantity: formData.current_quantity,
          min_stock: formData.min_stock,
          category_id: formData.category_id || null,
          location: formData.location,
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id)

      if (error) throw error

      // Send WhatsApp notification if quantity changed
      if (quantityChanged) {
        setSendingNotification(true)
        try {
          const result = await sendStockQuantityChangeWhatsappNotification({
            responsibleName: userName,
            productName: formData.name,
            productCode: product.internal_code || undefined,
            previousQuantity: originalQuantity,
            newQuantity: formData.current_quantity,
            unitOfMeasure: product.unit_of_measure
          })

          if (!result.success) {
            console.warn('WhatsApp notification failed:', result.error)
          }
        } catch (notifErr) {
          console.warn('Failed to send WhatsApp notification:', notifErr)
        } finally {
          setSendingNotification(false)
        }
      }

      toast.success('Item atualizado com sucesso!')
      onSuccess()
    } catch (err: any) {
      console.error(err)
      toast.error("Erro ao atualizar o item: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('al_products')
        .delete()
        .eq('id', product.id)

      if (error) {
        if (error.code === '23503' || error.message?.includes('foreign key')) {
          const { error: softErr } = await supabase
            .from('al_products')
            .update({ status: 'Inativo' })
            .eq('id', product.id)
          if (softErr) throw softErr
          toast.success('Item inativado do almoxarifado!')
        } else {
          throw error
        }
      } else {
        toast.success('Item excluído com sucesso!')
      }

      setShowDeleteConfirm(false)
      onSuccess()
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao excluir item: ' + (err.message || 'Erro inesperado'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white dark:bg-[#1a1a1b] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative">

        {/* Modal de Confirmação de Exclusão */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white dark:bg-[#202022] border border-red-200 dark:border-red-900/50 rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-[#1c1d21] dark:text-white mb-2">
                Excluir Item?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                Tem certeza que deseja excluir o item <strong className="text-red-600 dark:text-red-400 font-semibold">{product.name}</strong>? Esta ação não poderá ser desfeita.
              </p>
              <div className="flex items-center gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-lg font-bold border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-lg font-bold bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  Confirmar Exclusão
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="p-4 border-b border-black/10 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-white/5">
          <h2 className="font-bold text-lg text-[#1c1d21] dark:text-white">Editar Item</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 p-1.5 rounded-full transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          <form id="edit-item-form" onSubmit={handleSubmit} className="flex flex-col gap-6">

            {/* Nome */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Nome do Produto *</label>
              <input
                type="text" required name="name"
                value={formData.name} onChange={handleChange}
                className="w-full bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-[#0866ff] transition-colors"
                placeholder="Ex: Luva de Raspa, Parafusadeira, etc."
              />
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Descrição / Observações</label>
              <textarea
                rows={3} name="description"
                value={formData.description} onChange={handleChange}
                className="w-full bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-[#0866ff] transition-colors resize-none"
                placeholder="Detalhes adicionais sobre o produto..."
              ></textarea>
            </div>

            {/* Quantidade */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Quantidade Atual *</label>
                <input
                  type="number" required min="0" step="0.01" name="current_quantity"
                  value={formData.current_quantity} onChange={handleChange}
                  className="w-full bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-[#0866ff] transition-colors"
                />
                {formData.current_quantity !== originalQuantity && (
                  <p className="text-xs text-blue-500 mt-1">
                    Anterior: {originalQuantity} {product.unit_of_measure}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Estoque Mínimo *</label>
                <input
                  type="number" required min="0" step="0.01" name="min_stock"
                  value={formData.min_stock} onChange={handleChange}
                  className="w-full bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-[#0866ff] transition-colors"
                />
              </div>
            </div>

            {/* Categoria e Localização */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-black/5 dark:border-white/5">
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Categoria</label>
                <select
                  name="category_id"
                  value={formData.category_id} onChange={handleChange}
                  className="w-full bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-[#0866ff] transition-colors"
                >
                  <option value="">Selecione uma categoria...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Localização Física</label>
                <input
                  type="text" name="location"
                  value={formData.location} onChange={handleChange}
                  className="w-full bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-[#0866ff] transition-colors"
                  placeholder="Ex: Prateleira A2"
                />
              </div>
            </div>

            {/* Info do produto (não editável) */}
            <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-lg text-sm space-y-1">
              <p className="text-gray-500 dark:text-gray-400">
                <span className="font-semibold">Código:</span> {product.internal_code || '-'}
              </p>
              <p className="text-gray-500 dark:text-gray-400">
                <span className="font-semibold">Unidade:</span> {product.unit_of_measure}
              </p>
              {product.al_categories && (
                <p className="text-gray-500 dark:text-gray-400">
                  <span className="font-semibold">Categoria Atual:</span> {product.al_categories.name}
                </p>
              )}
            </div>

          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-black/10 dark:border-white/10 flex items-center justify-between gap-3 bg-gray-50 dark:bg-white/5">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={loading || sendingNotification}
            className="px-4 py-2.5 rounded-lg font-bold text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title="Excluir este item"
          >
            <Trash2 size={16} />
            <span>Excluir Item</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || sendingNotification}
              className="px-5 py-2.5 rounded-lg font-bold text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="edit-item-form"
              disabled={loading || sendingNotification}
              className="px-6 py-2.5 bg-[#0866ff] text-white rounded-lg font-bold hover:bg-[#0756d6] transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {(loading || sendingNotification) ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {sendingNotification ? 'Enviando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
