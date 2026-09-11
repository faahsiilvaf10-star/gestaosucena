import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'
import { ArrowLeft, Plus, Search, X, Eye, Calendar, User, ShieldCheck, Image as ImageIcon, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useDeleteEpiRequisition } from '@/hooks/useEpiRequisitions'

export const Route = createFileRoute('/almoxarifado/requisicoes/')(
  { component: RequisicoesList }
)

function RequisicoesList() {
  const [search, setSearch] = useState('')
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [reqToDelete, setReqToDelete] = useState<{id: string, name: string} | null>(null)

  const deleteMutation = useDeleteEpiRequisition()

  const { data: requisitions, isLoading } = useQuery({
    queryKey: ['epi_requisitions_list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('al_epi_requisitions')
        .select(`
          *,
          authorizer:rh_efetivo!al_epi_requisitions_authorizer_id_fkey(id, nome, cargo, matricula),
          employee:rh_efetivo!al_epi_requisitions_employee_id_fkey(id, nome, cargo, matricula),
          items:al_epi_requisition_items(
            id,
            quantity,
            product:al_products(id, name)
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erro ao buscar requisições:', error)
        throw error
      }
      return data || []
    }
  })

  const filteredRequisitions = requisitions?.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.employee?.nome?.toLowerCase().includes(q) ||
      r.authorizer?.nome?.toLowerCase().includes(q) ||
      r.reason?.toLowerCase().includes(q) ||
      r.destination_area?.toLowerCase().includes(q)
    )
  }) || []

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Link to="/almoxarifado" className="hover:text-foreground transition-colors flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Almoxarifado
            </Link>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-primary" />
            Requisições
          </h2>
          <p className="text-muted-foreground">
            Histórico de todas as requisições de EPI realizadas.
          </p>
        </div>
        <Link to="/almoxarifado/requisicoes/nova">
          <Button className="bg-green-600 hover:bg-green-700 text-white font-bold gap-2">
            <Plus size={18} />
            Nova Requisição
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <Input
          placeholder="Buscar por nome, autorizador ou motivo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 pr-10"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{filteredRequisitions.length} registro(s)</p>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-20 text-muted-foreground">Carregando requisições...</div>
      ) : filteredRequisitions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
          <ShieldCheck size={48} className="opacity-20" />
          <p>Nenhuma requisição encontrada.</p>
          <Link to="/almoxarifado/requisicoes/nova">
            <Button variant="outline" className="gap-2">
              <Plus size={16} />
              Criar primeira requisição
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequisitions.map(req => {
            const itemNames = req.items?.map((it: any) => it.product?.name).filter(Boolean) || []
            const dateFormatted = req.requisition_date
              ? format(new Date(req.requisition_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })
              : '-'

            return (
              <div
                key={req.id}
                className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Left: employee info */}
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-bold text-lg text-foreground">
                        {req.employee?.nome || 'Sem nome'}
                      </h3>
                      <span className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                        <Calendar size={12} />
                        {dateFormatted}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <User size={14} />
                      Autorizado por: <strong>{req.authorizer?.nome || '-'}</strong>
                      {req.reason && <span> | {req.reason}</span>}
                    </p>
                    {itemNames.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {itemNames.map((name: string, idx: number) => (
                          <span key={idx} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-2">
                    {req.receipt_image_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setSelectedImage(req.receipt_image_url)}
                      >
                        <Eye size={16} />
                        Ver Recibo
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={() => setReqToDelete({ id: req.id, name: req.employee?.nome || 'Sem nome' })}
                    >
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Image Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon size={20} />
            Recibo da Requisição
          </DialogTitle>
          {selectedImage && (
            <div className="mt-4">
              <img
                src={selectedImage}
                alt="Recibo da Requisição"
                className="w-full rounded-lg border"
              />
              <div className="mt-4 flex justify-end">
                <a href={selectedImage} target="_blank" rel="noopener noreferrer" download>
                  <Button variant="outline" className="gap-2">
                    <ImageIcon size={16} />
                    Baixar PNG
                  </Button>
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!reqToDelete} onOpenChange={() => setReqToDelete(null)}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white sm:rounded-2xl">
          <DialogTitle className="text-xl">Excluir Requisição</DialogTitle>
          <div className="py-4 text-zinc-300">
            Tem certeza que deseja excluir a requisição de <strong>{reqToDelete?.name}</strong>?
            <br /><br />
            Essa ação removerá o histórico e <strong>retornará todos os itens dessa requisição para o estoque</strong> automaticamente.
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" className="text-white border-zinc-700 hover:bg-zinc-800 hover:text-white" onClick={() => setReqToDelete(null)}>Cancelar</Button>
            <Button 
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                if (reqToDelete) {
                  await deleteMutation.mutateAsync(reqToDelete.id)
                  setReqToDelete(null)
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Sim, Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
