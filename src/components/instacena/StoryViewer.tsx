import React, { useState, useEffect, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Eye, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Story {
  id: string
  user_id: string
  media_url: string
  media_type: string
  created_at: string
}

interface UserGroup {
  user: any // social_profile
  stories: Story[]
}

interface StoryViewerProps {
  usersGroups: UserGroup[]
  initialUserIndex: number
  onClose: () => void
  currentUserId: string | null
}

const PHOTO_DURATION_MS = 15000 // 15 seconds for photos
const MAX_VIDEO_DURATION_MS = 30000 // 30 seconds for videos

export function StoryViewer({ usersGroups, initialUserIndex, onClose, currentUserId }: StoryViewerProps) {
  const [currentUserIndex, setCurrentUserIndex] = useState(initialUserIndex)
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0)
  
  const [progress, setProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressInterval = useRef<NodeJS.Timeout | null>(null)
  const startTime = useRef<number>(Date.now())
  const accumulatedTime = useRef<number>(0)

  const [viewsLog, setViewsLog] = useState<any[]>([])
  const [showViews, setShowViews] = useState(false)

  const activeGroup = usersGroups[currentUserIndex]
  const activeStory = activeGroup?.stories[currentStoryIndex]

  // Timer logic for photos and video limits
  useEffect(() => {
    if (!activeStory || showViews) return;

    if (activeStory.media_type === 'video') {
      // For videos, progress is handled by video onTimeUpdate event
      return;
    }

    if (isPaused) {
       // Stop the interval but keep accumulated time
       if (progressInterval.current) clearInterval(progressInterval.current);
       return;
    }

    // Reset timer when a new image story mounts if we weren't paused
    startTime.current = Date.now();

    progressInterval.current = setInterval(() => {
      const elapsed = Date.now() - startTime.current + accumulatedTime.current;
      const percentage = (elapsed / PHOTO_DURATION_MS) * 100;
      
      if (percentage >= 100) {
        setProgress(100);
        handleNext();
      } else {
        setProgress(percentage);
      }
    }, 50);

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    }
  }, [activeStory, isPaused, currentUserIndex, currentStoryIndex, showViews]);

  // Handle Video Time Update to enforce 30s limit
  const handleVideoTimeUpdate = () => {
    if (!videoRef.current || activeStory?.media_type !== 'video' || isPaused || showViews) return;
    
    // We base the percentage on video duration (max 30s)
    const duration = Math.min(videoRef.current.duration * 1000, MAX_VIDEO_DURATION_MS);
    const currentTime = videoRef.current.currentTime * 1000;
    
    const percentage = (currentTime / duration) * 100;
    setProgress(percentage);

    if (currentTime >= MAX_VIDEO_DURATION_MS || currentTime >= videoRef.current.duration * 1000) {
       handleNext();
    }
  }

  // Handle View Tracking
  useEffect(() => {
    async function trackView() {
      if (!activeStory || !currentUserId) return;
      if (activeStory.user_id === currentUserId) return; // Don't track own view

      // Try inserting view. Duplicate key will fail silently (handled by unique constraint in DB, though we can just do insert)
      await supabase.from('social_story_views').insert({
        story_id: activeStory.id,
        viewer_id: currentUserId
      });
    }

    trackView();
  }, [activeStory, currentUserId]);

  // Load Views if this is my story
  useEffect(() => {
    async function loadViews() {
      if (!activeStory || activeStory.user_id !== currentUserId) {
        setViewsLog([]);
        return;
      }
      
      const { data } = await supabase
        .from('social_story_views')
        .select('viewer_id, viewed_at')
        .eq('story_id', activeStory.id)
        .order('viewed_at', { ascending: false });
        
      if (data && data.length > 0) {
         // get profiles
         const viewerIds = data.map(v => v.viewer_id);
         const { data: profiles } = await supabase
           .from('social_profiles')
           .select('user_id, display_name, avatar_url, username')
           .in('user_id', viewerIds);
           
         const profileMap = (profiles || []).reduce((acc: any, p) => { acc[p.user_id] = p; return acc; }, {});
         
         const stitched = data.map(v => ({
           ...v,
           profile: profileMap[v.viewer_id]
         }));
         setViewsLog(stitched);
      } else {
         setViewsLog([]);
      }
    }
    loadViews();
  }, [activeStory, currentUserId, showViews]);


  const handleNext = () => {
    accumulatedTime.current = 0;
    setProgress(0);
    
    if (currentStoryIndex < activeGroup.stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
    } else if (currentUserIndex < usersGroups.length - 1) {
      setCurrentUserIndex(prev => prev + 1);
      setCurrentStoryIndex(0);
    } else {
      onClose(); // End of all stories
    }
  }

  const handlePrev = () => {
    accumulatedTime.current = 0;
    setProgress(0);
    
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
    } else if (currentUserIndex > 0) {
      setCurrentUserIndex(prev => prev - 1);
      setCurrentStoryIndex(usersGroups[currentUserIndex - 1].stories.length - 1);
    } else {
      // Already at the very first story, just restart it
      setProgress(0);
    }
  }

  const formatTimeAgo = (dateString: string) => {
     const diffMs = Date.now() - new Date(dateString).getTime();
     const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
     if (diffHrs < 1) {
       const diffMins = Math.floor(diffMs / (1000 * 60));
       if (diffMins < 1) return 'Agora mesmo';
       return `${diffMins} min`;
     }
     return `${diffHrs} h`;
  }

  const handleDeleteStory = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPaused(true);
    if (videoRef.current) videoRef.current.pause();

    if (window.confirm("Tem certeza que deseja excluir este story para todos?")) {
      try {
        const { error } = await supabase.from('social_stories').delete().eq('id', activeStory.id);
        if (error) throw error;
        
        window.location.reload();
      } catch (err: any) {
        alert("Erro ao excluir story: " + err.message);
        setIsPaused(false);
        if (videoRef.current) videoRef.current.play();
      }
    } else {
      setIsPaused(false);
      if (videoRef.current) videoRef.current.play();
    }
  }

  if (!activeGroup || !activeStory) return null;

  const isMyStory = activeStory.user_id === currentUserId;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center animate-in fade-in zoom-in-95 duration-200">
       <button onClick={onClose} className="absolute top-20 right-4 z-[9999] p-2 bg-black/50 hover:bg-black rounded-full text-white transition-colors">
         <X size={24} />
       </button>
       
       <div 
         className="w-full h-full max-w-[500px] relative flex flex-col bg-gray-900"
         onMouseDown={() => { setIsPaused(true); if (videoRef.current) videoRef.current.pause(); }}
         onMouseUp={() => { setIsPaused(false); if (videoRef.current) videoRef.current.play(); }}
         onTouchStart={() => { setIsPaused(true); if (videoRef.current) videoRef.current.pause(); }}
         onTouchEnd={() => { setIsPaused(false); if (videoRef.current) videoRef.current.play(); }}
       >
         {/* Progress Bars */}
         <div className="absolute top-16 left-2 right-2 z-[9000] flex gap-1">
           {activeGroup.stories.map((s, idx) => (
             <div key={s.id} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-white transition-all duration-75"
                 style={{ 
                   width: idx < currentStoryIndex ? '100%' : idx === currentStoryIndex ? `${progress}%` : '0%' 
                 }}
               />
             </div>
           ))}
         </div>

         {/* Header */}
         <div className="absolute top-20 left-4 right-4 z-[9000] flex items-center justify-between">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 border border-white/20">
               {activeGroup.user?.avatar_url ? (
                 <img src={activeGroup.user.avatar_url} className="w-full h-full object-cover" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                   {activeGroup.user?.display_name?.charAt(0) || '?'}
                 </div>
               )}
             </div>
             <div className="flex items-center gap-2 text-white drop-shadow-md">
               <span className="font-bold">{activeGroup.user?.display_name || activeGroup.user?.username || 'Usuário'}</span>
               <span className="text-sm opacity-80">• {formatTimeAgo(activeStory.created_at)}</span>
             </div>
           </div>

           {isMyStory && (
             <button 
               onClick={handleDeleteStory}
               className="p-2 bg-black/30 hover:bg-red-500/80 rounded-full text-white transition-colors mr-10"
               title="Excluir story"
             >
               <Trash2 size={20} />
             </button>
           )}
         </div>

         {/* Navigation Overlay (Click left 30% for prev, right 70% for next) */}
         <div className="absolute inset-0 z-10 flex">
            <div className="w-[30%] h-full" onClick={(e) => { e.stopPropagation(); handlePrev(); }} />
            <div className="w-[70%] h-full" onClick={(e) => { e.stopPropagation(); handleNext(); }} />
         </div>

         {/* Media */}
         <div className="flex-1 bg-black flex items-center justify-center">
            {activeStory.media_type === 'image' ? (
              <img src={activeStory.media_url} className="w-full h-full object-contain" alt="Story" />
            ) : (
              <video 
                ref={videoRef}
                src={activeStory.media_url} 
                className="w-full h-full object-contain"
                autoPlay 
                playsInline
                onTimeUpdate={handleVideoTimeUpdate}
                onEnded={handleNext}
              />
            )}
         </div>

         {/* Footer / Views count for author */}
         {isMyStory && (
           <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center">
             <button 
               onClick={(e) => { e.stopPropagation(); setShowViews(true); setIsPaused(true); if(videoRef.current) videoRef.current.pause(); }}
               className="flex flex-col items-center gap-1 text-white hover:opacity-80 transition-opacity"
             >
               <Eye size={24} />
               <span className="text-xs font-bold">{viewsLog.length} {viewsLog.length === 1 ? 'visualização' : 'visualizações'}</span>
             </button>
           </div>
         )}
         
         {/* Views Bottom Sheet */}
         {showViews && (
           <div className="absolute inset-0 z-30 flex flex-col justify-end" onClick={(e) => e.stopPropagation()}>
             <div className="absolute inset-0 bg-black/50" onClick={() => { setShowViews(false); setIsPaused(false); if(videoRef.current) videoRef.current.play(); }} />
             <div className="bg-white dark:bg-[#262626] w-full h-[60%] rounded-t-2xl flex flex-col z-40 animate-in slide-in-from-bottom-full duration-300">
               <div className="p-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                 <h3 className="font-bold flex-1">Visualizações ({viewsLog.length})</h3>
                 <button onClick={() => { setShowViews(false); setIsPaused(false); if(videoRef.current) videoRef.current.play(); }} className="p-2 bg-black/5 dark:bg-white/5 rounded-full">
                   <X size={20} />
                 </button>
               </div>
               <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                 {viewsLog.length === 0 ? (
                   <div className="text-center text-gray-500 py-10">Nenhuma visualização ainda.</div>
                 ) : (
                   viewsLog.map((log: any, idx: number) => (
                     <div key={idx} className="flex items-center gap-3">
                        <img src={log.profile?.avatar_url || ''} className="w-10 h-10 rounded-full object-cover bg-gray-200 shrink-0" />
                        <div className="flex flex-col">
                          <span className="font-bold text-[14px] text-black dark:text-white">{log.profile?.display_name || log.profile?.username}</span>
                          <span className="text-xs text-gray-500">visto há {formatTimeAgo(log.viewed_at)}</span>
                        </div>
                     </div>
                   ))
                 )}
               </div>
             </div>
           </div>
         )}
       </div>
    </div>
  )
}
