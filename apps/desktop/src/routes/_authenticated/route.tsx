import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { configStateQueryOptions, onboardingQueryOptions } from '@/lib/desktop-queries'
import { ONBOARDING_DEFER_SESSION_KEY } from '@/lib/onboarding'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context }) => {
    const state = await context.queryClient.ensureQueryData(configStateQueryOptions)
    if (!state.config) throw redirect({ to: '/setup' })
    const onboarding = await context.queryClient.ensureQueryData(onboardingQueryOptions)
    const deferred = sessionStorage.getItem(ONBOARDING_DEFER_SESSION_KEY) === '1'
    if (!onboarding.completedAt && !deferred) throw redirect({ to: '/setup' })
  },
  component: AuthenticatedLayout,
})
