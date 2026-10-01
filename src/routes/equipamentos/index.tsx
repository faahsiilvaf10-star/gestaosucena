import ArrowLeftRight from 'lucide-react/dist/esm/icons/arrow-left-right.js';
import Truck from 'lucide-react/dist/esm/icons/truck.js';
import ListChecks from 'lucide-react/dist/esm/icons/list-checks.js';
import ClipboardCheck from 'lucide-react/dist/esm/icons/clipboard-check.js';
import MapPin from 'lucide-react/dist/esm/icons/map-pin.js';
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { isAdmin } from '../../components/ui/VerifiedBadge'

export const Route = createFileRoute('/equipamentos/')({
  component: EquipamentosHub,
})

const HUB_ITEMS = [
  { name: 'Entrada e Saída', icon: ArrowLeftRight, href: '/equipamentos/entrada-saida', desc: 'Registrar movimentações' },

  { name: 'App Motorista', icon: Truck, href: '/equipamentos/app-motorista', desc: 'Aplicativo do motorista', adminOnly: true },
  { name: 'Parte Diária', icon: Truck, href: '/equipamentos/parte-diaria', desc: 'Relatório diário' },
  { name: 'Todos os Equipamentos', icon: ListChecks, href: '/equipamentos/todos', desc: 'Visualizar a frota completa' },
  { name: 'Vistoria de Equipamentos', icon: ClipboardCheck, href: '/equipamentos/vistoria', desc: 'Laudos e manutenções' },
]

function EquipamentosHub() {
  const [isUserAdmin, setIsUserAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        const name = data.user.user_metadata?.full_name || ''
        const role = data.user.user_metadata?.role || ''
        setIsUserAdmin(isAdmin(name, role))
      }
    })
  }, [])

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="max-w-4xl w-full mx-auto flex flex-col items-center justify-start mt-2 sm:mt-4">
        
        {/* Title */}
        <div className="flex flex-col items-center justify-center mb-4 mt-2 animate-in fade-in slide-in-from-top-4 duration-500 w-full px-1">
          <h1
            className="tracking-tight text-white drop-shadow-md text-center py-1"
            style={{ fontSize: 'clamp(28px, 8vw, 54px)', lineHeight: 'normal' }}
          >
            Equipamentos
          </h1>
          <p className="text-white/ text-sm mt-2 font-medium text-center">
            Controle de frotas, movimentações e vistorias
          </p>
        </div>

        {/* Grid — 1 col mobile, 2 col tablet+ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full animate-in fade-in zoom-in-95 duration-700">
          {HUB_ITEMS.map((item, idx) => {
            if (item.adminOnly && !isUserAdmin) return null;
            
            const Icon = item.icon
            return (
              <Link
                key={idx}
                to={item.href as any}
                className="group relative flex flex-col items-center justify-center p-6 h-40 rounded-[32px] liquid-card-effect transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              >
                <div className="mb-4 transition-transform duration-500 group-hover:scale-110 z-10">
                  <Icon className="w-10 h-10 text-current opacity-90" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl tracking-wide font-medium text-center whitespace-pre-line leading-tight z-10 text-current">
                  {item.name}
                </h3>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
