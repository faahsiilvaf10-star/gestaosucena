import Search from 'lucide-react/dist/esm/icons/search.js';
import ChevronsUpDown from 'lucide-react/dist/esm/icons/chevrons-up-down.js';
import Check from 'lucide-react/dist/esm/icons/check.js';
import AlertCircle from 'lucide-react/dist/esm/icons/circle-alert.js';
import Save from 'lucide-react/dist/esm/icons/save.js';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js';
import Eraser from 'lucide-react/dist/esm/icons/eraser.js';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import SignatureCanvas from 'react-signature-canvas';
import { useEpiProducts, useCreateEpiRequisition } from '@/hooks/useEpiRequisitions';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { useNavigate } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { getWhatsappSettings } from '@/lib/settings';
import { sendWhatsappMediaOnServer } from '@/lib/whatsapp-api';
import { SignatureOverlay } from '@/components/almoxarifado/SignatureOverlay';

function generateReceiptPng(
  employee: { nome: string; cargo?: string; matricula?: string },
  authorizer: { nome: string; matricula?: string },
  destinationArea: string,
  reason: string,
  items: Array<{ productId: string; quantity: number }>,
  products: Array<{ id: string; name: string }>,
  authSig: string | null,
  empSig: string | null,
  date: string
): Promise<string> {
  return new Promise(async (resolve) => {
    const W = 800;
    const padX = 40;
    const itemsRows = Math.max(1, items.length);
    const H = 680 + itemsRows * 30;
    
    const scale = 2; // Aumenta a resolução para impressão
    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d')!;
    
    ctx.scale(scale, scale);

    // Fundo BRANCO (imprescindível para o JPEG e WhatsApp)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const drawLine = (x1: number, y1: number, x2: number, y2: number, color = '#999') => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    const drawText = (text: string, x: number, y: number, font = '14px Arial', color = '#333') => {
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    };

    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((res, rej) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => res(img);
        img.onerror = () => rej(new Error('Falha ao carregar imagem'));
        img.src = src;
      });
    };

    let imgLogo: HTMLImageElement | null = null;
    try {
      imgLogo = await loadImage('/logo-relatorio.png');
    } catch (e) {
      // Ignora erro do logo
    }

    if (imgLogo) {
      ctx.drawImage(imgLogo, padX, 30, 180, 50);
    }

    const envStr = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') : null;
    const contractNum = envStr === 'hydro-civil' ? 'Hydro Civil' : '4600012690';
    drawText(`CONTRATO: ${contractNum}`, W - padX - 160, 60, '12px Arial', '#666');
    drawLine(padX, 90, W - padX, 90, '#ccc');
    drawText('REQUISIÇÃO DE EPI', W / 2 - 120, 140, 'bold 24px Arial', '#333');

    let y = 190;
    const col2X = W / 2 + 20; 
    const col1LineEnd = col2X + 40; 
    const col2LineStart = col2X + 60;

    // ROW 1
    drawText('DATA:', padX, y, 'bold 14px Arial');
    drawText(date, padX + 50, y, '14px Arial');
    drawLine(padX, y + 5, col1LineEnd, y + 5);

    drawText('ÁREA DESTINO:', col2LineStart, y, 'bold 14px Arial');
    drawText(destinationArea, col2LineStart + 115, y, '14px Arial');
    drawLine(col2LineStart, y + 5, W - padX, y + 5);
    y += 40;

    // ROW 2
    drawText('AUTORIZADO POR:', padX, y, 'bold 14px Arial');
    drawText(authorizer.nome.toUpperCase(), padX + 140, y, '14px Arial');
    drawLine(padX, y + 5, col1LineEnd, y + 5);

    drawText('MATRÍCULA:', col2LineStart, y, 'bold 14px Arial');
    drawText(authorizer.matricula || '-', col2LineStart + 90, y, '14px Arial');
    drawLine(col2LineStart, y + 5, W - padX, y + 5);
    y += 40;

    // ROW 3
    drawText('MOTIVO:', padX, y, 'bold 14px Arial');
    drawText(reason, padX + 65, y, '14px Arial');
    drawLine(padX, y + 5, W - padX, y + 5);
    y += 40;

    // ROW 4
    drawText('FUNCIONÁRIO(A):', padX, y, 'bold 14px Arial');
    drawText(employee.nome.toUpperCase(), padX + 130, y, '14px Arial');
    drawLine(padX, y + 5, W - padX, y + 5);
    y += 40;

    // ROW 5
    drawText('FUNÇÃO:', padX, y, 'bold 14px Arial');
    drawText((employee.cargo || '-').toUpperCase(), padX + 70, y, '14px Arial');
    drawLine(padX, y + 5, col1LineEnd, y + 5);

    drawText('MATRÍCULA:', col2LineStart, y, 'bold 14px Arial');
    drawText(employee.matricula || '-', col2LineStart + 90, y, '14px Arial');
    drawLine(col2LineStart, y + 5, W - padX, y + 5);
    y += 40;

    // Table Header (EPI gray bar)
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(padX, y, W - padX * 2, 30);
    ctx.strokeStyle = '#ddd';
    ctx.strokeRect(padX, y, W - padX * 2, 30);
    drawText('EPI', padX + 12, y + 20, 'bold 16px Arial');
    y += 30;

    // Table Subheader
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(padX, y, W - padX * 2, 30);
    ctx.strokeRect(padX, y, W - padX * 2, 30);
    const col1W = 576;
    ctx.strokeRect(padX, y, col1W, 30);
    drawText('EPI / Uniforme', padX + 12, y + 20, 'bold 14px Arial');
    drawText('Qtd', padX + col1W + 50, y + 20, 'bold 14px Arial');
    y += 30;

    // Items
    ctx.fillStyle = '#333';
    if (items.length > 0) {
      items.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        ctx.strokeRect(padX, y, W - padX * 2, 30);
        ctx.strokeRect(padX, y, col1W, 30);
        drawText(prod?.name || item.productId, padX + 12, y + 20, '14px Arial');
        drawText(String(item.quantity), padX + col1W + 60, y + 20, '14px Arial');
        y += 30;
      });
    } else {
      ctx.strokeRect(padX, y, W - padX * 2, 30);
      ctx.strokeRect(padX, y, col1W, 30);
      drawText('Nenhum item selecionado.', padX + 12, y + 20, '14px Arial');
      drawText('-', padX + col1W + 60, y + 20, '14px Arial');
      y += 30;
    }

    y += 90;

    // Signatures
    const sigW = 250;
    const centerL = padX + (W / 2 - padX) / 2;
    const centerR = W / 2 + (W / 2 - padX) / 2;

    /**
     * Identifica os limites visíveis reais do traço da assinatura na imagem.
     * Remove margens vazias/transparentes para que a escala proporcional seja precisa.
     */
    const getTrimmedBounds = (img: HTMLImageElement) => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) {
        return { img, sx: 0, sy: 0, sWidth: w || 240, sHeight: h || 60, width: w || 240, height: h || 60 };
      }

      try {
        const temp = document.createElement('canvas');
        temp.width = w;
        temp.height = h;
        const tCtx = temp.getContext('2d');
        if (!tCtx) {
          return { img, sx: 0, sy: 0, sWidth: w, sHeight: h, width: w, height: h };
        }

        tCtx.drawImage(img, 0, 0);
        const imgData = tCtx.getImageData(0, 0, w, h);
        const data = imgData.data;

        let minX = w;
        let minY = h;
        let maxX = 0;
        let maxY = 0;
        let hasInk = false;

        for (let py = 0; py < h; py++) {
          for (let px = 0; px < w; px++) {
            const idx = (py * w + px) * 4;
            const alpha = data[idx + 3];
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            // Considera tinta qualquer pixel não totalmente transparente e que não seja branco puro
            const isInk = alpha > 25 && (r < 240 || g < 240 || b < 240);
            if (isInk) {
              if (px < minX) minX = px;
              if (px > maxX) maxX = px;
              if (py < minY) minY = py;
              if (py > maxY) maxY = py;
              hasInk = true;
            }
          }
        }

        if (!hasInk || maxX < minX || maxY < minY) {
          return { img, sx: 0, sy: 0, sWidth: w, sHeight: h, width: w, height: h };
        }

        // Adiciona margem suave de 4px ao redor do traço
        const pad = 4;
        const sx = Math.max(0, minX - pad);
        const sy = Math.max(0, minY - pad);
        const sWidth = Math.min(w - sx, (maxX - minX + 1) + pad * 2);
        const sHeight = Math.min(h - sy, (maxY - minY + 1) + pad * 2);

        return { img, sx, sy, sWidth, sHeight, width: sWidth, height: sHeight };
      } catch (_) {
        return { img, sx: 0, sy: 0, sWidth: w, sHeight: h, width: w, height: h };
      }
    };

    /**
     * Normaliza a espessura do traço da assinatura para que ambas fiquem
     * uniformes com traço fino e nítido (caneta de espessura constante),
     * eliminando discrepâncias causadas por velocidade do toque, DPR ou resolução.
     */
    const normalizeSignatureCanvas = (
      img: HTMLImageElement,
      sx: number,
      sy: number,
      sWidth: number,
      sHeight: number,
      targetW: number,
      targetH: number
    ): HTMLCanvasElement => {
      const c = document.createElement('canvas');
      c.width = targetW;
      c.height = targetH;
      const cCtx = c.getContext('2d');
      if (!cCtx) return c;

      cCtx.imageSmoothingEnabled = true;
      cCtx.imageSmoothingQuality = 'high';
      cCtx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetW, targetH);

      try {
        const imgData = cCtx.getImageData(0, 0, targetW, targetH);
        const data = imgData.data;

        // Estima espessura média do traço: 2 * (Área / Perímetro)
        let ink = 0;
        let boundary = 0;
        for (let py = 0; py < targetH; py++) {
          for (let px = 0; px < targetW; px++) {
            const a = data[(py * targetW + px) * 4 + 3];
            if (a > 50) {
              ink++;
              const top = py > 0 ? data[((py - 1) * targetW + px) * 4 + 3] : 0;
              const bot = py < targetH - 1 ? data[((py + 1) * targetW + px) * 4 + 3] : 0;
              const left = px > 0 ? data[(py * targetW + (px - 1)) * 4 + 3] : 0;
              const right = px < targetW - 1 ? data[(py * targetW + (px + 1)) * 4 + 3] : 0;
              if (top < 50 || bot < 50 || left < 50 || right < 50) {
                boundary++;
              }
            }
          }
        }

        const estimatedThickness = boundary > 0 ? (2 * ink) / boundary : 1;
        // Se a espessura for superior a 1.8px (traço grosso), aplicamos erosão anti-aliasing
        const passes = estimatedThickness > 3.2 ? 2 : estimatedThickness > 1.8 ? 1 : 0;

        if (passes > 0) {
          let current = new Uint8ClampedArray(data);
          for (let p = 0; p < passes; p++) {
            const next = new Uint8ClampedArray(current);
            for (let py = 1; py < targetH - 1; py++) {
              for (let px = 1; px < targetW - 1; px++) {
                const idx = (py * targetW + px) * 4;
                const a = current[idx + 3];
                if (a > 40) {
                  const top = current[((py - 1) * targetW + px) * 4 + 3];
                  const bot = current[((py + 1) * targetW + px) * 4 + 3];
                  const left = current[(py * targetW + (px - 1)) * 4 + 3];
                  const right = current[(py * targetW + (px + 1)) * 4 + 3];
                  if (top < 40 || bot < 40 || left < 40 || right < 40) {
                    // Suaviza e afina a borda externa
                    next[idx + 3] = Math.max(0, a - 170);
                  }
                }
              }
            }
            current = next;
          }
          for (let i = 0; i < data.length; i++) data[i] = current[i];
          cCtx.putImageData(imgData, 0, 0);
        }
      } catch (_) {}

      return c;
    };

    const drawSignature = (img: HTMLImageElement, centerX: number, lineY: number) => {
      const bounds = getTrimmedBounds(img);
      const maxW = 240;
      const maxH = 65;

      if (bounds.width <= 0 || bounds.height <= 0) return;

      // Escala estritamente mantendo a proporção de aspecto (sem puxar e sem cortar)
      const scale = Math.min(maxW / bounds.width, maxH / bounds.height, 1.0);
      const drawW = Math.round(bounds.width * scale);
      const drawH = Math.round(bounds.height * scale);

      const drawX = Math.round(centerX - drawW / 2);
      const drawY = Math.round(lineY - drawH - 5);

      const normalizedCanvas = normalizeSignatureCanvas(
        bounds.img,
        bounds.sx,
        bounds.sy,
        bounds.sWidth,
        bounds.sHeight,
        drawW,
        drawH
      );

      ctx.drawImage(normalizedCanvas, drawX, drawY);
    };

    if (authSig) {
      try {
        const img = await loadImage(authSig);
        drawSignature(img, centerL, y);
      } catch (e) {}
    }
    drawLine(centerL - sigW / 2, y, centerL + sigW / 2, y, '#333');

    if (empSig) {
      try {
        const img2 = await loadImage(empSig);
        drawSignature(img2, centerR, y);
      } catch (e) {}
    }
    drawLine(centerR - sigW / 2, y, centerR + sigW / 2, y, '#333');

    // Títulos centralizados abaixo das linhas
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#333';
    ctx.fillText('ASSINATURA DO AUTORIZADOR', centerL, y + 20);
    ctx.fillText('ASSINATURA DO FUNCIONÁRIO', centerR, y + 20);
    ctx.restore();

    // Retorna JPEG (resolve o problema de fundo preto/fundo transparente nas APIs de WhatsApp)
    resolve(canvas.toDataURL('image/jpeg', 0.95));
  });
}

