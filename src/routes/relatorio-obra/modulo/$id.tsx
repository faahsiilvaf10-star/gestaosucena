import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useMemo, useRef } from 'react';
import * as Icons from 'lucide-react';
import {
  Calendar as CalendarIcon,
  Save,
  Copy,
  Phone,
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  FileText,
  MapPin,
  Sparkles,
  Settings,
  PenLine,
  Lock,
  Unlock,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { isAdmin } from '@/components/ui/VerifiedBadge';
import {
  CustomRdoModulo,
  CustomCardModel,
  CustomCardRowData,
  CustomRdoDailyData,
} from '@/types/rdoCustomModule';
import { CreateModuleModal } from '@/components/rdo/CreateModuleModal';

export const Route = createFileRoute('/relatorio-obra/modulo/$id')({
  component: CustomModuloAtividadePage,
});

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

function maskNumber(val: string, isFloat = false): string {
  if (!val) return '';
  // Limpar caracteres não numéricos exceto vírgula/ponto
  if (isFloat) {
    const clean = val.replace(/[^\d,\.]/g, '').replace('.', ',');
    const parts = clean.split(',');
    if (parts.length > 2) return parts[0] + ',' + parts.slice(1).join('');
    return clean;
  }
  return val.replace(/\D/g, '');
}

export function CustomModuloAtividadePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const [modulo, setModulo] = useState<CustomRdoModulo | null>(null);
  const [loadingModulo, setLoadingModulo] = useState(true);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

  // Estado dos cards da atividade no dia
  const [cardRows, setCardRows] = useState<Record<string, CustomCardRowData[]>>({});
  const [cardCheckboxes, setCardCheckboxes] = useState<Record<string, boolean>>({});
  const [outrasFaixa, setOutrasFaixa] = useState('');
  const [outrasBerma, setOutrasBerma] = useState('');
  const [outrasDesc, setOutrasDesc] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);
  const [copied, setCopied] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

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

  // Carregar definição do módulo
  const fetchModulo = async () => {
    setLoadingModulo(true);
    try {
      let found: CustomRdoModulo | null = null;

      // 1. Banco remoto
      const { data } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'rdo_modulos_customizados')
        .single();

      if (data && Array.isArray(data.value)) {
        found = data.value.find((m: CustomRdoModulo) => m.id === id) || null;
      }

      // 2. Fallback localStorage
      if (!found) {
        const local = localStorage.getItem('rdo_modulos_customizados');
        if (local) {
          try {
            const list: CustomRdoModulo[] = JSON.parse(local);
            found = list.find(m => m.id === id) || null;
          } catch (e) {}
        }
      }

      if (found) {
        // Normalizar caso seja módulo antigo sem 'models'
        if (!found.models || found.models.length === 0) {
          const convertedModels: CustomCardModel[] = (found.defaultItens || []).map(it => ({
            id: it.id,
            tipo: it.tipo === 'medicao' ? 'medicao' : 'checkbox',
            titulo: it.nome,
            unidade: it.unidade || (it.tipo === 'medicao' ? 'm²' : undefined),
          }));

          found.models = convertedModels.length > 0 ? convertedModels : [
            { id: 'm-1', tipo: 'medicao', titulo: 'PRODUÇÃO DIÁRIA (M²)', unidade: 'm²' },
            { id: 'm-2', tipo: 'medicao', titulo: 'LIMPEZA (M²)', unidade: 'm²' },
          ];
          if (found.temOutrasAtividades === undefined) {
            found.temOutrasAtividades = true;
          }
        }
        setModulo(found);
      } else {
        toast.error('Módulo de atividade não encontrado');
      }
    } catch (err) {
      console.error('Erro ao buscar módulo:', err);
    } finally {
      setLoadingModulo(false);
    }
  };

  useEffect(() => {
    fetchModulo();
  }, [id]);

  // Carregar dados salvos para a data selecionada
  const loadDateData = async (dateStr: string) => {
    const storageKey = `custom_rdo_${id}_${dateStr}`;
    let dailyData: CustomRdoDailyData | null = null;

    try {
      const { data } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', storageKey)
        .single();

      if (data && data.value) {
        dailyData = data.value as CustomRdoDailyData;
        localStorage.setItem(storageKey, JSON.stringify(data.value));
      }
    } catch (e) {}

    if (!dailyData) {
      const local = localStorage.getItem(storageKey);
      if (local) {
        try {
          dailyData = JSON.parse(local);
        } catch (e) {}
      }
    }

    if (dailyData) {
      setCardRows(dailyData.cardRows || {});
      setCardCheckboxes(dailyData.cardCheckboxes || {});
      setOutrasFaixa(dailyData.outrasAtividades?.faixa || '');
      setOutrasBerma(dailyData.outrasAtividades?.berma || '');
      setOutrasDesc(dailyData.outrasAtividades?.descricao || '');
      setObservacoes(dailyData.observacoes || '');
      setIsLocked(dailyData.isLocked !== false);
    } else {
      // Inicializar linhas padrão (1 linha vazia por card para preenchimento ágil)
      const initialRows: Record<string, CustomCardRowData[]> = {};
      const initialChecks: Record<string, boolean> = {};

      if (modulo?.models) {
        modulo.models.forEach(m => {
          if (m.tipo === 'checkbox') {
            initialChecks[m.id] = false;
          } else {
            initialRows[m.id] = [{ value: '', faixa: '', berma: '', opcao: m.opcoes?.[0] || '' }];
          }
        });
      }

      setCardRows(initialRows);
      setCardCheckboxes(initialChecks);
      setOutrasFaixa('');
      setOutrasBerma('');
      setOutrasDesc('');
      setObservacoes('');
      setIsLocked(false);
    }
  };

  useEffect(() => {
    if (modulo) {
      loadDateData(selectedDate);
    }
  }, [modulo, selectedDate]);

  // Manipulação de Linhas de Medição / Seleção
  const handleAddRow = (modelId: string, defaultOpcao?: string) => {
    setCardRows(prev => {
      const current = prev[modelId] || [];
      return {
        ...prev,
        [modelId]: [...current, { value: '', faixa: '', berma: '', opcao: defaultOpcao || '' }],
      };
    });
  };

  const handleUpdateRow = (modelId: string, rowIndex: number, field: keyof CustomCardRowData, val: string) => {
    setCardRows(prev => {
      const current = prev[modelId] ? [...prev[modelId]] : [{ value: '', faixa: '', berma: '' }];
      if (!current[rowIndex]) {
        current[rowIndex] = { value: '', faixa: '', berma: '' };
      }
      current[rowIndex] = { ...current[rowIndex], [field]: val };
      return {
        ...prev,
        [modelId]: current,
      };
    });
  };

  const handleRemoveRow = (modelId: string, rowIndex: number) => {
    setCardRows(prev => {
      const current = prev[modelId] || [];
      const updated = current.filter((_, idx) => idx !== rowIndex);
      return {
        ...prev,
        [modelId]: updated.length > 0 ? updated : [{ value: '', faixa: '', berma: '' }],
      };
    });
  };

  const handleToggleCheckbox = (modelId: string) => {
    setCardCheckboxes(prev => ({
      ...prev,
      [modelId]: !prev[modelId],
    }));
  };

  // Texto formatado para o RDO (idêntico a Jardinagem)
  const renderedSummaryText = useMemo(() => {
    if (!modulo) return '';

    const lines: string[] = [];

    // Percorrer cada card/modelo configurado
    (modulo.models || []).forEach(m => {
      if (m.tipo === 'checkbox') {
        if (cardCheckboxes[m.id]) {
          lines.push(`* ${m.titulo}`);
        }
      } else if (m.tipo === 'selecao') {
        const rows = cardRows[m.id] || [];
        const valid = rows.filter(r => r.value && r.value !== '0' && r.value !== '0,00');
        valid.forEach(r => {
          const locParts = [];
          if (r.faixa) locParts.push(r.faixa);
          if (r.berma) locParts.push(r.berma);
          const locStr = locParts.length > 0 ? ` - ${locParts.join(' ')}` : '';
          const opStr = r.opcao ? ` (${r.opcao})` : '';
          const cleanVal = String(r.value).replace(/,00$/, '');
          lines.push(`* ${m.titulo}${opStr}: ${cleanVal} ${m.unidade || 'unid'}${locStr}`);
        });
      } else {
        // Medição simples
        const rows = cardRows[m.id] || [];
        const valid = rows.filter(r => r.value && r.value !== '0' && r.value !== '0,00');
        valid.forEach(r => {
          const locParts = [];
          if (r.faixa) locParts.push(r.faixa);
          if (r.berma) locParts.push(r.berma);
          const locStr = locParts.length > 0 ? ` - ${locParts.join(' ')}` : '';
          const cleanVal = String(r.value).replace(/,00$/, '');
          lines.push(`* ${m.titulo}: ${cleanVal} ${m.unidade || 'm²'}${locStr}`);
        });
      }
    });

    // Outras Atividades manuais
    if (outrasDesc.trim()) {
      const locParts = [];
      if (outrasFaixa) locParts.push(outrasFaixa);
      if (outrasBerma) locParts.push(outrasBerma);
      const locStr = locParts.length > 0 ? ` - ${locParts.join(' ')}` : '';
      lines.push(`* ${outrasDesc.trim()}${locStr}`);
    }

    if (observacoes.trim()) {
      lines.push('');
      lines.push(`📝 Observações: ${observacoes.trim()}`);
    }

    if (lines.length === 0) {
      return `Nenhuma atividade preenchida para ${modulo.name}.`;
    }

    return lines.join('\n');
  }, [modulo, cardRows, cardCheckboxes, outrasFaixa, outrasBerma, outrasDesc, observacoes]);

  // Salvar registro diário
  const handleSave = async () => {
    if (!modulo) return;

    const storageKey = `custom_rdo_${id}_${selectedDate}`;
    const dataToSave: CustomRdoDailyData = {
      moduloId: id,
      moduloName: modulo.name,
      data: selectedDate,
      cardRows,
      cardCheckboxes,
      outrasAtividades: {
        faixa: outrasFaixa,
        berma: outrasBerma,
        descricao: outrasDesc,
      },
      renderedSummary: renderedSummaryText,
      observacoes,
      isLocked: true,
      updated_at: new Date().toISOString(),
    };

    localStorage.setItem(storageKey, JSON.stringify(dataToSave));
    setIsLocked(true);
    toast.success(`${modulo.name} salva com sucesso para ${selectedDate}!`);

    try {
      await supabase.from('global_settings').upsert({
        key: storageKey,
        value: dataToSave,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

      const { logActivity } = await import('@/lib/logActivity');
      await logActivity({
        module: modulo.name,
        action: `Relatório de ${modulo.name} salvo para ${selectedDate}`,
      });
    } catch (e) {
      console.warn('Erro ao salvar no Supabase:', e);
    }
  };

  const handleUnlock = () => {
    setIsLocked(false);
    toast.info('Modo de edição desbloqueado');
  };

  const handleCopy = () => {
    if (previewRef.current) {
      navigator.clipboard.writeText(previewRef.current.innerText).then(() => {
        setCopied(true);
        toast.success('Resumo copiado para a área de transferência!');
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleWhatsApp = () => {
    if (previewRef.current) {
      const text = previewRef.current.innerText;
      const encoded = encodeURIComponent(text);
      window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    }
  };

  // Atualizar definição do módulo (quando o usuário gerencia/adiciona modelos no sistema)
  const handleSaveModuleSettings = async (updatedModuleData: Omit<CustomRdoModulo, 'created_at'>) => {
    try {
      const fullUpdated: CustomRdoModulo = {
        ...updatedModuleData,
        created_at: modulo?.created_at || new Date().toISOString(),
      };

      // Carregar lista atual
      const { data } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'rdo_modulos_customizados')
        .single();

      let currentList: CustomRdoModulo[] = [];
      if (data && Array.isArray(data.value)) {
        currentList = data.value;
      } else {
        const local = localStorage.getItem('rdo_modulos_customizados');
        if (local) try { currentList = JSON.parse(local); } catch (e) {}
      }

      const updatedList = [
        ...currentList.filter(m => m.id !== fullUpdated.id),
        fullUpdated,
      ];

      setModulo(fullUpdated);
      localStorage.setItem('rdo_modulos_customizados', JSON.stringify(updatedList));

      await supabase.from('global_settings').upsert({
        key: 'rdo_modulos_customizados',
        value: updatedList,
        updated_at: new Date().toISOString(),
      });

      toast.success('Modelos da atividade atualizados com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao atualizar modelos da atividade');
      console.error(err);
    }
  };

  // Excluir módulo (Apenas Admin)
  const handleDeleteModulo = async () => {
    if (!currentUserIsAdmin || !modulo) return;
    if (!confirm(`Tem certeza que deseja excluir permanentemente o botão e a página de "${modulo.name}"?`)) return;

    try {
      const { data } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'rdo_modulos_customizados')
        .single();

      let currentList: CustomRdoModulo[] = [];
      if (data && Array.isArray(data.value)) {
        currentList = data.value;
      } else {
        const local = localStorage.getItem('rdo_modulos_customizados');
        if (local) try { currentList = JSON.parse(local); } catch (e) {}
      }

      const updatedList = currentList.filter(m => m.id !== modulo.id);
      localStorage.setItem('rdo_modulos_customizados', JSON.stringify(updatedList));

      await supabase.from('global_settings').upsert({
        key: 'rdo_modulos_customizados',
        value: updatedList,
        updated_at: new Date().toISOString(),
      });

      toast.success(`Módulo "${modulo.name}" excluído com sucesso!`);
      navigate({ to: '/relatorio-obra' });
    } catch (e) {
      toast.error('Erro ao excluir o módulo');
    }
  };

  if (loadingModulo) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-gray-500">Carregando atividade...</span>
        </div>
      </div>
    );
  }

  if (!modulo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <h2 className="text-xl font-bold text-gray-800">Atividade não encontrada</h2>
        <Link
          to="/relatorio-obra"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors"
        >
          <ArrowLeft size={16} /> Voltar para o Painel
        </Link>
      </div>
    );
  }

  const IconComponent = (Icons as any)[modulo.icon] || Icons.Activity;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-transparent pb-24">
      <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 pt-4 space-y-6">
        {/* Topbar com navegação, título e botões de ação */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-gray-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <Link
              to="/relatorio-obra"
              className="p-2.5 rounded-2xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors shadow-2xs"
              title="Voltar ao Painel"
            >
              <ArrowLeft size={20} />
            </Link>

            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30">
                <IconComponent size={24} />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                  {modulo.name}
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Preenchimento diário de atividades com envio automático para o RDO
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Seletor de Data */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 px-3.5 py-2 rounded-2xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 shadow-2xs hover:bg-gray-50 cursor-pointer"
                >
                  <CalendarIcon size={16} className="text-amber-500" />
                  <span>{selectedDate.split('-').reverse().join('/')}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-white dark:bg-zinc-900 rounded-3xl shadow-xl" align="end">
                <Calendar
                  mode="single"
                  selected={new Date(selectedDate + 'T12:00:00')}
                  onSelect={d => {
                    if (d) {
                      const y = d.getFullYear();
                      const m = String(d.getMonth() + 1).padStart(2, '0');
                      const day = String(d.getDate()).padStart(2, '0');
                      setSelectedDate(`${y}-${m}-${day}`);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Botão de Adicionar/Gerenciar Modelos Diretamente no Sistema */}
            <button
              type="button"
              onClick={() => setIsManageModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700/60 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-xs sm:text-sm font-semibold transition-all shadow-2xs cursor-pointer"
              title="Adicionar ou editar modelos e cards desta atividade"
            >
              <Settings size={15} />
              <span className="hidden sm:inline">Gerenciar</span> Modelos
            </button>

            {/* Botão Salvar / Desbloquear */}
            {isLocked ? (
              <button
                type="button"
                onClick={handleUnlock}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-300 text-yellow-700 dark:text-yellow-400 text-xs sm:text-sm font-bold hover:bg-yellow-100 transition-colors cursor-pointer"
              >
                <Unlock size={15} /> Desbloquear
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <Save size={15} /> Salvar
              </button>
            )}

            {/* Excluir Atividade (Apenas Admin) */}
            {currentUserIsAdmin && (
              <button
                type="button"
                onClick={handleDeleteModulo}
                className="p-2 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors shadow-2xs cursor-pointer"
                title="Excluir Atividade (Administrador)"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Layout Principal: Coluna Esquerda (Cards de Atividade) + Coluna Direita (Prévia do RDO) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Coluna Esquerda: Cards e Modelos de Jardinagem */}
          <div className="lg:col-span-7 space-y-4">
            {(modulo.models || []).map((model) => {
              if (model.tipo === 'checkbox') {
                const isChecked = !!cardCheckboxes[model.id];
                return (
                  <div
                    key={model.id}
                    onClick={() => handleToggleCheckbox(model.id)}
                    className={`p-4 sm:p-5 bg-white dark:bg-zinc-900 border rounded-2xl flex items-center justify-between gap-4 shadow-xs cursor-pointer transition-all ${
                      isChecked
                        ? 'border-green-400 bg-green-50/20 dark:bg-green-950/10'
                        : 'border-gray-200 dark:border-zinc-800 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-green-600">
                        {isChecked ? <CheckCircle2 size={22} /> : <Circle size={22} className="text-gray-300" />}
                      </div>
                      <span className="font-bold text-xs sm:text-sm uppercase tracking-wide text-gray-800 dark:text-gray-200">
                        {model.titulo}
                      </span>
                    </div>
                  </div>
                );
              }

              if (model.tipo === 'selecao') {
                const rows = cardRows[model.id] || [{ value: '', faixa: '', berma: '', opcao: model.opcoes?.[0] || '' }];
                return (
                  <div
                    key={model.id}
                    className="p-4 sm:p-5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl flex flex-col gap-4 shadow-xs"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-green-600" />
                        <h3 className="uppercase text-[11px] sm:text-[12px] tracking-wider font-bold text-gray-800 dark:text-gray-200">
                          {model.titulo}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddRow(model.id, model.opcoes?.[0])}
                        className="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-amber-600 transition-colors p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer"
                        title="Adicionar mais uma linha de medição"
                      >
                        <Plus size={16} />
                        <span className="hidden sm:inline">Adicionar mais</span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      {rows.map((row, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                          {/* Dropdown de Opção / Espécie / Invasora */}
                          <div className="flex-1 relative">
                            <select
                              value={row.opcao || ''}
                              onChange={e => handleUpdateRow(model.id, idx, 'opcao', e.target.value)}
                              className="w-full bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl p-3 text-sm text-gray-900 dark:text-white outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 appearance-none cursor-pointer"
                            >
                              <option value="">{model.labelOpcao ? `Selecione: ${model.labelOpcao}` : 'Selecione a opção'}</option>
                              {(model.opcoes || []).map(op => (
                                <option key={op} value={op}>
                                  {op}
                                </option>
                              ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
                          </div>

                          {/* Campo de Valor / Unidade */}
                          <div className="w-full sm:w-28 relative">
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              value={row.value || ''}
                              onChange={e => handleUpdateRow(model.id, idx, 'value', maskNumber(e.target.value, false))}
                              className="w-full bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl p-3 text-sm text-gray-900 dark:text-white outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder-gray-400"
                            />
                          </div>

                          {/* Faixa */}
                          <div className="w-full sm:w-32 relative">
                            <select
                              value={row.faixa || ''}
                              onChange={e => handleUpdateRow(model.id, idx, 'faixa', e.target.value)}
                              className="w-full bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl p-3 text-sm text-gray-900 dark:text-white outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 appearance-none cursor-pointer"
                            >
                              <option value="">Faixa</option>
                              {FAIXAS.map(f => (
                                <option key={f} value={f}>
                                  {f}
                                </option>
                              ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
                          </div>

                          {/* Elevado / Berma */}
                          <div className="w-full sm:w-36 relative">
                            <select
                              value={row.berma || ''}
                              onChange={e => handleUpdateRow(model.id, idx, 'berma', e.target.value)}
                              className="w-full bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl p-3 text-sm text-gray-900 dark:text-white outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 appearance-none cursor-pointer"
                            >
                              <option value="">Elevado/Berma</option>
                              {BERMAS.map(b => (
                                <option key={b} value={b}>
                                  {b}
                                </option>
                              ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
                          </div>

                          {/* Botão de Excluir Linha se houver mais de uma */}
                          {rows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(model.id, idx)}
                              className="p-2 text-gray-400 hover:text-red-500 transition-colors self-end sm:self-center"
                              title="Remover linha"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              // Medição Padrão (Igual Roçagem, Podagem, Limpeza Manual da foto)
              const rows = cardRows[model.id] || [{ value: '', faixa: '', berma: '' }];
              const isFloat = model.unidade === 'm²' || model.unidade === 'm³' || model.unidade === 'm';

              return (
                <div
                  key={model.id}
                  className="p-4 sm:p-5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl flex flex-col gap-4 shadow-xs"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="uppercase text-[11px] sm:text-[12px] tracking-wider font-bold text-gray-800 dark:text-gray-200">
                      {model.titulo}
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleAddRow(model.id)}
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer"
                      title="Adicionar mais uma linha"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {rows.map((row, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                        {/* Input Numérico */}
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder={isFloat ? '0,00' : '0'}
                            value={row.value || ''}
                            onChange={e => handleUpdateRow(model.id, idx, 'value', maskNumber(e.target.value, isFloat))}
                            className="w-full bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl p-3 text-sm text-gray-900 dark:text-white outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder-gray-400"
                          />
                        </div>

                        {/* Faixa */}
                        <div className="w-full sm:w-36 relative">
                          <select
                            value={row.faixa || ''}
                            onChange={e => handleUpdateRow(model.id, idx, 'faixa', e.target.value)}
                            className="w-full bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl p-3 text-sm text-gray-900 dark:text-white outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 appearance-none cursor-pointer"
                          >
                            <option value="">Faixa</option>
                            {FAIXAS.map(f => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
                        </div>

                        {/* Elevado / Berma */}
                        <div className="w-full sm:w-40 relative">
                          <select
                            value={row.berma || ''}
                            onChange={e => handleUpdateRow(model.id, idx, 'berma', e.target.value)}
                            className="w-full bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl p-3 text-sm text-gray-900 dark:text-white outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 appearance-none cursor-pointer"
                          >
                            <option value="">Elevado/Berma</option>
                            {BERMAS.map(b => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
                        </div>

                        {/* Botão de Excluir Linha se houver mais de uma */}
                        {rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(model.id, idx)}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors self-end sm:self-center"
                            title="Remover linha"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Card de Outras Atividades (Preenchimento Manual) - Exatamente igual à Foto 3 */}
            {modulo.temOutrasAtividades !== false && (
              <div className="p-4 sm:p-5 bg-white dark:bg-zinc-900 border border-yellow-200 dark:border-yellow-900/60 rounded-2xl flex flex-col gap-4 shadow-xs relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-yellow-50/50 dark:from-yellow-950/20 to-transparent pointer-events-none" />

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 relative z-10">
                  <div className="flex items-start gap-2">
                    <PenLine className="text-yellow-600 dark:text-yellow-500 mt-1" size={18} />
                    <h3 className="uppercase text-[13px] leading-tight tracking-wider font-bold text-yellow-600 dark:text-yellow-500">
                      OUTRAS ATIVIDADES
                      <br />
                      <span className="text-[10px] text-yellow-600/70 dark:text-yellow-400/70 normal-case font-medium">
                        (Preenchimento Manual)
                      </span>
                    </h3>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-32">
                      <select
                        value={outrasFaixa}
                        onChange={e => setOutrasFaixa(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl p-2.5 text-xs sm:text-sm text-gray-900 dark:text-white appearance-none outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                      >
                        <option value="">Faixa</option>
                        {FAIXAS.map(f => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
                    </div>

                    <div className="relative flex-1 sm:w-36">
                      <select
                        value={outrasBerma}
                        onChange={e => setOutrasBerma(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl p-2.5 text-xs sm:text-sm text-gray-900 dark:text-white appearance-none outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                      >
                        <option value="">Elevado/Berma</option>
                        {BERMAS.map(b => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
                    </div>
                  </div>
                </div>

                <textarea
                  value={outrasDesc}
                  onChange={e => setOutrasDesc(e.target.value)}
                  placeholder="Descreva outras atividades realizadas que não estão listadas acima..."
                  className="w-full h-24 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl p-3 text-sm text-gray-900 dark:text-white outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 resize-none relative z-10 placeholder-gray-400"
                />
                <p className="text-gray-500 text-[11px] relative z-10">
                  Este campo será incluído no resumo do RDO exatamente como preenchido.
                </p>
              </div>
            )}

            {/* Observações Gerais */}
            <div className="p-4 sm:p-5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl flex flex-col gap-2 shadow-xs">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Observações do Dia
              </label>
              <textarea
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                placeholder="Observações complementares, clima, interferências..."
                className="w-full h-20 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl p-3 text-sm text-gray-900 dark:text-white outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none placeholder-gray-400"
              />
            </div>
          </div>

          {/* Coluna Direita: Pré-visualização do Resumo (conforme Jardinagem e Gabião) */}
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4">
            <div className="p-5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-amber-500" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                    Prévia do Relatório ({selectedDate.split('-').reverse().join('/')})
                  </h2>
                </div>
              </div>

              {/* Caixa de Texto Monospaçada com o Resumo Formatado */}
              <div
                ref={previewRef}
                className="bg-[#faf9f6] dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 p-4 rounded-2xl font-mono text-[13px] text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed overflow-y-auto max-h-[480px] shadow-inner select-text"
              >
                <div>🏗️ EMPRESA: Sucena Empreendimentos</div>
                <div className="mt-1">📄 CONTRATO - 460001269</div>
                <div className="mt-1">➡️ GERÊNCIA: Hydro</div>
                <div className="mt-1">➡️ DATA: {selectedDate.split('-').reverse().join('/')}</div>

                <div className="mt-4 mb-2 font-bold text-amber-700 dark:text-amber-400">
                  🛠️ ATIVIDADES - {modulo.name.toUpperCase()}:
                </div>

                <div className="whitespace-pre-wrap">{renderedSummaryText}</div>
              </div>

              {/* Ações da Prévia: Copiar e Enviar WhatsApp */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-1 py-2.5 px-3 rounded-2xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-gray-50 text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  <Copy size={16} />
                  <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleWhatsApp}
                  className="flex-1 py-2.5 px-3 rounded-2xl bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Phone size={16} />
                  <span>Enviar no WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal de Gerenciamento / Criação de Novos Modelos no Próprio Sistema */}
        <CreateModuleModal
          isOpen={isManageModalOpen}
          onClose={() => setIsManageModalOpen(false)}
          onSave={handleSaveModuleSettings}
          initialData={modulo}
          isEditing={true}
        />
      </div>
    </div>
  );
}
