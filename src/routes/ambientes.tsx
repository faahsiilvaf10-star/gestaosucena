import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { MapPin, ArrowRight } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/ambientes')({
  component: AmbientesComponent,
})

function AmbientesComponent() {
  const navigate = useNavigate()
  const [hoveredEnv, setHoveredEnv] = useState<string | null>(null)

  const handleSelectEnvironment = (env: string) => {
    localStorage.setItem('sucena_environment', env)
    navigate({ to: '/dashboard' })
  }

  const environments = [
    {
      id: 'barcarena',
      name: 'BARCARENA HYDRO',
      description: 'Ambiente de gestão e operações da unidade Barcarena.',
      color: 'from-blue-600 to-indigo-800',
      iconColor: 'text-blue-400'
    },
    {
      id: 'paragominas',
      name: 'PARAGOMINAS HYDRO',
      description: 'Ambiente de gestão e operações da unidade Paragominas.',
      color: 'from-emerald-600 to-teal-800',
      iconColor: 'text-emerald-400'
    }
  ]

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      
      {/* Background Decor */}
      <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none"></div>
      
      <div className="text-center mb-12 z-10">
        <img src="/logo.png" alt="Sucena Logo" className="h-14 mx-auto mb-8 filter brightness-0 invert opacity-80" />
        <h1 className="text-3xl font-light tracking-tight mb-3">Selecione o Ambiente</h1>
        <p className="text-white/50 max-w-md mx-auto text-sm">
          Escolha qual unidade você deseja acessar. Os dados são isolados para cada ambiente.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl z-10">
        {environments.map((env) => (
          <button
            key={env.id}
            onMouseEnter={() => setHoveredEnv(env.id)}
            onMouseLeave={() => setHoveredEnv(null)}
            onClick={() => handleSelectEnvironment(env.id)}
            className={`relative overflow-hidden rounded-2xl border transition-all duration-500 text-left p-8 flex flex-col group
              ${hoveredEnv === env.id ? 'border-white/30 scale-[1.02] shadow-2xl shadow-black/50' : 'border-white/10 hover:border-white/20 bg-white/[0.02]'}
            `}
          >
            {/* Gradient Background */}
            <div 
              className={`absolute inset-0 bg-gradient-to-br ${env.color} opacity-0 transition-opacity duration-500 ${hoveredEnv === env.id ? 'opacity-20' : ''}`}
            />
            
            <div className="relative z-10">
              <div className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6 border border-white/10 transition-colors ${hoveredEnv === env.id ? 'bg-white/10' : ''}`}>
                <MapPin className={env.iconColor} size={24} />
              </div>
              
              <h2 className="text-2xl font-bold tracking-tight mb-2 group-hover:text-white transition-colors">{env.name}</h2>
              <p className="text-white/60 text-sm leading-relaxed mb-8">
                {env.description}
              </p>
              
              <div className="mt-auto flex items-center text-sm font-medium text-white/50 group-hover:text-white transition-colors">
                Entrar no ambiente
                <ArrowRight size={16} className="ml-2 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
