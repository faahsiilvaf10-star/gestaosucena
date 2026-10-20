import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import Leaf from 'lucide-react/dist/esm/icons/leaf.js';
import Hammer from 'lucide-react/dist/esm/icons/hammer.js';
import Clock from 'lucide-react/dist/esm/icons/clock.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { ActivityModal } from '../../components/rdo/ActivityModal';
import { ActivitiesPanel } from '../../components/rdo/ActivitiesPanel';
import { RdoAtividade } from '../../components/rdo/ActivityCard';

export const Route = createFileRoute('/relatorio-obra/')({
  component: RelatorioObraHub,
});

const HUB_ITEMS = [
  { name: 'RDO', icon: FileText, href: '/relatorio-obra/rdo', desc: 'Relatório Diário de Obra' },
  { name: 'Atividade Jardinagem', icon: Leaf, href: '/relatorio-obra/jardinagem', desc: 'Registros de jardinagem' },
  { name: 'Atividade Gabião', icon: Hammer, href: '/relatorio-obra/gabiao', desc: 'Registros de gabião' },
  { name: 'Atividade Prevista', icon: Clock, href: '/relatorio-obra/rdo', desc: 'Planejamento futuro' },
];

function RelatorioObraHub() {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaveActivity = async (atividadeData: Partial<RdoAtividade>) => {
    try {
      const env =
        typeof window !== 'undefined'
          ? localStorage.getItem('sucena_environment') || 'barcarena'
          : 'barcarena';

      // Codificar itens nas observações como fallback seguro
      const subItens = (atividadeData as any).itens;
      let obs = atividadeData.observacoes || '';
      if (Array.isArray(subItens) && subItens.length > 0) {
        obs = obs.replace(/__ITEMS__:[\s\S]*$/, '').trim();
        obs = (obs ? obs + '\n' : '') + `__ITEMS__:${JSON.stringify(subItens)}`;
      }

      const dataToSave: any = {
        ...atividadeData,
        obra_id: env,
        data: atividadeData.data || selectedDate,
        observacoes: obs || null,
      };
      delete dataToSave.itens;

      const { error } = await supabase.from('rdo_atividades').insert([dataToSave]);

      if (error) throw error;
      toast.success('Atividade criada com sucesso!');
      setIsModalOpen(false);
      setRefreshKey(prev => prev + 1);
    } catch (error: any) {
      console.error('Erro ao salvar atividade:', error);
      toast.error('Erro ao salvar atividade: ' + (error.message || 'Erro inesperado'));
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-transparent pb-20">
      <div className="max-w-5xl w-full mx-auto flex flex-col items-center justify-start mt-2 px-2 sm:px-4">
        {/* Title */}
        <div className="flex flex-col items-center justify-center mb-6 mt-2 animate-in fade-in slide-in-from-top-4 duration-500 w-full px-1">
          <div className="flex items-center gap-3">
            <h1
              className="tracking-tight text-[#1c1d21] dark:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] text-center"
              style={{ fontSize: 'clamp(28px, 8vw, 54px)', lineHeight: '1' }}
            >
              Relatório de Obra
            </h1>
          </div>
          <p className="text-gray-600 dark:text-white/70 text-sm mt-3 font-medium text-center">
            Gestão e acompanhamento das atividades da obra
          </p>
        </div>

        {/* Grid — 1 col mobile, 2 col sm, 3 col lg */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full animate-in fade-in zoom-in-95 duration-700">
          {HUB_ITEMS.map((item, idx) => {
            const Icon = item.icon;
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
            );
          })}

          {/* Botão Nova Atividade (Pontilhado) */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="group flex items-center sm:flex-col sm:items-center sm:justify-center gap-4 sm:gap-3 py-1 sm:py-2 px-4 sm:px-6 rounded-2xl sm:rounded-3xl transition-all duration-300 bg-white/50 dark:bg-white/10 text-black dark:text-white border-2 border-dashed border-gray-400 dark:border-gray-500 hover:bg-white dark:hover:bg-white/20 hover:border-solid hover:shadow-xl hover:-translate-y-1 sm:hover:-translate-y-2 relative overflow-hidden active:scale-[0.98] cursor-pointer"
            style={{ minHeight: 60 }}
            title="Cadastrar Nova Atividade"
          >
            <Plus
              size={32}
              className="text-black dark:text-white opacity-90 group-hover:scale-110 transition-transform duration-300 relative z-10 flex-shrink-0 sm:w-12 sm:h-12 sm:mb-1"
              strokeWidth={1.5}
            />
            <div className="flex flex-col min-w-0 sm:items-center">
              <span className="text-xl sm:text-2xl lg:text-3xl tracking-wide font-light relative z-10 sm:text-center">
                Nova Atividade
              </span>
            </div>
          </button>
        </div>

        {/* Painel de Atividades da Obra */}
        <div className="w-full mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <ActivitiesPanel
            key={refreshKey}
            dataAtual={selectedDate}
          />
        </div>

        {/* Modal de Nova Atividade */}
        <ActivityModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveActivity}
          dataAtual={selectedDate}
        />
      </div>
    </div>
  );
}
