import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { 
  Leaf, Calendar as CalendarIcon, History, FileText, Save, Copy, Plus, 
  TreePine, PenLine, Sparkles, Droplets, Phone, Lock
} from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/logActivity'

const maskNumber = (val: string, isFloat: boolean) => {
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
const bermas = Array.from({length: 31}, (_, i) => i + 26);

// Generic Row Component
function ActivityRow({ 
  title, 
  data, 
  setData, 
  isFloat = false,
  icon,
  containerClassName = ''
}: { 
  title: string; 
  data: any[]; 
  setData: (data: any) => void;
  isFloat?: boolean;
  icon?: React.ReactNode;
  containerClassName?: string;
}) {
  const addRow = () => setData([...data, {value: isFloat ? '0.00' : '0', faixa: '', berma: ''}]);
  
  return (
    <div className={`p-4 sm:p-5 bg-white border border-gray-200 rounded-2xl flex flex-col gap-4 shadow-sm ${containerClassName}`}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="uppercase text-[11px] tracking-wider font-bold text-gray-800">{title}</h3>
        </div>
        <button onClick={addRow} className="text-gray-500 hover:text-gray-900 transition-colors p-1 rounded-md hover:bg-gray-100">
          <Plus size={18} />
        </button>
      </div>
      {data.map((row, idx) => (
        <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex-1 w-full relative">
            <input 
              type="text"
              inputMode="numeric"
              value={row.value}
              onChange={(e) => {
                const newData = [...data];
                newData[idx].value = maskNumber(e.target.value, isFloat);
                setData(newData);
              }}
              className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors placeholder-gray-400"
              placeholder={isFloat ? "0,00" : "0"}
            />
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-32">
              <select
                value={row.faixa}
                onChange={(e) => {
                  const newData = [...data];
                  newData[idx].faixa = e.target.value;
                  setData(newData);
                }}
                className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors appearance-none cursor-pointer"
              >
                <option value="">Faixa</option>
                {faixas.map(f => <option key={f} value={`Faixa ${f}`}>Faixa {f}</option>)}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
            </div>
            <div className="relative flex-1 sm:w-32">
              <select
                value={row.berma}
                onChange={(e) => {
                  const newData = [...data];
                  newData[idx].berma = e.target.value;
                  setData(newData);
                }}
                className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors appearance-none cursor-pointer"
              >
                <option value="">Berma</option>
                {bermas.map(b => <option key={b} value={`Berma ${b}`}>Berma {b}</option>)}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function JardinagemPage() {
  const [rocagem, setRocagem] = useState([{value: '', faixa: '', berma: ''}]);
  const [rocagemAsp, setRocagemAsp] = useState([{value: '', faixa: '', berma: ''}]);
  const [podagem, setPodagem] = useState([{value: '', faixa: '', berma: ''}]);
  const [cova, setCova] = useState([{value: '', faixa: '', berma: ''}]);
  const [coroamento, setCoroamento] = useState([{value: '', faixa: '', berma: ''}]);
  const [adubagem, setAdubagem] = useState([{value: '', faixa: '', berma: ''}]);
  const [plantio, setPlantio] = useState([{especie: '', value: '', faixa: '', berma: ''}]);
  const [limpezaManual, setLimpezaManual] = useState([{value: '', faixa: '', berma: ''}]);
  const [limpezaSoprador, setLimpezaSoprador] = useState([{value: '', faixa: '', berma: ''}]);
  const [invasoras, setInvasoras] = useState([{nome: '', value: '', berma: '', faixa: ''}]);
  const [retiradaMudas, setRetiradaMudas] = useState([{value: '', faixa: '', berma: ''}]);
  const [plantioGrama, setPlantioGrama] = useState([{value: '', faixa: '', berma: ''}]);
  
  const [outrasFaixa, setOutrasFaixa] = useState('');
  const [outrasBerma, setOutrasBerma] = useState('');
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

  const [showHistory, setShowHistory] = useState(false);
  const [savedDates, setSavedDates] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

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
        remoteDates = data.filter(r => r.value?.isLocked !== false).map(r => r.key.replace('jardinagem_rdo_', ''));
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
  }, []);

  const handleSave = async () => {
    const dataToSave = {
      rocagem, rocagemAsp, podagem, cova, coroamento, adubagem, plantio, limpezaManual, limpezaSoprador, invasoras, retiradaMudas, plantioGrama,
      outrasFaixa, outrasBerma, outrasDesc, canteiroDesc, irrigacaoPipas, irrigacaoApoioPipa, irrigacaoCarretel, irrigacaoCarretelBermas,
      manutencaoIrrigacao,
      isLocked: true
    };
    localStorage.setItem(`jardinagem_rdo_${selectedDate}`, JSON.stringify(dataToSave));
    setIsLocked(true);
    toast.success('Relatório salvo com sucesso para a data ' + formatDateDisplay(selectedDate));
    
    try {
      await supabase.from('global_settings').upsert({
        key: `jardinagem_rdo_${selectedDate}`,
        value: dataToSave,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
      
      await logActivity({
        module: 'RDO',
        action: `Relatório de Jardinagem salvo para ${formatDateDisplay(selectedDate)}`
      });
    } catch (e) {}
    
    updateSavedDates();
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
      setRocagem(parsed.rocagem || [{ faixa: '', berma: '', value: '' }]);
      setRocagemAsp(parsed.rocagemAsp || [{ faixa: '', berma: '', value: '' }]);
      setPodagem(parsed.podagem || [{ faixa: '', berma: '', value: '' }]);
      setCova(parsed.cova || [{ faixa: '', berma: '', value: '' }]);
      setCoroamento(parsed.coroamento || [{ faixa: '', berma: '', value: '' }]);
      setAdubagem(parsed.adubagem || [{ faixa: '', berma: '', value: '' }]);
      setPlantio(parsed.plantio || [{ faixa: '', berma: '', value: '', especie: '' }]);
      setLimpezaManual(parsed.limpezaManual || [{ faixa: '', berma: '', value: '' }]);
      setLimpezaSoprador(parsed.limpezaSoprador || [{ faixa: '', berma: '', value: '' }]);
      setInvasoras(parsed.invasoras || [{ faixa: '', berma: '', value: '', nome: '' }]);
      setRetiradaMudas(parsed.retiradaMudas || [{ faixa: '', berma: '', value: '' }]);
      setPlantioGrama(parsed.plantioGrama || [{ faixa: '', berma: '', value: '' }]);
      setOutrasFaixa(parsed.outrasFaixa !== undefined ? parsed.outrasFaixa : '');
      setOutrasBerma(parsed.outrasBerma !== undefined ? parsed.outrasBerma : '');
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
      setRocagem([{ faixa: '', berma: '', value: '' }]);
      setRocagemAsp([{ faixa: '', berma: '', value: '' }]);
      setPodagem([{ faixa: '', berma: '', value: '' }]);
      setCova([{ faixa: '', berma: '', value: '' }]);
      setCoroamento([{ faixa: '', berma: '', value: '' }]);
      setAdubagem([{ faixa: '', berma: '', value: '' }]);
      setPlantio([{ faixa: '', berma: '', value: '', especie: '' }]);
      setLimpezaManual([{ faixa: '', berma: '', value: '' }]);
      setLimpezaSoprador([{ faixa: '', berma: '', value: '' }]);
      setInvasoras([{ faixa: '', berma: '', value: '', nome: '' }]);
      setRetiradaMudas([{ faixa: '', berma: '', value: '' }]);
      setPlantioGrama([{ faixa: '', berma: '', value: '' }]);
      setOutrasFaixa('');
      setOutrasBerma('');
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
      navigator.clipboard.writeText(previewRef.current.innerText).then(() => {
        toast.success('Resumo copiado para a área de transferência!');
      }).catch(err => {
        console.error('Falha ao copiar: ', err);
        toast.error('Erro ao copiar texto.');
      });
    }
  }

  const handleWhatsApp = () => {
    if (previewRef.current) {
      const text = previewRef.current.innerText;
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
    isFilled(plantio) || isFilled(limpezaManual) || isFilled(limpezaSoprador) || 
    isFilled(invasoras) || isFilled(retiradaMudas) || isFilled(plantioGrama) || 
    outrasDesc.trim() !== '' || canteiroDesc.trim() !== '' || irrigacaoPipas || irrigacaoApoioPipa || irrigacaoCarretel || manutencaoIrrigacao;

  const renderRows = (name: string, data: any[], unit: string) => {
    return data.filter(r => parseFloat(r.value || '0') > 0).map((r, idx) => {
      let loc = [];
      if (r.faixa) loc.push(r.faixa);
      if (r.berma) loc.push(r.berma);
      const locStr = loc.length > 0 ? ` (${loc.join(', ')})` : '';
      return <div key={`${name}-${idx}`}>- {name}: {r.value} {unit}{locStr}</div>
    });
  }

  const renderPlantio = () => {
    return plantio.filter(r => parseFloat(r.value || '0') > 0).map((r, idx) => {
      let loc = [];
      if (r.faixa) loc.push(r.faixa);
      if (r.berma) loc.push(r.berma);
      const locStr = loc.length > 0 ? ` (${loc.join(', ')})` : '';
      const esp = r.especie ? ` (${r.especie})` : '';
      return <div key={`plantio-${idx}`}>- Plantio{esp}: {r.value} unid{locStr}</div>
    });
  }

  const renderInvasoras = () => {
    return invasoras.filter(r => parseFloat(r.value || '0') > 0).map((r, idx) => {
      let loc = [];
      if (r.faixa) loc.push(r.faixa);
      if (r.berma) loc.push(r.berma);
      const locStr = loc.length > 0 ? ` (${loc.join(', ')})` : '';
      const esp = r.nome ? ` (${r.nome})` : '';
      return <div key={`invasoras-${idx}`}>- Controle de Invasoras{esp}: {r.value} unid{locStr}</div>
    });
  }

  const renderTextActivity = (name: string, desc: string, faixa: string, berma: string) => {
    if (!desc.trim()) return null;
    let loc = [];
    if (faixa) loc.push(faixa);
    if (berma) loc.push(berma);
    const locStr = loc.length > 0 ? ` (${loc.join(', ')})` : '';
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
            <h1 className="text-2xl sm:text-3xl font-display italic tracking-tight font-bold text-gray-900">Atividades - Jardinagem</h1>
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
      </div>

      <div className="px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
        
        {/* Left Column - Form */}
        <fieldset disabled={isLocked} className="min-w-0 p-0 m-0 border-none group">
          <div className={`bg-[#faf9f6] border border-yellow-500/20 rounded-3xl p-5 sm:p-8 flex flex-col gap-4 relative overflow-hidden shadow-sm transition-all duration-300 ${isLocked ? 'opacity-80 pointer-events-none' : ''}`}>
          {/* Subtle gradient background */}
          <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-yellow-100/50 to-transparent pointer-events-none" />

          <div className="flex items-center gap-2 mb-2 relative z-10">
            <Leaf className="text-green-600" size={20} />
            <h2 className="text-xl font-display font-bold italic text-gray-900">Relatório de Atividades</h2>
          </div>
          <p className="text-gray-600 text-sm mb-4 relative z-10 max-w-lg">
            Preencha os dados das atividades de jardinagem do dia. Estes dados serão enviados automaticamente para o RDO.
          </p>

          <div className="flex flex-col gap-4 relative z-10">
            <ActivityRow title="ROÇAGEM (m²)" data={rocagem} setData={setRocagem} isFloat />
            <ActivityRow title="ROÇAGEM ASPERSORES (Unidades)" data={rocagemAsp} setData={setRocagemAsp} />
            <ActivityRow title="PODAGEM (Unidade)" data={podagem} setData={setPodagem} />
            <ActivityRow title="COVA (Unidade)" data={cova} setData={setCova} />
            <ActivityRow title="COROAMENTO (Unidade)" data={coroamento} setData={setCoroamento} />
            <ActivityRow title="ADUBAGEM (Unidade)" data={adubagem} setData={setAdubagem} />
            
            {/* PLANTIO (Especial com Espécie) */}
            <div className="p-4 sm:p-5 bg-white border border-gray-200 rounded-2xl flex flex-col gap-4 shadow-sm">
              <div className="flex justify-between items-center">
                <h3 className="uppercase text-[11px] tracking-wider font-bold text-gray-800">PLANTIO (Unidade)</h3>
                <button onClick={() => setPlantio([...plantio, {especie: '', value: '0', faixa: '', berma: ''}])} className="text-gray-500 hover:text-gray-900 p-1 rounded-md hover:bg-gray-100 transition-colors"><Plus size={18} /></button>
              </div>
              {plantio.map((row, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <select
                      value={row.especie}
                      onChange={(e) => {
                        const newData = [...plantio];
                        newData[idx].especie = e.target.value;
                        setPlantio(newData);
                      }}
                      className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 appearance-none cursor-pointer"
                    >
                      <option value="">Espécie</option>
                      <option value="Ipê">Ipê</option>
                      <option value="Quaresmeira">Quaresmeira</option>
                      <option value="Grama">Grama</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
                  </div>
                  <input 
                    type="text" inputMode="numeric" value={row.value}
                    onChange={(e) => { const n = [...plantio]; n[idx].value = maskNumber(e.target.value, false); setPlantio(n); }}
                    className="w-full sm:w-24 bg-white border border-gray-300 rounded-xl p-3 text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                    placeholder="0"
                  />
                  <div className="relative w-full sm:w-32">
                    <select value={row.faixa} onChange={(e) => { const n = [...plantio]; n[idx].faixa = e.target.value; setPlantio(n); }} className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 appearance-none">
                      <option value="">Faixa</option>{faixas.map(f => <option key={f} value={`Faixa ${f}`}>Faixa {f}</option>)}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
                  </div>
                  <div className="relative w-full sm:w-32">
                    <select value={row.berma} onChange={(e) => { const n = [...plantio]; n[idx].berma = e.target.value; setPlantio(n); }} className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 appearance-none">
                      <option value="">Berma</option>{bermas.map(b => <option key={b} value={`Berma ${b}`}>Berma {b}</option>)}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
                  </div>
                </div>
              ))}
            </div>

            <ActivityRow title="LIMPEZA MANUAL (m²)" data={limpezaManual} setData={setLimpezaManual} isFloat />
            <ActivityRow title="LIMPEZA COM SOPRADOR (m²)" data={limpezaSoprador} setData={setLimpezaSoprador} isFloat />

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
                    <select value={invasoras[0].faixa} onChange={(e) => { const n = [...invasoras]; n[0].faixa = e.target.value; setInvasoras(n); }} className="w-full bg-white border border-gray-300 rounded-xl p-2 text-gray-900 appearance-none text-sm outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500">
                      <option value="">Faixa</option>{faixas.map(f => <option key={f} value={`Faixa ${f}`}>Faixa {f}</option>)}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
                  </div>
                  <button onClick={() => setInvasoras([...invasoras, {nome: '', value: '0', berma: '', faixa: invasoras[0].faixa}])} className="flex items-center gap-1 bg-white border border-gray-300 px-3 py-2 rounded-xl text-sm hover:bg-gray-50 transition-colors whitespace-nowrap text-gray-700 font-medium">
                    <Plus size={14} /> Adicionar mais
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {invasoras.map((row, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 flex flex-col gap-1">
                      {idx === 0 && <label className="text-gray-500 text-xs ml-1">Nome da Invasora</label>}
                      <div className="relative">
                        <select value={row.nome} onChange={(e) => { const n = [...invasoras]; n[idx].nome = e.target.value; setInvasoras(n); }} className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900 appearance-none outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500">
                          <option value="">Selecione a invasora</option>
                          <option value="Acácia">Acácia</option>
                          <option value="Erva Daninha">Erva Daninha</option>
                          <option value="Erva-de-passarinho">Erva-de-passarinho</option>
                          <option value="Juqueri">Juqueri</option>
                          <option value="Leucena">Leucena</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
                      </div>
                    </div>
                    <div className="sm:w-32 flex flex-col gap-1">
                      {idx === 0 && <label className="text-gray-500 text-xs ml-1">Unidade</label>}
                      <input type="text" inputMode="numeric" value={row.value} onChange={(e) => { const n = [...invasoras]; n[idx].value = maskNumber(e.target.value, false); setInvasoras(n); }} className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500" placeholder="0" />
                    </div>
                    <div className="sm:w-40 flex flex-col gap-1">
                      {idx === 0 && <label className="text-gray-500 text-xs ml-1">Berma</label>}
                      <div className="relative">
                        <select value={row.berma} onChange={(e) => { const n = [...invasoras]; n[idx].berma = e.target.value; setInvasoras(n); }} className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900 appearance-none outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500">
                          <option value="">Berma</option>{bermas.map(b => <option key={b} value={`Berma ${b}`}>Berma {b}</option>)}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <ActivityRow title="RETIRADA DE MUDAS - ÁRVORES (Unidade)" data={retiradaMudas} setData={setRetiradaMudas} icon={<TreePine className="text-green-600" size={16} />} />
            <ActivityRow title="PLANTIO DE GRAMA (m²)" data={plantioGrama} setData={setPlantioGrama} isFloat icon={<Leaf className="text-green-600" size={16} />} containerClassName="border-green-200 bg-green-50/30" />

            {/* OUTRAS ATIVIDADES */}
            <div className="p-4 sm:p-5 bg-white border border-yellow-200 rounded-2xl flex flex-col gap-4 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-yellow-50/50 to-transparent pointer-events-none" />
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 relative z-10">
                <div className="flex items-start gap-2">
                  <PenLine className="text-yellow-600 mt-1" size={18} />
                  <h3 className="uppercase text-[14px] leading-tight tracking-wider font-bold text-yellow-600 w-32">OUTRAS ATIVIDADES<br/><span className="text-[10px] text-yellow-600/70 capitalize">(Preenchimento Manual)</span></h3>
                </div>
                <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                  <div className="flex gap-2 w-full">
                    <div className="relative flex-1 sm:w-32">
                      <select value={outrasFaixa} onChange={e => setOutrasFaixa(e.target.value)} className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-gray-900 appearance-none text-sm outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500">
                        <option value="">Faixa</option>{faixas.map(f => <option key={f} value={`Faixa ${f}`}>Faixa {f}</option>)}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
                    </div>
                    <div className="relative flex-1 sm:w-32">
                      <select value={outrasBerma} onChange={e => setOutrasBerma(e.target.value)} className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-gray-900 appearance-none text-sm outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500">
                        <option value="">Berma</option>{bermas.map(b => <option key={b} value={`Berma ${b}`}>Berma {b}</option>)}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
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
                      {irrigacaoCarretel && <span className="text-white text-[10px] font-bold">✓</span>}
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
                                className={`w-14 h-10 rounded-xl text-sm font-bold transition-all border ${isSelected ? 'bg-yellow-400 text-white border-yellow-400 shadow-sm' : 'bg-white text-gray-700 border-gray-300 hover:border-yellow-400 hover:bg-yellow-50'}`}
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
            <h2 className="text-xl font-display font-bold italic text-gray-900">Resumo para RDO</h2>
          </div>
          <p className="text-gray-500 text-sm mb-2">
            Esta prévia mostra como os dados aparecerão no RDO
          </p>

          <div ref={previewRef} className="bg-[#faf9f6] border border-gray-200 p-4 rounded-xl font-mono text-sm text-gray-800 whitespace-pre-wrap flex flex-col gap-2 relative">
            <div className="font-bold text-gray-700 mb-1">Data: {formatDateDisplay(selectedDate)}</div>
            <div className="font-bold text-yellow-600 mb-1 mt-2">🌱 *Atividades Realizadas:*</div>
            
            {!hasAnyData ? (
              <span className="text-gray-400">Nenhuma atividade registrada</span>
            ) : (
              <div className="flex flex-col gap-1">
                {renderRows('Roçagem', rocagem, 'm²')}
                {renderRows('Roçagem Aspersores', rocagemAsp, 'unid')}
                {renderRows('Podagem', podagem, 'unid')}
                {renderRows('Cova', cova, 'unid')}
                {renderRows('Coroamento', coroamento, 'unid')}
                {renderRows('Adubagem', adubagem, 'unid')}
                {renderPlantio()}
                {renderRows('Limpeza Manual', limpezaManual, 'm²')}
                {renderRows('Limpeza com Soprador', limpezaSoprador, 'm²')}
                {renderInvasoras()}
                {renderRows('Retirada de Mudas - Árvores', retiradaMudas, 'unid')}
                {renderRows('Plantio de Grama', plantioGrama, 'm²')}
                {renderTextActivity('Outras Atividades', outrasDesc, outrasFaixa, outrasBerma)}
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

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
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
        </div>
      )}
    </div>
  )
}
