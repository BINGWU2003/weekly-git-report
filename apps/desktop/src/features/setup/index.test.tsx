import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Config } from '@weekly-git-report/shared'
import type { DesktopAPI, DesktopReadiness, OnboardingState } from '../../../shared/ipc'
import { Setup } from './index'

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
    useNavigate: () => mocks.navigate,
  }
})
vi.mock('@/components/theme-switch', () => ({ ThemeSwitch: () => null }))
vi.mock('@/features/repositories/repository-form', () => ({ RepositoryForm: () => null }))
vi.mock('@/features/repositories/repository-import-sheet', () => ({
  RepositoryImportSheet: () => null,
}))

const config: Config = {
  outputRoot: 'D:/reports',
  repositoryCacheRoot: 'D:/cache',
  includeEmptyProjects: true,
  identities: [{ name: 'Alice', email: 'alice@example.com' }],
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('Setup', () => {
  it('在 Git 不可用时阻止进入作者身份步骤', async () => {
    stubApi(onboardingState({ gitReady: false }))
    const screen = await renderSetup()

    await expect.element(screen.getByText('未检测到可用的 Git')).toBeInTheDocument()
    await expect.element(screen.getByText('git command not found')).toBeInTheDocument()
    await expect.element(screen.getByRole('button', { name: /继续设置作者身份/ })).toBeDisabled()
  })

  it('要求至少一个启用仓库，不能跳过必要步骤', async () => {
    stubApi(
      onboardingState({
        gitReady: true,
        configReady: true,
        workspaceReady: true,
        repositoryReady: false,
      }),
      true,
    )
    const screen = await renderSetup()

    await expect.element(screen.getByText('需要至少一个启用仓库')).toBeInTheDocument()
    await expect.element(screen.getByText('首份报告会使用全部启用仓库。')).toBeInTheDocument()
    await expect.element(screen.getByRole('button', { name: /继续配置 AI/ })).toBeDisabled()
    await expect.element(screen.getByText('稍后添加')).not.toBeInTheDocument()
  })

  it('完成后展示可重入的只读检查清单', async () => {
    stubApi(
      {
        ...onboardingState({
          gitReady: true,
          configReady: true,
          workspaceReady: true,
          repositoryReady: true,
          enabledRepositoryCount: 1,
          aiReady: true,
          templatesReady: true,
          templateTypesReady: ['daily', 'weekly', 'monthly', 'custom'],
          firstReportReady: true,
        }),
        completedAt: '2026-08-29T00:00:00.000Z',
      },
      true,
    )
    const screen = await renderSetup()

    await expect
      .element(screen.getByRole('heading', { name: '首次设置检查' }))
      .toBeInTheDocument()
    await expect.element(screen.getByText('四套报告模板')).toBeInTheDocument()
    await expect
      .element(screen.getByRole('link', { name: '修改设置' }))
      .toHaveAttribute('href', '/settings')
  })

  it('允许暂时跳过 AI 并直接完成首次设置', async () => {
    const initial = onboardingState({
      gitReady: true,
      configReady: true,
      workspaceReady: true,
      repositoryReady: true,
      enabledRepositoryCount: 1,
      templatesReady: true,
      templateTypesReady: ['daily', 'weekly', 'monthly', 'custom'],
    })
    const skipped: OnboardingState = {
      ...initial,
      completedAt: '2026-08-31T00:00:00.000Z',
      aiSkippedAt: '2026-08-31T00:00:00.000Z',
      readiness: { ...initial.readiness, aiSkipped: true },
    }
    const api = stubApi(initial, true)
    vi.mocked(api.onboarding.skipAi).mockResolvedValueOnce(skipped)
    const screen = await renderSetup()

    await userEvent.click(screen.getByRole('button', { name: '暂时跳过', exact: true }))

    await vi.waitFor(() => {
      expect(api.onboarding.skipAi).toHaveBeenCalledOnce()
      expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' })
    })
  })
})

function readiness(patch: Partial<DesktopReadiness> = {}): DesktopReadiness {
  return {
    gitReady: false,
    configReady: false,
    workspaceReady: false,
    repositoryReady: false,
    enabledRepositoryCount: 0,
    aiReady: false,
    aiTested: false,
    aiSkipped: false,
    templatesReady: false,
    templateTypesReady: [],
    feishuReady: false,
    firstReportReady: false,
    ...patch,
  }
}

function onboardingState(patch: Partial<DesktopReadiness>): OnboardingState {
  return { version: 1, readiness: readiness(patch) }
}

function stubApi(onboarding: OnboardingState, initialized = false) {
  const api = {
    onboarding: {
      state: vi.fn().mockResolvedValue(onboarding),
      rememberRun: vi.fn(),
      complete: vi.fn(),
      skipAi: vi.fn(),
    },
    config: {
      state: vi
        .fn()
        .mockResolvedValue(
          initialized ? { config, revision: 'config-revision' } : { config: null, revision: null },
        ),
      defaults: vi.fn().mockResolvedValue({ config, detectedIdentity: null }),
      initialize: vi.fn(),
    },
    projects: {
      state: vi.fn().mockResolvedValue({ projects: [], revision: 'projects-revision' }),
    },
    ai: {
      status: vi.fn().mockResolvedValue({ configured: false }),
      configure: vi.fn(),
      test: vi.fn(),
      clear: vi.fn(),
    },
    system: {
      diagnostics: vi.fn().mockResolvedValue([
        {
          id: 'git',
          label: 'Git',
          status: onboarding.readiness.gitReady ? 'ok' : 'error',
          message: onboarding.readiness.gitReady ? 'git version 2.50.0' : 'git command not found',
        },
      ]),
    },
    updates: {
      status: vi.fn().mockResolvedValue({
        phase: 'disabled',
        currentVersion: '0.0.0',
        releaseUrl: 'https://github.com/example/releases/latest',
        disabledReason: '测试环境不启用自动更新。',
      }),
      check: vi.fn(),
      openRelease: vi.fn(),
      onStatusChange: vi.fn().mockReturnValue(vi.fn()),
    },
  } as unknown as DesktopAPI
  vi.stubGlobal('electronAPI', api)
  return api
}

async function renderSetup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Setup />
    </QueryClientProvider>,
  )
}
