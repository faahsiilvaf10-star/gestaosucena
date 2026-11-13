import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import Leaf from 'lucide-react/dist/esm/icons/leaf.js';
import Hammer from 'lucide-react/dist/esm/icons/hammer.js';
import Clock from 'lucide-react/dist/esm/icons/clock.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import * as Icons from 'lucide-react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { isAdmin } from '../../components/ui/VerifiedBadge';
import { CreateModuleModal } from '../../components/rdo/CreateModuleModal';
import { CustomRdoModulo } from '../../types/rdoCustomModule';
import { getInitialCivilModulos } from '../../lib/civilAreasData';

export const Route = createFileRoute('/relatorio-obra/')({
  component: RelatorioObraHub,
});

const DEFAULT_HUB_ITEMS = [
  { id: 'rdo', name: 'RDO', icon: FileText, href: '/relatorio-obra/rdo', desc: 'Relatório Diário de Obra' },
  { id: 'jardinagem', name: 'Atividade Jardinagem', icon: Leaf, href: '/relatorio-obra/jardinagem', desc: 'Registros de jardinagem' },
  { id: 'gabiao', name: 'Atividade Gabião', icon: Hammer, href: '/relatorio-obra/gabiao', desc: 'Registros de gabião' },
  { id: 'prevista', name: 'Atividade Prevista', icon: Clock, href: '/relatorio-obra/rdo', desc: 'Planejamento futuro' },
];

