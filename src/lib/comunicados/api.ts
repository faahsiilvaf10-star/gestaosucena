import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '../supabase'
import {
  detectarTipoMidia,
  type Comunicado,
  type ComunicadoElegivel,
  type ComunicadoMidia,
  type Periodicidade,
  diaLocal,
} from './regras'

export const BUCKET_COMUNICADOS = 'comunicados_midia'

export interface ComunicadoCompleto extends Comunicado {
  midias: ComunicadoMidia[]
  /** Somente no admin: total de usuários que já viram hoje. */
  destinatario_nome?: string | null
}

export interface FormularioComunicado {
  descricao: string
  destinoUsuarioId: string | null
  periodicidade: Periodicidade
  vezesPorDia: number
  duracaoSegundos: number
  dataInicio: string
  horaInicio: string
  dataFim: string | null
  ativo: boolean
  /** Desconta a janela de data/hora e exibe assim que possivel. */
  imediato: boolean
}

/* ------------------------------------------------------------------ */
/*  Consulta                                                            */
/* ------------------------------------------------------------------ */

export function useComunicadosAdmin() {
  return useQuery({
    queryKey: ['comunicados', 'admin'],
    queryFn: async (): Promise<ComunicadoCompleto[]> => {
      const { data, error } = await supabase
        .from('comunicados')
        .select('*, comunicado_midias(*)')
        .order('criado_em', { ascending: false })

      if (error) throw error

      const comunicados = (data ?? []) as unknown as ComunicadoCompleto[]
      return comunicados
        .map((c) => ({
          ...c,
          midias: ((c.midias ?? []) as unknown as ComunicadoMidia[]).sort(
            (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0),
          ),
        }))
    },
  })
}

/**
 * Comunicados elegíveis para o usuário atual na sessão atual.
 * O controle de limite diário e destinatário é feito no servidor (RPC).
 */
export function useComunicadosElegiveis(sessionKey: string | null, gatilho = 0) {
  return useQuery({
    queryKey: ['comunicados', 'elegiveis', sessionKey, gatilho],
    enabled: Boolean(sessionKey),
    // Revalida a cada 15s para que um comunicado criado no Admin
    // apareça para quem já está com o sistema aberto.
    staleTime: 15_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<ComunicadoElegivel[]> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase.rpc('comunicados_elegiveis', {
        p_user_id: user.id,
        p_dia: diaLocal(),
        p_session_key: sessionKey,
      })

      if (error) {
        console.error('Erro ao buscar comunicados elegíveis:', error)
        return []
      }

      const ids = (data ?? []).map((c: { id: string }) => c.id)
      if (ids.length === 0) return []

      // Busca o registro completo para garantir que todos os campos
      // (inclusive duracao_segundos) reflitam o valor real gravado.
      const { data: completos, error: errCompletos } = await supabase
        .from('comunicados')
        .select('id, descricao, destino_usuario_id, periodicidade, vezes_por_dia, duracao_segundos, data_inicio, hora_inicio, data_fim, ativo')
        .in('id', ids)

      if (errCompletos) {
        console.error('[Comunicados] falha ao ler comunicados completos:', errCompletos)
      }

      const porId = new Map(
        ((completos ?? []) as Array<Record<string, unknown>>).map((c) => [c.id as string, c]),
      )

      const { data: midias, error: errMidias } = await supabase
        .from('comunicado_midias')
        .select('*')
        .in('comunicado_id', ids)
        .order('ordem', { ascending: true })

      if (errMidias) console.error('Erro ao carregar mídias:', errMidias)

      const midiasPorComunicado = new Map<string, ComunicadoMidia[]>()
      for (const m of (midias ?? []) as unknown as ComunicadoMidia[]) {
        const lista = midiasPorComunicado.get(m.comunicado_id) ?? []
        lista.push(m)
        midiasPorComunicado.set(m.comunicado_id, lista)
      }

      return (data ?? []).map((row: Record<string, unknown>) => {
        // Preferir o registro completo; cair para a linha da RPC.
        const cheio = porId.get(row.id as string) ?? row

        return {
          id: cheio.id as string,
          descricao: cheio.descricao as string,
          destino_usuario_id: (cheio.destino_usuario_id as string) ?? null,
          periodicidade: cheio.periodicidade as Periodicidade,
          vezes_por_dia: Number(cheio.vezes_por_dia ?? 1),
          duracao_segundos: Number(cheio.duracao_segundos ?? 15),
          data_inicio: cheio.data_inicio as string,
          hora_inicio: cheio.hora_inicio as string,
          data_fim: (cheio.data_fim as string) ?? null,
          ativo: cheio.ativo !== false,
          midias: midiasPorComunicado.get(cheio.id as string) ?? [],
          jaExibidas: Number(row.ja_exibidas ?? 0),
          totalPermitidas: Number(row.total_permitidas ?? 1),
          jaExibidoNaSessao: Boolean(row.ja_exibido_na_sessao),
        }
      })
    },
  })
}

