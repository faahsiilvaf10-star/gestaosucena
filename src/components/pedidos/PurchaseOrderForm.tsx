import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarIcon, Plus, Trash2, Image as ImageIcon, Send, Save, CheckCircle2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCreatePurchaseOrder, useUploadItemImage } from '@/hooks/usePurchaseOrders'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
// import { useAuth } from '@/hooks/useAuth' // Asumindo que existe, usaremos para preencher solicitante

// Constantes
const CATEGORIAS = ['EPI', 'Ferramentas', 'Materiais', 'Produtos Químicos', 'Peças', 'Jardinagem', 'Irrigação', 'Escritório', 'Outros']
const UNIDADES = ['UN', 'PAR', 'CX', 'PCT', 'KG', 'L', 'M', 'M²', 'M³', 'ROLO', 'KIT', 'OUTRO']

// Schema de Validação
const itemSchema = z.object({
  product_name: z.string().min(2, 'Nome do produto é obrigatório'),
  category: z.string().min(1, 'Categoria é obrigatória'),
  quantity: z.number().positive('A quantidade deve ser maior que zero'),
  unit: z.string().min(1, 'Unidade é obrigatória'),
  description: z.string().optional(),
  imageFile: z.any().optional(), // Arquivo local antes do upload
  imagePreview: z.string().optional(),
})

const formSchema = z.object({
  expected_delivery_date: z.date({ required_error: 'A data prevista é obrigatória' }),
  responsible_id: z.string({ required_error: 'Selecione um responsável' }).min(1, 'Selecione um responsável'),
  priority: z.enum(['Normal', 'Urgente', 'Crítico']),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Adicione pelo menos 1 item ao pedido'),
})

type FormValues = z.infer<typeof formSchema>

