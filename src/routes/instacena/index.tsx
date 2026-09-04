import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Heart, MessageCircle, Send, Bookmark } from 'lucide-react'

export const Route = createFileRoute('/instacena/')({
  component: FeedRoute,
})

function FeedRoute() {
  const [posts] = useState([
    { id: 1, user: 'fabriciosilva', likes: 12, caption: 'Começando os trabalhos!', time: '2h' },
    { id: 2, user: 'maria.souza', likes: 45, caption: 'Reunião de alinhamento.', time: '5h' },
  ])

  return (
    <div className="flex flex-col gap-8 py-8 px-4">
      
      {/* Stories Placeholder */}
      <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-yellow-400 to-purple-500 p-[2px]">
              <div className="w-full h-full rounded-full bg-white dark:bg-[#0a0a0c] border-2 border-transparent overflow-hidden">
                 <img src={`https://i.pravatar.cc/150?img=${i}`} alt="Story" className="w-full h-full object-cover" />
              </div>
            </div>
            <span className="text-[10px] font-medium">user_{i}</span>
          </div>
        ))}
      </div>

      {/* Feed Placeholder */}
      <div className="flex flex-col gap-10">
        {posts.map(post => (
          <article key={post.id} className="flex flex-col gap-3">
            {/* Post Header */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                <img src={`https://i.pravatar.cc/150?img=${post.id+10}`} alt="Avatar" className="w-full h-full object-cover" />
              </div>
              <span className="font-bold text-sm">{post.user}</span>
              <span className="text-xs opacity-50 ml-auto">{post.time}</span>
            </div>

            {/* Post Image */}
            <div className="w-full aspect-square bg-gray-200 dark:bg-white/5 rounded-md overflow-hidden">
              <img src={`https://picsum.photos/seed/${post.id}/600/600`} alt="Post content" className="w-full h-full object-cover" />
            </div>

            {/* Post Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button className="hover:opacity-70 transition-opacity"><Heart size={24} /></button>
                <button className="hover:opacity-70 transition-opacity"><MessageCircle size={24} /></button>
                <button className="hover:opacity-70 transition-opacity"><Send size={24} /></button>
              </div>
              <button className="hover:opacity-70 transition-opacity"><Bookmark size={24} /></button>
            </div>

            {/* Post Likes & Caption */}
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold">{post.likes} curtidas</span>
              <p className="text-sm">
                <span className="font-bold mr-2">{post.user}</span>
                {post.caption}
              </p>
              <button className="text-sm opacity-50 text-left mt-1">Ver todos os comentários</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
