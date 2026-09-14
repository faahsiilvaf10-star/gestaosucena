import { useState } from 'react'
import { Loader2, ArrowLeft, KeyRound } from 'lucide-react'

export const DRIVERS = [
  { id: 'EM', name: 'EDIELSON MARINHO MENDES' },
  { id: 'ED', name: 'ENISON DA SILVA SANTOS' },
  { id: 'JB', name: 'JOÃO BOSCO DA SILVA COSTA' },
  { id: 'JC', name: 'JOÃO CARLOS PAIXÃO MELO' },
  { id: 'RG', name: 'RICELIO GONÇALVES CARDOSO' },
  { id: 'AD', name: 'ANDERSON DA CRUZ PINHEIRO' },
  { id: 'FG', name: 'FABIO GENILSON FERNANDES DOS REMEDIOS' },
  { id: 'PF', name: 'PAULO FELIX CARDOSO' }
]

export default function LoginStep({ onLogin }: { onLogin: () => void }) {
  const [selectedDriver, setSelectedDriver] = useState<typeof DRIVERS[0] | null>(null)
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDriver) return
    
    if (pin.length < 4) {
      setError('O código deve ter 4 dígitos')
      return
    }

    setLoading(true)
    setError('')
    
    // Simular delay de rede
    await new Promise(r => setTimeout(r, 600))

    if (pin === '0000') {
      localStorage.setItem('app_motorista_driver', JSON.stringify(selectedDriver))
      localStorage.setItem('app_motorista_current_step', 'environment')
      onLogin()
    } else {
      setError('Código inválido')
    }
    
    setLoading(false)
  }

  if (selectedDriver) {
    return (
      <div className="min-h-full flex flex-col bg-[#0A0A0A] text-white p-6 relative">
        <button 
          onClick={() => {
            setSelectedDriver(null)
            setPin('')
            setError('')
          }} 
          className="text-gray-400 active:text-white mb-8 flex items-center gap-2"
        >
          <ArrowLeft size={20} /> Voltar
        </button>

        <div className="flex-1 flex flex-col items-center justify-center -mt-10">
          <div className="w-20 h-20 bg-slate-600 rounded-full flex items-center justify-center mb-4 text-2xl font-bold shadow-lg">
            {selectedDriver.id}
          </div>
          <h2 className="text-xl font-bold text-center mb-1">{selectedDriver.name}</h2>
          <p className="text-gray-400 mb-8 text-sm">Digite seu código de acesso</p>

          <form onSubmit={handleLogin} className="w-full max-w-xs space-y-6">
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
              <input 
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full h-16 pl-12 pr-4 bg-zinc-900 border border-zinc-800 rounded-2xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-2xl text-center tracking-[0.5em] transition-all shadow-sm"
                placeholder="****"
                disabled={loading}
                autoFocus
              />
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center font-medium animate-in fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || pin.length < 4}
              className="w-full h-14 bg-emerald-500 disabled:opacity-50 disabled:active:scale-100 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : 'ENTRAR'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full flex flex-col bg-[#0A0A0A] text-white">
      <div className="p-6 pb-4 border-b border-white/5 bg-white/5">
        <h1 className="text-2xl font-bold text-white mb-1">APP MOTORISTA</h1>
        <p className="text-gray-400 text-sm font-medium">Selecione o seu usuário para entrar</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 custom-scrollbar">
        {DRIVERS.map(driver => (
          <button
            key={driver.id}
            onClick={() => setSelectedDriver(driver)}
            className="w-full bg-transparent hover:bg-white/5 p-3 rounded-2xl flex items-center gap-4 transition-colors text-left group"
          >
            <div className="w-14 h-14 rounded-full bg-[#4A5568] flex items-center justify-center font-bold text-white text-lg shrink-0 group-active:scale-95 transition-transform">
              {driver.id}
            </div>
            <div className="flex-1">
              <span className="text-gray-200 font-bold text-sm leading-tight block">
                {driver.name}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
