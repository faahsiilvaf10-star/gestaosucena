import { useState, useRef, useEffect } from 'react'
import { X, Loader2, Upload, CheckCircle2, AlertTriangle, Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface ImportStockModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function ImportStockModal({ onClose, onSuccess }: ImportStockModalProps) {
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'upload' | 'preview' | 'success'>('upload')
  const [parsedData, setParsedData] = useState<any[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [categories, setCategories] = useState<{ id: string, name: string }[]>([])
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function loadCategories() {
      const { data } = await supabase.from('al_categories').select('id, name')
      if (data) setCategories(data)
    }
    loadCategories()
  }, [])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const csv = event.target?.result as string
      parseCSV(csv)
    }
    reader.readAsText(file)
  }

  const parseCSV = (csv: string) => {
    try {
      const lines = csv.split('\n').filter(line => line.trim().length > 0)
      if (lines.length < 2) {
        setErrors(["O arquivo CSV está vazio ou não possui cabeçalhos."])
        return
      }

      // Expected format: Nome, Categoria, Código Interno, Unidade, Qtd, Minimo, Localizacao, Descricao
      // Simple CSV split (doesn't handle commas inside quotes perfectly, but sufficient for simple stock spreadsheets)
      const rows = lines.slice(1).map(line => line.split(';').length > 1 ? line.split(';') : line.split(','))
      
      const parsed = rows.map(row => {
        // Map row elements safely
        const name = row[0]?.trim() || ''
        const categoryName = row[1]?.trim() || ''
        const internal_code = row[2]?.trim() || ''
        const unit = row[3]?.trim()?.toUpperCase() || 'UN'
        const qty = parseFloat(row[4]?.trim() || '0')
        const minStock = parseFloat(row[5]?.trim() || '0')
        const location = row[6]?.trim() || ''
        const desc = row[7]?.trim() || ''
        
        // Find matching category (case insensitive)
        const cat = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase())

        return {
          name,
          category_id: cat ? cat.id : null,
          category_name: categoryName, // For preview only
          internal_code,
          unit_of_measure: ['UN', 'KG', 'L', 'M', 'CX', 'PCT', 'PAR'].includes(unit) ? unit : 'UN',
          current_quantity: isNaN(qty) ? 0 : qty,
          min_stock: isNaN(minStock) ? 0 : minStock,
          location,
          description: desc
        }
      }).filter(item => item.name.length > 0)

      setParsedData(parsed)
      setStep('preview')
      setErrors([])
    } catch (err: any) {
      setErrors(["Erro ao processar o arquivo: " + err.message])
    }
  }

  const handleImport = async () => {
    if (parsedData.length === 0) return
    setLoading(true)
    
    try {
      const itemsToInsert = parsedData.map(item => {
        // Remove preview-only fields
        const { category_name, ...dbItem } = item
        return dbItem
      })

      const { error } = await supabase.from('al_products').insert(itemsToInsert)

      if (error) throw error
      
      setStep('success')
    } catch (err: any) {
      console.error(err)
      setErrors(["Erro no banco de dados: " + err.message])
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    const headers = "Nome,Categoria,Código Interno,Unidade,Quantidade Inicial,Estoque Mínimo,Localização,Descrição\n"
    const example = "Luva de Raspa,EPI,LUV-01,PAR,50,10,Prateleira A,Luva para solda\n"
    const blob = new Blob([headers + example], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", "modelo_importacao_almoxarifado.csv")
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white dark:bg-[#1a1a1b] rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-4 border-b border-black/10 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-white/5">
          <h2 className="font-bold text-lg text-gray-900 dark:text-white">Importar Planilha de Estoque</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 p-1.5 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar flex flex-col items-center">
          
          {errors.length > 0 && (
            <div className="w-full bg-red-100 text-red-600 p-4 rounded-lg mb-6 flex flex-col gap-2">
              <div className="flex items-center gap-2 font-bold"><AlertTriangle size={20} /> Ocorreram erros:</div>
              <ul className="list-disc pl-6 text-sm">
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-black/20 dark:border-white/20 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
              <div className="bg-[#0866ff]/10 text-[#0866ff] p-4 rounded-full mb-4">
                <Upload size={32} />
              </div>
              <h3 className="font-bold text-lg mb-1">Selecione o arquivo CSV</h3>
              <p className="text-gray-500 text-sm mb-6">Apenas arquivos .csv são suportados no momento.</p>
              <button 
                onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
                className="flex items-center gap-2 text-sm text-[#0866ff] hover:underline"
              >
                <Download size={16} /> Baixar planilha modelo
              </button>
            </div>
          )}

          {step === 'preview' && (
            <div className="w-full flex flex-col h-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">Pré-visualização</h3>
                <span className="bg-[#0866ff]/10 text-[#0866ff] font-bold px-3 py-1 rounded-full text-sm">
                  {parsedData.length} itens encontrados
                </span>
              </div>
              <div className="overflow-x-auto border border-black/10 dark:border-white/10 rounded-lg flex-1">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 dark:bg-white/5 text-gray-500 font-semibold border-b border-black/10 dark:border-white/10">
                    <tr>
                      <th className="p-3">Produto</th>
                      <th className="p-3">Categoria</th>
                      <th className="p-3">Estoque</th>
                      <th className="p-3">Mínimo</th>
                      <th className="p-3 text-center">Status Categoria</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {parsedData.slice(0, 50).map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-3 font-medium">{item.name}</td>
                        <td className="p-3">{item.category_name || '-'}</td>
                        <td className="p-3 font-bold">{item.current_quantity} <span className="font-normal text-xs text-gray-500">{item.unit_of_measure}</span></td>
                        <td className="p-3">{item.min_stock}</td>
                        <td className="p-3 text-center">
                          {item.category_id ? (
                            <span className="text-green-500 flex items-center justify-center" title="Categoria Vinculada"><CheckCircle2 size={16}/></span>
                          ) : (
                            <span className="text-yellow-500 flex items-center justify-center" title="Categoria não encontrada no sistema"><AlertTriangle size={16}/></span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedData.length > 50 && <p className="text-center text-sm text-gray-500 mt-2">Mostrando os 50 primeiros itens de {parsedData.length}.</p>}
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-10 w-full animate-in zoom-in duration-300">
              <div className="text-green-500 mb-4">
                <CheckCircle2 size={64} />
              </div>
              <h3 className="font-bold text-2xl mb-2">Importação Concluída!</h3>
              <p className="text-gray-500 mb-8">Todos os itens foram adicionados ao estoque com sucesso.</p>
              <button 
                onClick={onSuccess}
                className="px-6 py-2.5 bg-[#0866ff] text-white rounded-lg font-bold hover:bg-[#0756d6] transition-colors"
              >
                Voltar para o Almoxarifado
              </button>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        {step !== 'success' && (
          <div className="p-4 border-t border-black/10 dark:border-white/10 flex justify-end gap-3 bg-gray-50 dark:bg-white/5 shrink-0">
            <button 
              type="button" 
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-lg font-bold text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
            
            {step === 'preview' && (
              <button 
                onClick={handleImport}
                disabled={loading}
                className="px-6 py-2.5 bg-[#0866ff] text-white rounded-lg font-bold hover:bg-[#0756d6] transition-colors flex items-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                Confirmar Importação
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
