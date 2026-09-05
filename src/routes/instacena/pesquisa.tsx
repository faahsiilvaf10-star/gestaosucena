import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { Search, User } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export const Route = createFileRoute('/instacena/pesquisa')({
  component: PesquisaRoute,
})

function PesquisaRoute() {
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    async function loadProfiles() {
      setLoading(true)
      const { data, error } = await supabase
        .from('social_profiles')
        .select('*')
        .order('display_name', { ascending: true })

      if (!error && data) {
        setProfiles(data)
      }
      setLoading(false)
    }

    loadProfiles()
  }, [])

  const filteredProfiles = useMemo(() => {
    const term = searchTerm.toLowerCase()
    return profiles.filter(profile => {
      const nameMatch = profile.display_name?.toLowerCase().includes(term)
      const userMatch = profile.username?.toLowerCase().includes(term)
      return nameMatch || userMatch
    })
  }, [profiles, searchTerm])

  return (
    <div className="w-full h-full p-4 flex flex-col items-center animate-in fade-in">
      <div className="w-full max-w-[600px] mb-6 mt-4">
        <h1 className="text-2xl font-bold mb-4">Pesquisar</h1>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-3 border border-black/10 dark:border-white/10 rounded-xl leading-5 bg-black/5 dark:bg-white/5 text-black dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#0866ff] focus:border-[#0866ff] sm:text-sm transition-colors"
            placeholder="Pesquisar usuários por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="w-full max-w-[600px] flex flex-col gap-2">
        {loading ? (
          <div className="text-center text-gray-500 py-10">Carregando usuários...</div>
        ) : filteredProfiles.length === 0 ? (
          <div className="text-center text-gray-500 py-10">Nenhum usuário encontrado com "{searchTerm}".</div>
        ) : (
          filteredProfiles.map(profile => (
            <Link
              key={profile.id}
              to={`/instacena/$username`}
              params={{ username: profile.username }}
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 border border-black/5 dark:border-white/10 shrink-0">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <User size={24} />
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[16px] text-black dark:text-white">{profile.display_name || profile.username}</span>
                <span className="text-[13px] text-gray-500">@{profile.username}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