/**
 * Usuários disponíveis como destinatários.
 *
 * `supabase.auth.admin.listUsers()` exige a chave `service_role`, que o
 * cliente não tem — por isso usamos as RPCs já usadas pelo restante do
 * sistema: `admin_list_users` (restringida a administradores) e, como
 * alternativa, `get_users`.
 */
export function useUsuariosDestinatarios() {
  return useQuery({
    queryKey: ['comunicados', 'usuarios'],
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      // 1) RPC usada pela aba "Usuários e Acessos" do painel admin
      const { data, error } = await supabase.rpc('admin_list_users')

      if (!error && Array.isArray(data) && data.length > 0) {
        return (data as Array<{ id: string; name?: string | null; email?: string | null }>).map(
          (u) => ({
            id: u.id,
            nome: u.name || u.email || 'Usuário',
            email: u.email ?? '',
          }),
        )
      }

      if (error) {
        console.warn('[Comunicados] admin_list_users indisponível:', error.message)
      }

      // 2) RPC usada pela presença de usuários
      const { data: getUsers, error: errGetUsers } = await supabase.rpc('get_users')

      if (!errGetUsers && Array.isArray(getUsers) && getUsers.length > 0) {
        return (getUsers as Array<{ id: string; name?: string | null; email?: string | null }>).map(
          (u) => ({
            id: u.id,
            nome: u.name || u.email || 'Usuário',
            email: u.email ?? '',
          }),
        )
      }

      // 3) Último recurso: tabela de efetivos do RH
      const { data: efetivos, error: errEfetivos } = await supabase
        .from('rh_efetivo')
        .select('id, nome, status')
        .eq('status', 'Ativo')
        .order('nome')

      if (errEfetivos) {
        console.error('[Comunicados] nenhuma fonte de usuários disponível:', errEfetivos)
        return []
      }

      return ((efetivos ?? []) as Array<{ id: string; nome?: string | null }>).map((e) => ({
        id: e.id,
        nome: e.nome || 'Usuário',
        email: '',
      }))
    },
  })
}

/* ------------------------------------------------------------------ */
/*  Upload                                                              */
/* ------------------------------------------------------------------ */

export function useUploadMidiaComunicado() {
  return useMutation({
    mutationFn: async (file: File): Promise<{ path: string; tipo: string; capaPath?: string }> => {
      const tipo = detectarTipoMidia(file.type, file.name)
      if (!tipo) throw new Error(`Tipo de arquivo não suportado: ${file.name}`)

      const extensao = file.name.split('.').pop() || 'bin'
      const unico = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      const caminho = `${unico}.${extensao}`

      const { error } = await supabase.storage
        .from(BUCKET_COMUNICADOS)
        .upload(caminho, file, { cacheControl: '3600', upsert: false })

      if (error) throw error

      let capaPath: string | undefined

      // Áudio precisa de uma imagem de capa para ser exibido junto do player
      if (tipo === 'audio') {
        const capapng = await gerarCapaAudio(file)
        if (capapng) {
          capaPath = `${unico}_capa.png`
          const { error: errCapa } = await supabase.storage
            .from(BUCKET_COMUNICADOS)
            .upload(capaPath, capapng, { cacheControl: '3600', upsert: false })
          if (errCapa) {
            console.warn('Não foi possível gerar a capa do áudio:', errCapa)
            capaPath = undefined
          }
        }
      }

      return { path: caminho, tipo, capaPath }
    },
    onError: (error) => {
      console.error('Erro no upload da mídia:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar a mídia.')
    },
  })
}

