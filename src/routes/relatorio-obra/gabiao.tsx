import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { 
  Hammer, Calendar as CalendarIcon, History, FileText, Save, Copy, Phone, Lock, Sparkles, MapPin, CheckCircle2, Circle, PenLine
} from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'

export const Route = createFileRoute('/relatorio-obra/gabiao')({
  component: GabiaoPage,
})

const faixas = Array.from({length: 5}, (_, i) => i + 1); // FAIXA 1 a 5
const fases = ['Nenhuma', 'Fase 1', 'Fase 2', 'Fase 3'];
const elevados = ['Nenhum', ...Array.from({length: 31}, (_, i) => String(i + 26))];

function ActivityItem({
  title,
  checked,
  onToggle,
  value,
  onChangeValue,
  placeholder,
  unit,
  type = 'text'
}: {
  title: string;
  checked: boolean;
  onToggle: () => void;
  value?: string;
  onChangeValue?: (v: string) => void;
  placeholder?: string;
  unit?: string;
  type?: 'text' | 'number';
}) {
  return (
    <div className={`p-4 sm:p-5 border rounded-2xl flex flex-col gap-4 shadow-sm transition-colors ${checked ? 'bg-yellow-50/30 border-yellow-200' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
      <div className="flex justify-between items-center cursor-pointer select-none" onClick={onToggle}>
        <div className="flex items-center gap-3">
          {checked ? <CheckCircle2 className="text-yellow-500" size={24} /> : <Circle className="text-gray-300" size={24} />}
          <span className={`font-bold text-sm ${checked ? 'text-gray-900' : 'text-gray-600'}`}>{title}</span>
        </div>
      </div>
      {checked && onChangeValue !== undefined && (
        <div className="pl-9 flex items-center gap-2">
          <input 
            type={type}
            value={value}
            onChange={e => onChangeValue(e.target.value)}
            placeholder={placeholder}
            className="w-full sm:max-w-xs bg-white border border-gray-300 rounded-xl p-3 text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors placeholder-gray-400"
          />
          {unit && <span className="font-bold text-sm text-gray-700">{unit}</span>}
        </div>
      )}
    </div>
  )
}

function GabiaoPage() {
  const [localFaixa, setLocalFaixa] = useState('');
  const [localFase, setLocalFase] = useState('Nenhuma');
  const [localElevado, setLocalElevado] = useState('Nenhum');

  const [escavacao, setEscavacao] = useState(false);
  const [manta, setManta] = useState({ checked: false, value: '' });
  const [silte, setSilte] = useState({ checked: false, value: '' });
  const [limpeza, setLimpeza] = useState(false);
  const [retTela, setRetTela] = useState({ checked: false, value: '' });
  const [retCascalho, setRetCascalho] = useState({ checked: false, value: '' });
  const [lavVert, setLavVert] = useState(false);
  const [lavBacias, setLavBacias] = useState(false);
  const [repGeotextil, setRepGeotextil] = useState({ checked: false, value: '' });
  const [retGeotextil, setRetGeotextil] = useState({ checked: false, value: '' });
  const [retGeomembrana, setRetGeomembrana] = useState({ checked: false, value: '' });
  const [repGeomembrana, setRepGeomembrana] = useState({ checked: false, value: '' });
  const [recTela, setRecTela] = useState({ checked: false, value: '' });
  const [recCascalho, setRecCascalho] = useState({ checked: false, value: '' });
  const [recSilte, setRecSilte] = useState({ checked: false, value: '' });
  const [transporte, setTransporte] = useState(false);

  const [atividadesManuais, setAtividadesManuais] = useState('');
  const [observacoes, setObservacoes] = useState('');

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
    const localKeys = Object.keys(localStorage).filter(k => k.startsWith('gabiao_rdo_'));
    const localDates = localKeys.filter(k => {
      try {
        const data = JSON.parse(localStorage.getItem(k) || '{}');
        return data.isLocked !== false;
      } catch (e) {
        return false;
      }
    }).map(k => k.replace('gabiao_rdo_', ''));

    let remoteDates: string[] = [];
    try {
      const { data } = await supabase.from('global_settings').select('key, value').like('key', 'gabiao_rdo_%');
      if (data) {
        remoteDates = data.filter(r => r.value?.isLocked !== false).map(r => r.key.replace('gabiao_rdo_', ''));
      }
    } catch (e) {}

    const merged = Array.from(new Set([...localDates, ...remoteDates])).sort((a, b) => b.localeCompare(a));
    setSavedDates(merged);
  }

  const handleUnlock = async () => {
    setIsLocked(false);
    let parsed: any = {};
    const localData = localStorage.getItem(`gabiao_rdo_${selectedDate}`);
    if (localData) {
      try { parsed = JSON.parse(localData); } catch (e) {}
    }
    parsed.isLocked = false;
    localStorage.setItem(`gabiao_rdo_${selectedDate}`, JSON.stringify(parsed));
    
    try {
      await supabase.from('global_settings').upsert({
        key: `gabiao_rdo_${selectedDate}`,
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
      localFaixa, localFase, localElevado,
      escavacao, manta, silte, limpeza, retTela, retCascalho, lavVert, lavBacias,
      repGeotextil, retGeotextil, retGeomembrana, repGeomembrana, recTela, recCascalho, recSilte,
      transporte, atividadesManuais, observacoes,
      isLocked: true
    };
    localStorage.setItem(`gabiao_rdo_${selectedDate}`, JSON.stringify(dataToSave));
    setIsLocked(true);
    toast.success('Relatório salvo com sucesso para a data ' + formatDateDisplay(selectedDate));
    
    try {
      await supabase.from('global_settings').upsert({
        key: `gabiao_rdo_${selectedDate}`,
        value: dataToSave,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
    } catch (e) {}
    
    updateSavedDates();
  }

  const loadDate = async (dateStr: string) => {
    setSelectedDate(dateStr);
    
    let parsed: any = null;
    
    try {
      const { data } = await supabase.from('global_settings').select('value').eq('key', `gabiao_rdo_${dateStr}`).single();
      if (data && data.value) {
        parsed = data.value;
        localStorage.setItem(`gabiao_rdo_${dateStr}`, JSON.stringify(parsed));
      }
    } catch (e) {}
    
    if (!parsed) {
      const localData = localStorage.getItem(`gabiao_rdo_${dateStr}`);
      if (localData) {
        try { parsed = JSON.parse(localData); } catch (e) {}
      }
    }
    
    if (parsed) {
      setLocalFaixa(parsed.localFaixa || '');
      setLocalFase(parsed.localFase || 'Nenhuma');
      setLocalElevado(parsed.localElevado || 'Nenhum');
      setEscavacao(parsed.escavacao || false);
      setManta(parsed.manta || { checked: false, value: '' });
      setSilte(parsed.silte || { checked: false, value: '' });
      setLimpeza(parsed.limpeza || false);
      setRetTela(parsed.retTela || { checked: false, value: '' });
      setRetCascalho(parsed.retCascalho || { checked: false, value: '' });
      setLavVert(parsed.lavVert || false);
      setLavBacias(parsed.lavBacias || false);
      setRepGeotextil(parsed.repGeotextil || { checked: false, value: '' });
      setRetGeotextil(parsed.retGeotextil || { checked: false, value: '' });
      setRetGeomembrana(parsed.retGeomembrana || { checked: false, value: '' });
      setRepGeomembrana(parsed.repGeomembrana || { checked: false, value: '' });
      setRecTela(parsed.recTela || { checked: false, value: '' });
      setRecCascalho(parsed.recCascalho || { checked: false, value: '' });
      setRecSilte(parsed.recSilte || { checked: false, value: '' });
      setTransporte(parsed.transporte || false);
      setAtividadesManuais(parsed.atividadesManuais || '');
      setObservacoes(parsed.observacoes || '');
      setIsLocked(parsed.isLocked !== false);
      setShowHistory(false);
    } else {
      setLocalFaixa('');
      setLocalFase('Nenhuma');
      setLocalElevado('Nenhum');
      setEscavacao(false);
      setManta({ checked: false, value: '' });
      setSilte({ checked: false, value: '' });
      setLimpeza(false);
      setRetTela({ checked: false, value: '' });
      setRetCascalho({ checked: false, value: '' });
      setLavVert(false);
      setLavBacias(false);
      setRepGeotextil({ checked: false, value: '' });
      setRetGeotextil({ checked: false, value: '' });
      setRetGeomembrana({ checked: false, value: '' });
      setRepGeomembrana({ checked: false, value: '' });
      setRecTela({ checked: false, value: '' });
      setRecCascalho({ checked: false, value: '' });
      setRecSilte({ checked: false, value: '' });
      setTransporte(false);
      setAtividadesManuais('');
      setObservacoes('');
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

  const hasAnyData = escavacao || manta.checked || silte.checked || limpeza || retTela.checked || retCascalho.checked || lavVert || lavBacias || repGeotextil.checked || retGeotextil.checked || retGeomembrana.checked || repGeomembrana.checked || recTela.checked || recCascalho.checked || recSilte.checked || transporte || atividadesManuais.trim().length > 0;

  return (
    <div className="min-h-screen bg-gray-50/30 pb-20">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="px-4 sm:px-8 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2.5 rounded-full border border-orange-200 shadow-sm">
              <Hammer className="text-orange-600" size={24} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-display italic tracking-tight font-bold text-gray-900">Registro de Atividades - Gabião</h1>
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
                  modifiers={{ hasSaved: savedDates.map(d => new Date(d + 'T12:00:00')) }}
                  modifiersClassNames={{ hasSaved: "bg-green-500 text-white font-bold hover:bg-green-600 hover:text-white focus:bg-green-600 focus:text-white" }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <button onClick={() => setShowHistory(!showHistory)} className={`flex items-center gap-2 border px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm ${showHistory ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
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

        {showHistory && (
          <div className="px-4 sm:px-8 mb-6">
            <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <History size={18} className="text-gray-500" />
                Relatórios Salvos
              </h3>
              {savedDates.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum relatório salvo no histórico.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {savedDates.map(d => (
                    <button
                      key={d}
                      onClick={() => loadDate(d)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                        d === selectedDate 
                        ? 'bg-yellow-100 border-yellow-300 text-yellow-800' 
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {formatDateDisplay(d)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
          
          {/* Left Column - Form */}
          <fieldset disabled={isLocked} className="min-w-0 p-0 m-0 border-none group">
            <div className={`bg-[#faf9f6] border border-orange-500/20 rounded-3xl p-5 sm:p-8 flex flex-col gap-6 relative shadow-sm transition-all duration-300 ${isLocked ? 'opacity-80 pointer-events-none' : ''}`}>
            
              {/* LOCAL DO SERVIÇO */}
              <div className="flex flex-col gap-3 relative z-10">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="text-orange-600" size={18} />
                  <h3 className="uppercase text-[12px] tracking-wider font-bold text-gray-800">LOCAL DO SERVIÇO</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Faixa</label>
                    <div className="relative">
                      <select value={localFaixa} onChange={e => setLocalFaixa(e.target.value)} className="w-full bg-white border border-gray-300 rounded-xl p-3 text-sm text-gray-900 outline-none focus:border-yellow-500 appearance-none">
                        <option value="">Selecione...</option>
                        {faixas.map(f => <option key={f} value={`FAIXA ${f}`}>FAIXA {f}</option>)}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Fase</label>
                    <div className="relative">
                      <select value={localFase} onChange={e => setLocalFase(e.target.value)} className="w-full bg-white border border-gray-300 rounded-xl p-3 text-sm text-gray-900 outline-none focus:border-yellow-500 appearance-none">
                        {fases.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Elevado/Berma</label>
                    <div className="relative">
                      <select value={localElevado} onChange={e => setLocalElevado(e.target.value)} className="w-full bg-white border border-gray-300 rounded-xl p-3 text-sm text-gray-900 outline-none focus:border-yellow-500 appearance-none">
                        {elevados.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ATIVIDADES */}
              <div className="flex flex-col gap-3 relative z-10 mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="text-orange-600" size={18} />
                  <h3 className="uppercase text-[12px] tracking-wider font-bold text-gray-800">ATIVIDADES</h3>
                </div>
                
                <ActivityItem title="Escavação manual" checked={escavacao} onToggle={() => setEscavacao(!escavacao)} />
                <ActivityItem title="Reposição de manta asfáltica" checked={manta.checked} onToggle={() => setManta({...manta, checked: !manta.checked})} value={manta.value} onChangeValue={v => setManta({...manta, value: v})} placeholder="10 x 3 ou Dimensão personalizada" />
                <ActivityItem title="Reposição de silte" checked={silte.checked} onToggle={() => setSilte({...silte, checked: !silte.checked})} value={silte.value} onChangeValue={v => setSilte({...silte, value: v})} placeholder="Quantidade" unit="m²" type="number" />
                <ActivityItem title="Limpeza e organização" checked={limpeza} onToggle={() => setLimpeza(!limpeza)} />
                <ActivityItem title="Retirada de tela" checked={retTela.checked} onToggle={() => setRetTela({...retTela, checked: !retTela.checked})} value={retTela.value} onChangeValue={v => setRetTela({...retTela, value: v})} placeholder="Ex: 8 x 8" />
                <ActivityItem title="Retirada de cascalho" checked={retCascalho.checked} onToggle={() => setRetCascalho({...retCascalho, checked: !retCascalho.checked})} value={retCascalho.value} onChangeValue={v => setRetCascalho({...retCascalho, value: v})} placeholder="Quantidade" unit="m²" type="number" />
                <ActivityItem title="Lavagem de vertedouro" checked={lavVert} onToggle={() => setLavVert(!lavVert)} />
                <ActivityItem title="Lavagem de bacias do vertedouro" checked={lavBacias} onToggle={() => setLavBacias(!lavBacias)} />
                <ActivityItem title="Reposição de Geotêxtil" checked={repGeotextil.checked} onToggle={() => setRepGeotextil({...repGeotextil, checked: !repGeotextil.checked})} value={repGeotextil.value} onChangeValue={v => setRepGeotextil({...repGeotextil, value: v})} placeholder="Ex: 8 x 8" />
                <ActivityItem title="Retirada de Geotêxtil" checked={retGeotextil.checked} onToggle={() => setRetGeotextil({...retGeotextil, checked: !retGeotextil.checked})} value={retGeotextil.value} onChangeValue={v => setRetGeotextil({...retGeotextil, value: v})} placeholder="Ex: 8 x 8" />
                <ActivityItem title="Retirada de Geomembrana" checked={retGeomembrana.checked} onToggle={() => setRetGeomembrana({...retGeomembrana, checked: !retGeomembrana.checked})} value={retGeomembrana.value} onChangeValue={v => setRetGeomembrana({...retGeomembrana, value: v})} placeholder="Ex: 8 x 8" />
                <ActivityItem title="Reposição de Geomembrana" checked={repGeomembrana.checked} onToggle={() => setRepGeomembrana({...repGeomembrana, checked: !repGeomembrana.checked})} value={repGeomembrana.value} onChangeValue={v => setRepGeomembrana({...repGeomembrana, value: v})} placeholder="Ex: 8 x 8" />
                <ActivityItem title="Recomposição de tela" checked={recTela.checked} onToggle={() => setRecTela({...recTela, checked: !recTela.checked})} value={recTela.value} onChangeValue={v => setRecTela({...recTela, value: v})} placeholder="Ex: 8 x 8" />
                <ActivityItem title="Recomposição de cascalho" checked={recCascalho.checked} onToggle={() => setRecCascalho({...recCascalho, checked: !recCascalho.checked})} value={recCascalho.value} onChangeValue={v => setRecCascalho({...recCascalho, value: v})} placeholder="Quantidade" unit="m²" type="number" />
                <ActivityItem title="Recomposição de silte" checked={recSilte.checked} onToggle={() => setRecSilte({...recSilte, checked: !recSilte.checked})} value={recSilte.value} onChangeValue={v => setRecSilte({...recSilte, value: v})} placeholder="Quantidade" unit="m²" type="number" />
                <ActivityItem title="Transporte de Materiais" checked={transporte} onToggle={() => setTransporte(!transporte)} />
              </div>

              {/* ATIVIDADES MANUAIS */}
              <div className="flex flex-col gap-3 relative z-10 mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <PenLine className="text-orange-600" size={18} />
                  <h3 className="uppercase text-[12px] tracking-wider font-bold text-gray-800">ATIVIDADES MANUAIS</h3>
                </div>
                <textarea 
                  value={atividadesManuais} onChange={e => setAtividadesManuais(e.target.value)}
                  placeholder="Escreva outras atividades realizadas (uma por linha)..."
                  className="w-full h-32 bg-white border border-gray-300 rounded-xl p-3 text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 resize-none placeholder-gray-400 text-sm"
                />
                <p className="text-gray-500 text-[11px]">Cada linha será formatada como um item de atividade no relatório.</p>
              </div>

              {/* OBSERVAÇÕES */}
              <div className="flex flex-col gap-3 relative z-10 mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="text-gray-800" size={18} />
                  <h3 className="uppercase text-[12px] tracking-wider font-bold text-gray-800">OBSERVAÇÕES</h3>
                </div>
                <textarea 
                  value={observacoes} onChange={e => setObservacoes(e.target.value)}
                  placeholder="Observações adicionais sobre as atividades..."
                  className="w-full h-24 bg-white border border-gray-300 rounded-xl p-3 text-gray-900 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 resize-none placeholder-gray-400 text-sm"
                />
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
              
              {localFaixa && (
                <div className="font-bold text-orange-600 mb-2">
                  📍 Local: {localFaixa}
                  {localFase && localFase !== 'Nenhuma' ? ` - ${localFase}` : ''}
                  {localElevado && localElevado !== 'Nenhum' ? ` - Elevado: ${localElevado}` : ''}
                </div>
              )}

              <div className="font-bold text-orange-600 mb-1 mt-2">🔨 *Atividades Realizadas:*</div>
              
              {!hasAnyData ? (
                <span className="text-gray-400">Nenhuma atividade registrada</span>
              ) : (
                <div className="flex flex-col gap-1">
                  {escavacao && <div>* Escavação manual</div>}
                  {manta.checked && <div>* Reposição de manta asfáltica {manta.value ? `(${manta.value})` : ''}</div>}
                  {silte.checked && <div>* Reposição de silte {silte.value ? `(${silte.value} m²)` : ''}</div>}
                  {limpeza && <div>* Limpeza e organização</div>}
                  {retTela.checked && <div>* Retirada de tela {retTela.value ? `(${retTela.value})` : ''}</div>}
                  {retCascalho.checked && <div>* Retirada de cascalho {retCascalho.value ? `(${retCascalho.value} m²)` : ''}</div>}
                  {lavVert && <div>* Lavagem de vertedouro</div>}
                  {lavBacias && <div>* Lavagem de bacias do vertedouro</div>}
                  {repGeotextil.checked && <div>* Reposição de Geotêxtil {repGeotextil.value ? `(${repGeotextil.value})` : ''}</div>}
                  {retGeotextil.checked && <div>* Retirada de Geotêxtil {retGeotextil.value ? `(${retGeotextil.value})` : ''}</div>}
                  {retGeomembrana.checked && <div>* Retirada de Geomembrana {retGeomembrana.value ? `(${retGeomembrana.value})` : ''}</div>}
                  {repGeomembrana.checked && <div>* Reposição de Geomembrana {repGeomembrana.value ? `(${repGeomembrana.value})` : ''}</div>}
                  {recTela.checked && <div>* Recomposição de tela {recTela.value ? `(${recTela.value})` : ''}</div>}
                  {recCascalho.checked && <div>* Recomposição de cascalho {recCascalho.value ? `(${recCascalho.value} m²)` : ''}</div>}
                  {recSilte.checked && <div>* Recomposição de silte {recSilte.value ? `(${recSilte.value} m²)` : ''}</div>}
                  {transporte && <div>* Transporte de Materiais</div>}
                  
                  {atividadesManuais.split('\n').filter(line => line.trim().length > 0).map((line, idx) => (
                    <div key={idx}>* {line.trim()}</div>
                  ))}
                </div>
              )}
              
              {observacoes.trim().length > 0 && (
                <div className="mt-4">
                  <div className="font-bold text-orange-600 mb-1">📝 *Observações:*</div>
                  <div>{observacoes.trim()}</div>
                </div>
              )}
            </div>

            <div className="mt-2 bg-orange-50 border border-orange-200 p-4 rounded-xl flex items-start gap-3">
              <Sparkles className="text-orange-600 shrink-0 mt-0.5" size={18} />
              <p className="text-orange-700 text-sm">
                Os dados preenchidos aqui serão automaticamente incluídos na seção "Gabião" do RDO.
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

            <div className="mt-6 flex justify-center">
              <img src="/Trabalhador_gabiao.png" alt="Trabalhador Gabião" className="w-96 h-auto object-contain drop-shadow-md" />
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
