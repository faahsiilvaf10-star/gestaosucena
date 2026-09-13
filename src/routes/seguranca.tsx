import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/seguranca')({
  component: SegurancaLayout,
})

function SegurancaLayout() {
  return <Outlet />
}
