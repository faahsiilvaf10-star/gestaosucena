import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/almoxarifado')({
  component: AlmoxarifadoLayout,
})

function AlmoxarifadoLayout() {
  return <Outlet />
}