/** Gera uma imagem de capa (data URI) para o áudio no cliente. */
async function gerarCapaAudio(file: File): Promise<Blob | null> {
  try {
    const url = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    audio.src = url
    audio.muted = true

    const duracao = await new Promise<number>((resolve) => {
      audio.onloadedmetadata = () => resolve(audio.duration || 0)
      audio.onerror = () => resolve(0)
      setTimeout(() => resolve(0), 3000)
    })

    const canvas = document.createElement('canvas')
    const largura = 640
    const altura = 360
    canvas.width = largura
    canvas.height = altura

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      URL.revokeObjectURL(url)
      return null
    }

    const gradiente = ctx.createLinearGradient(0, 0, largura, altura)
    gradiente.addColorStop(0, '#1c1d21')
    gradiente.addColorStop(1, '#3b3f4a')
    ctx.fillStyle = gradiente
    ctx.fillRect(0, 0, largura, altura)

    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(largura / 2, altura / 2 - 14, 46, 0, Math.PI * 2)
    ctx.fill()

    // Símbolo de play
    ctx.fillStyle = '#1c1d21'
    ctx.beginPath()
    ctx.moveTo(largura / 2 - 12, altura / 2 - 30)
    ctx.lineTo(largura / 2 + 20, altura / 2 - 14)
    ctx.lineTo(largura / 2 - 12, altura / 2 + 2)
    ctx.closePath()
    ctx.fill()

    ctx.font = '600 26px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText(
      duracao ? `${formatarDuracaoTexto(duracao)}` : 'ÁUDIO',
      largura / 2,
      altura / 2 + 78,
    )

    URL.revokeObjectURL(url)

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    })
  } catch (e) {
    console.warn('Falha ao gerar capa do áudio:', e)
    return null
  }
}

