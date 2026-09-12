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
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col items-center justify-center mb-8 mt-2 animate-in fade-in slide-in-from-top-4 duration-500">
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
            className="group relative flex flex-col items-center justify-center p-10 rounded-[32px] bg-white transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-1 border border-gray-100"
          >
            {/* Ícone */}
            <div className="mb-6 transition-transform duration-500 group-hover:scale-110">
              <cargo.icon className="w-10 h-10 text-gray-900" strokeWidth={1.5} />
            </div>
            
            {/* Texto */}
            <h3 className="font-serif italic text-2xl text-gray-900 tracking-wide font-medium text-center">
              {cargo.name}
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


