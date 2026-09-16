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
    <div className="space-y-6 animate-in fade-in duration-500 pb-12 w-full">
      <div className="max-w-5xl w-full mx-auto flex flex-col items-center justify-start mt-2">
        
        {/* Title */}
        <div className="flex flex-col items-center justify-center mb-4 mt-2 animate-in fade-in slide-in-from-top-4 duration-500 w-full px-1">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full animate-in fade-in zoom-in-95 duration-700">
          {HUB_ITEMS.map((item, idx) => {
            const Icon = item.icon
            return (
              <Link
                key={idx}
                to={item.href as any}
                className="group relative flex flex-row items-center justify-start py-4 px-5 rounded-[24px] bg-white transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-1 border border-gray-100"
              >
                <div className="mr-4 transition-transform duration-500 group-hover:scale-110 shrink-0 flex items-center justify-center">
                  <Icon className="w-8 h-8 text-gray-900" strokeWidth={1.5} />
                </div>
                <h3 className="font-serif italic text-xl text-gray-900 tracking-wide font-medium text-left leading-tight">
                  {item.name.replace('\n', ' ')}
                </h3>
              </Link>
            )
          })}

          {/* Botão Nova Atividade (Pontilhado) */}
          <button
            className="group flex flex-row items-center justify-start
                       py-4 px-5 rounded-[24px] transition-all duration-300
                       bg-white/50 text-black border-2 border-dashed border-gray-400 dark:border-gray-500
                       hover:bg-white hover:border-solid hover:shadow-md hover:-translate-y-1
                       relative overflow-hidden"
          >
            <div className="mr-4 transition-transform duration-500 group-hover:scale-110 shrink-0 flex items-center justify-center">
              <Plus
                size={32}
                className="text-black opacity-90 relative z-10"
                strokeWidth={1.5}
              />
            </div>
            <h3 className="text-xl font-serif italic tracking-wide font-medium text-left leading-tight relative z-10">
              Nova Atividade
            </h3>
          </button>
        </div>
      </div>
    </div>
  )
}
