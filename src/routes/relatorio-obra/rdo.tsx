import CalendarIcon from 'lucide-react/dist/esm/icons/calendar.js';
import History from 'lucide-react/dist/esm/icons/history.js';
import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import Save from 'lucide-react/dist/esm/icons/save.js';
import Copy from 'lucide-react/dist/esm/icons/copy.js';
import Phone from 'lucide-react/dist/esm/icons/phone.js';
import Lock from 'lucide-react/dist/esm/icons/lock.js';
import Sun from 'lucide-react/dist/esm/icons/sun.js';
import * as Icons from 'lucide-react';
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useMonthlyColors } from '../../hooks/useMonthlyColors'
import { type RdoAtividade, getSubItens } from '@/components/rdo/ActivityCard'
import { ActivitiesPanel } from '@/components/rdo/ActivitiesPanel'
import type { CustomRdoDailyData } from '@/types/rdoCustomModule'
import { isVehicle } from '@/lib/equipamentos/equipmentTypes'
import { CIVIL_AREAS_DEFINITIONS } from '@/lib/civilAreasData'

const COLOR_NAMES: Record<string, string> = {
  red: 'Vermelha',
  blue: 'Azul',
  yellow: 'Amarela',
  green: 'Verde'
}

const COLOR_CLASSES: Record<string, string> = {
  red: 'text-red-600',
  blue: 'text-blue-600',
  yellow: 'text-yellow-600',
  green: 'text-green-600'
}

const COLOR_ICONS: Record<string, string> = {
  red: '🔴',
  blue: '🔵',
  yellow: '🟡',
  green: '🟢'
}

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
]

export const Route = createFileRoute('/relatorio-obra/rdo')({
  component: RDOPage,
})

export type RdoInfoGerais = {
  empresa: string;
  contrato: string;
  gerencia: string;
  lideranca: string;
  tst: string;
  local: string;
  horario: string;
};

export const DEFAULT_RDO_INFO_BARCARENA: RdoInfoGerais = {
  empresa: 'Sucena Empreendimentos',
  contrato: '460001269',
  gerencia: 'Hydro',
  lideranca: 'Eng. Luís Araújo',
  tst: 'Itamar Junior e Alexssandro Chaves',
  local: 'Alunorte Barcarena',
  horario: '07:00 as 17:00'
};

export const DEFAULT_RDO_INFO_CIVIL: RdoInfoGerais = {
  empresa: 'Sucena Empreendimentos',
  contrato: '4600013715',
  gerencia: 'Hydro',
  lideranca: 'Eng. Luís Araújo',
  tst: 'Itamar Junior e Alexssandro Chaves',
  local: 'Hydro Civil',
  horario: '07:00 as 17:00'
};

