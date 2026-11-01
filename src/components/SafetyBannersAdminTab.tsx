import React, { useState, useEffect } from 'react';
import Shield from 'lucide-react/dist/esm/icons/shield.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import Pen from 'lucide-react/dist/esm/icons/pen.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import Eye from 'lucide-react/dist/esm/icons/eye.js';
import EyeOff from 'lucide-react/dist/esm/icons/eye-off.js';
import Clock from 'lucide-react/dist/esm/icons/clock.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import { toast } from 'sonner';
import { SafetyBanner, getSafetyBanners, saveSafetyBanners } from '../lib/safetyBanners';
import { SafetyBannerModal } from './SafetyBannerModal';

interface SafetyBannersAdminTabProps {
  isDark: boolean;
}

export function SafetyBannersAdminTab({ isDark }: SafetyBannersAdminTabProps) {
  const [banners, setBanners] = useState<SafetyBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const list = await getSafetyBanners();
      setBanners(list);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar banners de segurança');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    const handleUpdate = () => carregar();
    window.addEventListener('sucena_safety_banners_updated', handleUpdate);
    return () => window.removeEventListener('sucena_safety_banners_updated', handleUpdate);
  }, []);

  const handleToggleActive = async (bannerId: string) => {
    const updated = banners.map(b => b.id === bannerId ? { ...b, active: !b.active } : b);
    setBanners(updated);
    try {
      await saveSafetyBanners(updated);
      toast.success('Status do banner atualizado!');
    } catch (err) {
      toast.error('Erro ao salvar alteração');
      carregar();
    }
  };

  const handleDelete = async (bannerId: string) => {
    if (banners.length <= 1) {
      toast.error('Deve haver pelo menos um banner configurado.');
      return;
    }
    if (!confirm('Deseja realmente excluir este banner de segurança?')) return;
    const updated = banners.filter(b => b.id !== bannerId);
    setBanners(updated);
    try {
      await saveSafetyBanners(updated);
      toast.success('Banner removido com sucesso!');
    } catch (err) {
      toast.error('Erro ao excluir banner');
      carregar();
    }
  };

  const activeCount = banners.filter(b => b.active).length;

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Card */}
      <div className={`rounded-2xl p-6 shadow-sm border ${isDark ? 'bg-[#15161A] border-white/5' : 'bg-white border-black/5'}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 dark:border-white/5 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
              <Shield size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Banners de Segurança do Dashboard
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">
                  Carrossel 10s
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Permissão exclusiva: <b>Técnico de Segurança</b>, <b>Preposto</b> e <b>Admin</b>.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#D6A72B] hover:bg-[#b88c1f] text-black font-semibold text-sm transition-all shadow-sm active:scale-95"
          >
            <Plus size={16} />
            Adicionar / Gerenciar Banners
          </button>
        </div>

        {/* Informações de Regras e Rotação */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
          <div className={`p-4 rounded-xl border flex items-center gap-3 ${isDark ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-200/60'}`}>
            <Clock className="text-amber-500 shrink-0" size={20} />
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Tempo de Transição</div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">10 Segundos por banner</div>
            </div>
          </div>

          <div className={`p-4 rounded-xl border flex items-center gap-3 ${isDark ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-200/60'}`}>
            <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Banners Ativos</div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">{activeCount} de {banners.length} visíveis</div>
            </div>
          </div>

          <div className={`p-4 rounded-xl border flex items-center gap-3 ${isDark ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-200/60'}`}>
            <Shield className="text-blue-500 shrink-0" size={20} />
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Controle de Acesso</div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">Técnico Seg., Preposto & Admin</div>
            </div>
          </div>
        </div>

        {/* Lista de Banners em Cards */}
        <div className="mt-6">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-3">
            Banners Cadastrados no Carrossel
          </h3>

          {loading ? (
            <div className="py-12 text-center text-sm text-gray-500">Carregando banners...</div>
          ) : banners.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">Nenhum banner cadastrado.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {banners.map((b, idx) => (
                <div
                  key={b.id}
                  className={`rounded-xl border overflow-hidden transition-all flex flex-col justify-between ${
                    b.active
                      ? isDark
                        ? 'bg-black/20 border-white/10'
                        : 'bg-gray-50/80 border-gray-200'
                      : isDark
                      ? 'bg-black/10 border-white/5 opacity-60'
                      : 'bg-gray-100 border-gray-200 opacity-60'
                  }`}
                >
                  {/* Foto de Capa do Banner */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/40">
                    <img
                      src={b.imageUrl}
                      alt={b.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-xs">
                          Ordem #{idx + 1}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            b.active
                              ? 'bg-emerald-500/80 text-white'
                              : 'bg-gray-600/80 text-gray-200'
                          }`}
                        >
                          {b.active ? 'Ativo no Dashboard' : 'Oculto'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                          {b.kicker}
                        </span>
                        <h4 className="text-sm font-bold text-white line-clamp-1">
                          {b.title}
                        </h4>
                      </div>
                    </div>
                  </div>

                  {/* Detalhes de Conteúdo */}
                  <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                      {b.description}
                    </p>

                    <div className="pt-2 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-medium truncate max-w-[150px]">
                        Botão: <b>{b.buttonText}</b>
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {b.buttonLink || '/seguranca/dds'}
                      </span>
                    </div>

                    {/* Botões de Ação */}
                    <div className="pt-2 flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(b.id)}
                        className={`p-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          b.active
                            ? 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5'
                            : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                        }`}
                        title={b.active ? 'Desativar banner' : 'Ativar banner'}
                      >
                        {b.active ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsModalOpen(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors"
                        title="Editar banner"
                      >
                        <Pen size={12} />
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(b.id)}
                        className="p-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 border border-transparent hover:border-red-200 dark:hover:border-red-500/20 transition-colors"
                        title="Excluir banner"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Gerenciamento / Criação */}
      <SafetyBannerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpdated={(updated) => {
          setBanners(updated);
        }}
      />
    </div>
  );
}

