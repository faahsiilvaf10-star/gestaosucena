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
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { isAdmin } from '@/components/ui/VerifiedBadge';
import { CustomRdoModulo, CustomRdoItem, CustomRdoDailyData } from '@/types/rdoCustomModule';

export const Route = createFileRoute('/relatorio-obra/modulo/$id')({
  component: CustomModuloAtividadePage,
});

const FAIXAS = ['Faixa 1', 'Faixa 2', 'Faixa 3', 'Faixa 4', 'Faixa 5'];

const BERMAS = [
  ...Array.from({ length: 32 }, (_, i) => {
    const num = i + 26;
    return num % 2 === 0 ? `Berma ${num}` : `Elevado ${num}`;
  }),
  'MIRANTE',
  'GABIÃO 1',
  'GABIÃO 2',
  'GABIÃO 3',
];

function CustomModuloAtividadePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const [modulo, setModulo] = useState<CustomRdoModulo | null>(null);
  const [loadingModulo, setLoadingModulo] = useState(true);

  // Dados diários da atividade
  const [localFaixa, setLocalFaixa] = useState('');
  const [localElevado, setLocalElevado] = useState('');
  const [itens, setItens] = useState<CustomRdoItem[]>([]);
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
  useEffect(() => {
    const loadModulo = async () => {
      setLoadingModulo(true);
      try {
        // Tentar carregar de global_settings
        const { data, error } = await supabase
          .from('global_settings')
          .select('value')
          .eq('key', 'rdo_modulos_customizados')
          .single();

        let modulosList: CustomRdoModulo[] = [];
        if (data && Array.isArray(data.value)) {
          modulosList = data.value;
        } else {
          // Fallback cache local
          const local = localStorage.getItem('rdo_modulos_customizados');
          if (local) {
            try {
              modulosList = JSON.parse(local);
            } catch (e) {}
          }
        }

        const found = modulosList.find(m => m.id === id);
        if (found) {
          setModulo(found);
        } else {
          toast.error('Módulo de atividade não encontrado');
          navigate({ to: '/relatorio-obra' });
        }
      } catch (e) {
        console.error('Erro ao carregar módulo:', e);
      } finally {
        setLoadingModulo(false);
      }
    };

    loadModulo();
  }, [id]);

  // Carregar dados diários para a data selecionada
  useEffect(() => {
    if (!modulo) return;

    const loadDailyData = async () => {
      const storageKey = `custom_rdo_${id}_${selectedDate}`;
      let parsed: CustomRdoDailyData | null = null;

      // 1. Tentar local
      const localData = localStorage.getItem(storageKey);
      if (localData) {
        try {
          parsed = JSON.parse(localData);
        } catch (e) {}
      }

      // 2. Tentar remoto
      try {
        const { data } = await supabase
          .from('global_settings')
          .select('value')
          .eq('key', storageKey)
          .single();

        if (data && data.value) {
          parsed = data.value;
          localStorage.setItem(storageKey, JSON.stringify(parsed));
        }
      } catch (e) {}

      if (parsed) {
        setLocalFaixa(parsed.localFaixa || '');
        setLocalElevado(parsed.localElevado || '');
        setObservacoes(parsed.observacoes || '');
        setIsLocked(parsed.isLocked || false);

        // Mesclar itens salvos com itens padrão
        const savedItens = parsed.itens || [];
        const mergedItens = [...savedItens];

        // Se o módulo tiver tarefas padrão que ainda não estavam nos itens salvos, adiciona desmarcadas
        (modulo.defaultItens || []).forEach(def => {
          if (!mergedItens.some(i => i.id === def.id || i.nome.toLowerCase() === def.nome.toLowerCase())) {
            mergedItens.push({ ...def, marcado: false });
          }
        });

        setItens(mergedItens);
      } else {
        // Inicializa com as tarefas padrão desmarcadas
        setLocalFaixa('');
        setLocalElevado('');
        setObservacoes('');
        setIsLocked(false);
        setItens((modulo.defaultItens || []).map(item => ({ ...item, marcado: false })));
      }
    };

    loadDailyData();
  }, [modulo, selectedDate, id]);

  const handleToggleItem = (itemId: string) => {
    setItens(prev =>
      prev.map(item => (item.id === itemId ? { ...item, marcado: !item.marcado } : item))
    );
  };

  const handleUpdateItem = (itemId: string, updates: Partial<CustomRdoItem>) => {
    setItens(prev => prev.map(item => (item.id === itemId ? { ...item, ...updates } : item)));
  };

  const handleAddNewTask = () => {
    const newTask: CustomRdoItem = {
      id: 'task-' + Date.now(),
      nome: '',
      tipo: 'checkbox',
      marcado: true,
      unidade: 'm²',
    };
    setItens(prev => [...prev, newTask]);
  };

  const handleRemoveTask = (itemId: string) => {
    setItens(prev => prev.filter(item => item.id !== itemId));
  };

  // Texto formatado para o Resumo do RDO
  const previewText = useMemo(() => {
    if (!modulo) return '';

    const lines: string[] = [];
    const modName = modulo.name.toUpperCase();
    lines.push(`✳️ ${modName} ✳️`);

    const locParts = [localFaixa, localElevado].filter(Boolean);
    if (locParts.length > 0) {
      lines.push(`📍 Local: ${locParts.join(' - ')}`);
      lines.push('');
    }

    const marked = itens.filter(i => i.marcado && i.nome.trim());

    if (marked.length === 0 && !observacoes.trim()) {
      return `Nenhuma atividade de ${modulo.name} realizada nesta data.`;
    }

    marked.forEach(item => {
      if (item.tipo === 'checkbox') {
        lines.push(`* ${item.nome.trim()}`);
      } else {
        const val = item.valor?.trim() || '0';
        const un = item.unidade || 'm²';
        lines.push(`* ${item.nome.trim()}: ${val} ${un}`);
      }
    });

    if (observacoes.trim()) {
      lines.push('');
      lines.push(`📝 Observações: ${observacoes.trim()}`);
    }

    return lines.join('\n');
  }, [modulo, localFaixa, localElevado, itens, observacoes]);

  const handleSave = async () => {
    if (!modulo) return;

    const storageKey = `custom_rdo_${id}_${selectedDate}`;
    const dataToSave: CustomRdoDailyData = {
      moduloId: id,
      moduloName: modulo.name,
      data: selectedDate,
      localFaixa,
      localElevado,
      itens,
      observacoes,
      isLocked: true,
      updated_at: new Date().toISOString(),
    };

    localStorage.setItem(storageKey, JSON.stringify(dataToSave));
    setIsLocked(true);
    toast.success(`${modulo.name} salva com sucesso para ${selectedDate}!`);

    try {
      await supabase.from('global_settings').upsert(
        {
          key: storageKey,
          value: dataToSave,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
    } catch (e) {
      console.error('Erro ao salvar no Supabase:', e);
    }
  };

  const handleUnlock = () => {
    setIsLocked(false);
  };

  const handleCopy = () => {
    if (previewText) {
      navigator.clipboard.writeText(previewText);
      setCopied(true);
      toast.success('Resumo copiado para a área de transferência!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsApp = () => {
    if (previewText) {
      const encoded = encodeURIComponent(previewText);
      window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    }
  };

  const handleDeleteModule = async () => {
    if (!modulo) return;
    if (!confirm(`Tem certeza que deseja excluir o módulo "${modulo.name}"?`)) return;

    try {
      const { data } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'rdo_modulos_customizados')
        .single();

      let modulosList: CustomRdoModulo[] = data?.value || [];
      modulosList = modulosList.filter(m => m.id !== id);

      await supabase.from('global_settings').upsert({
        key: 'rdo_modulos_customizados',
        value: modulosList,
        updated_at: new Date().toISOString(),
      });

      localStorage.setItem('rdo_modulos_customizados', JSON.stringify(modulosList));
      toast.success('Módulo excluído com sucesso!');
      navigate({ to: '/relatorio-obra' });
    } catch (e) {
      console.error(e);
      toast.error('Erro ao excluir módulo');
    }
  };

  if (loadingModulo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f3f0] dark:bg-[#121214] text-gray-500">
        Carregando atividade...
      </div>
    );
  }

  if (!modulo) return null;

  const IconComp = (Icons as any)[modulo.icon] || Icons.Activity;

  return (
    <div className="min-h-screen bg-[#f4f3f0] dark:bg-[#121214] text-gray-900 dark:text-gray-100 pb-24">
      <div className="max-w-[1300px] mx-auto px-4 sm:px-8 pt-8">
        {/* Top Bar com Voltar */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/relatorio-obra"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Voltar ao Relatório de Obra</span>
          </Link>

          {currentUserIsAdmin && (
            <button
              onClick={handleDeleteModule}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 border border-red-200 dark:border-red-900 transition-colors cursor-pointer"
              title="Excluir este módulo (disponível apenas para administradores)"
            >
              <Trash2 size={14} />
              <span>Excluir Módulo (Admin)</span>
            </button>
          )}
        </div>

        {/* Header do Módulo */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 flex items-center justify-center shrink-0 shadow-sm">
              <IconComp size={28} strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                {modulo.name}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {modulo.desc || 'Registro diário das atividades e envio para o RDO'}
              </p>
            </div>
          </div>

          {/* Toolbar de Ações e Calendário */}
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 bg-white dark:bg-[#1e1e22] border border-gray-200 dark:border-white/10 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs hover:border-yellow-400 transition-colors cursor-pointer">
                  <CalendarIcon size={16} className="text-yellow-600" />
                  <span>{selectedDate.split('-').reverse().join('/')}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={new Date(selectedDate + 'T12:00:00')}
                  onSelect={d => d && setSelectedDate(d.toISOString().split('T')[0])}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {isLocked ? (
              <button
                onClick={handleUnlock}
                className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer"
              >
                <span>Desbloquear</span>
              </button>
            ) : (
              <button
                onClick={handleSave}
                className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer active:scale-95"
              >
                <Save size={16} />
                <span>Salvar</span>
              </button>
            )}

            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer"
            >
              <Phone size={16} />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center gap-2 bg-white dark:bg-[#1e1e22] border border-gray-200 dark:border-white/10 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs hover:border-yellow-400 transition-colors cursor-pointer"
            >
              <Copy size={16} />
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>
        </div>

        {/* Conteúdo em 2 colunas: Formulário na esquerda, Pré-visualização na direita */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-start mt-8">
          {/* Coluna Esquerda: Formulário de preenchimento */}
          <div className="flex flex-col gap-6">
            {/* Localização */}
            <div className="p-5 bg-white dark:bg-[#1a1a1c] border border-gray-200 dark:border-white/10 rounded-3xl shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                <MapPin size={16} className="text-yellow-600" />
                <span>Local da Obra</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-500">Faixa</label>
                  <select
                    value={localFaixa}
                    onChange={e => setLocalFaixa(e.target.value)}
                    disabled={isLocked}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs font-semibold outline-none focus:border-yellow-500 cursor-pointer"
                  >
                    <option value="">Selecione a Faixa</option>
                    {FAIXAS.map(f => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-500">Berma / Elevado</label>
                  <select
                    value={localElevado}
                    onChange={e => setLocalElevado(e.target.value)}
                    disabled={isLocked}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs font-semibold outline-none focus:border-yellow-500 cursor-pointer"
                  >
                    <option value="">Selecione Berma/Elevado</option>
                    {BERMAS.map(b => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Lista de Atividades / Tarefas */}
            <div className="p-5 sm:p-6 bg-white dark:bg-[#1a1a1c] border border-gray-200 dark:border-white/10 rounded-3xl shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-gray-100 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-yellow-600" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                    Tarefas do Dia ({itens.filter(i => i.marcado).length} de {itens.length} feitas)
                  </h2>
                </div>

                {!isLocked && (
                  <button
                    type="button"
                    onClick={handleAddNewTask}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Adicionar Tarefa</span>
                  </button>
                )}
              </div>

              {/* Lista de itens com Checkbox */}
              <div className="flex flex-col gap-3">
                {itens.length === 0 ? (
                  <div className="p-6 text-center border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl text-xs text-gray-400">
                    Nenhuma tarefa cadastrada. Clique em "+ Adicionar Tarefa" acima.
                  </div>
                ) : (
                  itens.map(item => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col gap-3 ${
                        item.marcado
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 shadow-2xs'
                          : 'bg-gray-50 dark:bg-white/[0.02] border-gray-200 dark:border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        {/* Checkbox igual Jardinagem/Gabião */}
                        <div
                          onClick={() => !isLocked && handleToggleItem(item.id)}
                          className={`flex items-center gap-3 cursor-pointer select-none flex-1 min-w-0 ${
                            isLocked ? 'pointer-events-none' : ''
                          }`}
                        >
                          {item.marcado ? (
                            <CheckCircle2 className="text-emerald-600 shrink-0" size={24} />
                          ) : (
                            <Circle className="text-gray-400 shrink-0" size={24} />
                          )}

                          <input
                            type="text"
                            value={item.nome}
                            disabled={isLocked}
                            onChange={e => handleUpdateItem(item.id, { nome: e.target.value })}
                            onClick={e => e.stopPropagation()}
                            placeholder="Nome da tarefa..."
                            className="bg-transparent border-none text-sm font-bold text-gray-900 dark:text-white outline-none flex-1 min-w-0 placeholder-gray-400"
                          />
                        </div>

                        {/* Ações */}
                        <div className="flex items-center gap-2 shrink-0">
                          {item.tipo === 'checkbox' ? (
                            <button
                              type="button"
                              disabled={isLocked}
                              onClick={() => handleUpdateItem(item.id, { tipo: 'medicao' })}
                              className="text-[11px] px-2.5 py-1 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-white/5 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 transition-colors"
                            >
                              + Medição
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isLocked}
                              onClick={() => handleUpdateItem(item.id, { tipo: 'checkbox' })}
                              className="text-[11px] px-2.5 py-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900/50 transition-colors"
                            >
                              ✕ Só Marcar
                            </button>
                          )}

                          {!isLocked && (
                            <button
                              type="button"
                              onClick={() => handleRemoveTask(item.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Se for medição, mostra campo de valor */}
                      {item.tipo === 'medicao' && item.marcado && (
                        <div className="pl-9 flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-white/5">
                          <input
                            type="text"
                            value={item.valor || ''}
                            disabled={isLocked}
                            onChange={e => handleUpdateItem(item.id, { valor: e.target.value })}
                            placeholder="Valor executado (ex: 150)"
                            className="w-40 bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono outline-none focus:border-yellow-500"
                          />
                          <select
                            value={item.unidade || 'm²'}
                            disabled={isLocked}
                            onChange={e => handleUpdateItem(item.id, { unidade: e.target.value })}
                            className="bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs outline-none cursor-pointer"
                          >
                            <option value="m²">m²</option>
                            <option value="unid">unid</option>
                            <option value="m">m</option>
                            <option value="m³">m³</option>
                            <option value="kg">kg</option>
                          </select>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Observações */}
            <div className="p-5 bg-white dark:bg-[#1a1a1c] border border-gray-200 dark:border-white/10 rounded-3xl shadow-xs space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Observações do Dia
              </label>
              <textarea
                rows={3}
                value={observacoes}
                disabled={isLocked}
                onChange={e => setObservacoes(e.target.value)}
                placeholder="Observações da equipe, dificuldades enfrentadas, equipamentos..."
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-xs outline-none focus:border-yellow-500 resize-none"
              />
            </div>
          </div>

          {/* Coluna Direita: Pré-visualização do Resumo (conforme Jardinagem e Gabião) */}
          <div className="sticky top-6 flex flex-col gap-4">
            <div className="bg-white dark:bg-[#1a1a1c] border border-yellow-500/30 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <FileText className="text-yellow-600" size={18} />
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">Resumo para RDO</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700/60">
                  Prévia em Tempo Real
                </span>
              </div>

              <div
                ref={previewRef}
                className="bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-2xl p-4 font-mono text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap min-h-[220px] max-h-[420px] overflow-y-auto custom-scrollbar select-text leading-relaxed shadow-2xs"
              >
                {previewText}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-all shadow-2xs cursor-pointer"
                >
                  <Copy size={14} />
                  <span>{copied ? 'Copiado!' : 'Copiar Resumo'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleWhatsApp}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
                >
                  <Phone size={14} />
                  <span>WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
