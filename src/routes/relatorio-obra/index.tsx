import { createFileRoute, Link } from '@tanstack/react-router'
import { FileText, Leaf, Hammer, Clock, Plus } from 'lucide-react'

export const Route = createFileRoute('/relatorio-obra/')({
  component: RelatorioObraHub,
})

const HUB_ITEMS = [
  { name: 'RDO', icon: FileText, href: '/relatorio-obra/rdo', desc: 'Relatório Diário de Obra' },
  { name: 'Atividade Jardinagem', icon: Leaf, href: '/relatorio-obra/jardinagem', desc: 'Registros de jardinagem' },
  { name: 'Atividade Gabião', icon: Hammer, href: '/relatorio-obra/gabiao', desc: 'Registros de gabião' },
  { name: 'Atividade Prevista', icon: Clock, href: '/relatorio-obra/prevista', desc: 'Planejamento futuro' },
]

function RelatorioObraHub() {
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-transparent pb-20">
      <div className="max-w-5xl w-full mx-auto flex flex-col items-center justify-start mt-2">
        
        {/* Title */}
        <div className="flex flex-col items-center justify-center mb-6 sm:mb-8 mt-2 animate-in fade-in slide-in-from-top-4 duration-500 w-full px-1">
          <div className="flex items-center gap-3">
            <h1
              className="font-display italic tracking-tight text-gray-900 dark:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] text-center"
              style={{ fontSize: 'clamp(28px, 8vw, 54px)', lineHeight: '1' }}
            >
              Relatório de Obra
            </h1>
          </div>
          <p className="text-gray-900 dark:text-white/70 text-sm mt-3 font-medium text-center">
            Gestão e acompanhamento das atividades da obra
          </p>
        </div>

        {/* Grid — 1 col mobile, 2 col sm, 3 col lg */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 w-full px-4 animate-in fade-in zoom-in-95 duration-700">
          {HUB_ITEMS.map((item, idx) => {
            const Icon = item.icon
            return (
              <Link
                key={idx}
                to={item.href as any}
                className="group flex items-center sm:flex-col sm:items-center sm:justify-center
                           gap-4 sm:gap-3
                           py-4 sm:py-8 px-4 sm:px-6 rounded-2xl sm:rounded-3xl transition-all duration-300
                           bg-white text-black shadow-md hover:shadow-xl hover:-translate-y-1 sm:hover:-translate-y-2
                           relative overflow-hidden active:scale-[0.98]"
                style={{ minHeight: 68 }}
              >
                <Icon
                  size={32}
                  className="text-black opacity-90 group-hover:scale-110 transition-transform duration-300 relative z-10 flex-shrink-0 sm:w-12 sm:h-12 sm:mb-1"
                  strokeWidth={1.5}
                />
                <div className="flex flex-col min-w-0 sm:items-center">
                  <span className="text-xl sm:text-2xl lg:text-3xl font-display italic tracking-tight relative z-10 sm:text-center">
                    {item.name}
                  </span>
                </div>
              </Link>
            )
          })}

          {/* Botão Nova Atividade (Pontilhado) */}
          <button
            className="group flex items-center sm:flex-col sm:items-center sm:justify-center
                       gap-4 sm:gap-3
                       py-4 sm:py-8 px-4 sm:px-6 rounded-2xl sm:rounded-3xl transition-all duration-300
                       bg-white/50 text-black border-2 border-dashed border-gray-400 dark:border-gray-500
                       hover:bg-white hover:border-solid hover:shadow-xl hover:-translate-y-1 sm:hover:-translate-y-2
                       relative overflow-hidden active:scale-[0.98]"
            style={{ minHeight: 68 }}
          >
            <Plus
              size={32}
              className="text-black opacity-90 group-hover:scale-110 transition-transform duration-300 relative z-10 flex-shrink-0 sm:w-12 sm:h-12 sm:mb-1"
              strokeWidth={1.5}
            />
            <div className="flex flex-col min-w-0 sm:items-center">
              <span className="text-xl sm:text-2xl lg:text-3xl font-display italic tracking-tight relative z-10 sm:text-center">
                Nova Atividade
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
