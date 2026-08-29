import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { configStateQueryOptions } from '@/lib/desktop-queries'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context }) => {
    const state = await context.queryClient.ensureQueryData(configStateQueryOptions)
    if (!state.config) throw redirect({ to: '/setup' })
  },
  component: AuthenticatedLayout,
})
