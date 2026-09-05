import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Heart, MessageCircle, X, Image as ImageIcon } from 'lucide-react'

export const Route = createFileRoute('/instacena/explorar')({
  component: ExplorarRoute,
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

function ExplorarRoute() {
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState<any>(null)

  useEffect(() => {
    async function loadData() {
      setLoading(true)

      // Fetch posts with media == image
      // We use inner join on social_post_media to only get posts that have an image
      const { data: postsData, error: postsError } = await supabase
        .from('social_posts')
        .select('*, social_post_media!inner(media_url, media_type), social_post_likes(user_id), social_comments(*)')
        .eq('social_post_media.media_type', 'image')
        .order('created_at', { ascending: false })

      if (!postsError && postsData) {
          const userIds = new Set<string>()
          postsData.forEach((p: any) => {
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
          
          const stitchedPosts = postsData.map((post: any) => {
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
      setLoading(false)
    }

    loadData()
  }, [])

  return (
    <div className="flex flex-col w-full h-full max-w-[900px] mx-auto p-4 animate-in fade-in">
      
      {loading ? (
        <div className="text-center text-gray-500 py-20">Carregando fotos...</div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-gray-500 py-20">
          <ImageIcon size={48} className="mb-4 opacity-50" />
          <h2 className="text-xl font-bold">Nenhuma foto encontrada</h2>
          <p>Ainda não há publicações com fotos de usuários.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 md:gap-2">
          {posts.map((post: any, i: number) => {
            const isLarge = false; // Set to true for a dynamic masonry look, keeping it simple grid for now
            return (
              <div 
                key={post.id} 
                onClick={() => setSelectedPost(post)}
                className={`relative bg-gray-200 dark:bg-white/5 cursor-pointer group overflow-hidden ${isLarge ? 'row-span-2' : 'aspect-square'}`}
              >
                <img 
                  src={post.social_post_media[0].media_url} 
                  alt="Post" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                />
                
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center gap-6">
                   <div className="flex items-center gap-2 text-white font-bold">
                     <Heart className="fill-white" size={20} />
                     <span>{post.likes_count}</span>
                   </div>
                   <div className="flex items-center gap-2 text-white font-bold">
                     <MessageCircle className="fill-white" size={20} />
                     <span>{post.comments_count}</span>
                   </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Post Modal */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in" onClick={(e) => { if(e.target === e.currentTarget) setSelectedPost(null) }}>
          <div className="bg-white dark:bg-[#262626] rounded-xl max-w-5xl w-full max-h-[90vh] min-h-[500px] overflow-hidden flex flex-col md:flex-row relative animate-in zoom-in-95 shadow-2xl">
            <button onClick={() => setSelectedPost(null)} className="absolute top-4 right-4 z-10 text-white bg-black/50 rounded-full p-2 hover:bg-black transition-colors">
              <X size={20} />
            </button>
            
            {/* Lado da Mídia */}
            <div className="flex-1 bg-black flex items-center justify-center min-h-[300px] md:min-h-[500px]">
               <img src={selectedPost.social_post_media[0].media_url} className="w-full h-full object-contain" />
            </div>
            
            {/* Lado dos Detalhes */}
            <div className="w-full md:w-[350px] flex flex-col border-l border-black/10 dark:border-white/10 bg-white dark:bg-[#262626]">
              <div className="p-4 border-b border-black/10 dark:border-white/10 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                   <img src={selectedPost.social_profiles?.avatar_url || ''} className="w-8 h-8 rounded-full object-cover bg-gray-200" />
                   <div className="flex flex-col">
                     <span className="font-bold text-sm text-black dark:text-white">{selectedPost.social_profiles?.display_name || selectedPost.social_profiles?.username}</span>
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
    </div>
  )
}