function formatarDuracaoTexto(segundos: number): string {
  const min = Math.floor(segundos / 60)
  const seg = Math.round(segundos % 60)
  return `${min}:${String(seg).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                           */
/* ------------------------------------------------------------------ */

export function useSalvarComunicado() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      formulario: FormularioComunicado
      midias: Array<{ path: string; tipo: string; capaPath?: string; mimeType?: string }>
    }) => {
      const { formulario, midias } = input

      const { data: userData } = await supabase.auth.getUser()
      const criadoPor = userData.user?.id ?? null

      const { data: comunicado, error } = await supabase
        .from('comunicados')
        .insert({
          descricao: formulario.descricao.trim(),
          destino_usuario_id: formulario.destinoUsuarioId,
          periodicidade: formulario.periodicidade,
          vezes_por_dia: formulario.periodicidade === 'todo_dia' ? 1 : formulario.vezesPorDia,
          duracao_segundos: formulario.duracaoSegundos,
          data_inicio: formulario.dataInicio,
          hora_inicio: formulario.horaInicio,
          data_fim: formulario.dataFim || null,
          ativo: formulario.ativo,
          imediato: formulario.imediato,
          criado_por: criadoPor,
        })
        .select()
        .single()

      if (error) throw error

      if (midias.length > 0) {
        const linhas = midias.map((m, i) => ({
          comunicado_id: comunicado.id,
          tipo: m.tipo,
          storage_path: m.path,
          mime_type: m.mimeType ?? null,
          capa_path: m.capaPath ?? null,
          ordem: i,
        }))

        const { error: errMidias } = await supabase
          .from('comunicado_midias')
          .insert(linhas)

        if (errMidias) throw errMidias
      }

      return comunicado
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comunicados'] })
      toast.success('Comunicado criado com sucesso.')
    },
    onError: (error) => {
      console.error('Erro ao salvar comunicado:', error)
      // O Supabase devolve { message, code, details } — não é Error.
      const msg = (error as { message?: string })?.message
      toast.error(msg || 'Erro ao salvar o comunicado.')
    },
  })
}

export function useAtualizarComunicado() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { id: string; formulario: FormularioComunicado }) => {
      const { id, formulario } = input
      const { error } = await supabase
        .from('comunicados')
        .update({
          descricao: formulario.descricao.trim(),
          destino_usuario_id: formulario.destinoUsuarioId,
          periodicidade: formulario.periodicidade,
          vezes_por_dia: formulario.periodicidade === 'todo_dia' ? 1 : formulario.vezesPorDia,
          duracao_segundos: formulario.duracaoSegundos,
          data_inicio: formulario.dataInicio,
          hora_inicio: formulario.horaInicio,
          data_fim: formulario.dataFim || null,
          ativo: formulario.ativo,
          imediato: formulario.imediato,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comunicados'] })
      toast.success('Comunicado atualizado.')
    },
    onError: (error) => {
      console.error('Erro ao atualizar comunicado:', error)
      toast.error('Erro ao atualizar o comunicado.')
    },
  })
}

export function useExcluirComunicado() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      // Remove os arquivos do storage antes de excluir o registro
      const { data: midias } = await supabase
        .from('comunicado_midias')
        .select('storage_path, capa_path')
        .eq('comunicado_id', id)

      const caminhos = ((midias ?? []) as Array<{ storage_path: string; capa_path: string | null }>)
        .flatMap((m: { storage_path: string; capa_path: string | null }) => [m.storage_path, m.capa_path])
        .filter(Boolean) as string[]

      if (caminhos.length > 0) {
        await supabase.storage.from(BUCKET_COMUNICADOS).remove(caminhos)
      }

      const { error } = await supabase.from('comunicados').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comunicados'] })
      toast.success('Comunicado excluído.')
    },
    onError: (error) => {
      console.error('Erro ao excluir comunicado:', error)
      toast.error('Erro ao excluir o comunicado.')
    },
  })
}

export function useAlternarAtivoComunicado() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('comunicados')
        .update({ ativo: input.ativo, atualizado_em: new Date().toISOString() })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comunicados'] })
    },
    onError: (error) => {
      console.error('Erro ao alternar status do comunicado:', error)
      toast.error('Erro ao alterar o status.')
    },
  })
}

/* ------------------------------------------------------------------ */
/*  Exibição (usuário final)                                            */
/* ------------------------------------------------------------------ */

/** Registra que o comunicado foi exibido. Retorna o id da exibição. */
export async function registrarExibicao(
  comunicadoId: string,
  sessionKey: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('comunicado_registrar_exibicao', {
    p_comunicado_id: comunicadoId,
    p_dia: diaLocal(),
    p_session_key: sessionKey,
  })

  if (error) {
    // 23505 = chave duplicada. Ocorre quando o mesmo comunicado já foi
    // registrado no dia (ex.: dois StrictMode mounts ou re-renderização
    // seguida de refresh). Não é um erro: a exibição já existe.
    if (error.code === '23505') {
      console.info(
        '[Comunicados] Exibição já registrada hoje para este comunicado. ' +
          'Nada a fazer.',
      )
      return null
    }

    console.error('Erro ao registrar exibição:', error)
    return null
  }

  const linha = (data as unknown as { id: string }) ?? null
  return linha?.id ?? null
}

/** Registra o fechamento da exibição. */
export async function registrarFechamento(
  exibicaoId: string,
  modo: 'manual' | 'automatico',
): Promise<void> {
  const { error } = await supabase.rpc('comunicado_registrar_fechamento', {
    p_exibicao_id: exibicaoId,
    p_modo: modo,
  })
  if (error) console.error('Erro ao registrar fechamento:', error)
}

/** URL pública de uma mídia do bucket. */
export function urlPublicaMidia(storagePath: string): string {
  const { data } = supabase.storage.from(BUCKET_COMUNICADOS).getPublicUrl(storagePath)
  return data.publicUrl
}