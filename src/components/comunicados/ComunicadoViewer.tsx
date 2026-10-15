import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { supabase } from '../../lib/supabase'
import { useComunicadosElegiveis } from '../../lib/comunicados/api'
import { escolherComunicado, type ComunicadoElegivel } from '../../lib/comunicados/regras'
import { ComunicadoModal } from './ComunicadoModal'

/**
 * Identificador estável da sessão do usuário.
 *
 * Gera uma chave nova a cada abertura do app/login, o que permite:
 *  - no modo "dia todo", exibir uma vez por sessão;
 *  - em "n vezes por dia", exibir novamente em uma sessão posterior.
 */
function gerarSessionKey(): string {
  const chave = 'comunicado_session_key'
  try {
    const existente = sessionStorage.getItem(chave)
    if (existente) return existente
    const nova = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    sessionStorage.setItem(chave, nova)
    return nova
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
}

/**
 * Orquestra a exibição dos comunicados elegíveis.
 *
 * - Mostra um por vez, na ordem de criação (mais recentes primeiro).
 * - Ao fechar, avança para o próximo elegível.
 * - Encerrar manualmente consome apenas a ocorrência atual: o
 *   comunicado pode voltar a aparecer em outra sessão se ainda houver
 *   exibições disponíveis.
 */
export function ComunicadoViewer() {
  const [userId, setUserId] = useState<string | null>(null)
  const [sessionKey, setSessionKey] = useState<string>('')
  const [gatilho, setGatilho] = useState(0)
  // Comunicado atualmente na tela (o polling não pode interrompê-lo)
  const [emExibicaoId, setEmExibicaoId] = useState<string | null>(null)
  // Comunicados já exibidos e encerrados nesta sessão
  const [jaExibidos, setJaExibidos] = useState<string[]>([])
  // Comunicados que o servidor insiste em reenviar (modo "todo dia")
  const [jaExibidosSempre, setJaExibidosSempre] = useState<string[]>([])
  const router = useRouter()
  const caminho = router.state.location.pathname

  // Reconsulta a cada navegação: garante que um comunicado criado no
  // Admin apareça ao ir para outra tela sem precisar recarregar.
  useEffect(() => {
    if (!userId || !sessionKey) return
    setGatilho((n) => n + 1)
  }, [caminho, userId, sessionKey])

  useEffect(() => {
    let ativo = true

    supabase.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => {
      if (!ativo) return
      if (data.user?.id) {
        setUserId(data.user.id)
        setSessionKey(gerarSessionKey())
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_evento: string, sessao: { user: { id: string } | null } | null) => {
      if (!ativo) return
      if (sessao?.user?.id) {
        // Novo login: começa uma nova sessão de comunicados
        setUserId(sessao.user.id)
        setSessionKey(gerarSessionKey())
        setEmExibicaoId(null)
        setJaExibidos([])
      } else {
        setUserId(null)
        setSessionKey('')
        setEmExibicaoId(null)
      }
    })

    return () => {
      ativo = false
      subscription.unsubscribe()
    }
  }, [])

  const { data: elegiveis } = useComunicadosElegiveis(sessionKey || null, gatilho)

  // Cache em memória dos comunicados recebidos. Permite manter o modal
  // vivo mesmo depois de o servidor consumir o saldo diário.
  const listaCacheRef = useRef<Map<string, ComunicadoElegivel>>(new Map())

  useEffect(() => {
    for (const c of elegiveis ?? []) {
      if (!listaCacheRef.current.has(c.id)) {
        listaCacheRef.current.set(c.id, c)
      }
    }
  }, [elegiveis])

  // Só exibir depois que a sessão estiver resolvida
  const podeConsultar = Boolean(userId && sessionKey)

  /**
   * Escolhe qual comunicado exibir.
   *
   * Dois estados separados são essenciais:
   *  - `emExibicaoId`: o que está na tela AGORA. O polling não pode
   *    interrompê-lo, senão o timer reinicia a cada 15s.
   *  - `jaExibidos`: o que JÁ foi exibido. Só estes são bloqueados para
   *    o resto da sessão.
   *
   * Confundir os dois fazia um comunicado recém-criado ser marcado como
   * visto antes de aparecer, e o polling o descartava para sempre.
   *
   * `emExibicao` guarda o objeto em memória. Registrar a exibição
   * consome o saldo diário, então o servidor deixa de devolver o
   * comunicado no poll seguinte; sem esse cache o modal seria
   * desmontado aos ~15s.
   */
  const emExibicao = useMemo(
    () => (emExibicaoId ? listaCacheRef.current.get(emExibicaoId) ?? null : null),
    [emExibicaoId, elegiveis],
  )

  const atual = useMemo(() => {
    if (emExibicao) return emExibicao

    return escolherComunicado(
      elegiveis ?? [],
      jaExibidos,
      null,
      jaExibidosSempre,
    )
  }, [emExibicao, elegiveis, jaExibidos, jaExibidosSempre])

  /**
   * Se o comunicado em exibição desaparecer da lista do servidor,
   * libera o estado para o próximo.
   *
   * ATENÇÃO: registrar a exibição consome o saldo diário, então o
   * servidor pode devolver a lista vazia logo depois do modal abrir.
   * Por isso a limpeza só ocorre quando NÃO há nada em exibição — se
   * removêssemos aqui, o modal seria desmontado no primeiro poll e a
   * contagem morria em ~15s.
   */
  useEffect(() => {
    if (emExibicaoId && !atual) {
      setEmExibicaoId(null)
    }
  }, [atual?.id, emExibicaoId])

  const fechar = useCallback(() => {
    // Marca como visto e libera a tela para o próximo
    if (emExibicaoId) {
      setJaExibidos((prev) =>
        prev.includes(emExibicaoId) ? prev : [...prev, emExibicaoId],
      )
      setEmExibicaoId(null)
    }
  }, [emExibicaoId])

  if (!podeConsultar || !atual) return null

  return (
    <ComunicadoModal
      key={atual.id}
      comunicado={atual}
      sessionKey={sessionKey}
      onExibir={() => setEmExibicaoId(atual.id)}
      onClose={fechar}
    />
  )
}