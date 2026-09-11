import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

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
      const { data, error } = await supabase
        .from('doc_arquivos')
        .select('*')
        .eq('cargo_id', cargoId)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Erro ao buscar documentos');
        throw error;
      }
      return data as DocArquivo[];
    },
    enabled: !!cargoId
  });
};

export const useUploadDocumento = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, cargoId }: { file: File; cargoId: string }) => {
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
          file_name: file.name,
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documentos', variables.cargoId] });
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
    onSuccess: (_, doc) => {
      queryClient.invalidateQueries({ queryKey: ['documentos', doc.cargo_id] });
      toast.success('Documento excluído com sucesso!');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao excluir documento.');
    }
  });
};
