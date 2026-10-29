import Moon from 'lucide-react/dist/esm/icons/moon.js';
import Sun from 'lucide-react/dist/esm/icons/sun.js';
import Eye from 'lucide-react/dist/esm/icons/eye.js';
import EyeOff from 'lucide-react/dist/esm/icons/eye-off.js';
import Loader2 from 'lucide-react/dist/esm/icons/loader-circle.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.js';
import Shield from 'lucide-react/dist/esm/icons/shield.js';
import UserCircle2 from 'lucide-react/dist/esm/icons/circle-user-round.js';
import Clock from 'lucide-react/dist/esm/icons/clock.js';
import Lock from 'lucide-react/dist/esm/icons/lock.js';
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { useTheme } from '../contexts/ThemeContext'
import { ThemeToggle } from '../components/ThemeToggle'
import { useNavigate, useRouter, createFileRoute } from '@tanstack/react-router'
import { Turnstile } from '@marsidev/react-turnstile'
import type { TurnstileInstance } from '@marsidev/react-turnstile'
import { getAvailableRoles } from '../lib/roles'
import { isRegistrationOpen } from '../lib/settings'
import { setDailySessionExpiry, clearDailySessionExpiry } from '../lib/sessionManager'
import { SucenaLoginTransition } from '../components/SucenaLoginTransition'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const navigate = useNavigate()
  const router = useRouter()
  const { isDark } = useTheme()
  const [viewState, setViewState] = useState<'LOGIN' | 'REGISTER' | 'SUCCESS' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD'>('LOGIN')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [showTransition, setShowTransition] = useState(false)
  const [authorizedUser, setAuthorizedUser] = useState({ name: '', role: '' })
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance>(null)
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAAFVuy_bi0rwvQAtr'
  const [availableRoles, setAvailableRoles] = useState<string[]>([])
  const [registrationOpen, setRegistrationOpen] = useState(true)

  const translateAuthError = (message: string) => {
    const errorMap: Record<string, string> = {
      'Invalid login credentials': 'Email ou senha inválidos.',
      'Email signups are disabled': 'O cadastro por email está desativado no momento.',
      'User already registered': 'Este e-mail já está cadastrado.',
      'Password should be at least 6 characters': 'A senha deve ter no mínimo 6 caracteres.',
      'To security reasons, your request has been blocked': 'Por motivos de segurança, sua requisição foi bloqueada.',
      'Email not confirmed': 'O e-mail ainda não foi confirmado.',
      'captcha protection': 'Falha na verificação de segurança do Turnstile. Tente novamente.',
      'invalid-input-secret': 'Chave secreta do Captcha não reconhecida pelo servidor.',
      'no captcha_token found': 'Aguarde a verificação do Turnstile antes de entrar.',
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
    if (savedEmail) {
      setEmail(savedEmail)
    }
    if (savedPassword) {
      setPassword(savedPassword)
      setRememberMe(true)
    } else {
      setPassword('')
      setRememberMe(false)
    }
    
    // Load dynamic roles
    getAvailableRoles().then(roles => setAvailableRoles(roles))
    
    // Load registration status
    isRegistrationOpen().then(isOpen => setRegistrationOpen(isOpen))
    // Check for password recovery hash or params
    if (window.location.hash.includes('type=recovery') || window.location.href.includes('type=recovery')) {
      setViewState('RESET_PASSWORD')
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setViewState('RESET_PASSWORD')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    if (!email) {
      toast.error('Preencha o campo de email.')
      return
    }

    setIsLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/',
    })
    setIsLoading(false)

    if (error) {
      const translatedError = translateAuthError(error.message)
      toast.error('Erro: ' + translatedError)
      setErrorMessage(translatedError)
    } else {
      toast.success('Email de recuperação enviado!')
      setViewState('LOGIN')
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    if (!password || password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres.')
      return
    }

    setIsLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setIsLoading(false)

    if (error) {
      const translatedError = translateAuthError(error.message)
      toast.error('Erro ao redefinir: ' + translatedError)
      setErrorMessage(translatedError)
    } else {
      await supabase.auth.signOut().catch(() => {})
      clearDailySessionExpiry()
      toast.success('Senha redefinida com sucesso! Faça login com sua nova senha.')
      setViewState('LOGIN')
      // Clear hash and parameters from URL
      window.history.replaceState(null, '', window.location.pathname)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    if (!email || !password) {
      const msg = 'Preencha todos os campos.'
      toast.error(msg)
      setErrorMessage(msg)
      return
    }
    
    if (!captchaToken) {
      const msg = 'Aguarde a validação do Cloudflare Turnstile.'
      toast.error(msg)
      setErrorMessage(msg)
      return
    }

    setIsLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: {
        captchaToken,
      }
    })
    setIsLoading(false)

    if (error) {
      turnstileRef.current?.reset()
      setCaptchaToken(null)
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
      setDailySessionExpiry()
      toast.success('Login realizado com sucesso!')
      
      const userMeta = data.user?.user_metadata
      const resolvedUserName = userMeta?.full_name || userMeta?.name || userMeta?.nome || email.split('@')[0]
      if (resolvedUserName) {
        localStorage.setItem('sucena_user_name', resolvedUserName)
      }
      if (!localStorage.getItem('sucena_environment')) {
        localStorage.setItem('sucena_environment', 'barcarena')
      }

      // Ativa flag para efeito Fade no Dashboard e pré-carrega rota
      try {
        sessionStorage.setItem('sucena_login_transition', 'true')
        router.preloadRoute({ to: '/dashboard' }).catch(() => {})
      } catch (_) {}

      // Tocar som de entrada ao iniciar a transição para o Dashboard
      try {
        if (typeof window !== 'undefined') {
          (window as any).__last_entry_sound_at = Date.now()
          const audio = new Audio('/Som_entrada.mp3')
          audio.volume = 0.85
          audio.play().catch(err => console.warn('Autoplay do som de entrada bloqueado pelo navegador:', err))
        }
      } catch (err) {
        console.warn('Erro ao inicializar som de entrada:', err)
      }
      setShowTransition(true)
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
    
    if (!captchaToken) {
      const msg = 'Aguarde a validação do Cloudflare Turnstile.'
      toast.error(msg)
      setErrorMessage(msg)
      return
    }

    setIsLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        captchaToken,
        data: {
          full_name: nome,
          whatsapp: whatsapp,
          role: cargo,
        }
      }
    })
    setIsLoading(false)

    if (error) {
      turnstileRef.current?.reset()
      setCaptchaToken(null)
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
      ? '!bg-[#27272a] hover:!bg-[#3f3f46] !border-white/5 !text-white'
      : '!bg-gray-900 hover:!bg-gray-800 !border-transparent !text-white shadow-sm'
  }`

  const linkClass = `text-sm transition-colors cursor-pointer select-none ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`

  return (
    <div
      className={`min-h-screen w-full flex flex-col relative overflow-hidden font-sans transition-colors duration-300 ${
        showTransition ? '!bg-[#070709]' : ''
      }`}
      style={showTransition ? { background: '#070709' } : undefined}
    >
      {showTransition && (
        <SucenaLoginTransition
          onComplete={() => {
            navigate({ to: '/dashboard', replace: true })
          }}
        />
      )}

      {/* Main Content - totalmente oculto durante a transição para nunca vazar a tela de login */}
      {!showTransition && (
        <>
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
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors ${isDark ? 'text-white/70 hover:text-white/70' : 'text-black/40 hover:text-black/80'}`}
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
              <label htmlFor="rememberMe" className={`text-xs select-none cursor-pointer ${isDark ? 'text-white/70 hover:text-white/70' : 'text-black/60 hover:text-black/80'} transition-colors`}>
                Lembrar-me
              </label>
            </div>

            {errorMessage && (
              <div className="text-red-500 text-xs text-center font-medium bg-red-500/10 py-2 rounded-md border border-red-500/20">
                {errorMessage}
              </div>
            )}

            <div className="flex justify-center my-4 min-h-[65px]">
              <Turnstile 
                ref={turnstileRef}
                siteKey={turnstileSiteKey}
                onSuccess={(token) => {
                  setCaptchaToken(token)
                  setErrorMessage('')
                }}
                onError={() => {
                  setErrorMessage('Erro na verificação do Cloudflare Turnstile.')
                }}
                onExpire={() => setCaptchaToken(null)}
                options={{
                  theme: isDark ? 'dark' : 'light'
                }}
              />
            </div>

            <button type="submit" className={btnClass} style={{ backgroundColor: isDark ? '#27272a' : '#111827', color: '#ffffff' }} disabled={isLoading || !captchaToken}>
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : !captchaToken ? 'Aguardando verificação...' : 'Entrar'}
            </button>
            
            <div className="flex flex-col items-center gap-4 mt-6">
              <button type="button" className={`${linkClass} p-2`} onClick={() => {
                setErrorMessage('')
                setViewState('FORGOT_PASSWORD')
              }}>
                Esqueceu a senha?
              </button>
              {registrationOpen ? (
                <div className={`text-xs flex items-center gap-1 ${isDark ? 'text-white/70' : 'text-black/60'}`}>
                  <span>Não tem uma conta?</span>
                  <button type="button" className={`${linkClass} p-2 font-medium`} onClick={() => {
                    setErrorMessage('')
                    !isLoading && setViewState('REGISTER')
                  }}>
                    Cadastre-se
                  </button>
                </div>
              ) : (
                <p className={`text-xs ${isDark ? 'text-white/70' : 'text-black/40'}`}>
                  A criação de novas contas está temporariamente desativada.
                </p>
              )}
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
            <div className="relative">
              <select 
                className={`${inputClass} appearance-none`}
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                disabled={isLoading}
              >
                <option value="" disabled hidden>Selecione um Cargo</option>
                {availableRoles.map(roleOption => (
                  <option key={roleOption} value={roleOption}>{roleOption}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
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
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors ${isDark ? 'text-white/70 hover:text-white/70' : 'text-black/40 hover:text-black/80'}`}
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

            <div className="flex justify-center my-4 min-h-[65px]">
              <Turnstile 
                siteKey={turnstileSiteKey}
                onSuccess={(token) => {
                  setCaptchaToken(token)
                  setErrorMessage('')
                }}
                onError={() => {
                  setErrorMessage('Erro na verificação do Cloudflare Turnstile.')
                }}
                onExpire={() => setCaptchaToken(null)}
                options={{
                  theme: isDark ? 'dark' : 'light'
                }}
              />
            </div>




            <button type="submit" className={btnClass} style={{ backgroundColor: isDark ? '#27272a' : '#111827', color: '#ffffff' }} disabled={isLoading || !captchaToken}>
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : !captchaToken ? 'Aguardando verificação...' : 'Cadastrar'}
            </button>
            
            <div className="flex flex-col items-center gap-4 mt-6">
              <div className={`text-xs flex items-center gap-1 ${isDark ? 'text-white/70' : 'text-black/60'}`}>
                <span>Já tem uma conta?</span>
                <button type="button" className={`${linkClass} p-2 font-medium`} onClick={() => {
                  setErrorMessage('')
                  !isLoading && setViewState('LOGIN')
                }}>
                  Entre agora
                </button>
              </div>
            </div>
          </form>
        )}

        {viewState === 'SUCCESS' && (
          <div className="w-full flex flex-col items-center justify-center space-y-6 text-center animate-in zoom-in-95 duration-500 py-8">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'} mb-2`}>
              <CheckCircle2 size={40} />
            </div>
            
            <div className="space-y-2">
              <h2 className={`text-2xl font-bold ${isDark ? 'text-[#1c1d21] dark:text-white' : 'text-gray-900'}`}>
                Cadastro Concluído!
              </h2>
              <p className={`text-sm px-4 leading-relaxed ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
                Sua conta foi criada com sucesso. Verifique seu e-mail para confirmação se necessário.
              </p>
            </div>

            <button 
              onClick={() => setViewState('LOGIN')}
              className={`w-full max-w-[280px] rounded-lg px-4 py-3 text-sm font-medium transition-all mt-6 border ${ isDark ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500/50 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-emerald-500 hover:bg-emerald-600 border-transparent text-white shadow-md' }`}
            >
              Fazer Login Agora
            </button>
          </div>
        )}

        {viewState === 'FORGOT_PASSWORD' && (
          <form className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500" onSubmit={handleForgotPassword}>
            <div>
              <p className={`text-sm mb-4 text-center ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
                Digite o e-mail associado à sua conta. Enviaremos um link para você redefinir sua senha.
              </p>
              <input 
                type="email" 
                placeholder="E-mail de recuperação" 
                className={inputClass} 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {errorMessage && (
              <div className="text-red-500 text-xs text-center font-medium bg-red-500/10 py-2 rounded-md border border-red-500/20">
                {errorMessage}
              </div>
            )}

            <button type="submit" className={btnClass} style={{ backgroundColor: isDark ? '#27272a' : '#111827', color: '#ffffff' }} disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Enviar Link de Recuperação'}
            </button>
            
            <div className="flex flex-col items-center gap-4 mt-6">
              <div className={`text-xs flex items-center gap-1 ${isDark ? 'text-white/70' : 'text-black/60'}`}>
                <span>Lembrou sua senha?</span>
                <button type="button" className={`${linkClass} p-2 font-medium`} onClick={() => {
                  setErrorMessage('')
                  !isLoading && setViewState('LOGIN')
                }}>
                  Voltar para o Login
                </button>
              </div>
            </div>
          </form>
        )}

        {viewState === 'RESET_PASSWORD' && (
          <form className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500" onSubmit={handleResetPassword}>
            <div>
              <h3 className={`text-lg font-semibold text-center mb-4 ${isDark ? 'text-[#1c1d21] dark:text-white' : 'text-gray-900'}`}>
                Redefinir Senha
              </h3>
              <p className={`text-sm mb-4 text-center ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
                Digite a sua nova senha abaixo.
              </p>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Nova Senha" 
                  className={passwordInputClass} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors ${isDark ? 'text-white/70 hover:text-white/70' : 'text-black/40 hover:text-black/80'}`}
                  title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="text-red-500 text-xs text-center font-medium bg-red-500/10 py-2 rounded-md border border-red-500/20">
                {errorMessage}
              </div>
            )}

            <button type="submit" className={btnClass} style={{ backgroundColor: isDark ? '#27272a' : '#111827', color: '#ffffff' }} disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Salvar Nova Senha'}
            </button>
          </form>
        )}

      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 w-full p-6 flex justify-between items-center z-10">
        <div className="w-[64px]"></div> {/* Spacer */}
        
        <p className={`text-[11px] flex-1 text-center font-light transition-colors ${isDark ? 'text-white/70' : 'text-black/40'}`}>
          © 2026 Sucena Empreendimentos. Todos os direitos reservados.
        </p>

        <div className="w-[64px] flex justify-end">
          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </div>
        </>
      )}

    </div>
  )
}


