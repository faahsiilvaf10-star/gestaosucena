import MapPin from 'lucide-react/dist/esm/icons/map-pin.js';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { ThemeToggle } from '../components/ThemeToggle'

export const Route = createFileRoute('/ambientes')({
  component: AmbientesComponent,
})

function AmbientesComponent() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const [hoveredEnv, setHoveredEnv] = useState<string | null>(null)

  const handleSelectEnvironment = (env: string) => {
    localStorage.setItem('sucena_environment', env)
    navigate({ to: '/dashboard' })
  }

  type Environment = {
    id: string
    name: string
    description: string
    pinColor: string
    contract?: string
  }

  const environments: Environment[] = [
    {
      id: 'barcarena',
      name: 'HYDRO REABILITAÇÃO',
      contract: 'Contrato 4600012690',
      description: 'Ambiente de gestão e operações da unidade Hydro Reabilitação.',
      pinColor: isDark ? '#c9a84c' : '#b88e28',
    },
    {
      id: 'hydro-civil',
      name: 'HYDRO CIVIL',
      description: 'Ambiente de gestão e operações da unidade Hydro Civil.',
      pinColor: isDark ? '#c9a84c' : '#b88e28',
    }
  ]

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans transition-colors duration-300 ${
        isDark ? 'text-white' : 'text-[#1c1d21]'
      }`}
      style={{
        background: isDark
          ? 'radial-gradient(ellipse at center top, #1a1508 0%, #0d0d0d 35%, #050505 100%)'
          : 'radial-gradient(ellipse at center top, #fffdf7 0%, #f7f3e8 45%, #eceff4 100%)',
      }}
    >
      
      {/* Golden glow at top */}
      <div
        className={`absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[250px] rounded-full blur-[120px] pointer-events-none transition-opacity duration-500 ${
          isDark ? 'opacity-15' : 'opacity-25'
        }`}
        style={{ background: 'radial-gradient(ellipse, #c9a84c 0%, transparent 70%)' }}
      />

      <div className="text-center mb-12 z-10">
        <img
          src={isDark ? '/logo.png' : '/logo-light-theme.png'}
          alt="Sucena Logo"
          className={`h-14 mx-auto mb-8 transition-all duration-300 ${
            isDark ? 'filter brightness-0 invert opacity-80' : 'object-contain drop-shadow-sm'
          }`}
        />
        <h1 className={`text-3xl font-light tracking-tight mb-3 transition-colors ${
          isDark ? 'text-white' : 'text-[#1c1d21]'
        }`}>
          Selecione o Ambiente
        </h1>
        <p className={`max-w-md mx-auto text-sm transition-colors ${
          isDark ? 'text-white/50' : 'text-slate-600'
        }`}>
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
            className="relative overflow-hidden rounded-2xl text-left p-8 flex flex-col group transition-all duration-500 cursor-pointer"
            style={{
              background: isDark
                ? 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)'
                : 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.8) 100%)',
              border: isDark ? '1px solid rgba(201,168,76,0.25)' : '1px solid rgba(201,168,76,0.35)',
              boxShadow: hoveredEnv === env.id
                ? (isDark
                    ? '0 0 30px rgba(201,168,76,0.15), inset 0 1px 0 rgba(201,168,76,0.2)'
                    : '0 16px 36px -6px rgba(201,168,76,0.22), 0 4px 12px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.8)')
                : (isDark
                    ? 'inset 0 1px 0 rgba(201,168,76,0.1)'
                    : '0 4px 20px -2px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)'),
              transform: hoveredEnv === env.id ? 'translateY(-2px) scale(1.015)' : 'translateY(0) scale(1)',
            }}
          >
            {/* Top golden shine line */}
            <div
              className="absolute top-0 left-0 right-0 h-[1px]"
              style={{
                background: isDark
                  ? 'linear-gradient(90deg, transparent, rgba(201,168,76,0.5), transparent)'
                  : 'linear-gradient(90deg, transparent, rgba(201,168,76,0.7), transparent)',
              }}
            />

            <div className="relative z-10">
              {/* Icon box */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-all duration-300"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(201,168,76,0.08)',
                  border: isDark ? '1px solid rgba(201,168,76,0.3)' : '1px solid rgba(201,168,76,0.35)',
                }}
              >
                <MapPin size={22} style={{ color: env.pinColor }} />
              </div>
              
              <h2 className={`text-2xl font-bold tracking-tight mb-2 transition-colors ${
                isDark ? 'text-white' : 'text-[#1c1d21]'
              }`}>
                {env.name}
              </h2>
              {env.contract && (
                <div className={`text-xs font-semibold px-2.5 py-1 rounded-md w-fit mb-3 border transition-colors ${
                  isDark
                    ? 'bg-yellow-500/10 text-[#c9a84c] border-[#c9a84c]/30'
                    : 'bg-amber-500/10 text-amber-800 border-amber-500/25'
                }`}>
                  {env.contract}
                </div>
              )}
              <p className={`text-sm leading-relaxed mb-8 transition-colors ${
                isDark ? 'text-white/50' : 'text-slate-600'
              }`}>
                {env.description}
              </p>
              
              <div
                className="mt-auto flex items-center text-sm font-semibold transition-colors"
                style={{ color: isDark ? '#c9a84c' : '#b88e28' }}
              >
                Entrar no ambiente
                <ArrowRight size={16} className="ml-2 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Footer with copyright & ThemeToggle */}
      <div className="absolute bottom-0 left-0 w-full p-6 flex justify-between items-center z-10">
        <div className="w-[64px]"></div>
        <p className={`text-[11px] flex-1 text-center font-light transition-colors ${
          isDark ? 'text-white/60' : 'text-black/40'
        }`}>
          © 2026 Sucena Empreendimentos. Todos os direitos reservados.
        </p>
        <div className="w-[64px] flex justify-end">
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}



