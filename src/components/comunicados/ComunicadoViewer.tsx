import { useEffect, useMemo, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { supabase } from '../../lib/supabase'
import { useComunicadosElegiveis } from '../../lib/comunicados/api'
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
  const [indice, setIndice] = useState(0)
  const [ocultarNestaSessao, setOcultarNestaSessao] = useState(false)
  const [gatilho, setGatilho] = useState(0)
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
        // Novo login: nova sessão de comunicados
        setUserId(sessao.user.id)
        setSessionKey(gerarSessionKey())
        setIndice(0)
      } else {
        setUserId(null)
        setSessionKey('')
      }
    })

    return () => {
      ativo = false
      subscription.unsubscribe()
    }
  }, [])

  const { data: elegiveis } = useComunicadosElegiveis(sessionKey || null, gatilho)

  // Só exibir depois que a sessão estiver resolvida
  const podeConsultar = Boolean(userId && sessionKey)
  const lista = useMemo(() => elegiveis ?? [], [elegiveis])

  const atual = lista[indice]

  // Se a lista encolheu (limite diário atingido), reinicia o índice
  useEffect(() => {
    if (indice >= lista.length) setIndice(0)
  }, [lista.length, indice])

  // Reabre a busca se um novo comunicado for criado enquanto o usuário
  // já está com o sistema aberto (evita travar para a sessão inteira).
  useEffect(() => {
    if (lista.length > 0) setOcultarNestaSessao(false)
  }, [lista.length])

  if (!podeConsultar || ocultarNestaSessao || lista.length === 0 || !atual) return null

  const proximo = () => {
    if (indice + 1 < lista.length) {
      setIndice(indice + 1)
    } else {
      // Todos exibidos nesta sessão
      setOcultarNestaSessao(true)
      setIndice(0)
    }
  }

  return (
    <ComunicadoModal
      key={atual.id}
      comunicado={atual}
      sessionKey={sessionKey}
      onClose={proximo}
    />
  )
}