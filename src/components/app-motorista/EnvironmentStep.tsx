import { Factory, MapPin } from 'lucide-react'

export default function EnvironmentStep({ onSelect }: { onSelect: (envId: string) => void }) {
  
  const environments = [
    {
      id: 'barcarena',
      name: 'BARCARENA – ALUNORTE',
      icon: Factory
    },
    {
      id: 'paragominas',
      name: 'PARAGOMINAS',
      icon: MapPin
    }
  ]

  const handleSelect = (envId: string) => {
    localStorage.setItem('sucena_environment', envId)
    onSelect(envId)
  }

  return (
    <div className="min-h-full flex flex-col p-6 bg-gray-50 dark:bg-zinc-950 pb-24">
      <div className="mt-8 mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">SELECIONE O AMBIENTE</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Toque para entrar no ambiente</p>
      </div>

      <div className="flex flex-col gap-4">
        {environments.map(env => (
          <button
            key={env.id}
            onClick={() => handleSelect(env.id)}
            className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-emerald-500/50 active:scale-[0.98] transition-all flex items-center gap-5 text-left group"
          >
            <div className="w-14 h-14 bg-gray-50 dark:bg-zinc-800 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-500/10 transition-colors">
              <env.icon className="w-7 h-7 text-gray-500 dark:text-gray-400 group-hover:text-emerald-500 transition-colors" />
            </div>
            
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight mb-1">
                {env.name}
              </h2>
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-500">
                Entrar neste ambiente &rarr;
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-auto pt-8 flex justify-center">
        <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-zinc-900 px-4 py-2.5 rounded-full border border-gray-200 dark:border-zinc-800 shadow-sm">
          <input 
            type="checkbox" 
            className="w-5 h-5 rounded text-emerald-500 focus:ring-emerald-500 border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
          />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Lembrar este ambiente</span>
        </label>
      </div>
    </div>
  )
}
