import { createFileRoute } from '@tanstack/react-router'
import { Repositories } from '@/features/repositories'

export const Route = createFileRoute('/_authenticated/repositories/')({
  component: Repositories,
})
