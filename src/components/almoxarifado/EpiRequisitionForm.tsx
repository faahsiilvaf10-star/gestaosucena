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
import { Search, ChevronsUpDown, Check, AlertCircle, Save, ArrowRight, ArrowLeft, Eraser } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { getWhatsappSettings } from '@/lib/settings';
import { sendWhatsappMediaOnServer } from '@/lib/whatsapp-api';

// Gera um recibo em PNG via Canvas nativo (sem dependência de html-to-image)
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
  return new Promise((resolve) => {
    const W = 800;
    const padX = 40;
    const itemsRows = Math.max(1, items.length);
    const H = 650 + itemsRows * 30;
    
    const scale = 2; // Aumenta a resolução para impressão
    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d')!;
    
    ctx.scale(scale, scale);

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

    const imgLogo = new Image();
    imgLogo.crossOrigin = 'anonymous';
    imgLogo.src = '/logo-relatorio.png';

    const drawContent = () => {
      try {
        ctx.drawImage(imgLogo, padX, 30, 180, 50);
      } catch (e) {
        // logo fallback
      }

      drawText('CONTRATO: 4600012690', W - padX - 160, 60, '12px Arial', '#666');
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
      ctx.fillStyle = '#ffffff';
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

      y += 80;

      // Signatures
      const sigW = 250;
      const centerL = padX + (W / 2 - padX) / 2;
      const centerR = W / 2 + (W / 2 - padX) / 2;

      if (authSig) {
        const img = new Image();
        img.onload = () => { ctx.drawImage(img, centerL - sigW / 2, y - 60, sigW, 60); };
        img.src = authSig;
      }
      drawLine(centerL - sigW / 2, y, centerL + sigW / 2, y, '#333');
      drawText('ASSINATURA DO AUTORIZADOR', centerL - 100, y + 20, '12px Arial');

      if (empSig) {
        const img2 = new Image();
        img2.onload = () => { ctx.drawImage(img2, centerR - sigW / 2, y - 60, sigW, 60); };
        img2.src = empSig;
      }
      drawLine(centerR - sigW / 2, y, centerR + sigW / 2, y, '#333');
      drawText('ASSINATURA DO FUNCIONÁRIO', centerR - 95, y + 20, '12px Arial');

      setTimeout(() => resolve(canvas.toDataURL('image/png')), 300);
    };

    imgLogo.onload = drawContent;
    imgLogo.onerror = drawContent;
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


// Hook que remapeia eventos de toque para um canvas rotacionado 90° via CSS
// Sem este hook, as coordenadas do toque ficam erradas no canvas girado
function useSignatureTouchRemap(
  overlayRef: React.RefObject<HTMLDivElement>,
  canvasRef: React.RefObject<SignatureCanvas>,
  active: boolean
) {
  useEffect(() => {
    if (!active) return
    const overlay = overlayRef.current
    if (!overlay) return

    const remapEvent = (e: PointerEvent) => {
      if ((e as any).__remapped) return
      e.preventDefault()
      e.stopPropagation()

      const canvas = canvasRef.current?.getCanvas()
      if (!canvas) return

      const vw = window.innerWidth
      const vh = window.innerHeight

      // Para rotação 90° CW: remapeia portrait→landscape
      // touch em (clientX, clientY) deve desenhar em:
      //   canvas_x = (vh - clientY) / vh * canvasWidth
      //   canvas_y = clientX / vw * canvasHeight
      // Fazemos isso ajustando o clientX/clientY sintético
      const fakeClientX = (vh - e.clientY) * (vw / vh)
      const fakeClientY = e.clientX * (vh / vw)

      const synthetic = new PointerEvent(e.type, {
        bubbles: true,
        cancelable: true,
        clientX: fakeClientX,
        clientY: fakeClientY,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        pressure: e.pressure || 0.5,
        isPrimary: e.isPrimary,
      });
      (synthetic as any).__remapped = true
      canvas.dispatchEvent(synthetic)
    }

    const opts = { passive: false, capture: true } as AddEventListenerOptions
    overlay.addEventListener('pointerdown', remapEvent, opts)
    overlay.addEventListener('pointermove', remapEvent, opts)
    overlay.addEventListener('pointerup', remapEvent, opts)
    overlay.addEventListener('pointercancel', remapEvent, opts)

    return () => {
      overlay.removeEventListener('pointerdown', remapEvent, { capture: true } as any)
      overlay.removeEventListener('pointermove', remapEvent, { capture: true } as any)
      overlay.removeEventListener('pointerup', remapEvent, { capture: true } as any)
      overlay.removeEventListener('pointercancel', remapEvent, { capture: true } as any)
    }
  }, [active, overlayRef, canvasRef])
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
  const authorizerInterceptorRef = useRef<HTMLDivElement>(null);
  const employeeInterceptorRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 340, height: 200 });
  const [isGenerating, setIsGenerating] = useState(false);
  const [step, setStep] = useState(1);
  // Controla se está em modo assinatura fullscreen no mobile
  const [signatureFullscreen, setSignatureFullscreen] = useState(false);
  // Detecta se o CSS rotation está ativo (portrait + signature overlay)
  const [cssRotationActive, setCssRotationActive] = useState(false);

  // Detecta se o CSS rotation está sendo usado (dispositivo em portrait com overlay ativo)
  useEffect(() => {
    const checkRotation = () => {
      setCssRotationActive(signatureFullscreen && window.innerHeight > window.innerWidth)
    }
    checkRotation()
    window.addEventListener('resize', checkRotation)
    window.addEventListener('orientationchange', checkRotation)
    return () => {
      window.removeEventListener('resize', checkRotation)
      window.removeEventListener('orientationchange', checkRotation)
    }
  }, [signatureFullscreen])

  // Remapeia coordenadas de toque para os dois canvas rotacionados
  useSignatureTouchRemap(authorizerInterceptorRef, authorizerSigRef, cssRotationActive)
  useSignatureTouchRemap(employeeInterceptorRef, employeeSigRef, cssRotationActive)

  // Calcula dimensões do canvas
  useEffect(() => {
    const updateCanvasSize = () => {
      if (window.innerWidth < 768) {
        if (signatureFullscreen) {
          // Em fullscreen, usa o tamanho real da tela atual (retrato ou paisagem)
          setCanvasSize({ width: window.innerWidth - 24, height: window.innerHeight - 100 })
        } else {
          setCanvasSize({ width: window.innerWidth - 32, height: window.innerHeight - 220 })
        }
      } else {
        setCanvasSize({ width: 340, height: 200 })
      }
    }
    updateCanvasSize()
    window.addEventListener('resize', updateCanvasSize)
    return () => window.removeEventListener('resize', updateCanvasSize)
  }, [signatureFullscreen])

  // Entra em modo fullscreen paisagem ao chegar na etapa de assinatura no mobile
  useEffect(() => {
    if ((step === 2 || step === 3) && window.innerWidth < 768) {
      setSignatureFullscreen(true)
      document.body.classList.add('signature-active')

      // Tenta travar orientação em paisagem sem fullscreen
      const tryLock = async () => {
        try {
          if (window.screen?.orientation?.lock) {
            await window.screen.orientation.lock('landscape')
          }
        } catch (_) {
          // Fallback: se o browser não suportar, a rotação CSS do overlay fará o trabalho
        }
      }
      tryLock()
    } else {
      setSignatureFullscreen(false)
      document.body.classList.remove('signature-active')
      try {
        if (window.screen?.orientation?.unlock) {
          window.screen.orientation.unlock()
        }
      } catch (_) {}
    }
    
    return () => {
      document.body.classList.remove('signature-active')
      try { window.screen?.orientation?.unlock?.() } catch (_) {}
    }
  }, [step])

  // Derived data
  const authorizer = employees?.find(e => e.id === authorizerId);
  const employee = employees?.find(e => e.id === employeeId);

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

  // Funções para forçar o modo paisagem no celular (requer clique do usuário)
  const requestLandscape = async () => {
    if (window.innerWidth >= 768) return;
    try {
      if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
        // Tenta travar a orientação (funciona em PWAs instalados)
        await window.screen.orientation.lock('landscape');
      }
    } catch (e) {
      console.warn("Orientation lock not supported or requires fullscreen:", e);
    }
  };

  const exitLandscape = async () => {
    try {
      if (window.screen && window.screen.orientation && window.screen.orientation.unlock) {
        window.screen.orientation.unlock();
      }
    } catch (e) {
      console.warn("Orientation unlock not supported:", e);
    }
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
      const authorizerSigBase64 = authorizerSigRef.current?.getCanvas().toDataURL('image/png') || null;
      const employeeSigBase64 = employeeSigRef.current?.getCanvas().toDataURL('image/png') || null;
      
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
                 base64Media: receiptBase64
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
            {/* Mobile: overlay fullscreen nativo (sem rotação CSS para não bugar o touch) */}
            {signatureFullscreen ? (
              <div className="sig-landscape-overlay">
                <div className="flex items-center justify-between px-4 pb-2 shrink-0 pt-2">
                  <div className="flex flex-col">
                    <Label className="font-bold text-base text-black">ASSINATURA AUTORIZADOR</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => authorizerSigRef.current?.clear()}>
                      <Eraser className="w-5 h-5 text-gray-500" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setStep(1) }} className="text-xs px-3">
                      ← Voltar
                    </Button>
                    <Button size="sm" onClick={() => { setStep(3) }} className="bg-black text-white text-xs px-3">
                      Próximo →
                    </Button>
                  </div>
                </div>
                <div className="flex-1 border-2 border-dashed border-gray-400 mx-3 mb-3 rounded-lg bg-white overflow-hidden touch-none relative">
                  <SignatureCanvas
                    ref={authorizerSigRef}
                    penColor="black"
                    minWidth={1.5}
                    maxWidth={3}
                    throttle={16}
                    canvasProps={{
                      width: canvasSize.width,
                      height: canvasSize.height,
                      className: 'sigCanvas w-full h-full',
                      style: { touchAction: 'none' }
                    }}
                  />
                  {/* Interceptor transparente que corrige coordenadas quando o CSS rotation está ativo */}
                  {cssRotationActive && (
                    <div
                      ref={authorizerInterceptorRef}
                      className="absolute inset-0 z-10"
                      style={{ touchAction: 'none', cursor: 'crosshair' }}
                    />
                  )}
                </div>
                <span className="text-center text-sm text-gray-600 pb-2">{authorizer?.nome || 'Selecione o autorizador'}</span>
              </div>
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
                    penColor="black"
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
              <div className="sig-landscape-overlay">
                <div className="flex items-center justify-between px-4 pb-2 shrink-0 pt-2">
                  <div className="flex flex-col">
                    <Label className="font-bold text-base text-black">ASSINATURA FUNCIONÁRIO</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => employeeSigRef.current?.clear()}>
                      <Eraser className="w-5 h-5 text-gray-500" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setStep(2) }} className="text-xs px-3">
                      ← Voltar
                    </Button>
                    <Button size="sm" onClick={handleGenerateAndSubmit} disabled={isGenerating} className="bg-black text-white text-xs px-3">
                      {isGenerating ? 'Salvando...' : 'Finalizar ✓'}
                    </Button>
                  </div>
                </div>
                <div className="flex-1 border-2 border-dashed border-gray-400 mx-3 mb-3 rounded-lg bg-white overflow-hidden touch-none relative">
                  <SignatureCanvas
                    ref={employeeSigRef}
                    penColor="black"
                    minWidth={1.5}
                    maxWidth={3}
                    throttle={16}
                    canvasProps={{
                      width: canvasSize.width,
                      height: canvasSize.height,
                      className: 'sigCanvas w-full h-full',
                      style: { touchAction: 'none' }
                    }}
                  />
                  {/* Interceptor transparente que corrige coordenadas quando o CSS rotation está ativo */}
                  {cssRotationActive && (
                    <div
                      ref={employeeInterceptorRef}
                      className="absolute inset-0 z-10"
                      style={{ touchAction: 'none', cursor: 'crosshair' }}
                    />
                  )}
                </div>
                <span className="text-center text-sm text-gray-600 pb-2">{employee?.nome || 'Selecione o funcionário'}</span>
              </div>
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
                    penColor="black"
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
          <Button type="button" variant="outline" onClick={() => {
            if (step - 1 === 1) exitLandscape();
            setStep(step - 1);
          }}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
        )}
        {step < 3 ? (
          <Button type="button" className="ml-auto" onClick={() => {
            if (step + 1 >= 2) requestLandscape();
            setStep(step + 1);
          }}>
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
