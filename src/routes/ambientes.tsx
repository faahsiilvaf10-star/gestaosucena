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
      pinColor: '#c9a84c',
    },
    {
      id: 'paragominas',
      name: 'PARAGOMINAS HYDRO',
      description: 'Ambiente de gestão e operações da unidade Paragominas.',
      pinColor: '#c9a84c',
    }
  ]

  return (
    <div
      className="min-h-screen text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans"
      style={{ background: 'radial-gradient(ellipse at center top, #1a1508 0%, #0d0d0d 35%, #050505 100%)' }}
    >
      
      {/* Golden glow at top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[250px] rounded-full blur-[120px] opacity-15 pointer-events-none" style={{ background: 'radial-gradient(ellipse, #c9a84c 0%, transparent 70%)' }} />

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
            className="relative overflow-hidden rounded-2xl text-left p-8 flex flex-col group transition-all duration-500"
            style={{
              background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
              border: '1px solid rgba(201,168,76,0.25)',
              boxShadow: hoveredEnv === env.id
                ? '0 0 30px rgba(201,168,76,0.15), inset 0 1px 0 rgba(201,168,76,0.2)'
                : 'inset 0 1px 0 rgba(201,168,76,0.1)',
              transform: hoveredEnv === env.id ? 'scale(1.02)' : 'scale(1)',
            }}
          >
            {/* Top golden shine line */}
            <div
              className="absolute top-0 left-0 right-0 h-[1px]"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.5), transparent)' }}
            />

            <div className="relative z-10">
              {/* Icon box */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(201,168,76,0.3)',
                }}
              >
                <MapPin size={22} style={{ color: env.pinColor }} />
              </div>
              
              <h2 className="text-2xl font-bold tracking-tight mb-2 text-white">{env.name}</h2>
              <p className="text-white/50 text-sm leading-relaxed mb-8">
                {env.description}
              </p>
              
              <div className="mt-auto flex items-center text-sm font-semibold transition-colors" style={{ color: '#c9a84c' }}>
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
