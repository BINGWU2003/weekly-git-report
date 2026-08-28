import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { ReportFile } from '../../../shared/ipc'
import { ReportListItem } from './index'

const report: ReportFile = {
  id: 'summary/2026/08/weekly-report.md',
  name: 'weekly-report-with-a-very-long-file-name-that-does-not-fit.md',
  title: '这是一份标题很长很长并且需要在报告列表中被截断后通过提示完整展示的周报',
  relativePath: 'summary/2026/08/a-very-long-folder-name/weekly-report.md',
  kind: 'summary',
  role: 'summary',
  period: { start: '2026-08-17', end: '2026-08-23' },
  generatedAt: '2026-08-23T10:00:00.000Z',
  modifiedAt: '2026-08-23T10:00:00.000Z',
  size: 1024,
  cadence: 'weekly',
  summaryMetadataStatus: 'invalid',
  summaryMetadataMessage: 'Hash mismatch',
}

describe('ReportListItem', () => {
  it('shows truncated report text through a tooltip without nesting a tab stop in the button', async () => {
    const screen = await render(
      <div style={{ width: 240 }}>
        <ReportListItem
          report={report}
          selected={false}
          showPeriod
          onSelect={vi.fn()}
        />
      </div>
    )

    const title = screen.getByText(report.title, { exact: true })
    title.element().style.cssText =
      'display:block;width:64px;overflow:hidden;white-space:nowrap'
    await expect.element(title).toHaveAttribute('data-overflow', 'true')
    await expect.element(title).not.toHaveAttribute('tabindex')
    await expect.element(screen.getByText('元数据异常')).toHaveAttribute('title', 'Hash mismatch')

    await userEvent.hover(title)
    await expect.element(screen.getByRole('tooltip')).toHaveTextContent(report.title)
  })
})
