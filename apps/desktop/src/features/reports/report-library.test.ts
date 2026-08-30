import { describe, expect, it } from 'vitest'
import type { ReportFile } from '../../../shared/ipc'
import {
  DEFAULT_REPORT_SEARCH,
  filterReportFiles,
  getReportTypeCounts,
  getSummaryCadenceCounts,
  groupReportFiles,
  parseReportSearch,
} from './report-library'

const reports: ReportFile[] = [
  createReport({
    id: 'summary/2026/07/2026-07-27_2026-08-02.md',
    kind: 'summary',
    role: 'summary',
    title: '周期总结',
    reportType: 'weekly',
    period: { start: '2026-07-27', end: '2026-08-02' },
  }),
  createReport({
    id: 'raw/2026/08/2026-08-03_2026-08-09/index.md',
    kind: 'raw',
    role: 'raw-index',
    title: '周期索引',
    period: { start: '2026-08-03', end: '2026-08-09' },
  }),
  createReport({
    id: 'raw/2026/08/2026-08-03_2026-08-09/project.md',
    kind: 'raw',
    role: 'raw-project',
    title: 'Project Alpha',
    projectName: 'Project Alpha',
    period: { start: '2026-08-03', end: '2026-08-09' },
  }),
  createReport({
    id: 'raw/2026/08/2026-08-03_2026-08-09/.history/project.2026.md',
    kind: 'raw',
    role: 'raw-history',
    title: 'Project Alpha · 历史版本',
    period: { start: '2026-08-03', end: '2026-08-09' },
  }),
]

describe('report library filtering', () => {
  it('uses period overlap and modified time fallback while hiding history', () => {
    const search = {
      ...DEFAULT_REPORT_SEARCH,
      range: 'custom' as const,
      from: '2026-08-01',
      to: '2026-08-05',
    }

    expect(filterReportFiles(reports, search).map((report) => report.id)).toEqual([
      reports[0]?.id,
      reports[1]?.id,
      reports[2]?.id,
    ])
    expect(getReportTypeCounts(reports, search)).toEqual({ all: 3, summary: 1, raw: 2 })
  })

  it('filters semantic search text and raw roles', () => {
    const search = {
      ...DEFAULT_REPORT_SEARCH,
      range: 'all' as const,
      type: 'raw' as const,
      rawRole: 'project' as const,
      query: 'alpha',
    }
    expect(filterReportFiles(reports, search).map((report) => report.role)).toEqual([
      'raw-project',
    ])
  })

  it('groups by period and sorts semantic roles', () => {
    const groups = groupReportFiles(reports.filter((report) => report.period))
    expect(groups.map((group) => group.key)).toEqual([
      '2026-08-03_2026-08-09',
      '2026-07-27_2026-08-02',
    ])
    expect(groups[0]?.reports.map((report) => report.role)).toEqual([
      'raw-index',
      'raw-project',
      'raw-history',
    ])
  })

  it('filters Summary by cadence independently from the primary type counts', () => {
    const search = {
      ...DEFAULT_REPORT_SEARCH,
      range: 'all' as const,
      type: 'summary' as const,
      cadence: 'monthly' as const,
    }
    expect(filterReportFiles(reports, search)).toEqual([])
    expect(getSummaryCadenceCounts(reports, search)).toEqual({
      all: 1,
      daily: 0,
      weekly: 1,
      monthly: 0,
      custom: 0,
    })
    expect(getReportTypeCounts(reports, search)).toEqual({ all: 3, summary: 1, raw: 2 })
  })

  it('sanitizes route search values', () => {
    expect(
      parseReportSearch({
        type: 'invalid',
        range: 'custom',
        from: 'bad',
        cadence: 'monthly',
        includeHistory: 'true',
      }),
    ).toEqual({
      range: 'custom',
      cadence: 'monthly',
      includeHistory: true,
    })
  })
})

function createReport(
  overrides: Pick<ReportFile, 'id' | 'kind' | 'role' | 'title' | 'period'> &
    Partial<ReportFile>,
): ReportFile {
  return {
    name: overrides.id.split('/').slice(-1)[0] ?? 'report.md',
    relativePath: overrides.id,
    generatedAt: null,
    modifiedAt: '2026-08-01T10:00:00.000Z',
    size: 100,
    ...overrides,
  }
}
