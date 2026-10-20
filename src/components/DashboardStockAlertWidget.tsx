import AlertTriangle from 'lucide-react/dist/esm/icons/triangle-alert.js';
import Package from 'lucide-react/dist/esm/icons/package.js';
import PackageX from 'lucide-react/dist/esm/icons/package-x.js';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import Send from 'lucide-react/dist/esm/icons/send.js';
import MapPin from 'lucide-react/dist/esm/icons/map-pin.js';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw.js';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link.js';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { sendStockMinAlertWhatsappNotification } from '../lib/whatsappHelpers';

interface StockAlertItem {
  id: string;
  name: string;
  internal_code: string | null;
  location: string | null;
  current_quantity: number;
  min_stock: number;
  unit_of_measure: string;
  category_name?: string | null;
  isOut: boolean; // estoque zerado / acabou
  isLow: boolean; // estoque acabando (<= min_stock)
}

export function DashboardStockAlertWidget() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'out' | 'low'>('all');
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const [showConfirmWhatsapp, setShowConfirmWhatsapp] = useState(false);

  const fetchStockAlerts = async () => {
    try {
      const env = typeof window !== 'undefined'
        ? localStorage.getItem('sucena_environment') || 'barcarena'
        : 'barcarena';

      const { data, error } = await supabase
        .from('al_products')
        .select(`
          id,
          name,
          internal_code,
          location,
          current_quantity,
          min_stock,
          unit_of_measure,
          status,
          environment,
          al_categories(name)
        `)
        .eq('environment', env)
        .or('status.eq.Ativo,status.is.null');

      if (!error && data) {
        setProducts(data);
      }
    } catch (err) {
      console.error('Erro ao buscar alertas de estoque no dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockAlerts();

    // Inscrição em tempo real para alterações em al_products
    const channel = supabase.channel('dash_stock_alerts_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'al_products' }, () => {
        fetchStockAlerts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const alertItems: StockAlertItem[] = useMemo(() => {
    const list: StockAlertItem[] = [];

    products.forEach((p) => {
      const qty = Number(p.current_quantity) || 0;
      const min = Number(p.min_stock) || 0;

      const isOut = qty <= 0;
      const isLow = qty > 0 && min > 0 && qty <= min;

      if (isOut || isLow) {
        list.push({
          id: p.id,
          name: p.name,
          internal_code: p.internal_code,
          location: p.location,
          current_quantity: qty,
          min_stock: min,
          unit_of_measure: p.unit_of_measure || 'UN',
          category_name: p.al_categories?.name || null,
          isOut,
          isLow,
        });
      }
    });

    // Ordenar: primeiro os esgotados (zerados), depois pela menor quantidade
    return list.sort((a, b) => {
      if (a.isOut && !b.isOut) return -1;
      if (!a.isOut && b.isOut) return 1;
      return a.current_quantity - b.current_quantity;
    });
  }, [products]);

  const outOfStockCount = useMemo(() => alertItems.filter(i => i.isOut).length, [alertItems]);
  const lowStockCount = useMemo(() => alertItems.filter(i => i.isLow).length, [alertItems]);

  const filteredItems = useMemo(() => {
    if (filterType === 'out') return alertItems.filter(i => i.isOut);
    if (filterType === 'low') return alertItems.filter(i => i.isLow);
    return alertItems;
  }, [alertItems, filterType]);

  const handleSendWhatsApp = async () => {
    if (alertItems.length === 0) return;
    setSendingWhatsapp(true);
    let sentCount = 0;
    let failedCount = 0;

    for (const item of alertItems) {
      try {
        const result = await sendStockMinAlertWhatsappNotification({
          productName: item.name,
          productCode: item.internal_code || undefined,
          location: item.location || undefined,
          currentQuantity: item.current_quantity,
          minStock: item.min_stock,
          unitOfMeasure: item.unit_of_measure,
        });

        if (result.success) {
          sentCount++;
        } else {
          failedCount++;
        }
      } catch {
        failedCount++;
      }
    }

    setSendingWhatsapp(false);

    if (sentCount > 0) {
      toast.success(`${sentCount} alerta(s) de estoque enviados no WhatsApp!`);
    }
    if (failedCount > 0 && sentCount === 0) {
      toast.error('Notificação de estoque mínimo desabilitada ou falhou. Verifique as configurações.');
    }
  };

  // Se não houver itens com estoque acabando ou acabado, esconde o card
  if (!loading && alertItems.length === 0) {
    return null;
  }

  return (
    <div className="bg-[#fff5f5] dark:bg-[#1a0f12] border border-red-200 dark:border-red-900/40 rounded-3xl p-6 flex flex-col h-full min-h-[400px] shadow-sm dark:shadow-2xl relative z-10 overflow-hidden transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 relative z-10 gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950/70 border border-red-200 dark:border-red-800/50 flex items-center justify-center shrink-0 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold text-[#1c1d21] dark:text-white tracking-tight">
                Alerta de Estoque Mínimo
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50">
                {alertItems.length} {alertItems.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
            <p className="text-xs text-red-700/80 dark:text-red-400/80 font-medium">
              {outOfStockCount > 0 && `${outOfStockCount} esgotado(s)`}
              {outOfStockCount > 0 && lowStockCount > 0 && ' • '}
              {lowStockCount > 0 && `${lowStockCount} abaixo do mínimo`}
            </p>
          </div>
        </div>

        {/* Botão de Notificação WhatsApp com confirmação */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowConfirmWhatsapp(true)}
            disabled={sendingWhatsapp || alertItems.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            title="Disparar aviso para o grupo do WhatsApp"
          >
            {sendingWhatsapp ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <Send size={13} />
            )}
            <span>Notificar WhatsApp</span>
          </button>
        </div>
      </div>

      {/* Filtros rápidos: Todos, Esgotados, Acabando */}
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-red-100 dark:border-red-900/30">
        <button
          type="button"
          onClick={() => setFilterType('all')}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            filterType === 'all'
              ? 'bg-red-600 text-white shadow-xs'
              : 'bg-white/80 dark:bg-black/20 text-gray-700 dark:text-gray-300 hover:bg-red-100 dark:hover:bg-red-950/40'
          }`}
        >
          Todos ({alertItems.length})
        </button>
        {outOfStockCount > 0 && (
          <button
            type="button"
            onClick={() => setFilterType('out')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterType === 'out'
                ? 'bg-red-700 text-white shadow-xs'
                : 'bg-white/80 dark:bg-black/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            Esgotados ({outOfStockCount})
          </button>
        )}
        {lowStockCount > 0 && (
          <button
            type="button"
            onClick={() => setFilterType('low')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'low'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white/80 dark:bg-black/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/40'
            }`}
          >
            Acabando ({lowStockCount})
          </button>
        )}
      </div>

      {/* Lista de Itens */}
      <div className="flex flex-col gap-2.5 flex-1 relative z-10 overflow-y-auto max-h-[380px] custom-scrollbar pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-500 animate-pulse">
            Carregando itens em alerta...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
            Nenhum item com este filtro.
          </div>
        ) : (
          filteredItems.slice(0, 10).map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
                item.isOut
                  ? 'bg-red-100/70 dark:bg-red-950/40 border-red-300 dark:border-red-800/60 shadow-xs'
                  : 'bg-white/80 dark:bg-white/[0.03] border-red-100 dark:border-red-900/30 hover:border-red-300'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    item.isOut
                      ? 'bg-red-600 text-white'
                      : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {item.isOut ? <PackageX size={18} /> : <Package size={18} />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-semibold text-[#1c1d21] dark:text-white truncate">
                      {item.name}
                    </p>
                    {item.isOut ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-red-600 text-white tracking-wider animate-pulse">
                        ZERADO
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60">
                        ACABANDO
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {item.internal_code && <span>Cód: {item.internal_code}</span>}
                    {item.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={10} /> {item.location}
                      </span>
                    )}
                    {item.category_name && (
                      <span className="text-gray-400">• {item.category_name}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quantidade atual / mínimo */}
              <div className="text-right shrink-0 pl-2">
                <p
                  className={`text-sm font-black ${
                    item.isOut
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {item.current_quantity}{' '}
                  <span className="text-xs font-medium text-gray-400">
                    / {item.min_stock} {item.unit_of_measure}
                  </span>
                </p>
                <p className="text-[10px] uppercase font-semibold text-gray-400">
                  {item.isOut ? 'Estoque esgotado' : 'Estoque mínimo'}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-red-200/70 dark:border-red-900/40 relative z-10 flex items-center justify-between gap-3">
        <div className="text-xs text-red-700/90 dark:text-red-300/80 font-medium">
          {alertItems.length > 10 ? `Mostrando 10 de ${alertItems.length} itens críticos` : 'Itens críticos identificados'}
        </div>
        <Link
          to="/almoxarifado/estoque"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-200 hover:underline cursor-pointer group"
        >
          <span>Ir para o Almoxarifado</span>
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Modal de Confirmação para envio no WhatsApp */}
      {showConfirmWhatsapp && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#202022] border border-red-200 dark:border-red-900/50 rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
              <Send size={24} />
            </div>
            <h3 className="text-lg font-bold text-[#1c1d21] dark:text-white mb-2">
              Notificar Estoque no WhatsApp?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Serão enviadas notificações para os <strong className="text-red-600 dark:text-red-400 font-semibold">{alertItems.length} item(ns)</strong> críticos para o grupo configurado. Deseja continuar?
            </p>
            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={() => setShowConfirmWhatsapp(false)}
                disabled={sendingWhatsapp}
                className="flex-1 py-2.5 rounded-lg font-bold border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmWhatsapp(false);
                  handleSendWhatsApp();
                }}
                disabled={sendingWhatsapp}
                className="flex-1 py-2.5 rounded-lg font-bold bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {sendingWhatsapp ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                Confirmar Disparo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
