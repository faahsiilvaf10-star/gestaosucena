import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import transportCatalog from '@/data/transportDocuments.json';

export type DocArquivo = {
  id: string;
  cargo_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_by: string;
  created_at: string;
};

export const useDocumentos = (cargoId: string) => {
  return useQuery({
    queryKey: ['documentos', cargoId],
    queryFn: async () => {
      if (!cargoId) return [];

      const baseCatalog = (transportCatalog as DocArquivo[]).filter(d => d.cargo_id === cargoId);

      try {
        const { data, error } = await supabase
          .from('doc_arquivos')
          .select('*')
          .eq('cargo_id', cargoId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const map = new Map<string, DocArquivo>();
          (data as DocArquivo[]).forEach(d => map.set(d.id, d));
          baseCatalog.forEach(d => {
            if (!map.has(d.id)) map.set(d.id, d);
          });
          return Array.from(map.values());
        }
      } catch (err) {
        console.warn('Erro ao consultar doc_arquivos:', err);
      }

      return baseCatalog;
    },
    enabled: !!cargoId
  });
};

export const useDocumentosByPrefix = (prefix: string) => {
  return useQuery({
    queryKey: ['documentos-prefix', prefix],
    queryFn: async () => {
      if (!prefix) return [];

      // 1. Catálogo base importado
      const baseCatalog = (transportCatalog as DocArquivo[]).filter(d => d.cargo_id.startsWith(prefix));

      // 2. Tentar ler de global_settings para novas inclusões dinâmicas
      let dynamicCatalog: DocArquivo[] = [];
      try {
        const { data: gsData } = await supabase
          .from('global_settings')
          .select('value')
          .eq('key', 'transporte_docs_catalog')
          .maybeSingle();
        if (gsData?.value && Array.isArray(gsData.value)) {
          dynamicCatalog = (gsData.value as DocArquivo[]).filter(d => d.cargo_id.startsWith(prefix));
        }
      } catch (err) {
        console.warn('Erro ao ler catalogo remoto de global_settings:', err);
      }

      // 3. Mesclar catálogo local com catálogo de global_settings
      const mergedMap = new Map<string, DocArquivo>();
      baseCatalog.forEach(d => mergedMap.set(d.id, d));
      dynamicCatalog.forEach(d => mergedMap.set(d.id, d));

      // 4. Buscar também da tabela doc_arquivos (para uploads manuais)
      try {
        const { data, error } = await supabase
          .from('doc_arquivos')
          .select('*')
          .like('cargo_id', `${prefix}%`)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          (data as DocArquivo[]).forEach(d => mergedMap.set(d.id, d));
        }
      } catch (err) {
        console.warn('Erro ao consultar doc_arquivos:', err);
      }

      return Array.from(mergedMap.values());
    },
    enabled: !!prefix
  });
};

export const useUploadDocumento = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, cargoId, fileName }: { file: File; cargoId: string; fileName?: string }) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('Usuário não autenticado');

      const fileExt = file.name.split('.').pop();
      const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${cargoId}/${uniqueFileName}`;

      // Upload para o Storage
      const { error: uploadError } = await supabase.storage
        .from('documentos_cargos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Inserir registro no Banco
      const { data, error: dbError } = await supabase
        .from('doc_arquivos')
        .insert([{
          cargo_id: cargoId,
          file_name: fileName || file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type || fileExt || 'unknown',
          uploaded_by: user.id
        }])
        .select()
        .single();

      if (dbError) throw dbError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos'] });
      queryClient.invalidateQueries({ queryKey: ['documentos-prefix'] });
      toast.success('Documento salvo com sucesso!');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao enviar documento. Tente novamente.');
    }
  });
};

export const useDeleteDocumento = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (doc: DocArquivo) => {
      // Remover do Storage
      const { error: storageError } = await supabase.storage
        .from('documentos_cargos')
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      // Remover do Banco
      const { error: dbError } = await supabase
        .from('doc_arquivos')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos'] });
      queryClient.invalidateQueries({ queryKey: ['documentos-prefix'] });
      toast.success('Documento excluído com sucesso!');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao excluir documento.');
    }
  });
};