function RDOPage() {
  const { colors } = useMonthlyColors();

  const [empresa, setEmpresa] = useState('Sucena Empreendimentos');
  const [contrato, setContrato] = useState('460001269');
  const [gerencia, setGerencia] = useState('Hydro');
  const [lideranca, setLideranca] = useState('Eng. Luís Araújo');
  const [tst, setTst] = useState('Itamar Junior e Alexssandro Chaves');
  const [local, setLocal] = useState('Alunorte Barcarena');
  const [horario, setHorario] = useState('07:00 as 17:00');
  
  const [climaManha, setClimaManha] = useState('Sol');
  const [climaTarde, setClimaTarde] = useState('Sol');
  const [temperatura, setTemperatura] = useState('');
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

  const [currentEnv, setCurrentEnv] = useState<string>(() => {
    return typeof window !== 'undefined'
      ? (localStorage.getItem('sucena_environment') || 'barcarena')
      : 'barcarena';
  });

  const isCivil = currentEnv === 'hydro-civil';

  // Monitorar alterações de ambiente no sistema
  useEffect(() => {
    const handleEnvChange = (e: any) => {
      const newEnv = e.detail?.environment || localStorage.getItem('sucena_environment') || 'barcarena';
      setCurrentEnv(newEnv);
      loadDate(selectedDate, newEnv);
      updateSavedDates(newEnv);
    };
    window.addEventListener('sucena_environment_change', handleEnvChange);
    window.addEventListener('storage', handleEnvChange);
    return () => {
      window.removeEventListener('sucena_environment_change', handleEnvChange);
      window.removeEventListener('storage', handleEnvChange);
    };
  }, [selectedDate]);

  // States to hold Jardinagem and Gabiao data
  const [jardinagemData, setJardinagemData] = useState<any>(null);
  const [gabiaoData, setGabiaoData] = useState<any>(null);
  
  // Equipments from Supabase
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [presencas, setPresencas] = useState<any[]>([]);
  const [ddsText, setDdsText] = useState('A definir');

  // Custom activities state for RDO integration
  const [customAtividades, setCustomAtividades] = useState<RdoAtividade[]>([]);
  const [showActivitiesPanel, setShowActivitiesPanel] = useState(false);
  const [customModulosDaily, setCustomModulosDaily] = useState<CustomRdoDailyData[]>([]);

  const fetchPresencasForDate = async (dateStr: string) => {
    try {
      let query = supabase
        .from('rh_presencas')
        .select('*')
        .eq('data', dateStr)
        .eq('status', 'PRESENTE');

      const env = currentEnv || (typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena');
      if (env === 'hydro-civil') {
        query = query.eq('environment', 'hydro-civil');
      } else {
        query = query.or('environment.eq.barcarena,environment.is.null');
      }

      const { data: pData, error: pError } = await query;
        
      if (pError) throw pError;

      // Filtra áreas que foram colocadas em modo de edição (desbloqueadas)
      const filteredPData = (pData || []).filter(p => {
        if (typeof window !== 'undefined' && localStorage.getItem(`rh_unlocked_${dateStr}_${p.area}`) === 'true') {
          return false;
        }
        return true;
      });
      
      const { data: eData, error: eError } = await supabase
        .from('rh_efetivo')
        .select('id, nome, cargo');

      if (eError) throw eError;
      
      const efetivoMap = new Map((eData || []).map(c => [c.id, c]));
      const mapped = filteredPData.map(p => {
        const emp = efetivoMap.get(p.funcionario_id);
        return {
          ...p,
          nome: emp ? emp.nome : 'Desconhecido',
          cargo: emp ? emp.cargo : 'Sem Cargo'
        };
      });
      setPresencas(mapped);
    } catch(e) {
      console.error('Erro ao buscar presenças:', e);
    }
  }

  const updateSavedDates = async (envParam?: string) => {
    const env = envParam || currentEnv || (typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena');
    const isCivilEnv = env === 'hydro-civil';
    const prefix = isCivilEnv ? 'main_rdo_civil_' : 'main_rdo_';

    const localKeys = Object.keys(localStorage).filter(k => {
      if (isCivilEnv) return k.startsWith('main_rdo_civil_');
      return k.startsWith('main_rdo_') && !k.startsWith('main_rdo_civil_') && k !== 'main_rdo_defaults' && !k.includes('info_gerais');
    });

    const localDates = localKeys.filter(k => {
      try {
        const data = JSON.parse(localStorage.getItem(k) || '{}');
        return data.isLocked !== false;
      } catch (e) {
        return false;
      }
    }).map(k => k.replace(prefix, ''));

    let remoteDates: string[] = [];
    try {
      const { data } = await supabase.from('global_settings').select('key, value').like('key', `${prefix}%`);
      if (data) {
        remoteDates = data
          .filter(r => !r.key.includes('defaults') && !r.key.includes('info_gerais') && r.value?.isLocked !== false)
          .map(r => r.key.replace(prefix, ''));
      }
    } catch (e) {}

    const merged = Array.from(new Set([...localDates, ...remoteDates])).sort((a, b) => b.localeCompare(a));
    setSavedDates(merged);
  }

  const handleUnlock = async () => {
    const env = currentEnv;
    const isCivilEnv = env === 'hydro-civil';
    const mainKey = isCivilEnv ? `main_rdo_civil_${selectedDate}` : `main_rdo_${selectedDate}`;

    setIsLocked(false);
    let parsed: any = {};
    const localData = localStorage.getItem(mainKey);
    if (localData) {
      try { parsed = JSON.parse(localData); } catch (e) {}
    }
    parsed.isLocked = false;
    localStorage.setItem(mainKey, JSON.stringify(parsed));
    
    try {
      await supabase.from('global_settings').upsert({
        key: mainKey,
        value: parsed,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
    } catch (e) {}
    
    updateSavedDates();
  }

  const fetchEquipamentos = async (dateStr: string) => {
    try {
      const { data: allEqs, error } = await supabase
        .from('eq_equipments').select('id, name, plate_tag, category, type, location_status, environment, status, updated_at, last_exit_reason').eq('environment', typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena')
        .order('name', { ascending: true });
        
      if (error) throw error;
      
      // Calculate start and end of the specified date in Brazil time (UTC-3)
      const startDate = new Date(`${dateStr}T00:00:00-03:00`).toISOString();
      const endDate = new Date(`${dateStr}T23:59:59.999-03:00`).toISOString();
      
      const { data: movements } = await supabase
        .from('eq_movements')
        .select('equipment_id, movement_type, created_at')
        .eq('environment', typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena')
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });
        
      const movs = movements || [];

      const filtered = (allEqs || []).map(eq => {
        const eqMovs = movs.filter(m => m.equipment_id === eq.id);
        const lastMov = eqMovs[0];

        if (lastMov?.movement_type === 'exit') {
          const brokenDateObj = new Date(lastMov.created_at);
          const brokenDateTime = `${brokenDateObj.toLocaleDateString('pt-BR')} às ${brokenDateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

          if (lastMov.created_at < startDate) {
            const since = new Date(lastMov.created_at).toLocaleString('pt-BR', {
              dateStyle: 'short',
              timeStyle: 'short',
            });
            return { ...eq, outsideSince: since, brokenDateTime };
          }
          const time = new Date(lastMov.created_at).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          });
          return { ...eq, exitTime: time, brokenDateTime };
        }

        if (eq.location_status === 'outside' || eq.status === 'Quebrado') {
          const brokenDateObj = eq.updated_at ? new Date(eq.updated_at) : new Date();
          const brokenDateTime = `${brokenDateObj.toLocaleDateString('pt-BR')} às ${brokenDateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
          return { ...eq, outsideSince: brokenDateTime, brokenDateTime };
        }

        return eq;
      });

      setEquipamentos(filtered);
    } catch(e) {
      console.error(e);
    }
  };

  useEffect(() => {
    updateSavedDates();
    loadDate(selectedDate);
  }, []);

  useEffect(() => {
    // Setup realtime subscriptions to automatically update RDO when sub-reports or presences are saved
    const channel = supabase.channel(`rdo_realtime_${selectedDate}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_settings' }, (payload) => {
        const key = (payload.new as any)?.key || '';
        if (key === `jardinagem_rdo_${selectedDate}` || key === `gabiao_rdo_${selectedDate}`) {
          supabase.from('global_settings').select('key, value').in('key', [`jardinagem_rdo_${selectedDate}`, `gabiao_rdo_${selectedDate}`])
            .then(({ data }) => {
              if (data) {
                data.forEach(item => {
                  if (item.key.startsWith('jardinagem_rdo_')) { setJardinagemData(item.value); localStorage.setItem(item.key, JSON.stringify(item.value)); }
                  if (item.key.startsWith('gabiao_rdo_')) { setGabiaoData(item.value); localStorage.setItem(item.key, JSON.stringify(item.value)); }
                });
              }
            });
        }
        if (key.startsWith('custom_rdo_') && key.endsWith(`_${selectedDate}`)) {
          fetchCustomModulosForDate(selectedDate, currentEnv);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rh_presencas', filter: `data=eq.${selectedDate}` }, () => {
        fetchPresencasForDate(selectedDate);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rdo_atividades' }, () => {
        // Refresh custom activities when they change
        fetchCustomAtividades(selectedDate, currentEnv);
      })
      .subscribe();

    const handleLocalRdoSaved = () => {
      fetchCustomModulosForDate(selectedDate, currentEnv);
    };
    window.addEventListener('sucena_rdo_saved', handleLocalRdoSaved);
    const handlePresencaEvent = () => fetchPresencasForDate(selectedDate);
    window.addEventListener('sucena_presenca_change', handlePresencaEvent);
    window.addEventListener('storage', handleLocalRdoSaved);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('sucena_rdo_saved', handleLocalRdoSaved);
      window.removeEventListener('sucena_presenca_change', handlePresencaEvent);
      window.removeEventListener('storage', handleLocalRdoSaved);
    };
  }, [selectedDate]);

  // Fetch custom activities from database
  const fetchCustomAtividades = async (dateStr: string, envParam?: string) => {
    try {
      const environment = envParam || currentEnv || (typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena');
      const isCivilEnv = environment === 'hydro-civil';
      const { data, error } = await supabase
        .from('rdo_atividades')
        .select('*')
        .eq('data', dateStr)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const filteredData = (data || []).filter(a => {
        if (a.obra_id) return a.obra_id === environment;
        const isCivilArea = (a.area || '').toLowerCase().includes('civil') || (a.area || '').toLowerCase().includes('canteiro');
        return isCivilEnv ? isCivilArea : !isCivilArea;
      });
      setCustomAtividades(filteredData);
    } catch (error) {
      console.error('Erro ao buscar atividades customizadas:', error);
    }
  };

  const fetchCustomModulosForDate = async (dateStr: string, envParam?: string) => {
    try {
      const env = envParam || currentEnv || (typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena');
      const isCivilEnv = env === 'hydro-civil';

      const civilDefIds = new Set(CIVIL_AREAS_DEFINITIONS.map(a => a.id));
      const civilCustomIds = new Set<string>();
      try {
        const { data: civilSettings } = await supabase
          .from('global_settings')
          .select('value')
          .eq('key', 'rdo_modulos_customizados_hydro-civil')
          .single();
        if (civilSettings && Array.isArray(civilSettings.value)) {
          civilSettings.value.forEach((m: any) => { if (m.id) civilCustomIds.add(m.id); });
        }
      } catch (e) {}

      if (typeof window !== 'undefined') {
        try {
          const localCivil = JSON.parse(localStorage.getItem('rdo_modulos_customizados_hydro-civil') || '[]');
          if (Array.isArray(localCivil)) {
            localCivil.forEach((m: any) => { if (m.id) civilCustomIds.add(m.id); });
          }
        } catch (e) {}
      }

      const isItemCivil = (d: CustomRdoDailyData, storageKey?: string): boolean => {
        if (d.environment === 'hydro-civil') return true;
        if (d.environment === 'barcarena') return false;
        if (d.moduloId && (d.moduloId.startsWith('civil-') || civilDefIds.has(d.moduloId) || civilCustomIds.has(d.moduloId))) return true;
        if (storageKey && (storageKey.includes('civil-') || storageKey.includes('_hydro-civil_'))) return true;
        const name = (d.moduloName || '').trim().toLowerCase();
        if (name.includes('canteiro') && name.includes('sucena')) return true;
        if (name.includes('canteiro') && name.includes('hydro')) return true;
        if (CIVIL_AREAS_DEFINITIONS.some(c => c.name.toLowerCase() === name)) return true;
        return false;
      };

      // Buscar todos os registros diários de atividades salvas para a data
      const { data: list } = await supabase
        .from('global_settings')
        .select('key, value')
        .like('key', `custom_rdo_%_${dateStr}`);

      const map = new Map<string, CustomRdoDailyData>();
      if (list) {
        list.forEach((item: any) => {
          if (item.value) {
            const val = item.value as CustomRdoDailyData;
            map.set(item.key, val);
            localStorage.setItem(item.key, JSON.stringify(item.value));
          }
        });
      }

      // Fallback ao localStorage
      if (typeof window !== 'undefined') {
        Object.keys(localStorage).forEach(k => {
          if (k.startsWith('custom_rdo_') && k.endsWith(`_${dateStr}`) && !map.has(k)) {
            try {
              const val = JSON.parse(localStorage.getItem(k) || '');
              if (val) {
                map.set(k, val);
              }
            } catch (e) {}
          }
        });
      }

      const allDailyEntries = Array.from(map.entries());
      const filteredByEnv = allDailyEntries
        .filter(([k, d]) => {
          const itemIsCivil = isItemCivil(d, k);
          return isCivilEnv ? itemIsCivil : !itemIsCivil;
        })
        .map(([, d]) => d);

      // Manter todas as atividades que possuam dados ou resumo
      const validDaily = filteredByEnv.filter(d => {
        if (!d) return false;
        if (d.renderedSummary && d.renderedSummary.trim() && !d.renderedSummary.startsWith('Nenhuma atividade')) return true;
        if (d.outrasAtividades?.descricao && d.outrasAtividades.descricao.trim()) return true;
        if (d.cardRows && Object.values(d.cardRows).some(rows => rows.some(r => r.value && r.value !== '0' && r.value !== '0,00'))) return true;
        if (d.cardCheckboxes && Object.values(d.cardCheckboxes).some(v => v)) return true;
        return false;
      });

      setCustomModulosDaily(validDaily);
    } catch (err) {
      console.error('Erro ao buscar dados de módulos customizados:', err);
    }
  };

  const handleSaveInfoGerais = async () => {
    const env = currentEnv;
    const infoKey = `rdo_info_gerais_${env}`;
    const infoData: RdoInfoGerais = {
      empresa,
      contrato,
      gerencia,
      lideranca,
      tst,
      local,
      horario
    };

    localStorage.setItem(infoKey, JSON.stringify(infoData));

    try {
      await supabase.from('global_settings').upsert({
        key: infoKey,
        value: infoData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
      
      const envNome = env === 'hydro-civil' ? 'Hydro Civil' : 'Reabilitação (Barcarena)';
      toast.success(`Informações Gerais salvas para ${envNome}! Ficarão salvas até serem alteradas novamente.`);
    } catch (err) {
      console.error('Erro ao salvar Informações Gerais no banco:', err);
      toast.success('Informações salvas localmente!');
    }
  };

  const loadDate = async (dateStr: string, envParam?: string) => {
    const env = envParam || currentEnv || (typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena');
    const isCivilEnv = env === 'hydro-civil';
    const mainKey = isCivilEnv ? `main_rdo_civil_${dateStr}` : `main_rdo_${dateStr}`;
    const infoKey = `rdo_info_gerais_${env}`;

    setSelectedDate(dateStr);
    fetchEquipamentos(dateStr);
    fetchPresencasForDate(dateStr);
    fetchCustomAtividades(dateStr);
    fetchCustomModulosForDate(dateStr);
    
    // Buscar DDS
    try {
      const { data: schedule } = await supabase
        .from('seguranca_dds')
        .select('*')
        .eq('date', dateStr)
        .single();
        
      if (schedule && schedule.palestrante_id) {
        const { data: users } = await supabase.rpc('get_system_users');
        const user = (users || []).find((u: any) => u.id === schedule.palestrante_id);
        const palestrante = user ? user.nome : 'Desconhecido';
        setDdsText(`${schedule.tema || 'Sem tema'} (Palestrante: ${palestrante})`);
      } else if (schedule && schedule.tema) {
         setDdsText(`${schedule.tema}`);
      } else {
         setDdsText('A definir');
      }
    } catch(e) {
      setDdsText('A definir');
    }
    
    const isFriday = new Date(dateStr + 'T12:00:00Z').getUTCDay() === 5;
    const defaultHorario = isFriday ? '07:00 as 16:00' : '07:00 as 17:00';
    
    let mainData: any = null;
    let jarData: any = null;
    let gabData: any = null;
    let savedInfoGerais: RdoInfoGerais | null = null;
    
    try {
      const keysToFetch = [mainKey, `jardinagem_rdo_${dateStr}`, `gabiao_rdo_${dateStr}`, infoKey];
      if (!isCivilEnv) {
        keysToFetch.push(`main_rdo_${dateStr}`);
      }
      const { data } = await supabase.from('global_settings').select('key, value').in('key', keysToFetch);
      if (data) {
        data.forEach(item => {
          if (item.key === mainKey) { mainData = item.value; localStorage.setItem(item.key, JSON.stringify(item.value)); }
          if (item.key === infoKey && item.value) { savedInfoGerais = item.value; localStorage.setItem(item.key, JSON.stringify(item.value)); }
          if (item.key.startsWith('jardinagem_rdo_')) { jarData = item.value; localStorage.setItem(item.key, JSON.stringify(item.value)); }
          if (item.key.startsWith('gabiao_rdo_')) { gabData = item.value; localStorage.setItem(item.key, JSON.stringify(item.value)); }
        });
      }
    } catch(e) {}

    // Fallbacks do localStorage
    if (!mainData) { const local = localStorage.getItem(mainKey); if (local) try { mainData = JSON.parse(local); } catch(e){} }
    if (!savedInfoGerais) { const localInfo = localStorage.getItem(infoKey); if (localInfo) try { savedInfoGerais = JSON.parse(localInfo); } catch(e){} }
    if (!jarData) { const local = localStorage.getItem(`jardinagem_rdo_${dateStr}`); if (local) try { jarData = JSON.parse(local); } catch(e){} }
    if (!gabData) { const local = localStorage.getItem(`gabiao_rdo_${dateStr}`); if (local) try { gabData = JSON.parse(local); } catch(e){} }

    const baseDefaults: RdoInfoGerais = isCivilEnv ? DEFAULT_RDO_INFO_CIVIL : DEFAULT_RDO_INFO_BARCARENA;
    const resolvedInfo: RdoInfoGerais = {
      ...baseDefaults,
      ...(savedInfoGerais || {})
    };

    if (mainData) {
      setEmpresa(mainData.empresa || resolvedInfo.empresa);
      setContrato(mainData.contrato || resolvedInfo.contrato);
      setGerencia(mainData.gerencia || resolvedInfo.gerencia);
      setLideranca(mainData.lideranca || resolvedInfo.lideranca);
      setTst(mainData.tst || resolvedInfo.tst);
      setLocal(mainData.local || resolvedInfo.local);
      let savedHorario = mainData.horario || resolvedInfo.horario;
      if (savedHorario === '07:00 as 17:00' && isFriday) savedHorario = '07:00 as 16:00';
      setHorario(savedHorario || defaultHorario);
      setClimaManha(mainData.climaManha || 'Sol');
      setClimaTarde(mainData.climaTarde || 'Sol');
      setTemperatura(mainData.temperatura || '');
      setDificuldades(mainData.dificuldades || 'Não Houve.');
      setIsLocked(mainData.isLocked !== false);
      setShowHistory(false);
    } else {
      // Data ainda não salva: carrega as Informações Gerais salvas deste ambiente
      setEmpresa(resolvedInfo.empresa);
      setContrato(resolvedInfo.contrato);
      setGerencia(resolvedInfo.gerencia);
      setLideranca(resolvedInfo.lideranca);
      setTst(resolvedInfo.tst);
      setLocal(resolvedInfo.local);
      let currentHorario = resolvedInfo.horario || defaultHorario;
      if (currentHorario === '07:00 as 17:00' && isFriday) currentHorario = '07:00 as 16:00';
      setHorario(currentHorario);
      setClimaManha('Sol');
      setClimaTarde('Sol');
      setTemperatura('');
      setDificuldades('Não Houve.');
      setIsLocked(false);
      setShowHistory(false);

      // Auto-fetch temperature if it is today
      const today = new Date().toISOString().split('T')[0];
      if (dateStr === today) {
        let lat = -1.5061, lon = -48.6258; // Default Barcarena
        if (isCivilEnv) { lat = -2.9998; lon = -47.3537; }
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`)
          .then(res => res.json())
          .then(data => {
            if (data?.current?.temperature_2m !== undefined) {
              setTemperatura(Math.round(data.current.temperature_2m).toString());
            }
          }).catch(console.error);
      }
    }

    setJardinagemData(jarData);
    setGabiaoData(gabData);
  }

  const handleSave = async () => {
    const env = currentEnv;
    const isCivilEnv = env === 'hydro-civil';
    const mainKey = isCivilEnv ? `main_rdo_civil_${selectedDate}` : `main_rdo_${selectedDate}`;
    const infoKey = `rdo_info_gerais_${env}`;

    const dataToSave = {
      empresa, contrato, gerencia, lideranca, tst, local, horario,
      climaManha, climaTarde, temperatura, dificuldades,
      environment: env,
      isLocked: true
    };

    const infoData: RdoInfoGerais = {
      empresa, contrato, gerencia, lideranca, tst, local, horario
    };

    localStorage.setItem(mainKey, JSON.stringify(dataToSave));
    localStorage.setItem(infoKey, JSON.stringify(infoData));
    localStorage.setItem('main_rdo_defaults', JSON.stringify(infoData));

    setIsLocked(true);
    toast.success('RDO salvo com sucesso para a data ' + formatDateDisplay(selectedDate));
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sucena_rdo_saved', { detail: { date: selectedDate, moduloId: 'rdo', environment: env } }));
    }
    
    try {
      await Promise.all([
        supabase.from('global_settings').upsert({
          key: mainKey,
          value: dataToSave,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' }),
        supabase.from('global_settings').upsert({
          key: infoKey,
          value: infoData,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' })
      ]);
      
      const { logActivity } = await import('../../lib/logActivity');
      await logActivity({
        module: 'RDO',
        action: `RDO Principal salvo para ${formatDateDisplay(selectedDate)} (${env})`
      });
    } catch (e) {
      console.error('Erro ao salvar no banco:', e);
    }
    
    updateSavedDates();
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
    if (typeof window !== 'undefined' && localStorage.getItem(`rh_unlocked_${selectedDate}_${area}`) === 'true') {
      return '';
    }
    const pArea = presencas.filter(p => p.area === area);
    if (pArea.length === 0) {
      return '';
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
    const efetivoText = renderEfetivoPorArea('Área Jardinagem');
    if (!jardinagemData) {
      if (!efetivoText) {
        return '⚠️ Relatório diário e Lista de Presença de Jardinagem ainda não salvos para esta data.';
      }
      return `⚠️ Relatório diário de Jardinagem ainda não salvo para esta data.\n\n${efetivoText}`;
    }
    
    let text = "";
    let lines = [];
    
    const d = jardinagemData;
    
    const formatBerma = (b?: string) => {
      if (!b) return '';
      const match = b.match(/^(?:Berma|Elevado)?\s*(\d+)$/i);
      if (match) {
        const n = parseInt(match[1], 10);
        return n % 2 === 0 ? `Berma ${n}` : `Elevado ${n}`;
      }
      return b;
    };
    
    const addRows = (title: string, data: any[], unit: string) => {
      if (!data) return;
      const valid = data.filter((x:any) => x.value && x.value !== '0' && x.value !== '0,00' && x.value !== '0.00');
      valid.forEach((row:any) => {
        const b = formatBerma(row.berma);
        const cleanVal = String(row.value).replace(/,00$/, '');
        lines.push(`* ${title}: ${cleanVal} ${unit} - ${row.faixa}${b ? ` ${b}` : ''}`);
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
        const b = formatBerma(row.berma);
        lines.push(`* Plantio (${row.especie}): ${row.value} unid - ${row.faixa}${b ? ` ${b}` : ''}`);
      });
    }
    
    addRows('Limpeza Manual', d.limpezaManual, 'm²');
    addRows('Limpeza com Soprador', d.limpezaSoprador, 'm²');
    
    if (d.invasoras) {
      const valid = d.invasoras.filter((x:any) => x.value && x.value !== '0' && x.value !== '0,00' && x.value !== '0.00');
      valid.forEach((row:any) => {
        const b = formatBerma(row.berma);
        lines.push(`* Retirada de Invasoras (${row.nome}): ${row.value} m² - ${row.faixa}${b ? ` ${b}` : ''}`);
      });
    }
    
    addRows('Retirada de Mudas - Árvores', d.retiradaMudas, 'unid');
    addRows('Plantio de Grama', d.plantioGrama, 'm²');
    
    if (d.outrasDesc && d.outrasDesc.trim() !== '') {
      const b = formatBerma(d.outrasBerma);
      lines.push(`* ${d.outrasDesc.trim()} - ${d.outrasFaixa}${b ? ` ${b}` : ''}`);
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
      text = lines.join('\n') + (efetivoText ? `\n\n${efetivoText}` : '');
    } else {
      text = 'Nenhuma atividade de jardinagem preenchida.' + (efetivoText ? `\n\n${efetivoText}` : '');
    }
    
    return text;
  }

  const renderGabiaoText = () => {
    const efetivoText = renderEfetivoPorArea('Área Gabião');
    if (!gabiaoData) {
      if (!efetivoText) {
        return '⚠️ Relatório diário e Lista de Presença de Gabião ainda não salvos para esta data.';
      }
      return `⚠️ Relatório diário de Gabião ainda não salvo para esta data.\n\n${efetivoText}`;
    }
    
    let text = "";
    let lines = [];
    const d = gabiaoData;
    
    if (d.localFaixa) {
      const formatElevado = (val?: string) => {
        if (!val || val === 'Nenhum') return '';
        const match = val.match(/^(?:Berma|Elevado)?\s*(\d+)$/i);
        if (match) {
          const n = parseInt(match[1], 10);
          return n % 2 === 0 ? `Berma ${n}` : `Elevado ${n}`;
        }
        return val;
      };
      const elStr = formatElevado(d.localElevado);
      lines.push(`📍 Local: ${d.localFaixa}${d.localFase && d.localFase !== 'Nenhuma' ? ` - ${d.localFase}` : ''}${elStr ? ` - ${elStr}` : ''}`);
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
      text = lines.join('\n') + (efetivoText ? `\n\n${efetivoText}` : '');
    } else {
      text = 'Nenhuma atividade de Gabião preenchida.' + (efetivoText ? `\n\n${efetivoText}` : '');
    }
    
    return text;
  }

  const renderCustomModuleText = (d: CustomRdoDailyData) => {
    if (!d) return '';
    const modTitle = d.moduloName || (d as any).moduloNome || 'Atividade';
    const efetivo = renderEfetivoPorArea(modTitle);

    if (d.renderedSummary && d.renderedSummary.trim() && !d.renderedSummary.startsWith('Nenhuma atividade')) {
      return d.renderedSummary.trim() + (efetivo ? `\n\n${efetivo}` : '');
    }

    const lines: string[] = [];

    const locParts: string[] = [];
    if (!isCivil && d.localFaixa) locParts.push(`Faixa: ${d.localFaixa}`);
    if (!isCivil && d.localElevado) locParts.push(`Local: ${d.localElevado}`);
    if (locParts.length > 0) {
      lines.push(`📍 Localização: ${locParts.join(' | ')}`);
    }

    const marked = (d.itens || []).filter(i => i.marcado);
    marked.forEach(it => {
      let itemLine = `* ${it.nome}`;
      if (it.tipo === 'medicao' && it.valor) {
        itemLine += `: ${it.valor} ${it.unidade || 'm²'}`;
      }
      const loc: string[] = [];
      if (!isCivil && it.faixa) loc.push(it.faixa);
      if (!isCivil && it.berma) loc.push(it.berma);
      if (loc.length > 0) itemLine += ` (${loc.join(' - ')})`;
      if (it.detalhe) itemLine += ` - ${it.detalhe}`;
      lines.push(itemLine);
    });

    if (d.observacoes && d.observacoes.trim()) {
      lines.push('');
      lines.push(`📝 *Observações:*`);
      lines.push(d.observacoes.trim());
    }

    if (lines.length > 0) {
      return lines.join('\n') + (efetivo ? `\n\n${efetivo}` : '');
    }
    return `Nenhuma atividade preenchida para ${modTitle}.\n\n${efetivo}`;
  }



  const renderEquipamentosGeraisText = () => {
    let lines = [];
    const isLeveOuCanteiro = (eq: any) => {
      const cat = (eq.category || '').toLowerCase();
      return cat.includes('leve') || cat.includes('canteiro') || eq.name.toUpperCase().includes('SUC 01');
    };
    const isJardinagem = (eq: any) => (eq.category || '').toLowerCase().includes('jardinagem');

    // Equipamento quebrado (sem ser veículo): não conta no RDO e mostra data/hora da quebra
    const isEqQuebrado = (eq: any) => !isVehicle(eq) && (!!eq.outsideSince || !!eq.exitTime);
    // Veículo fora desde antes
    const isVeiculoForaAntes = (eq: any) => isVehicle(eq) && !!eq.outsideSince;

    const eqPesados = equipamentos.filter(eq => !isJardinagem(eq) && !isLeveOuCanteiro(eq));
    const eqLeves = equipamentos.filter(eq => isLeveOuCanteiro(eq));

    // Na obra / operando:
    // Para veículos: não está fora desde antes
    // Para equipamentos não-veículos: NÃO está quebrado
    const eqPesadosNaObra = eqPesados.filter(eq => isVehicle(eq) ? !isVeiculoForaAntes(eq) : !isEqQuebrado(eq));
    const eqLevesNaObra = eqLeves.filter(eq => isVehicle(eq) ? !isVeiculoForaAntes(eq) : !isEqQuebrado(eq));

    lines.push(`✅ EQUIPAMENTOS EM OPERAÇÃO (${eqPesadosNaObra.length})`);
    if (eqPesadosNaObra.length > 0) {
      eqPesadosNaObra.forEach(eq => {
        let eqNameStr = `• ${eq.name} - ${eq.plate_tag ? eq.plate_tag.toUpperCase() : ''}`;
        if (eq.exitTime && isVehicle(eq)) {
          eqNameStr += ` (Saiu às ${eq.exitTime})`;
        }
        lines.push(eqNameStr);
      });
    } else {
      lines.push(`Nenhum equipamento pesado na obra.`);
    }

    const veiculosPesadosFora = eqPesados.filter(isVeiculoForaAntes);
    if (veiculosPesadosFora.length > 0) {
      lines.push('');
      lines.push(`⛔ FORA DA OBRA (${veiculosPesadosFora.length})`);
      veiculosPesadosFora.forEach(eq => {
        lines.push(`• ${eq.name} - ${eq.plate_tag ? eq.plate_tag.toUpperCase() : ''} (Fora desde ${eq.outsideSince})`);
      });
    }

    const eqPesadosQuebrados = eqPesados.filter(isEqQuebrado);
    if (eqPesadosQuebrados.length > 0) {
      lines.push('');
      lines.push(`⛔ EQUIPAMENTOS FORA DE OPERAÇÃO / QUEBRADOS / EMPRESTADOS (${eqPesadosQuebrados.length})`);
      eqPesadosQuebrados.forEach(eq => {
        const isLoan = eq.last_exit_reason === 'loaned' || eq.status === 'Emprestado';
        lines.push(`• ${eq.name} - ${eq.plate_tag ? eq.plate_tag.toUpperCase() : ''} (${isLoan ? 'Emprestado' : 'Quebrado'} em ${eq.brokenDateTime || eq.outsideSince})`);
      });
    }

    lines.push('');

    lines.push(`✅ EQUIPAMENTOS LEVES E CANTEIRO (${eqLevesNaObra.length})`);
    if (eqLevesNaObra.length > 0) {
      eqLevesNaObra.forEach(eq => {
        let eqNameStr = `• ${eq.name} - ${eq.plate_tag ? eq.plate_tag.toUpperCase() : ''}`;
        if (eq.exitTime && isVehicle(eq)) {
          eqNameStr += ` (Saiu às ${eq.exitTime})`;
        }
        lines.push(eqNameStr);
      });
    } else {
      lines.push(`Nenhum equipamento leve ou de canteiro na obra.`);
    }

    const veiculosLevesFora = eqLeves.filter(isVeiculoForaAntes);
    if (veiculosLevesFora.length > 0) {
      lines.push('');
      lines.push(`⛔ FORA DA OBRA - VEÍCULOS LEVES (${veiculosLevesFora.length})`);
      veiculosLevesFora.forEach(eq => {
        lines.push(`• ${eq.name} - ${eq.plate_tag ? eq.plate_tag.toUpperCase() : ''} (Fora desde ${eq.outsideSince})`);
      });
    }

    const eqLevesQuebrados = eqLeves.filter(isEqQuebrado);
    if (eqLevesQuebrados.length > 0) {
      lines.push('');
      lines.push(`⛔ EQUIPAMENTOS LEVES/CANTEIRO (QUEBRADOS / EMPRESTADOS) (${eqLevesQuebrados.length})`);
      eqLevesQuebrados.forEach(eq => {
        const isLoan = eq.last_exit_reason === 'loaned' || eq.status === 'Emprestado';
        lines.push(`• ${eq.name} - ${eq.plate_tag ? eq.plate_tag.toUpperCase() : ''} (${isLoan ? 'Emprestado' : 'Quebrado'} em ${eq.brokenDateTime || eq.outsideSince})`);
      });
    }

    return lines.join('\n');
  }

  const renderEquipamentosJardinagemText = () => {
    let lines = [];
    const eqJardim = equipamentos.filter(eq => eq.category === 'Jardinagem');
    const isEqQuebrado = (eq: any) => !isVehicle(eq) && (!!eq.outsideSince || !!eq.exitTime);

    const eqJardimQuebrados = eqJardim.filter(isEqQuebrado);
    const eqJardimFuncionando = eqJardim.filter(eq => !isEqQuebrado(eq));

    lines.push(`✅ Equipamentos Jardinagem na Obra (${eqJardimFuncionando.length})`);
    if (eqJardimFuncionando.length > 0) {
      const counts: Record<string, number> = {};
      eqJardimFuncionando.forEach(eq => {
        counts[eq.name] = (counts[eq.name] || 0) + 1;
      });
      Object.entries(counts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([name, count]) => {
          lines.push(`• ${count} ${name}`);
        });
    } else {
      lines.push(`Nenhum equipamento de jardinagem operando na obra.`);
    }

    if (eqJardimQuebrados.length > 0) {
      lines.push('');
      lines.push(`⛔ EQUIPAMENTOS JARDINAGEM (QUEBRADOS / EMPRESTADOS) (${eqJardimQuebrados.length})`);
      eqJardimQuebrados.forEach(eq => {
        const isLoan = eq.last_exit_reason === 'loaned' || eq.status === 'Emprestado';
        lines.push(`• ${eq.name}${eq.plate_tag ? ` (${eq.plate_tag.toUpperCase()})` : ''} - ${isLoan ? 'Emprestado' : 'Quebrado'} em ${eq.brokenDateTime || eq.outsideSince}`);
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
              <h1 className="text-3xl sm:text-4xl tracking-tight font-bold text-gray-900">RDO - Relatório Diário de Obra</h1>
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
            <button
              onClick={() => setShowActivitiesPanel(!showActivitiesPanel)}
              className={`flex items-center gap-2 border px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm
                ${showActivitiesPanel ? 'bg-yellow-100 border-yellow-400 text-yellow-800' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
              title="Atividades Customizadas"
            >
              <Icons.Activity size={16} className={showActivitiesPanel ? 'text-yellow-600' : ''} />
              Atividades
            </button>
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
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${ d === selectedDate ? 'bg-yellow-100 border-yellow-300 text-yellow-800' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100' }`}
                    >
                      {formatDateDisplay(d)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

          {/* Atividades Customizadas Panel */}
          {showActivitiesPanel && (
            <div className="px-4 sm:px-8">
              <ActivitiesPanel
                dataAtual={selectedDate}
                onIntegrateWithRDO={(atividades) => {
                  setCustomAtividades(atividades);
                  toast.success(`${atividades.length} atividades integradas ao RDO!`);
                }}
              />
            </div>
          )}

          <div className="px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 items-start mt-4">
          
          {/* Left Column - Form */}
          <fieldset disabled={isLocked} className="min-w-0 p-0 m-0 border-none flex flex-col gap-6">
            
            <div className={`bg-[#faf9f6] border border-yellow-500/20 rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-sm transition-all duration-300 relative overflow-hidden ${isLocked ? 'opacity-70 pointer-events-none' : ''}`}>
              <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-yellow-100/50 to-transparent pointer-events-none" />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10 mb-2">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Informações Gerais</h2>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isCivil ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isCivil ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    {isCivil ? 'Ambiente: Hydro Civil' : 'Ambiente: Reabilitação (Barcarena)'}
                  </span>
                </div>
                {!isLocked && (
                  <button 
                    type="button"
                    onClick={handleSaveInfoGerais}
                    className="self-start sm:self-auto flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                    title="Salvar estas informações como padrão deste ambiente"
                  >
                    <Save size={14} /> Salvar Informações
                  </button>
                )}
              </div>
              
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
              <h2 className="text-xl font-bold text-gray-900 mb-2 relative z-10">Condições e Observações</h2>
              
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
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Temperatura (°C)</label>
                  <input type="text" value={temperatura} onChange={e => setTemperatura(e.target.value)} placeholder="Ex: 27" className="w-full bg-white border border-gray-300 rounded-xl p-3.5 text-sm text-gray-900 outline-none focus:border-yellow-500 transition-colors" />
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
              <h2 className="text-xl font-bold text-gray-900">Prévia do Relatório</h2>
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
              <div className="mt-2">➡️ DDS: {ddsText}</div>

              <div className="mt-6 mb-2 font-bold">🛠️ ATIVIDADES:</div>
              
              {(() => {
                const defaultAreasToRender = isCivil
                  ? ['Área Transporte']
                  : ['Área Jardinagem', 'Área Gabião', 'Área Transporte'];
                
                const rawAreasComPresenca = Array.from(new Set(presencas.map(p => p.area))).filter(Boolean) as string[];
                const areasComPresenca = isCivil
                  ? rawAreasComPresenca.filter(a => a !== 'Área Jardinagem' && a !== 'Área Gabião')
                  : rawAreasComPresenca.filter(a => !CIVIL_AREAS_DEFINITIONS.some(c => c.name.toLowerCase() === a.toLowerCase()) && !a.toLowerCase().includes('civil') && !a.toLowerCase().includes('canteiro sucena'));
                
                const todasAreas = Array.from(new Set([...defaultAreasToRender, ...areasComPresenca]));
                
                return todasAreas.map(area => {
                  if (area === 'Área Jardinagem') {
                    if (isCivil) return null;
                    return (
                      <div key={area}>
                        <div className="mt-2 font-bold text-green-700">🌿 Jardinagem 🌿</div>
                        <div className="mt-2 text-gray-600">{renderJardinagemText()}</div>
                      </div>
                    );
                  }
                  if (area === 'Área Gabião') {
                    if (isCivil) return null;
                    return (
                      <div key={area}>
                        <div className="mt-6 font-bold text-green-700">✳️ ÁREA GABIÃO ✳️</div>
                        <div className="mt-2 text-gray-600">{renderGabiaoText()}</div>
                      </div>
                    );
                  }
                  if (area === 'Área Transporte') {
                    const efetivoText = renderEfetivoPorArea('Área Transporte');
                    if (!efetivoText) return null;
                    return (
                      <div key={area}>
                        <div className="mt-6 font-bold text-green-700">🚚 ÁREA TRANSPORTE 🚚</div>
                        <div className="mt-2 text-gray-600 whitespace-pre-wrap">{efetivoText}</div>
                      </div>
                    );
                  }
                  // Qualquer outra área nova adicionada no sistema
                  const efetivoText = renderEfetivoPorArea(area);
                  if (!efetivoText) return null;
                  return (
                    <div key={area}>
                      <div className="mt-6 font-bold text-green-700">🏗️ {area.toUpperCase()} 🏗️</div>
                      <div className="mt-2 text-gray-600 whitespace-pre-wrap">{efetivoText}</div>
                    </div>
                  );
                });
              })()}

              {/* Custom Activities Section */}
              {customAtividades.length > 0 && (
                <div className="mt-6 font-bold text-purple-700">
                  <div className="font-bold">📋 OUTRAS ATIVIDADES 📋</div>
                  {customAtividades.map((a, idx) => {
                    const subItens = getSubItens(a);
                    const markedSubItens = subItens.filter(si => si.marcado);

                    return (
                      <div key={a.id || idx} className="mt-2 text-gray-700">
                        <div className={a.concluido ? 'line-through opacity-70 font-semibold' : 'font-semibold'}>
                          {a.concluido ? '✅' : '○'} {a.titulo}
                          {a.quantidade !== undefined && a.quantidade !== null && ` - Qtd: ${a.quantidade}`}
                          {a.metragem !== undefined && a.metragem !== null && ` - ${a.metragem} ${a.unidade || 'm²'}`}
                          {a.area && ` (${a.area})`}
                        </div>
                        {markedSubItens.length > 0 ? (
                          <div className="ml-4 mt-1 space-y-0.5 text-xs sm:text-sm font-normal text-gray-700">
                            {markedSubItens.map(si => {
                              const bStr = !isCivil && si.berma ? ` (${si.berma})` : '';
                              const fStr = !isCivil && si.faixa ? ` - ${si.faixa}` : '';
                              const vStr = si.tipo === 'medicao' && si.valor ? `: ${si.valor} ${si.unidade || 'm²'}` : '';
                              const dStr = si.detalhe ? ` (${si.detalhe})` : '';
                              return (
                                <div key={si.id}>
                                  * {si.nome}{vStr}{fStr}{bStr}{dStr}
                                </div>
                              );
                            })}
                          </div>
                        ) : a.descricao ? (
                          <div className="ml-4 mt-0.5 text-xs sm:text-sm font-normal text-gray-600 italic">
                            {a.descricao}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Módulos Customizados de Atividades Criados pelos Encarregados */}
              {customModulosDaily.map((modData) => {
                const title = modData.moduloName || (modData as any).moduloNome || 'Atividade';
                return (
                  <div key={modData.moduloId || title} className="mt-6">
                    <div className="font-bold text-amber-700">⭐ {title.toUpperCase()} ⭐</div>
                    <div className="mt-2 text-gray-700 whitespace-pre-wrap">
                      {renderCustomModuleText(modData)}
                    </div>
                  </div>
                );
              })}

              <div className="mt-8 font-bold text-blue-700">
                {renderEquipamentosGeraisText().split('\n').map((line, i) => (
                  <div key={`geral-${i}`} className={i === 0 ? "font-bold text-blue-700" : "text-gray-600 font-normal"}>{line}</div>
                ))}
                
                {!isCivil && (
                  <div className="mt-4">
                    {renderEquipamentosJardinagemText().split('\n').map((line, i) => (
                      <div key={`jardim-${i}`} className={i === 0 ? "font-bold text-green-700" : "text-gray-600 font-normal"}>{line}</div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-8 font-bold text-orange-600">    Condições climáticas:</div>
              <div className="text-gray-700">• MANHÃ = {climaManha}</div>
              <div className="text-gray-700">• TARDE = {climaTarde}</div>
              {temperatura && <div className="text-gray-700">• 🌡️ TEMPERATURA ATUAL = {temperatura}°C</div>}

              <div className="mt-6 font-bold text-red-600">⚠️ DIFICULDADES/DESVIOS</div>
              <div className="text-gray-700">{dificuldades}</div>

              {(() => {
                const selectedMonthIndex = parseInt(selectedDate.split('-')[1], 10) - 1;
                const activeColor = colors[selectedMonthIndex] || 'red';
                const colorName = COLOR_NAMES[activeColor] || 'Vermelha';
                const monthName = MONTH_NAMES[selectedMonthIndex] || 'mês';
                const colorClass = COLOR_CLASSES[activeColor] || 'text-red-600';
                const colorIcon = COLOR_ICONS[activeColor] || '🔴';
                return (
                  <div className={`mt-6 font-bold ${colorClass}`}>
                    {colorIcon} Cor Proibida do Mês ({monthName}): {colorName}
                  </div>
                );
              })()}
              
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
