import {
  endOfMonth,
  endOfYear,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfYear,
  subMonths,
} from 'date-fns'
import type { ReportFile } from '../../../shared/ipc'

export type ReportTypeFilter = 'all' | 'summary' | 'raw'
export type ReportRangePreset = 'month' | 'three-months' | 'year' | 'all' | 'custom'
export type RawRoleFilter = 'all' | 'index' | 'project' | 'history'
export type SummaryCadenceFilter = 'all' | 'daily' | 'weekly' | 'monthly' | 'custom'

export interface ReportSearchParams {
  type: ReportTypeFilter
  range: ReportRangePreset
  from?: string
  to?: string
  query?: string
  rawRole: RawRoleFilter
  cadence: SummaryCadenceFilter
  includeHistory: boolean
}

export interface ReportPeriodGroup {
  key: string
  label: string
  period: ReportFile['period']
  reports: ReportFile[]
  counts: Partial<Record<ReportFile['kind'], number>>
  sortDate: string
  usesModifiedTime: boolean
}

export const DEFAULT_REPORT_SEARCH: ReportSearchParams = {
  type: 'all',
  range: 'three-months',
  rawRole: 'all',
  cadence: 'all',
  includeHistory: false,
}

const TYPE_VALUES = new Set<ReportTypeFilter>(['all', 'summary', 'raw'])
const RANGE_VALUES = new Set<ReportRangePreset>([
  'month',
  'three-months',
  'year',
  'all',
  'custom',
])
const RAW_ROLE_VALUES = new Set<RawRoleFilter>(['all', 'index', 'project', 'history'])
const SUMMARY_CADENCE_VALUES = new Set<SummaryCadenceFilter>([
  'all',
  'daily',
  'weekly',
  'monthly',
  'custom',
])
const ROLE_ORDER: Record<ReportFile['role'], number> = {
  summary: 0,
  'raw-index': 1,
  'raw-project': 2,
  'raw-history': 3,
}

export function parseReportSearch(search: Record<string, unknown>): Partial<ReportSearchParams> {
  const result: Partial<ReportSearchParams> = {}
  if (TYPE_VALUES.has(search.type as ReportTypeFilter) && search.type !== 'all') {
    result.type = search.type as ReportTypeFilter
  }
  if (
    RANGE_VALUES.has(search.range as ReportRangePreset) &&
    search.range !== DEFAULT_REPORT_SEARCH.range
  ) {
    result.range = search.range as ReportRangePreset
  }
  if (isDateString(search.from)) result.from = search.from
  if (isDateString(search.to)) result.to = search.to
  if (typeof search.query === 'string' && search.query.trim()) {
    result.query = search.query
  }
  if (RAW_ROLE_VALUES.has(search.rawRole as RawRoleFilter) && search.rawRole !== 'all') {
    result.rawRole = search.rawRole as RawRoleFilter
  }
  if (
    SUMMARY_CADENCE_VALUES.has(search.cadence as SummaryCadenceFilter) &&
    search.cadence !== 'all'
  ) {
    result.cadence = search.cadence as SummaryCadenceFilter
  }
  if (search.includeHistory === true || search.includeHistory === 'true') {
    result.includeHistory = true
  }
  return result
}

export function filterReportFiles(
  reports: ReportFile[],
  search: ReportSearchParams,
  now = new Date(),
): ReportFile[] {
  const range = resolveDateRange(search, now)
  const query = search.query?.trim().toLocaleLowerCase()

  return reports.filter((report) => {
    if (search.type !== 'all' && report.kind !== search.type) return false
    if (!search.includeHistory && report.role === 'raw-history') return false
    if (report.kind === 'raw' && !matchesRawRole(report, search.rawRole)) return false
    if (
      search.cadence !== 'all' &&
      (report.kind !== 'summary' || report.reportType !== search.cadence)
    ) return false
    if (range && !matchesDateRange(report, range)) return false
    if (query && !getSearchText(report).includes(query)) return false
    return true
  })
}

