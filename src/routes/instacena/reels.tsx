import { createFileRoute } from '@tanstack/react-router'
import { Heart, MessageCircle, Send, Bookmark, MoreVertical, Music } from 'lucide-react'

export const Route = createFileRoute('/instacena/reels')({
  component: ReelsRoute,
})

function ReelsRoute() {
  return (
    <div className="h-full w-full max-w-[450px] mx-auto bg-black flex flex-col overflow-y-auto snap-y snap-mandatory hide-scrollbar">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-full w-full shrink-0 snap-start relative flex items-center justify-center border-b border-white/20">
          
          {/* Mock Video Area */}
          <div className="absolute inset-0 z-0">
             <img src={`https://picsum.photos/seed/reel${i}/600/1000`} alt="Reel" className="w-full h-full object-cover opacity-80" />
          </div>

          {/* Right Action Bar */}
          <div className="absolute right-4 bottom-24 z-10 flex flex-col items-center gap-6">
            <button className="flex flex-col items-center gap-1 group">
              <div className="p-3 bg-black/20 rounded-full group-hover:bg-black/40 transition-colors backdrop-blur-sm">
                <Heart size={28} className="text-white" />
              </div>
              <span className="text-white text-xs font-bold shadow-black drop-shadow-md">1.2k</span>
            </button>
            
            <button className="flex flex-col items-center gap-1 group">
              <div className="p-3 bg-black/20 rounded-full group-hover:bg-black/40 transition-colors backdrop-blur-sm">
                <MessageCircle size={28} className="text-white" />
              </div>
              <span className="text-white text-xs font-bold shadow-black drop-shadow-md">342</span>
            </button>
            
            <button className="flex flex-col items-center gap-1 group">
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
               <img src={`https://i.pravatar.cc/150?img=${i+10}`} alt="Audio" className="w-full h-full object-cover" />
            </div>
          </div>

          {/* Bottom Info Area */}
          <div className="absolute bottom-0 left-0 right-16 p-4 z-10 flex flex-col gap-3 pb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-white/50">
                 <img src={`https://i.pravatar.cc/150?img=${i+15}`} alt="User" className="w-full h-full object-cover" />
              </div>
              <span className="text-white font-bold text-[15px] drop-shadow-md">usuario_{i}</span>
              <button className="px-3 py-1 bg-transparent border border-white text-white rounded-lg text-xs font-bold ml-2">Seguir</button>
            </div>
            
            <p className="text-white text-sm drop-shadow-md line-clamp-2">
              Mostrando um pouco do projeto de hoje. 🏗️✨ #engenharia #arquitetura #obra
            </p>
            
            <div className="flex items-center gap-2 text-white/90">
              <Music size={14} />
              <span className="text-xs marquee drop-shadow-md">Áudio original - usuario_{i}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
