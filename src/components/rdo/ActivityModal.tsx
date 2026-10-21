import { useState, useEffect, useMemo } from 'react';
import * as Icons from 'lucide-react';
import {
  X,
  Save,
  Plus,
  Trash2,
  Copy,
  Check,
  FileText,
  MapPin,
  Ruler,
  Hash,
  MessageSquare,
  Sparkles,
  Layers,
  CheckSquare,
  Square
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { IconSelector } from './IconPicker';
import { RdoAtividade, SubAtividadeItem, getSubItens } from './ActivityCard';

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (atividade: Partial<RdoAtividade>) => void;
  atividade?: RdoAtividade | null;
  dataAtual: string;
}

// Unidades de medida comuns
const UNIDADES = [
  { value: 'm²', label: 'Metros² (m²)' },
  { value: 'm', label: 'Metros (m)' },
  { value: 'm³', label: 'Metros³ (m³)' },
  { value: 'un', label: 'Unidade (un)' },
  { value: 'km', label: 'Quilômetros (km)' },
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'L', label: 'Litro (L)' },
  { value: 'h', label: 'Hora (h)' },
  { value: 'dias', label: 'Dias' },
  { value: 'viagens', label: 'Viagens' },
];

// Sugestões de áreas para preenchimento com 1 clique
const SUGESTOES_AREAS = [
  'Área Jardinagem',
  'Área Gabião',
  'Área Berma',
  'Área Faixa',
  'Área Transporte',
  'Área Geral',
  'Área Manutenção',
  'Talude Norte',
  'Canteiro Central',
  'Drenagem',
];

// Faixas e Bermas (idêntico à Jardinagem)
const FAIXAS = ['Faixa 1', 'Faixa 2', 'Faixa 3', 'Faixa 4', 'Faixa 5'];

const BERMAS = [
  ...Array.from({ length: 33 }, (_, i) => {
    const num = i + 26;
    return num % 2 === 0 ? `Berma ${num}` : `Elevado ${num}`;
  }),
  'MIRANTE',
  'GABIÃO 1',
  'GABIÃO 2',
  'GABIÃO 3',
];

// Modelos rápidos de sub-atividades
const TEMPLATES_SUBATIVIDADES = [
  { nome: 'Limpeza', tipo: 'checkbox' as const },
  { nome: 'Roçagem', tipo: 'medicao' as const, unidade: 'm²' },
  { nome: 'Irrigação com Pipas', tipo: 'checkbox' as const },
  { nome: 'Apoio com Pipa', tipo: 'checkbox' as const },
  { nome: 'Plantio', tipo: 'medicao' as const, unidade: 'un' },
  { nome: 'Podagem', tipo: 'medicao' as const, unidade: 'un' },
  { nome: 'Manutenção', tipo: 'checkbox' as const },
  { nome: 'Escavação', tipo: 'medicao' as const, unidade: 'm³' },
];

