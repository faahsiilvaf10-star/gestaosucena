import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Heart, MessageCircle, Send, Bookmark, MoreVertical, Music, X, Loader2, User, Film } from 'lucide-react'

export const Route = createFileRoute('/instacena/reels')({
  component: ReelsRoute,
})

function ReelsRoute() {
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  // Commenting State
  const [commentingPost, setCommentingPost] = useState<any>(null)
  const [newComment, setNewComment] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)

      const { data: postsData, error: postsError } = await supabase
        .from('social_posts')
        .select('*, social_post_media!inner(media_url, media_type), social_post_likes(user_id), social_comments(*)')
        .eq('social_post_media.media_type', 'video')

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
              isLikedByMe: likes.some((l: any) => l.user_id === user?.id),
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
          
          // Randomize sequence
          setPosts(stitchedPosts.sort(() => Math.random() - 0.5))
      }
      setLoading(false)
    }

    loadData()
  }, [])

  const handleLike = async (post: any) => {
    if (!currentUserId) return;
    
    const isCurrentlyLiked = post.isLikedByMe;
    
    // Optimistic update
    setPosts(prev => prev.map(p => {
      if (p.id === post.id) {
        return {
          ...p,
          isLikedByMe: !isCurrentlyLiked,
          likes_count: isCurrentlyLiked ? p.likes_count - 1 : p.likes_count + 1
        }
      }
      return p;
    }))

    if (isCurrentlyLiked) {
      await supabase.from('social_post_likes').delete().match({ post_id: post.id, user_id: currentUserId });
    } else {
      await supabase.from('social_post_likes').insert({ post_id: post.id, user_id: currentUserId });
    }
  }

  const handleDownload = (videoUrl: string, postId: string) => {
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `reel_${postId}.mp4`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !commentingPost || !currentUserId || isSubmittingComment) return;
    
    setIsSubmittingComment(true);
    
    const commentData = {
      post_id: commentingPost.id,
      user_id: currentUserId,
      content: newComment.trim()
    };
    
    const { data, error } = await supabase.from('social_comments').insert(commentData).select().single();
    
    if (!error && data) {
       const { data: profile } = await supabase.from('social_profiles').select('*').eq('user_id', currentUserId).single();
       const stitchedComment = {
         ...data,
         social_profiles: profile
       }
       
       setPosts(prev => prev.map(p => {
         if (p.id === commentingPost.id) {
           return {
             ...p,
             comments_count: p.comments_count + 1,
             stitched_comments: [...p.stitched_comments, stitchedComment]
           }
         }
         return p;
       }))
       
       setCommentingPost((prev: any) => ({
         ...prev,
         comments_count: prev.comments_count + 1,
         stitched_comments: [...prev.stitched_comments, stitchedComment]
       }))
       
       setNewComment('');
    }
    
    setIsSubmittingComment(false);
  }

  return (
    <div className="h-full w-full max-w-[450px] mx-auto bg-black flex flex-col overflow-y-auto snap-y snap-mandatory hide-scrollbar relative">
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-white">Carregando reels...</div>
      ) : posts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white/50">
          <Film size={48} className="mb-4" />
          <p>Nenhum vídeo encontrado.</p>
        </div>
      ) : (
        posts.map((post) => (
          <div key={post.id} className="h-full w-full shrink-0 snap-start relative flex items-center justify-center border-b border-white/20">
            
            {/* Video Area */}
            <div className="absolute inset-0 z-0 bg-black">
               <video 
                  src={post.social_post_media[0].media_url} 
                  className="w-full h-full object-cover" 
                  autoPlay 
                  muted 
                  loop 
                  playsInline 
               />
            </div>

            {/* Right Action Bar */}
            <div className="absolute right-4 bottom-24 z-10 flex flex-col items-center gap-6">
              <button onClick={() => handleLike(post)} className="flex flex-col items-center gap-1 group">
                <div className="p-3 bg-black/20 rounded-full group-hover:bg-black/40 transition-colors backdrop-blur-sm">
                  <Heart size={28} className={post.isLikedByMe ? "fill-red-500 text-red-500" : "text-white"} />
                </div>
                <span className="text-white text-xs font-bold shadow-black drop-shadow-md">{post.likes_count}</span>
              </button>
              
              <button onClick={() => setCommentingPost(post)} className="flex flex-col items-center gap-1 group">
                <div className="p-3 bg-black/20 rounded-full group-hover:bg-black/40 transition-colors backdrop-blur-sm">
                  <MessageCircle size={28} className="text-white" />
                </div>
                <span className="text-white text-xs font-bold shadow-black drop-shadow-md">{post.comments_count}</span>
              </button>
              
              <button onClick={() => handleDownload(post.social_post_media[0].media_url, post.id)} className="flex flex-col items-center gap-1 group" title="Baixar vídeo">
                <div className="p-3 bg-black/20 rounded-full group-hover:bg-black/40 transition-colors backdrop-blur-sm">
                  <Send size={28} className="text-white" />
                </div>
              </button>
              
              <button className="flex flex-col items-center gap-1 group">
                <div className="p-3 bg-black/20 rounded-full group-hover:bg-black/40 transition-colors backdrop-blur-sm">
                  <Bookmark size={28} className="text-white" />
                </div>
              </button>
              
              <button className="p-2">
                <MoreVertical size={24} className="text-white" />
              </button>
              
              {/* Audio Track Icon */}
              <div className="w-10 h-10 rounded-md border-2 border-white overflow-hidden animate-[spin_4s_linear_infinite]">
                 {post.social_profiles?.avatar_url ? (
                   <img src={post.social_profiles.avatar_url} alt="Audio" className="w-full h-full object-cover" />
                 ) : (
                   <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                     <Music size={16} className="text-white" />
                   </div>
                 )}
              </div>
            </div>

            {/* Bottom Info Area */}
            <div className="absolute bottom-0 left-0 right-16 p-4 z-10 flex flex-col gap-3 pb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-white/50 bg-gray-800 shrink-0">
                   {post.social_profiles?.avatar_url ? (
                     <img src={post.social_profiles.avatar_url} alt="User" className="w-full h-full object-cover" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center text-white">
                       <User size={20} />
                     </div>
                   )}
                </div>
                <span className="text-white font-bold text-[15px] drop-shadow-md">
                  {post.social_profiles?.display_name || post.social_profiles?.username || 'Usuário'}
                </span>
                <button className="px-3 py-1 bg-transparent border border-white text-white rounded-lg text-xs font-bold ml-2">Seguir</button>
              </div>
              
              {post.caption && (
                <p className="text-white text-sm drop-shadow-md line-clamp-2">
                  {post.caption}
                </p>
              )}
              
              <div className="flex items-center gap-2 text-white/90">
                <Music size={14} />
                <span className="text-xs marquee drop-shadow-md">Áudio original - {post.social_profiles?.username || 'desconhecido'}</span>
              </div>
            </div>
          </div>
        ))
      )}
      
      {/* Comments Modal Bottom Sheet */}
      {commentingPost && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end">
           <div className="absolute inset-0 bg-black/50" onClick={() => setCommentingPost(null)} />
           <div className="bg-white dark:bg-[#262626] w-full h-[60%] rounded-t-2xl flex flex-col z-10 relative animate-in slide-in-from-bottom-full duration-300">
              <div className="p-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                 <h3 className="font-bold text-center flex-1">Comentários ({commentingPost.comments_count})</h3>
                 <button onClick={() => setCommentingPost(null)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 absolute right-2 top-2">
                   <X size={20} />
                 </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                 {commentingPost.stitched_comments.length === 0 ? (
                    <div className="text-center text-gray-500 py-10">Nenhum comentário ainda.</div>
                 ) : (
                    commentingPost.stitched_comments.map((comment: any) => (
                      <div key={comment.id} className="flex gap-3">
                        <img src={comment.social_profiles?.avatar_url || ''} className="w-8 h-8 rounded-full object-cover bg-gray-200 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[13px] text-gray-500 font-bold">{comment.social_profiles?.display_name || 'Usuário'}</span>
                          <span className="text-[14px]">{comment.content}</span>
                        </div>
                      </div>
                    ))
                 )}
              </div>
              
              <form onSubmit={handleSubmitComment} className="p-4 border-t border-black/10 dark:border-white/10 flex items-center gap-3 bg-white dark:bg-[#262626]">
                 <input 
                   type="text" 
                   value={newComment}
                   onChange={(e) => setNewComment(e.target.value)}
                   placeholder="Adicione um comentário..." 
                   className="flex-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                 />
                 <button 
                   type="submit" 
                   disabled={isSubmittingComment || !newComment.trim()}
                   className="text-blue-500 font-bold disabled:opacity-50 p-2"
                 >
                   {isSubmittingComment ? <Loader2 size={20} className="animate-spin" /> : 'Publicar'}
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  )
}
