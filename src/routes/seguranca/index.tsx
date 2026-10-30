import Sun from 'lucide-react/dist/esm/icons/sun.js';
import Folder from 'lucide-react/dist/esm/icons/folder.js';
import BadgeCheck from 'lucide-react/dist/esm/icons/badge-check.js';
import Link2 from 'lucide-react/dist/esm/icons/link-2.js';
import HardHat from 'lucide-react/dist/esm/icons/hard-hat.js';
import Droplets from 'lucide-react/dist/esm/icons/droplets.js';
import TriangleAlert from 'lucide-react/dist/esm/icons/triangle-alert.js';
import Flame from 'lucide-react/dist/esm/icons/flame.js';
import Heart from 'lucide-react/dist/esm/icons/heart.js';
import Grid3X3 from 'lucide-react/dist/esm/icons/grid-3x3.js';
import GraduationCap from 'lucide-react/dist/esm/icons/graduation-cap.js';
import ListTodo from 'lucide-react/dist/esm/icons/list-todo.js';
import FileWarning from 'lucide-react/dist/esm/icons/file-warning.js';
import ClipboardCheck from 'lucide-react/dist/esm/icons/clipboard-check.js';
import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3.js';
import ShieldAlert from 'lucide-react/dist/esm/icons/shield-alert.js';
import UserPlus from 'lucide-react/dist/esm/icons/user-plus.js';
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
    { title: "Inspeção\nde Canteiro", icon: HardHat, href: "/seguranca/inspecao-canteiro" },
    { title: "Pós Chuva", icon: Droplets, href: "/seguranca/pos-chuva" },
    { title: "Desvios", icon: TriangleAlert, href: "/seguranca/desvios" },
    { title: "Inspeção\nExtintores", icon: Flame },
    { title: "Campanhas", icon: Heart, href: "/seguranca/campanhas" },
    { title: "Matriz\nResponsabilidade", icon: Grid3X3, href: "/seguranca/matriz-responsabilidade" },
    { title: "Controle de\nTreinamento", icon: GraduationCap, href: "/seguranca/controle-treinamento" },
    { title: "Plano de\nAção", icon: ListTodo, href: "/seguranca/plano-acao" },
    { title: "Não\nConformidade", icon: FileWarning, href: "/seguranca/nao-conformidade" },
    { title: "Check\nList", icon: ClipboardCheck, href: "/seguranca/checklist" },
    { title: "Relatório de\nOcorrência", icon: FileText, href: "/seguranca/relatorio-ocorrencia" },
    { title: "Indicadores", icon: BarChart3, href: "/seguranca/indicadores" },
    { title: "Análise de\nRisco", icon: ShieldAlert, href: "/seguranca/analise-risco" },
    { title: "Programa de\nNovatos", icon: UserPlus, href: "/seguranca/programa-novatos" },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto pt-10 sm:pt-14 lg:pt-16 pb-8 custom-scrollbar bg-transparent px-4 sm:px-6">
      <div className="max-w-7xl w-full mx-auto flex flex-col items-center justify-start">
        <div className="flex flex-col items-center justify-center mb-6 sm:mb-8 animate-in fade-in slide-in-from-top-4 duration-500 w-full">
          <h1 
            className="tracking-tight text-[#1c1d21] dark:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] text-center font-bold"
            style={{ fontSize: 'clamp(28px, 4vw, 40px)', lineHeight: '1.2' }}
          >
            Segurança
          </h1>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 lg:gap-4.5 w-full animate-in fade-in zoom-in-95 duration-700">
          {modulos.map((modulo, idx) => {
            const cardContent = (
              <>
                <div className="mb-2 sm:mb-2.5 transition-transform duration-300 group-hover:scale-110 z-10 shrink-0">
                  <modulo.icon className="w-7 h-7 sm:w-8 sm:h-8 text-current opacity-90" strokeWidth={1.5} />
                </div>
                <h3 className="text-xs sm:text-[13px] lg:text-[14px] tracking-tight font-medium text-center whitespace-pre-line leading-snug z-10 text-current">
                  {modulo.title}
                </h3>
              </>
            )

            if (modulo.href) {
              return (
                <Link 
                  key={idx}
                  to={modulo.href as any}
                  className="group relative flex flex-col items-center justify-center px-3 py-4 sm:py-5 h-[120px] sm:h-[130px] lg:h-[138px] rounded-2xl sm:rounded-[24px] liquid-card-effect transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                >
                  {cardContent}
                </Link>
              )
            }

            return (
              <button 
                key={idx}
                type="button"
                className="group relative flex flex-col items-center justify-center px-3 py-4 sm:py-5 h-[120px] sm:h-[130px] lg:h-[138px] rounded-2xl sm:rounded-[24px] liquid-card-effect transition-all duration-300 hover:shadow-lg hover:-translate-y-1 w-full"
              >
                {cardContent}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
