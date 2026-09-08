import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/almoxarifado/notas-fiscais')({
  component: () => <div className="p-8">Página de Notas Fiscais em construção</div>,
})