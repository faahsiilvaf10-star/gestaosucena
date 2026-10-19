/**
 * SignatureOverlay
 * ----------------
 * Componente dedicado para captura de assinatura em dispositivos móveis.
 *
 * Comportamento:
 *  - Solicita tela cheia real via Fullscreen API
 *  - Bloqueia orientação em landscape-primary via Screen Orientation API
 *  - Usa ResizeObserver para dimensionar o canvas dinamicamente,
 *    preenchendo 100% da área disponível sem corte ou distorção
 *  - Ao sair (Voltar ou Finalizar), restaura a orientação e o fullscreen
 */
import React, { useRef, useEffect, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import Eraser from 'lucide-react/dist/esm/icons/eraser.js';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import Check from 'lucide-react/dist/esm/icons/check.js';

interface SignatureOverlayProps {
  title: string;
  personName: string;
  sigRef: React.RefObject<SignatureCanvas | null>;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}

export function SignatureOverlay({
  title,
  personName,
  sigRef,
  onBack,
  onNext,
  nextLabel = 'Próximo',
  nextDisabled = false,
}: SignatureOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  // ── Fullscreen + Orientation lock ────────────────────────────────────────
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;

    const enterFullscreen = async () => {
      try {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if ((el as any).webkitRequestFullscreen) {
          await (el as any).webkitRequestFullscreen();
        }
      } catch (_) {
        // Fullscreen não disponível (ex: iOS Safari < 16.4) — degradamos
        // graciosamente: o overlay fixed cobre toda a tela mesmo assim.
      }
    };

    const lockLandscape = async () => {
      try {
        await screen.orientation?.lock?.('landscape-primary');
      } catch (_) {
        // Sem suporte — o overlay já preenche toda a tela.
      }
    };

    enterFullscreen().then(lockLandscape);

    return () => {
      // Sai do fullscreen e desbloqueia orientação ao desmontar
      try {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else if ((document as any).webkitFullscreenElement)
          (document as any).webkitExitFullscreen?.();
      } catch (_) {}
      try { screen.orientation?.unlock?.(); } catch (_) {}
    };
  }, []);

  // ── ResizeObserver: redimensiona o canvas ao container mudar ─────────────
  const resizeCanvas = useCallback(() => {
    const area = canvasAreaRef.current;
    const sig = sigRef.current;
    if (!area || !sig) return;

    const rect = area.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);
    
    // Se dimensões forem zero, agenda nova tentativa (elemento pode estar oculto temporariamente)
    if (w === 0 || h === 0) {
      return false;
    }

    const hadData = !sig.isEmpty();
    const dataURL = hadData ? sig.toDataURL() : null;

    const canvas = sig.getCanvas();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);

    if (dataURL) {
      const img = new Image();
      img.onload = () => {
        const c = sig.getCanvas();
        c.getContext('2d')?.drawImage(img, 0, 0, w, h);
      };
      img.src = dataURL;
    }
    return true;
  }, [sigRef]);

  // Redimensiona o canvas de forma robusta quando o overlay se torna visível
  useEffect(() => {
    let cancelled = false;
    let rafId: number;
    
    const tryResize = (attempts: number = 0) => {
      if (cancelled) return;
      
      const success = resizeCanvas();
      if (!success && attempts < 10) {
        rafId = requestAnimationFrame(() => tryResize(attempts + 1));
      }
    };
    
    // Espera um frame para o DOM se estabilizar após a renderização
    rafId = requestAnimationFrame(() => tryResize());
    
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [resizeCanvas]);

  useEffect(() => {
    const area = canvasAreaRef.current;
    if (!area) return;

    const ro = new ResizeObserver(() => {
      resizeCanvas();
    });
    ro.observe(area);

    // Fallback: tenta redimensionar em vários momentos
    const timeouts = [
      setTimeout(resizeCanvas, 100),
      setTimeout(resizeCanvas, 300),
      setTimeout(resizeCanvas, 600),
      setTimeout(resizeCanvas, 1000),
    ];

    return () => {
      ro.disconnect();
      timeouts.forEach(clearTimeout);
    };
  }, [resizeCanvas]);

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid #e5e7eb',
          flexShrink: 0,
          background: '#f9fafb',
          touchAction: 'manipulation',
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          style={{ gap: 6, fontWeight: 600, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
        >
          <ArrowLeft style={{ width: 16, height: 16 }} />
          Voltar
        </Button>

        <div style={{ textAlign: 'center', flex: 1, padding: '0 8px' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#111827', letterSpacing: 0.5 }}>
            {title}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{personName}</div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => sigRef.current?.clear()}
            title="Limpar assinatura"
            style={{ touchAction: 'manipulation' }}
          >
            <Eraser style={{ width: 18, height: 18, color: '#9ca3af' }} />
          </Button>
          <Button
            size="sm"
            onClick={onNext}
            disabled={nextDisabled}
            style={{
              background: '#111827',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 13,
              paddingLeft: 14,
              paddingRight: 14,
              gap: 6,
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {nextLabel.includes('Finalizar') ? (
              <Check style={{ width: 15, height: 15 }} />
            ) : (
              <ArrowRight style={{ width: 15, height: 15 }} />
            )}
            {nextLabel}
          </Button>
        </div>
      </div>

      {/* Área de assinatura */}
      <div
        ref={canvasAreaRef}
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          margin: '12px 16px 16px',
          border: '2px dashed #9ca3af',
          borderRadius: 12,
          background: '#fff',
          overflow: 'hidden',
          touchAction: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          position: 'relative',
        }}
      >
        {/* Watermark guia */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <span style={{ fontSize: 14, color: '#d1d5db', fontStyle: 'italic', letterSpacing: 1 }}>
            Assine aqui
          </span>
        </div>

        <SignatureCanvas
          ref={sigRef}
          penColor="#111827"
          minWidth={0.6}
          maxWidth={0.9}
          dotSize={0.7}
          throttle={16}
          velocityFilterWeight={0.7}
          canvasProps={{
            style: {
              display: 'block',
              width: '100%',
              height: '100%',
              touchAction: 'none',
            },
          }}
        />
      </div>
    </div>
  );
}