export function getSummaryCadenceCounts(
  reports: ReportFile[],
  search: ReportSearchParams,
  now = new Date(),
): Record<SummaryCadenceFilter, number> {
  const visible = filterReportFiles(
    reports,
    { ...search, type: 'summary', cadence: 'all' },
    now,
  )
  return {
    all: visible.length,
    daily: visible.filter((report) => report.reportType === 'daily').length,
    weekly: visible.filter((report) => report.reportType === 'weekly').length,
    monthly: visible.filter((report) => report.reportType === 'monthly').length,
    custom: visible.filter((report) => report.reportType === 'custom').length,
  }
}

export function getReportTypeCounts(
  reports: ReportFile[],
  search: ReportSearchParams,
  now = new Date(),
): Record<ReportTypeFilter, number> {
  const commonSearch = { ...search, type: 'all' as const, cadence: 'all' as const }
  const visible = filterReportFiles(reports, commonSearch, now)
  return {
    all: visible.length,
    summary: visible.filter((report) => report.kind === 'summary').length,
    raw: visible.filter((report) => report.kind === 'raw').length,
  }
}

export function groupReportFiles(reports: ReportFile[]): ReportPeriodGroup[] {
  const groups = new Map<string, ReportPeriodGroup>()

  for (const report of reports) {
    const modifiedDate = format(parseISO(report.modifiedAt), 'yyyy-MM-dd')
    const key = report.period
      ? `${report.period.start}_${report.period.end}`
      : `modified-${modifiedDate.slice(0, 7)}`
    const existing = groups.get(key)
    if (existing) {
      existing.reports.push(report)
      existing.counts[report.kind] = (existing.counts[report.kind] ?? 0) + 1
      continue
    }

    groups.set(key, {
      key,
      label: report.period
        ? formatPeriod(report.period)
        : `修改于 ${modifiedDate.slice(0, 7).replace('-', ' 年 ')} 月`,
      period: report.period,
      reports: [report],
      counts: { [report.kind]: 1 },
      sortDate: report.period?.end ?? modifiedDate,
      usesModifiedTime: report.period === null,
    })
  }

  return [...groups.values()]
    .map((group) => ({ ...group, reports: [...group.reports].sort(compareReportsInPeriod) }))
    .sort((left, right) => right.sortDate.localeCompare(left.sortDate))
}

export function resolveDateRange(
  search: Pick<ReportSearchParams, 'range' | 'from' | 'to'>,
  now = new Date(),
): { from: string; to: string } | null {
  if (search.range === 'all') return null
  if (search.range === 'custom') {
    if (!isDateString(search.from) || !isDateString(search.to)) return null
    return search.from <= search.to
      ? { from: search.from, to: search.to }
      : { from: search.to, to: search.from }
  }
  if (search.range === 'month') {
    return { from: toDateString(startOfMonth(now)), to: toDateString(endOfMonth(now)) }
  }
  if (search.range === 'year') {
    return { from: toDateString(startOfYear(now)), to: toDateString(endOfYear(now)) }
  }
  return {
    from: toDateString(startOfMonth(subMonths(now, 2))),
    to: toDateString(endOfMonth(now)),
  }
}

export function formatPeriod(period: NonNullable<ReportFile['period']>): string {
  return `${period.start} ~ ${period.end}`
}

function matchesRawRole(report: ReportFile, role: RawRoleFilter): boolean {
  if (role === 'all') return true
  if (role === 'index') return report.role === 'raw-index'
  if (role === 'history') return report.role === 'raw-history'
  return report.role === 'raw-project'
}

function matchesDateRange(report: ReportFile, range: { from: string; to: string }): boolean {
  if (report.period) {
    return report.period.start <= range.to && report.period.end >= range.from
  }
  const modifiedDate = format(parseISO(report.modifiedAt), 'yyyy-MM-dd')
  return modifiedDate >= range.from && modifiedDate <= range.to
}

function getSearchText(report: ReportFile): string {
  return [report.title, report.projectName, report.name, report.relativePath]
    .filter(Boolean)
    .join('\n')
    .toLocaleLowerCase()
}

function compareReportsInPeriod(left: ReportFile, right: ReportFile): number {
  const roleOrder = ROLE_ORDER[left.role] - ROLE_ORDER[right.role]
  if (roleOrder !== 0) return roleOrder
  if (left.role === 'raw-history' && right.role === 'raw-history') {
    return right.modifiedAt.localeCompare(left.modifiedAt)
  }
  return left.title.localeCompare(right.title, 'zh-CN')
}

function isDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return isValid(parseISO(value))
}

function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}
