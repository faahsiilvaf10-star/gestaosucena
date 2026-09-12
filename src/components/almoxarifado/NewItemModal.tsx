import { useState, useEffect } from 'react'
import { X, Loader2, Save } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Category {
  id: string
  name: string
}

interface NewItemModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function NewItemModal({ onClose, onSuccess }: NewItemModalProps) {
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  
  const [formData, setFormData] = useState({
    name: '',
    internal_code: '',
    category_id: '',
    unit_of_measure: 'UN',
    current_quantity: 0,
    min_stock: 0,
    location: '',
    description: ''
  })

  useEffect(() => {
    async function loadCategories() {
      const { data } = await supabase.from('al_categories').select('*').order('name')
      if (data) setCategories(data)
    }
    loadCategories()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const { error } = await supabase.from('al_products').insert([{
        name: formData.name,
        internal_code: formData.internal_code,
        category_id: formData.category_id || null,
        unit_of_measure: formData.unit_of_measure,
        current_quantity: Number(formData.current_quantity) || 0,
        min_stock: Number(formData.min_stock) || 0,
        location: formData.location,
        description: formData.description
      }])

      if (error) throw error
      onSuccess()
    } catch (err: any) {
      console.error(err)
      alert("Erro ao salvar o item: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white dark:bg-[#1a1a1b] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-4 border-b border-black/10 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-white/5">
          <h2 className="font-bold text-lg text-gray-900 dark:text-white">Novo Item do Almoxarifado</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-900 dark:text-white hover:bg-black/5 dark:hover:bg-white/10 p-1.5 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          <form id="new-item-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
            
            {/* Informações Básicas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Nome do Produto *</label>
                <input 
                  type="text" required name="name"
                  value={formData.name} onChange={handleChange}
                  className="w-full bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-[#0866ff] transition-colors"
                  placeholder="Ex: Luva de Raspa, Parafusadeira, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Categoria *</label>
                <select 
                  required name="category_id"
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
                <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Código Interno</label>
                <input 
                  type="text" name="internal_code"
                  value={formData.internal_code} onChange={handleChange}
                  className="w-full bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-[#0866ff] transition-colors"
                  placeholder="Ex: COD-001"
                />
              </div>
            </div>

            {/* Controle de Estoque */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-black/5 dark:border-white/5">
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Unidade (UM) *</label>
                <select 
                  required name="unit_of_measure"
                  value={formData.unit_of_measure} onChange={handleChange}
                  className="w-full bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-[#0866ff] transition-colors"
                >
                  <option value="UN">Unidade (UN)</option>
                  <option value="KG">Quilograma (KG)</option>
                  <option value="L">Litro (L)</option>
                  <option value="M">Metro (M)</option>
                  <option value="CX">Caixa (CX)</option>
                  <option value="PCT">Pacote (PCT)</option>
                  <option value="PAR">Par (PAR)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Qtd. Inicial *</label>
                <input 
                  type="number" required min="0" step="0.01" name="current_quantity"
                  value={formData.current_quantity} onChange={handleChange}
                  className="w-full bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-[#0866ff] transition-colors"
                />
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

            {/* Localização e Outros */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-black/5 dark:border-white/5">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Localização Física</label>
                <input 
                  type="text" name="location"
                  value={formData.location} onChange={handleChange}
                  className="w-full bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-[#0866ff] transition-colors"
                  placeholder="Ex: Prateleira A2, Almoxarifado Principal"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Descrição / Observações</label>
                <textarea 
                  rows={3} name="description"
                  value={formData.description} onChange={handleChange}
                  className="w-full bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-[#0866ff] transition-colors resize-none"
                  placeholder="Detalhes adicionais sobre o produto..."
                ></textarea>
              </div>
            </div>
            
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-black/10 dark:border-white/10 flex justify-end gap-3 bg-gray-50 dark:bg-white/5">
          <button 
            type="button" 
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 rounded-lg font-bold text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            form="new-item-form"
            disabled={loading}
            className="px-6 py-2.5 bg-[#0866ff] text-gray-900 dark:text-white rounded-lg font-bold hover:bg-[#0756d6] transition-colors flex items-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Salvar Item
          </button>
        </div>

      </div>
    </div>
  )
}


