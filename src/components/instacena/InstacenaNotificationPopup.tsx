import Heart from 'lucide-react/dist/esm/icons/heart.js'
import MessageCircle from 'lucide-react/dist/esm/icons/message-circle.js'
import Camera from 'lucide-react/dist/esm/icons/camera.js'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js'
import X from 'lucide-react/dist/esm/icons/x.js'
import Instagram from 'lucide-react/dist/esm/icons/instagram.js'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '../../lib/supabase'
import { useUsersPresence } from '../../hooks/useUsersPresence'
import { InstacenaActivityPayload } from '../../lib/instacenaEvents'

function playInstacenaSound() {
  try {
    const audio = new Audio('/chat-notification.mp3')
    audio.volume = 0.65
    audio.play().catch(() => {/* Browser autoplay policy */})
  } catch (_) {}
}

export interface InstacenaNotifItem {
  id: string
  type: 'like' | 'comment' | 'post' | 'story'
  actorId: string
  actorName: string
  actorAvatar?: string
  actorUsername?: string
  content?: string
  mediaUrl?: string
  targetPostId?: string
  createdAt: string
  exiting?: boolean
  isPaused?: boolean
}

interface InstacenaNotificationPopupProps {
  currentUserId: string
}

export function InstacenaNotificationPopup({ currentUserId }: InstacenaNotificationPopupProps) {
  const navigate = useNavigate()
  const { data: usersMap } = useUsersPresence()
  const [notifications, setNotifications] = useState<InstacenaNotifItem[]>([])
  const recentDedupeKeys = useRef<Map<string, number>>(new Map())
  const timersRef = useRef<Record<string, { timerId?: any; remaining: number; startedAt: number }>>({})
  const initializedRef = useRef(false)

  // Prevent spamming historical events on component mount
  useEffect(() => {
    const t = setTimeout(() => {
      initializedRef.current = true
    }, 1500)
    return () => clearTimeout(t)
  }, [])

  // Helper to remove notification with exit animation
  const dismissNotification = useCallback((notifId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notifId ? { ...n, exiting: true } : n)
    )
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notifId))
      delete timersRef.current[notifId]
    }, 300)
  }, [])

  // Start auto-dismiss timer
  const scheduleDismiss = useCallback((notifId: string, durationMs = 6500) => {
    if (timersRef.current[notifId]?.timerId) {
      clearTimeout(timersRef.current[notifId].timerId)
    }

    const timerId = setTimeout(() => {
      dismissNotification(notifId)
    }, durationMs)

    timersRef.current[notifId] = {
      timerId,
      remaining: durationMs,
      startedAt: Date.now()
    }
  }, [dismissNotification])

  // Pause dismiss on hover
  const handleMouseEnter = (notifId: string) => {
    const record = timersRef.current[notifId]
    if (record?.timerId) {
      clearTimeout(record.timerId)
      const elapsed = Date.now() - record.startedAt
      record.remaining = Math.max(1000, record.remaining - elapsed)
      record.timerId = null
    }
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isPaused: true } : n))
  }

  // Resume dismiss on mouse leave
  const handleMouseLeave = (notifId: string) => {
    const record = timersRef.current[notifId]
    if (record) {
      scheduleDismiss(notifId, record.remaining || 3000)
    }
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isPaused: false } : n))
  }

  // Incoming activity processor
  const processIncomingActivity = useCallback(async (activity: InstacenaActivityPayload) => {
    if (!activity || !activity.actorId) return
    // Never notify about own actions
    if (activity.actorId === currentUserId) return

    // For likes and comments, only notify if the current user is the owner of the target post
    if ((activity.type === 'like' || activity.type === 'comment') && activity.targetUserId) {
      if (activity.targetUserId !== currentUserId) {
        return
      }
    }

    // Deduplication check (8 second window)
    const now = Date.now()
    // Clean up old dedupe keys
    recentDedupeKeys.current.forEach((time, key) => {
      if (now - time > 12000) recentDedupeKeys.current.delete(key)
    })

    const dedupKey = `${activity.type}_${activity.actorId}_${activity.targetPostId || activity.id || ''}_${(activity.content || '').slice(0, 30)}`
    if (recentDedupeKeys.current.has(dedupKey)) {
      return
    }
    recentDedupeKeys.current.set(dedupKey, now)

    // Resolve Actor Name and Avatar
    let actorName = activity.actorName || ''
    let actorAvatar = activity.actorAvatar || ''
    let actorUsername = activity.actorUsername || ''

    if (!actorName || actorName === 'Usuário' || !actorAvatar) {
      const presenceUser = usersMap?.[activity.actorId]
      if (presenceUser?.name && presenceUser.name !== 'Usuário') {
        actorName = presenceUser.name
        if (!actorAvatar && presenceUser.avatar_url) actorAvatar = presenceUser.avatar_url
      }
    }

    if (!actorName || actorName === 'Usuário' || !actorAvatar) {
      try {
        const { data: profile } = await supabase
          .from('social_profiles')
          .select('display_name, avatar_url, username')
          .eq('user_id', activity.actorId)
          .maybeSingle()

        if (profile) {
          if (!actorName || actorName === 'Usuário') actorName = profile.display_name || profile.username || 'Usuário'
          if (!actorAvatar) actorAvatar = profile.avatar_url || ''
          if (!actorUsername) actorUsername = profile.username || ''
        }
      } catch (_) {}
    }

    if (!actorName) actorName = 'Alguém'

    // If media thumbnail is missing and target post id is given, fetch thumbnail
    let mediaUrl = activity.mediaUrl || ''
    if (!mediaUrl && activity.targetPostId) {
      try {
        const { data: media } = await supabase
          .from('social_post_media')
          .select('media_url')
          .eq('post_id', activity.targetPostId)
          .limit(1)
          .maybeSingle()

        if (media?.media_url) {
          mediaUrl = media.media_url
        }
      } catch (_) {}
    }

    const notifId = `${activity.type}_${activity.actorId}_${now}`
    const newNotif: InstacenaNotifItem = {
      id: notifId,
      type: activity.type,
      actorId: activity.actorId,
      actorName,
      actorAvatar,
      actorUsername,
      content: activity.content,
      mediaUrl,
      targetPostId: activity.targetPostId,
      createdAt: activity.createdAt || new Date().toISOString()
    }

    // Play subtle audio
    playInstacenaSound()

    // Push OS Native Notification if app is in background
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        let actionLabel = 'curtiu uma publicação'
        if (activity.type === 'comment') actionLabel = `comentou: "${activity.content || ''}"`
        if (activity.type === 'post') actionLabel = 'publicou uma nova foto'
        if (activity.type === 'story') actionLabel = 'adicionou um novo story'

        new Notification(`Instacena • ${actorName}`, {
          body: actionLabel,
          icon: actorAvatar || '/logo.png'
        })
      } catch (_) {}
    }

    setNotifications(prev => [newNotif, ...prev.slice(0, 4)]) // Max 5 simultaneous popups
    scheduleDismiss(notifId, 6500)
  }, [currentUserId, usersMap, scheduleDismiss])

  // Realtime Subscriptions
  useEffect(() => {
    if (!currentUserId) return

    // 1. Supabase Realtime Broadcast (sub-second multi-user channel)
    const broadcastChannel = supabase.channel(`instacena_notifs_sub_${currentUserId}`)
      .on('broadcast', { event: 'activity' }, (payload: any) => {
        if (!initializedRef.current) return
        if (payload?.payload) {
          processIncomingActivity(payload.payload)
        }
      })
      .subscribe()

    // 2. Local window event & BroadcastChannel
    const handleLocalEvent = (e: any) => {
      if (!initializedRef.current) return
      if (e?.detail) processIncomingActivity(e.detail)
    }
    window.addEventListener('instacena_activity', handleLocalEvent)

    let bc: BroadcastChannel | null = null
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('instacena_activity_bus')
        bc.onmessage = (event) => {
          if (!initializedRef.current) return
          if (event?.data) processIncomingActivity(event.data)
        }
      }
    } catch (_) {}

    // 3. Supabase Postgres Changes Watcher (Captures DB inserts from all sources)
    const dbChannel = supabase.channel(`instacena_db_changes_${currentUserId}_${Date.now()}`)
      // Posts
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'social_posts' }, async (payload: any) => {
        if (!initializedRef.current) return
        const p = payload.new
        if (!p || p.user_id === currentUserId) return

        // Fetch post media thumbnail
        let postMedia = ''
        const { data: media } = await supabase
          .from('social_post_media')
          .select('media_url')
          .eq('post_id', p.id)
          .limit(1)
          .maybeSingle()
        if (media?.media_url) postMedia = media.media_url

        processIncomingActivity({
          type: 'post',
          actorId: p.user_id,
          content: p.caption || '',
          mediaUrl: postMedia,
          targetPostId: p.id,
          createdAt: p.created_at
        })
      })
      // Likes
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'social_post_likes' }, async (payload: any) => {
        if (!initializedRef.current) return
        const l = payload.new
        if (!l || l.user_id === currentUserId) return

        // Verify if current user is the author of the post
        const { data: post } = await supabase
          .from('social_posts')
          .select('user_id')
          .eq('id', l.post_id)
          .maybeSingle()

        if (post && post.user_id !== currentUserId) {
          return
        }

        // Fetch post thumbnail
        let postMedia = ''
        const { data: media } = await supabase
          .from('social_post_media')
          .select('media_url')
          .eq('post_id', l.post_id)
          .limit(1)
          .maybeSingle()
        if (media?.media_url) postMedia = media.media_url

        processIncomingActivity({
          type: 'like',
          actorId: l.user_id,
          targetPostId: l.post_id,
          targetUserId: post?.user_id,
          mediaUrl: postMedia,
          createdAt: l.created_at
        })
      })
      // Comments
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'social_comments' }, async (payload: any) => {
        if (!initializedRef.current) return
        const c = payload.new
        if (!c || c.user_id === currentUserId) return

        // Verify if current user is the author of the post
        const { data: post } = await supabase
          .from('social_posts')
          .select('user_id')
          .eq('id', c.post_id)
          .maybeSingle()

        if (post && post.user_id !== currentUserId) {
          return
        }

        let postMedia = ''
        const { data: media } = await supabase
          .from('social_post_media')
          .select('media_url')
          .eq('post_id', c.post_id)
          .limit(1)
          .maybeSingle()
        if (media?.media_url) postMedia = media.media_url

        processIncomingActivity({
          type: 'comment',
          actorId: c.user_id,
          content: c.content || '',
          targetPostId: c.post_id,
          targetUserId: post?.user_id,
          mediaUrl: postMedia,
          createdAt: c.created_at
        })
      })
      // Stories
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'social_stories' }, (payload: any) => {
        if (!initializedRef.current) return
        const s = payload.new
        if (!s || s.user_id === currentUserId) return

        processIncomingActivity({
          type: 'story',
          actorId: s.user_id,
          mediaUrl: s.media_type === 'image' ? s.media_url : '',
          createdAt: s.created_at
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(broadcastChannel)
      supabase.removeChannel(dbChannel)
      window.removeEventListener('instacena_activity', handleLocalEvent)
      if (bc) bc.close()
    }
  }, [currentUserId, processIncomingActivity])

  if (notifications.length === 0) return null

  const handleCardClick = (notif: InstacenaNotifItem) => {
    dismissNotification(notif.id)
    navigate({ to: '/instacena' })
  }

  return (
    <div 
      className="fixed top-16 sm:top-20 right-4 sm:right-6 z-[99999] flex flex-col gap-2.5 pointer-events-none w-[calc(100vw-32px)] sm:w-[380px] max-w-[400px]"
      aria-live="polite"
    >
      {notifications.map((notif) => {
        // Dynamic badge style & icon based on action type
        const isLike = notif.type === 'like'
        const isComment = notif.type === 'comment'
        const isPost = notif.type === 'post'
        const isStory = notif.type === 'story'

        let badgeIcon = <Heart size={10} className="fill-white text-white" />
        let badgeColor = 'bg-rose-500 shadow-rose-500/50'
        let actionTitle = 'Curtida no Instacena'
        let actionDesc = 'curtiu uma publicação'

        if (isComment) {
          badgeIcon = <MessageCircle size={10} className="fill-white text-white" />
          badgeColor = 'bg-indigo-600 shadow-indigo-600/50'
          actionTitle = 'Novo Comentário'
          actionDesc = notif.content ? `comentou: "${notif.content}"` : 'comentou em uma publicação'
        } else if (isPost) {
          badgeIcon = <Camera size={10} className="text-white" />
          badgeColor = 'bg-gradient-to-r from-amber-500 to-rose-500 shadow-orange-500/50'
          actionTitle = 'Nova Publicação'
          actionDesc = notif.content ? `publicou: "${notif.content}"` : 'publicou uma nova foto'
        } else if (isStory) {
          badgeIcon = <Sparkles size={10} className="text-white" />
          badgeColor = 'bg-gradient-to-r from-purple-500 to-pink-500 shadow-purple-500/50'
          actionTitle = 'Novo Story'
          actionDesc = 'compartilhou um novo story'
        }

        return (
          <div
            key={notif.id}
            onMouseEnter={() => handleMouseEnter(notif.id)}
            onMouseLeave={() => handleMouseLeave(notif.id)}
            onClick={() => handleCardClick(notif)}
            className={`pointer-events-auto group relative flex flex-col overflow-hidden rounded-2xl border 
              backdrop-blur-2xl transition-all duration-300 cursor-pointer select-none
              bg-white/95 dark:bg-[#14151a]/95 border-black/10 dark:border-white/10
              shadow-[0_16px_36px_rgba(0,0,0,0.18)] dark:shadow-[0_20px_45px_rgba(0,0,0,0.7)]
              hover:scale-[1.02] hover:border-pink-500/40 hover:shadow-[0_20px_45px_rgba(244,63,94,0.22)]
              ${notif.exiting
                ? 'opacity-0 -translate-y-4 scale-95 transition-all duration-300'
                : 'opacity-100 translate-y-0 scale-100 animate-slide-down-notif'
              }`}
          >
            {/* Top Bar with Brand & Close Button */}
            <div className="flex items-center justify-between px-3.5 pt-2.5 pb-1">
              <div className="flex items-center gap-1.5">
                <span className="p-0.5 rounded-md bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white">
                  <Instagram size={11} />
                </span>
                <span className="text-[10px] font-black tracking-widest uppercase bg-gradient-to-r from-amber-500 via-rose-500 to-purple-500 bg-clip-text text-transparent">
                  INSTACENA
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">• {actionTitle}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">Agora</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    dismissNotification(notif.id)
                  }}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  title="Fechar"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            {/* Main Content Body */}
            <div className="flex items-start gap-3 px-3.5 pb-3 pt-1">
              {/* Avatar with Instacena Gradient Ring */}
              <div className="relative shrink-0 mt-0.5">
                <div className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 shadow-sm">
                  {notif.actorAvatar ? (
                    <img
                      src={notif.actorAvatar}
                      alt={notif.actorName}
                      className="w-full h-full rounded-full object-cover bg-gray-200 dark:bg-gray-800"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center font-bold text-xs text-gray-700 dark:text-gray-300">
                      {notif.actorName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Sub-badge indicating action */}
                <div className={`absolute -bottom-1 -right-1 p-1 rounded-full shadow ${badgeColor} flex items-center justify-center ring-2 ring-white dark:ring-[#14151a]`}>
                  {badgeIcon}
                </div>
              </div>

              {/* Text Description */}
              <div className="flex-1 min-w-0 pr-1">
                <div className="text-[13px] leading-snug text-gray-900 dark:text-white">
                  <span className="font-bold hover:underline">{notif.actorName}</span>{' '}
                  <span className="text-gray-600 dark:text-gray-300 font-normal">
                    {actionDesc}
                  </span>
                </div>
                {notif.content && (isPost || isComment) && (
                  <p className="mt-1 text-[11.5px] leading-relaxed text-gray-500 dark:text-gray-400 italic line-clamp-2 bg-black/[0.03] dark:bg-white/[0.04] p-1.5 rounded-lg border border-black/5 dark:border-white/5">
                    {notif.content}
                  </p>
                )}
              </div>

              {/* Media Thumbnail Preview (if any) */}
              {notif.mediaUrl && (
                <div className="shrink-0 w-11 h-11 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 shadow-sm bg-gray-100 dark:bg-gray-800 self-center">
                  <img
                    src={notif.mediaUrl}
                    alt="Mídia"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
            </div>

            {/* Glowing countdown progress bar */}
            <div className="h-[2px] w-full bg-black/5 dark:bg-white/5 overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 ${
                  notif.isPaused ? '' : 'animate-notif-progress'
                }`}
                style={{ animationPlayState: notif.isPaused ? 'paused' : 'running' }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
