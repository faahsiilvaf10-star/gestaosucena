import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Droplet, X } from 'lucide-react';
import { format } from 'date-fns';

export function DailyPipasAlertModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [pipas, setPipas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkTime = async () => {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, 5 = Friday
      const hours = now.getHours();
      
      // Segunda a Sexta e hora = 8
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && hours === 8) {
        const todayStr = format(now, 'yyyy-MM-dd');
        const lastShown = localStorage.getItem('last_pipas_alert_date');
        
        if (lastShown !== todayStr) {
          // Mostrar o alerta
          setLoading(true);
          try {
            const { data, error } = await supabase
              .from('eq_equipments').select('*').eq('environment', typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena')
              .ilike('name', 'CP%')
              .eq('location_status', 'inside')
              .order('name');
              
            if (!error && data) {
              setPipas(data || []);
              setIsOpen(true);
              localStorage.setItem('last_pipas_alert_date', todayStr);
            }
          } catch (e) {
            console.error('Erro ao buscar pipas', e);
          } finally {
            setLoading(false);
          }
        }
      }
    };

    // Checar imediatamente e depois a cada minuto
    checkTime();
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1e1e1e] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        <div className="bg-blue-600 p-6 flex flex-col items-center relative text-white">
          <button 
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
            <Droplet size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-display font-bold text-center">Comunicado Diário</h2>
          <p className="text-blue-100 font-medium text-center mt-1">Status dos Caminhões Pipa na Obra</p>
        </div>

        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300 text-sm mb-4">
            Abaixo estão listados os Caminhões Pipa que se encontram <strong>dentro da obra</strong> no momento:
          </p>

          {loading ? (
            <div className="text-center text-gray-500 py-4 animate-pulse">Carregando informações...</div>
          ) : pipas.length === 0 ? (
            <div className="bg-gray-100 dark:bg-black/20 text-center p-6 rounded-2xl border border-gray-200 dark:border-white/5">
              <span className="text-2xl block mb-2">🚛</span>
              <p className="text-gray-600 dark:text-gray-400 font-medium text-sm">
                Nenhum Caminhão Pipa está dentro da obra neste momento.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {pipas.map((p, i) => (
                <div key={p.id || i} className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 p-4 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {i + 1}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-base">{p.name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 uppercase">TAG / Placa: {p.plate_tag || 'S/ Placa'}</p>
                    </div>
                  </div>
                  <div className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold px-3 py-1 rounded-full">
                    Dentro
                  </div>
                </div>
              ))}
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 flex justify-between items-center text-sm">
                <span className="text-gray-500 dark:text-gray-400 font-medium">Total de pipas dentro:</span>
                <span className="font-bold text-lg text-blue-600 dark:text-blue-400">{pipas.length}</span>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button 
              onClick={() => setIsOpen(false)}
              className="bg-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-700 transition-colors w-full"
            >
              Ciente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
