import { Moon, Sun, Eye, EyeOff, Loader2, CheckCircle2, Shield, UserCircle2, Clock, Lock } from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { useTheme } from '../contexts/ThemeContext'
import { ThemeToggle } from '../components/ThemeToggle'
import { useNavigate, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const [viewState, setViewState] = useState<'LOGIN' | 'REGISTER' | 'SUCCESS'>('LOGIN')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [authorizedUser, setAuthorizedUser] = useState({ name: '', role: '' })

  const translateAuthError = (message: string) => {
    const errorMap: Record<string, string> = {
      'Invalid login credentials': 'Email ou senha inválidos.',
      'Email signups are disabled': 'O cadastro por email está desativado no momento.',
      'User already registered': 'Este e-mail já está cadastrado.',
      'Password should be at least 6 characters': 'A senha deve ter no mínimo 6 caracteres.',
      'To security reasons, your request has been blocked': 'Por motivos de segurança, sua requisição foi bloqueada.',
      'Email not confirmed': 'O e-mail ainda não foi confirmado.',
    }
    
    // Check if the message is in our map exactly, or if it contains a substring
    for (const [key, translated] of Object.entries(errorMap)) {
      if (message.includes(key)) {
        return translated
      }
    }
    
    // Se não tiver tradução específica, tenta algumas traduções genéricas ou retorna o original
    return message
  }


  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [cargo, setCargo] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  useEffect(() => {
    const savedEmail = localStorage.getItem('sucena_saved_email')
    const savedPassword = localStorage.getItem('sucena_saved_password')
    if (savedEmail && savedPassword) {
      setEmail(savedEmail)
      setPassword(savedPassword)
      setRememberMe(true)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    if (!email || !password) {
      const msg = 'Preencha todos os campos.'
      toast.error(msg)
      setErrorMessage(msg)
      return
    }

    setIsLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setIsLoading(false)

    if (error) {
      const translatedError = translateAuthError(error.message)
      toast.error('Erro ao fazer login: ' + translatedError)
      setErrorMessage(translatedError)
    } else {
      if (rememberMe) {
        localStorage.setItem('sucena_saved_email', email)
        localStorage.setItem('sucena_saved_password', password)
      } else {
        localStorage.removeItem('sucena_saved_email')
        localStorage.removeItem('sucena_saved_password')
      }
      toast.success('Login realizado com sucesso!')
      
      const userMeta = data.user?.user_metadata
      setAuthorizedUser({ 
        name: userMeta?.full_name || email, 
        role: userMeta?.role || 'Usuário' 
      })
      setIsAuthorized(true)
      
      setTimeout(() => {
        navigate({ to: '/ambientes' })
      }, 5000)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    if (!email || !password || !nome || !whatsapp || !cargo) {
      const msg = 'Preencha todos os campos do cadastro.'
      toast.error(msg)
      setErrorMessage(msg)
      return
    }

    setIsLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: nome,
          whatsapp: whatsapp,
          role: cargo,
        }
      }
    })
    setIsLoading(false)

    if (error) {
      const translatedError = translateAuthError(error.message)
      toast.error('Erro ao cadastrar: ' + translatedError)
      setErrorMessage(translatedError)
    } else {
      // Limpa os campos após sucesso
      setEmail('')
      setPassword('')
      setNome('')
      setWhatsapp('')
      setCargo('')
      setViewState('SUCCESS')
    }
  }

  const inputClass = `w-full rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition-all disabled:opacity-50 ${
    isDark 
      ? 'bg-[#18181b]/80 border-white/10 border text-white placeholder-white/40 focus:border-white/30 focus:ring-white/30' 
      : 'bg-white/80 border-black/10 border text-black placeholder-black/40 focus:border-black/30 focus:ring-black/30 shadow-sm'
  }`

  const passwordInputClass = `${inputClass} pr-10`

  const btnClass = `w-full rounded-lg px-4 py-3 text-sm font-medium transition-colors mt-2 border flex items-center justify-center disabled:opacity-70 ${
    isDark
      ? 'bg-[#27272a] hover:bg-[#3f3f46] border-white/5 text-white/90'
      : 'bg-gray-900 hover:bg-gray-800 border-transparent text-white shadow-sm'
  }`

  const linkClass = `text-sm transition-colors cursor-pointer select-none ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`

  return (
    <div className={`min-h-screen w-full flex flex-col relative overflow-hidden font-sans transition-colors duration-300 ${isDark ? 'bg-[#09090b] text-white' : 'bg-gray-50 text-black'}`}>
      
      <AnimatePresence>
        {isAuthorized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-[100] flex flex-col items-center justify-center text-white overflow-hidden"
            style={{ background: 'radial-gradient(ellipse at center top, #1a1508 0%, #0d0d0d 40%, #050505 100%)' }}
          >
            {/* Subtle golden glow at top */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-[120px] opacity-20" style={{ background: 'radial-gradient(ellipse, #c9a84c 0%, transparent 70%)' }} />

            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
              className="flex flex-col items-center gap-0 relative z-10 w-full max-w-lg px-6"
            >
              {/* Checkmark Circle */}
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.5 }}
                className="w-24 h-24 rounded-full border-[3px] border-[#c9a84c] flex items-center justify-center mb-8"
                style={{ boxShadow: '0 0 30px rgba(201,168,76,0.25), inset 0 0 20px rgba(201,168,76,0.1)' }}
              >
                <motion.svg
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                  width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                >
                  <motion.path
                    d="M20 6L9 17l-5-5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 0.8, duration: 0.6, ease: 'easeOut' }}
                  />
                </motion.svg>
              </motion.div>
              
              {/* ACESSO AUTORIZADO */}
              <motion.h2 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-3xl md:text-5xl font-extrabold tracking-[0.08em] uppercase mb-4 whitespace-nowrap"
                style={{ 
                  color: '#c9a84c',
                  textShadow: '0 0 40px rgba(201,168,76,0.3)',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                ACESSO AUTORIZADO
              </motion.h2>

              {/* Bem-vindo ao sistema */}
              <motion.p
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.85 }}
                className="text-lg text-white/70 font-light mb-3"
              >
                Bem-vindo ao sistema
              </motion.p>

              {/* Gold divider line */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 1, duration: 0.6 }}
                className="h-[2px] w-16 mb-6"
                style={{ background: 'linear-gradient(90deg, transparent, #c9a84c, transparent)' }}
              />
              
              {/* User Name & Role */}
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-center flex flex-col items-center mb-10"
              >
                <p className="text-2xl font-bold text-white tracking-wide">{authorizedUser.name}</p>
                <p className="text-sm uppercase tracking-[0.25em] font-semibold mt-2" style={{ color: '#c9a84c' }}>{authorizedUser.role}</p>
              </motion.div>
              
              {/* Three info cards */}
              <motion.div 
                initial={{ y: 25, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="w-full grid grid-cols-3 rounded-2xl overflow-hidden mb-10"
                style={{ 
                  background: 'linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                  border: '1px solid rgba(201,168,76,0.15)'
                }}
              >
                {/* ACESSO SEGURO */}
                <div className="flex flex-col items-center justify-center py-6 px-3" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                  <Shield size={28} className="mb-3" style={{ color: '#c9a84c' }} />
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/90 mb-1">ACESSO SEGURO</p>
                  <p className="text-[10px] text-white/40">Seus dados protegidos</p>
                </div>
                {/* USUÁRIO VERIFICADO */}
                <div className="flex flex-col items-center justify-center py-6 px-3" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                  <UserCircle2 size={28} className="mb-3" style={{ color: '#c9a84c' }} />
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/90 mb-1">USUÁRIO VERIFICADO</p>
                  <p className="text-[10px] text-white/40">Permissões confirmadas</p>
                </div>
                {/* SESSÃO INICIADA */}
                <div className="flex flex-col items-center justify-center py-6 px-3">
                  <Clock size={28} className="mb-3" style={{ color: '#c9a84c' }} />
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/90 mb-1">SESSÃO INICIADA</p>
                  <p className="text-[10px] text-white/40">Agora mesmo</p>
                </div>
              </motion.div>

              {/* Footer text */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="flex flex-col items-center gap-2"
              >
                <p className="text-xs text-white/40">Sua sessão está protegida e monitorada.</p>
                <div className="flex items-center gap-1.5">
                  <Lock size={13} style={{ color: '#c9a84c' }} />
                  <p className="text-xs font-semibold" style={{ color: '#c9a84c' }}>Ambiente 100% seguro</p>
                </div>
              </motion.div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Background Effects */}
      <div className={`absolute top-[-20%] left-[-10%] w-[70%] h-[70%] blur-[150px] rounded-full pointer-events-none z-0 transition-colors duration-300 ${isDark ? 'bg-blue-600/20' : 'bg-blue-400/20'}`}></div>
      <div className={`absolute top-[-20%] right-[-10%] w-[60%] h-[60%] blur-[150px] rounded-full pointer-events-none z-0 transition-colors duration-300 ${isDark ? 'bg-purple-600/20' : 'bg-purple-400/20'}`}></div>
      
      {/* Grid Pattern */}
      <div 
        className={`absolute inset-0 z-0 transition-opacity duration-300 ${isDark ? 'opacity-[0.03]' : 'opacity-[0.05]'}`} 
        style={{
          backgroundImage: `linear-gradient(to right, ${isDark ? '#ffffff' : '#000000'} 1px, transparent 1px), linear-gradient(to bottom, ${isDark ? '#ffffff' : '#000000'} 1px, transparent 1px)`,
          backgroundSize: '4rem 4rem'
        }}
      ></div>

      {/* Floating Squares */}
      <div className={`absolute top-[25%] left-[12%] w-8 h-8 border z-0 transition-colors duration-300 ${isDark ? 'border-white/10' : 'border-black/10'}`}></div>
      <div className={`absolute top-[35%] left-[8%] w-6 h-6 border z-0 transition-colors duration-300 ${isDark ? 'border-white/10' : 'border-black/10'}`}></div>
      <div className={`absolute top-[15%] right-[28%] w-10 h-10 border z-0 transition-colors duration-300 ${isDark ? 'border-white/10' : 'border-black/10'}`}></div>
      <div className={`absolute top-[40%] right-[12%] w-12 h-12 border z-0 transition-colors duration-300 ${isDark ? 'border-white/10' : 'border-black/10'}`}></div>
      <div className={`absolute top-[25%] right-[5%] w-6 h-6 border z-0 transition-colors duration-300 ${isDark ? 'border-white/10' : 'border-black/10'}`}></div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full max-w-[360px] mx-auto px-4 py-12">
        
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <img src={isDark ? "/logo.png" : "/logo-light-theme.png"} alt="Sucena Logo" className={`h-16 object-contain drop-shadow-md transition-all duration-300`} />
        </div>

        {/* Forms & States */}
        {viewState === 'LOGIN' && (
          <form className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500" onSubmit={handleLogin}>
            <div>
              <input 
                type="email" 
                placeholder="E-mail" 
                className={inputClass} 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Senha" 
                className={passwordInputClass} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors ${isDark ? 'text-white/40 hover:text-white/80' : 'text-black/40 hover:text-black/80'}`}
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            
            <div className="flex items-center gap-2 mt-2 mb-2">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className={`w-3.5 h-3.5 rounded border-white/10 bg-white/5 accent-[#eab308] focus:ring-0 focus:ring-offset-0 transition-colors cursor-pointer`}
              />
              <label htmlFor="rememberMe" className={`text-xs select-none cursor-pointer ${isDark ? 'text-white/60 hover:text-white/80' : 'text-black/60 hover:text-black/80'} transition-colors`}>
                Lembrar-me
              </label>
            </div>

            {errorMessage && (
              <div className="text-red-500 text-xs text-center font-medium bg-red-500/10 py-2 rounded-md border border-red-500/20">
                {errorMessage}
              </div>
            )}

            <button type="submit" className={btnClass} disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Entrar'}
            </button>
            
            <div className="flex flex-col items-center gap-4 mt-6">
              <a href="#" className={linkClass}>
                Esqueceu a senha?
              </a>
              <p className={`text-xs ${isDark ? 'text-white/60' : 'text-black/60'}`}>
                Não tem uma conta?{' '}
                <span className={linkClass} onClick={() => {
                  setErrorMessage('')
                  !isLoading && setViewState('REGISTER')
                }}>Cadastre-se</span>
              </p>
            </div>
          </form>
        )}

        {viewState === 'REGISTER' && (
          <form className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500" onSubmit={handleSignUp}>
            <div>
              <input 
                type="text" 
                placeholder="Nome Completo" 
                className={inputClass} 
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <input 
                type="email" 
                placeholder="E-mail" 
                className={inputClass} 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <input 
                type="text" 
                placeholder="Número de WhatsApp" 
                className={inputClass} 
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <input 
                type="text" 
                placeholder="Cargo" 
                className={inputClass} 
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Senha" 
                className={passwordInputClass} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors ${isDark ? 'text-white/40 hover:text-white/80' : 'text-black/40 hover:text-black/80'}`}
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {errorMessage && (
              <div className="text-red-500 text-xs text-center font-medium bg-red-500/10 py-2 rounded-md border border-red-500/20">
                {errorMessage}
              </div>
            )}

            <button type="submit" className={btnClass} disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Cadastrar'}
            </button>
            
            <div className="flex flex-col items-center gap-4 mt-6">
              <p className={`text-xs ${isDark ? 'text-white/60' : 'text-black/60'}`}>
                Já tem uma conta?{' '}
                <span className={linkClass} onClick={() => {
                  setErrorMessage('')
                  !isLoading && setViewState('LOGIN')
                }}>Entre agora</span>
              </p>
            </div>
          </form>
        )}

        {viewState === 'SUCCESS' && (
          <div className="w-full flex flex-col items-center justify-center space-y-6 text-center animate-in zoom-in-95 duration-500 py-8">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'} mb-2`}>
              <CheckCircle2 size={40} />
            </div>
            
            <div className="space-y-2">
              <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Cadastro Concluído!
              </h2>
              <p className={`text-sm px-4 leading-relaxed ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                Sua conta foi criada com sucesso. Verifique seu e-mail para confirmação se necessário.
              </p>
            </div>

            <button 
              onClick={() => setViewState('LOGIN')}
              className={`w-full max-w-[280px] rounded-lg px-4 py-3 text-sm font-medium transition-all mt-6 border ${
                isDark
                  ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500/50 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                  : 'bg-emerald-500 hover:bg-emerald-600 border-transparent text-white shadow-md'
              }`}
            >
              Fazer Login Agora
            </button>
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 w-full p-6 flex justify-between items-center z-10">
        <div className="w-[64px]"></div> {/* Spacer */}
        
        <p className={`text-[11px] flex-1 text-center font-light transition-colors ${isDark ? 'text-white/40' : 'text-black/40'}`}>
          © 2026 Sucena Empreendimentos. Todos os direitos reservados.
        </p>

        <div className="w-[64px] flex justify-end">
          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </div>

    </div>
  )
}
