import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { ReportRun } from '@weekly-git-report/shared'
import type { DesktopAPI } from '../../../shared/ipc'
import { Runs } from './index'

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

describe('Runs', () => {
  it('keeps a long review draft inside a viewport-bounded scrolling editor', async () => {
    const run = {
      id: 'run-review',
      reportId: 'report-review',
      reportType: 'weekly',
      period: { start: '2026-08-17', end: '2026-08-23' },
      trigger: 'manual',
      generator: 'builtin-ai',
      status: 'awaiting_review',
      attempt: 1,
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      steps: [],
      createdAt: '2026-08-24T00:00:00.000Z',
      updatedAt: '2026-08-24T00:01:00.000Z',
    } satisfies ReportRun
    vi.stubGlobal('electronAPI', {
      runs: {
        list: vi.fn().mockResolvedValue([run]),
        readDraft: vi.fn().mockResolvedValue('# 草稿\n\n'.repeat(500)),
      },
    } as unknown as DesktopAPI)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    const screen = await render(
      <QueryClientProvider client={queryClient}>
        <Runs />
      </QueryClientProvider>
    )
    await userEvent.click(screen.getByRole('button', { name: '审核草稿' }))

    await expect.element(screen.getByRole('dialog', { name: '审核周报草稿' })).toHaveClass(
      'h-[calc(100vh-2rem)]',
      'max-h-[48rem]',
      'overflow-hidden'
    )
    await expect.element(screen.getByRole('textbox', { name: '审核报告草稿' })).toHaveClass(
      'field-sizing-fixed',
      'h-full',
      'min-h-0',
      'resize-none',
      'overflow-y-auto'
    )
  })
})
