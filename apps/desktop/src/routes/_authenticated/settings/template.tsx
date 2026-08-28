import { createFileRoute } from '@tanstack/react-router'
import { SettingsTemplate } from '@/features/settings/template'

export const Route = createFileRoute('/_authenticated/settings/template')({
  component: SettingsTemplate,
})
