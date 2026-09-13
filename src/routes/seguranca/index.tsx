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
    <div className="max-w-7xl mx-auto py-12 px-4 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-center space-x-4 mb-12">
        <h1 className="text-4xl md:text-5xl font-display font-bold italic tracking-tight">Segurança</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 w-full animate-in fade-in zoom-in-95 duration-700">
        {modulos.map((modulo, idx) => {
          if (modulo.href) {
            return (
              <Link 
                key={idx}
                to={modulo.href as any}
                className="group flex items-center sm:flex-col sm:items-center sm:justify-center gap-4 sm:gap-3 py-4 sm:py-8 px-4 sm:px-6 rounded-2xl sm:rounded-3xl transition-all duration-300 bg-white text-black shadow-md hover:shadow-xl hover:-translate-y-1 sm:hover:-translate-y-2 relative overflow-hidden active:scale-[0.98]"
                style={{ minHeight: 68 }}
              >
                <modulo.icon 
                  size={32}
                  className="text-black opacity-90 group-hover:scale-110 transition-transform duration-300 relative z-10 flex-shrink-0 sm:w-12 sm:h-12 sm:mb-1" 
                  strokeWidth={1.5} 
                />
                <div className="flex flex-col min-w-0 sm:items-center w-full">
                  <span className="text-xl sm:text-3xl font-display italic tracking-tight relative z-10 sm:text-center whitespace-pre-line leading-tight">
                    {modulo.title}
                  </span>
                </div>
              </Link>
            )
          }

          return (
            <button 
              key={idx}
              className="group flex items-center sm:flex-col sm:items-center sm:justify-center gap-4 sm:gap-3 py-4 sm:py-8 px-4 sm:px-6 rounded-2xl sm:rounded-3xl transition-all duration-300 bg-white text-black shadow-md hover:shadow-xl hover:-translate-y-1 sm:hover:-translate-y-2 relative overflow-hidden active:scale-[0.98]"
              style={{ minHeight: 68 }}
            >
              <modulo.icon 
                size={32}
                className="text-black opacity-90 group-hover:scale-110 transition-transform duration-300 relative z-10 flex-shrink-0 sm:w-12 sm:h-12 sm:mb-1" 
                strokeWidth={1.5} 
              />
              <div className="flex flex-col min-w-0 sm:items-center w-full">
                <span className="text-xl sm:text-3xl font-display italic tracking-tight relative z-10 sm:text-center whitespace-pre-line leading-tight">
                  {modulo.title}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
