import { Badge } from '@/components/ui/badge'
import { PurchaseOrderStatus } from '@/hooks/usePurchaseOrders'
import { CheckCircle2, Clock, Edit3, Package, ShoppingCart, XCircle, AlertCircle } from 'lucide-react'

interface StatusBadgeProps {
  status: PurchaseOrderStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'Rascunho':
        return {
          label: 'Rascunho',
          icon: Edit3,
          variant: 'outline' as const,
          className: 'bg-muted text-muted-foreground border-muted-foreground/30',
        }
      case 'Solicitado':
        return {
          label: 'Solicitado',
          icon: Clock,
          variant: 'default' as const,
          className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        }
      case 'Em Compra':
        return {
          label: 'Em Compra',
          icon: ShoppingCart,
          variant: 'default' as const,
          className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        }
      case 'Comprado':
        return {
          label: 'Comprado',
          icon: CheckCircle2,
          variant: 'default' as const,
          className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        }
      case 'Recebimento Parcial':
        return {
          label: 'Receb. Parcial',
          icon: Package,
          variant: 'default' as const,
          className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        }
      case 'Recebido':
        return {
          label: 'Recebido',
          icon: Package,
          variant: 'default' as const,
          className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800',
        }
      case 'Cancelado':
        return {
          label: 'Cancelado',
          icon: XCircle,
          variant: 'destructive' as const,
          className: '',
        }
      default:
        return {
          label: status,
          icon: AlertCircle,
          variant: 'outline' as const,
          className: '',
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  return (
    <Badge 
      variant={config.variant} 
      className={`flex items-center gap-1.5 whitespace-nowrap ${config.className} ${className || ''}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </Badge>
  )
}
