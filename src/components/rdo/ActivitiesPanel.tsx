import { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { Plus, RefreshCw, CheckCircle2, Circle, Pencil, Trash2, ChevronDown, ChevronUp, Filter, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { ActivityCard, RdoAtividade, getSubItens } from './ActivityCard';
import { ActivityModal } from './ActivityModal';

interface ActivitiesPanelProps {
  dataAtual: string;
  obraId?: string;
  onIntegrateWithRDO?: (atividades: RdoAtividade[]) => void;
}

type FilterType = 'all' | 'pending' | 'completed';

export function ActivitiesPanel({ dataAtual, obraId, onIntegrateWithRDO }: ActivitiesPanelProps) {
  const [atividades, setAtividades] = useState<RdoAtividade[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAtividade, setEditingAtividade] = useState<RdoAtividade | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const environment = obraId || (typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena');

  // Buscar atividades do banco
  const fetchAtividades = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rdo_atividades')
        .select('*')
        .eq('data', dataAtual)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Filtrar por obra se necessário
      const filteredData = obraId
        ? (data || []).filter((a: RdoAtividade) => a.obra_id === environment)
        : (data || []).filter((a: RdoAtividade) => !a.obra_id || a.obra_id === environment);

      setAtividades(filteredData);
    } catch (error) {
      console.error('Erro ao buscar atividades:', error);
      toast.error('Erro ao carregar atividades');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAtividades();
  }, [dataAtual, environment]);

  // CRUD Operations
  const handleSave = async (atividadeData: Partial<RdoAtividade>) => {
    try {
      const dataToSave: any = {
        ...atividadeData,
        obra_id: environment,
        data: dataAtual,
      };

      // Compatibilidade: se itens vierem preenchidos, guarda em observações com __ITEMS__:
      if (atividadeData.itens) {
        dataToSave.observacoes = `__ITEMS__:${JSON.stringify(atividadeData.itens)}`;
        delete dataToSave.itens;
      }

      if (atividadeData.id) {
        // Update existing
        const { error } = await supabase
          .from('rdo_atividades')
          .update(dataToSave)
          .eq('id', atividadeData.id);

        if (error) throw error;
        toast.success('Atividade atualizada!');
      } else {
        // Create new
        const { error } = await supabase
          .from('rdo_atividades')
          .insert([dataToSave]);

        if (error) throw error;
        toast.success('Atividade criada!');
      }

      await fetchAtividades();
      setEditingAtividade(null);
    } catch (error) {
      console.error('Erro ao salvar atividade:', error);
      toast.error('Erro ao salvar atividade');
    }
  };

  const handleToggleComplete = async (id: string, concluido: boolean) => {
    try {
      const { error } = await supabase
        .from('rdo_atividades')
        .update({ concluido })
        .eq('id', id);

      if (error) throw error;

      setAtividades(prev =>
        prev.map(a => a.id === id ? { ...a, concluido } : a)
      );

      toast.success(concluido ? 'Atividade concluída!' : 'Atividade reaberta');
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleToggleSubItem = async (atividade: RdoAtividade, subItemId: string, novoMarcado: boolean) => {
    const subItens = getSubItens(atividade);
    const updatedSubItens = subItens.map(i => i.id === subItemId ? { ...i, marcado: novoMarcado } : i);
    const anyMarked = updatedSubItens.some(i => i.marcado);

    let obs = atividade.observacoes || '';
    obs = obs.replace(/__ITEMS__:[sS]*$/, '').trim();
    obs = (obs ? obs + '\n' : '') + `__ITEMS__:${JSON.stringify(updatedSubItens)}`;

    try {
      const { error } = await supabase
        .from('rdo_atividades')
        .update({ observacoes: obs, concluido: anyMarked })
        .eq('id', atividade.id);

      if (error) throw error;

      setAtividades(prev =>
        prev.map(a => a.id === atividade.id ? { ...a, observacoes: obs, itens: updatedSubItens, concluido: anyMarked } : a)
      );
      toast.success(novoMarcado ? 'Atividade marcada como feita!' : 'Atividade desmarcada');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleEdit = (atividade: RdoAtividade) => {
    setEditingAtividade(atividade);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta atividade?')) return;

    try {
      const { error } = await supabase
        .from('rdo_atividades')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAtividades(prev => prev.filter(a => a.id !== id));
      toast.success('Atividade excluída!');
    } catch (error) {
      console.error('Erro ao excluir atividade:', error);
      toast.error('Erro ao excluir atividade');
    }
  };

  const handleNewActivity = () => {
    setEditingAtividade(null);
    setIsModalOpen(true);
  };

  // Filtering
  const filteredAtividades = atividades.filter(a => {
    if (filter === 'pending') return !a.concluido;
    if (filter === 'completed') return a.concluido;
    return true;
  });

  // Preview for RDO integration
  const renderPreviewText = () => {
    if (filteredAtividades.length === 0) return 'Nenhuma atividade registrada.';

    return filteredAtividades.map(a => {
      const headerParts = [`🌱 *${a.titulo}*`];
      if (a.area) headerParts.push(`📍 Área: ${a.area}`);
      if (a.concluido) headerParts.push('[CONCLUÍDA]');

      const subItens = getSubItens(a);
      const marked = subItens.filter(i => i.marcado);

      const lines = [headerParts.join(' - ')];

      if (marked.length > 0) {
        marked.forEach(item => {
          if (item.tipo === 'medicao') {
            const loc = [item.faixa, item.berma].filter(Boolean).join(' - ');
            const locStr = loc ? ` (${loc})` : '';
            lines.push(`  • ${item.nome}: ${item.valor || '0'} ${item.unidade || 'm²'}${locStr}`);
          } else {
            const det = item.detalhe ? ` (${item.detalhe})` : '';
            lines.push(`  • ${item.nome}${det}`);
          }
        });
      } else {
        if (a.quantidade !== undefined && a.quantidade !== null) {
          lines.push(`  • Qtd: ${a.quantidade}`);
        }
        if (a.metragem !== undefined && a.metragem !== null) {
          lines.push(`  • Metragem: ${a.metragem} ${a.unidade || 'm²'}`);
        }
      }

      if (a.descricao) {
        lines.push(`  📝 Obs: ${a.descricao}`);
      }

      return lines.join('\n');
    }).join('\n\n');
  };

  const handleCopyPreview = () => {
    const text = renderPreviewText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Resumo de atividades copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const stats = {
    total: atividades.length,
    completed: atividades.filter(a => a.concluido).length,
    pending: atividades.filter(a => !a.concluido).length,
  };

  return (
    <div className="bg-[#faf9f6] dark:bg-[#18181b] border border-yellow-500/20 dark:border-white/10 rounded-3xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-950/60 flex items-center justify-center text-yellow-600 dark:text-yellow-400">
            <Icons.Activity size={22} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-lg">Atividades da Obra</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Data de Registro: {dataAtual}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              showPreview
                ? 'bg-yellow-100 dark:bg-yellow-950/40 border-yellow-400 text-yellow-800 dark:text-yellow-300'
                : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
            }`}
          >
            <Icons.Eye size={14} />
            <span>{showPreview ? 'Ocultar Resumo RDO' : 'Ver Resumo RDO'}</span>
          </button>

          <button
            onClick={handleNewActivity}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
          >
            <Plus size={16} />
            Nova Atividade
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white dark:bg-white/5 rounded-xl p-3 border border-gray-200 dark:border-white/10 text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
        </div>
        <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-3 border border-green-200 dark:border-green-900/40 text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed}</div>
          <div className="text-xs text-green-700 dark:text-green-400 font-semibold">Concluídas</div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-xl p-3 border border-yellow-200 dark:border-yellow-900/40 text-center">
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</div>
          <div className="text-xs text-yellow-700 dark:text-yellow-400 font-semibold">Pendentes</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            filter === 'all'
              ? 'bg-gray-900 dark:bg-white text-white dark:text-black font-bold'
              : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
          }`}
        >
          Todas ({stats.total})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            filter === 'pending'
              ? 'bg-yellow-500 text-white font-bold'
              : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
          }`}
        >
          Pendentes ({stats.pending})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            filter === 'completed'
              ? 'bg-green-600 text-white font-bold'
              : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
          }`}
        >
          Concluídas ({stats.completed})
        </button>
      </div>

      {/* Preview Section (se ativado) */}
      {showPreview && (
        <div className="mb-6 p-4 bg-white dark:bg-black/30 border border-yellow-300 dark:border-yellow-500/30 rounded-2xl animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-white/5">
            <span className="text-xs font-bold uppercase tracking-wider text-yellow-700 dark:text-yellow-400">
              📋 Resumo Gerado para o RDO ({dataAtual})
            </span>
            <button
              type="button"
              onClick={handleCopyPreview}
              className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white font-semibold cursor-pointer"
            >
              {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
              <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
            </button>
          </div>
          <pre className="font-mono text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
            {renderPreviewText()}
          </pre>
        </div>
      )}

      {/* Activities List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-gray-500">
          <RefreshCw className="animate-spin mr-2" size={18} />
          Carregando atividades...
        </div>
      ) : filteredAtividades.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
          <p className="text-gray-500 text-sm mb-3">Nenhuma atividade registrada para esta data.</p>
          <button
            onClick={handleNewActivity}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            Cadastrar Primeira Atividade
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAtividades.map(atividade => (
            <ActivityCard
              key={atividade.id}
              atividade={atividade}
              onToggleComplete={handleToggleComplete}
              onToggleSubItem={handleToggleSubItem}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <ActivityModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAtividade(null);
        }}
        onSave={handleSave}
        atividade={editingAtividade}
        dataAtual={dataAtual}
      />
    </div>
  );
}
