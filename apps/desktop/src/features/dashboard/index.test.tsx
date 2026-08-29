import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import type { DesktopAPI, DesktopOverview } from '../../../shared/ipc'
import { Dashboard } from './index'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

vi.mock('@/components/theme-switch', () => ({ ThemeSwitch: () => null }))
vi.mock('@/components/layout/header', () => ({
  Header: ({ children }: { children: ReactNode }) => <header>{children}</header>,
}))
vi.mock('@/components/layout/main', () => ({
  Main: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('Dashboard', () => {
  it('引导未初始化用户前往常规设置', async () => {
    const overview: DesktopOverview = {
      initialized: false,
      config: null,
      projectCount: 0,
      enabledProjectCount: 0,
      reportCount: 0,
      enabledTaskCount: 0,
      runCounts: {},
      diagnostics: [],
    }
    vi.stubGlobal('electronAPI', {
      overview: { get: vi.fn().mockResolvedValue(overview) },
    } as unknown as DesktopAPI)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    const screen = await render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    )

    await expect.element(screen.getByText('尚未完成初始化')).toBeInTheDocument()
    await expect
      .element(screen.getByText('前往常规设置创建共享配置、仓库索引、报告目录和生成模板，无需先运行 CLI。'))
      .toBeInTheDocument()
    await expect.element(screen.getByRole('link', { name: '开始初始化' })).toHaveAttribute('href', '/settings')
    await expect.element(screen.getByText('weekly init')).not.toBeInTheDocument()
  })
})
