import { useEffect, useMemo, useState } from 'react'
import Megaphone from 'lucide-react/dist/esm/icons/megaphone.js'
import Plus from 'lucide-react/dist/esm/icons/plus.js'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js'
import Pencil from 'lucide-react/dist/esm/icons/pencil.js'
import X from 'lucide-react/dist/esm/icons/x.js'
import Paperclip from 'lucide-react/dist/esm/icons/paperclip.js'
import Loader2 from 'lucide-react/dist/esm/icons/loader-circle.js'
import AlertTriangle from 'lucide-react/dist/esm/icons/triangle-alert.js'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import type { ComunicadoCompleto, FormularioComunicado } from '../../lib/comunicados/api'
import {
  useAlternarAtivoComunicado,
  useComunicadosAdmin,
  useExcluirComunicado,
  useSalvarComunicado,
  useAtualizarComunicado,
  useUploadMidiaComunicado,
  useUsuariosDestinatarios,
} from '../../lib/comunicados/api'
import {
  detectarTipoMidia,
  validarComunicado,
  type Periodicidade,
  type TipoMidia,
} from '../../lib/comunicados/regras'
import { useDiagnosticoComunicados } from '../../lib/comunicados/diagnostico'

interface MidiaPendente {
  id: string
  tipo: TipoMidia
  arquivo: File
  previewUrl: string
  path?: string
  capaPath?: string
}

const FORMULARIO_VAZIO: FormularioComunicado = {
  descricao: '',
  destinoUsuarioId: null,
  periodicidade: 'unica',
  vezesPorDia: 1,
  duracaoSegundos: 15,
  dataInicio: new Date().toISOString().slice(0, 10),
  horaInicio: '00:00:00',
  dataFim: null,
  ativo: true,
  imediato: false,
}

const PERIODICIDADES: Array<{ valor: Periodicidade; rotulo: string; ajuda: string }> = [
  { valor: 'unica', rotulo: 'Uma vez', ajuda: 'Exibe uma única vez no dia, para todos que abrirem o sistema.' },
  { valor: 'diaria', rotulo: 'N vezes por dia', ajuda: 'Repete a quantidade definida enquanto durar o período.' },
  { valor: 'todo_dia', rotulo: 'Todo dia', ajuda: 'Exibe uma vez a cada sessão, sem limite diário.' },
]

