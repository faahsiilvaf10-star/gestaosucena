import { useState } from 'react';
import { Plus, Trash2, Sparkles, Layers, Sliders, ChevronDown, Check, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { IconSelector } from './IconPicker';
import { CustomRdoModulo, CustomCardModel, CustomModelType } from '@/types/rdoCustomModule';

interface CreateModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (modulo: Omit<CustomRdoModulo, 'created_at'>) => Promise<void>;
  initialData?: CustomRdoModulo;
  isEditing?: boolean;
}

const PRESET_JARDINAGEM: CustomCardModel[] = [
  { id: 'm-rocagem', tipo: 'medicao', titulo: 'ROÇAGEM (M²)', unidade: 'm²' },
  { id: 'm-rocagem-asp', tipo: 'medicao', titulo: 'ROÇAGEM ASPERSORES (UNIDADES)', unidade: 'unid' },
  { id: 'm-podagem', tipo: 'medicao', titulo: 'PODAGEM (UNIDADE)', unidade: 'unid' },
  {
    id: 'm-plantio',
    tipo: 'selecao',
    titulo: 'PLANTIO (UNIDADE)',
    unidade: 'unid',
    labelOpcao: 'Espécie',
    opcoes: ['Ipê Amarelo', 'Ipê Roxo', 'Açaí', 'Castanheira', 'Mogno', 'Mudas Nativas'],
  },
  { id: 'm-limpeza-man', tipo: 'medicao', titulo: 'LIMPEZA MANUAL (M²)', unidade: 'm²' },
  { id: 'm-limpeza-sop', tipo: 'medicao', titulo: 'LIMPEZA COM SOPRADOR (M²)', unidade: 'm²' },
  {
    id: 'm-invasoras',
    tipo: 'selecao',
    titulo: 'CONTROLE DE INVASORAS',
    unidade: 'unid',
    labelOpcao: 'Nome da Invasora',
    opcoes: ['Acácia', 'Erva Daninha', 'Erva-de-passarinho', 'Juqueri', 'Leucena'],
  },
  { id: 'm-plantio-grama', tipo: 'medicao', titulo: 'PLANTIO DE GRAMA (M²)', unidade: 'm²' },
];

const PRESET_GABIAO: CustomCardModel[] = [
  { id: 'g-escavacao', tipo: 'medicao', titulo: 'ESCAVAÇÃO MANUAL (M³)', unidade: 'm³' },
  { id: 'g-manta', tipo: 'medicao', titulo: 'REPOSIÇÃO DE MANTA ASFÁLTICA (M²)', unidade: 'm²' },
  { id: 'g-silte', tipo: 'medicao', titulo: 'REPOSIÇÃO DE SILTE (M²)', unidade: 'm²' },
  { id: 'g-ret-tela', tipo: 'medicao', titulo: 'RETIRADA DE TELA (M)', unidade: 'm' },
  { id: 'g-ret-cascalho', tipo: 'medicao', titulo: 'RETIRADA DE CASCALHO (M²)', unidade: 'm²' },
  { id: 'g-rec-tela', tipo: 'medicao', titulo: 'RECOMPOSIÇÃO DE TELA (M)', unidade: 'm' },
  { id: 'g-rec-cascalho', tipo: 'medicao', titulo: 'RECOMPOSIÇÃO DE CASCALHO (M²)', unidade: 'm²' },
  { id: 'g-limpeza', tipo: 'checkbox', titulo: 'Limpeza e Organização Geral' },
];

const PRESET_CIVIL: CustomCardModel[] = [
  { id: 'c-concreto', tipo: 'medicao', titulo: 'CONCRETAGEM (M³)', unidade: 'm³' },
  { id: 'c-alvenaria', tipo: 'medicao', titulo: 'ALVENARIA (M²)', unidade: 'm²' },
  { id: 'c-pintura', tipo: 'medicao', titulo: 'PINTURA (M²)', unidade: 'm²' },
  { id: 'c-aterro', tipo: 'medicao', titulo: 'COMPACTAÇÃO DE ATERRO (M³)', unidade: 'm³' },
  { id: 'c-drenagem', tipo: 'medicao', titulo: 'ASSENTAMENTO DE TUBOS / DRENAGEM (M)', unidade: 'm' },
  { id: 'c-inspecao', tipo: 'checkbox', titulo: 'Inspeção e Liberação de Qualidade' },
];

