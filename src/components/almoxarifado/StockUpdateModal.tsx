import { useState } from 'react'
import { X, Loader2, Save } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Product {
  id: string
  name: string
  current_quantity: number
  unit_of_measure: string
}

interface StockUpdateModalProps {
  product: Product
  type: 'in' | 'out'
  onClose: () => void
  onSuccess: () => void
}

export function StockUpdateModal({ product, type, onClose, onSuccess }: StockUpdateModalProps) {
  const [loading, setLoading] = useState(false)
  const [quantity, setQuantity] = useState<number | ''>('')
  const [reason, setReason] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quantity || quantity <= 0) return

    setLoading(true)
    
    try {
      const delta = type === 'in' ? Number(quantity) : -Number(quantity)
      const newQuantity = Math.max(0, Number(product.current_quantity) + delta)

      // Update product quantity
      const { error } = await supabase
        .from('al_products')
        .update({ current_quantity: newQuantity })
        .eq('id', product.id)

      if (error) throw error
      
      onSuccess()
    } catch (error) {
      console.error('Error updating stock:', error)
      alert('Erro ao atualizar estoque.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#faf9f6] dark:bg-[#101014] w-full max-w-md rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between p-6 border-b border-black/5 dark:border-white/5">
          <h2 className="text-xl font-bold font-evantic tracking-wide text-gray-900 dark:text-white">
            {type === 'in' ? 'Entrada no Estoque' : 'Saída do Estoque'}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{product.name}</h3>
            <p className="text-sm text-gray-500">Estoque atual: <span className="font-bold">{product.current_quantity}</span> {product.unit_of_measure}</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Quantidade a ser {type === 'in' ? 'adicionada' : 'removida'} ({product.unit_of_measure})</label>
              <input
                type="number"
                required
                min="0.01"
                step="any"
                value={quantity}
                onChange={e => setQuantity(e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-white dark:bg-[#1a1a1b] border border-black/10 dark:border-white/10 rounded-lg px-4 py-2 outline-none focus:border-[#0866ff] transition-colors"
                placeholder="Ex: 5"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Motivo / Observação (Opcional)</label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full bg-white dark:bg-[#1a1a1b] border border-black/10 dark:border-white/10 rounded-lg px-4 py-2 outline-none focus:border-[#0866ff] transition-colors"
                placeholder={type === 'in' ? 'Ex: Compra NF 123' : 'Ex: Retirado por João'}
              />
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`px-4 py-2 text-sm font-bold text-white rounded-lg flex items-center gap-2 transition-colors shadow-sm
                  ${type === 'in' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                  ${loading ? 'opacity-70 cursor-not-allowed' : ''}
                `}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Confirmar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