export function ComunicadosAdmin({ isDark }: { isDark: boolean }) {
  const { data: comunicados, isLoading } = useComunicadosAdmin()
  const { data: usuarios, isLoading: carregandoUsuarios } = useUsuariosDestinatarios()
  const { data: banco, isLoading: verificandoBanco } = useDiagnosticoComunicados()
  const salvar = useSalvarComunicado()
  const atualizar = useAtualizarComunicado()
  const excluir = useExcluirComunicado()
  const alternarAtivo = useAlternarAtivoComunicado()
  const uploadMidia = useUploadMidiaComunicado()

  const [editando, setEditando] = useState<ComunicadoCompleto | null>(null)
  const [formulario, setFormulario] = useState<FormularioComunicado>(FORMULARIO_VAZIO)
  const [enviarParaTodos, setEnviarParaTodos] = useState(true)
  const [midias, setMidias] = useState<MidiaPendente[]>([])
  const [erros, setErros] = useState<string[]>([])
  const [duracaoMinutos, setDuracaoMinutos] = useState(0)
  const [duracaoSegundos, setDuracaoSegundos] = useState(15)

  // Mantém os dois campos de duração sincronizados
  useEffect(() => {
    const total = duracaoMinutos * 60 + duracaoSegundos
    setFormulario((f) => ({ ...f, duracaoSegundos: total }))
  }, [duracaoMinutos, duracaoSegundos])

  useEffect(() => {
    if (!editando) return
    const total = editando.duracao_segundos
    setDuracaoMinutos(Math.floor(total / 60))
    setDuracaoSegundos(total % 60)
  }, [editando])

  // Limpa previews ao desmontar
  useEffect(() => {
    return () => {
      midias.forEach((m) => URL.revokeObjectURL(m.previewUrl))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const listaUsuarios = useMemo(() => usuarios ?? [], [usuarios])

  function abrirNovo() {
    setEditando(null)
    setFormulario({
      ...FORMULARIO_VAZIO,
      dataInicio: new Date().toISOString().slice(0, 10),
    })
    setEnviarParaTodos(true)
    setDuracaoMinutos(0)
    setDuracaoSegundos(15)
    midias.forEach((m) => URL.revokeObjectURL(m.previewUrl))
    setMidias([])
    setErros([])
  }

  function abrirEdicao(comunicado: ComunicadoCompleto) {
    setEditando(comunicado)
    setFormulario({
      descricao: comunicado.descricao,
      destinoUsuarioId: comunicado.destino_usuario_id,
      periodicidade: comunicado.periodicidade,
      vezesPorDia: comunicado.vezes_por_dia,
      duracaoSegundos: comunicado.duracao_segundos,
      dataInicio: comunicado.data_inicio,
      horaInicio: String(comunicado.hora_inicio).slice(0, 8),
      dataFim: comunicado.data_fim,
      ativo: comunicado.ativo,
      imediato: comunicado.imediato ?? false,
    })
    setEnviarParaTodos(comunicado.destino_usuario_id === null)
    midias.forEach((m) => URL.revokeObjectURL(m.previewUrl))
    setMidias([])
    setErros([])
  }

  async function adicionarArquivos(arquivos: FileList | null) {
    if (!arquivos || arquivos.length === 0) return

    const novos: MidiaPendente[] = []
    for (const arquivo of Array.from(arquivos)) {
      const tipo = detectarTipoMidia(arquivo.type, arquivo.name)
      if (!tipo) continue
      novos.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        tipo,
        arquivo,
        previewUrl: URL.createObjectURL(arquivo),
      })
    }
    setMidias((atuais) => [...atuais, ...novos])
  }

  async function enviarFormulario(e: React.FormEvent) {
    e.preventDefault()

    const validacao = validarComunicado({
      descricao: formulario.descricao,
      destinoUsuarioId: formulario.destinoUsuarioId,
      enviarParaTodos,
      periodicidade: formulario.periodicidade,
      vezesPorDia: formulario.vezesPorDia,
      duracaoSegundos: formulario.duracaoSegundos,
      dataInicio: formulario.dataInicio,
      horaInicio: formulario.horaInicio,
      dataFim: formulario.dataFim,
      midias: midias.map((m) => ({ tipo: m.tipo, size: m.arquivo.size, mimeType: m.arquivo.type })),
    })

    if (!validacao.valido) {
      setErros(validacao.erros)
      return
    }
    setErros([])

    // Envia as mídias primeiro para obter os caminhos
    const uploaded: Array<{ path: string; tipo: string; capaPath?: string; mimeType?: string }> = []
    for (const midia of midias) {
      if (midia.path) {
        uploaded.push({ path: midia.path, tipo: midia.tipo, capaPath: midia.capaPath, mimeType: midia.arquivo.type })
        continue
      }
      const resultado = await uploadMidia.mutateAsync(midia.arquivo)
      uploaded.push({
        path: resultado.path,
        tipo: resultado.tipo,
        capaPath: resultado.capaPath,
        mimeType: midia.arquivo.type,
      })
    }

    const dados = {
      formulario: {
        ...formulario,
        destinoUsuarioId: enviarParaTodos ? null : formulario.destinoUsuarioId,
      },
      midias: uploaded,
    }

    try {
      if (editando) {
        await atualizar.mutateAsync({ id: editando.id, formulario: dados.formulario })
        // Mídias já anexadas são preservadas; apenas as novas são adicionadas
        if (uploaded.length > 0) {
          await anexarMidias(editando.id, uploaded)
        }
        toast.success('Comunicado atualizado.')
      } else {
        await salvar.mutateAsync(dados)
        toast.success(
          formulario.imediato
            ? 'Comunicado criado. Ele será exibido na próxima abertura do sistema.'
            : `Comunicado criado. Será exibido a partir de ${formulario.dataInicio} ${formulario.horaInicio.slice(0, 5)}.`,
        )
      }
      abrirNovo()
    } catch (e: unknown) {
      const mensagem =
        e instanceof Error ? e.message : 'Erro inesperado ao salvar o comunicado.'
      console.error('[Comunicados] Falha ao salvar:', e)
      setErros([mensagem])
      toast.error(mensagem, { duration: 8000 })
    }
  }

  async function anexarMidias(
    comunicadoId: string,
    novas: Array<{ path: string; tipo: string; capaPath?: string; mimeType?: string }>,
  ) {
    const { data: existentes } = await supabase
      .from('comunicado_midias')
      .select('ordem')
      .eq('comunicado_id', comunicadoId)
      .order('ordem', { ascending: false })
      .limit(1)

    const proximoOrdem = (existentes?.[0]?.ordem ?? -1) + 1

    const { error } = await supabase.from('comunicado_midias').insert(
      novas.map((m, i) => ({
        comunicado_id: comunicadoId,
        tipo: m.tipo,
        storage_path: m.path,
        mime_type: m.mimeType ?? null,
        capa_path: m.capaPath ?? null,
        ordem: proximoOrdem + i,
      })),
    )

    if (error) {
      console.error('Erro ao anexar mídias:', error)
      throw error
    }
  }

  const corCartao = isDark ? 'bg-[#15161A] border-white/5' : 'bg-white border-black/5'
  const corInput = isDark ? 'bg-[#0a0a0c] border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'
  const corRotulo = isDark ? 'text-gray-300' : 'text-gray-700'

  return (
    <div className="max-w-6xl mx-auto mt-8 space-y-6">
      {/* Aviso: infraestrutura do banco ainda não aplicada */}
      {verificandoBanco ? (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${isDark ? 'bg-white/5 text-white/60' : 'bg-gray-100 text-gray-600'}`}>
          <Loader2 size={14} className="animate-spin" />
          Verificando a configuração do banco...
        </div>
      ) : banco && !banco.pronto ? (
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-300'}`}>
          <p className={`text-sm font-semibold flex items-center gap-2 ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
            <AlertTriangle size={16} />
            Configuração do banco incompleta
          </p>
          <ul className={`mt-2 ml-6 list-disc text-sm space-y-1 ${isDark ? 'text-amber-200/80' : 'text-amber-800'}`}>
            {!banco.tabelas && <li>Tabelas ausentes (<code>comunicados</code>, <code>comunicado_midias</code>, <code>comunicado_exibicoes</code>)</li>}
            {!banco.funcoes && <li>Funções ausentes (<code>comunicados_elegiveis</code>, <code>comunicado_registrar_exibicao</code>, <code>comunicado_registrar_fechamento</code>)</li>}
            {!banco.bucket && <li>Bucket de mídia ausente (<code>comunicados_midia</code>)</li>}
          </ul>
          <p className={`mt-3 text-sm ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
            Execute o arquivo <code className="px-1 rounded bg-black/10 dark:bg-white/10">supabase/migrations/20261015000000_create_comunicados_module.sql</code> no SQL Editor do Supabase e recarregue a página.
          </p>
        </div>
      ) : null}

      {/* Formulário */}
      <form onSubmit={enviarFormulario} className={`rounded-2xl p-6 shadow-sm border ${corCartao}`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className={`text-xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <Megaphone size={20} />
            {editando ? 'Editar Comunicado' : 'Novo Comunicado'}
          </h2>
          {editando && (
            <button
              type="button"
              onClick={abrirNovo}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <X size={14} className="inline mr-1" /> Cancelar
            </button>
          )}
        </div>

        {erros.length > 0 && (
          <div className={`mb-5 p-4 rounded-xl ${isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}>
            <ul className="space-y-1 text-sm">
              {erros.map((erro, i) => (
                <li key={i} className={isDark ? 'text-red-300' : 'text-red-700'}>{erro}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-5">
          {/* Descrição (obrigatória) */}
          <div>
            <label htmlFor="comunicado-descricao" className={`block text-sm font-semibold mb-2 ${corRotulo}`}>
              Descrição <span className="text-red-500">*</span>
            </label>
            <textarea
              id="comunicado-descricao"
              rows={4}
              required
              value={formulario.descricao}
              onChange={(e) => setFormulario({ ...formulario, descricao: e.target.value })}
              placeholder="Escreva o aviso que será exibido aos usuários..."
              className={`w-full px-4 py-3 rounded-xl border outline-none focus:border-[#D6A72B] transition-colors resize-y ${corInput}`}
            />
          </div>

          {/* Destinatário */}
          <div>
            <span className={`block text-sm font-semibold mb-2 ${corRotulo}`}>
              Destinatário <span className="text-red-500">*</span>
            </span>
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={enviarParaTodos}
                onChange={(e) => {
                  setEnviarParaTodos(e.target.checked)
                  if (e.target.checked) setFormulario({ ...formulario, destinoUsuarioId: null })
                }}
                className="w-5 h-5 rounded accent-[#D6A72B]"
              />
              <span className={`text-sm ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
                Enviar para todos os usuários
              </span>
            </label>

            {!enviarParaTodos && (
              <>
                <select
                  value={formulario.destinoUsuarioId ?? ''}
                  onChange={(e) => setFormulario({ ...formulario, destinoUsuarioId: e.target.value || null })}
                  required
                  aria-label="Selecionar destinatário"
                  className={`w-full px-4 py-3 rounded-xl border outline-none focus:border-[#D6A72B] transition-colors ${corInput}`}
                >
                  <option value="">Selecione o usuário...</option>
                  {listaUsuarios.map((u: { id: string; nome: string }) => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>

                {listaUsuarios.length === 0 && (
                  <p
                    className={`mt-2 text-xs flex items-center gap-1.5 ${
                      carregandoUsuarios
                        ? isDark ? 'text-white/50' : 'text-gray-500'
                        : isDark ? 'text-amber-300' : 'text-amber-700'
                    }`}
                  >
                    {carregandoUsuarios ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        Carregando usuários...
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={12} />
                        Nenhum usuário encontrado. Verifique se as funções <code>admin_list_users</code> e{' '}
                        <code>get_users</code> existem no banco, ou use &quot;Enviar para todos&quot;.
                      </>
                    )}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Mídias */}
          <div>
            <label className={`block text-sm font-semibold mb-2 ${corRotulo}`}>
              Mídias <span className={`text-xs font-normal ${isDark ? 'text-white/40' : 'text-gray-400'}`}>(opcional — vídeo, foto ou música com imagem)</span>
            </label>
            <label
              className={`flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                isDark
                  ? 'border-white/20 hover:border-white/40 hover:bg-white/5'
                  : 'border-gray-300 hover:border-[#D6A72B] hover:bg-[#D6A72B]/5'
              }`}
            >
              <Paperclip size={22} className={isDark ? 'text-white/40' : 'text-gray-400'} />
              <span className={`text-sm ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                Clique para selecionar arquivos
              </span>
              <input
                type="file"
                multiple
                accept="video/*,image/*,audio/*"
                onChange={(e) => adicionarArquivos(e.target.files)}
                className="hidden"
              />
            </label>

            {midias.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                {midias.map((m) => (
                  <div key={m.id} className={`relative rounded-xl overflow-hidden border ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                    {m.tipo === 'video' && (
                      <video src={m.previewUrl} className="w-full h-24 object-cover" muted />
                    )}
                    {m.tipo === 'foto' && (
                      <img src={m.previewUrl} alt="Prévia" className="w-full h-24 object-cover" />
                    )}
                    {m.tipo === 'audio' && (
                      <div className={`w-full h-24 flex items-center justify-center ${isDark ? 'bg-zinc-800' : 'bg-gray-100'}`}>
                        <span className="text-2xl">🎵</span>
                      </div>
                    )}
                    <span className={`absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-black/70 text-white' : 'bg-white/90 text-gray-700'}`}>
                      {m.tipo.toUpperCase()}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(m.previewUrl)
                        setMidias((atuais) => atuais.filter((x) => x.id !== m.id))
                      }}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center"
                      aria-label="Remover mídia"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agendamento */}
          <div>
            <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
              formulario.imediato
                ? isDark
                  ? 'border-[#D6A72B] bg-white/5'
                  : 'border-[#D6A72B] bg-[#D6A72B]/5'
                : isDark
                  ? 'border-white/10 hover:border-white/20'
                  : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="checkbox"
                checked={formulario.imediato}
                onChange={(e) => setFormulario({ ...formulario, imediato: e.target.checked })}
                className="mt-1 w-5 h-5 accent-[#D6A72B]"
              />
              <span>
                <span className={`block text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Exibir imediatamente
                </span>
                <span className={`block text-xs mt-0.5 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                  Aparece assim que o usuário abrir o sistema, sem esperar a data e a hora programadas.
                  A periodicidade e o limite diário continuam valendo.
                </span>
              </span>
            </label>

            {!formulario.imediato && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${corRotulo}`}>Data de início *</label>
                  <input
                    type="date"
                    value={formulario.dataInicio}
                    onChange={(e) => setFormulario({ ...formulario, dataInicio: e.target.value })}
                    required
                    className={`w-full px-4 py-3 rounded-xl border outline-none focus:border-[#D6A72B] transition-colors ${corInput}`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${corRotulo}`}>Hora de início *</label>
                  <input
                    type="time"
                    value={formulario.horaInicio.slice(0, 5)}
                    onChange={(e) => setFormulario({ ...formulario, horaInicio: `${e.target.value}:00` })}
                    required
                    className={`w-full px-4 py-3 rounded-xl border outline-none focus:border-[#D6A72B] transition-colors ${corInput}`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${corRotulo}`}>Data final</label>
                  <input
                    type="date"
                    value={formulario.dataFim ?? ''}
                    min={formulario.dataInicio}
                    onChange={(e) => setFormulario({ ...formulario, dataFim: e.target.value || null })}
                    className={`w-full px-4 py-3 rounded-xl border outline-none focus:border-[#D6A72B] transition-colors ${corInput}`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Periodicidade */}
          <div>
            <span className={`block text-sm font-semibold mb-2 ${corRotulo}`}>Periodicidade *</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PERIODICIDADES.map((p) => (
                <label
                  key={p.valor}
                  className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${
                    formulario.periodicidade === p.valor
                      ? isDark
                        ? 'border-[#D6A72B] bg-white/5'
                        : 'border-[#D6A72B] bg-[#D6A72B]/5'
                      : isDark
                        ? 'border-white/10 hover:border-white/20'
                        : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="periodicidade"
                    checked={formulario.periodicidade === p.valor}
                    onChange={() => setFormulario({ ...formulario, periodicidade: p.valor })}
                    className="mt-1 accent-[#D6A72B]"
                  />
                  <span>
                    <span className={`block text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{p.rotulo}</span>
                    <span className={`block text-xs mt-0.5 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>{p.ajuda}</span>
                  </span>
                </label>
              ))}
            </div>

            {formulario.periodicidade !== 'todo_dia' && (
              <div className="mt-3 max-w-xs">
                <label className={`block text-sm font-semibold mb-2 ${corRotulo}`}>
                  Quantidade de exibições por dia
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={formulario.vezesPorDia}
                  onChange={(e) => setFormulario({ ...formulario, vezesPorDia: Number(e.target.value) })}
                  className={`w-full px-4 py-3 rounded-xl border outline-none focus:border-[#D6A72B] transition-colors ${corInput}`}
                />
              </div>
            )}
          </div>

          {/* Duração */}
          <div>
            <label className={`block text-sm font-semibold mb-2 ${corRotulo}`}>
              Tempo de exibição antes de fechar *
            </label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={duracaoMinutos}
                  onChange={(e) => setDuracaoMinutos(Number(e.target.value))}
                  className={`w-24 px-4 py-3 rounded-xl border outline-none focus:border-[#D6A72B] transition-colors ${corInput}`}
                  aria-label="Minutos"
                />
                <span className={corRotulo}>min</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={duracaoSegundos}
                  onChange={(e) => setDuracaoSegundos(Number(e.target.value))}
                  className={`w-24 px-4 py-3 rounded-xl border outline-none focus:border-[#D6A72B] transition-colors ${corInput}`}
                  aria-label="Segundos"
                />
                <span className={corRotulo}>seg</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={salvar.isPending || atualizar.isPending || uploadMidia.isPending}
            className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: '#D6A72B' }}
          >
            {(salvar.isPending || atualizar.isPending || uploadMidia.isPending) && (
              <Loader2 size={16} className="animate-spin" />
            )}
            {editando ? 'Salvar alterações' : 'Criar comunicado'}
          </button>
        </div>
      </form>

      {/* Lista */}
      <div className={`rounded-2xl p-6 shadow-sm border ${corCartao}`}>
        <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Comunicados cadastrados
        </h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="animate-spin text-gray-400" size={24} />
          </div>
        ) : !comunicados || comunicados.length === 0 ? (
          <p className={`text-center py-10 text-sm ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
            Nenhum comunicado cadastrado ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {comunicados.map((c) => (
              <div
                key={c.id}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center gap-3 ${
                  isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
                } ${c.ativo ? '' : 'opacity-60'}`}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {c.descricao}
                  </p>
                  <div className={`flex flex-wrap items-center gap-2 mt-1.5 text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
<span className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/10">
                      {c.periodicidade === 'unica' ? 'Uma vez' : c.periodicidade === 'diaria' ? `${c.vezes_por_dia}x por dia` : 'Todo dia'}
                    </span>
                    {c.imediato && (
                      <span className="px-2 py-0.5 rounded bg-[#D6A72B]/20 text-[#b8860b] dark:text-amber-400 font-semibold">
                        Imediato
                      </span>
                    )}
                    {!c.imediato && (
                      <span>{c.data_inicio} {String(c.hora_inicio).slice(0, 5)}</span>
                    )}
                    <span>{c.destino_usuario_id ? 'Destinatário específico' : 'Todos os usuários'}</span>
                    {c.midias.length > 0 && <span>{c.midias.length} mídia(s)</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => alternarAtivo.mutate({ id: c.id, ativo: !c.ativo })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      c.ativo
                        ? isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                        : isDark ? 'bg-white/10 text-white/60' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {c.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                  <button
                    onClick={() => abrirEdicao(c)}
                    aria-label="Editar"
                    className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-white/5 text-white/70 hover:bg-white/10' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Excluir este comunicado?')) excluir.mutate(c.id)
                    }}
                    aria-label="Excluir"
                    className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}