function RelatorioObraHub() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customModulos, setCustomModulos] = useState<CustomRdoModulo[]>([]);
  const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);
  const [savedToday, setSavedToday] = useState<Set<string>>(new Set());

  const getTodayDateStr = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const isSavedCustom = (d: any) => {
    if (!d) return false;
    if (d.isLocked !== false && d.isLocked !== undefined) return true;
    if (d.renderedSummary && d.renderedSummary.trim() && !d.renderedSummary.startsWith('Nenhuma atividade')) return true;
    if (d.outrasAtividades?.descricao && d.outrasAtividades.descricao.trim()) return true;
    if (d.cardRows && Object.values(d.cardRows).some((rows: any) => Array.isArray(rows) && rows.some((r: any) => r && r.value && r.value !== '0' && r.value !== '0,00'))) return true;
    if (d.cardCheckboxes && Object.values(d.cardCheckboxes).some((v: any) => !!v)) return true;
    return false;
  };

  const hasDataObj = (val: any) => {
    if (!val) return false;
    if (val.isLocked !== false && val.isLocked !== undefined) return true;
    return Object.values(val).some((v: any) => {
      if (Array.isArray(v)) return v.some((r: any) => r && r.value && r.value !== '0' && r.value !== '0,00');
      if (typeof v === 'string') return v.trim().length > 0;
      return false;
    });
  };

  const fetchSavedToday = async () => {
    const todayStr = getTodayDateStr();
    const isCivilEnv = currentEnv === 'hydro-civil';
    const rdoKey = isCivilEnv ? `main_rdo_civil_${todayStr}` : `main_rdo_${todayStr}`;
    const newSaved = new Set<string>();

    if (typeof window !== 'undefined') {
      try {
        const rdoLocal = localStorage.getItem(rdoKey);
        if (rdoLocal) {
          const parsed = JSON.parse(rdoLocal);
          if (parsed && parsed.isLocked !== false) newSaved.add('rdo');
        }
        const jarLocal = localStorage.getItem(`jardinagem_rdo_${todayStr}`);
        if (jarLocal) {
          const parsed = JSON.parse(jarLocal);
          if (parsed && (parsed.isLocked !== false || hasDataObj(parsed))) newSaved.add('jardinagem');
        }
        const gabLocal = localStorage.getItem(`gabiao_rdo_${todayStr}`);
        if (gabLocal) {
          const parsed = JSON.parse(gabLocal);
          if (parsed && (parsed.isLocked !== false || hasDataObj(parsed))) newSaved.add('gabiao');
        }
        Object.keys(localStorage).forEach(k => {
          if (k.startsWith('custom_rdo_') && k.endsWith(`_${todayStr}`)) {
            try {
              const val = JSON.parse(localStorage.getItem(k) || '');
              if (val && isSavedCustom(val)) {
                const modId = k.replace('custom_rdo_', '').replace(`_${todayStr}`, '');
                if (modId) newSaved.add(modId);
              }
            } catch (e) {}
          }
        });
      } catch (e) {}
    }

    setSavedToday(new Set(newSaved));

    try {
      const { data: list } = await supabase
        .from('global_settings')
        .select('key, value')
        .like('key', `%_${todayStr}`);

      if (list && Array.isArray(list)) {
        list.forEach(item => {
          const k = item.key;
          const val = item.value;
          if (!val) return;

          if (k === rdoKey && val.isLocked !== false) {
            newSaved.add('rdo');
          } else if (k === `jardinagem_rdo_${todayStr}` && (val.isLocked !== false || hasDataObj(val))) {
            newSaved.add('jardinagem');
          } else if (k === `gabiao_rdo_${todayStr}` && (val.isLocked !== false || hasDataObj(val))) {
            newSaved.add('gabiao');
          } else if (k.startsWith('custom_rdo_') && k.endsWith(`_${todayStr}`) && isSavedCustom(val)) {
            const modId = k.replace('custom_rdo_', '').replace(`_${todayStr}`, '');
            if (modId) newSaved.add(modId);
          }
        });
        setSavedToday(new Set(newSaved));
      }
    } catch (err) {
      console.warn('Erro ao verificar relatórios salvos hoje:', err);
    }
  };
  const [currentEnv, setCurrentEnv] = useState<string>(() => {
    return typeof window !== 'undefined'
      ? (localStorage.getItem('sucena_environment') || 'barcarena')
      : 'barcarena';
  });

  const isCivil = currentEnv === 'hydro-civil';
  const storageKey = isCivil ? 'rdo_modulos_customizados_hydro-civil' : 'rdo_modulos_customizados';

  // Monitorar mudanças de ambiente no cabeçalho
  useEffect(() => {
    const handleEnvChange = (e: any) => {
      const newEnv = e.detail?.environment || localStorage.getItem('sucena_environment') || 'barcarena';
      setCurrentEnv(newEnv);
    };
    window.addEventListener('sucena_environment_change', handleEnvChange);
    return () => window.removeEventListener('sucena_environment_change', handleEnvChange);
  }, []);

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

  // Carregar módulos customizados do ambiente ativo
  const fetchCustomModulos = async () => {
    try {
      if (isCivil) {
        // No ambiente civil, carregar e garantir as 12 áreas oficiais
        const { data } = await supabase
          .from('global_settings')
          .select('value')
          .eq('key', storageKey)
          .single();

        let list: CustomRdoModulo[] = [];
        if (data && Array.isArray(data.value) && data.value.length > 0) {
          list = data.value;
          const initialMods = getInitialCivilModulos();
          const existingIds = new Set(list.map(m => m.id));
          const missing = initialMods.filter(m => !existingIds.has(m.id));
          if (missing.length > 0) {
            list = [...list, ...missing];
            supabase.from('global_settings').upsert({
              key: storageKey,
              value: list,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'key' }).catch(console.warn);
          }
        } else {
          list = getInitialCivilModulos();
          supabase.from('global_settings').upsert({
            key: storageKey,
            value: list,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'key' }).catch(console.warn);
        }

        setCustomModulos(list);
        localStorage.setItem(storageKey, JSON.stringify(list));
        return;
      }

      // Ambiente Reabilitação (Barcarena)
      // 1. Tentar remoto
      const { data } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', storageKey)
        .single();

      if (data && Array.isArray(data.value)) {
        setCustomModulos(data.value);
        localStorage.setItem(storageKey, JSON.stringify(data.value));
        return;
      }

      // 2. Fallback local
      const local = localStorage.getItem(storageKey);
      if (local) {
        try {
          setCustomModulos(JSON.parse(local));
          return;
        } catch (e) {}
      }
      setCustomModulos([]);
    } catch (e) {
      console.warn('Erro ao buscar módulos customizados:', e);
      if (isCivil) {
        const initial = getInitialCivilModulos();
        setCustomModulos(initial);
        localStorage.setItem(storageKey, JSON.stringify(initial));
      } else {
        const local = localStorage.getItem(storageKey);
        if (local) {
          try {
            setCustomModulos(JSON.parse(local));
          } catch (err) {}
        } else {
          setCustomModulos([]);
        }
      }
    }
  };

  useEffect(() => {
    fetchCustomModulos();

    // Inscrição em tempo real para sincronizar novos módulos entre usuários
    const channel = supabase
      .channel(`rdo_modulos_${storageKey}_realtime`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'global_settings', filter: `key=eq.${storageKey}` },
        () => {
          fetchCustomModulos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storageKey]);

  useEffect(() => {
    fetchSavedToday();

    const handleSavedEvent = (e: any) => {
      if (e?.detail?.moduloId) {
        if (e.detail.isLocked === false) {
          setSavedToday(prev => {
            const next = new Set(prev);
            next.delete(e.detail.moduloId);
            return next;
          });
        } else {
          setSavedToday(prev => new Set([...prev, e.detail.moduloId]));
        }
      }
      fetchSavedToday();
    };

    window.addEventListener('sucena_rdo_saved', handleSavedEvent);
    window.addEventListener('storage', handleSavedEvent);

    const channel = supabase
      .channel(`hub_saved_today_${storageKey}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'global_settings' },
        () => {
          fetchSavedToday();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('sucena_rdo_saved', handleSavedEvent);
      window.removeEventListener('storage', handleSavedEvent);
      supabase.removeChannel(channel);
    };
  }, [currentEnv, storageKey]);

  // Salvar novo módulo criado por qualquer encarregado
  const handleSaveModulo = async (newModuloData: Omit<CustomRdoModulo, 'created_at'>) => {
    const newModulo: CustomRdoModulo = {
      ...newModuloData,
      environment: isCivil ? 'hydro-civil' : 'barcarena',
      created_at: new Date().toISOString(),
    };

    const updatedList = [...customModulos.filter(m => m.id !== newModulo.id), newModulo];
    setCustomModulos(updatedList);
    localStorage.setItem(storageKey, JSON.stringify(updatedList));

    try {
      const { error } = await supabase.from('global_settings').upsert({
        key: storageKey,
        value: updatedList,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

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
    localStorage.setItem(storageKey, JSON.stringify(updatedList));

    try {
      const { error } = await supabase.from('global_settings').upsert({
        key: storageKey,
        value: updatedList,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

      if (error) throw error;
      toast.success(`Módulo "${moduloName}" excluído com sucesso!`);
    } catch (e) {
      console.error('Erro ao excluir módulo:', e);
      toast.error('Erro ao excluir módulo');
    }
  };

  // Filtrar itens padrão com base no ambiente (No Civil, Jardinagem e Gabião são excluídos)
  const activeHubItems = isCivil
    ? DEFAULT_HUB_ITEMS.filter(item => item.href !== '/relatorio-obra/jardinagem' && item.href !== '/relatorio-obra/gabiao')
    : DEFAULT_HUB_ITEMS;

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
          {/* Módulos Fixos (RDO, Jardinagem, Gabião, Prevista - Filtrados por ambiente) */}
          {activeHubItems.map((item, idx) => {
            const Icon = item.icon;
            const isSaved = item.id ? savedToday.has(item.id) : false;

            return (
              <Link
                key={`default-${idx}`}
                to={item.href as any}
                className="group relative flex flex-col items-center justify-center p-6 h-40 rounded-[32px] liquid-card-effect transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              >
                {/* Ícone de Salvo no Dia Atual */}
                {isSaved && (
                  <div
                    className="absolute top-3.5 left-3.5 flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold backdrop-blur-xs shadow-xs animate-in fade-in zoom-in-90 duration-300 z-20 pointer-events-none"
                    title="Relatório preenchido e salvo no dia de hoje"
                  >
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
                    <span className="text-[11px] tracking-tight">Salvo hoje</span>
                  </div>
                )}

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
            const isSaved = savedToday.has(modulo.id);

            return (
              <div key={modulo.id} className="relative group">
                <Link
                  to={`/relatorio-obra/modulo/${modulo.id}` as any}
                  className="relative flex flex-col items-center justify-center p-6 h-40 rounded-[32px] liquid-card-effect transition-all duration-300 hover:shadow-lg hover:-translate-y-1 w-full"
                >
                  {/* Ícone de Salvo no Dia Atual */}
                  {isSaved && (
                    <div
                      className="absolute top-3.5 left-3.5 flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold backdrop-blur-xs shadow-xs animate-in fade-in zoom-in-90 duration-300 z-20 pointer-events-none"
                      title="Relatório preenchido e salvo no dia de hoje"
                    >
                      <CheckCircle2 size={13} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
                      <span className="text-[11px] tracking-tight">Salvo hoje</span>
                    </div>
                  )}

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
