import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Video, X } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

interface MeetingAlert {
  roomName: string;
  startedBy: string;
  startedByName?: string;
  timestamp: number;
}

export function GlobalMeetingAlert() {
  const { isDark } = useTheme()
  const [alerts, setAlerts] = useState<MeetingAlert[]>([])

  useEffect(() => {
    let currentUserId: string | null = null;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        currentUserId = user.id;
      }
    });

    const channel = supabase.channel('global_meetings')
      .on('broadcast', { event: 'meeting_started' }, (payload) => {
        const data = payload.payload as MeetingAlert;
        
        // Se a própria pessoa iniciou, não precisa ver o alerta (já está na sala)
        if (data.startedBy === currentUserId) return;
        
        setAlerts((prev) => {
          // Evita duplicados da mesma sala nos últimos 30s
          if (prev.some(a => a.roomName === data.roomName && (Date.now() - a.timestamp) < 30000)) {
            return prev;
          }
          return [...prev, data];
        });
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (alerts.length === 0) return null;

  const currentAlert = alerts[0];

  const handleDismiss = () => {
    setAlerts((prev) => prev.slice(1));
  }

  const handleJoin = () => {
    setAlerts((prev) => prev.slice(1));
    window.location.href = `/reunioes?room=${encodeURIComponent(currentAlert.roomName)}`;
  }

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className={`w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-300 ${
        isDark ? 'bg-[#121214] border border-white/10' : 'bg-white border border-gray-200'
      }`}>
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
              <Video size={24} className="animate-pulse" />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Reunião Iniciada</h2>
              <p className={`text-sm ${isDark ? 'text-white/60' : 'text-gray-500'}`}>Chamada de vídeo online</p>
            </div>
          </div>
          <button 
            onClick={handleDismiss}
            className={`p-2 rounded-full transition-colors ${
              isDark ? 'hover:bg-white/10 text-white/40 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-900'
            }`}
          >
            <X size={20} />
          </button>
        </div>

        <div className={`p-4 rounded-xl mb-8 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-100'}`}>
          <div className="flex flex-col gap-3">
            <div>
              <div className={`text-xs uppercase font-bold tracking-wider mb-1 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>Sala</div>
              <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{currentAlert.roomName}</div>
            </div>
            <div>
              <div className={`text-xs uppercase font-bold tracking-wider mb-1 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>Iniciada por</div>
              <div className={`text-sm ${isDark ? 'text-white/80' : 'text-gray-700'}`}>{currentAlert.startedByName || 'Um usuário'}</div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleDismiss}
            className={`flex-1 py-3.5 px-4 rounded-xl font-bold transition-all ${
              isDark 
                ? 'bg-white/5 hover:bg-white/10 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
            }`}
          >
            Recusar
          </button>
          <button
            onClick={handleJoin}
            className="flex-2 w-2/3 py-3.5 px-4 rounded-xl font-bold transition-all bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
          >
            <Video size={18} />
            Entrar na Reunião
          </button>
        </div>
      </div>
    </div>
  )
}
