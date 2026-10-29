import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

export function DailyPipasAlertModal({ enabled }: { enabled: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pipas, setPipas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return

    const checkTime = async () => {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, 5 = Friday
      // Exibe na primeira entrada autenticada do dia útil, independentemente do horário.
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const todayStr = format(now, 'yyyy-MM-dd');
        const lastShown = localStorage.getItem('last_pipas_alert_date');
        
        if (lastShown !== todayStr) {
          // Mostrar o alerta
          setLoading(true);
          try {
            const { data, error } = await supabase
              .from('eq_equipments').select('id, name, plate_tag').eq('environment', typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena')
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
  }, [enabled]);

    if (!isOpen) return null;

  return (
    <div className="comunicado-overlay" role="dialog" aria-modal="true">
      <div className="comunicado flex flex-col max-h-[90vh]">
        <img src="/logo-relatorio.png" alt="Sucena" className="comunicado-logo" />

        <div className="comunicado-titulo">
          <span className="comunicado-icone" aria-hidden="true">
            📢
          </span>
          <div className="min-w-0">
            <h2 className="m-0 p-0 text-[22px] font-[800] leading-tight text-[#111111]">Comunicado Diário</h2>
            <p className="text-gray-500 font-semibold text-xs mt-0.5">Status dos Caminhões Pipa na Obra</p>
          </div>
        </div>

        <div className="comunicado-conteudo overflow-y-auto custom-scrollbar flex-1">
          <p className="text-gray-700 text-sm mb-3">
            Abaixo estão listados os Caminhões Pipa que se encontram <strong>dentro da obra</strong> no momento:
          </p>

          {loading ? (
            <div className="text-center text-gray-500 py-4 animate-pulse">Carregando informações...</div>
          ) : pipas.length === 0 ? (
            <div className="bg-gray-100 text-center p-6 rounded-2xl border border-gray-200">
              <span className="text-2xl block mb-2">🚛</span>
              <p className="text-gray-600 font-medium text-sm">
                Nenhum Caminhão Pipa está dentro da obra neste momento.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1 custom-scrollbar">
              {pipas.map((p, i) => (
                <div key={p.id || i} className="flex items-center justify-between bg-amber-50/60 border border-amber-200/60 p-3 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#b8860b] text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {i + 1}
                    </div>
                    <div>
                      <h4 className="font-bold text-[#111111] text-sm">{p.name}</h4>
                      <p className="text-xs text-gray-500 uppercase">TAG / Placa: {p.plate_tag || 'S/ Placa'}</p>
                    </div>
                  </div>
                  <div className="text-[11px] bg-green-100 text-green-700 font-bold px-2 py-1 rounded-full">
                    Dentro
                  </div>
                </div>
              ))}
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-sm">
                <span className="text-gray-500 font-medium">Total de pipas dentro:</span>
                <span className="font-bold text-lg text-[#b8860b]">{pipas.length}</span>
              </div>
            </div>
          )}
        </div>

        <div className="comunicado-rodape">
          <div className="comunicado-acoes justify-end">
            <button 
              type="button"
              onClick={() => setIsOpen(false)}
              className="comunicado-botao-entendi w-full sm:w-auto"
            >
              Entendi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