// Helper component para buscar a última data de retirada
function LastRequisitionDate({ employeeId, productId }: { employeeId: string, productId: string }) {
  const [lastDate, setLastDate] = useState<string | null>(null);
  
  useEffect(() => {
    if (!employeeId || !productId) return;
    const fetchLast = async () => {
      const { data } = await supabase
        .from('al_epi_requisition_items')
        .select('created_at, requisition:al_epi_requisitions!inner(employee_id)')
        .eq('product_id', productId)
        .eq('al_epi_requisitions.employee_id', employeeId)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (data && data.length > 0) {
        setLastDate(format(new Date(data[0].created_at), 'dd/MM/yyyy'));
      } else {
        setLastDate('Nunca retirou');
      }
    };
    fetchLast();
  }, [employeeId, productId]);

  return <span className="text-xs text-muted-foreground">{lastDate ? `Última retirada: ${lastDate}` : 'Buscando...'}</span>;
}

export function EpiRequisitionForm() {
  const navigate = useNavigate();
  const createMutation = useCreateEpiRequisition();
  const { data: epiProducts, isLoading: loadingEpi } = useEpiProducts();
  
  // Buscar funcionários ativos
  const { data: employees } = useQuery({
    queryKey: ['rh_efetivo_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_efetivo')
        .select('id, nome, cargo, matricula, status')
        .order('nome');
      
      if (error) {
        console.error("Erro ao buscar funcionários:", error);
      }
      
      return data || [];
    }
  });

  const [authorizerId, setAuthorizerId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [destinationArea, setDestinationArea] = useState('Almoxarifado');
  const [reason, setReason] = useState('');
  const [authorizerOpen, setAuthorizerOpen] = useState(false);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [searchEpiTerm, setSearchEpiTerm] = useState('');
  
  const [items, setItems] = useState<{ productId: string, quantity: number }[]>([]);
  
  const authorizerSigRef = useRef<SignatureCanvas>(null);
  const employeeSigRef = useRef<SignatureCanvas>(null);
  const sigContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 340, height: 200 });
  const [isGenerating, setIsGenerating] = useState(false);
  const [step, setStep] = useState(1);
  const [signatureFullscreen, setSignatureFullscreen] = useState(false);

  // Detecta dispositivo móvel de forma robusta, independente da orientação atual.
  const isMobileDevice = () =>
    navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 768;

  // Calcula dimensões do canvas apenas para o layout desktop inline.
  useEffect(() => {
    const update = () => {
      setCanvasSize(
        isMobileDevice()
          ? { width: Math.max(280, window.innerWidth - 32), height: 220 }
          : { width: 340, height: 200 }
      );
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [signatureFullscreen]);

  // Ativa modo fullscreen de assinatura ao entrar nos steps 2 e 3 no mobile.
  useEffect(() => {
    const mobile = isMobileDevice();
    if ((step === 2 || step === 3) && mobile) {
      setSignatureFullscreen(true);
    } else {
      setSignatureFullscreen(false);
    }
  }, [step]);

  // Derived data
  const authorizer = employees?.find((e: any) => e.id === authorizerId);
  const employee = employees?.find((e: any) => e.id === employeeId);

  const handleToggleItem = (productId: string, checked: boolean) => {
    if (checked) {
      setItems([...items, { productId, quantity: 1 }]);
    } else {
      setItems(items.filter(i => i.productId !== productId));
    }
  };

  const updateItemQuantity = (productId: string, quantity: number) => {
    setItems(items.map(i => i.productId === productId ? { ...i, quantity } : i));
  };

  const clearSignatures = () => {
    authorizerSigRef.current?.clear();
    employeeSigRef.current?.clear();
  };

  // Handler unificado para salvar
  const handleGenerateAndSubmit = async () => {
    if (!authorizerId || !employeeId) {
      toast.error('Selecione o autorizador e o funcionário.');
      return;
    }
    const validItems = items.filter(i => i.productId);
    if (validItems.length === 0) {
      toast.error('Selecione pelo menos um EPI.');
      return;
    }
    if (authorizerSigRef.current?.isEmpty() || employeeSigRef.current?.isEmpty()) {
      toast.error('Ambas as assinaturas são obrigatórias.');
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading('Gerando recibo e salvando requisição...');

    try {
      const getSigBase64 = (ref: React.RefObject<SignatureCanvas | null>) => {
        if (!ref.current || ref.current.isEmpty()) return null;
        try {
          const trimmed = ref.current.getTrimmedCanvas();
          if (trimmed && trimmed.width > 0 && trimmed.height > 0) {
            return trimmed.toDataURL('image/png');
          }
        } catch (_) {}
        try {
          return ref.current.getCanvas().toDataURL('image/png');
        } catch (_) {
          return null;
        }
      };

      const authorizerSigBase64 = getSigBase64(authorizerSigRef);
      const employeeSigBase64 = getSigBase64(employeeSigRef);
      
      const dateStr = format(new Date(), 'dd/MM/yyyy');
      
      // Gera PNG via Canvas nativo — sem html-to-image, sem erros de CORS/CSS
      const receiptBase64 = await generateReceiptPng(
        { nome: employee!.nome, cargo: employee!.cargo, matricula: employee!.matricula },
        { nome: authorizer!.nome, matricula: authorizer!.matricula },
        destinationArea || 'Almoxarifado',
        reason || '.',
        validItems,
        epiProducts || [],
        authorizerSigBase64,
        employeeSigBase64,
        dateStr
      );

      // Salva no Supabase
      await createMutation.mutateAsync({
        authorizer_id: authorizerId,
        employee_id: employeeId,
        destination_area: destinationArea,
        reason: reason,
        items: validItems.map(it => ({ product_id: it.productId, quantity: it.quantity })),
        receipt_image_base64: receiptBase64
      });
      
      const { logActivity } = await import('../../lib/logActivity');
      await logActivity({
        module: 'Almoxarifado',
        action: `Requisição de EPI criada para ${employee?.nome} (${validItems.length} itens)`,
        user_name: authorizer?.nome
      });

      // Dispara envio automático no WhatsApp se estiver habilitado
      try {
        const settings = await getWhatsappSettings();
        if (settings.requisitionAlerts?.enabled && settings.url && settings.token) {
          const groupId = settings.requisitionAlerts.specificGroupId || settings.groupId;
          if (groupId) {
             const itemsList = validItems.map(it => {
               const prod = epiProducts?.find(p => p.id === it.productId);
               return `  - ${prod?.name || 'Desconhecido'} (${it.quantity})`;
             }).join('\n');
             const dataStr = format(new Date(), 'dd/MM/yyyy');
             let caption = settings.messageTemplates?.requisicaoEpi || '🦺 *TROCA DE EPI*\n\n📅 *Data:* {data}\n👤 *Funcionário:* {nome}\n💼 *Função:* {cargo}\n🆔 *Matrícula:* {matricula}\n📝 *Motivo:* {motivo}\n✅ *Autorizado por:* {autorizador} ({matricula_autorizador})\n\n*Itens:*\n{itens}';
             caption = caption.replace('{data}', dataStr)
                              .replace('{nome}', employee?.nome || '')
                              .replace('{cargo}', employee?.cargo || '-')
                              .replace('{matricula}', employee?.matricula || '-')
                              .replace('{motivo}', reason || '.')
                              .replace('{autorizador}', authorizer?.nome || '')
                              .replace('{matricula_autorizador}', authorizer?.matricula || '-')
                              .replace('{itens}', itemsList);
             await sendWhatsappMediaOnServer({
               data: {
                 url: settings.url,
                 token: settings.token,
                 instanceId: settings.instanceId,
                 phone: groupId,
                 caption,
                 base64Media: receiptBase64,
                 fileName: 'recibo-epi.jpg'
               }
             });
          }
        }
      } catch (err) {
        console.error("Erro ao enviar whatsapp automático", err);
      }

      toast.success('Recibo gerado e salvo com sucesso!', { id: toastId });
      navigate({ to: '/almoxarifado/requisicoes' });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao gerar requisição', { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Employee Info */}
      <div className={cn("bg-card border rounded-xl p-6 shadow-sm space-y-6", step !== 1 && "hidden md:block")}>
        <h3 className="text-xl font-bold border-b pb-4">Dados da Requisição</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Autorizado Por <span className="text-destructive">*</span></Label>
            <Popover open={authorizerOpen} onOpenChange={setAuthorizerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={authorizerOpen} className="w-full justify-between font-normal h-10">
                  {authorizer ? authorizer.nome : 'Selecione o autorizador...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar por nome..." />
                  <CommandList>
                    <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                    <CommandGroup>
                      {employees?.map(e => (
                        <CommandItem
                          key={e.id}
                          value={e.nome}
                          onSelect={() => { setAuthorizerId(e.id); setAuthorizerOpen(false); }}
                        >
                          <Check className={cn('mr-2 h-4 w-4', authorizerId === e.id ? 'opacity-100' : 'opacity-0')} />
                          {e.nome} <span className="ml-1 text-muted-foreground text-xs">({e.cargo || 'S/ Cargo'})</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {authorizer && <div className="text-sm text-muted-foreground">Matrícula: {authorizer.matricula || '-'}</div>}
          </div>

          <div className="space-y-2">
            <Label>Funcionário(a) (Recebedor) <span className="text-destructive">*</span></Label>
            <Popover open={employeeOpen} onOpenChange={setEmployeeOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={employeeOpen} className="w-full justify-between font-normal h-10">
                  {employee ? employee.nome : 'Selecione o funcionário...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar por nome..." />
                  <CommandList>
                    <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                    <CommandGroup>
                      {employees?.map(e => (
                        <CommandItem
                          key={e.id}
                          value={e.nome}
                          onSelect={() => { setEmployeeId(e.id); setEmployeeOpen(false); }}
                        >
                          <Check className={cn('mr-2 h-4 w-4', employeeId === e.id ? 'opacity-100' : 'opacity-0')} />
                          {e.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {employee && <div className="text-sm text-muted-foreground">Cargo: {employee.cargo || '-'} | Matrícula: {employee.matricula || '-'}</div>}
          </div>

          <div className="space-y-2">
            <Label>Área Destino</Label>
            <Input value={destinationArea} onChange={e => setDestinationArea(e.target.value)} placeholder="Ex: Almoxarifado, Obra X" />
          </div>

          <div className="space-y-2">
            <Label>Motivo</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Substituição, Novo Colaborador" />
          </div>
        </div>
      </div>

      {/* EPI Selection */}
      <div className={cn("bg-card border rounded-xl p-6 shadow-sm space-y-6", step !== 1 && "hidden md:block")}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 gap-4">
          <h3 className="text-xl font-bold">EPI e Materiais</h3>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Procurar EPI ou material..."
              className="pl-9 bg-muted/50"
              value={searchEpiTerm}
              onChange={e => setSearchEpiTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {epiProducts?.filter(p => (p.name.toLowerCase().includes(searchEpiTerm.toLowerCase()) || p.category?.name?.toLowerCase().includes(searchEpiTerm.toLowerCase())) && !p.name.toLowerCase().includes('camisa') && !p.name.toLowerCase().includes('calça') && !p.category?.name?.toLowerCase().includes('uniforme')).map(p => {
            const isSelected = items.some(i => i.productId === p.id);
            const item = items.find(i => i.productId === p.id);
            return (
              <div key={p.id} className="flex flex-col space-y-2">
                <div className="flex items-start space-x-3">
                  <Checkbox 
                    id={`epi-${p.id}`} 
                    checked={isSelected} 
                    onCheckedChange={(c) => handleToggleItem(p.id, !!c)}
                    disabled={p.current_quantity <= 0}
                    className="rounded-full shrink-0 mt-0.5"
                    style={{ width: '24px', height: '24px', minWidth: '24px', minHeight: '24px' }}
                  />
                  <Label 
                    htmlFor={`epi-${p.id}`} 
                    className={`text-base font-medium cursor-pointer ${p.current_quantity <= 0 ? 'text-muted-foreground line-through' : ''}`}
                  >
                    {p.name}
                  </Label>
                </div>
                
                {isSelected && (
                  <div className="pl-9 flex flex-wrap items-center gap-3 animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center gap-2 bg-muted/30 p-1.5 rounded-md">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Qtd:</Label>
                      <Input 
                        type="number" 
                        className="w-16 h-8 text-sm" 
                        min="1" 
                        max={p.current_quantity}
                        value={item?.quantity || 1} 
                        onChange={(e) => updateItemQuantity(p.id, parseInt(e.target.value) || 1)} 
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-medium text-destructive whitespace-nowrap">Estoque: {p.current_quantity}</span>
                      {employeeId && <LastRequisitionDate employeeId={employeeId} productId={p.id} />}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-b pb-4 mt-8">
          <h3 className="text-xl font-bold">Uniforme</h3>
        </div>
        
        <div className="space-y-6">
           {/* Renderiza uniformes que não foram renderizados no bloco anterior */}
           {epiProducts?.filter(p => (p.name.toLowerCase().includes(searchEpiTerm.toLowerCase()) || p.category?.name?.toLowerCase().includes(searchEpiTerm.toLowerCase())) && (p.name.toLowerCase().includes('camisa') || p.name.toLowerCase().includes('calça') || p.category?.name?.toLowerCase().includes('uniforme'))).map(p => {
            const isSelected = items.some(i => i.productId === p.id);
            const item = items.find(i => i.productId === p.id);
            return (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pb-4 sm:pb-0 border-b sm:border-b-0 border-border">
                <div className="sm:w-48">
                  <Label className="font-semibold text-base sm:text-sm">{p.name}:</Label>
                </div>
                <div className="flex flex-wrap items-center gap-4 flex-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id={`unif-${p.id}`} 
                      checked={isSelected} 
                      onCheckedChange={(c) => handleToggleItem(p.id, !!c)}
                      disabled={p.current_quantity <= 0}
                      className="rounded-full shrink-0"
                      style={{ width: '24px', height: '24px', minWidth: '24px', minHeight: '24px' }}
                    />
                    <Label htmlFor={`unif-${p.id}`} className="text-sm cursor-pointer whitespace-nowrap">Selecionar</Label>
                  </div>
                  
                  {isSelected && (
                    <div className="flex items-center gap-3 bg-muted/30 p-2 rounded-md">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Qtd:</Label>
                      <Input 
                        type="number" 
                        className="w-16 h-8 text-sm" 
                        min="1" 
                        max={p.current_quantity}
                        value={item?.quantity || 1} 
                        onChange={(e) => updateItemQuantity(p.id, parseInt(e.target.value) || 1)} 
                      />
                      <span className="text-xs font-medium text-destructive whitespace-nowrap">Estoque: {p.current_quantity}</span>
                    </div>
                  )}
                </div>
              </div>
            );
           })}
           {epiProducts?.filter(p => (p.name.toLowerCase().includes(searchEpiTerm.toLowerCase()) || p.category?.name?.toLowerCase().includes(searchEpiTerm.toLowerCase())) && (p.name.toLowerCase().includes('camisa') || p.name.toLowerCase().includes('calça') || p.category?.name?.toLowerCase().includes('uniforme'))).length === 0 && (
             <p className="text-sm text-muted-foreground">Nenhum uniforme encontrado no estoque.</p>
           )}
        </div>
      </div>

      {/* Signatures */}
      <div className={cn("bg-card border rounded-xl p-6 shadow-sm space-y-6", step === 1 && "hidden md:block")}>
        <div className="flex justify-between items-center border-b pb-4">
          <h3 className="text-xl font-bold">Assinaturas</h3>
          <Button type="button" variant="ghost" size="sm" onClick={clearSignatures}>Limpar Assinaturas</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* ASSINATURA AUTORIZADOR */}
          <div className={cn("space-y-2 flex flex-col items-center", step !== 2 && "hidden md:flex")}>
            {signatureFullscreen ? (
              <SignatureOverlay
                title="ASSINATURA DO AUTORIZADOR"
                personName={authorizer?.nome || 'Selecione o autorizador'}
                sigRef={authorizerSigRef}
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
                nextLabel="Próximo →"
              />
            ) : (
              <>
                <div className="w-full flex items-center justify-between mb-2">
                  <div className="w-10"></div>
                  <Label className="text-center font-bold text-lg md:text-sm text-black flex-1">ASSINATURA DO AUTORIZADOR</Label>
                  <Button variant="ghost" size="icon" onClick={() => authorizerSigRef.current?.clear()} title="Limpar Assinatura">
                    <Eraser className="w-6 h-6 text-gray-500" />
                  </Button>
                </div>
                <div
                  ref={sigContainerRef}
                  className="border-2 border-dashed border-gray-400 rounded-lg bg-white w-full overflow-hidden touch-none"
                  style={{ height: canvasSize.height }}
                >
                  <SignatureCanvas
                    ref={authorizerSigRef}
                    penColor="#111827"
                    minWidth={0.5}
                    maxWidth={1.1}
                    dotSize={0.8}
                    velocityFilterWeight={0.7}
                    canvasProps={{ width: canvasSize.width, height: canvasSize.height, className: 'sigCanvas w-full h-full' }}
                  />
                </div>
                <span className="text-sm text-gray-600 font-medium text-center mt-2">{authorizer?.nome || 'Selecione o autorizador'}</span>
              </>
            )}
          </div>

          {/* ASSINATURA FUNCIONÁRIO */}
          <div className={cn("space-y-2 flex flex-col items-center", step !== 3 && "hidden md:flex")}>
            {signatureFullscreen ? (
              <SignatureOverlay
                title="ASSINATURA DO FUNCIONÁRIO"
                personName={employee?.nome || 'Selecione o funcionário'}
                sigRef={employeeSigRef}
                onBack={() => setStep(2)}
                onNext={handleGenerateAndSubmit}
                nextLabel={isGenerating ? 'Salvando...' : 'Finalizar ✓'}
                nextDisabled={isGenerating}
              />
            ) : (
              <>
                <div className="w-full flex items-center justify-between mb-2">
                  <div className="w-10"></div>
                  <Label className="text-center font-bold text-lg md:text-sm text-black flex-1">ASSINATURA DO FUNCIONÁRIO</Label>
                  <Button variant="ghost" size="icon" onClick={() => employeeSigRef.current?.clear()} title="Limpar Assinatura">
                    <Eraser className="w-6 h-6 text-gray-500" />
                  </Button>
                </div>
                <div
                  className="border-2 border-dashed border-gray-400 rounded-lg bg-white w-full overflow-hidden touch-none"
                  style={{ height: canvasSize.height }}
                >
                  <SignatureCanvas
                    ref={employeeSigRef}
                    penColor="#111827"
                    minWidth={0.5}
                    maxWidth={1.1}
                    dotSize={0.8}
                    velocityFilterWeight={0.7}
                    canvasProps={{ width: canvasSize.width, height: canvasSize.height, className: 'sigCanvas w-full h-full' }}
                  />
                </div>
                <span className="text-sm text-gray-600 font-medium text-center mt-2">{employee?.nome || 'Selecione o funcionário'}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Steps Controls */}
      <div className="flex md:hidden justify-between mt-6">
        {step === 1 && (
          <Button type="button" variant="outline" onClick={() => navigate({ to: '/almoxarifado' })}>Cancelar</Button>
        )}
        {step > 1 && (
          <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
        )}
        {step < 3 ? (
          <Button type="button" className="ml-auto" onClick={() => setStep(step + 1)}>
            Próximo <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleGenerateAndSubmit} disabled={isGenerating} className="ml-auto bg-green-600 hover:bg-green-700">
            {isGenerating ? 'Salvando...' : 'Salvar'}
          </Button>
        )}
      </div>

      {/* Footer Actions (Desktop) */}
      <div className="hidden md:flex justify-end gap-4 pt-4 mt-8 mb-8 border-t">
         <div className="flex items-center text-sm text-muted-foreground mr-auto">
           <AlertCircle className="w-4 h-4 mr-2" />
           Isso irá abater do estoque e gerar um comprovante PNG inalterável.
         </div>
         <Button variant="outline" onClick={() => navigate({ to: '/almoxarifado' })}>Cancelar</Button>
         <Button onClick={handleGenerateAndSubmit} disabled={isGenerating} className="min-w-[200px]">
           {isGenerating ? 'Gerando e Salvando...' : <><Save className="w-4 h-4 mr-2" /> Salvar e Registrar</>}
         </Button>
      </div>

    </div>
  );
}
