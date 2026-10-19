/**
 * SignatureOverlay
 * ----------------
 * Componente unificado para captura de assinatura em dispositivos móveis.
 * Gerencia a transição contínua entre Step 2 (Autorizador) e Step 3 (Funcionário)
 * sem recarregar ou sair da tela cheia / orientação landscape.
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

// Utilitário para verificar se o canvas está vazio
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
        // Fallback gracioso: o overlay fixed cobre a tela mesmo sem a API
      }
    };

    const lockLandscape = async () => {
      try {
        await screen.orientation?.lock?.('landscape-primary');
      } catch (_) {
        // Sem suporte ou bloqueado pela plataforma
      }
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

      // Não reseta se já estiver dimensionado exatamente
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

  // Redimensiona ao montar e ao alternar de step
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

  // Observer de redimensionamento de janela
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
  const handleClear = () => {
    if (step === 2) {
      authorizerSigRef.current?.clear();
      setAuthorizerDrawn(false);
    } else {
      employeeSigRef.current?.clear();
      setEmployeeDrawn(false);
    }
    setErrorMsg(null);
  };

  // Clique em avançar (Próximo ou Finalizar)
  const handleNextAction = () => {
    if (step === 2) {
      const empty = isSigEmpty(authorizerSigRef.current) && !authorizerDrawn;
      if (empty) {
        setErrorMsg('A assinatura do autorizador é obrigatória.');
        toast.error('A assinatura do autorizador é obrigatória.');
        return;
      }
      setErrorMsg(null);
      onNextStep();
    } else {
      const empty = isSigEmpty(employeeSigRef.current) && !employeeDrawn;
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
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setErrorMsg(null);
            onBack();
          }}
          style={{ gap: 6, fontWeight: 600, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
        >
          <ArrowLeft style={{ width: 16, height: 16 }} />
          Voltar
        </Button>

        <div style={{ textAlign: 'center', flex: 1, padding: '0 8px' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#111827', letterSpacing: 0.5 }}>
            {currentTitle}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{currentPerson}</div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            title="Limpar assinatura"
            style={{ touchAction: 'manipulation' }}
          >
            <Eraser style={{ width: 18, height: 18, color: '#9ca3af' }} />
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleNextAction}
            disabled={isGenerating}
            style={{
              background: isStep2 ? '#111827' : '#16a34a',
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
            {isGenerating ? (
              <>
                <Loader2 style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} />
                Salvando...
              </>
            ) : isStep2 ? (
              <>
                Próximo
                <ArrowRight style={{ width: 15, height: 15 }} />
              </>
            ) : (
              <>
                <Check style={{ width: 15, height: 15 }} />
                Finalizar ✓
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Alerta visual de validação */}
      {errorMsg && (
        <div
          style={{
            background: '#fef2f2',
            color: '#b91c1c',
            borderBottom: '1px solid #fecaca',
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            animation: 'fadeIn 0.2s ease-in-out',
          }}
        >
          <AlertTriangle style={{ width: 15, height: 15, flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Área de assinatura */}
      <div
        ref={canvasAreaRef}
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          margin: '12px 16px 16px',
          border: errorMsg ? '2px dashed #ef4444' : '2px dashed #9ca3af',
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
            zIndex: 1,
          }}
        >
          <span style={{ fontSize: 14, color: '#d1d5db', fontStyle: 'italic', letterSpacing: 1 }}>
            Assine aqui ({isStep2 ? 'Autorizador' : 'Funcionário'})
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
            penColor="#111827"
            minWidth={0.6}
            maxWidth={0.9}
            dotSize={0.7}
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
            penColor="#111827"
            minWidth={0.6}
            maxWidth={0.9}
            dotSize={0.7}
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
    </div>
  );
}
