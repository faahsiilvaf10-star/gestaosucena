import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { JitsiMeeting } from '@jitsi/react-sdk'
import { Video, Users, Link as LinkIcon, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'

export const Route = createFileRoute('/reunioes')({
  component: ReunioesRoute,
})

function ReunioesRoute() {
  const [inMeeting, setInMeeting] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [userName, setUserName] = useState('Usuário')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserName(user.user_metadata?.full_name || user.email || 'Usuário')
      }
      setLoading(false)
    }
    loadUser()
  }, [])

  if (loading) return null

  if (inMeeting) {
    return (
      <div className="flex flex-col h-[calc(100vh-120px)] w-full relative z-0">
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={() => setInMeeting(false)}
            className="flex items-center gap-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft size={18} /> Voltar
          </button>
          <h2 className="text-xl font-bold dark:text-white">Sala: {roomName || 'Geral'}</h2>
          <div className="w-20"></div> {/* Spacer */}
        </div>
        
        <div className="flex-1 w-full h-full rounded-2xl overflow-hidden shadow-2xl bg-black">
          <JitsiMeeting
            domain="meet.jit.si"
            roomName={`Sucena-${(roomName || 'Geral').replace(/\\s+/g, '-')}`}
            configOverwrite={{
              startWithAudioMuted: false,
              disableModeratorIndicator: true,
              startScreenSharing: false,
              enableEmailInStats: false
            }}
            interfaceConfigOverwrite={{
              DISABLE_JOIN_LEAVE_NOTIFICATIONS: true
            }}
            userInfo={{
              displayName: userName
            }}
            onApiReady={(_externalApi) => {
              // API do Jitsi pronta
            }}
            getIFrameRef={(iframeRef) => {
              iframeRef.style.height = '100%';
              iframeRef.style.width = '100%';
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 flex items-center gap-4">
        <div className="w-14 h-14 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center border border-blue-500/20">
          <Video size={28} />
        </div>
        <div>
          <h1 className="tracking-tight text-4xl font-bold dark:text-white">Salas de Reunião</h1>
          <p className="text-gray-600 dark:text-white/60 mt-1">Crie ou acesse salas de videoconferência instantâneas.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 dark:text-white"><Users className="text-yellow-500" /> Nova Reunião</h2>
          <p className="text-gray-600 dark:text-white/60 text-sm mb-6">Crie uma nova sala ou digite o nome de uma sala existente para entrar.</p>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-white/80 pl-1 mb-1.5 block uppercase tracking-wider">Nome da Sala</label>
              <input
                type="text"
                value={roomName}
                onChange={e => setRoomName(e.target.value)}
                className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                placeholder="Ex: Reunião Diretoria"
              />
            </div>
            
            <button
              onClick={() => {
                if(!roomName) setRoomName('Geral');
                setInMeeting(true);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <Video size={18} />
              Entrar na Sala
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 dark:text-white"><LinkIcon className="text-purple-500" /> Salas Frequentes</h2>
            <div className="space-y-3">
              <button onClick={() => { setRoomName('Geral'); setInMeeting(true); }} className="w-full text-left p-4 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-all border border-gray-200 dark:border-white/5 flex items-center justify-between group">
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">Reunião Geral</div>
                  <div className="text-xs text-gray-500 dark:text-white/50 mt-0.5">Sala principal para todos</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Video size={14} className="text-gray-500 dark:text-white/40" />
                </div>
              </button>
              
              <button onClick={() => { setRoomName('Operacao'); setInMeeting(true); }} className="w-full text-left p-4 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-all border border-gray-200 dark:border-white/5 flex items-center justify-between group">
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">Operação</div>
                  <div className="text-xs text-gray-500 dark:text-white/50 mt-0.5">Alinhamento diário da operação</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Video size={14} className="text-gray-500 dark:text-white/40" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
