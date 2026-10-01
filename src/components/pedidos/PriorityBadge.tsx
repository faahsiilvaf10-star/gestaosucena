import AlertCircle from 'lucide-react/dist/esm/icons/circle-alert.js';
import AlertTriangle from 'lucide-react/dist/esm/icons/triangle-alert.js';
import Info from 'lucide-react/dist/esm/icons/info.js';
import { Badge } from '@/components/ui/badge'
import { PurchaseOrderPriority } from '@/hooks/usePurchaseOrders'

interface PriorityBadgeProps {
  priority: PurchaseOrderPriority
  className?: string
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const getPriorityConfig = () => {
    switch (priority) {
      case 'Normal':
        return {
          label: 'Normal',
          icon: Info,
          className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        }
      case 'Urgente':
        return {
          label: 'Urgente',
          icon: AlertTriangle,
          className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
        }
      case 'Crítico':
        return {
          label: 'Crítico',
          icon: AlertCircle,
          className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
        }
      default:
        return {
          label: priority,
          icon: Info,
          className: 'bg-slate-100 text-slate-700',
        }
    }
  }

  const config = getPriorityConfig()
  const Icon = config.icon

  return (
    <Badge 
      variant="outline"
      className={`flex items-center gap-1 border-0 ${config.className} ${className || ''}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  )
}
