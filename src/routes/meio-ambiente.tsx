import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/meio-ambiente')({
  component: MeioAmbienteLayout,
})

function MeioAmbienteLayout() {
  return <Outlet />
}
