import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export const Route = createFileRoute('/instacena/perfil')({
  component: RedirectProfileRoute,
})

function RedirectProfileRoute() {
  const navigate = useNavigate()
  const [loadingText, setLoadingText] = useState('Carregando seu perfil...')

  useEffect(() => {
    async function initializeProfile() {
      try {
        // 1. Obter usuário logado
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !user) {
          console.error("Usuário não autenticado", userError)
          // Se não estiver logado, redirecionar para a home
          navigate({ to: '/' })
          return
        }

        // 2. Checar se já possui perfil no Instacena
        const { data: profile, error: profileError } = await supabase
          .from('social_profiles')
          .select('username')
          .eq('user_id', user.id)
          .single()

        if (profileError && profileError.code !== 'PGRST116') {
          console.error("Erro ao checar perfil:", profileError)
          setLoadingText(`Erro de banco de dados: ${profileError.message}`)
          return
        }

        if (profile && profile.username) {
          // Perfil já existe, redirecionar para ele
          navigate({ to: `/instacena/${profile.username}` })
          return
        }

        // 3. Se não existe, vamos criar um automaticamente!
        setLoadingText('Criando seu perfil no Instacena...')
        
        const metadata = user.user_metadata || {}
        const fullName = metadata.full_name || metadata.name || user.email?.split('@')[0] || 'usuario'
        const avatarUrl = metadata.avatar_url || ''

        // Gerar um username base: minúsculas, remover acentos, trocar espaços por ponto
        let baseUsername = fullName
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, ".")
          .replace(/\.+/g, ".")
          .replace(/^\.|\.$/g, "")

        if (baseUsername.length < 3) baseUsername = baseUsername + 'user'

        // Garantir que o username é único
        let isUnique = false
        let finalUsername = baseUsername
        let suffix = 1

        while (!isUnique) {
          const { data: existing } = await supabase
            .from('social_profiles')
            .select('id')
            .eq('username', finalUsername)
            .single()

          if (existing) {
            finalUsername = `${baseUsername}${suffix}`
            suffix++
          } else {
            isUnique = true
          }
        }

        // Inserir no banco
        const { error: insertError } = await supabase
          .from('social_profiles')
          .insert({
            user_id: user.id,
            username: finalUsername,
            display_name: fullName,
            avatar_url: avatarUrl
          })

        if (insertError) {
          console.error("Erro ao criar perfil:", insertError)
          setLoadingText(`Erro ao criar perfil: ${insertError.message}`)
          return
        }

        // Tudo certo! Redirecionar
        navigate({ to: `/instacena/${finalUsername}` })

      } catch (err) {
        console.error("Erro inesperado:", err)
        setLoadingText('Ocorreu um erro inesperado.')
      }
    }

    initializeProfile()
  }, [navigate])

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[500px]">
      <div className="w-12 h-12 border-4 border-gray-300 dark:border-gray-700 border-t-black dark:border-t-white rounded-full animate-spin mb-4"></div>
      <p className="text-lg font-medium text-gray-700 dark:text-gray-300">{loadingText}</p>
    </div>
  )
}
