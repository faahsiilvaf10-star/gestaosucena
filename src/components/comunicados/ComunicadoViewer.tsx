import { useEffect, useMemo, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { supabase } from '../../lib/supabase'
import { useComunicadosElegiveis } from '../../lib/comunicados/api'
import { filtrarNaoExibidos } from '../../lib/comunicados/regras'
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
  const [ocultarNestaSessao, setOcultarNestaSessao] = useState(false)
  const [gatilho, setGatilho] = useState(0)
  // Ids já iniciados nesta sessão. Uma vez que o modal abre, o
  // comunicado fica "em uso" e o polling não pode mais reiniciá-lo.
  const [exibidos, setExibidos] = useState<string[]>([])
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
        setExibidos([])
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

  /**
   * Filtra a lista removendo o que já foi exibido nesta sessão.
   *
   * Isso é o que impede o fechamento prematuro: o `refetchInterval` de
   * 15s devolve objetos NOVOS a cada consulta. Sem filtrar, o `key`
   * mudava e o React remontava o modal — zerando a contagem e
   * reiniciando o timer várias vezes.
   */
  const lista = useMemo(
    () => filtrarNaoExibidos(elegiveis ?? [], exibidos),
    [elegiveis, exibidos],
  )

  const atual = lista[0]

  // Marca o comunicado como iniciado assim que ele vai para a tela.
  // Feito em um efeito para não alterar o estado durante o render.
  useEffect(() => {
    if (!atual) return
    setExibidos((prev) => (prev.includes(atual.id) ? prev : [...prev, atual.id]))
  }, [atual?.id])

  // Reabre a busca se um comunicado novo surgir enquanto o usuário
  // já está com o sistema aberto (evita travar para a sessão inteira).
  useEffect(() => {
    if ((elegiveis ?? []).length > 0) setOcultarNestaSessao(false)
  }, [elegiveis?.length])

  if (!podeConsultar || ocultarNestaSessao || lista.length === 0 || !atual) return null

  const proximo = () => {
    // `atual` já está em `exibidos`, então a lista foi recalculada sem ele.
    // Se sobrou outro, o próximo render mostra; caso contrário, encerra.
    if (lista.length <= 1) {
      setOcultarNestaSessao(true)
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