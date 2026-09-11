import { createFileRoute, Link } from '@tanstack/react-router'
import { EpiRequisitionForm } from '@/components/almoxarifado/EpiRequisitionForm'
import { ArrowLeft, FileSignature } from 'lucide-react'

export const Route = createFileRoute('/almoxarifado/requisicoes/nova')({
  component: NovaRequisicaoEpiPage,
})

function NovaRequisicaoEpiPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Link to="/almoxarifado" className="hover:text-foreground transition-colors flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Almoxarifado
            </Link>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileSignature className="w-8 h-8 text-primary" />
            Nova Requisição
          </h2>
          <p className="text-muted-foreground">
            Preencha os dados e colete as assinaturas para gerar o recibo e abater o estoque automaticamente.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <EpiRequisitionForm />
      </div>
    </div>
  )
}
