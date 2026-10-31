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
import { sendEpiRequisitionWhatsappNotification } from '@/lib/whatsappHelpers';
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

        // Dimensões ideais para assinaturas nítidas, legíveis e com linhas contínuas
    const maxW = 260;
    const maxH = 75;

    let authImg: HTMLImageElement | null = null;
    let empImg: HTMLImageElement | null = null;

    if (authSig) {
      try {
        authImg = await loadImage(authSig);
      } catch (e) {}
    }

    if (empSig) {
      try {
        empImg = await loadImage(empSig);
      } catch (e) {}
    }

    const authBounds = authImg ? getTrimmedBounds(authImg) : null;
    const empBounds = empImg ? getTrimmedBounds(empImg) : null;

    // Harmoniza a escala de desenho preservando a resolução nativa sem corte ou distorção
    const scaleAuth = authBounds && authBounds.width > 0 && authBounds.height > 0
      ? Math.min(maxW / authBounds.width, maxH / authBounds.height, 1.2)
      : 1.0;

    let scaleEmp = empBounds && empBounds.width > 0 && empBounds.height > 0
      ? Math.min(maxW / empBounds.width, maxH / empBounds.height, 1.2)
      : 1.0;

    if (authBounds && empBounds) {
      scaleEmp = Math.min(scaleEmp, Math.max(scaleAuth * 1.1, 0.7));
    }

    // Desenha as assinaturas com suavização de alta precisão (linhas contínuas e corretas, sem traços serrilhados)
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (authBounds) {
      const drawW = Math.max(10, Math.round(authBounds.width * scaleAuth));
      const drawH = Math.max(10, Math.round(authBounds.height * scaleAuth));
      const drawX = Math.round(centerL - drawW / 2);
      const drawY = Math.round(y - drawH - 5);

      ctx.drawImage(
        authBounds.img,
        authBounds.sx,
        authBounds.sy,
        authBounds.sWidth,
        authBounds.sHeight,
        drawX,
        drawY,
        drawW,
        drawH
      );
    }
    drawLine(centerL - sigW / 2, y, centerL + sigW / 2, y, '#333');

    if (empBounds) {
      const drawW = Math.max(10, Math.round(empBounds.width * scaleEmp));
      const drawH = Math.max(10, Math.round(empBounds.height * scaleEmp));
      const drawX = Math.round(centerR - drawW / 2);
      const drawY = Math.round(y - drawH - 5);

      ctx.drawImage(
        empBounds.img,
        empBounds.sx,
        empBounds.sy,
        empBounds.sWidth,
        empBounds.sHeight,
        drawX,
        drawY,
        drawW,
        drawH
      );
    }
    drawLine(centerR - sigW / 2, y, centerR + sigW / 2, y, '#333');
    ctx.restore();

    // Títulos centralizados abaixo das linhas
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#333';
    ctx.fillText('ASSINATURA DO AUTORIZADOR', centerL, y + 20);
    ctx.fillText('ASSINATURA DO FUNCIONÁRIO', centerR, y + 20);
    ctx.restore();

    // Retorna PNG nítido e sem artefatos de compressão, com fundo branco sólido
    resolve(canvas.toDataURL('image/png'));
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

      return (data || []).filter((d: any) => {
        const s = (d.status || '').toUpperCase().trim();
        return s !== 'INATIVO' && s !== 'DEMITIDO' && s !== 'DESLIGADO';
      });
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
  const [authorizerSigData, setAuthorizerSigData] = useState<string | null>(null);
  const [employeeSigData, setEmployeeSigData] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [step, setStep] = useState(1);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Monitora se o usuário está autenticado
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(!!data.session);
      setSessionChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Derived data
  const authorizer = employees?.find((e: any) => e.id === authorizerId);
  const employee = employees?.find((e: any) => e.id === employeeId);

  // Helper para identificar se um item é uniforme
  const isUniform = (name: string, catName?: string, subCat?: string) => {
    const n = (name || '').toLowerCase();
    const c = (catName || '').toLowerCase();
    const s = (subCat || '').toLowerCase();
    return n.includes('camisa') || n.includes('calça') || n.includes('calca') || c.includes('uniforme') || s.includes('uniforme');
  };

  const filteredProducts = (epiProducts || []).filter(p => {
    const term = searchEpiTerm.toLowerCase().trim();
    if (!term) return true;
    const pName = p.name?.toLowerCase() || '';
    const catName = p.category?.name?.toLowerCase() || '';
    const subCat = p.subcategory?.toLowerCase() || '';
    return pName.includes(term) || catName.includes(term) || subCat.includes(term);
  });

  const epiList = filteredProducts.filter(p => !isUniform(p.name, p.category?.name, p.subcategory));
  const uniformList = filteredProducts.filter(p => isUniform(p.name, p.category?.name, p.subcategory));

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
    setAuthorizerSigData(null);
    setEmployeeSigData(null);
  };

  // Handler unificado para salvar
  const handleGenerateAndSubmit = async (authBase64Param?: string, empBase64Param?: string) => {
    if (!authorizerId || !employeeId) {
      toast.error('Selecione o autorizador e o recebedor.');
      return;
    }
    const validItems = items.filter(i => i.productId);
    if (validItems.length === 0) {
      toast.error('Selecione pelo menos um EPI ou uniforme.');
      return;
    }

    // Captura a assinatura diretamente do canvas se disponível
    const getSigBase64 = (ref: React.RefObject<SignatureCanvas | null>) => {
      if (!ref.current || ref.current.isEmpty()) return null;
      try {
        const canvas = ref.current.getCanvas();
        if (canvas && canvas.width > 0 && canvas.height > 0) {
          return canvas.toDataURL('image/png');
        }
      } catch (_) {}
      try {
        const trimmed = ref.current.getTrimmedCanvas();
        if (trimmed && trimmed.width > 0 && trimmed.height > 0) {
          return trimmed.toDataURL('image/png');
        }
      } catch (_) {}
      return null;
    };

    const authorizerSigBase64 = authBase64Param || authorizerSigData || getSigBase64(authorizerSigRef);
    const employeeSigBase64 = empBase64Param || employeeSigData || getSigBase64(employeeSigRef);

    if (!authorizerSigBase64 || !employeeSigBase64) {
      toast.error('Ambas as assinaturas (Autorizador e Recebedor) são obrigatórias.');
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading('Gerando recibo e salvando requisição...');

    try {
      
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
      const createdRequisition = await createMutation.mutateAsync({
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
        const wpRes = await sendEpiRequisitionWhatsappNotification({
          authorizerName: authorizer?.nome || '',
          authorizerMatricula: authorizer?.matricula || '',
          employeeName: employee?.nome || '',
          employeeCargo: employee?.cargo || '',
          employeeMatricula: employee?.matricula || '',
          destinationArea,
          reason,
          items: validItems.map(it => {
            const prod = epiProducts?.find(p => p.id === it.productId);
            const currentQty = Number(prod?.current_quantity) || 0;
            const qtdEntregue = Number(it.quantity) || 1;
            const remainingStock = Math.max(0, currentQty - qtdEntregue);
            const rawMin = Number(prod?.min_stock) || 0;
            // Se for >= 1000, é número de C.A. inserido por engano no campo min_stock
            const minStock = rawMin >= 1000 ? 5 : rawMin;
            const unit = prod?.unit_of_measure || 'un';

            return {
              productId: it.productId,
              name: prod?.name || 'Desconhecido',
              quantity: it.quantity,
              remainingStock,
              minStock,
              unit,
              isBelowMin: minStock > 0 && remainingStock <= minStock
            };
          }),
          dateStr,
          receiptBase64,
          receiptImageUrl: (createdRequisition as any)?.receipt_image_url
        });

        if (wpRes.success) {
          if (wpRes.queued) {
            toast.info('Requisição salva! A notificação do WhatsApp foi enfileirada e será enviada assim que o WhatsApp responder.', { duration: 5000 });
          } else {
            toast.success('Requisição salva e notificação enviada ao WhatsApp!', { duration: 4000 });
          }
        } else if (wpRes.error && !wpRes.error.includes('desativado')) {
          toast.warning(`Requisição salva! Aviso WhatsApp: ${wpRes.error}. Você pode reenviar a qualquer momento na lista de requisições.`, { duration: 6000 });
        }
      } catch (wpErr) {
        console.error("Erro ao enviar whatsapp automático:", wpErr);
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
      
      {/* Alerta de Sessão Não Autenticada */}
      {sessionChecked && !isAuthenticated && (
        <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-amber-900 dark:text-amber-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-xl shrink-0 mt-0.5 sm:mt-0">
              <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-bold text-base">Você não está autenticado no sistema</p>
              <p className="text-xs opacity-90 mt-0.5">
                O estoque de EPIs e Uniformes requer autenticação ativa. Faça login para carregar os produtos e registrar requisições.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => navigate({ to: '/' })}
            className="w-full sm:w-auto bg-[#c9a84c] hover:bg-[#b88e28] text-black font-bold text-xs shrink-0 px-5 h-10 rounded-xl shadow transition-transform active:scale-95"
          >
            Fazer Login Agora
          </Button>
        </div>
      )}

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
          {loadingEpi ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-3 p-3 rounded-lg border border-border/40 bg-muted/20 animate-pulse">
                <div className="w-6 h-6 rounded-full bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-2.5 bg-muted rounded w-1/3" />
                </div>
              </div>
            ))
          ) : (
            epiList.map(p => {
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
            })
          )}
        </div>

        {!loadingEpi && epiList.length === 0 && (
          <div className="text-center py-6 px-4 border border-dashed rounded-xl bg-muted/10 space-y-2">
            <p className="text-sm text-muted-foreground font-medium">
              {!isAuthenticated && sessionChecked
                ? 'Você não está autenticado. Faça login no sistema para carregar os EPIs disponíveis no estoque.'
                : 'Nenhum EPI encontrado no estoque para esta busca.'}
            </p>
            {!isAuthenticated && sessionChecked && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate({ to: '/' })}
                className="text-xs mt-1"
              >
                Ir para o Login
              </Button>
            )}
          </div>
        )}

        <div className="border-b pb-4 mt-8">
          <h3 className="text-xl font-bold">Uniforme</h3>
        </div>
        
        <div className="space-y-6">
          {loadingEpi ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-3 rounded-lg border border-border/40 bg-muted/20 animate-pulse">
                <div className="h-4 bg-muted rounded w-36" />
                <div className="w-6 h-6 rounded-full bg-muted shrink-0" />
              </div>
            ))
          ) : (
            uniformList.map(p => {
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
            })
          )}
          {!loadingEpi && uniformList.length === 0 && (
            <div className="text-center py-6 px-4 border border-dashed rounded-xl bg-muted/10 space-y-2">
              <p className="text-sm text-muted-foreground font-medium">
                {!isAuthenticated && sessionChecked
                  ? 'Você não está autenticado. Faça login no sistema para carregar os uniformes disponíveis no estoque.'
                  : 'Nenhum uniforme encontrado no estoque.'}
              </p>
              {!isAuthenticated && sessionChecked && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate({ to: '/' })}
                  className="text-xs mt-1"
                >
                  Ir para o Login
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Rodapé do Formulário: Botão para Avançar para Assinaturas */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-6 mt-8 mb-8 border-t">
        <div className="flex items-center text-sm text-muted-foreground">
          <AlertCircle className="w-4 h-4 mr-2 shrink-0 text-amber-500" />
          <span>Ao avançar, o autorizador e o recebedor assinarão sequencialmente em tela cheia.</span>
        </div>
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: '/almoxarifado' })}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="lg"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 shadow-md flex items-center gap-2"
            onClick={() => {
              if (!authorizerId || !employeeId) {
                toast.error('Selecione o autorizador e o recebedor.');
                return;
              }
              const validItems = items.filter(i => i.productId);
              if (validItems.length === 0) {
                toast.error('Selecione pelo menos um EPI ou uniforme.');
                return;
              }
              setStep(2);
            }}
          >
            <span>Avançar para Assinaturas</span>
            <ArrowRight className="w-5 h-5 ml-1" />
          </Button>
        </div>
      </div>

      {/* Overlay de Assinatura em Tela Cheia Sequencial (Passo 1: Autorizador, Passo 2: Recebedor) */}
      {(step === 2 || step === 3) && (
        <SignatureOverlay
          step={step}
          authorizerName={authorizer?.nome || 'Autorizador'}
          employeeName={employee?.nome || 'Recebedor'}
          authorizerSigRef={authorizerSigRef}
          employeeSigRef={employeeSigRef}
          onBack={() => {
            if (step === 3) {
              setStep(2);
            } else {
              setStep(1);
            }
          }}
          onNextStep={(authBase64) => {
            if (authBase64) setAuthorizerSigData(authBase64);
            setStep(3);
          }}
          onFinish={(authBase64, empBase64) => {
            if (authBase64) setAuthorizerSigData(authBase64);
            if (empBase64) setEmployeeSigData(empBase64);
            handleGenerateAndSubmit(authBase64, empBase64);
          }}
          isGenerating={isGenerating}
        />
      )}

    </div>
  );
}
