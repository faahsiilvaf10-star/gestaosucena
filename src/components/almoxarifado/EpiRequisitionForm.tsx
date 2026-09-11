import React, { useState, useRef, useEffect } from 'react';
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
import { Search, ChevronsUpDown, Check, AlertCircle, Save } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

// Gera um recibo em PNG via Canvas nativo (sem dependência de html-to-image)
function generateReceiptPng(
  employee: { nome: string; cargo?: string; matricula?: string },
  authorizer: { nome: string },
  items: Array<{ productId: string; quantity: number }>,
  products: Array<{ id: string; name: string }>,
  authSig: string | null,
  empSig: string | null,
  date: string
): Promise<string> {
  return new Promise((resolve) => {
    const W = 800;
    const lineH = 28;
    const padX = 40;
    const rows = items.length;
    const H = 440 + rows * lineH + 180;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // header bar
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, 80);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Arial';
    ctx.fillText('REQUISIÇÃO DE EPI / UNIFORME', padX, 50);
    ctx.font = '14px Arial';
    ctx.fillText(`Data: ${date}`, W - 180, 50);

    let y = 110;
    ctx.fillStyle = '#111';

    // Employee info
    ctx.font = 'bold 15px Arial';
    ctx.fillText('FUNCIONÁRIO', padX, y);
    ctx.font = '14px Arial';
    y += 24;
    ctx.fillText(`Nome: ${employee.nome}`, padX, y);
    y += 22;
    ctx.fillText(`Cargo: ${employee.cargo || '-'}`, padX, y);
    y += 22;
    ctx.fillText(`Matrícula: ${employee.matricula || '-'}`, padX, y);
    y += 22;
    ctx.fillText(`Autorizado por: ${authorizer.nome}`, padX, y);

    y += 40;
    // divider
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();
    y += 20;

    // Items table header
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(padX, y, W - padX * 2, 30);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 13px Arial';
    ctx.fillText('ITEM', padX + 8, y + 20);
    ctx.fillText('QUANTIDADE', W - 180, y + 20);
    y += 30;

    // Items rows
    ctx.font = '13px Arial';
    items.forEach((item, idx) => {
      const prod = products.find(p => p.id === item.productId);
      const bg = idx % 2 === 0 ? '#fafafa' : '#ffffff';
      ctx.fillStyle = bg;
      ctx.fillRect(padX, y, W - padX * 2, lineH);
      ctx.fillStyle = '#222';
      ctx.fillText(prod?.name || item.productId, padX + 8, y + 19);
      ctx.fillText(String(item.quantity), W - 150, y + 19);
      y += lineH;
    });

    y += 40;
    // divider
    ctx.strokeStyle = '#ccc';
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();
    y += 30;

    // Signatures
    const sigW = (W - padX * 3) / 2;
    const sigH = 90;

    // Authorizer sig
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#555';
    ctx.fillText('Assinatura do Autorizador', padX, y);
    y += 8;
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.strokeRect(padX, y, sigW, sigH);
    if (authSig) {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, padX + 4, y + 4, sigW - 8, sigH - 8); };
      img.src = authSig;
    }
    ctx.fillStyle = '#222';
    ctx.font = '12px Arial';
    ctx.fillText(authorizer.nome, padX + 4, y + sigH + 16);

    // Employee sig
    const empX = padX * 2 + sigW;
    ctx.fillStyle = '#555';
    ctx.font = 'bold 12px Arial';
    ctx.fillText('Assinatura do Recebedor', empX, y - 8);
    ctx.strokeStyle = '#aaa';
    ctx.strokeRect(empX, y, sigW, sigH);
    if (empSig) {
      const img2 = new Image();
      img2.onload = () => { ctx.drawImage(img2, empX + 4, y + 4, sigW - 8, sigH - 8); };
      img2.src = empSig;
    }
    ctx.fillStyle = '#222';
    ctx.font = '12px Arial';
    ctx.fillText(employee.nome, empX + 4, y + sigH + 16);

    // Give images time to load then resolve
    setTimeout(() => resolve(canvas.toDataURL('image/png')), 300);
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
  
  const [items, setItems] = useState<{ productId: string, quantity: number }[]>([]);
  
  const authorizerSigRef = useRef<SignatureCanvas>(null);
  const employeeSigRef = useRef<SignatureCanvas>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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
        { nome: authorizer!.nome },
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
    <div className="space-y-8 pb-20 relative">
      <div className="bg-card border rounded-xl p-6 shadow-sm space-y-6">
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
      <div className="bg-card border rounded-xl p-6 shadow-sm space-y-6">
        <div className="border-b pb-4">
          <h3 className="text-xl font-bold">EPI</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {epiProducts?.filter(p => !p.name.toLowerCase().includes('camisa') && !p.name.toLowerCase().includes('calça') && !p.category?.name?.toLowerCase().includes('uniforme')).map(p => {
            const isSelected = items.some(i => i.productId === p.id);
            const item = items.find(i => i.productId === p.id);
            return (
              <div key={p.id} className="flex flex-col space-y-2">
                <div className="flex items-center space-x-3">
                  <Checkbox 
                    id={`epi-${p.id}`} 
                    checked={isSelected} 
                    onCheckedChange={(c) => handleToggleItem(p.id, !!c)}
                    disabled={p.current_quantity <= 0}
                  />
                  <Label 
                    htmlFor={`epi-${p.id}`} 
                    className={`text-base font-medium cursor-pointer ${p.current_quantity <= 0 ? 'text-muted-foreground line-through' : ''}`}
                  >
                    {p.name}
                  </Label>
                </div>
                
                {isSelected && (
                  <div className="pl-7 flex items-center space-x-3 animate-in fade-in zoom-in duration-200">
                    <Label className="text-xs text-muted-foreground">Qtd:</Label>
                    <Input 
                      type="number" 
                      className="w-20 h-8 text-sm" 
                      min="1" 
                      max={p.current_quantity}
                      value={item?.quantity || 1} 
                      onChange={(e) => updateItemQuantity(p.id, parseInt(e.target.value) || 1)} 
                    />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-medium text-destructive">Estoque: {p.current_quantity} unidade(s)</span>
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
           {epiProducts?.filter(p => p.name.toLowerCase().includes('camisa') || p.name.toLowerCase().includes('calça') || p.category?.name?.toLowerCase().includes('uniforme')).map(p => {
            const isSelected = items.some(i => i.productId === p.id);
            const item = items.find(i => i.productId === p.id);
            return (
              <div key={p.id} className="flex items-center space-x-4">
                <div className="w-48">
                  <Label className="font-semibold">{p.name}:</Label>
                </div>
                <div className="flex items-center space-x-3 flex-1">
                  <Checkbox 
                    id={`unif-${p.id}`} 
                    checked={isSelected} 
                    onCheckedChange={(c) => handleToggleItem(p.id, !!c)}
                    disabled={p.current_quantity <= 0}
                  />
                  <Label htmlFor={`unif-${p.id}`} className="text-sm cursor-pointer">Selecionar</Label>
                  
                  {isSelected && (
                    <div className="flex items-center space-x-3 ml-4">
                      <Label className="text-xs text-muted-foreground">Qtd:</Label>
                      <Input 
                        type="number" 
                        className="w-20 h-8 text-sm" 
                        min="1" 
                        max={p.current_quantity}
                        value={item?.quantity || 1} 
                        onChange={(e) => updateItemQuantity(p.id, parseInt(e.target.value) || 1)} 
                      />
                      <span className="text-xs text-destructive">Estoque: {p.current_quantity}</span>
                    </div>
                  )}
                </div>
              </div>
            );
           })}
           {epiProducts?.filter(p => p.name.toLowerCase().includes('camisa') || p.name.toLowerCase().includes('calça') || p.category?.name?.toLowerCase().includes('uniforme')).length === 0 && (
             <p className="text-sm text-muted-foreground">Nenhum uniforme encontrado no estoque.</p>
           )}
        </div>
      </div>

      {/* Signatures */}
      <div className="bg-card border rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex justify-between items-center border-b pb-4">
          <h3 className="text-xl font-bold">Assinaturas</h3>
          <Button type="button" variant="ghost" size="sm" onClick={clearSignatures}>Limpar Assinaturas</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2 flex flex-col items-center">
            <Label className="text-center font-bold">ASSINATURA DO AUTORIZADOR</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white w-full max-w-sm">
              <SignatureCanvas 
                ref={authorizerSigRef} 
                penColor="black"
                canvasProps={{ width: 380, height: 150, className: 'sigCanvas' }} 
              />
            </div>
            <span className="text-sm text-muted-foreground">{authorizer?.nome || 'Selecione o autorizador'}</span>
          </div>

          <div className="space-y-2 flex flex-col items-center">
            <Label className="text-center font-bold">ASSINATURA DO FUNCIONÁRIO</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white w-full max-w-sm">
              <SignatureCanvas 
                ref={employeeSigRef} 
                penColor="black"
                canvasProps={{ width: 380, height: 150, className: 'sigCanvas' }} 
              />
            </div>
            <span className="text-sm text-muted-foreground">{employee?.nome || 'Selecione o funcionário'}</span>
          </div>
        </div>
      </div>

      {/* Fixed Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg flex justify-end gap-4 z-50">
         <div className="flex items-center text-sm text-muted-foreground mr-auto hidden sm:flex">
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
