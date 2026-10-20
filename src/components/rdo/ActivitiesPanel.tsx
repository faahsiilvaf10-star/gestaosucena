import { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { Plus, RefreshCw, CheckCircle2, Circle, Pencil, Trash2, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { ActivityCard, RdoAtividade } from './ActivityCard';
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
      const dataToSave = {
        ...atividadeData,
        obra_id: environment,
        data: dataAtual,
      };

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
      const parts = [`${a.titulo}`];

      if (a.quantidade !== undefined && a.quantidade !== null) {
        parts.push(`Qtd: ${a.quantidade}`);
      }
      if (a.metragem !== undefined && a.metragem !== null) {
        parts.push(`${a.metragem} ${a.unidade || 'm²'}`);
      }
      if (a.area) {
        parts.push(`(${a.area})`);
      }
      if (a.concluido) {
        parts.push('[OK]');
      }

      return parts.join(' | ');
    }).join('\n');
  };

  const stats = {
    total: atividades.length,
    completed: atividades.filter(a => a.concluido).length,
    pending: atividades.filter(a => !a.concluido).length,
  };

  return (
    <div className="bg-[#faf9f6] border border-yellow-500/20 rounded-3xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
            <Icons.Activity className="text-yellow-600" size={22} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Atividades do RDO</h3>
            <p className="text-xs text-gray-500">{dataAtual}</p>
          </div>
        </div>

        <button
          onClick={handleNewActivity}
          className="flex items-center gap-2 px-4 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus size={18} />
          Nova Atividade
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl p-3 border border-gray-200 text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
        <div className="bg-green-50 rounded-xl p-3 border border-green-200 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-xs text-green-600">Concluídas</div>
        </div>
        <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-200 text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-xs text-yellow-600">Pendentes</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
            ${filter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Todas ({stats.total})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
            ${filter === 'pending' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Pendentes ({stats.pending})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
            ${filter === 'completed' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Concluídas ({stats.completed})
        </button>

        <div className="flex-1" />

        <button
          onClick={() => setShowPreview(!showPreview)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5
            ${showPreview ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          <Icons.Eye size={14} />
          Preview
        </button>

        <button
          onClick={fetchAtividades}
          className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          title="Atualizar"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Preview Panel */}
      {showPreview && (
        <div className="mb-4 p-4 bg-white rounded-xl border border-blue-200">
          <div className="flex items-center gap-2 mb-3">
            <Icons.Eye className="text-blue-500" size={18} />
            <h4 className="font-semibold text-blue-700">Prévia para RDO</h4>
          </div>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
            {renderPreviewText()}
          </pre>
          {onIntegrateWithRDO && (
            <button
              onClick={() => onIntegrateWithRDO(filteredAtividades)}
              className="mt-3 w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Integrar ao RDO Principal
            </button>
          )}
        </div>
      )}

      {/* Activities List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="animate-spin text-gray-400" size={32} />
        </div>
      ) : filteredAtividades.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
          <Icons.Activity className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-500 font-medium">
            {filter === 'all' ? 'Nenhuma atividade ainda' : `Nenhuma atividade ${filter === 'pending' ? 'pendente' : 'concluída'}`}
          </p>
          <button
            onClick={handleNewActivity}
            className="mt-3 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Criar primeira atividade
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAtividades.map(atividade => (
            <ActivityCard
              key={atividade.id}
              atividade={atividade}
              onToggleComplete={handleToggleComplete}
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
