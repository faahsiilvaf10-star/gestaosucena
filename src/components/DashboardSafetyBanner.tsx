import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import Pen from 'lucide-react/dist/esm/icons/pen.js';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left.js';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.js';
import { SafetyBanner, getSafetyBanners, canManageSafetyBanner, DEFAULT_SAFETY_BANNERS } from '../lib/safetyBanners';
import { SafetyBannerModal } from './SafetyBannerModal';

interface DashboardSafetyBannerProps {
  userRole?: string | null;
  userName?: string | null;
}

export function DashboardSafetyBanner({ userRole, userName }: DashboardSafetyBannerProps) {
  const navigate = useNavigate();
  const [banners, setBanners] = useState<SafetyBanner[]>(DEFAULT_SAFETY_BANNERS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Fallback para localStorage caso as props não sejam passadas imediatamente
  const role = userRole || (typeof window !== 'undefined' ? localStorage.getItem('sucena_user_role') : '') || '';
  const name = userName || (typeof window !== 'undefined' ? localStorage.getItem('sucena_user_name') : '') || '';

  const canEdit = useMemo(() => {
    return canManageSafetyBanner(role, name);
  }, [role, name]);

  // Carregar banners
  const carregarBanners = async () => {
    try {
      const data = await getSafetyBanners();
      if (Array.isArray(data) && data.length > 0) {
        setBanners(data);
      }
    } catch (err) {
      console.warn('[DashboardSafetyBanner] Erro ao carregar banners:', err);
    }
  };

  useEffect(() => {
    carregarBanners();

    const handleUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setBanners(e.detail);
      } else {
        carregarBanners();
      }
    };

    window.addEventListener('sucena_safety_banners_updated', handleUpdate);
    return () => window.removeEventListener('sucena_safety_banners_updated', handleUpdate);
  }, []);

  // Filtra apenas os banners ativos
  const activeBanners = useMemo(() => {
    const list = banners.filter(b => b.active);
    return list.length > 0 ? list : DEFAULT_SAFETY_BANNERS;
  }, [banners]);

  // Ajusta índice caso a lista diminua
  useEffect(() => {
    if (currentIndex >= activeBanners.length) {
      setCurrentIndex(0);
    }
  }, [activeBanners.length, currentIndex]);

  // Auto-play de 10 segundos
  useEffect(() => {
    if (activeBanners.length <= 1 || isHovered) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % activeBanners.length);
    }, 10000); // Exatamente 10 segundos conforme solicitado

    return () => clearInterval(interval);
  }, [activeBanners.length, isHovered, currentIndex]);

  const currentBanner = activeBanners[currentIndex] || activeBanners[0];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev - 1 + activeBanners.length) % activeBanners.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev + 1) % activeBanners.length);
  };

  const handleClickCta = () => {
    if (currentBanner.buttonLink) {
      if (currentBanner.buttonLink.startsWith('http')) {
        window.open(currentBanner.buttonLink, '_blank');
      } else {
        navigate({ to: currentBanner.buttonLink as any });
      }
    } else {
      navigate({ to: '/seguranca/dds' as any });
    }
  };

  return (
    <>
      <section
        className="safety relative overflow-hidden group select-none transition-all"
        aria-label="Segurança em primeiro lugar"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Imagem de Fundo com transição suave */}
        <img
          key={currentBanner.id + currentBanner.imageUrl}
          src={currentBanner.imageUrl}
          alt={currentBanner.title}
          className="transition-opacity duration-700 ease-in-out"
        />

        {/* Botão de Edição Restrito: Técnico de Segurança, Preposto e Admin */}
        {canEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsModalOpen(true);
            }}
            className="absolute top-3 right-3 z-30 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md text-xs font-bold border border-white/20 transition-all shadow-lg active:scale-95"
            title="Alterar foto, título, descrição e botão do banner (Acesso: Técnico de Segurança, Preposto e Admin)"
          >
            <Pen size={12} className="text-[#D6A72B]" />
            <span>Editar Banner</span>
          </button>
        )}

        {/* Setas de Navegação (quando há mais de 1 banner) */}
        {activeBanners.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity border border-white/10"
              title="Banner anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity border border-white/10"
              title="Próximo banner"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}

        {/* Conteúdo do Banner */}
        <div className="safety-body relative z-10">
          <span className="s-kicker">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
            {currentBanner.kicker}
          </span>
          <h3>{currentBanner.title}</h3>
          <p>{currentBanner.description}</p>
          <button
            type="button"
            onClick={handleClickCta}
            className="safety-btn cursor-pointer transition-transform hover:scale-[1.02] active:scale-95"
          >
            {currentBanner.buttonText}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </div>

        {/* Indicadores de slides (quando há mais de 1 banner) */}
        {activeBanners.length > 1 && (
          <div className="absolute bottom-2.5 right-4 z-20 flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-full backdrop-blur-xs">
            {activeBanners.map((b, idx) => (
              <button
                key={b.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={`transition-all rounded-full ${
                  idx === currentIndex
                    ? 'w-5 h-1.5 bg-[#D6A72B]'
                    : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
                }`}
                title={`Ir para banner ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </section>

      {/* Modal de Gerenciamento */}
      <SafetyBannerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpdated={(updated) => {
          setBanners(updated);
        }}
      />
    </>
  );
}

