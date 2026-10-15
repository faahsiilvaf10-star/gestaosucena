import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'

export interface EstadoBanco {
  tabelas: boolean
  funcoes: boolean
  bucket: boolean
  pronto: boolean
}

/**
 * Verifica se a infraestrutura do módulo de Comunicados está aplicada
 * no banco (tabelas, funções RPC e bucket de mídia).
 *
 * Sem isso o usuário vê erros crípticos como "Bucket not found".
 */
export function useDiagnosticoComunicados() {
  return useQuery<EstadoBanco>({
    queryKey: ['comunicados', 'diagnostico'],
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<EstadoBanco> => {
      // Uma consulta triviais basta para detectar se a tabela existe.
      // PGRST205 = "table not found in schema cache".
      const { error: erroTabela } = await supabase
        .from('comunicados')
        .select('id')
        .limit(1)

      const tabelas = !erroTabela

      // RPC responde 404 quando a função não existe.
      const { error: erroFuncao } = await supabase.rpc('comunicado_current_day')
      const funcoes = !erroFuncao

      // O bucket só responde ao tentar usar. Um HEAD em arquivo
      // inexistente devolve 400 com "NoSuchBucket" quando falta.
      const { error: erroBucket } = await supabase.storage
        .from('comunicados_midia')
        .list('', { limit: 1 })

      const bucket = !erroBucket

      return { tabelas, funcoes, bucket, pronto: tabelas && funcoes && bucket }
    },
  })
}