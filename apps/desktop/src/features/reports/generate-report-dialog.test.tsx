import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { DesktopAPI } from '../../../shared/ipc'
import { GenerateReportDialog } from './generate-report-dialog'
import { ReportGenerationPanel } from './report-generation-panel'

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }))

vi.mock('sonner', () => ({ toast }))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('GenerateReportDialog', () => {
  it('clears the completed report before the dialog is opened again', async () => {
    let onGenerationDelta: ((runId: string, delta: string) => void) | undefined
    const generate = vi.fn().mockImplementation(async () => {
      onGenerationDelta?.('run-1', '# 上次生成的草稿')
      return { id: 'run-1', status: 'awaiting_review' }
    })
    const approve = vi.fn().mockResolvedValue({ id: 'run-1', status: 'succeeded' })
    const onOpenChange = vi.fn()
    const onSaved = vi.fn()
    vi.stubGlobal('electronAPI', {
      runs: {
        onGenerationDelta: vi.fn((listener) => {
          onGenerationDelta = listener
          return () => undefined
        }),
        generate,
        approve,
        cancel: vi.fn(),
      },
    } as unknown as DesktopAPI)

    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const screen = await render(
      <QueryClientProvider client={queryClient}>
        <GenerateReportDialog open onOpenChange={onOpenChange} onSaved={onSaved} />
      </QueryClientProvider>,
    )

    const context = screen.getByPlaceholder('只填写模型无法从 Git 提交中得知的背景或结果。')
    await userEvent.fill(context, '上次填写的补充事实')
    await userEvent.click(screen.getByRole('button', { name: '开始生成' }))
    await expect
      .element(screen.getByRole('textbox', { name: '报告草稿' }))
      .toHaveClass(
        'field-sizing-fixed',
        'h-80',
        'min-h-80',
        'max-h-80',
        'resize-none',
        'overflow-y-auto',
      )
    const save = screen.getByRole('button', { name: '确认并保存' })
    await expect.element(save).not.toBeDisabled()
    await userEvent.click(save)

    await vi.waitFor(() =>
      expect(approve).toHaveBeenCalledWith('run-1', '# 上次生成的草稿', false, false),
    )
    expect(onSaved).toHaveBeenCalledOnce()
    expect(onOpenChange).toHaveBeenCalledWith(false)
    await expect.element(context).toHaveValue('')
    await expect.element(screen.getByText('报告草稿')).not.toBeInTheDocument()
    await expect.element(screen.getByRole('button', { name: '开始生成' })).toBeInTheDocument()
  })

  it('regenerates a custom report with the original identity and period', async () => {
    const generate = vi.fn().mockResolvedValue({ id: 'run-custom', status: 'awaiting_review' })
    vi.stubGlobal('electronAPI', {
      runs: {
        onGenerationDelta: vi.fn(() => () => undefined),
        generate,
        approve: vi.fn(),
        cancel: vi.fn(),
      },
    } as unknown as DesktopAPI)
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const report = {
      id: 'summary/2026/08/2026-08-01_2026-08-03.custom.report-1.md',
      name: '2026-08-01_2026-08-03.custom.report-1.md',
      title: '版本回顾',
      relativePath: 'summary/2026/08/2026-08-01_2026-08-03.custom.report-1.md',
      kind: 'summary' as const,
      role: 'summary' as const,
      period: { start: '2026-08-01', end: '2026-08-03' },
      generatedAt: '2026-08-03T00:00:00.000Z',
      modifiedAt: '2026-08-03T00:00:00.000Z',
      size: 100,
      reportId: 'report-1',
      reportType: 'custom' as const,
      reportTitle: '版本回顾',
    }

    const screen = await render(
      <QueryClientProvider client={queryClient}>
        <GenerateReportDialog
          open
          initialReport={report}
          onOpenChange={vi.fn()}
          onSaved={vi.fn()}
        />
      </QueryClientProvider>,
    )
    await expect
      .element(screen.getByRole('dialog', { name: '重新生成报告' }))
      .toHaveClass(
        'max-h-[calc(100vh-2rem)]',
        'grid-rows-[auto_minmax(0,1fr)_auto]',
        'overflow-hidden',
      )
    await expect.element(screen.getByText('重新生成报告')).toBeInTheDocument()
    await expect
      .element(screen.getByRole('button', { name: /2026-08-01 ~ 2026-08-03/ }))
      .toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '开始生成' }))
    await vi.waitFor(() =>
      expect(generate).toHaveBeenCalledWith({
        reportType: 'custom',
        reportId: 'report-1',
        title: '版本回顾',
        period: { start: '2026-08-01', end: '2026-08-03' },
      }),
    )
  })

  it('空周期不会直接调用 AI，并允许用户明确继续生成', async () => {
    let onGenerationDelta: ((runId: string, delta: string) => void) | undefined
    const generate = vi.fn().mockImplementation(async () => {
      onGenerationDelta?.('run-empty', '')
      throw new Error('所选周期没有匹配的提交。')
    })
    const retry = vi.fn().mockImplementation(async () => {
      onGenerationDelta?.('run-empty', '# 空周期报告')
      return { id: 'run-empty', status: 'awaiting_review' }
    })
    vi.stubGlobal('electronAPI', {
      runs: {
        onGenerationDelta: vi.fn((listener) => {
          onGenerationDelta = listener
          return () => undefined
        }),
        generate,
        get: vi.fn().mockResolvedValue({
          id: 'run-empty',
          status: 'failed',
          error: { code: 'NO_COMMITS', message: '所选周期没有匹配的提交。' },
        }),
        retry,
        approve: vi.fn(),
        cancel: vi.fn(),
      },
    } as unknown as DesktopAPI)
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const screen = await render(
      <QueryClientProvider client={queryClient}>
        <GenerateReportDialog open onOpenChange={vi.fn()} onSaved={vi.fn()} />
      </QueryClientProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: '开始生成' }))
    await expect.element(screen.getByText('这个周期没有匹配提交')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '仍然生成' }))
    await vi.waitFor(() => expect(retry).toHaveBeenCalledWith('run-empty', true))
    await expect
      .element(screen.getByRole('textbox', { name: '报告草稿' }))
      .toHaveValue('# 空周期报告')
  })

  it('根据运行 ID 恢复待审核草稿', async () => {
    const get = vi.fn().mockResolvedValue({
      id: 'run-restored',
      status: 'awaiting_review',
      reportType: 'weekly',
    })
    const readDraft = vi.fn().mockResolvedValue('# 已恢复草稿')
    vi.stubGlobal('electronAPI', {
      runs: {
        onGenerationDelta: vi.fn(() => () => undefined),
        get,
        readDraft,
        generate: vi.fn(),
        approve: vi.fn(),
        retry: vi.fn(),
        cancel: vi.fn(),
      },
    } as unknown as DesktopAPI)
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const screen = await render(
      <QueryClientProvider client={queryClient}>
        <ReportGenerationPanel initialRunId='run-restored' onSaved={vi.fn()} />
      </QueryClientProvider>,
    )

    await expect
      .element(screen.getByRole('textbox', { name: '报告草稿' }))
      .toHaveValue('# 已恢复草稿')
    expect(get).toHaveBeenCalledWith('run-restored')
    expect(readDraft).toHaveBeenCalledWith('run-restored')
    await expect.element(screen.getByRole('button', { name: '确认并保存' })).toBeInTheDocument()
  })
})
