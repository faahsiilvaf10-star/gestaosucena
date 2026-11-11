import React, { useRef, useState, useMemo } from 'react';
import Loader2 from 'lucide-react/dist/esm/icons/loader-circle.js';
import File from 'lucide-react/dist/esm/icons/file.js';
import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import ImageIcon from 'lucide-react/dist/esm/icons/image.js';
import FileSpreadsheet from 'lucide-react/dist/esm/icons/file-spreadsheet.js';
import Download from 'lucide-react/dist/esm/icons/download.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import UploadCloud from 'lucide-react/dist/esm/icons/cloud-upload.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import Search from 'lucide-react/dist/esm/icons/search.js';
import Truck from 'lucide-react/dist/esm/icons/truck.js';
import User from 'lucide-react/dist/esm/icons/user.js';
import Eye from 'lucide-react/dist/esm/icons/eye.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.js';
import AlertCircle from 'lucide-react/dist/esm/icons/circle-alert.js';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link.js';
import Filter from 'lucide-react/dist/esm/icons/filter.js';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.js';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useDocumentosByPrefix, useUploadDocumento, useDeleteDocumento, DocArquivo } from '@/hooks/useDocumentos';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useTheme } from '@/contexts/ThemeContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TransporteDocsViewerProps {
  onClose: () => void;
}

interface HeavyEquipment {
  id: string;
  name: string;
  plate_tag: string;
  type: string;
  category: string;
  status: string;
}

interface DriverColaborador {
  id: string;
  nome: string;
  cargo: string;
  matricula: string;
  setor: string;
}

const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const getFileIcon = (fileType: string, fileName: string) => {
  const type = fileType.toLowerCase();
  const name = fileName.toLowerCase();
  if (type.includes('pdf') || name.endsWith('.pdf')) return <FileText className="text-red-500 w-6 h-6" />;
  if (type.includes('image') || name.match(/\.(jpg|jpeg|png|gif|svg|webp)$/)) return <ImageIcon className="text-blue-500 w-6 h-6" />;
  if (type.includes('spreadsheet') || type.includes('excel') || name.match(/\.(xls|xlsx|csv)$/)) return <FileSpreadsheet className="text-green-600 w-6 h-6" />;
  if (type.includes('word') || name.match(/\.(doc|docx)$/)) return <FileText className="text-blue-600 w-6 h-6" />;
  return <File className="text-gray-500 w-6 h-6" />;
};

