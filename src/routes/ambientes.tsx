import MapPin from 'lucide-react/dist/esm/icons/map-pin.js';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import Lock from 'lucide-react/dist/esm/icons/lock.js';
import ShieldAlert from 'lucide-react/dist/esm/icons/shield-alert.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { ThemeToggle } from '../components/ThemeToggle'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { getUserEnvironmentAccess, hasEnvironmentAccess, UserEnvironmentAccessMap } from '../lib/environmentAccess'

export const Route = createFileRoute('/ambientes')({
  component: AmbientesComponent,
})

type Environment = {
  id: string
  name: string
  description: string
  pinColor: string
  contract?: string
}

function AmbientesComponent() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const [hoveredEnv, setHoveredEnv] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [accessMap, setAccessMap] = useState<UserEnvironmentAccessMap>({})
  const [loadingAccess, setLoadingAccess] = useState(true)
  const [restrictedModalEnv, setRestrictedModalEnv] = useState<Environment | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const [{ data: { user } }, map] = await Promise.all([
          supabase.auth.getUser(),
          getUserEnvironmentAccess()
        ])
        setCurrentUser(user)
        setAccessMap(map)
      } catch (err) {
        console.error('Erro ao carregar permissões de ambiente:', err)
      } finally {
        setLoadingAccess(false)
      }
    }
    loadData()
  }, [])

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

  const checkUserAccess = (envId: string) => {
    if (!currentUser) return false
    return hasEnvironmentAccess(
      currentUser.id,
      envId,
      accessMap,
      currentUser.user_metadata?.full_name,
      currentUser.user_metadata?.role
    )
  }

  const handleSelectEnvironment = (env: Environment) => {
    const hasAccess = checkUserAccess(env.id)

    if (!hasAccess) {
      toast.error(`Você não tem permissão para acessar o ambiente ${env.name}.`, {
        description: 'Solicite a liberação a um administrador do sistema no painel admin.'
      })
      setRestrictedModalEnv(env)
      return
    }

    localStorage.setItem('sucena_environment', env.id)
    navigate({ to: '/dashboard' })
  }

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
        {environments.map((env) => {
          const hasAccess = checkUserAccess(env.id)
          const isHovered = hoveredEnv === env.id

          return (
            <button
              key={env.id}
              onMouseEnter={() => setHoveredEnv(env.id)}
              onMouseLeave={() => setHoveredEnv(null)}
              onClick={() => handleSelectEnvironment(env)}
              className={`relative overflow-hidden rounded-2xl text-left p-8 flex flex-col group transition-all duration-500 cursor-pointer ${
                !hasAccess && !loadingAccess ? 'opacity-85 hover:opacity-100' : ''
              }`}
              style={{
                background: isDark
                  ? hasAccess
                    ? 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)'
                    : 'linear-gradient(145deg, rgba(239,68,68,0.05) 0%, rgba(20,20,20,0.6) 100%)'
                  : hasAccess
                    ? 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.8) 100%)'
                    : 'linear-gradient(145deg, rgba(254,242,242,0.95) 0%, rgba(243,244,246,0.85) 100%)',
                border: !hasAccess && !loadingAccess
                  ? (isDark ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(239,68,68,0.35)')
                  : (isDark ? '1px solid rgba(201,168,76,0.25)' : '1px solid rgba(201,168,76,0.35)'),
                boxShadow: isHovered
                  ? (!hasAccess && !loadingAccess
                      ? (isDark
                          ? '0 0 30px rgba(239,68,68,0.15), inset 0 1px 0 rgba(239,68,68,0.2)'
                          : '0 16px 36px -6px rgba(239,68,68,0.18), 0 4px 12px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.8)')
                      : (isDark
                          ? '0 0 30px rgba(201,168,76,0.15), inset 0 1px 0 rgba(201,168,76,0.2)'
                          : '0 16px 36px -6px rgba(201,168,76,0.22), 0 4px 12px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.8)'))
                  : (isDark
                      ? 'inset 0 1px 0 rgba(201,168,76,0.1)'
                      : '0 4px 20px -2px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)'),
                transform: isHovered ? 'translateY(-2px) scale(1.015)' : 'translateY(0) scale(1)',
              }}
            >
              {/* Top golden or red shine line */}
              <div
                className="absolute top-0 left-0 right-0 h-[1px]"
                style={{
                  background: !hasAccess && !loadingAccess
                    ? (isDark
                        ? 'linear-gradient(90deg, transparent, rgba(239,68,68,0.5), transparent)'
                        : 'linear-gradient(90deg, transparent, rgba(239,68,68,0.7), transparent)')
                    : (isDark
                        ? 'linear-gradient(90deg, transparent, rgba(201,168,76,0.5), transparent)'
                        : 'linear-gradient(90deg, transparent, rgba(201,168,76,0.7), transparent)'),
                }}
              />

              <div className="relative z-10 w-full flex flex-col h-full">
                {/* Header row: Icon box + Lock Badge */}
                <div className="flex items-center justify-between mb-6">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300"
                    style={{
                      background: !hasAccess && !loadingAccess
                        ? (isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)')
                        : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(201,168,76,0.08)'),
                      border: !hasAccess && !loadingAccess
                        ? (isDark ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(239,68,68,0.35)')
                        : (isDark ? '1px solid rgba(201,168,76,0.3)' : '1px solid rgba(201,168,76,0.35)'),
                    }}
                  >
                    {!hasAccess && !loadingAccess ? (
                      <Lock size={22} className="text-red-500" />
                    ) : (
                      <MapPin size={22} style={{ color: env.pinColor }} />
                    )}
                  </div>

                  {!hasAccess && !loadingAccess && (
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                      isDark
                        ? 'bg-red-500/10 text-red-400 border-red-500/30'
                        : 'bg-red-50 text-red-600 border-red-200'
                    }`}>
                      <Lock size={12} />
                      Acesso Bloqueado
                    </div>
                  )}
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
                  className={`mt-auto flex items-center text-sm font-semibold transition-colors ${
                    !hasAccess && !loadingAccess ? 'text-red-500 dark:text-red-400' : ''
                  }`}
                  style={{ color: hasAccess ? (isDark ? '#c9a84c' : '#b88e28') : undefined }}
                >
                  {!hasAccess && !loadingAccess ? (
                    <>
                      <Lock size={15} className="mr-2" />
                      Sem acesso a este ambiente
                    </>
                  ) : (
                    <>
                      Entrar no ambiente
                      <ArrowRight size={16} className="ml-2 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Modal de Acesso Restrito ao clicar em ambiente bloqueado */}
      {restrictedModalEnv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl relative border ${
            isDark ? 'bg-[#15161A] border-white/10 text-white' : 'bg-white border-black/10 text-gray-900'
          }`}>
            <button
              onClick={() => setRestrictedModalEnv(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/15 text-red-500 flex items-center justify-center shrink-0 border border-red-500/20">
                <Lock size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold">Acesso Não Autorizado</h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20">
                  {restrictedModalEnv.name}
                </span>
              </div>
            </div>

            <p className={`text-sm leading-relaxed mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              Você não possui permissão para acessar o ambiente <strong>{restrictedModalEnv.name}</strong>.
              <br /><br />
              Seu usuário não foi selecionado no painel administrativo para esta unidade. Caso necessite deste acesso para suas atividades, por favor solicite a liberação a um <strong>Administrador do Sistema</strong>.
            </p>

            <div className="flex justify-end">
              <button
                onClick={() => setRestrictedModalEnv(null)}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-sm bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

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
