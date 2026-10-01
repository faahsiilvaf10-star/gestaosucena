import Sun from 'lucide-react/dist/esm/icons/sun.js';
import Folder from 'lucide-react/dist/esm/icons/folder.js';
import BadgeCheck from 'lucide-react/dist/esm/icons/badge-check.js';
import Link2 from 'lucide-react/dist/esm/icons/link-2.js';
import HardHat from 'lucide-react/dist/esm/icons/hard-hat.js';
import Droplets from 'lucide-react/dist/esm/icons/droplets.js';
import TriangleAlert from 'lucide-react/dist/esm/icons/triangle-alert.js';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js';
import Flame from 'lucide-react/dist/esm/icons/flame.js';
import Heart from 'lucide-react/dist/esm/icons/heart.js';
import Grid3X3 from 'lucide-react/dist/esm/icons/grid-3x3.js';
import GraduationCap from 'lucide-react/dist/esm/icons/graduation-cap.js';
import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/seguranca/')({
  component: SegurancaComponent,
})

function SegurancaComponent() {
  const modulos = [
    { title: "DDS", icon: Sun, href: "/seguranca/dds" },
    { title: "Permissão\nde Trabalho", icon: Folder, href: "/permissao-trabalho" },
    { title: "Homologados", icon: BadgeCheck, href: "/seguranca/homologados" },
    { title: "Vistoria Cintas", icon: Link2, href: "/seguranca/cintas" },
    { title: "Inspeção\nde Canteiro", icon: HardHat },
    { title: "Pós Chuva", icon: Droplets },
    { title: "Desvios", icon: TriangleAlert },
    { title: "Requisição", icon: ShieldCheck, href: "/almoxarifado/requisicoes" },
    { title: "Inspeção\nExtintores", icon: Flame },
    { title: "Campanhas", icon: Heart },
    { title: "Matriz\nResponsabilidade", icon: Grid3X3 },
    { title: "Controle de\nTreinamento", icon: GraduationCap },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-24 custom-scrollbar bg-transparent">
      <div className="max-w-7xl w-full mx-auto flex flex-col items-center justify-start mt-2">
        <div className="flex flex-col items-center justify-center mb-4 mt-2 animate-in fade-in slide-in-from-top-4 duration-500 w-full px-1">
          <h1 
            className="tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] text-center"
            style={{ fontSize: 'clamp(28px, 8vw, 54px)', lineHeight: '1' }}
          >
            Segurança
          </h1>
        </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full animate-in fade-in zoom-in-95 duration-700">
        {modulos.map((modulo, idx) => {
          if (modulo.href) {
            return (
              <Link 
                key={idx}
                to={modulo.href as any}
                className="group relative flex flex-col items-center justify-center p-6 h-40 rounded-[32px] liquid-card-effect transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              >
                <div className="mb-4 transition-transform duration-500 group-hover:scale-110 z-10">
                  <modulo.icon className="w-10 h-10 text-current opacity-90" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl tracking-wide font-medium text-center whitespace-pre-line leading-tight z-10 text-current">
                  {modulo.title}
                </h3>
              </Link>
            )
          }

          return (
            <button 
              key={idx}
              className="group relative flex flex-col items-center justify-center p-6 h-40 rounded-[32px] liquid-card-effect transition-all duration-300 hover:shadow-lg hover:-translate-y-1 w-full"
            >
              <div className="mb-4 transition-transform duration-500 group-hover:scale-110 z-10">
                <modulo.icon className="w-10 h-10 text-current opacity-90" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl tracking-wide font-medium text-center whitespace-pre-line leading-tight z-10 text-current">
                {modulo.title}
              </h3>
            </button>
          )
        })}
      </div>
      </div>
    </div>
  )
}
