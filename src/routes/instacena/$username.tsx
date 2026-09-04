import { createFileRoute } from '@tanstack/react-router'
import { Settings, Grid, Film, Bookmark, UserCheck, UserPlus, Image as ImageIcon } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/instacena/$username')({
  component: ProfileRoute,
})

function ProfileRoute() {
  const { username } = Route.useParams()
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved' | 'tagged'>('posts')
  const isOwnProfile = username === 'seu_usuario' // Mock for now
  
  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto py-8 px-4 md:px-8">
      
      {/* Profile Header */}
      <header className="flex flex-col md:flex-row gap-8 md:gap-16 items-start md:items-center mb-12">
        <div className="w-24 h-24 md:w-36 md:h-36 shrink-0 rounded-full bg-gradient-to-tr from-yellow-400 to-purple-500 p-[3px] mx-auto md:mx-0">
          <div className="w-full h-full rounded-full bg-white dark:bg-[#0a0a0c] border-4 border-transparent overflow-hidden">
            <img src="https://i.pravatar.cc/150?u=sucena" alt="Profile" className="w-full h-full object-cover" />
          </div>
        </div>
        
        <div className="flex flex-col gap-4 flex-1">
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
            <h2 className="text-xl font-normal">{username}</h2>
            <div className="flex items-center gap-2">
              {isOwnProfile ? (
                <>
                  <button className="px-4 py-1.5 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 rounded-lg font-semibold text-sm transition-colors">
                    Editar perfil
                  </button>
                  <button className="px-4 py-1.5 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 rounded-lg font-semibold text-sm transition-colors">
                    Ver arquivo
                  </button>
                  <button className="p-1.5 hover:opacity-70 transition-opacity">
                    <Settings size={24} />
                  </button>
                </>
              ) : (
                <>
                  <button className="px-6 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-sm transition-colors">
                    Seguir
                  </button>
                  <button className="px-4 py-1.5 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 rounded-lg font-semibold text-sm transition-colors">
                    Mensagem
                  </button>
                </>
              )}
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <span className="text-base"><strong className="font-semibold">12</strong> publicações</span>
            <button className="text-base hover:opacity-70"><strong className="font-semibold">245</strong> seguidores</button>
            <button className="text-base hover:opacity-70"><strong className="font-semibold">312</strong> seguindo</button>
          </div>
          
          <div className="flex flex-col">
            <span className="font-bold text-sm">Sucena Empreendimentos</span>
            <span className="text-sm opacity-80 whitespace-pre-line">
              Rede Social Oficial
              ✨ Transformando espaços
              🔗 sucenaempreendimentos.com.br
            </span>
          </div>
        </div>
      </header>

      {/* Mobile Stats (only visible on small screens) */}
      <div className="md:hidden flex items-center justify-around py-4 border-t border-b border-black/10 dark:border-white/10 mb-4">
        <div className="flex flex-col items-center"><strong className="font-semibold">12</strong><span className="text-xs opacity-70">publicações</span></div>
        <div className="flex flex-col items-center"><strong className="font-semibold">245</strong><span className="text-xs opacity-70">seguidores</span></div>
        <div className="flex flex-col items-center"><strong className="font-semibold">312</strong><span className="text-xs opacity-70">seguindo</span></div>
      </div>

      {/* Profile Tabs */}
      <div className="flex items-center justify-center gap-12 border-t border-black/10 dark:border-white/10">
        <button 
          onClick={() => setActiveTab('posts')}
          className={`flex items-center gap-2 py-4 border-t-2 transition-colors ${activeTab === 'posts' ? 'border-gray-900 dark:border-white font-semibold' : 'border-transparent opacity-50 hover:opacity-100'}`}
        >
          <Grid size={16} /> <span className="text-xs uppercase tracking-widest hidden md:block">Publicações</span>
        </button>
        <button 
          onClick={() => setActiveTab('reels')}
          className={`flex items-center gap-2 py-4 border-t-2 transition-colors ${activeTab === 'reels' ? 'border-gray-900 dark:border-white font-semibold' : 'border-transparent opacity-50 hover:opacity-100'}`}
        >
          <Film size={16} /> <span className="text-xs uppercase tracking-widest hidden md:block">Reels</span>
        </button>
        {isOwnProfile && (
          <button 
            onClick={() => setActiveTab('saved')}
            className={`flex items-center gap-2 py-4 border-t-2 transition-colors ${activeTab === 'saved' ? 'border-gray-900 dark:border-white font-semibold' : 'border-transparent opacity-50 hover:opacity-100'}`}
          >
            <Bookmark size={16} /> <span className="text-xs uppercase tracking-widest hidden md:block">Salvos</span>
          </button>
        )}
        <button 
          onClick={() => setActiveTab('tagged')}
          className={`flex items-center gap-2 py-4 border-t-2 transition-colors ${activeTab === 'tagged' ? 'border-gray-900 dark:border-white font-semibold' : 'border-transparent opacity-50 hover:opacity-100'}`}
        >
          <UserCheck size={16} /> <span className="text-xs uppercase tracking-widest hidden md:block">Marcados</span>
        </button>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-3 gap-1 md:gap-2 mt-4">
        {[1,2,3,4,5,6,7,8,9].map(i => (
          <div key={i} className="aspect-square bg-gray-200 dark:bg-white/5 relative group cursor-pointer overflow-hidden">
            <img src={`https://picsum.photos/seed/${username}${i}/400/400`} alt="Post" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
            
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6 text-white font-bold">
              <span className="flex items-center gap-2"><Heart size={20} fill="currentColor" /> {Math.floor(Math.random() * 100)}</span>
              <span className="flex items-center gap-2"><MessageCircle size={20} fill="currentColor" /> {Math.floor(Math.random() * 20)}</span>
            </div>
            
            {/* Top right icon */}
            <div className="absolute top-2 right-2 text-white drop-shadow-md">
              {i % 3 === 0 ? <Film size={18} fill="currentColor" /> : <ImageIcon size={18} fill="currentColor" />}
            </div>
          </div>
        ))}
      </div>
      
    </div>
  )
}
