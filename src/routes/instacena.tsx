import { createFileRoute, Outlet } from '@tanstack/react-router'
import { InstacenaLayout } from '../components/instacena/InstacenaLayout'

export const Route = createFileRoute('/instacena')({
  component: InstacenaRoute,
})

function InstacenaRoute() {
  return (
    <InstacenaLayout>
      <Outlet />
    </InstacenaLayout>
  )
}
