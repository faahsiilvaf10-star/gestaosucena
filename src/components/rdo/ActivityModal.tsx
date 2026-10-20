import { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { X, Save, Calendar, Hash, Ruler, MapPin, FileText, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { IconSelector } from './IconPicker';
import { RdoAtividade } from './ActivityCard';

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (atividade: Partial<RdoAtividade>) => void;
  atividade?: RdoAtividade | null;
  dataAtual: string;
}

// Unidades de medida comuns
const UNIDADES = [
  { value: 'm', label: 'Metros (m)' },
  { value: 'm²', label: 'Metros² (m²)' },
  { value: 'm³', label: 'Metros³ (m³)' },
  { value: 'km', label: 'Quilômetros (km)' },
  { value: 'un', label: 'Unidade (un)' },
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'L', label: 'Litro (L)' },
  { value: 'h', label: 'Hora (h)' },
  { value: 'dias', label: 'Dias' },
  { value: 'viagens', label: 'Viagens' },
  { value: 'jornadas', label: 'Jornadas' },
];

// Áreas disponíveis
const AREAS = [
  'Área Jardinagem',
  'Área Gabião',
  'Área Transporte',
  'Área Berma',
  'Área Faixa',
  'Área Geral',
  'Área Manutenção',
];

interface FormData {
  titulo: string;
  icon: string;
  area: string;
  quantidade: string;
  metragem: string;
  unidade: string;
  descricao: string;
  observacoes: string;
  concluido: boolean;
}

export function ActivityModal({ isOpen, onClose, onSave, atividade, dataAtual }: ActivityModalProps) {
  const [formData, setFormData] = useState<FormData>({
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

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens/closes or atividade changes
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
          observacoes: atividade.observacoes || '',
          concluido: atividade.concluido || false,
        });
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
      }
      setErrors({});
    }
  }, [isOpen, atividade]);

  const handleChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when field is edited
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.titulo.trim()) {
      newErrors.titulo = 'Título é obrigatório';
    }

    // Validação numérica
    if (formData.quantidade && isNaN(parseFloat(formData.quantidade))) {
      newErrors.quantidade = 'Quantidade deve ser um número';
    }
    if (formData.metragem && isNaN(parseFloat(formData.metragem))) {
      newErrors.metragem = 'Metragem deve ser um número';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const atividadeData: Partial<RdoAtividade> = {
      data: dataAtual,
      titulo: formData.titulo.trim(),
      icon: formData.icon,
      area: formData.area || undefined,
      quantidade: formData.quantidade ? parseFloat(formData.quantidade) : undefined,
      metragem: formData.metragem ? parseFloat(formData.metragem) : undefined,
      unidade: formData.unidade || undefined,
      descricao: formData.descricao.trim() || undefined,
      observacoes: formData.observacoes.trim() || undefined,
      concluido: formData.concluido,
    };

    // Se estiver editando, incluir o ID
    if (atividade?.id) {
      atividadeData.id = atividade.id;
    }

    onSave(atividadeData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="flex items-center gap-2">
              <Icons.Activity className="text-yellow-600" size={22} />
              {atividade ? 'Editar Atividade' : 'Nova Atividade'}
            </DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="space-y-5 p-1">

            {/* Título */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <FileText size={16} className="text-gray-400" />
                Título da Atividade *
              </label>
              <input
                type="text"
                value={formData.titulo}
                onChange={(e) => handleChange('titulo', e.target.value)}
                placeholder="Ex: Jardinagem, Gabião, Berma, Faixa..."
                className={`w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm outline-none transition-colors
                  ${errors.titulo ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-yellow-500'}`}
                autoFocus
              />
              {errors.titulo && (
                <p className="text-xs text-red-500">{errors.titulo}</p>
              )}
            </div>

            {/* Ícone */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Icons.Activity size={16} className="text-gray-400" />
                Ícone
              </label>
              <div className="flex items-center gap-3">
                <IconSelector
                  value={formData.icon}
                  onChange={(icon) => handleChange('icon', icon)}
                  size="lg"
                />
                <span className="text-sm text-gray-500">
                  Toque para selecionar um ícone
                </span>
              </div>
            </div>

            {/* Área */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <MapPin size={16} className="text-gray-400" />
                Área
              </label>
              <select
                value={formData.area}
                onChange={(e) => handleChange('area', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-yellow-500 transition-colors"
              >
                <option value="">Selecione a área (opcional)</option>
                {AREAS.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>

            {/* Quantidade e Metragem */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Hash size={16} className="text-gray-400" />
                  Quantidade
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.quantidade}
                  onChange={(e) => handleChange('quantidade', e.target.value)}
                  placeholder="Ex: 5"
                  className={`w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm outline-none transition-colors
                    ${errors.quantidade ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-yellow-500'}`}
                />
                {errors.quantidade && (
                  <p className="text-xs text-red-500">{errors.quantidade}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Ruler size={16} className="text-gray-400" />
                  Metragem
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.metragem}
                  onChange={(e) => handleChange('metragem', e.target.value)}
                  placeholder="Ex: 100"
                  className={`w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm outline-none transition-colors
                    ${errors.metragem ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-yellow-500'}`}
                />
                {errors.metragem && (
                  <p className="text-xs text-red-500">{errors.metragem}</p>
                )}
              </div>
            </div>

            {/* Unidade de Medida */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Ruler size={16} className="text-gray-400" />
                Unidade de Medida
              </label>
              <select
                value={formData.unidade}
                onChange={(e) => handleChange('unidade', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-yellow-500 transition-colors"
              >
                {UNIDADES.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <FileText size={16} className="text-gray-400" />
                Descrição
              </label>
              <textarea
                value={formData.descricao}
                onChange={(e) => handleChange('descricao', e.target.value)}
                placeholder="Descreva a atividade..."
                rows={3}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-yellow-500 transition-colors resize-none"
              />
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <MessageSquare size={16} className="text-gray-400" />
                Observações
              </label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => handleChange('observacoes', e.target.value)}
                placeholder="Observações adicionais..."
                rows={2}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-yellow-500 transition-colors resize-none"
              />
            </div>

            {/* Checkbox de conclusão */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <input
                type="checkbox"
                id="concluido"
                checked={formData.concluido}
                onChange={(e) => handleChange('concluido', e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <label htmlFor="concluido" className="text-sm font-medium text-gray-700 cursor-pointer">
                Marcar como concluída
              </label>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 mt-6 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-medium text-white bg-yellow-500 rounded-xl hover:bg-yellow-600 transition-colors flex items-center gap-2"
            >
              <Save size={16} />
              {atividade ? 'Salvar Alterações' : 'Criar Atividade'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