export function CreateModuleModal({ isOpen, onClose, onSave, initialData, isEditing = false }: CreateModuleModalProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [icon, setIcon] = useState(initialData?.icon || 'Hammer');
  const [desc, setDesc] = useState(initialData?.desc || '');
  const [temOutrasAtividades, setTemOutrasAtividades] = useState(initialData?.temOutrasAtividades !== false);
  const [models, setModels] = useState<CustomCardModel[]>(() => {
    if (initialData?.models && initialData.models.length > 0) return initialData.models;
    return [...PRESET_JARDINAGEM];
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Adicionar novo modelo manual
  const handleAddModel = (tipo: CustomModelType) => {
    const id = 'model-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    if (tipo === 'medicao') {
      setModels(prev => [
        ...prev,
        { id, tipo: 'medicao', titulo: 'NOVA MEDIÇÃO (M²)', unidade: 'm²' },
      ]);
    } else if (tipo === 'selecao') {
      setModels(prev => [
        ...prev,
        {
          id,
          tipo: 'selecao',
          titulo: 'NOVA SELEÇÃO COM OPÇÕES',
          unidade: 'unid',
          labelOpcao: 'Opção',
          opcoes: ['Opção 1', 'Opção 2', 'Opção 3'],
        },
      ]);
    } else if (tipo === 'checkbox') {
      setModels(prev => [
        ...prev,
        { id, tipo: 'checkbox', titulo: 'Nova Tarefa de Marcação' },
      ]);
    }
  };

  const handleUpdateModel = (id: string, updates: Partial<CustomCardModel>) => {
    setModels(prev => prev.map(m => (m.id === id ? { ...m, ...updates } : m)));
  };

  const handleRemoveModel = (id: string) => {
    setModels(prev => prev.filter(m => m.id !== id));
  };

  const handleApplyPreset = (presetKey: 'jardinagem' | 'gabiao' | 'civil' | 'limpo') => {
    if (presetKey === 'jardinagem') {
      setModels([...PRESET_JARDINAGEM]);
      if (!name) setName('Atividade Jardinagem Extra');
      setIcon('Leaf');
    } else if (presetKey === 'gabiao') {
      setModels([...PRESET_GABIAO]);
      if (!name) setName('Atividade Gabião & Drenagem');
      setIcon('Hammer');
    } else if (presetKey === 'civil') {
      setModels([...PRESET_CIVIL]);
      if (!name) setName('Atividade Obras Civis');
      setIcon('HardHat');
    } else {
      setModels([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Informe o nome da atividade');
      return;
    }

    if (models.length === 0 && !temOutrasAtividades) {
      setError('Adicione ao menos um modelo de card para esta atividade');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let formattedName = name.trim();
      if (!formattedName.toLowerCase().startsWith('atividade')) {
        formattedName = `Atividade ${formattedName}`;
      }

      const id = initialData?.id || formattedName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      await onSave({
        id,
        name: formattedName,
        icon,
        desc: desc.trim() || undefined,
        models,
        temOutrasAtividades,
      });

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar a atividade');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Sparkles size={22} />
            </span>
            <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {isEditing ? 'Configurar Modelos da Atividade' : 'Criar Nova Atividade'}
            </DialogTitle>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configure os mesmos cards e modelos de Jardinagem (medições, faixas, bermas e opções) de forma 100% visual.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {error && (
            <div className="p-3 text-sm bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-2xl">
              {error}
            </div>
          )}

          {/* Nome e Ícone */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Nome da Atividade *
              </label>
              <input
                type="text"
                placeholder="Ex: Terraplanagem, Drenagem, Pintura..."
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all font-medium text-sm"
              />
              <span className="text-[11px] text-gray-500">
                O prefixo &quot;Atividade&quot; será adicionado automaticamente se omitido.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Ícone do Botão
              </label>
              <IconSelector value={icon} onChange={setIcon} size="md" />
            </div>
          </div>

          {/* Modelos Prontos (Presets) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center justify-between">
              <span>Modelos Pré-Prontos de Obra</span>
              <span className="text-[11px] text-amber-600 font-normal">Clique para carregar</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleApplyPreset('jardinagem')}
                className="p-3 rounded-2xl border border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20 hover:bg-green-100/60 transition-all text-left group"
              >
                <div className="text-xs font-bold text-green-700 dark:text-green-400 flex items-center justify-between">
                  <span>🌿 Jardinagem</span>
                  <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-[10px] text-gray-500 mt-1">Roçagem, mudas, invasoras, etc.</div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('gabiao')}
                className="p-3 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/60 transition-all text-left group"
              >
                <div className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center justify-between">
                  <span>🔨 Gabião</span>
                  <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-[10px] text-gray-500 mt-1">Escavação, manta, silte, telas</div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('civil')}
                className="p-3 rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/60 transition-all text-left group"
              >
                <div className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center justify-between">
                  <span>🏗️ Obras Civis</span>
                  <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-[10px] text-gray-500 mt-1">Concreto, pintura, alvenaria</div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('limpo')}
                className="p-3 rounded-2xl border border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800/40 hover:bg-gray-100/60 transition-all text-left group"
              >
                <div className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                  <span>✨ Em Branco</span>
                  <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-[10px] text-gray-500 mt-1">Criar modelos do zero</div>
              </button>
            </div>
          </div>

          {/* Lista de Cards / Modelos Configurados */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-zinc-800 pb-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Cards &amp; Modelos da Atividade ({models.length})
                </label>
                <p className="text-[11px] text-gray-500">
                  Cada item vira um card na tela com botão &quot;+&quot;, Faixa e Elevado/Berma igual Jardinagem.
                </p>
              </div>

              {/* Botões de Adicionar Novos Tipos */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleAddModel('medicao')}
                  className="px-2.5 py-1.5 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-amber-400 text-xs font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1 shadow-2xs"
                  title="Card com campo de medição + Faixa + Elevado/Berma (Ex: Roçagem, Limpeza, Podagem)"
                >
                  <Plus size={13} /> + Medição (Faixa/Berma)
                </button>
                <button
                  type="button"
                  onClick={() => handleAddModel('selecao')}
                  className="px-2.5 py-1.5 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-amber-400 text-xs font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1 shadow-2xs"
                  title="Card com dropdown de opções + quantidade + Faixa/Berma (Ex: Plantio de Mudas, Invasoras)"
                >
                  <Plus size={13} /> + Seleção (Espécies/Itens)
                </button>
                <button
                  type="button"
                  onClick={() => handleAddModel('checkbox')}
                  className="px-2.5 py-1.5 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-amber-400 text-xs font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1 shadow-2xs"
                  title="Card de marcação simples (Sim/Não)"
                >
                  <Plus size={13} /> + Marcação Simples
                </button>
              </div>
            </div>

            {/* Render dos cards configurados */}
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {models.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl text-gray-400 text-xs">
                  Nenhum card configurado ainda. Clique em um dos botões acima para adicionar ou escolha um preset.
                </div>
              ) : (
                models.map((mod, idx) => (
                  <div
                    key={mod.id}
                    className="p-3.5 bg-gray-50/70 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-700/80 rounded-2xl flex flex-col gap-2.5 transition-all hover:border-gray-300 dark:hover:border-zinc-600"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-gray-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-300">
                          {idx + 1}
                        </span>
                        <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-amber-100/70 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                          {mod.tipo === 'medicao' && '📐 Medição (Faixa/Berma)'}
                          {mod.tipo === 'selecao' && '🌱 Seleção com Opções'}
                          {mod.tipo === 'checkbox' && '☑️ Marcação Simples'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveModel(mod.id)}
                        className="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title="Remover este card"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          value={mod.titulo}
                          onChange={e => handleUpdateModel(mod.id, { titulo: e.target.value })}
                          placeholder="Título do Card (Ex: ROÇAGEM (M²))"
                          className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500 uppercase"
                        />
                      </div>

                      {mod.tipo !== 'checkbox' && (
                        <div>
                          <input
                            type="text"
                            value={mod.unidade || ''}
                            onChange={e => handleUpdateModel(mod.id, { unidade: e.target.value })}
                            placeholder="Unidade (Ex: m², unid, m³)"
                            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      )}
                    </div>

                    {/* Se for do tipo seleção (Plantio, Invasoras), editar opções */}
                    {mod.tipo === 'selecao' && (
                      <div className="space-y-1.5 pt-1 border-t border-gray-200/60 dark:border-zinc-700/60">
                        <div className="flex items-center justify-between text-[11px] text-gray-500">
                          <span>Opções selecionáveis no dropdown (separadas por vírgula):</span>
                        </div>
                        <input
                          type="text"
                          value={(mod.opcoes || []).join(', ')}
                          onChange={e =>
                            handleUpdateModel(mod.id, {
                              opcoes: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                            })
                          }
                          placeholder="Ex: Acácia, Erva Daninha, Juqueri, Leucena"
                          className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Switch de Outras Atividades (Preenchimento Manual) */}
          <div className="p-4 rounded-2xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-amber-800 dark:text-amber-400">
                Card de &quot;Outras Atividades (Preenchimento Manual)&quot;
              </div>
              <div className="text-[11px] text-gray-600 dark:text-gray-400">
                Inclui o card amarelo com seleção de Faixa, Elevado/Berma e campo de texto livre para anotações do dia.
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={temOutrasAtividades}
                onChange={e => setTemOutrasAtividades(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-full sm:w-auto px-5 py-2.5 rounded-2xl border border-gray-300 dark:border-zinc-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? 'Salvando...' : isEditing ? 'Atualizar Atividade' : 'Criar Atividade'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
