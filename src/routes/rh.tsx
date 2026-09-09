import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/rh')({
  component: RhLayout,
})

function RhLayout() {
  return <Outlet />
}
