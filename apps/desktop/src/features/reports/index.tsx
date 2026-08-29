import { lazy, Suspense, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { format as formatDate, parseISO } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  FileText,
  FolderOpen,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import type { ReportFile } from '../../../shared/ipc'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { MarkdownViewer } from '@/components/markdown-viewer'
import { OverflowTooltip } from '@/components/overflow-tooltip'
import { ThemeSwitch } from '@/components/theme-switch'
import { getErrorMessage } from '@/lib/errors'
import { desktopQueryKeys } from '@/lib/desktop-queries'
import { openOutputRoot, showReportInFolder } from '@/lib/system-actions'
import { showSuccessToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import {
  DEFAULT_REPORT_SEARCH,
  filterReportFiles,
  formatPeriod,
  getReportTypeCounts,
  getSummaryCadenceCounts,
  groupReportFiles,
  type RawRoleFilter,
  type ReportRangePreset,
  type ReportSearchParams,
  type ReportTypeFilter,
  type SummaryCadenceFilter,
} from './report-library'
import { GenerateReportDialog } from './generate-report-dialog'

const TYPE_TABS: Array<{ value: ReportTypeFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'summary', label: 'Summary' },
  { value: 'raw', label: 'Raw' },
]

const RANGE_LABELS: Record<ReportRangePreset, string> = {
  month: '当前月',
  'three-months': '最近三个月',
  year: '今年',
  all: '全部时间',
  custom: '自定义范围',
}

const CADENCE_LABELS: Record<SummaryCadenceFilter, string> = {
  all: '全部周期',
  daily: '日报',
  weekly: '周报',
  monthly: '月报',
  custom: '自定义报告',
}

const ReportDateRangePicker = lazy(() => import('./report-date-range-picker'))

export type ReportSearchPatch = Partial<{
  [Key in keyof ReportSearchParams]: ReportSearchParams[Key] | undefined
}>

export function Reports({
  routeSearch,
  onSearchChange,
}: {
  routeSearch: Partial<ReportSearchParams>
  onSearchChange(patch: ReportSearchPatch): void
}) {
  const search = useMemo(
    () => ({ ...DEFAULT_REPORT_SEARCH, ...routeSearch }),
    [routeSearch],
  )
  const [selectedId, setSelectedId] = useState<string>()
  const [generateOpen, setGenerateOpen] = useState(false)
  const [generateTarget, setGenerateTarget] = useState<ReportFile>()
  const [trashView, setTrashView] = useState(false)
  const [groupOverrides, setGroupOverrides] = useState<Record<string, boolean>>({})
  const reports = useQuery({
    queryKey: [...desktopQueryKeys.reports, trashView ? 'trash' : 'active'],
    queryFn: () => window.electronAPI.reports.list(trashView),
  })
  const filteredReports = useMemo(
    () => filterReportFiles(reports.data ?? [], search),
    [reports.data, search],
  )
  const groups = useMemo(() => groupReportFiles(filteredReports), [filteredReports])
  const counts = useMemo(
    () => getReportTypeCounts(reports.data ?? [], search),
    [reports.data, search],
  )
  const cadenceCounts = useMemo(
    () => getSummaryCadenceCounts(reports.data ?? [], search),
    [reports.data, search],
  )
  const effectiveSelectedId = filteredReports.some((report) => report.id === selectedId)
    ? selectedId
    : groups[0]?.reports[0]?.id
  const selected = useQuery({
    queryKey: ['report', effectiveSelectedId],
    queryFn: () => window.electronAPI.reports.read(effectiveSelectedId!),
    enabled: Boolean(effectiveSelectedId) && !reports.isError,
  })
  const reportAction = useMutation({
    mutationFn: async ({ action, id }: { action: 'trash' | 'restore' | 'delete'; id: string }) => {
      if (action === 'trash') return window.electronAPI.reports.trash(id)
      if (action === 'restore') return window.electronAPI.reports.restore(id)
      return window.electronAPI.reports.deletePermanently(id)
    },
    onSuccess: async (_result, variables) => {
      setSelectedId(undefined)
      await reports.refetch()
      showSuccessToast(variables.action === 'trash' ? '报告已移入回收站' : variables.action === 'restore' ? '报告已恢复' : '报告已永久删除')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const updateSearch = onSearchChange

  function resetFilters() {
    updateSearch({
      type: undefined,
      range: undefined,
      from: undefined,
      to: undefined,
      query: undefined,
      rawRole: undefined,
      cadence: undefined,
      includeHistory: undefined,
    })
  }

  function selectType(value: string) {
    updateSearch({
      type: value === 'all' ? undefined : (value as ReportTypeFilter),
      rawRole: undefined,
      cadence: undefined,
    })
  }

  function selectCadence(value: string) {
    const cadence = value as SummaryCadenceFilter
    updateSearch({ cadence: cadence === 'all' ? undefined : cadence })
  }

  function selectRange(value: string) {
    const range = value as ReportRangePreset
    updateSearch({
      range: range === DEFAULT_REPORT_SEARCH.range ? undefined : range,
      ...(range === 'custom' ? {} : { from: undefined, to: undefined }),
    })
  }

  function selectRawRole(value: string) {
    const rawRole = value as RawRoleFilter
    updateSearch({
      rawRole: rawRole === 'all' ? undefined : rawRole,
      ...(rawRole === 'history' ? { includeHistory: true } : {}),
    })
  }

  function setHistoryIncluded(checked: boolean) {
    updateSearch({
      includeHistory: checked || undefined,
      ...(!checked && search.rawRole === 'history' ? { rawRole: undefined } : {}),
    })
  }

  function setCustomRange(range: DateRange | undefined) {
    if (!range?.from) {
      updateSearch({ from: undefined, to: undefined })
      return
    }
    updateSearch({
      from: formatDate(range.from, 'yyyy-MM-dd'),
      to: formatDate(range.to ?? range.from, 'yyyy-MM-dd'),
    })
  }

  function toggleGroup(key: string, defaultOpen: boolean) {
    setGroupOverrides((current) => ({ ...current, [key]: !(current[key] ?? defaultOpen) }))
  }

  async function refreshReports() {
    const result = await reports.refetch()
    if (!result.isError) {
      showSuccessToast(`报告列表已重新扫描，共发现 ${result.data?.length ?? 0} 份报告`)
    }
  }

  function openGenerate(report?: ReportFile) {
    setGenerateTarget(report)
    setGenerateOpen(true)
  }

  function changeTrashView(next: boolean) {
    setSelectedId(undefined)
    setTrashView(next)
  }

  const customRange: DateRange | undefined = search.from
    ? { from: parseISO(search.from), to: search.to ? parseISO(search.to) : undefined }
    : undefined

  return (
    <>
      <Header>
        <div className='me-auto'>
          <p className='text-sm font-medium'>Markdown 报告库</p>
          <p className='text-xs text-muted-foreground'>Summary 与 Raw 规范报告</p>
        </div>
        <ThemeSwitch />
      </Header>
      <Main fixed className='gap-4'>
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>报告库</h1>
            <p className='text-muted-foreground'>
              {trashView ? '恢复误删的 Summary，或永久清理回收站。' : '按报告周期和类型快速定位 outputRoot 中的报告。'}
            </p>
          </div>
          <div className='flex gap-2'>
            {!trashView ? <Button onClick={() => openGenerate()}>
              <Sparkles />
              生成报告
            </Button> : null}
            <Button variant='outline' onClick={() => changeTrashView(!trashView)}>
              {trashView ? <Undo2 /> : <Trash2 />}
              {trashView ? '返回报告库' : '回收站'}
            </Button>
            <Button variant='outline' onClick={() => void openOutputRoot()}>
              <FolderOpen />
              打开目录
            </Button>
            <Button
              variant='outline'
              onClick={() => void refreshReports()}
              disabled={reports.isFetching}
            >
              <RefreshCw className={reports.isFetching ? 'animate-spin' : ''} />
              刷新
            </Button>
          </div>
        </div>

        {reports.isError ? (
          <ReportListError
            error={reports.error}
            retrying={reports.isFetching}
            onRetry={() => void refreshReports()}
          />
        ) : (
          <>
            <ReportFilters
              search={search}
              counts={counts}
              cadenceCounts={cadenceCounts}
              customRange={customRange}
              shownCount={filteredReports.length}
              totalCount={reports.data?.length ?? 0}
              onTypeChange={selectType}
              onRangeChange={selectRange}
              onCustomRangeChange={setCustomRange}
              onQueryChange={(query) => updateSearch({ query: query || undefined })}
              onClearQuery={() => updateSearch({ query: undefined })}
              onRawRoleChange={selectRawRole}
              onCadenceChange={selectCadence}
              onIncludeHistoryChange={setHistoryIncluded}
            />

            <div className='grid min-h-0 flex-1 gap-4 lg:grid-cols-[420px_minmax(0,1fr)]'>
              <Card className='min-h-0 overflow-hidden py-0'>
                <ScrollArea className='h-full'>
                  <div className='space-y-3 p-3'>
                    {search.type === 'summary'
                      ? filteredReports.map((report) => (
                          <ReportListItem
                            key={report.id}
                            report={report}
                            selected={effectiveSelectedId === report.id}
                            showPeriod
                            onSelect={() => setSelectedId(report.id)}
                          />
                        ))
                      : groups.map((group, index) => {
                          const selectedInGroup = group.reports.some(
                            (report) => report.id === effectiveSelectedId,
                          )
                          const forceOpen = Boolean(search.query)
                          const defaultOpen = index === 0 || selectedInGroup
                          const open = forceOpen || (groupOverrides[group.key] ?? defaultOpen)
                          return (
                            <ReportGroup
                              key={group.key}
                              group={group}
                              open={open}
                              forceOpen={forceOpen}
                              selectedId={effectiveSelectedId}
                              onOpenChange={() => toggleGroup(group.key, defaultOpen)}
                              onSelect={setSelectedId}
                            />
                          )
                        })}
                    {!reports.isLoading && filteredReports.length === 0 ? (
                      <div className='space-y-3 p-8 text-center'>
                        <p className='text-sm text-muted-foreground'>
                          当前筛选条件下没有报告。
                        </p>
                        <Button size='sm' variant='outline' onClick={resetFilters}>
                          重置筛选
                        </Button>
                      </div>
                    ) : null}
                    {reports.isLoading ? (
                      <p className='p-6 text-center text-sm text-muted-foreground'>正在建立报告索引…</p>
                    ) : null}
                  </div>
                </ScrollArea>
              </Card>

              <ReportPreview
                report={selected.data}
                loading={selected.isLoading}
                error={selected.error}
                trashView={trashView}
                actionPending={reportAction.isPending}
                onRegenerate={(report) => openGenerate(report)}
                onTrash={(id) => reportAction.mutate({ action: 'trash', id })}
                onRestore={(id) => reportAction.mutate({ action: 'restore', id })}
                onDelete={(id) => {
                  if (window.confirm('永久删除后无法恢复，确定继续吗？')) {
                    reportAction.mutate({ action: 'delete', id })
                  }
                }}
              />
            </div>
          </>
        )}
      </Main>
      <GenerateReportDialog
        key={`${generateTarget?.id ?? 'new'}-${generateOpen}`}
        open={generateOpen}
        onOpenChange={(next) => {
          setGenerateOpen(next)
          if (!next) setGenerateTarget(undefined)
        }}
        onSaved={() => void reports.refetch()}
        initialReport={generateTarget}
      />
    </>
  )
}

function ReportFilters({
  search,
  counts,
  cadenceCounts,
  customRange,
  shownCount,
  totalCount,
  onTypeChange,
  onRangeChange,
  onCustomRangeChange,
  onQueryChange,
  onClearQuery,
  onRawRoleChange,
  onCadenceChange,
  onIncludeHistoryChange,
}: {
  search: ReportSearchParams
  counts: Record<ReportTypeFilter, number>
  cadenceCounts: Record<SummaryCadenceFilter, number>
  customRange?: DateRange
  shownCount: number
  totalCount: number
  onTypeChange(value: string): void
  onRangeChange(value: string): void
  onCustomRangeChange(range: DateRange | undefined): void
  onQueryChange(value: string): void
  onClearQuery(): void
  onRawRoleChange(value: string): void
  onCadenceChange(value: string): void
  onIncludeHistoryChange(checked: boolean): void
}) {
  return (
    <div className='space-y-3 rounded-xl border bg-card p-3'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <Tabs value={search.type} onValueChange={onTypeChange}>
          <TabsList>
            {TYPE_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
                <span className='text-xs text-muted-foreground'>{counts[tab.value]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <span className='text-xs text-muted-foreground'>显示 {shownCount} / 共 {totalCount}</span>
      </div>

      <div className='flex flex-wrap items-center gap-2'>
        <div className='relative min-w-56 flex-1 lg:max-w-sm'>
          <Search className='pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={search.query ?? ''}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder='搜索标题、仓库、文件名或路径'
            className='ps-9 pe-9'
            aria-label='搜索报告'
          />
          {search.query ? (
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='absolute end-0 top-0 size-9'
              onClick={onClearQuery}
              aria-label='清除搜索'
            >
              <X />
            </Button>
          ) : null}
        </div>

        <Select value={search.range} onValueChange={onRangeChange}>
          <SelectTrigger className='w-38' aria-label='报告时间范围'>
            <CalendarDays />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(RANGE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {search.range === 'custom' ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant='outline' className='font-normal'>
                {search.from && search.to ? `${search.from} ~ ${search.to}` : '选择日期范围'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-auto p-0' align='end'>
              <Suspense fallback={<div className='p-6 text-sm text-muted-foreground'>正在加载日历…</div>}>
                <ReportDateRangePicker
                  range={customRange}
                  onChange={onCustomRangeChange}
                />
              </Suspense>
            </PopoverContent>
          </Popover>
        ) : null}

        {search.type === 'raw' ? (
          <Select value={search.rawRole} onValueChange={onRawRoleChange}>
            <SelectTrigger className='w-34' aria-label='Raw 报告类型'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>全部 Raw</SelectItem>
              <SelectItem value='index'>周期索引</SelectItem>
              <SelectItem value='project'>仓库明细</SelectItem>
              {search.includeHistory ? <SelectItem value='history'>历史版本</SelectItem> : null}
            </SelectContent>
          </Select>
        ) : null}

        {search.type === 'summary' ? (
          <Select value={search.cadence} onValueChange={onCadenceChange}>
            <SelectTrigger className='w-36' aria-label='Summary 报告类型'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CADENCE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}（{cadenceCounts[value as SummaryCadenceFilter]}）
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {search.type === 'all' || search.type === 'raw' ? (
          <Label className='flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 font-normal'>
            <Checkbox
              checked={search.includeHistory}
              onCheckedChange={(checked) => onIncludeHistoryChange(checked === true)}
            />
            包含历史版本
          </Label>
        ) : null}
      </div>
    </div>
  )
}

function ReportGroup({
  group,
  open,
  forceOpen,
  selectedId,
  onOpenChange,
  onSelect,
}: {
  group: ReturnType<typeof groupReportFiles>[number]
  open: boolean
  forceOpen: boolean
  selectedId?: string
  onOpenChange(): void
  onSelect(id: string): void
}) {
  const summary = [
    group.counts.summary ? `Summary ${group.counts.summary}` : null,
    group.counts.raw ? `Raw ${group.counts.raw}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <button
          type='button'
          disabled={forceOpen}
          className='flex w-full items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2 text-start hover:bg-muted disabled:cursor-default disabled:opacity-100'
        >
          <div className='min-w-0'>
            <p className='truncate text-sm font-semibold'>{group.label}</p>
            <p className='mt-0.5 text-xs text-muted-foreground'>
              {summary}{group.usesModifiedTime ? ' · 按修改时间' : ''}
            </p>
          </div>
          <ChevronDown className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className='space-y-2 pt-2'>
        {group.reports.map((report) => (
          <ReportListItem
            key={report.id}
            report={report}
            selected={selectedId === report.id}
            onSelect={() => onSelect(report.id)}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function ReportListItem({
  report,
  selected,
  showPeriod = false,
  onSelect,
}: {
  report: ReportFile
  selected: boolean
  showPeriod?: boolean
  onSelect(): void
}) {
  const detail = showPeriod && report.period ? formatPeriod(report.period) : report.name
  const footerLabel = showPeriod ? report.name : ROLE_LABELS[report.role]

  return (
    <button
      type='button'
      onClick={onSelect}
      className={cn(
        'w-full rounded-lg border p-3 text-start transition-colors hover:bg-muted',
        selected && 'border-primary bg-muted',
      )}
    >
      <div className='flex items-start gap-2'>
        <FileText className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
        <div className='min-w-0 flex-1'>
          <div className='flex items-start justify-between gap-2'>
            <OverflowTooltip
              text={report.title}
              className='flex-1 text-sm font-medium'
              focusable={false}
            />
            <ReportKind kind={report.kind} />
            {report.summaryMetadataStatus === 'invalid' ? (
              <Badge variant='destructive' title={report.summaryMetadataMessage}>元数据异常</Badge>
            ) : null}
          </div>
          <OverflowTooltip
            text={detail}
            className='mt-1 text-xs text-muted-foreground'
            content={(
              <div className='space-y-1'>
                <p>{detail}</p>
                <p className='font-mono text-primary-foreground/80'>{report.relativePath}</p>
              </div>
            )}
            focusable={false}
          />
          <div className='mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground'>
            <OverflowTooltip
              text={footerLabel}
              className='flex-1'
              focusable={false}
            />
            <span className='shrink-0'>{formatModifiedAt(report.modifiedAt)} · {formatBytes(report.size)}</span>
          </div>
        </div>
      </div>
    </button>
  )
}

function ReportPreview({
  report,
  loading,
  error,
  trashView,
  actionPending,
  onRegenerate,
  onTrash,
  onRestore,
  onDelete,
}: {
  report?: Awaited<ReturnType<typeof window.electronAPI.reports.read>>
  loading: boolean
  error: Error | null
  trashView: boolean
  actionPending: boolean
  onRegenerate(report: ReportFile): void
  onTrash(id: string): void
  onRestore(id: string): void
  onDelete(id: string): void
}) {
  const publish = useMutation({
    mutationFn: (id: string) => window.electronAPI.reports.publish(id),
    onSuccess: () => showSuccessToast('报告已推送到飞书'),
    onError: (publishError) => toast.error(getErrorMessage(publishError)),
  })
  const metadata = report
    ? `${report.period ? formatPeriod(report.period) : `按修改时间 · ${formatModifiedAt(report.modifiedAt)}`} · ${report.relativePath}`
    : ''

  return (
    <Card className='min-h-0 overflow-hidden py-0'>
      {report ? (
        <div className='flex h-full min-h-0 flex-col'>
          <div className='flex items-center justify-between gap-3 border-b p-4'>
            <div className='min-w-0 flex-1'>
              <div className='flex items-center gap-2'>
                <OverflowTooltip text={report.title} className='flex-1 font-medium' />
              </div>
              <OverflowTooltip
                text={metadata}
                className='mt-1 text-xs text-muted-foreground'
                content={(
                  <div className='space-y-1'>
                    <p>
                      {report.period
                        ? formatPeriod(report.period)
                        : `按修改时间 · ${formatModifiedAt(report.modifiedAt)}`}
                    </p>
                    <p className='font-mono text-primary-foreground/80'>{report.relativePath}</p>
                  </div>
                )}
              />
            </div>
            <div className='flex gap-2'>
              {!trashView && report.kind === 'summary' && report.summaryMetadataStatus === 'valid' && (
                <Button size='sm' variant='outline' onClick={() => onRegenerate(report)}>
                  <Sparkles />重新生成
                </Button>
              )}
              {!trashView && report.kind === 'summary' && report.summaryMetadataStatus === 'valid' && (
                <Button size='sm' variant='outline' onClick={() => publish.mutate(report.id)} disabled={publish.isPending}>
                  <Send />推送飞书
                </Button>
              )}
              {!trashView && report.kind === 'summary' ? (
                <Button size='sm' variant='outline' onClick={() => onTrash(report.id)} disabled={actionPending}>
                  <Trash2 />移入回收站
                </Button>
              ) : null}
              {trashView ? (
                <>
                  <Button size='sm' variant='outline' onClick={() => onRestore(report.id)} disabled={actionPending}>
                    <Undo2 />恢复
                  </Button>
                  <Button size='sm' variant='destructive' onClick={() => onDelete(report.id)} disabled={actionPending}>
                    <Trash2 />永久删除
                  </Button>
                </>
              ) : null}
              <Button
                size='sm'
                variant='outline'
                onClick={() => void showReportInFolder(report.id)}
              >
                <FolderOpen />
                定位文件
              </Button>
            </div>
          </div>
          <Tabs defaultValue='preview' className='min-h-0 flex-1 gap-0'>
            <div className='border-b px-4 py-2'>
              <TabsList>
                <TabsTrigger value='preview'>预览</TabsTrigger>
                <TabsTrigger value='source'>源码</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value='preview' className='min-h-0 flex-1 overflow-hidden'>
              <ScrollArea className='h-full'>
                <MarkdownViewer content={report.content} className='p-5' />
              </ScrollArea>
            </TabsContent>
            <TabsContent value='source' className='min-h-0 flex-1 overflow-hidden'>
              <ScrollArea className='h-full'>
                <pre className='min-w-full whitespace-pre-wrap break-words p-5 font-mono text-sm leading-6'>
                  {report.content}
                </pre>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      ) : error ? (
        <div className='flex h-full items-center justify-center p-8'>
          <Alert variant='destructive' className='max-w-xl'>
            <AlertTriangle />
            <AlertTitle>报告读取失败</AlertTitle>
            <AlertDescription className='[overflow-wrap:anywhere]'>
              {getErrorMessage(error)}
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <div className='flex h-full min-h-72 items-center justify-center p-8 text-center text-muted-foreground'>
          {loading ? '正在读取报告…' : '当前筛选条件下没有可预览的报告。'}
        </div>
      )}
    </Card>
  )
}

function ReportListError({
  error,
  retrying,
  onRetry,
}: {
  error: Error
  retrying: boolean
  onRetry(): void
}) {
  return (
    <Card className='flex min-h-0 flex-1 items-center justify-center p-8'>
      <div className='w-full max-w-2xl space-y-4'>
        <Alert variant='destructive'>
          <AlertTriangle />
          <AlertTitle>报告索引失败</AlertTitle>
          <AlertDescription className='[overflow-wrap:anywhere]'>
            <p>{getErrorMessage(error)}</p>
            <p>请修复对应 Raw 周期的 manifest.json 后重新扫描。</p>
          </AlertDescription>
        </Alert>
        <div className='flex justify-end gap-2'>
          <Button variant='outline' onClick={() => void openOutputRoot()}>
            <FolderOpen />
            打开报告目录
          </Button>
          <Button onClick={onRetry} disabled={retrying}>
            <RefreshCw className={retrying ? 'animate-spin' : ''} />
            重新扫描
          </Button>
        </div>
      </div>
    </Card>
  )
}

const ROLE_LABELS: Record<ReportFile['role'], string> = {
  summary: '周期总结',
  'raw-index': '周期索引',
  'raw-project': '仓库明细',
  'raw-history': '历史版本',
}

function ReportKind({ kind }: { kind: ReportFile['kind'] }) {
  const labels = { raw: 'Raw', summary: 'Summary' }
  return <Badge variant='outline'>{labels[kind]}</Badge>
}

function formatModifiedAt(value: string): string {
  return formatDate(parseISO(value), 'MM-dd HH:mm')
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}
