import { createFileRoute, Link } from '@tanstack/react-router'
import { 
  Sun, Folder, BadgeCheck, Link2, HardHat, Droplets, 
  TriangleAlert, ShieldCheck, Flame, Heart, Grid3X3, GraduationCap 
} from 'lucide-react'

export const Route = createFileRoute('/seguranca/')({
  component: SegurancaComponent,
})

function SegurancaComponent() {
  const modulos = [
    { title: "DDS", icon: Sun, href: "/seguranca/dds" },
    { title: "Permissão\nde Trabalho", icon: Folder },
    { title: "Homologados", icon: BadgeCheck },
    { title: "Vistoria Cintas", icon: Link2 },
    { title: "Inspeção\nde Canteiro", icon: HardHat },
    { title: "Pós Chuva", icon: Droplets },
    { title: "Desvios", icon: TriangleAlert },
    { title: "Requisição", icon: ShieldCheck },
    { title: "Inspeção\nExtintores", icon: Flame },
    { title: "Campanhas", icon: Heart },
    { title: "Matriz\nResponsabilidade", icon: Grid3X3 },
    { title: "Controle de\nTreinamento", icon: GraduationCap },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12 w-full">
      <div className="max-w-7xl w-full mx-auto flex flex-col items-center justify-start mt-2">
        <div className="flex flex-col items-center justify-center mb-4 mt-2 animate-in fade-in slide-in-from-top-4 duration-500 w-full px-1">
          <h1 
            className="font-display italic tracking-tight text-gray-900 dark:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] text-center"
            style={{ fontSize: 'clamp(28px, 8vw, 54px)', lineHeight: '1' }}
          >
            Segurança
          </h1>
        </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full animate-in fade-in zoom-in-95 duration-700">
        {modulos.map((modulo, idx) => {
          const content = (
            <>
              <div className="mr-4 transition-transform duration-500 group-hover:scale-110 shrink-0 flex items-center justify-center">
                <modulo.icon className="w-8 h-8 text-gray-900" strokeWidth={1.5} />
              </div>
              <h3 className="font-serif italic text-xl text-gray-900 tracking-wide font-medium text-left leading-tight">
                {modulo.title.replace('\n', ' ')}
              </h3>
            </>
          );

          if (modulo.href) {
            return (
              <Link 
                key={idx}
                to={modulo.href as any}
                className="group relative flex flex-row items-center justify-start py-4 px-5 rounded-[24px] bg-white transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-1 border border-gray-100"
              >
                {content}
              </Link>
            )
          }

          return (
            <button 
              key={idx}
              className="group relative flex flex-row items-center justify-start py-4 px-5 rounded-[24px] bg-white transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-1 border border-gray-100 w-full"
            >
              {content}
            </button>
          )
        })}
      </div>
      </div>
    </div>
  )
}
