import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { 
  Calendar as CalendarIcon, History, FileText, Save, Copy, Phone, Lock, Sun
} from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'

export const Route = createFileRoute('/relatorio-obra/rdo')({
  component: RDOPage,
})

function RDOPage() {
  const [empresa, setEmpresa] = useState('Sucena Empreendimentos');
  const [contrato, setContrato] = useState('460001269');
  const [gerencia, setGerencia] = useState('Hydro');
  const [lideranca, setLideranca] = useState('Eng. Luís Araújo');
  const [tst, setTst] = useState('Itamar Junior e Alexssandro Chaves');
  const [local, setLocal] = useState('Alunorte Barcarena');
  const [horario, setHorario] = useState('07:00 as 17:00');
  
  const [climaManha, setClimaManha] = useState('Sol');
  const [climaTarde, setClimaTarde] = useState('Sol');
  const [dificuldades, setDificuldades] = useState('Não Houve.');

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

  // States to hold Jardinagem and Gabiao data
  const [jardinagemData, setJardinagemData] = useState<any>(null);
  const [gabiaoData, setGabiaoData] = useState<any>(null);
  
  // Equipments from Supabase
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [presencas, setPresencas] = useState<any[]>([]);

  const fetchPresencasForDate = async (dateStr: string) => {
    try {
      const { data: pData, error: pError } = await supabase
        .from('rh_presencas')
        .select('*')
        .eq('data', dateStr)
        .eq('status', 'PRESENTE');
        
      if (pError) throw pError;
      
      const { data: eData, error: eError } = await supabase
        .from('rh_efetivo')
        .select('id, nome, cargo');
        
      if (eError) throw eError;
      
      const efetivoMap = new Map((eData || []).map(c => [c.id, c]));
      const mapped = (pData || []).map(p => {
        const emp = efetivoMap.get(p.funcionario_id);
        return {
          ...p,
          nome: emp ? emp.nome : 'Desconhecido',
          cargo: emp ? emp.cargo : 'Sem Cargo'
        };
      });
      setPresencas(mapped);
    } catch(e) {
      console.error('Error fetching presencas:', e);
    }
  }

  const updateSavedDates = () => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('main_rdo_'));
    const lockedDates = keys.filter(k => {
      try {
        const data = JSON.parse(localStorage.getItem(k) || '{}');
        return data.isLocked !== false;
      } catch (e) {
        return false;
      }
    }).map(k => k.replace('main_rdo_', '')).sort((a, b) => b.localeCompare(a));
    setSavedDates(lockedDates);
  }

  const handleUnlock = () => {
    setIsLocked(false);
    const data = localStorage.getItem(`main_rdo_${selectedDate}`);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        parsed.isLocked = false;
        localStorage.setItem(`main_rdo_${selectedDate}`, JSON.stringify(parsed));
        updateSavedDates();
      } catch (e) {}
    }
  }

  const fetchEquipamentos = async () => {
    try {
      const { data, error } = await supabase
        .from('eq_equipments')
        .select('*')
        .eq('location_status', 'inside')
        .order('name', { ascending: true });
        
      if (data) {
        setEquipamentos(data);
      }
    } catch(e) {
      console.error(e);
    }
  };

  useEffect(() => {
    updateSavedDates();
    loadDate(selectedDate);
    fetchEquipamentos();
  }, []);

  const loadDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    
    const isFriday = new Date(dateStr + 'T12:00:00Z').getUTCDay() === 5;
    const defaultHorario = isFriday ? '07:00 as 16:00' : '07:00 as 17:00';
    
    // Load Main RDO data
    const data = localStorage.getItem(`main_rdo_${dateStr}`);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        setEmpresa(parsed.empresa || 'Sucena Empreendimentos');
        setContrato(parsed.contrato || '460001269');
        setGerencia(parsed.gerencia || 'Hydro');
        setLideranca(parsed.lideranca || 'Eng. Luís Araújo');
        setTst(parsed.tst || 'Itamar Junior e Alexssandro Chaves');
        setLocal(parsed.local || 'Alunorte Barcarena');
        
        let savedHorario = parsed.horario;
        if (savedHorario === '07:00 as 17:00' && isFriday) savedHorario = '07:00 as 16:00';
        setHorario(savedHorario || defaultHorario);
        
        setClimaManha(parsed.climaManha || 'Sol');
        setClimaTarde(parsed.climaTarde || 'Sol');
        setDificuldades(parsed.dificuldades || 'Não Houve.');
        setIsLocked(parsed.isLocked !== false);
        setShowHistory(false);
      } catch (e) {
        console.error("Error loading main rdo data", e);
      }
    } else {
      let defaults = {
        empresa: 'Sucena Empreendimentos',
        contrato: '460001269',
        gerencia: 'Hydro',
        lideranca: 'Eng. Luís Araújo',
        tst: 'Itamar Junior e Alexssandro Chaves',
        local: 'Alunorte Barcarena'
      };
      const savedDefaults = localStorage.getItem('main_rdo_defaults');
      if (savedDefaults) {
        try {
          const p = JSON.parse(savedDefaults);
          defaults = { ...defaults, ...p };
        } catch(e) {}
      }

      setEmpresa(defaults.empresa);
      setContrato(defaults.contrato);
      setGerencia(defaults.gerencia);
      setLideranca(defaults.lideranca);
      setTst(defaults.tst);
      setLocal(defaults.local);
      setHorario(defaultHorario);
      setClimaManha('Sol');
      setClimaTarde('Sol');
      setDificuldades('Não Houve.');
      setIsLocked(false);
      setShowHistory(false);
    }

    // Load sub-reports
    const jar = localStorage.getItem(`jardinagem_rdo_${dateStr}`);
    if (jar) {
      try { setJardinagemData(JSON.parse(jar)); } catch(e) { setJardinagemData(null); }
    } else {
      setJardinagemData(null);
    }

    const gab = localStorage.getItem(`gabiao_rdo_${dateStr}`);
    if (gab) {
      try { setGabiaoData(JSON.parse(gab)); } catch(e) { setGabiaoData(null); }
    } else {
      setGabiaoData(null);
    }
    
    fetchPresencasForDate(dateStr);
  }

  const handleSave = () => {
    const dataToSave = {
      empresa, contrato, gerencia, lideranca, tst, local, horario,
      climaManha, climaTarde, dificuldades,
      isLocked: true
    };
    localStorage.setItem(`main_rdo_${selectedDate}`, JSON.stringify(dataToSave));
    localStorage.setItem('main_rdo_defaults', JSON.stringify({
      empresa, contrato, gerencia, lideranca, tst, local
    }));
    updateSavedDates();
    setIsLocked(true);
    toast.success('RDO salvo com sucesso para a data ' + formatDateDisplay(selectedDate));
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
  
  const renderEfetivoPorArea = (area: string) => {
    const pArea = presencas.filter(p => p.area === area);
    if (pArea.length === 0) {
      return `👷 Efetivo 👷\n⚠️ Lista de Presença ainda não salva para esta data.`;
    }
    
    let text = `👷 Efetivo 👷\n✴️ EQUIPE DE EXECUÇÃO ✴️\n`;
    const byCargo: Record<string, string[]> = {};
    pArea.forEach(p => {
      const cargo = (p.cargo || 'Outros').toUpperCase();
      if (!byCargo[cargo]) byCargo[cargo] = [];
      byCargo[cargo].push(p.nome);
    });
    
    Object.keys(byCargo).sort().forEach(cargo => {
      text += `\n👷 ${cargo}:\n`;
      byCargo[cargo].sort().forEach(nome => {
        text += `${nome}\n`;
      });
    });
    
    return text;
  }

  // Formatting helpers for sub-reports
  const renderJardinagemText = () => {
    if (!jardinagemData) {
      return `⚠️ Relatório diário de Jardinagem ainda não salvo para esta data.\n\n👷 Efetivo 👷\n⚠️ Lista de Presença ainda não salva para esta data.`;
    }
    
    let text = "";
    let lines = [];
    
    const d = jardinagemData;
    
    const addRows = (title: string, data: any[], unit: string) => {
      if (!data) return;
      const valid = data.filter((x:any) => x.value && x.value !== '0' && x.value !== '0,00' && x.value !== '0.00');
      valid.forEach((row:any) => {
        lines.push(`* ${title}: ${row.value} ${unit} - ${row.faixa} ${row.berma}`);
      });
    }

    addRows('Roçagem', d.rocagem, 'm²');
    addRows('Roçagem Aspersores', d.rocagemAsp, 'unid');
    addRows('Podagem', d.podagem, 'unid');
    addRows('Cova', d.cova, 'unid');
    addRows('Coroamento', d.coroamento, 'unid');
    addRows('Adubagem', d.adubagem, 'unid');
    
    if (d.plantio) {
      const valid = d.plantio.filter((x:any) => x.value && x.value !== '0' && x.value !== '0,00' && x.value !== '0.00');
      valid.forEach((row:any) => {
        lines.push(`* Plantio (${row.especie}): ${row.value} unid - ${row.faixa} ${row.berma}`);
      });
    }
    
    addRows('Limpeza Manual', d.limpezaManual, 'm²');
    addRows('Limpeza com Soprador', d.limpezaSoprador, 'm²');
    
    if (d.invasoras) {
      const valid = d.invasoras.filter((x:any) => x.value && x.value !== '0' && x.value !== '0,00' && x.value !== '0.00');
      valid.forEach((row:any) => {
        lines.push(`* Retirada de Invasoras (${row.nome}): ${row.value} m² - ${row.faixa} ${row.berma}`);
      });
    }
    
    addRows('Retirada de Mudas - Árvores', d.retiradaMudas, 'unid');
    addRows('Plantio de Grama', d.plantioGrama, 'm²');
    
    if (d.outrasDesc && d.outrasDesc.trim() !== '') {
      lines.push(`* ${d.outrasDesc.trim()} - ${d.outrasFaixa} ${d.outrasBerma}`);
    }
    
    if (d.canteiroDesc && d.canteiroDesc.trim() !== '') {
      lines.push(`* Manutenção de Canteiro: ${d.canteiroDesc.trim()}`);
    }
    
    if (d.irrigacaoPipas) lines.push(`* Irrigação com Pipas nas Faixas 3, 4 e 5 e Mirante`);
    if (d.irrigacaoApoioPipa) lines.push(`* Apoio com Pipa Sistema de irrigação`);
    
    if (d.irrigacaoCarretel) {
      let hasSel = false;
      Object.keys(d.irrigacaoCarretelBermas || {}).forEach(f => {
        const bermas = d.irrigacaoCarretelBermas[f as unknown as number];
        if (bermas && bermas.length > 0) {
          hasSel = true;
          lines.push(`* Irrigação com Carretel (Faixa ${f}, Bermas ${bermas.join(', ')})`);
        }
      });
      if (!hasSel) {
        lines.push(`* Irrigação com Carretel`);
      }
    }
    
    if (d.manutencaoIrrigacao) lines.push(`* Manutenção Sistema de Irrigação`);
    
    if (lines.length > 0) {
      text = lines.join('\n') + `\n\n${renderEfetivoPorArea('Área Jardinagem')}`;
    } else {
      text = `Nenhuma atividade de jardinagem preenchida.\n\n${renderEfetivoPorArea('Área Jardinagem')}`;
    }
    
    return text;
  }

  const renderGabiaoText = () => {
    if (!gabiaoData) {
      return `⚠️ Relatório diário de Gabião ainda não salvo para esta data.\n\n👷 Efetivo 👷\n⚠️ Lista de Presença ainda não salva para esta data.`;
    }
    
    let text = "";
    let lines = [];
    const d = gabiaoData;
    
    if (d.localFaixa) {
      lines.push(`📍 Local: ${d.localFaixa}${d.localFase && d.localFase !== 'Nenhuma' ? ` - ${d.localFase}` : ''}${d.localElevado && d.localElevado !== 'Nenhum' ? ` - Elevado/Berma: ${d.localElevado}` : ''}`);
      lines.push('');
    }
    
    if (d.escavacao) lines.push(`* Escavação manual`);
    if (d.manta?.checked) lines.push(`* Reposição de manta asfáltica ${d.manta.value ? `(${d.manta.value})` : ''}`);
    if (d.silte?.checked) lines.push(`* Reposição de silte ${d.silte.value ? `(${d.silte.value} m²)` : ''}`);
    if (d.limpeza) lines.push(`* Limpeza e organização`);
    if (d.retTela?.checked) lines.push(`* Retirada de tela ${d.retTela.value ? `(${d.retTela.value})` : ''}`);
    if (d.retCascalho?.checked) lines.push(`* Retirada de cascalho ${d.retCascalho.value ? `(${d.retCascalho.value} m²)` : ''}`);
    if (d.lavVert) lines.push(`* Lavagem de vertedouro`);
    if (d.lavBacias) lines.push(`* Lavagem de bacias do vertedouro`);
    if (d.repGeotextil?.checked) lines.push(`* Reposição de Geotêxtil ${d.repGeotextil.value ? `(${d.repGeotextil.value})` : ''}`);
    if (d.retGeotextil?.checked) lines.push(`* Retirada de Geotêxtil ${d.retGeotextil.value ? `(${d.retGeotextil.value})` : ''}`);
    if (d.retGeomembrana?.checked) lines.push(`* Retirada de Geomembrana ${d.retGeomembrana.value ? `(${d.retGeomembrana.value})` : ''}`);
    if (d.repGeomembrana?.checked) lines.push(`* Reposição de Geomembrana ${d.repGeomembrana.value ? `(${d.repGeomembrana.value})` : ''}`);
    if (d.recTela?.checked) lines.push(`* Recomposição de tela ${d.recTela.value ? `(${d.recTela.value})` : ''}`);
    if (d.recCascalho?.checked) lines.push(`* Recomposição de cascalho ${d.recCascalho.value ? `(${d.recCascalho.value} m²)` : ''}`);
    if (d.recSilte?.checked) lines.push(`* Recomposição de silte ${d.recSilte.value ? `(${d.recSilte.value} m²)` : ''}`);
    if (d.transporte) lines.push(`* Transporte de Materiais`);
    
    if (d.atividadesManuais) {
      d.atividadesManuais.split('\n').filter((l:string) => l.trim().length > 0).forEach((l:string) => {
        lines.push(`* ${l.trim()}`);
      });
    }
    
    if (d.observacoes && d.observacoes.trim().length > 0) {
      lines.push('');
      lines.push(`📝 *Observações:*`);
      lines.push(d.observacoes.trim());
    }
    
    if (lines.length > 0) {
      text = lines.join('\n') + `\n\n${renderEfetivoPorArea('Área Gabião')}`;
    } else {
      text = `Nenhuma atividade de Gabião preenchida.\n\n${renderEfetivoPorArea('Área Gabião')}`;
    }
    
    return text;
  }



  const renderEquipamentosGeraisText = () => {
    let lines = [];
    const eqGerais = equipamentos.filter(eq => eq.category !== 'Jardinagem');
    lines.push(`✅ EQUIPAMENTOS EM OPERAÇÃO (${eqGerais.length})`);
    if (eqGerais.length > 0) {
      eqGerais.forEach(eq => {
        lines.push(`• ${eq.name} - ${eq.plate_tag ? eq.plate_tag.toUpperCase() : ''}`);
      });
    } else {
      lines.push(`Nenhum equipamento na obra.`);
    }
    return lines.join('\n');
  }

  const renderEquipamentosJardinagemText = () => {
    let lines = [];
    const eqJardim = equipamentos.filter(eq => eq.category === 'Jardinagem');
    lines.push(`✅ Equipamentos Jardinagem na Obra (${eqJardim.length})`);
    if (eqJardim.length > 0) {
      const counts: Record<string, number> = {};
      eqJardim.forEach(eq => {
        counts[eq.name] = (counts[eq.name] || 0) + 1;
      });
      Object.entries(counts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([name, count]) => {
          lines.push(`• ${count} ${name}`);
        });
    }
    return lines.join('\n');
  }

  return (
    <div className="min-h-screen bg-[#f4f3f0] text-gray-900 pb-24">
      <div className="max-w-[1400px] mx-auto">
        
        {/* Header */}
        <div className="px-4 sm:px-8 pt-8 pb-4">
          <div className="flex items-center gap-4 mb-3">
            <div>
              <h1 className="text-3xl sm:text-4xl font-display tracking-tight font-bold text-gray-900 italic">RDO - Relatório Diário de Obra</h1>
              <p className="text-gray-500 text-sm mt-1">{formatLongDate(selectedDate)}</p>
            </div>
          </div>
          
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-xs font-semibold border border-blue-200 shadow-sm mt-2">
            <Sun size={14} /> Temperatura Atual: 27°C (sensação 32°C)
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm text-gray-700">
                  <CalendarIcon size={16} /> {formatDateDisplay(selectedDate)}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border-gray-200 bg-white" align="start">
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
                  className="bg-white text-gray-900"
                />
              </PopoverContent>
            </Popover>
            <button onClick={() => setShowHistory(!showHistory)} className={`flex items-center gap-2 border px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm ${showHistory ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
              <History size={16} /> Histórico
            </button>
            <button onClick={handleWhatsApp} className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm text-gray-700">
              <Phone size={16} className="text-green-600" /> WhatsApp
            </button>
            <button onClick={handleCopy} className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm text-gray-700">
              <Copy size={16} /> Copiar
            </button>
            {isLocked ? (
              <button onClick={handleUnlock} className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-yellow-100 transition-colors shadow-sm text-yellow-700">
                <Lock size={16} /> Desbloquear
              </button>
            ) : (
              <button onClick={handleSave} className="flex items-center gap-2 bg-white border border-gray-200 px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors shadow-sm text-gray-700">
                <Save size={16} /> Salvar
              </button>
            )}
          </div>
        </div>

        {showHistory && (
          <div className="px-4 sm:px-8 mb-6">
            <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <History size={18} className="text-gray-500" />
                RDOs Salvos
              </h3>
              {savedDates.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum RDO salvo no histórico.</p>
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

        <div className="px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 items-start mt-4">
          
          {/* Left Column - Form */}
          <fieldset disabled={isLocked} className="min-w-0 p-0 m-0 border-none flex flex-col gap-6">
            
            <div className={`bg-[#faf9f6] border border-yellow-500/20 rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-sm transition-all duration-300 relative overflow-hidden ${isLocked ? 'opacity-70 pointer-events-none' : ''}`}>
              <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-yellow-100/50 to-transparent pointer-events-none" />
              <h2 className="text-xl font-display font-bold text-gray-900 mb-2 relative z-10 italic">Informações Gerais</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative z-10">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Empresa</label>
                  <input type="text" value={empresa} onChange={e => setEmpresa(e.target.value)} className="w-full bg-white border border-gray-300 rounded-xl p-3.5 text-sm text-gray-900 outline-none focus:border-yellow-500 transition-colors" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Contrato</label>
                  <input type="text" value={contrato} onChange={e => setContrato(e.target.value)} className="w-full bg-white border border-gray-300 rounded-xl p-3.5 text-sm text-gray-900 outline-none focus:border-yellow-500 transition-colors" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Gerência</label>
                  <input type="text" value={gerencia} onChange={e => setGerencia(e.target.value)} className="w-full bg-white border border-gray-300 rounded-xl p-3.5 text-sm text-gray-900 outline-none focus:border-yellow-500 transition-colors" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Liderança</label>
                  <input type="text" value={lideranca} onChange={e => setLideranca(e.target.value)} className="w-full bg-white border border-gray-300 rounded-xl p-3.5 text-sm text-gray-900 outline-none focus:border-yellow-500 transition-colors" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">TST</label>
                  <input type="text" value={tst} onChange={e => setTst(e.target.value)} className="w-full bg-white border border-gray-300 rounded-xl p-3.5 text-sm text-gray-900 outline-none focus:border-yellow-500 transition-colors" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Local</label>
                  <input type="text" value={local} onChange={e => setLocal(e.target.value)} className="w-full bg-white border border-gray-300 rounded-xl p-3.5 text-sm text-gray-900 outline-none focus:border-yellow-500 transition-colors" />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Horário</label>
                  <input type="text" value={horario} onChange={e => setHorario(e.target.value)} className="w-full bg-white border border-gray-300 rounded-xl p-3.5 text-sm text-gray-900 outline-none focus:border-yellow-500 transition-colors" />
                </div>
              </div>
            </div>

            <div className={`bg-[#faf9f6] border border-yellow-500/20 rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-sm transition-all duration-300 relative overflow-hidden ${isLocked ? 'opacity-70 pointer-events-none' : ''}`}>
              <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-yellow-100/50 to-transparent pointer-events-none" />
              <h2 className="text-xl font-display font-bold text-gray-900 mb-2 relative z-10 italic">Condições e Observações</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative z-10">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center gap-2"><Sun size={14} className="text-yellow-500" /> Manhã</label>
                  <div className="relative">
                    <select value={climaManha} onChange={e => setClimaManha(e.target.value)} className="w-full bg-white border border-gray-300 rounded-xl p-3.5 text-sm text-gray-900 outline-none focus:border-yellow-500 appearance-none">
                      <option value="Sol">Sol</option>
                      <option value="Chuva">Chuva</option>
                      <option value="Nublado">Nublado</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 text-xs">▼</div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center gap-2"><Sun size={14} className="text-orange-500" /> Tarde</label>
                  <div className="relative">
                    <select value={climaTarde} onChange={e => setClimaTarde(e.target.value)} className="w-full bg-white border border-gray-300 rounded-xl p-3.5 text-sm text-gray-900 outline-none focus:border-yellow-500 appearance-none">
                      <option value="Sol">Sol</option>
                      <option value="Chuva">Chuva</option>
                      <option value="Nublado">Nublado</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 text-xs">▼</div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">⚠️ Dificuldades/Desvios</label>
                  <textarea 
                    value={dificuldades} onChange={e => setDificuldades(e.target.value)}
                    className="w-full h-32 bg-white border border-gray-300 rounded-xl p-3.5 text-sm text-gray-900 outline-none focus:border-yellow-500 resize-none transition-colors"
                  />
                </div>
              </div>
            </div>
          </fieldset>

          {/* Right Column - Preview */}
          <div className="sticky top-6 bg-white border border-gray-200 rounded-3xl p-6 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="text-gray-800" size={20} />
              <h2 className="text-xl font-display font-bold italic text-gray-900">Prévia do Relatório</h2>
            </div>
            
            <div ref={previewRef} className="bg-[#faf9f6] border border-gray-200 p-5 rounded-2xl font-mono text-[13px] text-gray-800 whitespace-pre-wrap flex flex-col gap-0 relative overflow-y-auto max-h-[600px] leading-relaxed custom-scrollbar shadow-inner">
              
              <div>🏗️ EMPRESA: {empresa}</div>
              <div className="mt-2">📄 CONTRATO - {contrato}</div>
              <div className="mt-2">➡️ GERÊNCIA: {gerencia}</div>
              <div className="mt-2">➡️ LIDERANÇA: {lideranca}</div>
              <div className="mt-2">➡️ TST: {tst}</div>
              <div className="mt-2">➡️ LOCAL: {local}</div>
              <div className="mt-2">➡️ DATA: {formatLongDate(selectedDate)}</div>
              <div className="mt-2">➡️ HORÁRIO: {horario}</div>
              <div className="mt-2">➡️ DDS: A definir</div>

              <div className="mt-6 mb-2 font-bold">🛠️ ATIVIDADES:</div>
              
              <div className="mt-2 font-bold text-green-700">🌿 Jardinagem 🌿</div>
              <div className="mt-2 text-gray-600">{renderJardinagemText()}</div>

              <div className="mt-6 font-bold text-green-700">✳️ ÁREA GABIÃO ✳️</div>
              <div className="mt-2 text-gray-600">{renderGabiaoText()}</div>

              <div className="mt-6 font-bold text-green-700">🚚 ÁREA TRANSPORTE 🚚</div>
              <div className="mt-2 text-gray-600 whitespace-pre-wrap">{renderEfetivoPorArea('Área Transporte')}</div>

              <div className="mt-8 font-bold text-blue-700">
                {renderEquipamentosGeraisText().split('\n').map((line, i) => (
                  <div key={`geral-${i}`} className={i === 0 ? "font-bold text-blue-700" : "text-gray-600 font-normal"}>{line}</div>
                ))}
                
                <div className="mt-4">
                  {renderEquipamentosJardinagemText().split('\n').map((line, i) => (
                    <div key={`jardim-${i}`} className={i === 0 ? "font-bold text-green-700" : "text-gray-600 font-normal"}>{line}</div>
                  ))}
                </div>
              </div>

              <div className="mt-8 font-bold text-orange-600">    Condições climáticas:</div>
              <div className="text-gray-700">• MANHÃ = {climaManha}</div>
              <div className="text-gray-700">• TARDE = {climaTarde}</div>
              <div className="text-gray-700">• 🌡️ TEMPERATURA ATUAL = 27°C (sensação 32°C)</div>

              <div className="mt-6 font-bold text-red-600">⚠️ DIFICULDADES/DESVIOS</div>
              <div className="text-gray-700">{dificuldades}</div>

              <div className="mt-6 font-bold text-red-600">🔴 Cor Proibida do Mês (setembro): Vermelha</div>
              
            </div>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #aaa;
        }
      `}} />
    </div>
  )
}
