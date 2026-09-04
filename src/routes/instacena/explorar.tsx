import { createFileRoute } from '@tanstack/react-router'
import { Search, Film, Image as ImageIcon } from 'lucide-react'

export const Route = createFileRoute('/instacena/explorar')({
  component: ExplorarRoute,
})

function ExplorarRoute() {
  return (
    <div className="flex flex-col w-full h-full max-w-4xl mx-auto py-4 md:py-8">
      
      {/* Search Bar Mobile */}
      <div className="md:hidden px-4 mb-4">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input 
            type="text" 
            placeholder="Pesquisar" 
            className="w-full pl-10 pr-4 py-2 bg-black/5 dark:bg-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow text-sm"
          />
        </div>
      </div>

      {/* Explore Grid */}
      <div className="grid grid-cols-3 gap-1 md:gap-2">
        {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => {
          // Make some items span 2 rows for the "Instagram explore" look
          const isLarge = i === 2 || i === 9;
          
          return (
            <div 
              key={i} 
              className={`relative bg-gray-200 dark:bg-white/5 cursor-pointer group overflow-hidden ${isLarge ? 'row-span-2' : 'aspect-square'}`}
            >
              <img src={`https://picsum.photos/seed/explore${i}/600/${isLarge ? 1200 : 600}`} alt="Explore" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              
              <div className="absolute top-2 right-2 text-white drop-shadow-md z-10">
                {i % 4 === 0 || isLarge ? <Film size={20} fill="currentColor" /> : <ImageIcon size={20} fill="currentColor" />}
              </div>
              
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity z-20" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
