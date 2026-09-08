import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/almoxarifado/pedidos')({
  component: () => <div className="p-8">Página de Pedidos em construção</div>,
})