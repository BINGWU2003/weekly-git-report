import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Config, ReportCadence, SummaryTemplateResult } from '@weekly-git-report/shared'
import type { DesktopAPI } from '../../../shared/ipc'
import { Setup } from './index'

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useNavigate: () => mocks.navigate }
})
vi.mock('@/components/theme-switch', () => ({ ThemeSwitch: () => null }))
vi.mock('@/features/repositories/repository-form', () => ({ RepositoryForm: () => null }))
vi.mock('@/features/repositories/repository-import-sheet', () => ({ RepositoryImportSheet: () => null }))

const config: Config = {
  outputRoot: 'D:/reports',
  repositoryCacheRoot: 'D:/cache',
  defaultSince: 'last monday',
  defaultUntil: 'now',
  includeEmptyProjects: true,
  identities: [{ name: 'Alice', email: 'alice@example.com' }],
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('Setup', () => {
  it('在 Git 不可用时阻止首次配置继续', async () => {
    vi.stubGlobal('electronAPI', {
      config: {
        state: vi.fn().mockResolvedValue({ config: null, revision: null }),
        defaults: vi.fn().mockResolvedValue({ config, detectedIdentity: null }),
      },
      projects: { state: vi.fn() },
      system: {
        diagnostics: vi.fn().mockResolvedValue([
          { id: 'git', label: 'Git', status: 'error', message: 'git command not found' },
        ]),
      },
      templates: { read: vi.fn() },
    } as unknown as DesktopAPI)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const screen = await render(
      <QueryClientProvider client={queryClient}>
        <Setup />
      </QueryClientProvider>
    )

    await expect.element(screen.getByText('未检测到可用的 Git')).toBeInTheDocument()
    await expect.element(screen.getByText(/请先安装 Git/)).toBeInTheDocument()
    await expect.element(screen.getByRole('button', { name: '继续', exact: true })).toBeDisabled()
  })

  it('允许已有配置的用户跳过仓库并进入工作台', async () => {
    const readTemplate = vi.fn((cadence: ReportCadence) => Promise.resolve(template(cadence)))
    vi.stubGlobal('electronAPI', {
      config: {
        state: vi.fn().mockResolvedValue({ config, revision: 'config-revision' }),
        defaults: vi.fn(),
      },
      projects: {
        state: vi.fn().mockResolvedValue({ projects: [], revision: 'projects-revision' }),
      },
      system: {
        diagnostics: vi.fn().mockResolvedValue([
          { id: 'git', label: 'Git', status: 'ok', message: 'git version 2.50.0' },
          { id: 'config', label: '全局配置', status: 'ok', message: 'D:/config.json' },
          { id: 'projects', label: '仓库配置', status: 'ok', message: 'D:/projects.json' },
          { id: 'output', label: '报告目录', status: 'ok', message: 'D:/reports' },
        ]),
      },
      templates: { read: readTemplate },
    } as unknown as DesktopAPI)

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const screen = await render(
      <QueryClientProvider client={queryClient}>
        <Setup />
      </QueryClientProvider>
    )

    await userEvent.click(screen.getByRole('button', { name: '稍后添加' }))
    await expect.element(screen.getByText('日报、周报、月报均已就绪')).toBeInTheDocument()
    expect(readTemplate).toHaveBeenCalledTimes(3)

    await userEvent.click(screen.getByRole('button', { name: '进入工作台', exact: true }))
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' })
  })
})

function template(cadence: ReportCadence): SummaryTemplateResult {
  return {
    formatVersion: 1,
    type: cadence,
    created: false,
    template: {
      content: '# template\n',
      renderedContent: null,
      path: `D:/templates/${cadence}/summary.md`,
      revision: `${cadence}-revision`,
      defaultRevision: `${cadence}-revision`,
      isDefault: true,
    },
  }
}
