import X from 'lucide-react/dist/esm/icons/x.js'
import Loader2 from 'lucide-react/dist/esm/icons/loader-circle.js'
import ArrowRightLeft from 'lucide-react/dist/esm/icons/arrow-right-left.js'
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js'
import Building2 from 'lucide-react/dist/esm/icons/building-2.js'
import Package from 'lucide-react/dist/esm/icons/package.js'
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.js'
import PlusCircle from 'lucide-react/dist/esm/icons/circle-plus.js'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { AVAILABLE_ENVIRONMENTS, getEnvironmentLabel } from '../../lib/environmentAccess'
import { notificarTransferenciaEstoque } from '../../lib/estoqueTransferenciaWhatsapp'

interface Product {
  id: string
  name: string
  internal_code?: string | null
  current_quantity: number
  unit_of_measure: string
  category_id?: string | null
  min_stock?: number
  ca_number?: string | null
  location?: string | null
  description?: string | null
  unit_value?: number
  environment?: string | null
  al_categories?: { name: string } | null
}

interface StockTransferModalProps {
  product: Product
  currentEnv: string
  userName?: string
  onClose: () => void
  onSuccess: () => void
}

export function StockTransferModal({
  product,
  currentEnv,
  userName = 'Almoxarifado',
  onClose,
  onSuccess
}: StockTransferModalProps) {
  const [loading, setLoading] = useState(false)
  const [checkingDest, setCheckingDest] = useState(false)
  const [targetEnv, setTargetEnv] = useState<string>(() => {
    // Seleciona o outro ambiente por padrão
    const other = AVAILABLE_ENVIRONMENTS.find(e => e.id !== currentEnv)
    return other ? other.id : (currentEnv === 'barcarena' ? 'hydro-civil' : 'barcarena')
  })

  const [quantity, setQuantity] = useState<number | ''>(1)
  const [observations, setObservations] = useState('')
  const [destExistingProduct, setDestExistingProduct] = useState<any | null>(null)

  const originalStock = Number(product.current_quantity) || 0
  const unit = product.unit_of_measure || 'UN'

  // Checa se o item já existe no ambiente de destino
  useEffect(() => {
    async function checkTargetProduct() {
      if (!targetEnv || targetEnv === currentEnv) {
        setDestExistingProduct(null)
        return
      }

      setCheckingDest(true)
      try {
        let query = supabase
          .from('al_products')
          .select('id, name, current_quantity, unit_of_measure, internal_code')
          .eq('environment', targetEnv)
          .or('status.eq.Ativo,status.is.null')

        if (product.internal_code) {
          query = query.or(`internal_code.eq.${product.internal_code},name.ilike.${product.name}`)
        } else {
          query = query.ilike('name', product.name)
        }

        const { data, error } = await query.limit(1)
        if (!error && data && data.length > 0) {
          setDestExistingProduct(data[0])
        } else {
          setDestExistingProduct(null)
        }
      } catch (err) {
        console.error('Erro ao verificar item no destino:', err)
        setDestExistingProduct(null)
      } finally {
        setCheckingDest(false)
      }
    }

    checkTargetProduct()
  }, [targetEnv, product, currentEnv])

  const transferQty = Number(quantity) || 0
  const remainingOrigin = Math.max(0, originalStock - transferQty)
  const existingDestQty = destExistingProduct ? Number(destExistingProduct.current_quantity) || 0 : 0
  const newDestQty = existingDestQty + transferQty

  const isInvalidQty = transferQty <= 0 || transferQty > originalStock

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isInvalidQty) {
      toast.error(`Quantidade deve ser entre 1 e ${originalStock} ${unit}.`)
      return
    }

    if (targetEnv === currentEnv) {
      toast.error('O ambiente de destino deve ser diferente da origem.')
      return
    }

    setLoading(true)

    try {
      // 1. Dar baixa no produto da origem
      const { error: originErr } = await supabase
        .from('al_products')
        .update({
          current_quantity: remainingOrigin,
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id)

      if (originErr) throw originErr

      // 2. Adicionar ou criar no ambiente de destino
      let destinationFinalQty = transferQty

      if (destExistingProduct) {
        destinationFinalQty = existingDestQty + transferQty
        const { error: destUpdateErr } = await supabase
          .from('al_products')
          .update({
            current_quantity: destinationFinalQty,
            updated_at: new Date().toISOString()
          })
          .eq('id', destExistingProduct.id)

        if (destUpdateErr) throw destUpdateErr
      } else {
        const { error: destInsertErr } = await supabase
          .from('al_products')
          .insert([
            {
              name: product.name,
              internal_code: product.internal_code || null,
              category_id: product.category_id || null,
              unit_of_measure: product.unit_of_measure || 'UN',
              current_quantity: transferQty,
              min_stock: product.min_stock || 0,
              ca_number: product.ca_number || null,
              location: product.location || null,
              description: product.description || null,
              unit_value: product.unit_value || 0,
              environment: targetEnv,
              status: 'Ativo'
            }
          ])

        if (destInsertErr) throw destInsertErr
      }

      // 3. Disparar notificação automática para o WhatsApp de Estoque
      try {
        await notificarTransferenciaEstoque({
          product: {
            name: product.name,
            internal_code: product.internal_code,
            category_name: product.al_categories?.name,
            unit_of_measure: product.unit_of_measure
          },
          quantity: transferQty,
          originEnv: currentEnv,
          destinationEnv: targetEnv,
          originRemainingQty: remainingOrigin,
          destinationNewQty: destinationFinalQty,
          userName,
          observations: observations.trim() || null,
          actionDateTime: new Date()
        })
      } catch (wpErr) {
        console.warn('[WhatsApp] Falha ao enviar aviso de transferência:', wpErr)
      }

      // 4. Registrar em log de atividade
      try {
        const { logActivity } = await import('../../lib/logActivity')
        await logActivity({
          module: 'Almoxarifado',
          action: `Transferência de Estoque: ${transferQty} ${unit} de "${product.name}" de ${getEnvironmentLabel(currentEnv)} para ${getEnvironmentLabel(targetEnv)}`,
          user_name: userName
        })
      } catch (e) {
        console.error('Falha ao gravar log de atividade', e)
      }

      toast.success(
        `Transferência de ${transferQty} ${unit} para ${getEnvironmentLabel(targetEnv)} realizada com sucesso!`
      )
      onSuccess()
    } catch (err: any) {
      console.error('Erro na transferência:', err)
      toast.error('Erro ao realizar transferência: ' + (err?.message || 'Erro inesperado'))
    } finally {
      setLoading(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-[#faf9f6] dark:bg-[#101014] w-full max-w-lg rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-black/5 dark:border-white/5 bg-gradient-to-r from-blue-600/10 to-indigo-600/10">
          <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <ArrowRightLeft size={22} />
            <h2 className="text-xl font-bold font-evantic tracking-wide text-[#1c1d21] dark:text-white">
              Transferir para outro Contrato / Ambiente
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#5f6472] dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-1 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          {/* Card do Produto */}
          <div className="p-4 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 flex items-start justify-between gap-3 shadow-xs">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 block mb-1">
                Item Selecionado
              </span>
              <h3 className="font-bold text-base text-[#1c1d21] dark:text-white flex items-center gap-2">
                <Package size={16} className="text-blue-600 dark:text-blue-400" />
                {product.name}
              </h3>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                {product.internal_code && <span>Cód: <strong>{product.internal_code}</strong></span>}
                {product.al_categories?.name && <span>Cat: <strong>{product.al_categories.name}</strong></span>}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 block">
                Estoque Atual
              </span>
              <span className="text-xl font-bold text-green-600 dark:text-green-400">
                {originalStock} <span className="text-xs font-normal text-gray-500">{unit}</span>
              </span>
            </div>
          </div>

          {/* Origem e Destino */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Origem */}
            <div className="p-3.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                📤 Ambiente Origem (Atual)
              </span>
              <div className="font-semibold text-xs text-[#1c1d21] dark:text-white flex items-center gap-1.5">
                <Building2 size={14} className="text-gray-500" />
                {getEnvironmentLabel(currentEnv)}
              </div>
            </div>

            {/* Destino */}
            <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-1">
                📥 Ambiente Destino *
              </span>
              <select
                value={targetEnv}
                onChange={e => setTargetEnv(e.target.value)}
                className="w-full bg-white dark:bg-[#1a1a1b] border border-blue-500/30 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#1c1d21] dark:text-white outline-none focus:border-blue-600"
              >
                {AVAILABLE_ENVIRONMENTS.filter(e => e.id !== currentEnv).map(e => (
                  <option key={e.id} value={e.id}>
                    {e.contract ? `${e.name} (${e.contract})` : e.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quantidade a transferir */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#1c1d21] dark:text-white">
                Quantidade a Transferir ({unit}) *
              </label>
              <button
                type="button"
                onClick={() => setQuantity(originalStock)}
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold underline cursor-pointer"
              >
                Transferir Tudo ({originalStock} {unit})
              </button>
            </div>
            <input
              type="number"
              min="1"
              max={originalStock}
              value={quantity}
              onChange={e => setQuantity(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
              className="w-full bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 font-bold text-lg outline-none focus:border-blue-500 transition-colors"
              placeholder={`Máx: ${originalStock}`}
              required
            />
          </div>

          {/* Prévia da Operação (Saldos) */}
          <div className="p-3.5 rounded-xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-black/20 text-xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Saldo restante na Origem:</span>
              <span className={`font-bold ${remainingOrigin <= 0 ? 'text-red-500' : 'text-[#1c1d21] dark:text-white'}`}>
                {remainingOrigin} {unit}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-2">
              <span className="text-gray-500 flex items-center gap-1">
                {checkingDest ? (
                  <Loader2 size={12} className="animate-spin text-blue-500" />
                ) : destExistingProduct ? (
                  <CheckCircle2 size={12} className="text-green-500" />
                ) : (
                  <PlusCircle size={12} className="text-blue-500" />
                )}
                {destExistingProduct
                  ? `Já existe no destino (${existingDestQty} ${unit}):`
                  : 'Será criado novo item no destino:'}
              </span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {newDestQty} {unit}
              </span>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 block mb-1">
              Motivo / Observações da Transferência (Opcional)
            </label>
            <textarea
              rows={2}
              value={observations}
              onChange={e => setObservations(e.target.value)}
              placeholder="Ex: Demanda urgente na frente Hydro Civil, remanejamento de estoque..."
              className="w-full bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl p-3 text-xs outline-none focus:border-blue-500 resize-none transition-colors"
            />
          </div>

          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-700 dark:text-blue-300">
            📲 Uma mensagem detalhada da transferência será enviada automaticamente para o WhatsApp de Estoque.
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-semibold rounded-xl text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || isInvalidQty}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />}
              Confirmar Transferência
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
