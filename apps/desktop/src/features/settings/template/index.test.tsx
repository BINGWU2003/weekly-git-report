import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Period, SummaryTemplateResult } from '@weekly-git-report/shared'
import type { DesktopAPI } from '../../../../shared/ipc'
import { SummaryTemplateEditor } from './index'

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))

vi.mock('@/hooks/use-unsaved-changes', () => ({ useUnsavedChanges: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

const period: Period = { start: '2026-08-18', end: '2026-08-24' }
const content = '# 规则\n\n周期：{{startDate}} ~ {{endDate}}\n'
const initial: SummaryTemplateResult = {
  formatVersion: 1,
  type: 'weekly',
  template: {
    content,
    renderedContent: '# 规则\n\n周期：2026-08-18 ~ 2026-08-24\n',
    path: 'C:/Users/test/.weekly-git-report/templates/weekly/summary.md',
    revision: 'revision-1',
    defaultRevision: 'default-revision',
    isDefault: true,
  },
  created: false,
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('SummaryTemplateEditor', () => {
  it('previews and saves a revision-protected template edit', async () => {
    const updatedContent = content.replace('# 规则', '# 自定义规则')
    const preview = vi.fn().mockResolvedValue(
      updatedContent
        .replace('{{startDate}}', period.start)
        .replace('{{endDate}}', period.end)
    )
    const save = vi.fn().mockResolvedValue({
      ...initial,
      template: {
        ...initial.template,
        content: updatedContent,
        renderedContent: updatedContent
          .replace('{{startDate}}', period.start)
          .replace('{{endDate}}', period.end),
        revision: 'revision-2',
        isDefault: false,
      },
    })
    vi.stubGlobal('electronAPI', {
      templates: { preview, save, read: vi.fn(), reset: vi.fn() },
    } as unknown as DesktopAPI)

    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const screen = await render(
      <QueryClientProvider client={queryClient}>
        <SummaryTemplateEditor initial={initial} period={period} />
      </QueryClientProvider>
    )

    await userEvent.fill(screen.getByRole('textbox', { name: '周报生成提示词' }), updatedContent)
    await vi.waitFor(() => expect(preview).toHaveBeenCalledWith({ content: updatedContent, period }))
    await userEvent.click(screen.getByRole('button', { name: '保存模板' }))

    await vi.waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        content: updatedContent,
        expectedRevision: 'revision-1',
        period,
      })
    )
    expect(toast.success).toHaveBeenCalledWith('生成模板已保存', { duration: 3000 })
  })

  it('重新读取期间防止重复操作并在成功后提示', async () => {
    let resolveRead: (value: SummaryTemplateResult) => void = () => undefined
    const read = vi.fn().mockImplementation(
      () => new Promise<SummaryTemplateResult>((resolve) => {
        resolveRead = resolve
      })
    )
    vi.stubGlobal('electronAPI', {
      templates: {
        preview: vi.fn().mockResolvedValue(initial.template.renderedContent),
        save: vi.fn(),
        read,
        reset: vi.fn(),
      },
    } as unknown as DesktopAPI)

    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const screen = await render(
      <QueryClientProvider client={queryClient}>
        <SummaryTemplateEditor initial={initial} period={period} />
      </QueryClientProvider>
    )
    const reload = screen.getByRole('button', { name: '重新读取' })

    await userEvent.click(reload)
    await expect.element(reload).toBeDisabled()
    expect(read).toHaveBeenCalledTimes(1)

    resolveRead({
      ...initial,
      template: { ...initial.template, revision: 'revision-2' },
    })
    await vi.waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('生成模板已重新读取', { duration: 3000 })
    })
    await expect.element(reload).not.toBeDisabled()
  })
})
