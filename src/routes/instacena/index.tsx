import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Heart, MessageCircle, Send, Bookmark, Camera, Image as ImageIcon, Smile, Plus, User, Loader2, X, Check, ZoomIn, ZoomOut } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Cropper from 'react-easy-crop'
import { Area, Point } from 'react-easy-crop/types'
import { getCroppedImg } from '../../lib/cropImage'
import { StoryViewer } from '../../components/instacena/StoryViewer'

export const Route = createFileRoute('/instacena/')({
  component: FeedRoute,
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

function FeedRoute() {
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [stories, setStories] = useState<any[]>([]) // Now an array of UserGroups
  const [storyViewerIndex, setStoryViewerIndex] = useState<number | null>(null)
  const storyFileInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingStory, setIsUploadingStory] = useState(false)
  
  const [posts, setPosts] = useState<any[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)

  // Inline Post Editor State
  const [caption, setCaption] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Cropper State
  const [isCropping, setIsCropping] = useState(false)
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})

  const loadPosts = async (userProfile = currentUser) => {
    setLoadingPosts(true)
    const { data: postsData, error: postsError } = await supabase
      .from('social_posts')
      .select('*, social_post_media(media_url, media_type), social_post_likes(user_id), social_comments(*)')
      .order('created_at', { ascending: false })
      
    if (postsError) {
      console.error('Error fetching posts:', postsError)
    }
    
    if (postsData && postsData.length > 0) {
      const userIds = new Set<string>()
      postsData.forEach(p => {
        userIds.add(p.user_id)
        if (p.social_comments) {
          p.social_comments.forEach((c: any) => userIds.add(c.user_id))
        }
      })
      
      const { data: profilesData } = await supabase
        .from('social_profiles')
        .select('user_id, display_name, avatar_url, username')
        .in('user_id', Array.from(userIds))
        
      const profileMap = (profilesData || []).reduce((acc: any, profile) => {
        acc[profile.user_id] = profile
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
          isLikedByMe: userProfile ? likes.some((l: any) => l.user_id === userProfile.user_id) : false,
          stitched_comments: comments.map((c: any) => ({
            ...c,
            social_profiles: profileMap[c.user_id] || null
          })).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        }
      })
      
      setPosts(stitchedPosts)
    } else {
      setPosts([])
    }
    setLoadingPosts(false)
  }

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      let userProfile = null
      if (user) {
        const { data: profile } = await supabase
          .from('social_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single()
        userProfile = profile
        setCurrentUser(profile)
      }

      // Fetch Stories
      const { data: storiesData } = await supabase
        .from('social_stories')
        .select('*')
        .gt('expires_at', new Date().toISOString()) // Only active stories
        .order('created_at', { ascending: false })
      
      if (storiesData && storiesData.length > 0) {
        const storyUserIds = [...new Set(storiesData.map(s => s.user_id))]
        const { data: storyProfiles } = await supabase
          .from('social_profiles')
          .select('user_id, display_name, avatar_url, username')
          .in('user_id', storyUserIds)
          
        const storyProfileMap = (storyProfiles || []).reduce((acc: any, profile) => {
          acc[profile.user_id] = profile
          return acc
        }, {})
        
        // Group by user
        const grouped = storyUserIds.map(uid => ({
          user: storyProfileMap[uid],
          stories: storiesData.filter(s => s.user_id === uid).sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) // oldest first
        }))
        
        setStories(grouped)
      } else {
        setStories([])
      }
      
      loadPosts(userProfile)
    }
    loadData()
  }, [])

  const handleLike = async (postId: string, isLiked: boolean) => {
    if (!currentUser) return;
    
    // Atualização Otimista
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          isLikedByMe: !isLiked,
          likes_count: p.likes_count + (isLiked ? -1 : 1)
        }
      }
      return p
    }))

    if (isLiked) {
      await supabase.from('social_post_likes').delete().eq('post_id', postId).eq('user_id', currentUser.user_id)
    } else {
      await supabase.from('social_post_likes').insert({ post_id: postId, user_id: currentUser.user_id })
    }
  }

  const handleCommentSubmit = async (postId: string) => {
    const text = commentInputs[postId]
    if (!text?.trim() || !currentUser) return;

    const tempComment = {
      id: 'temp-' + Date.now(),
      post_id: postId,
      user_id: currentUser.user_id,
      content: text.trim(),
      created_at: new Date().toISOString(),
      social_profiles: currentUser
    }

    // Atualização Otimista
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          comments_count: p.comments_count + 1,
          stitched_comments: [...(p.stitched_comments || []), tempComment]
        }
      }
      return p
    }))
    
    setCommentInputs(prev => ({ ...prev, [postId]: '' }))

    await supabase.from('social_comments').insert({
      post_id: postId,
      user_id: currentUser.user_id,
      content: text.trim()
    })
  }

  const firstName = currentUser?.display_name?.split(' ')[0] || 'Visitante'
  const isEditing = caption.trim().length > 0 || previewUrl !== null

  // File Handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setSelectedFile(file)
      const objUrl = URL.createObjectURL(file)
      setPreviewUrl(objUrl)

      // Se for imagem, abre o modo de corte (crop)
      if (file.type.startsWith('image/')) {
        setIsCropping(true)
      }
    }
    // reset input value so selecting the same file works again
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveMedia = () => {
    setSelectedFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setIsCropping(false)
  }

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleConfirmCrop = async () => {
    if (previewUrl && croppedAreaPixels) {
      try {
        const croppedImageBlob = await getCroppedImg(previewUrl, croppedAreaPixels)
        const croppedUrl = URL.createObjectURL(croppedImageBlob)
        
        // Substitui o arquivo selecionado pelo arquivo cortado
        const croppedFile = new File([croppedImageBlob], selectedFile?.name || 'cropped.jpg', { type: 'image/jpeg' })
        setSelectedFile(croppedFile)
        
        // Atualiza o preview e sai do modo de corte
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(croppedUrl)
        setIsCropping(false)
      } catch (e) {
        console.error('Error cropping image', e)
      }
    }
  }

  // Publish Post
  const handleStoryFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && currentUser) {
      const file = e.target.files[0]
      setIsUploadingStory(true)

      // Se for vídeo, checamos duração localmente criando um elemento de vídeo rápido
      if (file.type.startsWith('video/')) {
        const video = document.createElement('video')
        video.preload = 'metadata'
        video.onloadedmetadata = async () => {
          window.URL.revokeObjectURL(video.src)
          if (video.duration > 30) {
             alert('O vídeo selecionado tem mais de 30 segundos. Ele será exibido cortado após 30s.')
          }
          await uploadStory(file)
        }
        video.src = URL.createObjectURL(file)
      } else {
        await uploadStory(file)
      }
    }
  }

  const uploadStory = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `story-${currentUser.user_id}-${Date.now()}.${fileExt}`
      
      const { data, error } = await supabase.storage
        .from('instacena-posts')
        .upload(fileName, file)
        
      if (error) throw error

      const { data: urlData } = supabase.storage
        .from('instacena-posts')
        .getPublicUrl(fileName)

      const mediaType = file.type.startsWith('video/') ? 'video' : 'image'

      const { data: newStory, error: insertError } = await supabase
        .from('social_stories')
        .insert({
          user_id: currentUser.user_id,
          media_url: urlData.publicUrl,
          media_type: mediaType,
        })
        .select()
        .single()
        
      if (insertError) throw insertError
      
      // Refresh
      window.location.reload()
      
    } catch (err) {
      console.error('Erro ao postar story', err)
      alert('Ocorreu um erro ao postar seu story.')
    } finally {
      setIsUploadingStory(false)
      if (storyFileInputRef.current) storyFileInputRef.current.value = ''
    }
  }

  const handlePublish = async () => {
    if (!currentUser) return
    if (!caption.trim() && !selectedFile) return
    
    setIsSubmitting(true)
    try {
      const envName = (typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') : null) === 'paragominas' ? 'PARAGOMINAS' : 'BARCARENA'
      
      const { data: post, error: postError } = await supabase
        .from('social_posts')
        .insert({
          user_id: currentUser.user_id,
          caption: caption,
          post_type: 'post',
          location: envName
        })
        .select()
        .single()

      if (postError) throw postError

      if (selectedFile && post) {
        const fileExt = selectedFile.name.split('.').pop()
        const fileName = `${post.id}-${Math.random()}.${fileExt}`
        const filePath = `posts/${fileName}`
        
        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(filePath, selectedFile)
          
        if (uploadError) {
          console.error('Upload error', uploadError)
          throw new Error('Falha no upload da foto: ' + uploadError.message)
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('posts')
            .getPublicUrl(filePath)
            
          const isVideo = selectedFile.type.startsWith('video/')
          const { error: mediaError } = await supabase
            .from('social_post_media')
            .insert({
              post_id: post.id,
              media_url: publicUrl,
              media_type: isVideo ? 'video' : 'image'
            })
            
          if (mediaError) {
            console.error('Media insert error', mediaError)
            throw new Error('Falha ao salvar a imagem na postagem.')
          }
        }
      }

      // Reset state and reload
      setCaption('')
      handleRemoveMedia()
      await loadPosts()
      
    } catch (err: any) {
      console.error(err)
      alert("Erro ao publicar: " + (err.message || "Verifique se o bucket 'posts' existe."))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 py-6 px-4 max-w-[600px] mx-auto w-full">
      
      {/* Inline Create Post Box */}
      <div className="w-full bg-white dark:bg-[#1a1a1b] border border-black/5 dark:border-white/5 rounded-xl p-4 shadow-sm flex flex-col gap-3 transition-all duration-300">
        
        {/* User Info (Visible when editing) */}
        {isEditing && (
          <div className="flex items-center gap-2 mb-2 animate-in fade-in duration-300">
            <span className="font-semibold text-sm">{currentUser?.display_name}</span>
            <div className="bg-gray-100 dark:bg-white/10 text-[10px] font-semibold px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400">
              Público
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden shrink-0 border border-black/5 dark:border-white/10">
            {currentUser?.avatar_url ? (
              <img src={currentUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <User size={20} />
              </div>
            )}
          </div>
          <div className="flex-1">
            <textarea
              placeholder={`No que você está pensando, ${firstName}?`}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className={`w-full bg-transparent outline-none resize-none transition-all duration-300 ${isEditing ? 'min-h-[80px] text-[15px]' : 'min-h-[40px] text-[15px] pt-2'} placeholder:text-gray-500`}
            />
          </div>
        </div>

        {/* Media Preview & Cropper */}
        {previewUrl && !isCropping && (
          <div className="relative w-full rounded-lg border border-black/10 dark:border-white/10 overflow-hidden mt-2 animate-in fade-in zoom-in-95">
            <button 
              onClick={handleRemoveMedia}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10"
            >
              <X size={16} />
            </button>
            {selectedFile?.type.startsWith('video/') ? (
              <video src={previewUrl} controls className="w-full max-h-[400px] object-contain bg-black" />
            ) : (
              <img src={previewUrl} alt="Preview" className="w-full max-h-[400px] object-contain bg-gray-100 dark:bg-gray-900 mx-auto" />
            )}
          </div>
        )}

        {isCropping && previewUrl && (
          <div className="w-full h-[400px] mt-2 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 relative bg-black animate-in fade-in zoom-in-95">
            <Cropper
              image={previewUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              showGrid={true}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
            
            {/* Cropper Controls Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/60 backdrop-blur-sm flex flex-col gap-3">
               <div className="flex items-center gap-3 text-white">
                 <ZoomOut size={18} />
                 <input
                   type="range"
                   value={zoom}
                   min={1}
                   max={3}
                   step={0.1}
                   onChange={(e) => setZoom(Number(e.target.value))}
                   className="w-full accent-[#0866ff]"
                 />
                 <ZoomIn size={18} />
               </div>
               <div className="flex justify-between">
                 <button onClick={handleRemoveMedia} className="text-white hover:bg-white/20 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                   Cancelar
                 </button>
                 <button onClick={handleConfirmCrop} className="bg-[#0866ff] hover:bg-[#0756d6] text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors">
                   <Check size={16} /> Confirmar
                 </button>
               </div>
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-3 mt-1">
          <div className="flex items-center gap-1 w-full">
            <button onClick={() => fileInputRef.current?.click()} className="flex flex-1 items-center justify-center gap-2 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 py-2 rounded-lg transition-colors">
              <ImageIcon className="text-green-500" size={20} />
              <span className="hidden sm:inline">Foto/vídeo</span>
            </button>
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*,video/*" 
            onChange={handleFileSelect} 
          />
        </div>

        {/* Publish Button (Only visible if editing) */}
        {isEditing && (
          <div className="pt-2 animate-in slide-in-from-top-2 fade-in duration-300">
            <button
              onClick={handlePublish}
              disabled={isSubmitting || isCropping}
              className="w-full bg-[#0866ff] hover:bg-[#0756d6] disabled:opacity-50 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Publicar'}
            </button>
          </div>
        )}
      </div>

      {/* Stories Carousel (Facebook Style) */}
      <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar snap-x">
        {/* Input Oculto de Story */}
        <input 
          type="file" 
          ref={storyFileInputRef} 
          className="hidden" 
          accept="image/*,video/*" 
          onChange={handleStoryFileSelect} 
        />

        {/* Criar Story Card (Always First) */}
        <div 
          onClick={() => { if(!isUploadingStory) storyFileInputRef.current?.click() }}
          className="w-[110px] h-[190px] rounded-xl overflow-hidden shrink-0 relative bg-white dark:bg-[#1a1a1b] border border-black/5 dark:border-white/5 shadow-sm group cursor-pointer hover:opacity-90 transition-opacity snap-start flex flex-col"
        >
          <div className="w-full h-[65%] bg-gray-200 dark:bg-gray-800 overflow-hidden relative">
             {currentUser?.avatar_url ? (
                <img src={currentUser.avatar_url} alt="User" className={`w-full h-full object-cover transition-transform duration-300 ${isUploadingStory ? 'opacity-50' : 'group-hover:scale-105'}`} />
             ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <User size={30} />
                </div>
             )}
             {isUploadingStory && (
               <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                 <Loader2 size={24} className="text-white animate-spin" />
               </div>
             )}
          </div>
          <div className="w-full h-[35%] flex flex-col items-center justify-end pb-3 relative">
            <div className="absolute -top-4 w-9 h-9 bg-[#0866ff] rounded-full flex items-center justify-center border-4 border-white dark:border-[#1a1a1b]">
              <Plus color="white" size={20} />
            </div>
            <span className="text-[11px] font-semibold text-black dark:text-white mt-1">Criar story</span>
          </div>
        </div>

        {/* Dynamic Stories Grouped By User */}
        {stories.map((group, idx) => {
          const lastStory = group.stories[group.stories.length - 1]; // cover image is the latest story
          return (
            <div 
              key={group.user.user_id} 
              onClick={() => setStoryViewerIndex(idx)}
              className="w-[110px] h-[190px] rounded-xl overflow-hidden shrink-0 relative bg-gray-800 shadow-sm cursor-pointer hover:opacity-90 transition-opacity group snap-start"
            >
              <img src={lastStory.media_url} alt="Story" className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              
              <div className="absolute top-3 left-3 w-9 h-9 rounded-full overflow-hidden border-[3px] border-[#0866ff] z-10 bg-white">
                {group.user.avatar_url ? (
                   <img src={group.user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                   <div className="w-full h-full bg-blue-100 flex items-center justify-center">
                     <span className="text-blue-600 font-bold text-[10px]">{group.user.display_name?.charAt(0) || '?'}</span>
                   </div>
                )}
              </div>
              
              <span className="absolute bottom-2 left-2 right-2 text-[11px] font-semibold text-white leading-tight z-10 break-words line-clamp-2 shadow-sm">
                {group.user.display_name || group.user.username || 'Usuário'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Story Viewer Component */}
      {storyViewerIndex !== null && currentUser && (
         <StoryViewer 
           usersGroups={stories}
           initialUserIndex={storyViewerIndex}
           onClose={() => setStoryViewerIndex(null)}
           currentUserId={currentUser.user_id}
         />
      )}

      {/* Feed Area */}
      <div className="flex flex-col gap-8 mt-2">
        {loadingPosts ? (
          <div className="text-center text-gray-500 py-10">Carregando posts...</div>
        ) : posts.length === 0 ? (
          <div className="text-center text-gray-500 py-10">Nenhuma postagem encontrada. Seja o primeiro a postar!</div>
        ) : (
          posts.map(post => (
            <article key={post.id} className="flex flex-col gap-3 bg-white dark:bg-[#1a1a1b] p-4 rounded-xl border border-black/5 dark:border-white/5 shadow-sm">
              {/* Post Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 border border-black/5 dark:border-white/10 shrink-0">
                  {post.social_profiles?.avatar_url ? (
                    <img src={post.social_profiles.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <User size={20} />
                    </div>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-[15px]">{post.social_profiles?.display_name || 'Usuário'}</span>
                  <span className="text-[12px] text-gray-500">
                    {formatPostTime(post.created_at)} • 
                    <span className="capitalize ml-1">{post.visibility === 'public' ? 'Público' : post.visibility}</span>
                    {post.location && (
                      <span className="ml-1 font-semibold text-blue-500"> • {post.location}</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Post Caption */}
              {post.caption && (
                <p className="text-[15px] mt-1 whitespace-pre-wrap">{post.caption}</p>
              )}

              {/* Post Image/Video */}
              {post.social_post_media && post.social_post_media.length > 0 && (
                <div className="w-full bg-black/5 dark:bg-white/5 rounded-lg overflow-hidden flex items-center justify-center">
                  {post.social_post_media[0].media_type === 'video' ? (
                    <video src={post.social_post_media[0].media_url} controls className="w-full max-h-[600px] object-contain bg-black" />
                  ) : (
                    <img src={post.social_post_media[0].media_url} alt="Post content" className="w-full h-auto object-contain max-h-[600px]" />
                  )}
                </div>
              )}

              {/* Post Actions & Likes */}
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-gray-500">
                    <Heart size={16} className={post.isLikedByMe ? "fill-red-500 text-red-500" : "fill-gray-500 text-gray-500"} />
                    <span className="text-[14px]">{post.likes_count}</span>
                  </div>
                  <span className="text-[14px] text-gray-500 hover:underline cursor-pointer">{post.comments_count} comentários</span>
                </div>
                
                <div className="border-t border-black/10 dark:border-white/10 pt-2 flex items-center justify-between px-2">
                  <button 
                    onClick={() => handleLike(post.id, post.isLikedByMe)}
                    className={`flex flex-1 items-center justify-center gap-2 py-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors font-semibold text-sm ${post.isLikedByMe ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}>
                    <Heart size={20} className={post.isLikedByMe ? "fill-red-500" : ""} />
                    <span>Curtir</span>
                  </button>
                  <button 
                    onClick={() => {
                      const input = document.getElementById(`comment-input-${post.id}`)
                      if (input) input.focus()
                    }}
                    className="flex flex-1 items-center justify-center gap-2 py-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors text-gray-600 dark:text-gray-400 font-semibold text-sm">
                    <MessageCircle size={20} />
                    <span>Comentar</span>
                  </button>
                  <button className="flex flex-1 items-center justify-center gap-2 py-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors text-gray-600 dark:text-gray-400 font-semibold text-sm">
                    <Send size={20} />
                    <span>Compartilhar</span>
                  </button>
                </div>

                {/* Comentários Inline */}
                {post.stitched_comments && post.stitched_comments.length > 0 && (
                  <div className="mt-2 space-y-2 px-2 pb-2">
                    {post.stitched_comments.map((comment: any) => (
                      <div key={comment.id} className="flex gap-2 items-start">
                        <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-200 border border-black/5 dark:border-white/10 shrink-0 mt-0.5">
                          {comment.social_profiles?.avatar_url ? (
                            <img src={comment.social_profiles.avatar_url} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                              <User size={14} />
                            </div>
                          )}
                        </div>
                        <div className="bg-gray-100 dark:bg-white/5 rounded-2xl px-3 py-1.5 text-[14px] flex flex-col max-w-[90%]">
                          <span className="font-bold text-[13px] leading-tight">{comment.social_profiles?.display_name || 'Usuário'}</span>
                          <span className="leading-tight mt-0.5">{comment.content}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Caixa para Digitar Novo Comentário */}
                <div className="flex items-center gap-2 mt-1 px-2 border-t border-black/5 dark:border-white/5 pt-3">
                   <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 shrink-0 border border-black/5 dark:border-white/10">
                      {currentUser?.avatar_url ? (
                        <img src={currentUser.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                          <User size={16} />
                        </div>
                      )}
                   </div>
                   <div className="flex-1 flex items-center bg-gray-100 dark:bg-white/5 rounded-full px-4 py-1.5 border border-black/5 dark:border-white/5">
                     <input 
                       id={`comment-input-${post.id}`}
                       type="text" 
                       placeholder="Adicione um comentário..." 
                       className="bg-transparent border-none outline-none text-sm w-full dark:text-white"
                       value={commentInputs[post.id] || ''}
                       onChange={e => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                       onKeyDown={e => e.key === 'Enter' && handleCommentSubmit(post.id)}
                     />
                     <button 
                       onClick={() => handleCommentSubmit(post.id)}
                       disabled={!commentInputs[post.id]?.trim()}
                       className="text-blue-500 font-semibold text-sm disabled:opacity-50 ml-2 transition-opacity">
                       Publicar
                     </button>
                   </div>
                </div>

              </div>
            </article>
          ))
        )}
      </div>
    </div>
  )
}
