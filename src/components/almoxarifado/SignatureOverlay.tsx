/**
 * SignatureOverlay
 * ----------------
 * Componente unificado e ultra-acessível para captura de assinatura em dispositivos móveis.
 *
 * Características:
 *  - Suporte completo a safe-area-insets (afasta botões de entalhes, câmeras e bordas da tela).
 *  - Botões duplos de avanço (no topo rebaixado e na barra de rodapé com alvo de toque de 50px).
 *  - Suporte a toque direto (onTouchEnd + onPointerDown + onClick com debounce e haptic feedback).
 *  - Transição contínua entre Step 2 (Autorizador) e Step 3 (Funcionário) sem sair do fullscreen.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import Eraser from 'lucide-react/dist/esm/icons/eraser.js';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import Check from 'lucide-react/dist/esm/icons/check.js';
import AlertTriangle from 'lucide-react/dist/esm/icons/triangle-alert.js';
import Loader2 from 'lucide-react/dist/esm/icons/loader-circle.js';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw.js';
import { toast } from 'sonner';

interface SignatureOverlayProps {
  step: number; // 2 para autorizador, 3 para funcionário
  authorizerName: string;
  employeeName: string;
  authorizerSigRef: React.RefObject<SignatureCanvas | null>;
  employeeSigRef: React.RefObject<SignatureCanvas | null>;
  onBack: () => void;
  onNextStep: () => void;
  onFinish: () => void;
  isGenerating?: boolean;
}

// Verifica se o canvas de assinatura está vazio
function isSigEmpty(sig: SignatureCanvas | null): boolean {
  if (!sig) return true;
  if (sig.isEmpty()) return true;
  try {
    const canvas = sig.getCanvas();
    if (!canvas || canvas.width === 0 || canvas.height === 0) return true;
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 20) {
        return false;
      }
    }
    return true;
  } catch (_) {
    return sig.isEmpty();
  }
}

export function SignatureOverlay({
  step,
  authorizerName,
  employeeName,
  authorizerSigRef,
  employeeSigRef,
  onBack,
  onNextStep,
  onFinish,
  isGenerating = false,
}: SignatureOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authorizerDrawn, setAuthorizerDrawn] = useState(false);
  const [employeeDrawn, setEmployeeDrawn] = useState(false);
  const lastActionTimeRef = useRef<number>(0);

  // ── Fullscreen + Trava de Orientação em Paisagem ────────────────────────
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
      } catch (_) {}
    };

    const lockLandscape = async () => {
      try {
        await screen.orientation?.lock?.('landscape-primary');
      } catch (_) {}
    };

    enterFullscreen().then(lockLandscape);

    return () => {
      try {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else if ((document as any).webkitFullscreenElement) {
          (document as any).webkitExitFullscreen?.();
        }
      } catch (_) {}
      try {
        screen.orientation?.unlock?.();
      } catch (_) {}
    };
  }, []);

  // ── Redimensiona o canvas ativo garantindo proporção e nitidez ────────────
  const resizeCanvas = useCallback(() => {
    const area = canvasAreaRef.current;
    if (!area) return false;

    const rect = area.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);
    if (w <= 0 || h <= 0) return false;

    const dpr = window.devicePixelRatio || 1;
    const targetW = w * dpr;
    const targetH = h * dpr;

    const resizeSingle = (sig: SignatureCanvas | null) => {
      if (!sig) return;
      const canvas = sig.getCanvas();
      if (!canvas) return;

      if (canvas.width === targetW && canvas.height === targetH) {
        return;
      }

      const hadData = !sig.isEmpty();
      const dataURL = hadData ? sig.toDataURL() : null;

      canvas.width = targetW;
      canvas.height = targetH;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);

      if (dataURL) {
        sig.fromDataURL(dataURL, { width: w, height: h });
      }
    };

    if (step === 2) {
      resizeSingle(authorizerSigRef.current);
    } else {
      resizeSingle(employeeSigRef.current);
    }
    return true;
  }, [step, authorizerSigRef, employeeSigRef]);

  // Redimensiona ao montar e ao alternar de etapa
  useEffect(() => {
    let cancelled = false;
    let rafId: number;

    const tryResize = (attempts = 0) => {
      if (cancelled) return;
      const ok = resizeCanvas();
      if (!ok && attempts < 10) {
        rafId = requestAnimationFrame(() => tryResize(attempts + 1));
      }
    };

    rafId = requestAnimationFrame(() => tryResize());

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [step, resizeCanvas]);

  // Observer de redimensionamento do container
  useEffect(() => {
    const area = canvasAreaRef.current;
    if (!area) return;

    const ro = new ResizeObserver(() => {
      resizeCanvas();
    });
    ro.observe(area);

    const t1 = setTimeout(resizeCanvas, 150);
    const t2 = setTimeout(resizeCanvas, 500);

    return () => {
      ro.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [resizeCanvas]);

  // Limpa o canvas ativo
  const handleClear = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (step === 2) {
      authorizerSigRef.current?.clear();
      setAuthorizerDrawn(false);
    } else {
      employeeSigRef.current?.clear();
      setEmployeeDrawn(false);
    }
    setErrorMsg(null);
  };

  // Disparo do avanço (com debounce e haptics)
  const triggerNextAction = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const now = Date.now();
    if (now - lastActionTimeRef.current < 450) return;
    lastActionTimeRef.current = now;

    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(35);
      }
    } catch (_) {}

    if (step === 2) {
      const empty = !authorizerDrawn && isSigEmpty(authorizerSigRef.current);
      if (empty) {
        setErrorMsg('A assinatura do autorizador é obrigatória.');
        toast.error('A assinatura do autorizador é obrigatória.');
        return;
      }
      setErrorMsg(null);
      onNextStep();
    } else {
      const empty = !employeeDrawn && isSigEmpty(employeeSigRef.current);
      if (empty) {
        setErrorMsg('A assinatura do funcionário é obrigatória.');
        toast.error('A assinatura do funcionário é obrigatória.');
        return;
      }
      setErrorMsg(null);
      onFinish();
    }
  };

  const isStep2 = step === 2;
  const currentTitle = isStep2 ? 'ASSINATURA DO AUTORIZADOR' : 'ASSINATURA DO FUNCIONÁRIO';
  const currentPerson = isStep2 ? authorizerName : employeeName;

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        touchAction: 'manipulation',
      }}
    >
      {/* ── Top Header (rebaixado e afastado das bordas / entalhes) ──────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 'max(14px, env(safe-area-inset-top, 14px))',
          paddingRight: 'max(24px, env(safe-area-inset-right, 24px))',
          paddingBottom: '12px',
          paddingLeft: 'max(24px, env(safe-area-inset-left, 24px))',
          borderBottom: '1px solid #e2e8f0',
          flexShrink: 0,
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setErrorMsg(null);
            onBack();
          }}
          style={{
            height: 42,
            paddingLeft: 14,
            paddingRight: 16,
            gap: 6,
            fontWeight: 600,
            fontSize: 13,
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            borderRadius: 8,
          }}
        >
          <ArrowLeft style={{ width: 16, height: 16 }} />
          Voltar
        </Button>

        <div style={{ textAlign: 'center', flex: 1, padding: '0 12px' }}>
          <div
            style={{
              display: 'inline-block',
              background: isStep2 ? '#e0e7ff' : '#dcfce7',
              color: isStep2 ? '#3730a3' : '#166534',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              padding: '2px 8px',
              borderRadius: 12,
              marginBottom: 2,
            }}
          >
            {isStep2 ? 'Passo 1 de 2 • Autorizador' : 'Passo 2 de 2 • Funcionário'}
          </div>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a', letterSpacing: 0.5 }}>
            {currentTitle}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 1, fontWeight: 500 }}>
            {currentPerson}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            title="Limpar assinatura"
            style={{
              height: 42,
              paddingLeft: 10,
              paddingRight: 12,
              gap: 6,
              color: '#64748b',
              touchAction: 'manipulation',
            }}
          >
            <RotateCcw style={{ width: 16, height: 16 }} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>Limpar</span>
          </Button>

          {/* Botão Superior com alvos de toque aumentados */}
          <button
            type="button"
            onClick={triggerNextAction}
            onPointerUp={triggerNextAction}
            disabled={isGenerating}
            style={{
              height: 42,
              minWidth: 120,
              padding: '0 16px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: isStep2 ? '#0f172a' : '#16a34a',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 13,
              borderRadius: 8,
              border: 'none',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              opacity: isGenerating ? 0.7 : 1,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              transition: 'transform 0.1s ease',
            }}
          >
            {isGenerating ? (
              <>
                <Loader2 style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} />
                <span>Salvando...</span>
              </>
            ) : isStep2 ? (
              <>
                <span>Próximo</span>
                <ArrowRight style={{ width: 15, height: 15 }} />
              </>
            ) : (
              <>
                <Check style={{ width: 15, height: 15 }} />
                <span>Finalizar ✓</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Alerta Visual de Validação ───────────────────────────────────── */}
      {errorMsg && (
        <div
          style={{
            background: '#fef2f2',
            color: '#b91c1c',
            borderBottom: '1px solid #fecaca',
            padding: '8px 24px',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            flexShrink: 0,
            animation: 'fadeIn 0.2s ease-in-out',
          }}
        >
          <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── Área de Assinatura (Centro) ─────────────────────────────────── */}
      <div
        ref={canvasAreaRef}
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          margin: '10px max(24px, env(safe-area-inset-right, 24px)) 10px max(24px, env(safe-area-inset-left, 24px))',
          border: errorMsg ? '2px dashed #ef4444' : '2px dashed #cbd5e1',
          borderRadius: 14,
          background: '#ffffff',
          overflow: 'hidden',
          touchAction: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          position: 'relative',
          boxShadow: '0 4px 10px rgba(0,0,0,0.03)',
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
            zIndex: 1,
          }}
        >
          <span style={{ fontSize: 15, color: '#cbd5e1', fontStyle: 'italic', letterSpacing: 1, fontWeight: 500 }}>
            ✍️ Assine aqui ({isStep2 ? 'Autorizador' : 'Funcionário'})
          </span>
        </div>

        {/* Canvas Autorizador (Step 2) */}
        <div
          style={{
            display: isStep2 ? 'block' : 'none',
            width: '100%',
            height: '100%',
            position: 'absolute',
            inset: 0,
            zIndex: 2,
          }}
        >
          <SignatureCanvas
            ref={authorizerSigRef}
            penColor="#0f172a"
            minWidth={0.8}
            maxWidth={1.2}
            dotSize={0.8}
            throttle={16}
            velocityFilterWeight={0.7}
            clearOnResize={false}
            onBegin={() => {
              setAuthorizerDrawn(true);
              setErrorMsg(null);
            }}
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

        {/* Canvas Funcionário (Step 3) */}
        <div
          style={{
            display: !isStep2 ? 'block' : 'none',
            width: '100%',
            height: '100%',
            position: 'absolute',
            inset: 0,
            zIndex: 2,
          }}
        >
          <SignatureCanvas
            ref={employeeSigRef}
            penColor="#0f172a"
            minWidth={0.8}
            maxWidth={1.2}
            dotSize={0.8}
            throttle={16}
            velocityFilterWeight={0.7}
            clearOnResize={false}
            onBegin={() => {
              setEmployeeDrawn(true);
              setErrorMsg(null);
            }}
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

      {/* ── Barra de Rodapé Acessível (Alvo de toque grande e longe da borda) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '6px',
          paddingRight: 'max(24px, env(safe-area-inset-right, 24px))',
          paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))',
          paddingLeft: 'max(24px, env(safe-area-inset-left, 24px))',
          flexShrink: 0,
          background: '#ffffff',
          borderTop: '1px solid #f1f5f9',
          gap: 16,
        }}
      >
        <button
          type="button"
          onClick={handleClear}
          style={{
            height: 48,
            padding: '0 18px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: '#f1f5f9',
            color: '#475569',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <Eraser style={{ width: 17, height: 17 }} />
          Limpar Quadro
        </button>

        {/* Botão de Rodapé Primário - Grande, Impossível de Errar */}
        <button
          type="button"
          onClick={triggerNextAction}
          onPointerUp={triggerNextAction}
          disabled={isGenerating}
          style={{
            height: 48,
            minWidth: 200,
            padding: '0 24px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: isStep2 ? '#0f172a' : '#16a34a',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: 15,
            borderRadius: 10,
            border: 'none',
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            opacity: isGenerating ? 0.7 : 1,
            boxShadow: isStep2
              ? '0 4px 14px rgba(15, 23, 42, 0.25)'
              : '0 4px 14px rgba(22, 163, 74, 0.3)',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            transition: 'all 0.15s ease',
          }}
        >
          {isGenerating ? (
            <>
              <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
              <span>Salvando requisição...</span>
            </>
          ) : isStep2 ? (
            <>
              <span>Avançar para Funcionário</span>
              <ArrowRight style={{ width: 18, height: 18 }} />
            </>
          ) : (
            <>
              <Check style={{ width: 18, height: 18 }} />
              <span>Finalizar e Salvar ✓</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
