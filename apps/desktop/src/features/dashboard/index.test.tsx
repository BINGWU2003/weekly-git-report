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
vi.mock('@/components/layout/header', () => ({ Header: ({ children }: { children: ReactNode }) => <header>{children}</header> }))
vi.mock('@/components/layout/main', () => ({ Main: ({ children }: { children: ReactNode }) => <main>{children}</main> }))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('Dashboard', () => {
  it('为没有仓库的用户保留继续设置入口', async () => {
    const overview: DesktopOverview = {
      initialized: true,
      config: null,
      projectCount: 0,
      enabledProjectCount: 0,
      reportCount: 0,
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

    await expect.element(screen.getByText('还没有添加仓库')).toBeInTheDocument()
    await expect.element(screen.getByRole('link', { name: '继续设置' })).toHaveAttribute('href', '/setup')
    await expect.element(screen.getByRole('link', { name: '仓库管理' })).toHaveAttribute('href', '/repositories')
  })
})