export function ActivityModal({ isOpen, onClose, onSave, atividade, dataAtual }: ActivityModalProps) {
  const [formData, setFormData] = useState({
    titulo: '',
    icon: 'Activity',
    area: '',
    quantidade: '',
    metragem: '',
    unidade: 'm²',
    descricao: '',
    observacoes: '',
    concluido: false,
  });

  const [subItens, setSubItens] = useState<SubAtividadeItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset do formulário ao abrir/fechar ou trocar de atividade
  useEffect(() => {
    if (isOpen) {
      if (atividade) {
        setFormData({
          titulo: atividade.titulo || '',
          icon: atividade.icon || 'Activity',
          area: atividade.area || '',
          quantidade: atividade.quantidade?.toString() || '',
          metragem: atividade.metragem?.toString() || '',
          unidade: atividade.unidade || 'm²',
          descricao: atividade.descricao || '',
          observacoes:
            atividade.observacoes && !atividade.observacoes.startsWith('__ITEMS__:')
              ? atividade.observacoes
              : '',
          concluido: atividade.concluido || false,
        });

        // Carregar sub-atividades salvas
        const savedSub = getSubItens(atividade);
        setSubItens(savedSub);
      } else {
        setFormData({
          titulo: '',
          icon: 'Activity',
          area: '',
          quantidade: '',
          metragem: '',
          unidade: 'm²',
          descricao: '',
          observacoes: '',
          concluido: false,
        });
        // Por padrão já inicia com o item sugerido "Limpeza" com caixa de marcar
        setSubItens([
          {
            id: 'item-1',
            nome: 'Limpeza',
            tipo: 'checkbox',
            marcado: true,
          },
        ]);
      }
      setErrors({});
      setCopied(false);
    }
  }, [isOpen, atividade]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Adicionar nova sub-atividade
  const handleAddSubItem = (template?: { nome: string; tipo: 'checkbox' | 'medicao'; unidade?: string }) => {
    const newItem: SubAtividadeItem = {
      id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      nome: template?.nome || '',
      tipo: template?.tipo || 'checkbox',
      marcado: true,
      unidade: template?.unidade || 'm²',
      valor: '',
      faixa: '',
      berma: '',
      detalhe: '',
    };
    setSubItens(prev => [...prev, newItem]);
  };

  // Atualizar campo de uma sub-atividade
  const handleUpdateSubItem = (id: string, updates: Partial<SubAtividadeItem>) => {
    setSubItens(prev => prev.map(item => (item.id === id ? { ...item, ...updates } : item)));
  };

  // Remover sub-atividade
  const handleRemoveSubItem = (id: string) => {
    setSubItens(prev => prev.filter(item => item.id !== id));
  };

  // Texto formatado para o Resumo / Pré-visualização do RDO
  const previewText = useMemo(() => {
    const lines: string[] = [];

    // Título e Área
    const tituloFormatado = formData.titulo.trim() || 'Nova Atividade';
    const areaFormatada = formData.area.trim();

    if (areaFormatada) {
      lines.push(`📍 *ÁREA: ${areaFormatada.toUpperCase()}*`);
    }
    lines.push(`🌱 *${tituloFormatado} - Atividades Realizadas:*`);

    // Itens marcados
    const markedItems = subItens.filter(i => i.marcado && i.nome.trim());

    if (markedItems.length === 0 && !formData.metragem && !formData.quantidade && !formData.descricao) {
      return '';
    }

    if (subItens.length === 0 && formData.concluido) {
      lines.push(`• ${tituloFormatado}`);
    }

    markedItems.forEach(item => {
      if (item.tipo === 'checkbox') {
        const detalhe = item.detalhe?.trim() ? ` (${item.detalhe.trim()})` : '';
        lines.push(`• ${item.nome.trim()}${detalhe}`);
      } else {
        const val = item.valor?.trim() || '0';
        const un = item.unidade || 'm²';
        const locParts = [item.faixa, item.berma].filter(Boolean);
        const locStr = locParts.length > 0 ? ` (${locParts.join(' - ')})` : '';
        lines.push(`• ${item.nome.trim()}: ${val} ${un}${locStr}`);
      }
    });

    // Medições gerais se preenchidas
    if (formData.metragem) {
      lines.push(`• Metragem Total: ${formData.metragem} ${formData.unidade}`);
    }
    if (formData.quantidade) {
      lines.push(`• Quantidade Total: ${formData.quantidade}`);
    }

    // Descrição ou observações
    if (formData.descricao.trim()) {
      lines.push(`\n📝 Descrição: ${formData.descricao.trim()}`);
    }
    if (formData.observacoes.trim()) {
      lines.push(`⚠️ Obs: ${formData.observacoes.trim()}`);
    }

    return lines.join('\n');
  }, [formData, subItens]);

  // Copiar resumo formatado
  const handleCopyPreview = () => {
    if (!previewText) return;
    navigator.clipboard.writeText(previewText);
    setCopied(true);
    toast.success('Resumo copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 2000);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.titulo.trim()) {
      newErrors.titulo = 'Título da atividade é obrigatório';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Filtra itens vazios
    const validSubItens = subItens.filter(i => i.nome.trim());
    const anySubMarked = validSubItens.some(i => i.marcado);

    const atividadeData: Partial<RdoAtividade> = {
      data: dataAtual,
      titulo: formData.titulo.trim(),
      icon: formData.icon,
      area: formData.area.trim() || undefined,
      quantidade: formData.quantidade ? parseFloat(formData.quantidade) : undefined,
      metragem: formData.metragem ? parseFloat(formData.metragem) : undefined,
      unidade: formData.unidade || undefined,
      descricao: formData.descricao.trim() || undefined,
      observacoes: formData.observacoes.trim() || undefined,
      itens: validSubItens,
      concluido: validSubItens.length > 0 ? anySubMarked : formData.concluido,
    };

    if (atividade?.id) {
      atividadeData.id = atividade.id;
    }

    onSave(atividadeData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-[#18181b] border-gray-200 dark:border-white/10 shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-5 border-b border-gray-100 dark:border-white/10 bg-gray-50/70 dark:bg-white/5 flex-shrink-0">
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-bold text-gray-900 dark:text-white">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/20 text-yellow-600 flex items-center justify-center">
                <Icons.Activity size={20} />
              </div>
              <span>{atividade ? 'Editar Atividade & Área' : 'Nova Atividade da Obra'}</span>
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Form Body - 2 Columns on desktop */}
        <form id="activity-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Coluna Esquerda: Formulário de Configuração */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              {/* Título da Atividade */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  <FileText size={15} className="text-gray-400" />
                  Título da Atividade *
                </label>
                <input
                  type="text"
                  value={formData.titulo}
                  onChange={e => handleChange('titulo', e.target.value)}
                  placeholder="Ex: Jardinagem, Limpeza e Conservação, Drenagem..."
                  className={`w-full px-4 py-2.5 bg-gray-50 dark:bg-white/5 border rounded-xl text-sm outline-none transition-colors ${
                    errors.titulo
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-gray-200 dark:border-white/10 focus:border-yellow-500'
                  }`}
                  autoFocus
                />
                {errors.titulo && <p className="text-xs text-red-500">{errors.titulo}</p>}

                {/* Opção de selecionar como feita no dia (quando não há sub-atividades adicionadas) */}
                {subItens.length === 0 && (
                  <label
                    className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer select-none transition-all mt-2 ${
                      formData.concluido
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-bold'
                        : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.concluido}
                      onChange={e => handleChange('concluido', e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                    />
                    <span className="text-xs">
                      {formData.concluido
                        ? '✓ Atividade feita no dia (selecionada para o RDO de hoje)'
                        : 'Atividade não realizada hoje'}
                    </span>
                  </label>
                )}
              </div>

              {/* Ícone */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  <Icons.Activity size={15} className="text-gray-400" />
                  Ícone Representativo
                </label>
                <div className="flex items-center gap-3">
                  <IconSelector value={formData.icon} onChange={icon => handleChange('icon', icon)} size="md" />
                  <span className="text-xs text-gray-500">Toque no ícone para escolher um símbolo da obra</span>
                </div>
              </div>

              {/* Área (Digitação Manual com Sugestões Rápidas) */}
              <div className="space-y-1.5 p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl">
                <label className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                  <span className="flex items-center gap-2">
                    <MapPin size={15} className="text-amber-600 dark:text-amber-400" />
                    Área da Obra (Digitação Manual)
                  </span>
                  <span className="text-[10px] lowercase text-amber-700 dark:text-amber-400">digite livremente</span>
                </label>

                <input
                  type="text"
                  value={formData.area}
                  onChange={e => handleChange('area', e.target.value)}
                  placeholder="Ex: Área Berma, Talude Norte, Gabião 1, Mirante, KM 14..."
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#18181b] border border-amber-300/80 dark:border-amber-800 rounded-xl text-sm outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors shadow-2xs font-medium"
                />

                {/* Sugestões rápidas de 1 clique */}
                <div className="pt-2 flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-amber-800/80 dark:text-amber-400/80">
                    Ou selecione uma sugestão rápida:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGESTOES_AREAS.map(sugestao => (
                      <button
                        key={sugestao}
                        type="button"
                        onClick={() => handleChange('area', sugestao)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          formData.area === sugestao
                            ? 'bg-amber-500 text-white font-bold border-amber-500 shadow-2xs'
                            : 'bg-white dark:bg-white/5 border-amber-200 dark:border-white/10 text-amber-900 dark:text-amber-200 hover:bg-amber-100/70'
                        }`}
                      >
                        {sugestao}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sub-atividades da Área com Botão + */}
              <div className="p-4 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-2xl flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-yellow-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                      Atividades dentro desta Área ({subItens.length})
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddSubItem()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                    title="Adicionar Atividade dentro da Área"
                  >
                    <Plus size={15} />
                    <span>Adicionar Atividade</span>
                  </button>
                </div>

                {/* Atalhos Rápidos */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
                  <span className="text-[10px] text-gray-500 font-semibold shrink-0">Modelos rápidos:</span>
                  {TEMPLATES_SUBATIVIDADES.map(tpl => (
                    <button
                      key={tpl.nome}
                      type="button"
                      onClick={() => handleAddSubItem(tpl)}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-yellow-400 hover:text-yellow-600 transition-colors whitespace-nowrap cursor-pointer shrink-0"
                    >
                      + {tpl.nome}
                    </button>
                  ))}
                </div>

                {/* Lista de Sub-atividades configuradas */}
                <div className="flex flex-col gap-2.5 mt-1">
                  {subItens.length === 0 ? (
                    <div className="p-4 text-center border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-400">
                      Nenhuma atividade adicionada nesta área ainda. Clique em "+ Adicionar Atividade" acima.
                    </div>
                  ) : (
                    subItens.map((item, idx) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${
                          item.marcado
                            ? 'bg-white dark:bg-[#202023] border-emerald-300 dark:border-emerald-600/50 shadow-xs'
                            : 'bg-gray-100/60 dark:bg-white/5 border-gray-200 dark:border-white/10 opacity-70'
                        }`}
                      >
                        {/* Linha superior: Selecionar feita no dia ou não + Nome da atividade + Alternar Medição + Excluir */}
                        <div className="flex items-center gap-2 sm:gap-2.5">
                          {/* Opção de ser selecionada como feita no dia ou não */}
                          <label
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer select-none transition-all shrink-0 ${
                              item.marcado
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-bold'
                                : 'bg-gray-100 dark:bg-white/5 border-gray-300 dark:border-gray-700 text-gray-500 font-medium'
                            }`}
                            title={item.marcado ? 'Atividade feita no dia (vai para o RDO)' : 'Atividade NÃO realizada no dia'}
                          >
                            <input
                              type="checkbox"
                              checked={item.marcado}
                              onChange={e => handleUpdateSubItem(item.id, { marcado: e.target.checked })}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                            />
                            <span className="text-xs">
                              {item.marcado ? 'Feita no dia' : 'Não feita'}
                            </span>
                          </label>

                          {/* Só adicionar o nome dela */}
                          <input
                            type="text"
                            value={item.nome}
                            onChange={e => handleUpdateSubItem(item.id, { nome: e.target.value })}
                            placeholder="Nome da atividade (ex: Limpeza, Roçagem, Irrigação...)"
                            className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold outline-none focus:border-yellow-500"
                            autoFocus={!item.nome}
                          />

                          {/* Alternador de medição (igual Jardinagem) */}
                          {item.tipo === 'checkbox' ? (
                            <button
                              type="button"
                              onClick={() => handleUpdateSubItem(item.id, { tipo: 'medicao' })}
                              className="text-[11px] px-2.5 py-1 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-white/5 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 transition-colors whitespace-nowrap cursor-pointer shrink-0"
                              title="Adicionar medição (m², faixa, berma)"
                            >
                              + Medição
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleUpdateSubItem(item.id, { tipo: 'checkbox' })}
                              className="text-[11px] px-2.5 py-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900/50 transition-colors whitespace-nowrap cursor-pointer shrink-0"
                              title="Voltar para apenas marcação simples"
                            >
                              ✕ Sem medição
                            </button>
                          )}

                          {/* Botão de excluir item */}
                          <button
                            type="button"
                            onClick={() => handleRemoveSubItem(item.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Remover esta atividade"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        {/* Se for com medição (conforme Jardinagem: Faixa, Berma, Valor) */}
                        {item.tipo === 'medicao' && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-100 dark:border-white/5 animate-in fade-in duration-200">
                            <input
                              type="text"
                              value={item.valor || ''}
                              onChange={e => handleUpdateSubItem(item.id, { valor: e.target.value })}
                              placeholder="Valor (ex: 150)"
                              className="px-2.5 py-1 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-md text-xs font-mono outline-none"
                            />
                            <select
                              value={item.unidade || 'm²'}
                              onChange={e => handleUpdateSubItem(item.id, { unidade: e.target.value })}
                              className="px-2 py-1 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-md text-xs outline-none cursor-pointer"
                            >
                              {UNIDADES.map(u => (
                                <option key={u.value} value={u.value}>
                                  {u.label}
                                </option>
                              ))}
                            </select>
                            <select
                              value={item.faixa || ''}
                              onChange={e => handleUpdateSubItem(item.id, { faixa: e.target.value })}
                              className="px-2 py-1 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-md text-xs outline-none cursor-pointer"
                            >
                              <option value="">Faixa (opc)</option>
                              {FAIXAS.map(f => (
                                <option key={f} value={f}>
                                  {f}
                                </option>
                              ))}
                            </select>
                            <select
                              value={item.berma || ''}
                              onChange={e => handleUpdateSubItem(item.id, { berma: e.target.value })}
                              className="px-2 py-1 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-md text-xs outline-none cursor-pointer"
                            >
                              <option value="">Berma/Elevado</option>
                              {BERMAS.map(b => (
                                <option key={b} value={b}>
                                  {b}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Detalhes adicionais e observações (opcional / colapsável) */}
              <details className="p-3.5 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-2xl group text-xs">
                <summary className="font-bold text-gray-600 dark:text-gray-400 cursor-pointer select-none hover:text-gray-900 dark:hover:text-white transition-colors flex items-center justify-between">
                  <span>+ Mais Detalhes (Descrição e Observações)</span>
                  <span className="text-[10px] text-gray-400 font-normal">opcional</span>
                </summary>
                <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-gray-200 dark:border-white/10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">
                        Descrição Adicional
                      </label>
                      <textarea
                        rows={2}
                        value={formData.descricao}
                        onChange={e => handleChange('descricao', e.target.value)}
                        placeholder="Detalhes adicionais..."
                        className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-yellow-500 resize-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">
                        Observações / Dificuldades
                      </label>
                      <textarea
                        rows={2}
                        value={formData.observacoes}
                        onChange={e => handleChange('observacoes', e.target.value)}
                        placeholder="Observações da equipe..."
                        className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-yellow-500 resize-none"
                      />
                    </div>
                  </div>
                </div>
              </details>
            </div>

            {/* Coluna Direita: Pré-visualização do Resumo (conforme Jardinagem) */}
            <div className="lg:col-span-5 flex flex-col gap-4 sticky top-0">
              <div className="bg-[#faf9f6] dark:bg-[#1a1a1c] border border-yellow-500/30 rounded-2xl p-5 flex flex-col gap-3 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-yellow-500/20">
                  <div className="flex items-center gap-2">
                    <FileText className="text-yellow-600 dark:text-yellow-400" size={18} />
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white">Resumo para RDO</h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700/60">
                    Prévia em Tempo Real
                  </span>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400">
                  As atividades marcadas com <span className="font-semibold text-yellow-600">caixa de seleção</span>{' '}
                  entram automaticamente no relatório diário.
                </p>

                {/* Caixa do texto da prévia */}
                <div className="bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-4 font-mono text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap min-h-[220px] max-h-[360px] overflow-y-auto custom-scrollbar select-text leading-relaxed shadow-2xs">
                  {previewText ? (
                    previewText
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500 py-8 italic font-sans text-xs">
                      <span>Nenhuma atividade marcada ainda.</span>
                      <span className="mt-1 text-[11px]">
                        Digite o nome da área e marque as caixas das atividades para gerar o resumo.
                      </span>
                    </div>
                  )}
                </div>

                {/* Botão Copiar Resumo */}
                <button
                  type="button"
                  onClick={handleCopyPreview}
                  disabled={!previewText}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-all shadow-2xs disabled:opacity-40 cursor-pointer"
                >
                  {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                  <span>{copied ? 'Copiado!' : 'Copiar Resumo para o RDO'}</span>
                </button>

                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 p-3 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                  <Sparkles size={16} className="shrink-0 mt-0.5 text-amber-600" />
                  <p>
                    Os dados configurados serão integrados à seção de <strong>Outras Atividades</strong> do RDO da data{' '}
                    <strong>{dataAtual}</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Footer com Salvar e Cancelar */}
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
            form="activity-form"
            className="px-6 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Save size={16} />
            <span>{atividade ? 'Salvar Alterações' : 'Salvar Atividade da Área'}</span>
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
