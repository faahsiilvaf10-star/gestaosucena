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
  { id: 'mestre', name: 'Mestre de Obras', icon: Hammer },
];

function DocumentosIndex() {
  const { isDark } = useTheme();
  const [selectedCargo, setSelectedCargo] = useState<{id: string, name: string} | null>(null);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-serif font-bold tracking-tight">Documentações</h1>
        <p className={`text-sm ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
          Acesse, baixe e envie documentos específicos por cargo.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {CARGOS.map((cargo) => (
          <button
            key={cargo.id}
            onClick={() => setSelectedCargo(cargo)}
            className={`group relative flex flex-col items-center justify-center p-10 rounded-3xl transition-all duration-300 overflow-hidden ${
              isDark 
                ? 'bg-[#121214] border border-white/5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] hover:bg-[#1a1a1c] hover:border-white/10 hover:-translate-y-1 hover:shadow-[0_12px_32px_-8px_rgba(250,204,21,0.15)]' 
                : 'bg-white border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:-translate-y-1 hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.1)]'
            }`}
          >
            {/* Background glow effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/0 via-transparent to-transparent opacity-0 group-hover:opacity-10 transition-opacity duration-500" />
            
            <div className={`p-4 rounded-2xl mb-6 transition-transform duration-500 group-hover:scale-110 ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
              <cargo.icon className={`w-8 h-8 ${isDark ? 'text-white' : 'text-gray-900'}`} strokeWidth={1.5} />
            </div>
            
            <h3 className="font-serif text-xl tracking-wide font-medium text-center">
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