export function PurchaseOrderForm() {
  const navigate = useNavigate()
  // const { user } = useAuth() // Em um caso real teríamos o user id aqui
  const mockUserId = '00000000-0000-0000-0000-000000000000' // Placeholder se auth não estiver implementado ou não disponível diretamente

  const createOrder = useCreatePurchaseOrder()
  const uploadImage = useUploadItemImage()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [formDataForConfirm, setFormDataForConfirm] = useState<FormValues | null>(null)

  // Fetch de Responsáveis Autorizados
  const { data: responsaveis, isLoading: isLoadingResponsaveis } = useQuery({
    queryKey: ['rh_efetivo_responsaveis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_efetivo')
        .select('id, nome, cargo')
        .in('cargo', ['Almoxarife', 'Auxiliar Administrativo'])
        .eq('status', 'Ativo')
        .order('nome')
      
      if (error) throw error
      return data || []
    }
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      priority: 'Normal',
      items: [{
        product_name: '',
        category: '',
        quantity: 1,
        unit: 'UN',
        description: '',
      }]
    }
  })

  const { fields, append, remove } = useFieldArray({
    name: 'items',
    control: form.control
  })

  const handleImageChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validar tamanho
      if (file.size > 5 * 1024 * 1024) {
        toast.error('A imagem deve ter no máximo 5MB')
        return
      }
      
      const previewUrl = URL.createObjectURL(file)
      form.setValue(`items.${index}.imageFile`, file)
      form.setValue(`items.${index}.imagePreview`, previewUrl)
    }
  }

  const onSubmit = (data: FormValues) => {
    setFormDataForConfirm(data)
    setShowConfirmModal(true)
  }

  const handleConfirmSubmit = async (status: 'Rascunho' | 'Solicitado') => {
    if (!formDataForConfirm) return
    
    setIsSubmitting(true)
    try {
      const data = formDataForConfirm
      
      // Fazer upload das imagens sequencialmente ou em Promise.all
      const processedItems = await Promise.all(data.items.map(async (item) => {
        let image_path = null
        
        if (item.imageFile) {
          const fileExt = item.imageFile.name.split('.').pop()
          const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
          const filePath = `${fileName}` // no root do bucket
          
          try {
            image_path = await uploadImage.mutateAsync({ file: item.imageFile, path: filePath })
          } catch (e) {
            console.error('Falha no upload', e)
          }
        }
        
        return {
          product_name: item.product_name,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          description: item.description,
          image_path: image_path
        }
      }))

      // Criar o pedido
      const order = await createOrder.mutateAsync({
        requester_user_id: mockUserId, // Idealmente user.id
        responsible_id: data.responsible_id,
        expected_delivery_date: data.expected_delivery_date.toISOString(),
        priority: data.priority,
        notes: data.notes || null,
        status: status,
        items: processedItems
      })

      setShowConfirmModal(false)
      
      // Limpar formulário
      form.reset()
      
      // Redirecionar para visualização ou listagem
      navigate({ to: '/almoxarifado/pedidos' })

    } catch (error) {
      console.error(error)
      toast.error('Erro ao salvar o pedido')
    } finally {
      setIsSubmitting(false)
    }
  }

  const onError = (errors: any) => {
    console.error("Erros de validação:", errors)
    toast.error('Preencha os campos obrigatórios corretamente.')
  }

  return (
    <div className="space-y-6">
      <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-8">
        
        {/* Dados do Pedido */}
        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2 border-b pb-4 mb-4">
            <h3 className="text-xl font-bold">Dados do Pedido</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2 flex flex-col">
              <Label>Previsão de Recebimento <span className="text-destructive">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.watch('expected_delivery_date') && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch('expected_delivery_date') ? (
                      format(form.watch('expected_delivery_date'), "PPP", { locale: ptBR })
                    ) : (
                      <span>Selecionar data...</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.watch('expected_delivery_date')}
                    onSelect={(d) => d && form.setValue('expected_delivery_date', d)}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
              {form.formState.errors.expected_delivery_date && (
                <p className="text-sm text-destructive">{form.formState.errors.expected_delivery_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Responsável <span className="text-destructive">*</span></Label>
              <Select onValueChange={(val) => form.setValue('responsible_id', val)} value={form.watch('responsible_id')}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingResponsaveis ? "Carregando..." : "Selecionar responsável..."} />
                </SelectTrigger>
                <SelectContent>
                  {responsaveis?.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nome} — {r.cargo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.responsible_id && (
                <p className="text-sm text-destructive">{form.formState.errors.responsible_id.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select onValueChange={(val: any) => form.setValue('priority', val)} value={form.watch('priority')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Urgente">Urgente</SelectItem>
                  <SelectItem value="Crítico">Crítico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Observações Gerais</Label>
            <Textarea 
              placeholder="Ex: Materiais necessários para execução das atividades de setembro." 
              {...form.register('notes')}
            />
          </div>
        </div>

        {/* Itens do Pedido */}
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b flex justify-between items-center bg-muted/20">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                Itens Solicitados
                <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-1 rounded-full ml-2">
                  {fields.length} {fields.length === 1 ? 'item' : 'itens'}
                </span>
              </h3>
            </div>
          </div>
          
          <div className="p-6 space-y-6 bg-muted/10">
            {fields.map((field, index) => (
              <div key={field.id} className="bg-card border rounded-xl p-5 relative shadow-sm hover:border-primary/50 transition-colors">
                <div className="absolute -left-3 -top-3 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm shadow-sm border-2 border-card">
                  {(index + 1).toString().padStart(2, '0')}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mt-2">
                  {/* Foto Preview / Upload */}
                  <div className="md:col-span-3 flex flex-col items-center gap-2">
                    <Label className="self-start text-xs text-muted-foreground">Foto do Produto</Label>
                    <div 
                      className="w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center relative overflow-hidden bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
                      onClick={() => document.getElementById(`file-${index}`)?.click()}
                    >
                      {form.watch(`items.${index}.imagePreview`) ? (
                        <img 
                          src={form.watch(`items.${index}.imagePreview`)} 
                          alt="Preview" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <>
                          <ImageIcon className="w-8 h-8 text-muted-foreground mb-2 group-hover:scale-110 transition-transform" />
                          <span className="text-xs text-muted-foreground font-medium">Adicionar Foto</span>
                        </>
                      )}
                      <input 
                        id={`file-${index}`}
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleImageChange(index, e)}
                      />
                    </div>
                  </div>
                  
                  {/* Campos do Produto */}
                  <div className="md:col-span-9 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Produto <span className="text-destructive">*</span></Label>
                        <Input placeholder="Ex: Luva de Vaqueta" {...form.register(`items.${index}.product_name`)} />
                        {form.formState.errors.items?.[index]?.product_name && (
                          <p className="text-xs text-destructive">{form.formState.errors.items[index]?.product_name?.message}</p>
                        )}
                      </div>
                      
                      <div className="space-y-1.5 flex flex-col">
                        <Label>Categoria <span className="text-destructive">*</span></Label>
                        <Select onValueChange={(val) => form.setValue(`items.${index}.category`, val)} value={form.watch(`items.${index}.category`)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.items?.[index]?.category && (
                          <p className="text-xs text-destructive">{form.formState.errors.items[index]?.category?.message}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5 sm:col-span-1">
                        <Label>Quantidade <span className="text-destructive">*</span></Label>
                        <Input 
                          type="number" 
                          min="0.1" 
                          step="any"
                          {...form.register(`items.${index}.quantity`, { valueAsNumber: true })} 
                        />
                        {form.formState.errors.items?.[index]?.quantity && (
                          <p className="text-xs text-destructive">{form.formState.errors.items[index]?.quantity?.message}</p>
                        )}
                      </div>
                      
                      <div className="space-y-1.5 sm:col-span-1 flex flex-col">
                        <Label>Unidade <span className="text-destructive">*</span></Label>
                        <Select onValueChange={(val) => form.setValue(`items.${index}.unit`, val)} value={form.watch(`items.${index}.unit`)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.items?.[index]?.unit && (
                          <p className="text-xs text-destructive">{form.formState.errors.items[index]?.unit?.message}</p>
                        )}
                      </div>
                      
                      <div className="sm:col-span-3 space-y-1.5">
                        <Label>Especificação / Descrição</Label>
                        <Input placeholder="Ex: Punho 15 cm, tamanho G." {...form.register(`items.${index}.description`)} />
                      </div>
                    </div>
                  </div>
                </div>

                {fields.length > 1 && (
                  <div className="mt-4 flex justify-end border-t pt-3">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remover Item
                    </Button>
                  </div>
                )}
              </div>
            ))}
            
            {form.formState.errors.items?.root && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {form.formState.errors.items.root.message}
              </div>
            )}
            
            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed border-2 bg-transparent hover:bg-muted/50 py-8 text-muted-foreground"
              onClick={() => append({ product_name: '', category: '', quantity: 1, unit: 'UN', description: '' })}
            >
              <Plus className="mr-2 h-5 w-5" />
              ADICIONAR NOVO ITEM
            </Button>
          </div>
        </div>

        {/* Resumo e Ações */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-end bg-card p-6 rounded-xl border shadow-sm sticky bottom-4 z-10">
          <div className="text-sm text-muted-foreground mr-auto hidden md:block">
            Verifique todos os campos antes de enviar. O número do pedido será gerado ao confirmar.
          </div>
          
          <Button 
            type="button" 
            variant="outline" 
            size="lg"
            onClick={form.handleSubmit(() => {
              setFormDataForConfirm(form.getValues())
              handleConfirmSubmit('Rascunho')
            }, onError)}
            disabled={isSubmitting}
          >
            <Save className="w-4 h-4 mr-2" />
            Salvar Rascunho
          </Button>
          
          <Button 
            type="submit" 
            size="lg"
            className="bg-primary shadow-md hover:shadow-lg transition-shadow"
            disabled={isSubmitting}
          >
            <Send className="w-4 h-4 mr-2" />
            ENVIAR PEDIDO
          </Button>
        </div>
      </form>

      {/* Modal de Confirmação Final */}
      {showConfirmModal && formDataForConfirm && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 bg-primary/10 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-primary" />
                Confirmar Pedido
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-muted/50 p-3 rounded-lg">
                  <span className="text-muted-foreground block mb-1">Total de Itens</span>
                  <span className="font-bold text-lg">{formDataForConfirm.items.length}</span>
                </div>
                
                <div className="bg-muted/50 p-3 rounded-lg">
                  <span className="text-muted-foreground block mb-1">Previsão</span>
                  <span className="font-bold">{format(formDataForConfirm.expected_delivery_date, "dd/MM/yyyy")}</span>
                </div>
                
                <div className="bg-muted/50 p-3 rounded-lg col-span-2">
                  <span className="text-muted-foreground block mb-1">Responsável</span>
                  <span className="font-bold">
                    {responsaveis?.find(r => r.id === formDataForConfirm.responsible_id)?.nome || 'Selecionado'}
                  </span>
                </div>
                
                {formDataForConfirm.priority !== 'Normal' && (
                  <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 p-3 rounded-lg col-span-2">
                    <span className="font-bold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Prioridade: {formDataForConfirm.priority}
                    </span>
                  </div>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground text-center mt-4">
                O número do pedido será gerado automaticamente.
              </p>
            </div>
            
            <div className="p-4 border-t bg-muted/20 flex justify-end gap-3">
              <Button 
                variant="ghost" 
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
              >
                Voltar
              </Button>
              <Button 
                onClick={() => handleConfirmSubmit('Solicitado')}
                disabled={isSubmitting}
                className="shadow-sm"
              >
                {isSubmitting ? 'Gerando pedido...' : 'Confirmar e Enviar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
