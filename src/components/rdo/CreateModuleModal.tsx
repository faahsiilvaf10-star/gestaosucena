import { useState } from 'react';
import * as Icons from 'lucide-react';
import { Plus, Trash2, Sparkles, Layers } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { IconSelector } from './IconPicker';
import { CustomRdoModulo, CustomRdoItem } from '@/types/rdoCustomModule';

interface CreateModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (modulo: Omit<CustomRdoModulo, 'created_at'>) => Promise<void>;
}

const TEMPLATES_TAREFAS = [
  { nome: 'Limpeza Manual', tipo: 'checkbox' as const },
  { nome: 'Limpeza com Soprador', tipo: 'checkbox' as const },
  { nome: 'Recolhimento de Resíduos', tipo: 'medicao' as const, unidade: 'm²' },
  { nome: 'Roçagem Manual', tipo: 'medicao' as const, unidade: 'm²' },
  { nome: 'Inspeção de Área', tipo: 'checkbox' as const },
  { nome: 'Escavação', tipo: 'medicao' as const, unidade: 'm³' },
];

export function CreateModuleModal({ isOpen, onClose, onSave }: CreateModuleModalProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Activity');
  const [desc, setDesc] = useState('');
  const [itens, setItens] = useState<CustomRdoItem[]>([
    {
      id: 'item-1',
      nome: 'Limpeza Geral',
      tipo: 'checkbox',
      marcado: true,
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAddItem = (template?: { nome: string; tipo: 'checkbox' | 'medicao'; unidade?: string }) => {
    const newItem: CustomRdoItem = {
      id: 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      nome: template?.nome || '',
      tipo: template?.tipo || 'checkbox',
      marcado: true,
      unidade: template?.unidade || 'm²',
    };
    setItens(prev => [...prev, newItem]);
  };

  const handleUpdateItem = (id: string, updates: Partial<CustomRdoItem>) => {
    setItens(prev => prev.map(item => (item.id === id ? { ...item, ...updates } : item)));
  };

  const handleRemoveItem = (id: string) => {
    setItens(prev => prev.filter(item => item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Informe o nome da atividade');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Garantir formato com prefixo "Atividade " para manter o padrão se não digitado
      let formattedName = name.trim();
      if (!formattedName.toLowerCase().startsWith('atividade')) {
        formattedName = `Atividade ${formattedName}`;
      }

      const id = formattedName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const validItens = itens.filter(i => i.nome.trim());

      await onSave({
        id,
        name: formattedName,
        icon,
        desc: desc.trim() || undefined,
        defaultItens: validItens,
      });

      // Reset
      setName('');
      setIcon('Activity');
      setDesc('');
      setItens([{ id: 'item-1', nome: 'Limpeza Geral', tipo: 'checkbox', marcado: true }]);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Erro ao criar atividade');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-[#18181b] border-gray-200 dark:border-white/10 shadow-2xl">
        <DialogHeader className="p-5 border-b border-gray-100 dark:border-white/10 bg-gray-50/70 dark:bg-white/5 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 flex items-center justify-center font-bold">
              <Sparkles size={20} />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                Nova Atividade da Obra
              </DialogTitle>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Cria um botão novo no painel, igual ao de Jardinagem e Gabião
              </p>
            </div>
          </div>
        </DialogHeader>

        <form id="create-module-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Nome da Atividade */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
              Nome da Atividade *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="Ex: Limpeza, Terraplenagem, Drenagem, Pintura..."
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-semibold outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
              autoFocus
            />
            <p className="text-[11px] text-gray-500">
              Será exibido como um botão no painel principal: <strong>{name ? (name.toLowerCase().startsWith('atividade') ? name : `Atividade ${name}`) : 'Atividade ...'}</strong>
            </p>
          </div>

          {/* Seletor de Ícone */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
              Ícone do Botão
            </label>
            <div className="flex items-center gap-3">
              <IconSelector value={icon} onChange={setIcon} size="md" />
              <span className="text-xs text-gray-500">
                Escolha um ícone para representar esse botão
              </span>
            </div>
          </div>

          {/* Tarefas deste Módulo */}
          <div className="p-4 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-yellow-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                  Tarefas que poderão ser marcadas no dia ({itens.length})
                </h3>
              </div>

              <button
                type="button"
                onClick={() => handleAddItem()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
              >
                <Plus size={14} />
                <span>Adicionar Tarefa</span>
              </button>
            </div>

            {/* Modelos rápidos */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
              <span className="text-[10px] text-gray-500 font-semibold shrink-0">Modelos rápidos:</span>
              {TEMPLATES_TAREFAS.map(tpl => (
                <button
                  key={tpl.nome}
                  type="button"
                  onClick={() => handleAddItem(tpl)}
                  className="text-[11px] px-2.5 py-0.5 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-yellow-400 hover:text-yellow-600 transition-colors whitespace-nowrap cursor-pointer shrink-0"
                >
                  + {tpl.nome}
                </button>
              ))}
            </div>

            {/* Lista de tarefas configuradas */}
            <div className="flex flex-col gap-2 mt-1">
              {itens.length === 0 ? (
                <div className="p-4 text-center border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-400">
                  Nenhuma tarefa adicionada ainda. Clique em "+ Adicionar Tarefa" acima.
                </div>
              ) : (
                itens.map(item => (
                  <div
                    key={item.id}
                    className="p-3 bg-white dark:bg-[#202023] rounded-xl border border-gray-200 dark:border-white/10 flex items-center gap-2.5 shadow-2xs"
                  >
                    <span className="w-5 h-5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                      ✓
                    </span>

                    <input
                      type="text"
                      value={item.nome}
                      onChange={e => handleUpdateItem(item.id, { nome: e.target.value })}
                      placeholder="Nome da tarefa (ex: Limpeza manual, Descarte...)"
                      className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold outline-none focus:border-yellow-500"
                    />

                    {item.tipo === 'checkbox' ? (
                      <button
                        type="button"
                        onClick={() => handleUpdateItem(item.id, { tipo: 'medicao' })}
                        className="text-[11px] px-2.5 py-1 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-white/5 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 transition-colors whitespace-nowrap cursor-pointer shrink-0"
                      >
                        + Medição
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <select
                          value={item.unidade || 'm²'}
                          onChange={e => handleUpdateItem(item.id, { unidade: e.target.value })}
                          className="px-2 py-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-md text-xs outline-none cursor-pointer"
                        >
                          <option value="m²">m²</option>
                          <option value="unid">unid</option>
                          <option value="m">m</option>
                          <option value="m³">m³</option>
                          <option value="kg">kg</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleUpdateItem(item.id, { tipo: 'checkbox' })}
                          className="text-[11px] px-2 py-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900/50 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </form>

        <DialogFooter className="p-4 border-t border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex-shrink-0 flex items-center justify-between sm:justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="submit"
            form="create-module-form"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Plus size={16} />
            <span>{loading ? 'Criando...' : 'Criar Botão de Atividade'}</span>
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
