import React, { useRef, useState } from 'react';
import { useDocumentos, useUploadDocumento, useDeleteDocumento, DocArquivo } from '@/hooks/useDocumentos';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Loader2, File, FileText, Image as ImageIcon, FileSpreadsheet, Download, Trash2, UploadCloud, X, Search } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useTheme } from '@/contexts/ThemeContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CargoDocsViewerProps {
  cargoId: string;
  cargoName: string;
  onClose: () => void;
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
  if (type.includes('image') || name.match(/\.(jpg|jpeg|png|gif|svg)$/)) return <ImageIcon className="text-blue-500 w-6 h-6" />;
  if (type.includes('spreadsheet') || type.includes('excel') || name.match(/\.(xls|xlsx|csv)$/)) return <FileSpreadsheet className="text-green-600 w-6 h-6" />;
  if (type.includes('word') || name.match(/\.(doc|docx)$/)) return <FileText className="text-blue-600 w-6 h-6" />;
  return <File className="text-gray-500 w-6 h-6" />;
};

export function CargoDocsViewer({ cargoId, cargoName, onClose }: CargoDocsViewerProps) {
  const { isDark } = useTheme();
  const { data: documentos, isLoading } = useDocumentos(cargoId);
  const uploadMutation = useUploadDocumento();
  const deleteMutation = useDeleteDocumento();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [docToDelete, setDocToDelete] = useState<DocArquivo | null>(null);

  const filteredDocumentos = documentos?.filter(doc => 
    doc.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadMutation.mutateAsync({ file, cargoId });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = async (doc: DocArquivo) => {
    const { data } = supabase.storage.from('documentos_cargos').getPublicUrl(doc.file_path, {
      download: doc.file_name
    });
    const link = document.createElement('a');
    link.href = data.publicUrl;
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-black/40 animate-in fade-in duration-300">
      <div className={`relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border ${isDark ? 'bg-[#121214] border-white/10' : 'bg-white border-gray-200'}`}>
        
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-white/5 bg-white/5' : 'border-gray-100 bg-gray-50'}`}>
          <div>
            <h2 className="text-2xl font-serif font-bold">Documentos - {cargoName}</h2>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-900 dark:text-white/60' : 'text-gray-500'}`}>
              Gerencie arquivos, planilhas, PDFs e imagens deste cargo.
            </p>
          </div>
          <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* Upload Box */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all ${
              uploadMutation.isPending 
                ? 'opacity-50 pointer-events-none' 
                : isDark ? 'border-white/20 hover:border-white/40 hover:bg-white/5' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.ppt,.pptx"
            />
            {uploadMutation.isPending ? (
              <Loader2 className="w-8 h-8 animate-spin text-yellow-500 mb-2" />
            ) : (
              <UploadCloud className={`w-8 h-8 mb-2 ${isDark ? 'text-gray-900 dark:text-white/60' : 'text-gray-400'}`} />
            )}
            <p className="font-medium text-center">
              {uploadMutation.isPending ? 'Enviando arquivo...' : 'Clique para enviar documento'}
            </p>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-900 dark:text-white/40' : 'text-gray-500'}`}>
              Suporta PDF, Word, Excel, Imagens, etc.
            </p>
          </div>

          {/* List */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider opacity-70">Arquivos Salvos</h3>
              
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors w-full sm:w-auto ${isDark ? 'border-white/10 bg-black/20 focus-within:border-white/30' : 'border-gray-200 bg-white focus-within:border-gray-300'}`}>
                <Search className={`w-4 h-4 ${isDark ? 'text-gray-900 dark:text-white/40' : 'text-gray-400'}`} />
                <input 
                  type="text" 
                  placeholder="Pesquisar arquivo..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`bg-transparent border-none outline-none text-sm w-full sm:w-48 focus:sm:w-64 transition-all ${isDark ? 'text-gray-900 dark:text-white placeholder:text-gray-900 dark:text-white/30' : 'text-gray-900 placeholder:text-gray-400'}`}
                />
              </div>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
              </div>
            ) : documentos?.length === 0 ? (
              <div className={`text-center p-8 rounded-xl border border-dashed ${isDark ? 'border-white/10 text-gray-900 dark:text-white/40' : 'border-gray-200 text-gray-500'}`}>
                Nenhum documento salvo para {cargoName} ainda.
              </div>
            ) : filteredDocumentos?.length === 0 ? (
              <div className={`text-center p-8 rounded-xl border border-dashed ${isDark ? 'border-white/10 text-gray-900 dark:text-white/40' : 'border-gray-200 text-gray-500'}`}>
                Nenhum arquivo encontrado com "{searchTerm}".
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDocumentos?.map((doc) => {
                  const isImage = doc.file_type.toLowerCase().includes('image') || doc.file_name.toLowerCase().match(/\.(jpg|jpeg|png|gif|svg|webp)$/);
                  const publicUrl = supabase.storage.from('documentos_cargos').getPublicUrl(doc.file_path).data.publicUrl;

                  return (
                  <div key={doc.id} className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${isDark ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:border-gray-300 shadow-sm'}`}>
                    <div className="flex items-center gap-4 overflow-hidden">
                      {isImage ? (
                        <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 group relative overflow-hidden rounded-lg">
                          <img src={publicUrl} alt={doc.file_name} className="w-12 h-12 object-cover bg-black/10 group-hover:scale-110 transition-transform" />
                        </a>
                      ) : (
                        <div className={`p-3 rounded-lg shrink-0 ${isDark ? 'bg-black/40' : 'bg-gray-100'}`}>
                          {getFileIcon(doc.file_type, doc.file_name)}
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <p className="font-medium text-sm truncate" title={doc.file_name}>{doc.file_name}</p>
                        <div className={`flex items-center gap-2 text-xs mt-0.5 ${isDark ? 'text-gray-900 dark:text-white/50' : 'text-gray-500'}`}>
                          <span>{formatBytes(doc.file_size)}</span>
                          <span>•</span>
                          <span>{format(new Date(doc.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)} title="Baixar Arquivo">
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10" 
                        onClick={() => setDocToDelete(doc)}
                        disabled={deleteMutation.isPending}
                        title="Excluir Arquivo"
                      >
                        {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      <AlertDialog open={!!docToDelete} onOpenChange={(open) => !open && setDocToDelete(null)}>
        <AlertDialogContent className={isDark ? 'bg-[#121214] border-white/10 text-gray-900 dark:text-white' : 'bg-white border-gray-200 text-gray-900'}>
          <AlertDialogHeader>
            <AlertDialogTitle className={isDark ? 'text-gray-900 dark:text-white' : 'text-gray-900'}>Excluir Arquivo</AlertDialogTitle>
            <AlertDialogDescription className={isDark ? 'text-gray-900 dark:text-white/60' : 'text-gray-500'}>
              Tem certeza que deseja excluir permanentemente o arquivo "{docToDelete?.file_name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={isDark ? 'border-white/20 text-gray-900 dark:text-white hover:bg-white/10 hover:text-gray-900 dark:text-white' : 'text-gray-900 hover:bg-gray-100'}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-500 hover:bg-red-600 text-gray-900 dark:text-white">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


