import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Package, HardHat, FileLineChart, ShieldAlert, Users, Building2, Hammer } from 'lucide-react';
import { CargoDocsViewer } from '@/components/documentos/CargoDocsViewer';

export const Route = createFileRoute('/documentos/')({
  component: DocumentosIndex,
});

const CARGOS = [
  { id: 'estoque', name: 'Estoque / Almoxarifado', icon: Package },
  { id: 'engenharia', name: 'Engenharia', icon: HardHat },
  { id: 'planejamento', name: 'Planejamento', icon: FileLineChart },
  { id: 'qsms', name: 'Segurança do Trabalho', icon: ShieldAlert },
  { id: 'rh', name: 'Recursos Humanos', icon: Users },
  { id: 'admin', name: 'Administração', icon: Building2 },
  { id: 'mestre', name: 'Encarregado', icon: Hammer },
];

function DocumentosIndex() {
  const { isDark } = useTheme();
  const [selectedCargo, setSelectedCargo] = useState<{id: string, name: string} | null>(null);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12 w-full">
      <div className="flex flex-col items-center justify-center mb-4 mt-2 animate-in fade-in slide-in-from-top-4 duration-500">
        <h1 className="font-display italic tracking-tight text-gray-900 dark:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" style={{ fontSize: 'clamp(28px, 8vw, 54px)', lineHeight: '1' }}>
          Documentações
        </h1>
        <p className="text-gray-900 dark:text-white/70 text-sm mt-1 font-medium">Acesse, baixe e envie documentos específicos por cargo.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {CARGOS.map((cargo) => (
          <button
            key={cargo.id}
            onClick={() => setSelectedCargo(cargo)}
            className="group relative flex flex-row items-center justify-start py-4 px-5 rounded-[24px] bg-white transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-1 border border-gray-100"
          >
            {/* Ícone */}
            <div className="mr-4 transition-transform duration-500 group-hover:scale-110 shrink-0 flex items-center justify-center">
              <cargo.icon className="w-8 h-8 text-gray-900" strokeWidth={1.5} />
            </div>
            
            {/* Texto */}
            <h3 className="font-serif italic text-xl text-gray-900 tracking-wide font-medium text-left leading-tight">
              {cargo.name.replace('\n', ' ')}
            </h3>
          </button>
        ))}
      </div>

      {selectedCargo && (
        <CargoDocsViewer 
          cargoId={selectedCargo.id} 
          cargoName={selectedCargo.name} 
          onClose={() => setSelectedCargo(null)} 
        />
      )}
    </div>
  );
}


