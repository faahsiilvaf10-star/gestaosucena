import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { sendStockMinAlertWhatsappNotification } from '../../lib/whatsappHelpers'
import { AlertTriangle, X, Package, MapPin, Check } from 'lucide-react'

interface LowStockAlert {
  id: string
  product_id: string
  product_name: string
  product_code: string | null
  location: string | null
  current_quantity: number
  min_stock: number
  unit_of_measure: string
  created_at: string
  dismissed: boolean
}

interface StockAlertBannerProps {
  onDismiss?: () => void
}

export function StockAlertBanner({ onDismiss }: StockAlertBannerProps) {
  const [alerts, setAlerts] = useState<LowStockAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)

  useEffect(() => {
    loadAlerts()
  }, [])

  async function loadAlerts() {
    setLoading(true)
    try {
      const { data: allProducts, error } = await supabase
        .from('al_products')
        .select('id, name, internal_code, location, current_quantity, min_stock, unit_of_measure')
        .eq('status', 'Ativo')

      if (allProducts && !error) {
        const lowStockItems = allProducts.filter((p) => {
          const qty = Number(p.current_quantity) || 0
          const min = Number(p.min_stock) || 0
          return qty <= 0 || (min > 0 && qty <= min)
        })

        const alertsData: LowStockAlert[] = lowStockItems.map((item) => ({
          id: item.id,
          product_id: item.id,
          product_name: item.name,
          product_code: item.internal_code,
          location: item.location,
          current_quantity: Number(item.current_quantity),
          min_stock: Number(item.min_stock),
          unit_of_measure: item.unit_of_measure,
          created_at: new Date().toISOString(),
          dismissed: dismissedIds.has(item.id)
        }))

        setAlerts(alertsData.filter(a => !dismissedIds.has(a.id)))
      }
    } catch (err) {
      console.error('Erro ao carregar alertas de estoque:', err)
    } finally {
      setLoading(false)
    }
  }

  const activeAlerts = alerts.filter(a => !dismissedIds.has(a.id))

  const handleDismiss = (alertId: string) => {
    setDismissedIds(prev => new Set([...prev, alertId]))
    setAlerts(prev => prev.filter(a => a.id !== alertId))
  }

  const handleDismissAll = () => {
    const allIds = new Set([...dismissedIds, ...activeAlerts.map(a => a.id)])
    setDismissedIds(allIds)
    setAlerts([])
    onDismiss?.()
  }

  const handleSendWhatsApp = async () => {
    setSendingWhatsApp(true)
    let sentCount = 0
    let failedCount = 0

    for (const alert of activeAlerts) {
      try {
        const result = await sendStockMinAlertWhatsappNotification({
          productName: alert.product_name,
          productCode: alert.product_code || undefined,
          location: alert.location || undefined,
          currentQuantity: alert.current_quantity,
          minStock: alert.min_stock,
          unitOfMeasure: alert.unit_of_measure
        })

        if (result.success) {
          sentCount++
        } else {
          failedCount++
          console.warn(`Falha ao enviar alerta para ${alert.product_name}:`, result.error)
        }
      } catch (err) {
        failedCount++
        console.warn(`Erro ao enviar alerta para ${alert.product_name}:`, err)
      }
    }

    setSendingWhatsApp(false)

    if (sentCount > 0) {
      toast.success(`${sentCount} alerta(s) de estoque mínimo enviado(s) no WhatsApp!`)
    }
    if (failedCount > 0) {
      toast.error(`${failedCount} alerta(s) não puderam ser enviados.`)
    }
  }

  if (loading || activeAlerts.length === 0) {
    return null
  }

  return (
    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
          <AlertTriangle className="text-red-600 dark:text-red-400" size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="font-bold text-red-700 dark:text-red-400 text-sm">
              {activeAlerts.length} item(s) abaixo do estoque mínimo
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handleSendWhatsApp}
                disabled={sendingWhatsApp}
                className="px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {sendingWhatsApp ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Enviar WhatsApp'
                )}
              </button>
              <button
                onClick={handleDismissAll}
                className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-black/30 hover:bg-white/80 text-red-600 rounded-lg transition-colors border border-red-200 dark:border-red-800"
              >
                Dispensar Todos
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {activeAlerts.slice(0, 5).map(alert => (
              <div
                key={alert.id}
                className="flex items-center justify-between gap-2 bg-white dark:bg-black/20 rounded-lg p-3 text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Package className="text-red-500 shrink-0" size={16} />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                      {alert.product_name}
                    </p>
                    {alert.product_code && (
                      <p className="text-xs text-gray-500">Código: {alert.product_code}</p>
                    )}
                    {alert.location && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin size={10} /> {alert.location}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-red-600 dark:text-red-400 font-bold">
                    {alert.current_quantity} / {alert.min_stock} {alert.unit_of_measure}
                  </p>
                  <p className="text-xs text-gray-500">atual / mínimo</p>
                </div>
                <button
                  onClick={() => handleDismiss(alert.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                  title="Dispensar"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            {activeAlerts.length > 5 && (
              <p className="text-xs text-red-600 dark:text-red-400 text-center font-medium">
                +{activeAlerts.length - 5} outro(s) item(s)...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook to check and trigger minimum stock alerts
 * Call this after any stock update operation
 */
export async function checkAndTriggerMinStockAlerts(productId?: string): Promise<{
  triggered: boolean
  productName?: string
  newQuantity?: number
  minStock?: number
}> {
  try {
    const settings = await import('../../lib/settings').then(m => m.getWhatsappSettings())
    if (!settings.estoqueMinimo?.enabled) {
      return { triggered: false }
    }

    // If productId provided, check only that product
    if (productId) {
      const { data } = await supabase
        .from('al_products')
        .select('id, name, internal_code, location, current_quantity, min_stock, unit_of_measure')
        .eq('id', productId)
        .single()

      if (data) {
        const qty = Number(data.current_quantity) || 0
        const min = Number(data.min_stock) || 0

        if (qty <= 0 || (min > 0 && qty <= min)) {
          // Check if already below min - if it was already below, don't re-alert
          // This is a simplified check - in production you'd want to track this state
          return {
            triggered: true,
            productName: data.name,
            newQuantity: qty,
            minStock: min
          }
        }
      }
    } else {
      // Check all products
    const { data: allProducts } = await supabase
      .from('al_products')
      .select('id, name, internal_code, location, current_quantity, min_stock, unit_of_measure')
      .eq('status', 'Ativo')

    if (allProducts) {
      const criticalItems = allProducts.filter((p) => {
        const qty = Number(p.current_quantity) || 0
        const min = Number(p.min_stock) || 0
        return qty <= 0 || (min > 0 && qty <= min)
      })

        if (criticalItems.length > 0) {
          return {
            triggered: true,
            productName: `${criticalItems.length} item(s)`,
            newQuantity: criticalItems.length
          }
        }
      }
    }

    return { triggered: false }
  } catch (err) {
    console.error('Erro ao verificar alertas de estoque mínimo:', err)
    return { triggered: false }
  }
}
