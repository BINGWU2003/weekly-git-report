import { createFileRoute } from '@tanstack/react-router'
import { SettingsAutomation } from '@/features/settings/automation'

export const Route = createFileRoute('/_authenticated/settings/automation')({
  component: SettingsAutomation,
})
