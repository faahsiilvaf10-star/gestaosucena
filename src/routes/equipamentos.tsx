import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/equipamentos')({
  component: EquipamentosLayout,
})

function EquipamentosLayout() {
  return <Outlet />
}