export function TransporteDocsViewer({ onClose }: TransporteDocsViewerProps) {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'equipamentos' | 'motoristas'>('equipamentos');

  // --- EQUIPAMENTO PESADO STATE ---
  const [selectedEquipmentFilter, setSelectedEquipmentFilter] = useState<string>('all');
  const [equipmentUploadTarget, setEquipmentUploadTarget] = useState<string>('geral');
  const [searchEquipTerm, setSearchEquipTerm] = useState('');
  const fileEquipInputRef = useRef<HTMLInputElement>(null);

  // --- MOTORISTA STATE ---
  const [searchDriverTerm, setSearchDriverTerm] = useState('');
  const [selectedDriverForDocs, setSelectedDriverForDocs] = useState<DriverColaborador | null>(null);
  const fileDriverInputRef = useRef<HTMLInputElement>(null);

  // --- PREVIEW & DELETE MODAL STATE ---
  const [previewDoc, setPreviewDoc] = useState<DocArquivo | null>(null);
  const [docToDelete, setDocToDelete] = useState<DocArquivo | null>(null);

  // --- MUTATIONS ---
  const uploadMutation = useUploadDocumento();
  const deleteMutation = useDeleteDocumento();

  // --- FETCH EQUIPAMENTOS PESADOS ---
  const { data: equipments = [], isLoading: isLoadingEquipments } = useQuery<HeavyEquipment[]>({
    queryKey: ['heavy-equipments-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eq_equipments')
        .select('id, name, plate_tag, type, category, status')
        .or('category.ilike.%pesado%,type.ilike.%ônibus%,type.ilike.%onibus%,name.ilike.%gerador%')
        .order('name');
      if (error) throw error;
      return (data || []) as HeavyEquipment[];
    }
  });

  // --- FETCH DOCUMENTOS DE EQUIPAMENTOS PESADOS ---
  const { data: equipDocs = [], isLoading: isLoadingEquipDocs } = useDocumentosByPrefix('transporte_eq');

  // --- FETCH MOTORISTAS DA LISTA DE RH ---
  const { data: drivers = [], isLoading: isLoadingDrivers } = useQuery<DriverColaborador[]>({
    queryKey: ['transporte-drivers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_efetivo')
        .select('id, nome, cargo, matricula, setor')
        .ilike('cargo', '%motorista%')
        .order('nome');
      if (error) throw error;
      return (data || []) as DriverColaborador[];
    }
  });

  // --- FETCH TODOS OS DOCUMENTOS DE CNH (prefix: transporte_cnh) ---
  const { data: cnhDocs = [], isLoading: isLoadingCnhDocs } = useDocumentosByPrefix('transporte_cnh');

  // Map of driver ID to list of docs
  const driverDocsMap = useMemo(() => {
    const map = new Map<string, DocArquivo[]>();
    for (const doc of cnhDocs) {
      const driverId = doc.cargo_id.replace('transporte_cnh_', '');
      if (!map.has(driverId)) {
        map.set(driverId, []);
      }
      map.get(driverId)!.push(doc);
    }
    return map;
  }, [cnhDocs]);

  // Filtered equipments docs
  const filteredEquipDocs = useMemo(() => {
    return equipDocs.filter(doc => {
      // Equipment filter
      if (selectedEquipmentFilter !== 'all') {
        const expectedCargoId = selectedEquipmentFilter === 'geral' 
          ? 'transporte_eq_geral' 
          : `transporte_eq_${selectedEquipmentFilter}`;
        if (doc.cargo_id !== expectedCargoId) return false;
      }
      // Search term
      if (searchEquipTerm.trim()) {
        const term = searchEquipTerm.toLowerCase();
        return doc.file_name.toLowerCase().includes(term);
      }
      return true;
    });
  }, [equipDocs, selectedEquipmentFilter, searchEquipTerm]);

  // Filtered drivers list
  const filteredDrivers = useMemo(() => {
    if (!searchDriverTerm.trim()) return drivers;
    const term = searchDriverTerm.toLowerCase();
    return drivers.filter(d => 
      d.nome.toLowerCase().includes(term) ||
      (d.matricula && d.matricula.toLowerCase().includes(term)) ||
      (d.cargo && d.cargo.toLowerCase().includes(term))
    );
  }, [drivers, searchDriverTerm]);

  // Helper to find equipment label from cargo_id
  const getEquipmentLabel = (cargoId: string) => {
    if (cargoId === 'transporte_eq_geral' || cargoId === 'transporte_equipamento') {
      return 'Frota Geral';
    }
    const eqId = cargoId.replace('transporte_eq_', '');
    const eq = equipments.find(e => e.id === eqId);
    return eq ? `${eq.name} • ${eq.plate_tag || eq.type}` : 'Equipamento';
  };

  // --- ACTIONS ---
  const handleUploadEquipmentFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const cargoId = equipmentUploadTarget === 'geral' 
      ? 'transporte_eq_geral' 
      : `transporte_eq_${equipmentUploadTarget}`;

    await uploadMutation.mutateAsync({ file, cargoId });
    if (fileEquipInputRef.current) fileEquipInputRef.current.value = '';
  };

  const handleUploadDriverCnh = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedDriverForDocs) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const cargoId = `transporte_cnh_${selectedDriverForDocs.id}`;
    await uploadMutation.mutateAsync({ file, cargoId });
    if (fileDriverInputRef.current) fileDriverInputRef.current.value = '';
  };

  const getDocUrl = (filePath: string) => {
    if (!filePath) return '';
    if (filePath.startsWith('/') || filePath.startsWith('http') || filePath.startsWith('data:')) {
      return filePath;
    }
    return supabase.storage.from('documentos_cargos').getPublicUrl(filePath).data.publicUrl;
  };

  const handleDownload = async (doc: DocArquivo) => {
    const url = getDocUrl(doc.file_path);
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.file_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const confirmDelete = () => {
    if (docToDelete) {
      deleteMutation.mutate(docToDelete);
      setDocToDelete(null);
    }
  };

  // Metrics
  const driversWithCnhCount = useMemo(() => {
    return drivers.filter(d => (driverDocsMap.get(d.id)?.length || 0) > 0).length;
  }, [drivers, driverDocsMap]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-md bg-black/50 animate-in fade-in duration-300">
      <div className={`relative w-full max-w-5xl h-[92vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden border ${isDark ? 'bg-[#121214] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
        
        {/* Header */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 sm:p-6 border-b gap-4 shrink-0 ${isDark ? 'border-white/5 bg-white/[0.03]' : 'border-gray-100 bg-gray-50/80'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl ${isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Documentos - Transporte</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  Módulo Integrado
                </span>
              </div>
              <p className={`text-xs sm:text-sm mt-0.5 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                Equipamentos pesados e CNH individual de motoristas do RH.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            {/* Tab navigation */}
            <div className={`flex items-center p-1 rounded-2xl border ${isDark ? 'bg-black/40 border-white/10' : 'bg-gray-100/80 border-gray-200'}`}>
              <button
                onClick={() => setActiveTab('equipamentos')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === 'equipamentos'
                    ? isDark ? 'bg-amber-500 text-black shadow-md' : 'bg-white text-gray-900 shadow-sm'
                    : isDark ? 'text-white/70 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Truck className="w-4 h-4" />
                <span>Equipamento Pesado</span>
                <span className={`text-[11px] px-1.5 py-0.2 rounded-md ${activeTab === 'equipamentos' ? (isDark ? 'bg-black/20 text-black' : 'bg-gray-200 text-gray-800') : 'bg-black/10 text-current'}`}>
                  {equipDocs.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('motoristas')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === 'motoristas'
                    ? isDark ? 'bg-amber-500 text-black shadow-md' : 'bg-white text-gray-900 shadow-sm'
                    : isDark ? 'text-white/70 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Somente Motorista</span>
                <span className={`text-[11px] px-1.5 py-0.2 rounded-md ${activeTab === 'motoristas' ? (isDark ? 'bg-black/20 text-black' : 'bg-gray-200 text-gray-800') : 'bg-black/10 text-current'}`}>
                  {drivers.length}
                </span>
              </button>
            </div>

            <button 
              onClick={onClose} 
              className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/10 text-white/70 hover:text-white' : 'hover:bg-black/5 text-gray-500 hover:text-gray-900'}`}
              title="Fechar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          
          {/* ========================================================= */}
          {/* TAB 1: EQUIPAMENTO PESADO                                 */}
          {/* ========================================================= */}
          {activeTab === 'equipamentos' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Upload Card for Heavy Equipment */}
              <div className={`p-5 rounded-2xl border ${isDark ? 'bg-white/[0.02] border-white/10' : 'bg-gray-50/60 border-gray-200'}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-base font-bold flex items-center gap-2">
                      <UploadCloud className="w-5 h-5 text-amber-500" />
                      Anexar Documento de Equipamento Pesado
                    </h3>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                      Selecione o equipamento pesado específico ou envie para a Frota Geral.
                    </p>
                  </div>

                  {/* Target equipment selector */}
                  <div className="flex items-center gap-2">
                    <label className={`text-xs font-medium whitespace-nowrap ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
                      Destino:
                    </label>
                    <select
                      value={equipmentUploadTarget}
                      onChange={(e) => setEquipmentUploadTarget(e.target.value)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-xl border outline-none transition-colors ${
                        isDark 
                          ? 'bg-[#18181b] border-white/10 text-white focus:border-amber-500' 
                          : 'bg-white border-gray-300 text-gray-900 focus:border-amber-500'
                      }`}
                    >
                      <option value="geral">Frota Geral (Todos os Pesados)</option>
                      {equipments.map((eq) => (
                        <option key={eq.id} value={eq.id}>
                          {eq.name} — {eq.plate_tag || eq.type} ({eq.type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Dropzone */}
                <div 
                  onClick={() => fileEquipInputRef.current?.click()}
                  className={`cursor-pointer border-2 border-dashed rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center transition-all ${
                    uploadMutation.isPending 
                      ? 'opacity-50 pointer-events-none' 
                      : isDark 
                        ? 'border-white/20 hover:border-amber-500/60 hover:bg-amber-500/[0.04]' 
                        : 'border-gray-300 hover:border-amber-500 hover:bg-amber-50/50'
                  }`}
                >
                  <input 
                    type="file" 
                    ref={fileEquipInputRef} 
                    className="hidden" 
                    onChange={handleUploadEquipmentFile}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.ppt,.pptx"
                  />
                  {uploadMutation.isPending ? (
                    <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
                  ) : (
                    <UploadCloud className={`w-8 h-8 mb-2 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                  )}
                  <p className="font-semibold text-sm text-center">
                    {uploadMutation.isPending ? 'Enviando documento...' : 'Clique para selecionar o arquivo do equipamento'}
                  </p>
                  <p className={`text-xs mt-1 text-center ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                    Suporta CRLV, laudos, checklists, fotos, manuais (PDF, DOCX, Imagens, Planilhas)
                  </p>
                </div>
              </div>

              {/* Filters and Search Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
                  <Filter className={`w-4 h-4 shrink-0 ${isDark ? 'text-white/50' : 'text-gray-400'}`} />
                  <button
                    onClick={() => setSelectedEquipmentFilter('all')}
                    className={`px-3 py-1.5 text-xs rounded-xl font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      selectedEquipmentFilter === 'all'
                        ? 'bg-amber-500 text-black font-semibold shadow-xs'
                        : isDark ? 'bg-white/5 hover:bg-white/10 text-white/70' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    <span>Todos</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      selectedEquipmentFilter === 'all' ? 'bg-black/20 text-black' : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                    }`}>
                      {equipDocs.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setSelectedEquipmentFilter('geral')}
                    className={`px-3 py-1.5 text-xs rounded-xl font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      selectedEquipmentFilter === 'geral'
                        ? 'bg-amber-500 text-black font-semibold shadow-xs'
                        : isDark ? 'bg-white/5 hover:bg-white/10 text-white/70' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    <span>Frota Geral</span>
                    {equipDocs.filter(d => d.cargo_id === 'transporte_eq_geral').length > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        selectedEquipmentFilter === 'geral' ? 'bg-black/20 text-black' : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                      }`}>
                        {equipDocs.filter(d => d.cargo_id === 'transporte_eq_geral').length}
                      </span>
                    )}
                  </button>
                  {equipments.map(eq => {
                    const count = equipDocs.filter(d => d.cargo_id === `transporte_eq_${eq.id}`).length;
                    return (
                      <button
                        key={eq.id}
                        onClick={() => setSelectedEquipmentFilter(eq.id)}
                        className={`px-3 py-1.5 text-xs rounded-xl font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                          selectedEquipmentFilter === eq.id
                            ? 'bg-amber-500 text-black font-semibold shadow-xs'
                            : isDark ? 'bg-white/5 hover:bg-white/10 text-white/70' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        <span>{eq.name}</span>
                        {count > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            selectedEquipmentFilter === eq.id ? 'bg-black/20 text-black' : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          }`}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Search */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors shrink-0 ${
                  isDark ? 'border-white/10 bg-black/30 focus-within:border-amber-500/50' : 'border-gray-200 bg-white focus-within:border-amber-500'
                }`}>
                  <Search className={`w-4 h-4 ${isDark ? 'text-white/60' : 'text-gray-400'}`} />
                  <input 
                    type="text" 
                    placeholder="Filtrar por nome do arquivo..." 
                    value={searchEquipTerm}
                    onChange={(e) => setSearchEquipTerm(e.target.value)}
                    className={`bg-transparent border-none outline-none text-xs sm:text-sm w-44 sm:w-56 ${
                      isDark ? 'text-white placeholder:text-white/30' : 'text-gray-900 placeholder:text-gray-400'
                    }`}
                  />
                  {searchEquipTerm && (
                    <button onClick={() => setSearchEquipTerm('')} className="text-xs opacity-60 hover:opacity-100">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Documents List */}
              {isLoadingEquipDocs || isLoadingEquipments ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
                  <p className="text-sm opacity-70">Carregando documentos de equipamentos pesados...</p>
                </div>
              ) : filteredEquipDocs.length === 0 ? (
                <div className={`text-center p-12 rounded-2xl border border-dashed ${isDark ? 'border-white/10 text-white/60' : 'border-gray-200 text-gray-500'}`}>
                  <Truck className="w-10 h-10 mx-auto mb-3 opacity-30 text-amber-500" />
                  <p className="font-semibold text-base">Nenhum documento encontrado para este filtro.</p>
                  <p className="text-xs mt-1 max-w-md mx-auto opacity-80">
                    Utilize a área de envio acima para adicionar laudos, CRLV, relatórios ou vistorias de equipamentos pesados.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredEquipDocs.map((doc) => {
                    const isImage = doc.file_type.toLowerCase().includes('image') || doc.file_name.toLowerCase().match(/\.(jpg|jpeg|png|gif|svg|webp)$/);
                    const publicUrl = getDocUrl(doc.file_path);
                    const equipLabel = getEquipmentLabel(doc.cargo_id);

                    return (
                      <div 
                        key={doc.id} 
                        className={`group flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                          isDark 
                            ? 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20' 
                            : 'border-gray-200 bg-white hover:border-amber-300 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden min-w-0">
                          {isImage ? (
                            <button
                              onClick={() => setPreviewDoc(doc)}
                              className="shrink-0 relative w-12 h-12 rounded-xl overflow-hidden border border-black/10 group-hover:scale-105 transition-transform"
                            >
                              <img src={publicUrl} alt={doc.file_name} className="w-full h-full object-cover" />
                            </button>
                          ) : (
                            <div className={`p-3 rounded-xl shrink-0 ${isDark ? 'bg-black/40' : 'bg-gray-100'}`}>
                              {getFileIcon(doc.file_type, doc.file_name)}
                            </div>
                          )}

                          <div className="overflow-hidden min-w-0">
                            <p className="font-semibold text-xs sm:text-sm truncate" title={doc.file_name}>
                              {doc.file_name}
                            </p>
                            
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                                isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {equipLabel}
                              </span>
                              <span className={`text-[11px] ${isDark ? 'text-white/50' : 'text-gray-400'}`}>
                                {formatBytes(doc.file_size)} • {format(new Date(doc.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0 ml-3">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                            onClick={() => setPreviewDoc(doc)} 
                            title="Visualizar Documento"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-black/5 dark:hover:bg-white/10"
                            onClick={() => handleDownload(doc)} 
                            title="Baixar Arquivo"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10" 
                            onClick={() => setDocToDelete(doc)}
                            disabled={deleteMutation.isPending}
                            title="Excluir Arquivo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: SOMENTE MOTORISTA (CNH)                            */}
          {/* ========================================================= */}
          {activeTab === 'motoristas' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Header Banner */}
              <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isDark ? 'bg-white/[0.02] border-white/10' : 'bg-gray-50/70 border-gray-200'
              }`}>
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                    Controle Individual de CNH dos Motoristas (RH)
                  </h3>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                    Armazene, visualize e baixe as CNHs de cada motorista separadamente.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className={`px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                    isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  }`}>
                    {driversWithCnhCount} de {drivers.length} com CNH
                  </div>
                  {drivers.length - driversWithCnhCount > 0 && (
                    <div className={`px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                      isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'
                    }`}>
                      {drivers.length - driversWithCnhCount} pendente(s)
                    </div>
                  )}
                </div>
              </div>

              {/* Search Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-colors w-full sm:max-w-md ${
                  isDark ? 'border-white/10 bg-black/30 focus-within:border-amber-500/50' : 'border-gray-200 bg-white focus-within:border-amber-500'
                }`}>
                  <Search className={`w-4 h-4 ${isDark ? 'text-white/60' : 'text-gray-400'}`} />
                  <input 
                    type="text" 
                    placeholder="Buscar motorista por nome, cargo ou matrícula..." 
                    value={searchDriverTerm}
                    onChange={(e) => setSearchDriverTerm(e.target.value)}
                    className={`bg-transparent border-none outline-none text-xs sm:text-sm w-full ${
                      isDark ? 'text-white placeholder:text-white/30' : 'text-gray-900 placeholder:text-gray-400'
                    }`}
                  />
                  {searchDriverTerm && (
                    <button onClick={() => setSearchDriverTerm('')} className="text-xs opacity-60 hover:opacity-100">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <p className={`text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                  Mostrando {filteredDrivers.length} de {drivers.length} motorista(s)
                </p>
              </div>

              {/* Drivers Grid */}
              {isLoadingDrivers || isLoadingCnhDocs ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
                  <p className="text-sm opacity-70">Carregando lista de motoristas do RH...</p>
                </div>
              ) : filteredDrivers.length === 0 ? (
                <div className={`text-center p-12 rounded-2xl border border-dashed ${isDark ? 'border-white/10 text-white/60' : 'border-gray-200 text-gray-500'}`}>
                  <User className="w-10 h-10 mx-auto mb-3 opacity-30 text-amber-500" />
                  <p className="font-semibold text-base">Nenhum motorista encontrado.</p>
                  <p className="text-xs mt-1 opacity-70">Verifique os filtros de pesquisa digitados.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDrivers.map((driver) => {
                    const docs = driverDocsMap.get(driver.id) || [];
                    const hasCnh = docs.length > 0;
                    const initials = driver.nome
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map(p => p[0])
                      .join('')
                      .toUpperCase();

                    return (
                      <div
                        key={driver.id}
                        className={`p-4 rounded-2xl border flex flex-col justify-between transition-all ${
                          hasCnh
                            ? isDark
                              ? 'bg-white/[0.03] border-emerald-500/30 hover:border-emerald-500/60'
                              : 'bg-white border-emerald-200 hover:border-emerald-400 shadow-sm'
                            : isDark
                              ? 'bg-white/[0.02] border-white/10 hover:border-amber-500/40'
                              : 'bg-white border-gray-200 hover:border-amber-300 shadow-sm'
                        }`}
                      >
                        <div>
                          {/* Driver Header */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 ${
                                hasCnh 
                                  ? isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-100 text-emerald-800'
                                  : isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {initials || 'MO'}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-xs sm:text-sm uppercase tracking-tight truncate" title={driver.nome}>
                                  {driver.nome}
                                </h4>
                                <p className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-white/60' : 'text-gray-500'}`} title={driver.cargo}>
                                  {driver.cargo || 'Motorista'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Info tags */}
                          <div className="flex flex-wrap items-center gap-2 mb-4">
                            {driver.matricula && (
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                                isDark ? 'bg-white/5 text-white/70' : 'bg-gray-100 text-gray-600'
                              }`}>
                                Matrícula: {driver.matricula}
                              </span>
                            )}
                            
                            {hasCnh ? (
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                                isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                <CheckCircle2 className="w-3 h-3" />
                                {docs.length === 1 ? '1 CNH Anexada' : `${docs.length} Documentos`}
                              </span>
                            ) : (
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                                isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800'
                              }`}>
                                <AlertCircle className="w-3 h-3" />
                                CNH Pendente
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action Button */}
                        <Button
                          onClick={() => setSelectedDriverForDocs(driver)}
                          variant="outline"
                          size="sm"
                          className={`w-full justify-between rounded-xl text-xs font-semibold h-9 ${
                            hasCnh
                              ? isDark 
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' 
                                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                              : isDark 
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20' 
                                : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                          }`}
                        >
                          <span>{hasCnh ? 'Visualizar / Gerenciar CNH' : '+ Adicionar CNH'}</span>
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL: GERENCIAR CNH DO MOTORISTA ESPECÍFICO               */}
      {/* ========================================================= */}
      {selectedDriverForDocs && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 backdrop-blur-md bg-black/60 animate-in fade-in zoom-in-95 duration-200">
          <div className={`relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden border ${
            isDark ? 'bg-[#161619] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
          }`}>
            
            {/* Header */}
            <div className={`flex items-center justify-between p-5 border-b ${
              isDark ? 'border-white/5 bg-white/[0.03]' : 'border-gray-100 bg-gray-50'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-800'}`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg uppercase">
                    CNH — {selectedDriverForDocs.nome}
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                    {selectedDriverForDocs.cargo} {selectedDriverForDocs.matricula ? `• Matrícula: ${selectedDriverForDocs.matricula}` : ''}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setSelectedDriverForDocs(null)} 
                className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/10 text-white/70 hover:text-white' : 'hover:bg-black/5 text-gray-500'}`}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
              
              {/* Upload Dropzone for this driver */}
              <div
                onClick={() => fileDriverInputRef.current?.click()}
                className={`cursor-pointer border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center transition-all ${
                  uploadMutation.isPending 
                    ? 'opacity-50 pointer-events-none' 
                    : isDark 
                      ? 'border-white/20 hover:border-amber-500/60 hover:bg-amber-500/[0.04]' 
                      : 'border-gray-300 hover:border-amber-500 hover:bg-amber-50/50'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileDriverInputRef} 
                  className="hidden" 
                  onChange={handleUploadDriverCnh}
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                />
                {uploadMutation.isPending ? (
                  <Loader2 className="w-7 h-7 animate-spin text-amber-500 mb-2" />
                ) : (
                  <UploadCloud className={`w-7 h-7 mb-2 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                )}
                <p className="font-semibold text-xs sm:text-sm text-center">
                  {uploadMutation.isPending ? 'Enviando CNH...' : `Clique para anexar a CNH de ${selectedDriverForDocs.nome.split(' ')[0]}`}
                </p>
                <p className={`text-[11px] mt-1 text-center ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                  Envie a foto frente/verso da CNH ou PDF digital
                </p>
              </div>

              {/* List of uploaded documents for this driver */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider opacity-70 mb-3">
                  Documentos Anexados ({driverDocsMap.get(selectedDriverForDocs.id)?.length || 0})
                </h4>

                {(driverDocsMap.get(selectedDriverForDocs.id) || []).length === 0 ? (
                  <div className={`p-8 text-center rounded-2xl border border-dashed ${
                    isDark ? 'border-white/10 text-white/50' : 'border-gray-200 text-gray-500'
                  }`}>
                    <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-500" />
                    <p className="font-medium text-xs sm:text-sm">Nenhuma CNH cadastrada para este motorista.</p>
                    <p className="text-[11px] mt-0.5 opacity-80">Use o botão acima para enviar o arquivo da CNH.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {(driverDocsMap.get(selectedDriverForDocs.id) || []).map((doc) => {
                      const isImage = doc.file_type.toLowerCase().includes('image') || doc.file_name.toLowerCase().match(/\.(jpg|jpeg|png|gif|svg|webp)$/);
                      const publicUrl = getDocUrl(doc.file_path);

                      return (
                        <div 
                          key={doc.id}
                          className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                            isDark ? 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]' : 'border-gray-200 bg-white hover:border-gray-300 shadow-sm'
                          }`}
                        >
                          <div className="flex items-center gap-3 overflow-hidden min-w-0">
                            {isImage ? (
                              <button
                                onClick={() => setPreviewDoc(doc)}
                                className="shrink-0 relative w-12 h-12 rounded-lg overflow-hidden border border-black/10 group-hover:scale-105 transition-transform"
                              >
                                <img src={publicUrl} alt={doc.file_name} className="w-full h-full object-cover" />
                              </button>
                            ) : (
                              <div className={`p-2.5 rounded-lg shrink-0 ${isDark ? 'bg-black/40' : 'bg-gray-100'}`}>
                                {getFileIcon(doc.file_type, doc.file_name)}
                              </div>
                            )}

                            <div className="overflow-hidden min-w-0">
                              <p className="font-semibold text-xs sm:text-sm truncate" title={doc.file_name}>
                                {doc.file_name}
                              </p>
                              <div className={`flex items-center gap-2 text-[11px] mt-0.5 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                                <span>{formatBytes(doc.file_size)}</span>
                                <span>•</span>
                                <span>{format(new Date(doc.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 ml-3">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                              onClick={() => setPreviewDoc(doc)} 
                              title="Visualizar CNH"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 hover:bg-black/5 dark:hover:bg-white/10"
                              onClick={() => handleDownload(doc)} 
                              title="Baixar CNH"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10" 
                              onClick={() => setDocToDelete(doc)}
                              disabled={deleteMutation.isPending}
                              title="Excluir CNH"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Footer */}
            <div className={`p-4 border-t flex justify-end ${isDark ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-gray-50'}`}>
              <Button 
                onClick={() => setSelectedDriverForDocs(null)}
                variant="outline"
                className="text-xs font-semibold rounded-xl"
              >
                Concluir
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: VISUALIZADOR DE DOCUMENTOS (PREVIEW)               */}
      {/* ========================================================= */}
      {previewDoc && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 backdrop-blur-md bg-black/80 animate-in fade-in zoom-in-95 duration-200">
          <div className={`relative w-full max-w-4xl h-[90vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden border ${
            isDark ? 'bg-[#141416] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
          }`}>
            
            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b ${
              isDark ? 'border-white/5 bg-white/[0.03]' : 'border-gray-100 bg-gray-50'
            }`}>
              <div className="flex items-center gap-3 overflow-hidden min-w-0">
                {getFileIcon(previewDoc.file_type, previewDoc.file_name)}
                <div className="overflow-hidden min-w-0">
                  <h3 className="font-bold text-sm sm:text-base truncate" title={previewDoc.file_name}>
                    {previewDoc.file_name}
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                    {formatBytes(previewDoc.file_size)} • {format(new Date(previewDoc.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(previewDoc)}
                  className="rounded-xl text-xs gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar</span>
                </Button>
                
                <a
                  href={getDocUrl(previewDoc.file_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-colors ${
                    isDark ? 'border-white/10 hover:bg-white/10 text-white' : 'border-gray-200 hover:bg-gray-100 text-gray-700'
                  }`}
                  title="Abrir em Nova Guia"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button 
                  onClick={() => setPreviewDoc(null)} 
                  className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/10 text-white/70 hover:text-white' : 'hover:bg-black/5 text-gray-500'}`}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Viewer Content */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/10">
              {previewDoc.file_type.toLowerCase().includes('image') || previewDoc.file_name.toLowerCase().match(/\.(jpg|jpeg|png|gif|svg|webp)$/) ? (
                <img 
                  src={getDocUrl(previewDoc.file_path)} 
                  alt={previewDoc.file_name} 
                  className="max-h-full max-w-full object-contain rounded-xl shadow-lg"
                />
              ) : previewDoc.file_type.toLowerCase().includes('pdf') || previewDoc.file_name.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={getDocUrl(previewDoc.file_path)}
                  title={previewDoc.file_name}
                  className="w-full h-full rounded-xl border-none shadow-lg bg-white"
                />
              ) : (
                <div className="text-center p-8 max-w-md">
                  <File className="w-16 h-16 mx-auto mb-3 opacity-30 text-amber-500" />
                  <p className="font-semibold text-base mb-1">Pré-visualização não suportada no navegador</p>
                  <p className={`text-xs mb-4 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                    Este tipo de arquivo pode ser baixado ou aberto no seu aplicativo padrão.
                  </p>
                  <Button onClick={() => handleDownload(previewDoc)} className="rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-semibold">
                    <Download className="w-4 h-4 mr-2" />
                    Baixar Arquivo
                  </Button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ALERT DIALOG: CONFIRMAÇÃO DE EXCLUSÃO                     */}
      {/* ========================================================= */}
      <AlertDialog open={!!docToDelete} onOpenChange={(open) => !open && setDocToDelete(null)}>
        <AlertDialogContent className={isDark ? 'bg-[#121214] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'}>
          <AlertDialogHeader>
            <AlertDialogTitle className={isDark ? 'text-white' : 'text-gray-900'}>Excluir Arquivo</AlertDialogTitle>
            <AlertDialogDescription className={isDark ? 'text-white/70' : 'text-gray-500'}>
              Tem certeza que deseja excluir permanentemente o arquivo "{docToDelete?.file_name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={isDark ? 'border-white/20 text-white hover:bg-white/10 hover:text-white' : 'text-gray-900 hover:bg-gray-100'}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-500 hover:bg-red-600 text-white">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
