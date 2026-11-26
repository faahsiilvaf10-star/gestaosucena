import Leaf from 'lucide-react/dist/esm/icons/leaf.js';
import CalendarIcon from 'lucide-react/dist/esm/icons/calendar.js';
import History from 'lucide-react/dist/esm/icons/history.js';
import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import Save from 'lucide-react/dist/esm/icons/save.js';
import Copy from 'lucide-react/dist/esm/icons/copy.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import TreePine from 'lucide-react/dist/esm/icons/tree-pine.js';
import PenLine from 'lucide-react/dist/esm/icons/pen-line.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';
import Droplets from 'lucide-react/dist/esm/icons/droplets.js';
import Phone from 'lucide-react/dist/esm/icons/phone.js';
import Lock from 'lucide-react/dist/esm/icons/lock.js';
import Layers from 'lucide-react/dist/esm/icons/layers.js';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up.js';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import { createFileRoute } from '@tanstack/react-router'
import { createPortal } from 'react-dom'
import { useState, useEffect, useRef, useMemo } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/logActivity'
import {
  RocagemEntry,
  calculatePeriodActivityTotal,
  getAllJardinagemRecords,
  formatM2,
  getRocagemCycleForDate,
  extractCopyableText,
  sumActivitiesTotals,
  AllJardinagemRecords,
  JardinagemActivityType
} from '../../lib/jardinagemRocagem'
import { HistoricoRocagemTab } from '../../components/jardinagem/HistoricoRocagemTab'
import {
  BERMAS_OPTIONS,
  ELEVADOS_OPTIONS,
  splitBermaElevado,
} from '../../lib/rdoLocations'

