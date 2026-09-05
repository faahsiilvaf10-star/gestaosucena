import { createFileRoute } from '@tanstack/react-router'
import { Settings, Grid, Film, Bookmark, UserCheck, MessageCircle, Heart, Image as ImageIcon, MapPin, BadgeCheck, X, Trash2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export const Route = createFileRoute('/instacena/$username')({
  component: ProfileRoute,
})

function formatPostTime(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace(' de ', ' de ')
  const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  
  let relative = ''
  if (diffInSeconds < 60) {
    relative = 'Agora mesmo'
  } else {
    const diffInMinutes = Math.floor(diffInSeconds / 60)
    const diffInHours = Math.floor(diffInMinutes / 60)
    const diffInDays = Math.floor(diffInHours / 24)
    
    if (diffInDays > 0) {
      const remainingHours = diffInHours % 24
      if (remainingHours > 0) {
        relative = `Há ${diffInDays} d e ${remainingHours} h`
      } else {
        relative = `Há ${diffInDays} d`
      }
    } else if (diffInHours > 0) {
       relative = `Há ${diffInHours} h`
    } else {
       relative = `Há ${diffInMinutes} min`
    }
  }
  
  return `${formattedDate} às ${formattedTime} • ${relative}`
}

function ProfileRoute() {
  const { username } = Route.useParams()
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved' | 'tagged'>('posts')
  const [profile, setProfile] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [totalUsers, setTotalUsers] = useState(0)
  const [selectedPost, setSelectedPost] = useState<any>(null)
  const [postToDelete, setPostToDelete] = useState<string | null>(null)
  
  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editBio, setEditBio] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleDeletePost = (postId: string) => {
    setPostToDelete(postId)
  }

  const confirmDelete = async () => {
    if (!postToDelete) return;
    
    const { error } = await supabase.from('social_posts').delete().eq('id', postToDelete)
    if (!error) {
      setPosts(prev => prev.filter(p => p.id !== postToDelete))
      setSelectedPost(null)
      setPostToDelete(null)
    } else {
      alert("Erro ao excluir post: " + error.message)
    }
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        // 1. Get current logged user
        const { data: { user } } = await supabase.auth.getUser()
        setCurrentUserId(user?.id || null)

        // 2. Fetch profile by username
        const { data: profileData, error: profileError } = await supabase
          .from('social_profiles')
          .select('*')
          .eq('username', username)
          .single()

        if (profileError || !profileData) {
          setProfile(null)
          return
        }

        setProfile(profileData)
        setEditBio(profileData.bio || '')

        // 3. Fetch posts for this user
        const { data: postsData, error: postsError } = await supabase
          .from('social_posts')
          .select('*, social_post_media(media_url, media_type), social_post_likes(user_id), social_comments(*)')
          .eq('user_id', profileData.user_id)
          .order('created_at', { ascending: false })

        if (!postsError && postsData) {
          const userIds = new Set<string>()
          postsData.forEach(p => {
            userIds.add(p.user_id)
            if (p.social_comments) {
              p.social_comments.forEach((c: any) => userIds.add(c.user_id))
            }
            if (p.social_post_likes) {
              p.social_post_likes.forEach((l: any) => userIds.add(l.user_id))
            }
          })
          
          const { data: profilesData } = await supabase
            .from('social_profiles')
            .select('user_id, display_name, avatar_url, username')
            .in('user_id', Array.from(userIds))
            
          const profileMap = (profilesData || []).reduce((acc: any, prof) => {
            acc[prof.user_id] = prof
            return acc
          }, {})
          
          const stitchedPosts = postsData.map(post => {
            const comments = post.social_comments || []
            const likes = post.social_post_likes || []
            
            return {
              ...post,
              social_profiles: profileMap[post.user_id] || null,
              comments_count: comments.length,
              likes_count: likes.length,
              stitched_likes: likes.map((l: any) => ({
                ...l,
                social_profiles: profileMap[l.user_id] || null
              })),
              stitched_comments: comments.map((c: any) => ({
                ...c,
                social_profiles: profileMap[c.user_id] || null
              })).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            }
          })
          
          setPosts(stitchedPosts)
        }

        // 4. Fetch total profiles count (to simulate everyone follows everyone)
        const { count } = await supabase
          .from('social_profiles')
          .select('*', { count: 'exact', head: true })
        
        if (count !== null) {
          setTotalUsers(count)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [username])

  if (loading) {
    return <div className="flex justify-center items-center h-64">Carregando...</div>
  }

  const handleSaveProfile = async () => {
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('social_profiles')
        .update({ bio: editBio })
        .eq('user_id', currentUserId)
      
      if (!error) {
        setProfile({ ...profile, bio: editBio })
        setIsEditing(false)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  if (!profile) {
    return (
      <div className="flex flex-col justify-center items-center h-96 gap-4">
        <h2 className="text-2xl font-bold">Usuário não encontrado</h2>
        <p className="text-gray-500">O perfil que você está procurando não existe ou ainda não foi configurado.</p>
      </div>
    )
  }

  const isOwnProfile = currentUserId === profile.user_id



  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto py-8 px-4 md:px-8 text-[#000] dark:text-white">
      
      {/* Profile Header (Instagram Desktop Layout) */}
      <header className="flex flex-col md:flex-row gap-6 md:gap-16 items-start mb-12">
        
        {/* Avatar Left */}
        <div className="shrink-0 mx-auto md:mx-0 md:ml-12 md:mr-4">
          <div className="w-32 h-32 md:w-[150px] md:h-[150px] rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 p-[3px]">
            <div className="w-full h-full rounded-full bg-white dark:bg-[#0a0a0c] border-4 border-transparent overflow-hidden">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-4xl font-bold">
                  {profile.username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Profile Info Right */}
        <div className="flex flex-col gap-4 flex-1 w-full max-w-[450px]">
          
          {/* Row 1: Username & Settings */}
          <div className="flex items-center gap-4">
            <h2 className="text-xl md:text-[22px] font-semibold tracking-tight">{profile.username}</h2>
            {profile.is_verified && <BadgeCheck size={18} className="text-blue-500" fill="currentColor" />}
            {isOwnProfile && (
              <button className="p-1.5 hover:opacity-70 transition-opacity">
                <Settings size={22} />
              </button>
            )}
          </div>

          {/* Row 2: Name */}
          <div className="flex flex-col">
            <span className="font-semibold text-[15px]">{profile.display_name || profile.username}</span>
          </div>
          
          {/* Row 3: Stats */}
          <div className="flex items-center gap-6 md:gap-10 mt-1">
            <span className="text-[15px]"><strong className="font-semibold">{posts.length}</strong> posts</span>
            <button className="text-[15px] hover:opacity-70"><strong className="font-semibold">{Math.max(0, totalUsers - 1)}</strong> seguidores</button>
            <button className="text-[15px] hover:opacity-70"><strong className="font-semibold">{Math.max(0, totalUsers - 1)}</strong> seguindo</button>
          </div>
          
          {/* Row 4: Bio */}
          <div className="flex flex-col mt-2">
            {isEditing ? (
              <div className="flex flex-col gap-2">
                <textarea 
                  className="w-full p-2 text-sm bg-transparent border border-gray-300 dark:border-gray-700 rounded-md resize-none"
                  rows={4}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Escreva sua bio..."
                />
                <div className="flex gap-2">
                  <button onClick={handleSaveProfile} disabled={isSaving} className="px-3 py-1 bg-blue-500 text-white text-xs rounded-md font-semibold">
                    {isSaving ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button onClick={() => setIsEditing(false)} className="px-3 py-1 bg-gray-200 dark:bg-gray-800 text-xs rounded-md font-semibold">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <span className="text-[15px] whitespace-pre-line leading-snug">
                {profile.bio || (isOwnProfile ? "Nenhuma biografia. Clique em Editar perfil para adicionar." : "")}
              </span>
            )}
            {profile.website && !isEditing && (
              <a href={profile.website} target="_blank" rel="noreferrer" className="text-[#00376b] dark:text-[#e0f1ff] font-semibold text-sm mt-1 hover:underline">
                {profile.website}
              </a>
            )}
          </div>

          {/* Row 5: Action Buttons */}
          <div className="flex items-center gap-2 mt-4">
            {isOwnProfile ? (
              <>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="flex-1 px-4 py-1.5 bg-[#efefef] hover:bg-[#dbdbdb] dark:bg-[#363636] dark:hover:bg-[#262626] text-black dark:text-white rounded-lg font-semibold text-sm transition-colors"
                >
                  Editar perfil
                </button>
                <button className="flex-1 px-4 py-1.5 bg-[#efefef] hover:bg-[#dbdbdb] dark:bg-[#363636] dark:hover:bg-[#262626] text-black dark:text-white rounded-lg font-semibold text-sm transition-colors">
                  Ver Itens Arquivados
                </button>
              </>
            ) : (
              <>
                <button className="flex-1 px-6 py-1.5 bg-[#0095f6] hover:bg-[#1877f2] text-white rounded-lg font-semibold text-sm transition-colors">
                  Seguir
                </button>
                <button className="flex-1 px-4 py-1.5 bg-[#efefef] hover:bg-[#dbdbdb] dark:bg-[#363636] dark:hover:bg-[#262626] text-black dark:text-white rounded-lg font-semibold text-sm transition-colors">
                  Mensagem
                </button>
              </>
            )}
          </div>
        </div>
      </header>


      {/* Profile Tabs */}
      <div className="flex items-center justify-center gap-12 border-t border-black/10 dark:border-white/10 mt-8">
        <button 
          onClick={() => setActiveTab('posts')}
          className={`flex items-center gap-2 py-4 border-t-[1px] transition-colors -mt-[1px] ${activeTab === 'posts' ? 'border-gray-900 dark:border-white font-semibold text-black dark:text-white' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'}`}
        >
          <Grid size={12} /> <span className="text-xs uppercase tracking-widest hidden md:block">Posts</span>
        </button>
        <button 
          onClick={() => setActiveTab('reels')}
          className={`flex items-center gap-2 py-4 border-t-[1px] transition-colors -mt-[1px] ${activeTab === 'reels' ? 'border-gray-900 dark:border-white font-semibold text-black dark:text-white' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'}`}
        >
          <Film size={12} /> <span className="text-xs uppercase tracking-widest hidden md:block">Reels</span>
        </button>
        {isOwnProfile && (
          <button 
            onClick={() => setActiveTab('saved')}
            className={`flex items-center gap-2 py-4 border-t-[1px] transition-colors -mt-[1px] ${activeTab === 'saved' ? 'border-gray-900 dark:border-white font-semibold text-black dark:text-white' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'}`}
          >
            <Bookmark size={12} /> <span className="text-xs uppercase tracking-widest hidden md:block">Salvos</span>
          </button>
        )}
        <button 
          onClick={() => setActiveTab('tagged')}
          className={`flex items-center gap-2 py-4 border-t-[1px] transition-colors -mt-[1px] ${activeTab === 'tagged' ? 'border-gray-900 dark:border-white font-semibold text-black dark:text-white' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'}`}
        >
          <UserCheck size={12} /> <span className="text-xs uppercase tracking-widest hidden md:block">Marcados</span>
        </button>
      </div>

      {/* Grid Content */}
      {posts.length > 0 ? (
        <div className="grid grid-cols-3 gap-1 md:gap-[4px]">
          {posts.map((post) => {
            const firstMedia = post.social_post_media?.[0]
            const isVideo = firstMedia?.media_type === 'video'
            const hasMultiple = post.social_post_media?.length > 1

            return (
              <div key={post.id} onClick={() => setSelectedPost(post)} className="aspect-square bg-gray-200 dark:bg-[#262626] relative group cursor-pointer overflow-hidden">
                {firstMedia ? (
                  isVideo ? (
                    <video src={firstMedia.media_url} className="w-full h-full object-cover" />
                  ) : (
                    <img src={firstMedia.media_url} alt="Post" className="w-full h-full object-cover" />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100 dark:bg-gray-800">Sem imagem</div>
                )}
                
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6 text-white font-bold">
                  <span className="flex items-center gap-2"><Heart size={20} fill="currentColor" /> {post.likes_count}</span>
                  <span className="flex items-center gap-2"><MessageCircle size={20} fill="currentColor" /> {post.comments_count}</span>
                </div>
                
                {/* Top right icon */}
                <div className="absolute top-2 right-2 text-white drop-shadow-md">
                  {isVideo ? <Film size={18} fill="currentColor" /> : (hasMultiple ? <ImageIcon size={18} fill="currentColor" /> : null)}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
          <div className="w-16 h-16 rounded-full border-2 border-current flex items-center justify-center">
            <Grid size={32} />
          </div>
          <h2 className="text-2xl font-bold">Ainda não há publicações</h2>
        </div>
      )}
      
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={(e) => { if(e.target === e.currentTarget) setSelectedPost(null) }}>
          <div className="bg-white dark:bg-[#262626] rounded-xl max-w-4xl w-full max-h-[90vh] min-h-[500px] overflow-hidden flex flex-col md:flex-row relative">
            <button onClick={() => setSelectedPost(null)} className="absolute top-4 right-4 z-10 text-white bg-black/50 rounded-full p-2 hover:bg-black">
              <X size={20} />
            </button>

            {isOwnProfile && (
              <button onClick={() => handleDeletePost(selectedPost.id)} className="absolute top-4 left-4 z-10 text-red-500 bg-white/80 dark:bg-black/50 rounded-full p-2 hover:bg-white dark:hover:bg-black transition-colors shadow-sm" title="Excluir postagem">
                <Trash2 size={20} />
              </button>
            )}
            
            {/* Lado da Mídia */}
            <div className="flex-1 bg-black flex items-center justify-center min-h-[300px] md:min-h-[500px]">
              {selectedPost.social_post_media?.[0] ? (
                selectedPost.social_post_media[0].media_type === 'video' ? (
                   <video src={selectedPost.social_post_media[0].media_url} controls className="w-full h-full object-contain" />
                ) : (
                   <img src={selectedPost.social_post_media[0].media_url} className="w-full h-full object-contain" />
                )
              ) : (
                <div className="text-white text-lg">Postagem em texto</div>
              )}
            </div>
            
            {/* Lado dos Detalhes */}
            <div className="w-full md:w-[350px] flex flex-col border-l border-black/10 dark:border-white/10 bg-white dark:bg-[#262626]">
              <div className="p-4 border-b border-black/10 dark:border-white/10 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                   <img src={profile.avatar_url || ''} className="w-8 h-8 rounded-full object-cover bg-gray-200" />
                   <div className="flex flex-col">
                     <span className="font-bold text-sm text-black dark:text-white">{profile.display_name || profile.username}</span>
                     <span className="text-[12px] text-gray-500">
                        {formatPostTime(selectedPost.created_at)}
                        {selectedPost.location && <span className="ml-1 text-blue-500 font-semibold">• {selectedPost.location}</span>}
                     </span>
                   </div>
                </div>
                {selectedPost.caption && (
                  <div className="text-sm text-black dark:text-white whitespace-pre-wrap">
                    {selectedPost.caption}
                  </div>
                )}
              </div>
              
              <div className="p-4 flex-1 overflow-y-auto hide-scrollbar">

                {/* Comentários */}
                {selectedPost.stitched_comments && selectedPost.stitched_comments.length > 0 && (
                  <div className="flex flex-col gap-4 mb-4 border-b border-black/10 dark:border-white/10 pb-4">
                    <h3 className="font-bold text-sm text-gray-500">Comentários</h3>
                    {selectedPost.stitched_comments.map((comment: any) => (
                      <div key={comment.id} className="flex gap-3">
                        <img src={comment.social_profiles?.avatar_url || ''} className="w-8 h-8 rounded-full object-cover bg-gray-200 shrink-0" />
                        <div className="text-sm text-black dark:text-white flex flex-col">
                          <span className="font-bold">{comment.social_profiles?.display_name || 'Usuário'}</span>
                          <span>{comment.content}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Curtidas */}
                {selectedPost.stitched_likes && selectedPost.stitched_likes.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <h3 className="font-bold text-sm text-gray-500">Curtidas ({selectedPost.stitched_likes.length})</h3>
                    {selectedPost.stitched_likes.map((like: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-3">
                        <img src={like.social_profiles?.avatar_url || ''} className="w-8 h-8 rounded-full object-cover bg-gray-200 shrink-0" />
                        <span className="text-sm font-bold text-black dark:text-white">{like.social_profiles?.display_name || 'Usuário'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {postToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#262626] rounded-xl p-6 max-w-sm w-full text-center shadow-xl animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2 text-black dark:text-white">Excluir Postagem</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
              Tem certeza que deseja excluir esta postagem? Ela será removida para todos os usuários e não poderá ser recuperada.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setPostToDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-lg font-bold border border-black/10 dark:border-white/10 text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 rounded-lg font-bold bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
