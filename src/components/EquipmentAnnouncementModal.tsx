import React, { useEffect, useState } from 'react';
import { X, ArrowRightCircle, ArrowLeftCircle, User, Clock, Info, MapPin } from 'lucide-react';

interface EquipmentAnnouncementModalProps {
  announcement: {
    type: 'entry' | 'exit';
    eq: any;
    move: any;
  };
  onClose: () => void;
  isDark: boolean;
}

export function EquipmentAnnouncementModal({ announcement, onClose, isDark }: EquipmentAnnouncementModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { type, eq, move } = announcement;
  
  useEffect(() => {
    // Trigger entrance animation
    setTimeout(() => setIsVisible(true), 10);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // match transition duration
  };

  const vehicleName = (eq?.name || '').toUpperCase();
  const isMunck = vehicleName.startsWith('CM');
  const isOnibus = vehicleName.startsWith('OB');
  const truckImage = isMunck ? '/logomunk.png?v=1' : (isOnibus ? '/logoonibus.png?v=1' : '/logopipa.png?v=2');

  const title = type === 'exit' ? 'SAÍDA DE EQUIPAMENTO' : 'ENTRADA DE EQUIPAMENTO';
  const Icon = type === 'exit' ? ArrowRightCircle : ArrowLeftCircle;
  const colorBase = type === 'exit' ? 'yellow' : 'green';
  const colorHex = type === 'exit' ? '#D6A72B' : '#10b981';

  return (
    <div className={`fixed inset-0 z-[200] flex items-center justify-center p-4 transition-all duration-300 ${isVisible ? 'opacity-100 backdrop-blur-md bg-black/60' : 'opacity-0 bg-transparent pointer-events-none'}`}>
      <div 
        className={`relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl transition-all duration-500 transform ${isVisible ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-8 opacity-0'} ${isDark ? 'bg-[#121214] border border-white/10' : 'bg-white border border-gray-200'}`}
      >
        {/* Header Bar */}
        <div className={`p-5 flex items-center justify-between border-b ${isDark ? 'border-white/5 bg-white/5' : 'border-gray-100 bg-gray-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl flex items-center justify-center`} style={{ backgroundColor: `${colorHex}20`, color: colorHex }}>
              <Icon size={24} strokeWidth={2.5} />
            </div>
            <h2 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {title}
            </h2>
          </div>
          <button 
            onClick={handleClose}
            className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-900'}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Image Container */}
          <div className="relative w-full rounded-2xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center shadow-inner border border-black/5 dark:border-white/5 p-4">
            <img 
              src={truckImage} 
              alt={vehicleName}
              className="w-full h-auto object-contain max-h-[160px]"
            />
            
            {/* Overlay Gradient for premium feel */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            
            {/* Equipment Name Badge */}
            <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md text-white px-3 py-1.5 rounded-lg font-bold text-sm border border-white/20 shadow-lg">
              {vehicleName}
            </div>
            
            {/* Plate Badge */}
            {eq?.plate_tag && (
              <div className="absolute top-3 right-3 bg-white text-gray-900 px-3 py-1 rounded-md font-mono font-bold text-xs border border-gray-300 shadow-sm flex flex-col items-center leading-none">
                <span className="text-[8px] text-blue-600 font-sans tracking-widest mb-0.5">BRASIL</span>
                {eq.plate_tag}
              </div>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Operator/Author */}
            <div className={`p-4 rounded-2xl flex flex-col gap-1.5 ${isDark ? 'bg-white/5 border border-white/5' : 'bg-gray-50 border border-gray-100'}`}>
              <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <User size={14} />
                Registrado por
              </div>
              <div className={`font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {move?.created_by || 'Sistema'}
              </div>
            </div>

            {/* Time */}
            <div className={`p-4 rounded-2xl flex flex-col gap-1.5 ${isDark ? 'bg-white/5 border border-white/5' : 'bg-gray-50 border border-gray-100'}`}>
              <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <Clock size={14} />
                Horário
              </div>
              <div className={`font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {new Date(move?.created_at || new Date()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            {/* Specific fields depending on type */}
            {type === 'exit' && (
              <>
                <div className={`col-span-2 p-4 rounded-2xl flex flex-col gap-1.5 ${isDark ? 'bg-white/5 border border-white/5' : 'bg-gray-50 border border-gray-100'}`}>
                  <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <Info size={14} />
                    Motivo da Saída
                  </div>
                  <div className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {move?.exit_reason || eq?.last_exit_reason || 'Não informado'}
                  </div>
                  {(move?.description || eq?.last_exit_description) && (
                    <div className={`text-sm mt-1 p-3 rounded-xl ${isDark ? 'bg-black/20 text-gray-300 border border-white/5' : 'bg-white text-gray-600 border border-gray-100 shadow-sm'}`}>
                      "{move?.description || eq?.last_exit_description}"
                    </div>
                  )}
                </div>
              </>
            )}
            
            {type === 'entry' && (
              <div className={`col-span-2 p-4 rounded-2xl flex items-center justify-center gap-3 ${isDark ? 'bg-white/5 border border-white/5' : 'bg-green-50 border border-green-100'}`}>
                <div className="p-2 bg-green-500/20 text-green-600 rounded-full">
                  <MapPin size={20} />
                </div>
                <div className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-green-900'}`}>
                  Equipamento encontra-se agora dentro da obra.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Action */}
        <div className={`p-5 border-t flex justify-end ${isDark ? 'border-white/5 bg-[#1a1a1c]' : 'border-gray-100 bg-gray-50'}`}>
          <button 
            onClick={handleClose}
            className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-sm transition-all focus:ring-2 focus:ring-offset-2 outline-none flex items-center justify-center gap-2`}
            style={{ 
              backgroundColor: colorHex, 
              color: type === 'exit' ? '#000' : '#fff' 
            }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
