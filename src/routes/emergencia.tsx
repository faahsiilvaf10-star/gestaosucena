import { createFileRoute } from '@tanstack/react-router'
import { 
  Phone, PhoneCall, Heart, Flame, Leaf, Bug, Info, MapPin, 
  Antenna
} from 'lucide-react'

export const Route = createFileRoute('/emergencia')({
  component: EmergenciaComponent,
})

function EmergenciaComponent() {
  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Top Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Comunicação Interna */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-xl font-bold">
            <Antenna className="w-6 h-6" />
            <h2>Comunicação Interna</h2>
          </div>
          <div className="bg-card border rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rádio Comunicador</p>
                <p className="text-2xl font-bold text-destructive mt-1">BOTÃO VERMELHO</p>
              </div>
              <div className="bg-destructive/10 p-4 rounded-full">
                <Antenna className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </div>
          <div className="bg-card border rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telefone Fixo</p>
                <p className="text-2xl font-bold mt-1">Ramal 9100</p>
              </div>
              <div className="bg-secondary p-4 rounded-full">
                <Phone className="w-6 h-6 text-foreground" />
              </div>
            </div>
          </div>
        </div>

        {/* Celulares de Emergência */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-xl font-bold text-green-600 dark:text-green-500">
            <PhoneCall className="w-6 h-6" />
            <h2>Celulares de Emergência</h2>
          </div>
          <div className="bg-card border rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Emergência 1</p>
                <p className="text-2xl font-bold mt-1">(91) 99207-1008</p>
              </div>
              <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full">
                <PhoneCall className="w-6 h-6 text-green-600 dark:text-green-500" />
              </div>
            </div>
          </div>
          <div className="bg-card border rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Emergência 2</p>
                <p className="text-2xl font-bold mt-1">(91) 98871-7520</p>
              </div>
              <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full">
                <PhoneCall className="w-6 h-6 text-green-600 dark:text-green-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tipos de Ocorrência */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2 text-xl font-bold">
          <Info className="w-6 h-6 text-muted-foreground" />
          <h2>Tipos de Ocorrência Atendidos</h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Médica */}
          <div className="bg-card border border-destructive/20 rounded-2xl p-6 text-center hover:shadow-md transition-all group">
            <div className="bg-destructive/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <Heart className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="font-bold text-destructive text-lg">Médica</h3>
            <p className="text-sm text-muted-foreground mt-1">Acidentes e Mal súbito</p>
          </div>

          {/* Incêndio */}
          <div className="bg-card border border-orange-500/20 rounded-2xl p-6 text-center hover:shadow-md transition-all group">
            <div className="bg-orange-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <Flame className="w-8 h-8 text-orange-500" />
            </div>
            <h3 className="font-bold text-orange-500 text-lg">Incêndio</h3>
            <p className="text-sm text-muted-foreground mt-1">Fogo e Explosões</p>
          </div>

          {/* Ambiental */}
          <div className="bg-card border border-green-600/20 rounded-2xl p-6 text-center hover:shadow-md transition-all group">
            <div className="bg-green-600/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <Leaf className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="font-bold text-green-600 text-lg">Ambiental</h3>
            <p className="text-sm text-muted-foreground mt-1">Vazamentos e Danos</p>
          </div>

          {/* Fauna */}
          <div className="bg-card border border-yellow-600/20 rounded-2xl p-6 text-center hover:shadow-md transition-all group">
            <div className="bg-yellow-600/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <Bug className="w-8 h-8 text-yellow-600" />
            </div>
            <h3 className="font-bold text-yellow-600 text-lg">Fauna</h3>
            <p className="text-sm text-muted-foreground mt-1">Captura de Animais</p>
          </div>
        </div>
      </div>

      {/* Ponto de Encontro */}
      <div className="pt-4 pb-8">
        <div className="bg-[#1a8b44] text-white rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between shadow-lg relative overflow-hidden">
          
          <div className="flex items-center space-x-6 relative z-10 w-full">
            <div className="bg-white/20 p-5 rounded-full flex-shrink-0">
              <MapPin className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-wide uppercase">Ponto de Encontro</h2>
              <p className="text-white/90 text-base md:text-lg mt-1 font-medium">
                Dirija-se a este local em caso de evacuação.
              </p>
            </div>
          </div>
          
          <div className="mt-6 md:mt-0 relative z-10 flex-shrink-0 md:ml-4">
            <div className="bg-white text-[#1a8b44] w-24 h-24 rounded-full flex items-center justify-center text-5xl font-black shadow-inner">
              33
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
