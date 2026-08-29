import { queryOptions } from '@tanstack/react-query'

export const desktopQueryKeys = {
  overview: ['desktop-overview'] as const,
  configState: ['config-state'] as const,
  configDefaults: ['config-defaults'] as const,
  projectsState: ['projects-state'] as const,
  projectsRuntime: ['projects-runtime'] as const,
  reports: ['reports'] as const,
  diagnostics: ['desktop-diagnostics'] as const,
}

export const overviewQueryOptions = queryOptions({
  queryKey: desktopQueryKeys.overview,
  queryFn: () => window.electronAPI.overview.get(),
})

export const configStateQueryOptions = queryOptions({
  queryKey: desktopQueryKeys.configState,
  queryFn: () => window.electronAPI.config.state(),
})

export const configDefaultsQueryOptions = queryOptions({
  queryKey: desktopQueryKeys.configDefaults,
  queryFn: () => window.electronAPI.config.defaults(),
})

export const projectsStateQueryOptions = queryOptions({
  queryKey: desktopQueryKeys.projectsState,
  queryFn: () => window.electronAPI.projects.state(),
})

export const diagnosticsQueryOptions = queryOptions({
  queryKey: desktopQueryKeys.diagnostics,
  queryFn: () => window.electronAPI.system.diagnostics(),
})
