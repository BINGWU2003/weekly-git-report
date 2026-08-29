import { createFileRoute, redirect } from '@tanstack/react-router'
import { Setup } from '@/features/setup'
import { configStateQueryOptions, projectsStateQueryOptions } from '@/lib/desktop-queries'

export const Route = createFileRoute('/setup')({
  beforeLoad: async ({ context }) => {
    const config = await context.queryClient.ensureQueryData(configStateQueryOptions)
    if (!config.config) return

    const projects = await context.queryClient.ensureQueryData(projectsStateQueryOptions)
    if (projects.projects.length > 0) throw redirect({ to: '/' })
  },
  component: Setup,
})
