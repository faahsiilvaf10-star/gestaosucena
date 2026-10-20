import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import Leaf from 'lucide-react/dist/esm/icons/leaf.js';
import Hammer from 'lucide-react/dist/esm/icons/hammer.js';
import Clock from 'lucide-react/dist/esm/icons/clock.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import * as Icons from 'lucide-react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { isAdmin } from '../../components/ui/VerifiedBadge';
import { CreateModuleModal } from '../../components/rdo/CreateModuleModal';
import { CustomRdoModulo } from '../../types/rdoCustomModule';

export const Route = createFileRoute('/relatorio-obra/')({
  component: RelatorioObraHub,
});

const DEFAULT_HUB_ITEMS = [
  { name: 'RDO', icon: FileText, href: '/relatorio-obra/rdo', desc: 'Relatório Diário de Obra' },
  { name: 'Atividade Jardinagem', icon: Leaf, href: '/relatorio-obra/jardinagem', desc: 'Registros de jardinagem' },
  { name: 'Atividade Gabião', icon: Hammer, href: '/relatorio-obra/gabiao', desc: 'Registros de gabião' },
  { name: 'Atividade Prevista', icon: Clock, href: '/relatorio-obra/rdo', desc: 'Planejamento futuro' },
];

function RelatorioObraHub() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customModulos, setCustomModulos] = useState<CustomRdoModulo[]>([]);
  const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);

  // Verificar admin
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name = user.user_metadata?.full_name || user.user_metadata?.name || '';
        const role = user.user_metadata?.role || '';
        setCurrentUserIsAdmin(isAdmin(name, role));
      }
    });
  }, []);

  // Carregar módulos customizados
  const fetchCustomModulos = async () => {
    try {
      // 1. Tentar remoto
      const { data } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'rdo_modulos_customizados')
        .single();

      if (data && Array.isArray(data.value)) {
        setCustomModulos(data.value);
        localStorage.setItem('rdo_modulos_customizados', JSON.stringify(data.value));
        return;
      }

      // 2. Fallback local
      const local = localStorage.getItem('rdo_modulos_customizados');
      if (local) {
        try {
          setCustomModulos(JSON.parse(local));
        } catch (e) {}
      }
    } catch (e) {
      console.warn('Erro ao buscar módulos customizados:', e);
      const local = localStorage.getItem('rdo_modulos_customizados');
      if (local) {
        try {
          setCustomModulos(JSON.parse(local));
        } catch (err) {}
      }
    }
  };

  useEffect(() => {
    fetchCustomModulos();

    // Inscrição em tempo real para sincronizar novos módulos entre usuários
    const channel = supabase
      .channel('rdo_modulos_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'global_settings', filter: 'key=eq.rdo_modulos_customizados' },
        () => {
          fetchCustomModulos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Salvar novo módulo criado por qualquer encarregado
  const handleSaveModulo = async (newModuloData: Omit<CustomRdoModulo, 'created_at'>) => {
    const newModulo: CustomRdoModulo = {
      ...newModuloData,
      created_at: new Date().toISOString(),
    };

    const updatedList = [...customModulos.filter(m => m.id !== newModulo.id), newModulo];
    setCustomModulos(updatedList);
    localStorage.setItem('rdo_modulos_customizados', JSON.stringify(updatedList));

    try {
      const { error } = await supabase.from('global_settings').upsert({
        key: 'rdo_modulos_customizados',
        value: updatedList,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
      toast.success(`Botão "${newModulo.name}" adicionado com sucesso!`);
    } catch (e: any) {
      console.error('Erro ao salvar módulo no banco:', e);
      toast.success(`Botão "${newModulo.name}" criado localmente!`);
    }
  };

  // Excluir módulo (Apenas Admin)
  const handleDeleteModulo = async (moduloId: string, moduloName: string) => {
    if (!currentUserIsAdmin) {
      toast.error('Apenas administradores podem excluir este módulo');
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir o botão "${moduloName}"?`)) return;

    const updatedList = customModulos.filter(m => m.id !== moduloId);
    setCustomModulos(updatedList);
    localStorage.setItem('rdo_modulos_customizados', JSON.stringify(updatedList));

    try {
      const { error } = await supabase.from('global_settings').upsert({
        key: 'rdo_modulos_customizados',
        value: updatedList,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
      toast.success(`Módulo "${moduloName}" excluído com sucesso!`);
    } catch (e) {
      console.error('Erro ao excluir módulo:', e);
      toast.error('Erro ao excluir módulo');
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

        {/* Grid de Atividades da Obra — Cards Fixos + Módulos Customizados + Botão Nova Atividade */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full animate-in fade-in zoom-in-95 duration-700">
          {/* Módulos Fixos (RDO, Jardinagem, Gabião, Prevista) */}
          {DEFAULT_HUB_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Link
                key={`default-${idx}`}
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

          {/* Módulos Customizados Criados pelos Encarregados (igual Jardinagem e Gabião) */}
          {customModulos.map(modulo => {
            const IconComponent = (Icons as any)[modulo.icon] || Icons.Activity;
            return (
              <div key={modulo.id} className="relative group">
                <Link
                  to={`/relatorio-obra/modulo/${modulo.id}` as any}
                  className="relative flex flex-col items-center justify-center p-6 h-40 rounded-[32px] liquid-card-effect transition-all duration-300 hover:shadow-lg hover:-translate-y-1 w-full"
                >
                  <div className="mb-4 transition-transform duration-500 group-hover:scale-110 z-10">
                    <IconComponent className="w-10 h-10 text-current opacity-90" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-xl tracking-wide font-medium text-center whitespace-pre-line leading-tight z-10 text-current">
                    {modulo.name}
                  </h3>
                </Link>

                {/* Opção de Excluir (Visível Apenas para o Admin) */}
                {currentUserIsAdmin && (
                  <button
                    type="button"
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteModulo(modulo.id, modulo.name);
                    }}
                    className="absolute top-3.5 right-3.5 p-2 rounded-full bg-white/90 dark:bg-black/60 text-gray-400 hover:text-red-500 hover:bg-white dark:hover:bg-black transition-all shadow-xs z-20 cursor-pointer opacity-80 group-hover:opacity-100"
                    title={`Excluir botão "${modulo.name}" (Administrador)`}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
          })}

          {/* Botão Nova Atividade (Pontilhado) — Aberto para qualquer encarregado */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="group relative flex flex-col items-center justify-center p-6 h-40 rounded-[32px] transition-all duration-300 bg-white/50 dark:bg-white/10 text-black dark:text-white border-2 border-dashed border-gray-400 dark:border-gray-500 hover:bg-white dark:hover:bg-white/20 hover:border-solid hover:shadow-xl hover:-translate-y-1 overflow-hidden active:scale-[0.98] cursor-pointer"
            title="Cadastrar Novo Botão de Atividade"
          >
            <div className="mb-3 transition-transform duration-500 group-hover:scale-110 z-10">
              <Plus className="w-10 h-10 text-current opacity-90" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl tracking-wide font-medium text-center whitespace-pre-line leading-tight z-10 text-current">
              Nova Atividade
            </h3>
          </button>
        </div>

        {/* Modal de Criação de Novo Botão de Atividade */}
        <CreateModuleModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveModulo}
        />
      </div>
    </div>
  );
}