const maskNumber = (val: string, isFloat: boolean) => {
  if (!isFloat) {
    val = val.split(',')[0];
  }
  let raw = val.replace(/\D/g, '');
  if (!raw) return '';
  if (isFloat) {
    while (raw.length < 3) raw = '0' + raw;
    const intPart = raw.slice(0, -2).replace(/^0+/, '') || '0';
    const decPart = raw.slice(-2);
    return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + ',' + decPart;
  } else {
    const intPart = raw.replace(/^0+/, '') || '0';
    return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
}

const parseNumber = (val: string) => {
  if (!val) return 0;
  const clean = val.replace(/\./g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

export const Route = createFileRoute('/relatorio-obra/jardinagem')({
  component: JardinagemPage,
})

const faixas = Array.from({length: 4}, (_, i) => i + 2);

// Generic Row Component
function ActivityRow({ 
  title, 
  data, 
  setData, 
  isFloat = false,
  icon,
  containerClassName = '',
  extraHeader,
  extraFooter,
  allowObservacao = false
}: { 
  title: string; 
  data: any[]; 
  setData: (data: any) => void;
  isFloat?: boolean;
  icon?: React.ReactNode;
  containerClassName?: string;
  extraHeader?: React.ReactNode;
  extraFooter?: React.ReactNode;
  allowObservacao?: boolean;
}) {
  const addRow = () => setData([...data, {value: '', faixa: '', berma: '', elevado: '', observacao: ''}]);
  
  return (
    <div className={`p-4 sm:p-5 bg-white border border-gray-200 rounded-2xl flex flex-col gap-4 shadow-sm ${containerClassName}`}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="uppercase text-[11px] tracking-wider font-bold text-gray-800">{title}</h3>
        </div>
        <button onClick={addRow} className="text-gray-500 hover:text-gray-900 transition-colors p-1 rounded-md hover:bg-gray-100 cursor-pointer" title="Adicionar item">
          <Plus size={18} />
        </button>
      </div>
      {extraHeader}
      {data.map((row, idx) => (
        <div key={idx} className="flex flex-col gap-2 p-3 rounded-xl bg-gray-50/70 border border-gray-200/80 transition-all">
          <div className="flex flex-col xl:flex-row gap-2.5 items-stretch xl:items-center">
            <div className="flex-1 min-w-[100px] relative">
              <input 
                type="text"
                inputMode="numeric"
                value={row.value}
                onChange={(e) => {
                  const newData = [...data];
                  newData[idx] = { ...newData[idx], value: maskNumber(e.target.value, isFloat) };
                  setData(newData);
                }}
                className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors placeholder-gray-400 font-medium"
                placeholder={isFloat ? "0,00" : "0"}
              />
            </div>
            <div className="flex items-center gap-2 w-full xl:w-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:flex gap-2.5 flex-1">
                <div className="relative col-span-2 sm:col-span-1 xl:w-28">
                  <select
                    value={row.faixa || ''}
                    onChange={(e) => {
                      const newData = [...data];
                      newData[idx] = { ...newData[idx], faixa: e.target.value };
                      setData(newData);
                    }}
                    aria-label="Faixa"
                    className="w-full bg-white border border-gray-300 rounded-xl p-3 pr-7 text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="">Faixa</option>
                    {faixas.map(f => <option key={f} value={`Faixa ${f}`}>Faixa {f}</option>)}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#5f6472] dark:text-gray-400 text-xs">▼</div>
                </div>
                <div className="relative xl:w-32">
                  <select
                    value={row.berma || ''}
                    onChange={(e) => {
                      const newData = [...data];
                      newData[idx] = { ...newData[idx], berma: e.target.value };
                      setData(newData);
                    }}
                    aria-label="Berma"
                    className="w-full bg-white border border-gray-300 rounded-xl p-3 pr-7 text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="">Berma</option>
                    {BERMAS_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#5f6472] dark:text-gray-400 text-xs">▼</div>
                </div>
                <div className="relative xl:w-36">
                  <select
                    value={row.elevado || ''}
                    onChange={(e) => {
                      const newData = [...data];
                      newData[idx] = { ...newData[idx], elevado: e.target.value };
                      setData(newData);
                    }}
                    aria-label="Elevado"
                    className="w-full bg-white border border-gray-300 rounded-xl p-3 pr-7 text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="">Elevado</option>
                    {ELEVADOS_OPTIONS.map(el => <option key={el} value={el}>{el}</option>)}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#5f6472] dark:text-gray-400 text-xs">▼</div>
                </div>
              </div>
              {data.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const newData = data.filter((_, i) => i !== idx);
                    setData(newData);
                  }}
                  title="Remover linha"
                  className="text-gray-400 hover:text-red-500 p-2.5 rounded-xl hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>

          {allowObservacao && (
            <div className="w-full flex items-center gap-2 pt-1 border-t border-gray-200/60">
              <span className="text-[11px] text-teal-800 font-bold shrink-0 flex items-center gap-1">
                <FileText size={13} className="text-teal-600" />
                Obs:
              </span>
              <input
                type="text"
                value={row.observacao || ''}
                onChange={(e) => {
                  const newData = [...data];
                  newData[idx] = { ...newData[idx], observacao: e.target.value };
                  setData(newData);
                }}
                placeholder="Observação da limpeza manual (opcional, ex.: trecho específico, detalhes...)"
                className="w-full bg-white border border-gray-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 placeholder-gray-400 outline-none transition-all"
              />
            </div>
          )}
        </div>
      ))}
      {extraFooter}
    </div>
  )
}

function JardinagemPage() {
  const [rocagem, setRocagem] = useState([{value: '', faixa: '', berma: '', elevado: ''}]);
  const [rocagemAsp, setRocagemAsp] = useState([{value: '', faixa: '', berma: '', elevado: ''}]);
  const [podagem, setPodagem] = useState([{value: '', faixa: '', berma: '', elevado: ''}]);
  const [cova, setCova] = useState([{value: '', faixa: '', berma: '', elevado: ''}]);
  const [coroamento, setCoroamento] = useState([{value: '', faixa: '', berma: '', elevado: ''}]);
  const [adubagem, setAdubagem] = useState([{value: '', faixa: '', berma: '', elevado: ''}]);
  const [plantio, setPlantio] = useState([{especie: '', value: '', faixa: '', berma: '', elevado: ''}]);
  const [limpezaManual, setLimpezaManual] = useState([{value: '', faixa: '', berma: '', elevado: '', observacao: ''}]);
  const [capinaManual, setCapinaManual] = useState([{value: '', faixa: '', berma: '', elevado: ''}]);
  const [limpezaSoprador, setLimpezaSoprador] = useState([{value: '', faixa: '', berma: '', elevado: ''}]);
  const [invasoras, setInvasoras] = useState([{nome: '', value: '', berma: '', elevado: '', faixa: ''}]);
  const [retiradaMudas, setRetiradaMudas] = useState([{value: '', faixa: '', berma: '', elevado: ''}]);
  const [plantioGrama, setPlantioGrama] = useState([{value: '', faixa: '', berma: '', elevado: ''}]);
  
  const [outrasFaixa, setOutrasFaixa] = useState('');
  const [outrasBerma, setOutrasBerma] = useState('');
  const [outrasElevado, setOutrasElevado] = useState('');
  const [outrasDesc, setOutrasDesc] = useState('');
  
  const [canteiroDesc, setCanteiroDesc] = useState('');
  
  const [irrigacaoPipas, setIrrigacaoPipas] = useState(false);
  const [irrigacaoApoioPipa, setIrrigacaoApoioPipa] = useState(false);
  const [irrigacaoCarretel, setIrrigacaoCarretel] = useState(false);
  const [manutencaoIrrigacao, setManutencaoIrrigacao] = useState(false);
  
  const [irrigacaoCarretelFaixaAtiva, setIrrigacaoCarretelFaixaAtiva] = useState<number>(1);
  const [irrigacaoCarretelBermas, setIrrigacaoCarretelBermas] = useState<Record<number, number[]>>({
    1: [], 2: [], 3: [], 4: [], 5: []
  });

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  const [activeMainTab, setActiveMainTab] = useState<'diario' | 'historico_rocagem'>('diario');
  const [allJardinagemRecords, setAllJardinagemRecords] = useState<AllJardinagemRecords>({
    rocagem: [],
    limpezaManual: [],
    capinaManual: [],
    limpezaSoprador: []
  });
  const [historicoInitialActivity, setHistoricoInitialActivity] = useState<'todas' | JardinagemActivityType>('todas');
  const [loadingRocagem, setLoadingRocagem] = useState<boolean>(true);

  const [showHistory, setShowHistory] = useState(false);
  const [savedDates, setSavedDates] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const refreshRocagemRecords = async () => {
    setLoadingRocagem(true);
    try {
      const records = await getAllJardinagemRecords();
      setAllJardinagemRecords(records);
    } catch (err) {
      console.error('Erro ao buscar histórico de jardinagem:', err);
    } finally {
      setLoadingRocagem(false);
    }
  };

  // Cálculos em tempo real da soma do ciclo contratual (dia 16 ao dia 15)
  const rocagemPeriodInfo = useMemo(() => {
    return calculatePeriodActivityTotal(selectedDate, allJardinagemRecords.rocagem, rocagem);
  }, [selectedDate, allJardinagemRecords.rocagem, rocagem]);

  const limpezaManualPeriodInfo = useMemo(() => {
    return calculatePeriodActivityTotal(selectedDate, allJardinagemRecords.limpezaManual, limpezaManual);
  }, [selectedDate, allJardinagemRecords.limpezaManual, limpezaManual]);

  const capinaManualPeriodInfo = useMemo(() => {
    return calculatePeriodActivityTotal(selectedDate, allJardinagemRecords.capinaManual, capinaManual);
  }, [selectedDate, allJardinagemRecords.capinaManual, capinaManual]);

  const limpezaSopradorPeriodInfo = useMemo(() => {
    return calculatePeriodActivityTotal(selectedDate, allJardinagemRecords.limpezaSoprador, limpezaSoprador);
  }, [selectedDate, allJardinagemRecords.limpezaSoprador, limpezaSoprador]);

  const updateSavedDates = async () => {
    const localKeys = Object.keys(localStorage).filter(k => k.startsWith('jardinagem_rdo_'));
    const localDates = localKeys.filter(k => {
      try {
        const data = JSON.parse(localStorage.getItem(k) || '{}');
        return data.isLocked !== false;
      } catch (e) {
        return false;
      }
    }).map(k => k.replace('jardinagem_rdo_', ''));

    let remoteDates: string[] = [];
    try {
      const { data } = await supabase.from('global_settings').select('key, value').like('key', 'jardinagem_rdo_%');
      if (data) {
        remoteDates = data.filter((r: any) => r.value?.isLocked !== false).map((r: any) => r.key.replace('jardinagem_rdo_', ''));
      }
    } catch (e) {}

    const merged = Array.from(new Set([...localDates, ...remoteDates])).sort((a, b) => b.localeCompare(a));
    setSavedDates(merged);
  }

  const handleUnlock = async () => {
    setIsLocked(false);
    let parsed: any = {};
    const localData = localStorage.getItem(`jardinagem_rdo_${selectedDate}`);
    if (localData) {
      try { parsed = JSON.parse(localData); } catch (e) {}
    }
    parsed.isLocked = false;
    localStorage.setItem(`jardinagem_rdo_${selectedDate}`, JSON.stringify(parsed));
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sucena_rdo_saved', {
        detail: { date: selectedDate, moduloId: 'jardinagem', isLocked: false }
      }));
    }
    
    try {
      await supabase.from('global_settings').upsert({
        key: `jardinagem_rdo_${selectedDate}`,
        value: parsed,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
    } catch (e) {}
    
    updateSavedDates();
  }

  useEffect(() => {
    updateSavedDates();
    loadDate(selectedDate);
    refreshRocagemRecords();
  }, []);

  const handleSave = async () => {
    const dataToSave = {
      rocagem, rocagemAsp, podagem, cova, coroamento, adubagem, plantio, limpezaManual, capinaManual, limpezaSoprador, invasoras, retiradaMudas, plantioGrama,
      outrasFaixa, outrasBerma, outrasElevado, outrasDesc, canteiroDesc, irrigacaoPipas, irrigacaoApoioPipa, irrigacaoCarretel, irrigacaoCarretelBermas,
      manutencaoIrrigacao,
      isLocked: true
    };
    localStorage.setItem(`jardinagem_rdo_${selectedDate}`, JSON.stringify(dataToSave));
    setIsLocked(true);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sucena_rdo_saved', { detail: { date: selectedDate, moduloId: 'jardinagem' } }));
    }

    const cycleTotalRocagem = rocagemPeriodInfo.totalM2;
    const cycleTotalManual = limpezaManualPeriodInfo.totalM2;
    const cycleTotalCapina = capinaManualPeriodInfo.totalM2;
    const cycleTotalSoprador = limpezaSopradorPeriodInfo.totalM2;
    toast.success(
      `Relatório salvo para ${formatDateDisplay(selectedDate)}! Ciclo (${rocagemPeriodInfo.cycle.startDate.slice(8)} a ${rocagemPeriodInfo.cycle.endDate.slice(8)}): Roçagem: ${formatM2(cycleTotalRocagem)} m² | Limp. Manual: ${formatM2(cycleTotalManual)} m² | Capina Manual: ${formatM2(cycleTotalCapina)} m² | Soprador: ${formatM2(cycleTotalSoprador)} m²`
    );
    
    try {
      await supabase.from('global_settings').upsert({
        key: `jardinagem_rdo_${selectedDate}`,
        value: dataToSave,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
      
      const localUserName = typeof window !== 'undefined' ? localStorage.getItem('sucena_user_name') : null;
      await logActivity({
        module: 'RDO',
        action: `Relatório de Jardinagem salvo para ${formatDateDisplay(selectedDate)} (Ciclo 16-15 — Roçagem: ${formatM2(cycleTotalRocagem)} m² | Limp. Manual: ${formatM2(cycleTotalManual)} m² | Capina Manual: ${formatM2(cycleTotalCapina)} m² | Soprador: ${formatM2(cycleTotalSoprador)} m²)`,
        user_name: localUserName || 'Fabrício Silva'
      });
    } catch (e) {}
    
    updateSavedDates();
    refreshRocagemRecords();
  }

  const loadDate = async (dateStr: string) => {
    setSelectedDate(dateStr);
    
    let parsed: any = null;
    
    try {
      const { data } = await supabase.from('global_settings').select('value').eq('key', `jardinagem_rdo_${dateStr}`).single();
      if (data && data.value) {
        parsed = data.value;
        localStorage.setItem(`jardinagem_rdo_${dateStr}`, JSON.stringify(parsed));
      }
    } catch (e) {}
    
    if (!parsed) {
      const localData = localStorage.getItem(`jardinagem_rdo_${dateStr}`);
      if (localData) {
        try { parsed = JSON.parse(localData); } catch (e) {}
      }
    }
    
    if (parsed) {
      const normRows = (rows: any[]) => (rows || []).map(r => {
        const { berma, elevado } = splitBermaElevado(r.berma, r.elevado);
        return {
          ...r, 
          value: r.value ? maskNumber(r.value, false) : '',
          berma,
          elevado,
          observacao: r.observacao || ''
        };
      });
      setRocagem(normRows(parsed.rocagem || [{ faixa: '', berma: '', elevado: '', value: '' }]));
      setRocagemAsp(normRows(parsed.rocagemAsp || [{ faixa: '', berma: '', elevado: '', value: '' }]));
      setPodagem(normRows(parsed.podagem || [{ faixa: '', berma: '', elevado: '', value: '' }]));
      setCova(normRows(parsed.cova || [{ faixa: '', berma: '', elevado: '', value: '' }]));
      setCoroamento(normRows(parsed.coroamento || [{ faixa: '', berma: '', elevado: '', value: '' }]));
      setAdubagem(normRows(parsed.adubagem || [{ faixa: '', berma: '', elevado: '', value: '' }]));
      setPlantio(normRows(parsed.plantio || [{ faixa: '', berma: '', elevado: '', value: '', especie: '' }]));
      setLimpezaManual(normRows(parsed.limpezaManual || [{ faixa: '', berma: '', elevado: '', value: '', observacao: '' }]));
      setCapinaManual(normRows(parsed.capinaManual || [{ faixa: '', berma: '', elevado: '', value: '' }]));
      setLimpezaSoprador(normRows(parsed.limpezaSoprador || [{ faixa: '', berma: '', elevado: '', value: '' }]));
      setInvasoras(normRows(parsed.invasoras || [{ faixa: '', berma: '', elevado: '', value: '', nome: '' }]));
      setRetiradaMudas(normRows(parsed.retiradaMudas || [{ faixa: '', berma: '', elevado: '', value: '' }]));
      setPlantioGrama(normRows(parsed.plantioGrama || [{ faixa: '', berma: '', elevado: '', value: '' }]));
      setOutrasFaixa(parsed.outrasFaixa !== undefined ? parsed.outrasFaixa : '');
      const { berma: ob, elevado: oe } = splitBermaElevado(parsed.outrasBerma, parsed.outrasElevado);
      setOutrasBerma(ob);
      setOutrasElevado(oe);
      setOutrasDesc(parsed.outrasDesc !== undefined ? parsed.outrasDesc : '');
      setCanteiroDesc(parsed.canteiroDesc !== undefined ? parsed.canteiroDesc : '');
      setIrrigacaoPipas(parsed.irrigacaoPipas || false);
      setIrrigacaoApoioPipa(parsed.irrigacaoApoioPipa || false);
      setIrrigacaoCarretel(parsed.irrigacaoCarretel || false);
      setManutencaoIrrigacao(parsed.manutencaoIrrigacao || false);
      setIrrigacaoCarretelBermas(parsed.irrigacaoCarretelBermas || { 1: [], 2: [], 3: [], 4: [], 5: [] });
      setIsLocked(parsed.isLocked !== false);
      setShowHistory(false);
    } else {
      setRocagem([{ faixa: '', berma: '', elevado: '', value: '' }]);
      setRocagemAsp([{ faixa: '', berma: '', elevado: '', value: '' }]);
      setPodagem([{ faixa: '', berma: '', elevado: '', value: '' }]);
      setCova([{ faixa: '', berma: '', elevado: '', value: '' }]);
      setCoroamento([{ faixa: '', berma: '', elevado: '', value: '' }]);
      setAdubagem([{ faixa: '', berma: '', elevado: '', value: '' }]);
      setPlantio([{ faixa: '', berma: '', elevado: '', value: '', especie: '' }]);
      setLimpezaManual([{ faixa: '', berma: '', elevado: '', value: '', observacao: '' }]);
      setCapinaManual([{ faixa: '', berma: '', elevado: '', value: '' }]);
      setLimpezaSoprador([{ faixa: '', berma: '', elevado: '', value: '' }]);
      setInvasoras([{ faixa: '', berma: '', elevado: '', value: '', nome: '' }]);
      setRetiradaMudas([{ faixa: '', berma: '', elevado: '', value: '' }]);
      setPlantioGrama([{ faixa: '', berma: '', elevado: '', value: '' }]);
      setOutrasFaixa('');
      setOutrasBerma('');
      setOutrasElevado('');
      setOutrasDesc('');
      setCanteiroDesc('');
      setIrrigacaoPipas(false);
      setIrrigacaoApoioPipa(false);
      setIrrigacaoCarretel(false);
      setManutencaoIrrigacao(false);
      setIrrigacaoCarretelBermas({ 1: [], 2: [], 3: [], 4: [], 5: [] });
      setIsLocked(false);
      setShowHistory(false);
    }
  }

  const handleCopy = () => {
    if (previewRef.current) {
      const text = extractCopyableText(previewRef.current);
      navigator.clipboard.writeText(text).then(() => {
        toast.success('Resumo copiado para a área de transferência!');
      }).catch(err => {
        console.error('Falha ao copiar: ', err);
        toast.error('Erro ao copiar texto.');
      });
    }
  }

  const handleWhatsApp = () => {
    if (previewRef.current) {
      const text = extractCopyableText(previewRef.current);
      const encodedText = encodeURIComponent(text);
      window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
    }
  }

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  const formatLongDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    const date = new Date(parseInt(y), parseInt(m)-1, parseInt(d));
    const weekDays = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    return `${d}/${m}/${y.slice(-2)} (${weekDays[date.getDay()]})`;
  }
  
  const carretelFaixas = [1, 2, 3, 4, 5];
  const evenBermas = Array.from({length: 15}, (_, i) => 28 + i * 2);

  const toggleCarretelBerma = (faixa: number, berma: number) => {
    setIrrigacaoCarretelBermas(prev => {
      const current = prev[faixa];
      if (current.includes(berma)) {
        return { ...prev, [faixa]: current.filter(b => b !== berma) };
      } else {
        return { ...prev, [faixa]: [...current, berma].sort((a,b) => a - b) };
      }
    });
  }

  // Helper to check if row is empty
  const isFilled = (arr: any[]) => arr.some(r => parseNumber(r.value) > 0);

  const hasAnyData = 
    isFilled(rocagem) || isFilled(rocagemAsp) || isFilled(podagem) || 
    isFilled(cova) || isFilled(coroamento) || isFilled(adubagem) || 
    isFilled(plantio) || isFilled(limpezaManual) || isFilled(capinaManual) || isFilled(limpezaSoprador) || 
    isFilled(invasoras) || isFilled(retiradaMudas) || isFilled(plantioGrama) || 
    outrasDesc.trim() !== '' || canteiroDesc.trim() !== '' || irrigacaoPipas || irrigacaoApoioPipa || irrigacaoCarretel || manutencaoIrrigacao;

  const formatLocList = (faixa?: string, rawBerma?: string, rawElevado?: string) => {
    const { berma, elevado } = splitBermaElevado(rawBerma, rawElevado);
    const loc: string[] = [];
    if (faixa) loc.push(faixa);
    if (berma) loc.push(berma);
    if (elevado) loc.push(elevado);
    return loc.length > 0 ? ` (${loc.join(', ')})` : '';
  };

  const renderRows = (name: string, data: any[], unit: string) => {
    return data.filter(r => parseNumber(r.value || '0') > 0).map((r, idx) => {
      const locStr = formatLocList(r.faixa, r.berma, r.elevado);
      const cleanVal = String(r.value || '').replace(/,00$/, '');
      const obsStr = r.observacao && String(r.observacao).trim() ? ` - Obs: ${String(r.observacao).trim()}` : '';
      return <div key={`${name}-${idx}`}>- {name}: {cleanVal} {unit}{locStr}{obsStr}</div>
    });
  }

  const renderPlantio = () => {
    return plantio.filter(r => parseNumber(r.value || '0') > 0).map((r, idx) => {
      const locStr = formatLocList(r.faixa, r.berma, r.elevado);
      const esp = r.especie ? ` (${r.especie})` : '';
      return <div key={`plantio-${idx}`}>- Plantio{esp}: {r.value} unid{locStr}</div>
    });
  }

  const renderInvasoras = () => {
    return invasoras.filter(r => parseNumber(r.value || '0') > 0).map((r, idx) => {
      const locStr = formatLocList(r.faixa, r.berma, r.elevado);
      const esp = r.nome ? ` (${r.nome})` : '';
      return <div key={`invasoras-${idx}`}>- Controle de Invasoras{esp}: {r.value} unid{locStr}</div>
    });
  }

  const renderTextActivity = (name: string, desc: string, faixa: string, berma: string, elevado = '') => {
    if (!desc.trim()) return null;
    const locStr = formatLocList(faixa, berma, elevado);
    return <div>- {name}: {desc}{locStr}</div>
  }

  const renderCarretelPreview = () => {
    if (!irrigacaoCarretel) return null;
    
    const lines: React.ReactNode[] = [];
    let hasSelections = false;
    
    carretelFaixas.forEach(f => {
      const bermas = irrigacaoCarretelBermas[f];
      if (bermas.length > 0) {
        hasSelections = true;
        lines.push(
          <div key={`carretel-${f}`}>
            - Irrigação com Carretel (Faixa {f}, Bermas {bermas.join(', ')})
          </div>
        );
      }
    });
    
    if (!hasSelections) {
      return <div key="carretel">- Irrigação com Carretel</div>;
    }
    
    return lines;
  }

  return (
    <div className="min-h-screen bg-[#f4f3f0] text-gray-900 pb-24">
      {/* Header */}
      <div className="px-4 sm:px-8 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 p-2.5 rounded-full border border-green-200 shadow-sm">
            <Leaf className="text-green-600" size={24} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl tracking-tight font-bold text-gray-900">Atividades - Jardinagem</h1>
            <p className="text-gray-500 text-sm">{formatLongDate(selectedDate)}</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mt-6">
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm text-gray-700">
                <CalendarIcon size={16} className="text-gray-500" /> {formatDateDisplay(selectedDate)}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={new Date(selectedDate + 'T12:00:00')}
                onSelect={(date) => { 
                  if(date) {
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const d = String(date.getDate()).padStart(2, '0');
                    loadDate(`${y}-${m}-${d}`);
                  }
                }}
                modifiers={{
                  hasSaved: savedDates.map(d => new Date(d + 'T12:00:00'))
                }}
                modifiersClassNames={{
                  hasSaved: "bg-green-500 text-white font-bold hover:bg-green-600 hover:text-white focus:bg-green-600 focus:text-white"
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <button onClick={() => setShowHistory(true)} className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm">
            <History size={16} className="text-gray-500" /> Histórico
          </button>
          {isLocked ? (
            <button onClick={handleUnlock} className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-yellow-100 transition-colors shadow-sm text-yellow-700">
              <Lock size={16} className="text-yellow-600" /> Desbloquear
            </button>
          ) : (
            <button onClick={handleSave} className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm text-gray-700">
              <Save size={16} className="text-gray-500" /> Salvar
            </button>
          )}
          <button onClick={handleWhatsApp} className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm">
            <Phone size={16} className="text-green-600" /> WhatsApp
          </button>
          <button onClick={handleCopy} className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm">
            <Copy size={16} className="text-gray-500" /> Copiar
          </button>
        </div>

        {/* Abas de Navegação */}
        <div className="flex items-center gap-2 mt-5 p-1.5 bg-white/90 backdrop-blur-sm rounded-2xl w-fit max-w-full overflow-x-auto shadow-sm border border-gray-200">
          <button
            onClick={() => setActiveMainTab('diario')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200 cursor-pointer ${
              activeMainTab === 'diario'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Leaf size={16} className={activeMainTab === 'diario' ? 'text-white' : 'text-emerald-600'} />
            <span>Registro Diário (RDO)</span>
          </button>
          <button
            onClick={() => {
              setHistoricoInitialActivity('todas');
              setActiveMainTab('historico_rocagem');
            }}
            className={`flex flex-wrap items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200 cursor-pointer ${
              activeMainTab === 'historico_rocagem'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Layers size={16} className={activeMainTab === 'historico_rocagem' ? 'text-white' : 'text-emerald-600'} />
            <span>Histórico (Ciclos 16-15)</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold transition-colors ${
                activeMainTab === 'historico_rocagem'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-100 text-emerald-800'
              }`} title="Total de Roçagem no ciclo">
                Roçagem: {formatM2(rocagemPeriodInfo.totalM2)} m²
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold transition-colors ${
                activeMainTab === 'historico_rocagem'
                  ? 'bg-white/20 text-white'
                  : 'bg-teal-100 text-teal-800'
              }`} title="Total de Limpeza Manual no ciclo">
                L. Manual: {formatM2(limpezaManualPeriodInfo.totalM2)} m²
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold transition-colors ${
                activeMainTab === 'historico_rocagem'
                  ? 'bg-white/20 text-white'
                  : 'bg-lime-100 text-lime-800'
              }`} title="Total de Capina Manual no ciclo">
                Capina M.: {formatM2(capinaManualPeriodInfo.totalM2)} m²
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold transition-colors ${
                activeMainTab === 'historico_rocagem'
                  ? 'bg-white/20 text-white'
                  : 'bg-sky-100 text-sky-800'
              }`} title="Total de Limpeza com Soprador no ciclo">
                Soprador: {formatM2(limpezaSopradorPeriodInfo.totalM2)} m²
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-extrabold transition-colors ${
                activeMainTab === 'historico_rocagem'
                  ? 'bg-amber-300 text-amber-950'
                  : 'bg-amber-100 text-amber-900 border border-amber-300/80'
              }`} title="Total somado (Roçagem + Limpeza Manual + Capina Manual + Soprador)">
                Total: {formatM2(sumActivitiesTotals({
                  rocagem: rocagemPeriodInfo.totalM2,
                  limpeza_manual: limpezaManualPeriodInfo.totalM2,
                  capina_manual: capinaManualPeriodInfo.totalM2,
                  limpeza_soprador: limpezaSopradorPeriodInfo.totalM2
                }))} m²
              </span>
            </div>
          </button>
        </div>
      </div>

      {activeMainTab === 'historico_rocagem' ? (
        <div className="px-4 sm:px-8 mt-2">
          <HistoricoRocagemTab
            allRecords={allJardinagemRecords}
            initialActivity={historicoInitialActivity}
            referenceDate={selectedDate}
            loading={loadingRocagem}
            onSelectDate={(date) => {
              loadDate(date);
              setActiveMainTab('diario');
            }}
            onRefresh={refreshRocagemRecords}
          />
        </div>
      ) : (
        <div className="px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
        
        {/* Left Column - Form */}
        <fieldset disabled={isLocked} className="min-w-0 p-0 m-0 border-none group">
          <div className={`bg-[#faf9f6] border border-yellow-500/20 rounded-3xl p-5 sm:p-8 flex flex-col gap-4 relative overflow-hidden shadow-sm transition-all duration-300 ${isLocked ? 'opacity-80 pointer-events-none' : ''}`}>
          {/* Subtle gradient background */}
          <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-yellow-100/50 to-transparent pointer-events-none" />

          <div className="flex items-center gap-2 mb-2 relative z-10">
            <Leaf className="text-green-600" size={20} />
            <h2 className="text-xl font-bold text-gray-900">Relatório de Atividades</h2>
          </div>
          <p className="text-gray-600 text-sm mb-4 relative z-10 max-w-lg">
            Preencha os dados das atividades de jardinagem do dia. Estes dados serão enviados automaticamente para o RDO.
          </p>

          <div className="flex flex-col gap-4 relative z-10">
            <ActivityRow 
              title="ROÇAGEM (m²)" 
              data={rocagem} 
              setData={setRocagem}
              extraHeader={
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 border border-emerald-200/90 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-xs mt-0.5 sm:mt-0 shrink-0">
                      <TrendingUp size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-900 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200">
                          Período Contratual: {rocagemPeriodInfo.cycle.label}
                        </span>
                        <span className="text-xs text-emerald-700 font-medium">
                          (dia 16 ao dia 15)
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                        <span className="text-xs text-gray-600">Total acumulado no período:</span>
                        <span className="text-lg font-black text-emerald-950 tracking-tight">
                          {formatM2(rocagemPeriodInfo.totalM2)} m²
                        </span>
                        {rocagemPeriodInfo.currentDayM2 > 0 && (
                          <span className="text-xs text-emerald-800 font-bold bg-white/90 px-2 py-0.5 rounded-md border border-emerald-300 shadow-2xs">
                            +{formatM2(rocagemPeriodInfo.currentDayM2)} m² hoje
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setHistoricoInitialActivity('rocagem');
                      setActiveMainTab('historico_rocagem');
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-white hover:bg-emerald-100/70 px-3 py-2 rounded-lg border border-emerald-300 transition-colors shadow-2xs cursor-pointer"
                  >
                    <span>Ver Histórico por Faixa/Berma</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              }
            />
            <ActivityRow title="ROÇAGEM ASPERSORES (Unidades)" data={rocagemAsp} setData={setRocagemAsp} />
            <ActivityRow title="PODAGEM (Unidade)" data={podagem} setData={setPodagem} />
            <ActivityRow title="COVA (Unidade)" data={cova} setData={setCova} />
            <ActivityRow title="COROAMENTO (Unidade)" data={coroamento} setData={setCoroamento} />
            <ActivityRow title="ADUBAGEM (Unidade)" data={adubagem} setData={setAdubagem} />
            
            {/* PLANTIO (Especial com Espécie) */}
            <div className="p-4 sm:p-5 bg-white border border-gray-200 rounded-2xl flex flex-col gap-4 shadow-sm">
              <div className="flex justify-between items-center">
                <h3 className="uppercase text-[11px] tracking-wider font-bold text-gray-800">PLANTIO (Unidade)</h3>
                <button type="button" onClick={() => setPlantio([...plantio, {especie: '', value: '0', faixa: '', berma: '', elevado: ''}])} className="text-gray-500 hover:text-gray-900 p-1 rounded-md hover:bg-gray-100 transition-colors cursor-pointer"><Plus size={18} /></button>
              </div>
              {plantio.map((row, idx) => (
                <div key={idx} className="flex flex-col gap-2.5 p-3 rounded-xl bg-gray-50/70 border border-gray-200/80">
                  <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                    <div className="relative flex-1">
                      <select
                        value={row.especie}
                        onChange={(e) => {
                          const newData = [...plantio];
                          newData[idx] = { ...newData[idx], especie: e.target.value };
                          setPlantio(newData);
                        }}
                        className="w-full bg-white border border-gray-300 rounded-xl p-3 pr-7 text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 appearance-none cursor-pointer"
                      >
                        <option value="">Espécie</option>
                        <option value="Ipê">Ipê</option>
                        <option value="Quaresmeira">Quaresmeira</option>
                        <option value="Grama">Grama</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#5f6472] dark:text-gray-400 text-xs">▼</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" inputMode="numeric" value={row.value}
                        onChange={(e) => { const n = [...plantio]; n[idx] = { ...n[idx], value: maskNumber(e.target.value, false) }; setPlantio(n); }}
                        className="flex-1 sm:w-24 bg-white border border-gray-300 rounded-xl p-3 text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                        placeholder="0"
                      />
                      {plantio.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setPlantio(plantio.filter((_, i) => i !== idx))}
                          title="Remover linha"
                          className="text-gray-400 hover:text-red-500 p-2.5 rounded-xl hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div className="relative col-span-2 sm:col-span-1">
                      <select aria-label="Faixa" value={row.faixa || ''} onChange={(e) => { const n = [...plantio]; n[idx] = { ...n[idx], faixa: e.target.value }; setPlantio(n); }} className="w-full bg-white border border-gray-300 rounded-xl p-3 pr-7 text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 appearance-none cursor-pointer">
                        <option value="">Faixa</option>{faixas.map(f => <option key={f} value={`Faixa ${f}`}>Faixa {f}</option>)}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#5f6472] dark:text-gray-400 text-xs">▼</div>
                    </div>
                    <div className="relative">
                      <select aria-label="Berma" value={row.berma || ''} onChange={(e) => { const n = [...plantio]; n[idx] = { ...n[idx], berma: e.target.value }; setPlantio(n); }} className="w-full bg-white border border-gray-300 rounded-xl p-3 pr-7 text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 appearance-none cursor-pointer">
                        <option value="">Berma</option>{BERMAS_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#5f6472] dark:text-gray-400 text-xs">▼</div>
                    </div>
                    <div className="relative">
                      <select aria-label="Elevado" value={row.elevado || ''} onChange={(e) => { const n = [...plantio]; n[idx] = { ...n[idx], elevado: e.target.value }; setPlantio(n); }} className="w-full bg-white border border-gray-300 rounded-xl p-3 pr-7 text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 appearance-none cursor-pointer">
                        <option value="">Elevado</option>{ELEVADOS_OPTIONS.map(el => <option key={el} value={el}>{el}</option>)}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#5f6472] dark:text-gray-400 text-xs">▼</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <ActivityRow 
              title="LIMPEZA MANUAL (m²)" 
              data={limpezaManual} 
              setData={setLimpezaManual}
              allowObservacao={true}
              extraHeader={
                <div className="bg-gradient-to-r from-teal-50 via-emerald-50 to-green-50 border border-teal-200/90 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-teal-600 text-white rounded-lg shadow-xs mt-0.5 sm:mt-0 shrink-0">
                      <TrendingUp size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold tracking-wider uppercase text-teal-900 bg-teal-100/80 px-2 py-0.5 rounded-md border border-teal-200">
                          Período Contratual: {limpezaManualPeriodInfo.cycle.label}
                        </span>
                        <span className="text-xs text-teal-700 font-medium">
                          (dia 16 ao dia 15)
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                        <span className="text-xs text-gray-600">Total acumulado no período:</span>
                        <span className="text-lg font-black text-teal-950 tracking-tight">
                          {formatM2(limpezaManualPeriodInfo.totalM2)} m²
                        </span>
                        {limpezaManualPeriodInfo.currentDayM2 > 0 && (
                          <span className="text-xs text-teal-800 font-bold bg-white/90 px-2 py-0.5 rounded-md border border-teal-300 shadow-2xs">
                            +{formatM2(limpezaManualPeriodInfo.currentDayM2)} m² hoje
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setHistoricoInitialActivity('limpeza_manual');
                      setActiveMainTab('historico_rocagem');
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs font-bold text-teal-800 hover:text-teal-950 bg-white hover:bg-teal-100/70 px-3 py-2 rounded-lg border border-teal-300 transition-colors shadow-2xs cursor-pointer"
                  >
                    <span>Ver Histórico por Faixa/Berma</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              }
            />
            <ActivityRow 
              title="CAPINA MANUAL (m²)" 
              data={capinaManual} 
              setData={setCapinaManual}
              extraHeader={
                <div className="bg-gradient-to-r from-lime-50 via-green-50 to-emerald-50 border border-lime-200/90 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-lime-600 text-white rounded-lg shadow-xs mt-0.5 sm:mt-0 shrink-0">
                      <TrendingUp size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold tracking-wider uppercase text-lime-900 bg-lime-100/80 px-2 py-0.5 rounded-md border border-lime-200">
                          Período Contratual: {capinaManualPeriodInfo.cycle.label}
                        </span>
                        <span className="text-xs text-lime-700 font-medium">
                          (dia 16 ao dia 15)
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                        <span className="text-xs text-gray-600">Total acumulado no período:</span>
                        <span className="text-lg font-black text-lime-950 tracking-tight">
                          {formatM2(capinaManualPeriodInfo.totalM2)} m²
                        </span>
                        {capinaManualPeriodInfo.currentDayM2 > 0 && (
                          <span className="text-xs text-lime-800 font-bold bg-white/90 px-2 py-0.5 rounded-md border border-lime-300 shadow-2xs">
                            +{formatM2(capinaManualPeriodInfo.currentDayM2)} m² hoje
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setHistoricoInitialActivity('capina_manual');
                      setActiveMainTab('historico_rocagem');
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs font-bold text-lime-800 hover:text-lime-950 bg-white hover:bg-lime-100/70 px-3 py-2 rounded-lg border border-lime-300 transition-colors shadow-2xs cursor-pointer"
                  >
                    <span>Ver Histórico por Faixa/Berma</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              }
            />
            <ActivityRow 
              title="LIMPEZA COM SOPRADOR (m²)" 
              data={limpezaSoprador} 
              setData={setLimpezaSoprador}
              extraHeader={
                <div className="bg-gradient-to-r from-sky-50 via-cyan-50 to-blue-50 border border-sky-200/90 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-sky-600 text-white rounded-lg shadow-xs mt-0.5 sm:mt-0 shrink-0">
                      <TrendingUp size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold tracking-wider uppercase text-sky-900 bg-sky-100/80 px-2 py-0.5 rounded-md border border-sky-200">
                          Período Contratual: {limpezaSopradorPeriodInfo.cycle.label}
                        </span>
                        <span className="text-xs text-sky-700 font-medium">
                          (dia 16 ao dia 15)
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                        <span className="text-xs text-gray-600">Total acumulado no período:</span>
                        <span className="text-lg font-black text-sky-950 tracking-tight">
                          {formatM2(limpezaSopradorPeriodInfo.totalM2)} m²
                        </span>
                        {limpezaSopradorPeriodInfo.currentDayM2 > 0 && (
                          <span className="text-xs text-sky-800 font-bold bg-white/90 px-2 py-0.5 rounded-md border border-sky-300 shadow-2xs">
                            +{formatM2(limpezaSopradorPeriodInfo.currentDayM2)} m² hoje
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setHistoricoInitialActivity('limpeza_soprador');
                      setActiveMainTab('historico_rocagem');
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs font-bold text-sky-800 hover:text-sky-950 bg-white hover:bg-sky-100/70 px-3 py-2 rounded-lg border border-sky-300 transition-colors shadow-2xs cursor-pointer"
                  >
                    <span>Ver Histórico por Faixa/Berma</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              }
            />

            {/* CONTROLE DE INVASORAS */}
            <div className="p-4 sm:p-5 bg-white border border-gray-200 rounded-2xl flex flex-col gap-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Leaf className="text-green-600" size={18} />
                  <h3 className="uppercase text-[13px] tracking-wider font-bold text-gray-900">CONTROLE DE INVASORAS</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-sm">Faixa:</span>
                  <div className="relative w-32">
                    <select value={invasoras[0]?.faixa || ''} onChange={(e) => { const v = e.target.value; setInvasoras(invasoras.map(item => ({ ...item, faixa: v }))); }} className="w-full bg-white border border-gray-300 rounded-xl p-2 pr-7 text-gray-900 appearance-none text-sm outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500">
                      <option value="">Faixa</option>{faixas.map(f => <option key={f} value={`Faixa ${f}`}>Faixa {f}</option>)}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#5f6472] dark:text-gray-400 text-xs">▼</div>
                  </div>
                  <button type="button" onClick={() => setInvasoras([...invasoras, {nome: '', value: '0', berma: '', elevado: '', faixa: invasoras[0]?.faixa || ''}])} className="flex items-center gap-1 bg-white border border-gray-300 px-3 py-2 rounded-xl text-sm hover:bg-gray-50 transition-colors whitespace-nowrap text-gray-700 font-medium cursor-pointer">
                    <Plus size={14} /> Adicionar mais
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {invasoras.map((row, idx) => (
                  <div key={idx} className="flex flex-col gap-2.5 p-3 rounded-xl bg-gray-50/70 border border-gray-200/80">
                    <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-end">
                      <div className="flex-1 flex flex-col gap-1">
                        {idx === 0 && <label className="text-gray-500 text-xs ml-1">Nome da Invasora</label>}
                        <div className="relative">
                          <select value={row.nome} onChange={(e) => { const n = [...invasoras]; n[idx] = { ...n[idx], nome: e.target.value }; setInvasoras(n); }} className="w-full bg-white border border-gray-300 rounded-xl p-3 pr-7 text-gray-900 appearance-none outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 cursor-pointer">
                            <option value="">Selecione a invasora</option>
                            <option value="Acácia">Acácia</option>
                            <option value="Crotalária">Crotalária</option>
                            <option value="Erva Daninha">Erva Daninha</option>
                            <option value="Erva-de-passarinho">Erva-de-passarinho</option>
                            <option value="Juqueri">Juqueri</option>
                            <option value="Leucena">Leucena</option>
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#5f6472] dark:text-gray-400 text-xs">▼</div>
                        </div>
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1 sm:w-28 flex flex-col gap-1">
                          {idx === 0 && <label className="text-gray-500 text-xs ml-1">Unidade</label>}
                          <input type="text" inputMode="numeric" value={row.value} onChange={(e) => { const n = [...invasoras]; n[idx] = { ...n[idx], value: maskNumber(e.target.value, false) }; setInvasoras(n); }} className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500" placeholder="0" />
                        </div>
                        {invasoras.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setInvasoras(invasoras.filter((_, i) => i !== idx))}
                            title="Remover linha"
                            className="text-gray-400 hover:text-red-500 p-2.5 rounded-xl hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="flex flex-col gap-1">
                        {idx === 0 && <label className="text-gray-500 text-xs ml-1">Berma</label>}
                        <div className="relative">
                          <select aria-label="Berma" value={row.berma || ''} onChange={(e) => { const n = [...invasoras]; n[idx] = { ...n[idx], berma: e.target.value }; setInvasoras(n); }} className="w-full bg-white border border-gray-300 rounded-xl p-3 pr-7 text-gray-900 appearance-none outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 cursor-pointer">
                            <option value="">Berma</option>{BERMAS_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#5f6472] dark:text-gray-400 text-xs">▼</div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        {idx === 0 && <label className="text-gray-500 text-xs ml-1">Elevado</label>}
                        <div className="relative">
                          <select aria-label="Elevado" value={row.elevado || ''} onChange={(e) => { const n = [...invasoras]; n[idx] = { ...n[idx], elevado: e.target.value }; setInvasoras(n); }} className="w-full bg-white border border-gray-300 rounded-xl p-3 pr-7 text-gray-900 appearance-none outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 cursor-pointer">
                            <option value="">Elevado</option>{ELEVADOS_OPTIONS.map(el => <option key={el} value={el}>{el}</option>)}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#5f6472] dark:text-gray-400 text-xs">▼</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <ActivityRow title="RETIRADA DE MUDAS - ÁRVORES (Unidade)" data={retiradaMudas} setData={setRetiradaMudas} icon={<TreePine className="text-green-600" size={16} />} />
            <ActivityRow title="PLANTIO DE GRAMA (m²)" data={plantioGrama} setData={setPlantioGrama} icon={<Leaf className="text-green-600" size={16} />} containerClassName="border-green-200 bg-green-50/30" />

            {/* OUTRAS ATIVIDADES */}
            <div className="p-4 sm:p-5 bg-white border border-yellow-200 rounded-2xl flex flex-col gap-4 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-yellow-50/50 to-transparent pointer-events-none" />
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 relative z-10">
                <div className="flex items-start gap-2">
                  <PenLine className="text-yellow-600 mt-1" size={18} />
                  <h3 className="uppercase text-[14px] leading-tight tracking-wider font-bold text-yellow-600 w-32">OUTRAS ATIVIDADES<br/><span className="text-[10px] text-yellow-600/70 capitalize">(Preenchimento Manual)</span></h3>
                </div>
                <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                  <div className="grid grid-cols-2 sm:flex gap-2 w-full">
                    <div className="relative col-span-2 sm:w-28">
                      <select aria-label="Faixa" value={outrasFaixa} onChange={e => setOutrasFaixa(e.target.value)} className="w-full bg-white border border-gray-300 rounded-xl p-2.5 pr-7 text-gray-900 appearance-none text-sm outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 cursor-pointer">
                        <option value="">Faixa</option>{faixas.map(f => <option key={f} value={`Faixa ${f}`}>Faixa {f}</option>)}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#5f6472] dark:text-gray-400 text-xs">▼</div>
                    </div>
                    <div className="relative sm:w-32">
                      <select aria-label="Berma" value={outrasBerma} onChange={e => setOutrasBerma(e.target.value)} className="w-full bg-white border border-gray-300 rounded-xl p-2.5 pr-7 text-gray-900 appearance-none text-sm outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 cursor-pointer">
                        <option value="">Berma</option>{BERMAS_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#5f6472] dark:text-gray-400 text-xs">▼</div>
                    </div>
                    <div className="relative sm:w-36">
                      <select aria-label="Elevado" value={outrasElevado} onChange={e => setOutrasElevado(e.target.value)} className="w-full bg-white border border-gray-300 rounded-xl p-2.5 pr-7 text-gray-900 appearance-none text-sm outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 cursor-pointer">
                        <option value="">Elevado</option>{ELEVADOS_OPTIONS.map(el => <option key={el} value={el}>{el}</option>)}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#5f6472] dark:text-gray-400 text-xs">▼</div>
                    </div>
                  </div>
                </div>
              </div>
              <textarea 
                value={outrasDesc} onChange={e => setOutrasDesc(e.target.value)}
                placeholder="Descreva outras atividades realizadas que não estão listadas acima..."
                className="w-full h-24 bg-white border border-gray-300 rounded-xl p-3 text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 resize-none relative z-10 placeholder-gray-400"
              />
              <p className="text-gray-500 text-[11px] relative z-10">Este campo será incluído no resumo do RDO exatamente como preenchido.</p>
            </div>

            {/* MANUTENÇÃO DE CANTEIRO */}
            <div className="p-4 sm:p-5 bg-white border border-gray-200 rounded-2xl flex flex-col gap-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <h3 className="uppercase text-[14px] leading-tight tracking-wider font-bold text-gray-900 w-32">MANUTENÇÃO DE CANTEIRO</h3>
              </div>
              <textarea 
                value={canteiroDesc} onChange={e => setCanteiroDesc(e.target.value)}
                placeholder="Descreva as atividades de manutenção de canteiro..."
                className="w-full h-24 bg-white border border-gray-300 rounded-xl p-3 text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 resize-none placeholder-gray-400"
              />
            </div>

            {/* IRRIGAÇÃO */}
            <div className="p-4 sm:p-5 bg-blue-50/50 border border-blue-200 rounded-2xl flex flex-col gap-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Droplets className="text-blue-600" size={20} />
                <h3 className="uppercase text-[14px] tracking-wider font-bold text-blue-600">IRRIGAÇÃO</h3>
              </div>
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-3 bg-white p-4 rounded-xl border border-gray-200 cursor-pointer hover:border-blue-300 transition-colors shadow-sm">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${irrigacaoPipas ? 'border-blue-500' : 'border-gray-300'}`}>
                    {irrigacaoPipas && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                  </div>
                  <input type="checkbox" checked={irrigacaoPipas} onChange={e => setIrrigacaoPipas(e.target.checked)} className="hidden" />
                  <span className="font-medium text-gray-900">Irrigação com Pipas nas Faixas 3, 4 e 5 e Mirante</span>
                </label>
                
                <label className="flex items-center gap-3 bg-white p-4 rounded-xl border border-gray-200 cursor-pointer hover:border-blue-300 transition-colors shadow-sm">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${irrigacaoApoioPipa ? 'border-blue-500' : 'border-gray-300'}`}>
                    {irrigacaoApoioPipa && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                  </div>
                  <input type="checkbox" checked={irrigacaoApoioPipa} onChange={e => setIrrigacaoApoioPipa(e.target.checked)} className="hidden" />
                  <span className="font-medium text-gray-900">Apoio com Pipa Sistema de irrigação.</span>
                </label>
                <div className={`flex flex-col bg-white rounded-xl border transition-colors shadow-sm ${irrigacaoCarretel ? 'border-yellow-400' : 'border-gray-200 hover:border-blue-300'}`}>
                  <label className="flex items-center gap-3 p-4 cursor-pointer">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${irrigacaoCarretel ? 'border-yellow-400 bg-yellow-400' : 'border-gray-300'}`}>
                      {irrigacaoCarretel && <span className="text-[#1c1d21] dark:text-white text-[10px] font-bold">✓</span>}
                    </div>
                    <input type="checkbox" checked={irrigacaoCarretel} onChange={e => setIrrigacaoCarretel(e.target.checked)} className="hidden" />
                    <span className="font-medium text-gray-900">Irrigação com Carretel</span>
                  </label>
                  
                  {irrigacaoCarretel && (
                    <div className="p-4 pt-0 border-t border-gray-100 flex flex-col gap-5 mt-2">
                      <div>
                        <p className="text-sm text-gray-600 mb-2 font-medium">Selecione a Faixa:</p>
                        <div className="flex gap-2 flex-wrap">
                          {carretelFaixas.map(f => (
                            <button 
                              key={f}
                              onClick={() => setIrrigacaoCarretelFaixaAtiva(f)}
                              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${irrigacaoCarretelFaixaAtiva === f ? 'bg-yellow-50 text-yellow-700 border-yellow-400' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'} border`}
                            >
                              Faixa {f}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-sm text-gray-600 mb-2 font-medium">Selecione as Bermas (somente pares):</p>
                        <div className="flex flex-wrap gap-2">
                          {evenBermas.map(b => {
                            const isSelected = irrigacaoCarretelBermas[irrigacaoCarretelFaixaAtiva].includes(b);
                            return (
                              <button
                                key={b}
                                onClick={() => toggleCarretelBerma(irrigacaoCarretelFaixaAtiva, b)}
                                className={`w-14 h-10 rounded-xl text-sm font-bold transition-all border ${isSelected ? 'bg-yellow-400 text-black border-yellow-400 shadow-sm' : 'bg-white text-gray-700 border-gray-300 hover:border-yellow-400 hover:bg-yellow-50'}`}
                              >
                                {b}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <label className="flex items-center gap-3 bg-white p-4 rounded-xl border border-gray-200 cursor-pointer hover:border-blue-300 transition-colors shadow-sm">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${manutencaoIrrigacao ? 'border-blue-500' : 'border-gray-300'}`}>
                    {manutencaoIrrigacao && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                  </div>
                  <input type="checkbox" checked={manutencaoIrrigacao} onChange={e => setManutencaoIrrigacao(e.target.checked)} className="hidden" />
                  <span className="font-medium text-gray-900">Manutenção Sistema de Irrigação</span>
                </label>
              </div>
            </div>

          </div>
        </div>
      </fieldset>

        {/* Right Column - Preview */}
        <div className="sticky top-6 bg-white border border-gray-200 rounded-3xl p-5 sm:p-8 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="text-gray-800" size={20} />
            <h2 className="text-xl font-bold text-gray-900">Resumo para RDO</h2>
          </div>
          <p className="text-gray-500 text-sm mb-2">
            Esta prévia mostra como os dados aparecerão no RDO
          </p>

          <div ref={previewRef} className="bg-[#faf9f6] border border-gray-200 p-4 rounded-xl font-mono text-sm text-gray-800 whitespace-pre-wrap flex flex-col gap-2 relative">
            <div className="font-bold text-gray-700 mb-1">Data: {formatDateDisplay(selectedDate)}</div>
            <div className="font-bold text-yellow-600 mb-1 mt-2">🌱 *Atividades Realizadas:*</div>
            
            {!hasAnyData ? (
              <span className="text-[#5f6472] dark:text-gray-400">Nenhuma atividade registrada</span>
            ) : (
              <div className="flex flex-col gap-1">
                {renderRows('Roçagem', rocagem, 'm²')}
                {rocagemPeriodInfo.totalM2 > 0 && (
                  <div data-no-copy="true" className="select-none text-emerald-800 bg-emerald-50/90 px-2.5 py-1.5 rounded-lg border border-emerald-200 text-xs font-semibold flex items-center justify-between my-1">
                    <span>📐 Roçagem no Período ({rocagemPeriodInfo.cycle.startDate.slice(5).replace('-', '/')} a {rocagemPeriodInfo.cycle.endDate.slice(5).replace('-', '/')}):</span>
                    <span className="font-bold text-emerald-950">{formatM2(rocagemPeriodInfo.totalM2)} m²</span>
                  </div>
                )}
                {renderRows('Roçagem Aspersores', rocagemAsp, 'unid')}
                {renderRows('Podagem', podagem, 'unid')}
                {renderRows('Cova', cova, 'unid')}
                {renderRows('Coroamento', coroamento, 'unid')}
                {renderRows('Adubagem', adubagem, 'unid')}
                {renderPlantio()}
                {renderRows('Limpeza Manual', limpezaManual, 'm²')}
                {limpezaManualPeriodInfo.totalM2 > 0 && (
                  <div data-no-copy="true" className="select-none text-teal-800 bg-teal-50/90 px-2.5 py-1.5 rounded-lg border border-teal-200 text-xs font-semibold flex items-center justify-between my-1">
                    <span>🧹 Limp. Manual no Período ({limpezaManualPeriodInfo.cycle.startDate.slice(5).replace('-', '/')} a {limpezaManualPeriodInfo.cycle.endDate.slice(5).replace('-', '/')}):</span>
                    <span className="font-bold text-teal-950">{formatM2(limpezaManualPeriodInfo.totalM2)} m²</span>
                  </div>
                )}
                {renderRows('Capina Manual', capinaManual, 'm²')}
                {capinaManualPeriodInfo.totalM2 > 0 && (
                  <div data-no-copy="true" className="select-none text-lime-800 bg-lime-50/90 px-2.5 py-1.5 rounded-lg border border-lime-200 text-xs font-semibold flex items-center justify-between my-1">
                    <span>🌾 Capina Manual no Período ({capinaManualPeriodInfo.cycle.startDate.slice(5).replace('-', '/')} a {capinaManualPeriodInfo.cycle.endDate.slice(5).replace('-', '/')}):</span>
                    <span className="font-bold text-lime-950">{formatM2(capinaManualPeriodInfo.totalM2)} m²</span>
                  </div>
                )}
                {renderRows('Limpeza com Soprador', limpezaSoprador, 'm²')}
                {limpezaSopradorPeriodInfo.totalM2 > 0 && (
                  <div data-no-copy="true" className="select-none text-sky-800 bg-sky-50/90 px-2.5 py-1.5 rounded-lg border border-sky-200 text-xs font-semibold flex items-center justify-between my-1">
                    <span>💨 Soprador no Período ({limpezaSopradorPeriodInfo.cycle.startDate.slice(5).replace('-', '/')} a {limpezaSopradorPeriodInfo.cycle.endDate.slice(5).replace('-', '/')}):</span>
                    <span className="font-bold text-sky-950">{formatM2(limpezaSopradorPeriodInfo.totalM2)} m²</span>
                  </div>
                )}
                {renderInvasoras()}
                {renderRows('Retirada de Mudas - Árvores', retiradaMudas, 'unid')}
                {renderRows('Plantio de Grama', plantioGrama, 'm²')}
                {renderTextActivity('Outras Atividades', outrasDesc, outrasFaixa, outrasBerma, outrasElevado)}
                {renderTextActivity('Manutenção de Canteiro', canteiroDesc, '', '')}
                {irrigacaoPipas && <div>- Irrigação com Pipas nas Faixas 3, 4 e 5 e Mirante</div>}
                {irrigacaoApoioPipa && <div>- Apoio com Pipa Sistema de irrigação.</div>}
                {renderCarretelPreview()}
                {manutencaoIrrigacao && <div>- Manutenção Sistema de Irrigação</div>}
              </div>
            )}
          </div>

          <div className="mt-2 bg-green-50 border border-green-200 p-4 rounded-xl flex items-start gap-3">
            <Sparkles className="text-green-600 shrink-0 mt-0.5" size={18} />
            <p className="text-green-700 text-sm">
              Os dados preenchidos aqui serão automaticamente incluídos na seção "Jardinagem" do RDO.
            </p>
          </div>


          <div className="flex sm:hidden justify-between items-center gap-4 mt-4">
            {isLocked ? (
              <button onClick={handleUnlock} className="flex-1 justify-center flex items-center gap-2 bg-yellow-50 border border-yellow-200 px-4 py-3 rounded-xl text-sm font-bold hover:bg-yellow-100 transition-colors shadow-sm text-yellow-700">
                <Lock size={18} className="text-yellow-600" /> Desbloquear
              </button>
            ) : (
              <button onClick={handleSave} className="flex-1 justify-center flex items-center gap-2 bg-white border border-gray-200 px-4 py-3 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors shadow-sm text-gray-700">
                <Save size={18} className="text-gray-500" /> Salvar
              </button>
            )}
            <button onClick={handleCopy} className="flex-1 justify-center flex items-center gap-2 bg-white border border-gray-200 px-4 py-3 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors shadow-sm text-gray-700">
              <Copy size={18} className="text-gray-500" /> Copiar
            </button>
          </div>

          <div className="mt-4 flex justify-center">
            <img src="/Trabalhador_jardinagem.png" alt="Trabalhador de Jardinagem" className="w-full max-w-sm rounded-2xl object-cover" />
          </div>
        </div>
      </div>
      )}

      {/* History Modal */}
      {showHistory && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999999] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md my-auto overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <History className="text-yellow-500" size={20} /> Histórico de Relatórios
              </h3>
              <button onClick={() => setShowHistory(false)} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors">✕</button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {savedDates.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nenhum relatório salvo ainda.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {savedDates.map(date => (
                    <button 
                      key={date}
                      onClick={() => loadDate(date)}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-yellow-50 hover:border-yellow-400 transition-all text-left group"
                    >
                      <span className="font-medium text-gray-800">{formatLongDate(date)}</span>
                      <span className="text-sm font-semibold text-yellow-600 opacity-0 group-hover:opacity-100 transition-opacity">Carregar</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
