import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CalendarDays, Eye, Loader2, RotateCcw, Save, Sparkles } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import type { ReportRun, ReportType } from '@weekly-git-report/shared'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { MarkdownViewer } from '@/components/markdown-viewer'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getErrorMessage } from '@/lib/errors'
import { showErrorToast, showSuccessToast, showWarningToast } from '@/lib/toast'
import type { ReportFile } from '../../../shared/ipc'

export function ReportGenerationPanel({
  initialReport,
  initialRunId,
  onboarding = false,
  fixedHeight = false,
  onRunChange,
  onSaved,
  onClose,
  onBusyChange,
}: {
  initialReport?: ReportFile
  initialRunId?: string
  onboarding?: boolean
  fixedHeight?: boolean
  onRunChange?(runId: string | null): void
  onSaved(run: ReportRun): void
  onClose?(): void
  onBusyChange?(busy: boolean): void
}) {
  const [reportType, setReportType] = useState<ReportType>(initialReport?.reportType ?? 'weekly')
  const [templateType, setTemplateType] = useState<ReportType>(() =>
    initialReport?.reportType === 'custom'
      ? initialReport.templateType ?? 'custom'
      : initialReport?.reportType ?? 'weekly',
  )
  const [customRange, setCustomRange] = useState<DateRange | undefined>(() =>
    toDateRange(initialReport?.period),
  )
  const [title, setTitle] = useState(initialReport?.reportTitle ?? '')
  const [regenerating, setRegenerating] = useState(Boolean(initialReport))
  const [context, setContext] = useState('')
  const [draft, setDraft] = useState('')
  const [generatedDraft, setGeneratedDraft] = useState('')
  const [run, setRun] = useState<ReportRun>()
  const [runId, setRunId] = useState<string | undefined>(initialRunId)
  const [publish, setPublish] = useState(false)
  const [forceSave, setForceSave] = useState(false)
  const [templatePreviewOpen, setTemplatePreviewOpen] = useState(false)
  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = useState(false)
  const draftRef = useRef('')
  const runIdRef = useRef(runId)
  const onRunChangeRef = useRef(onRunChange)
  const onSavedRef = useRef(onSaved)
  const period =
    regenerating && initialReport?.period
      ? initialReport.period
      : reportType === 'custom'
        ? toPeriod(customRange)
        : onboarding
          ? onboardingPeriod(reportType)
          : currentPeriod(reportType)

  useEffect(() => {
    runIdRef.current = runId
  }, [runId])

  useEffect(() => {
    onRunChangeRef.current = onRunChange
    onSavedRef.current = onSaved
  }, [onRunChange, onSaved])

  useEffect(
    () =>
      window.electronAPI.runs.onGenerationDelta((id, delta) => {
        if (runIdRef.current !== id) {
          setRunId(id)
          runIdRef.current = id
          onRunChangeRef.current?.(id)
        }
        if (delta) {
          const nextDraft = draftRef.current + delta
          draftRef.current = nextDraft
          setDraft(nextDraft)
        }
      }),
    [],
  )

  useEffect(() => {
    if (!initialRunId) return
    let cancelled = false
    void (async () => {
      try {
        const { restoredRun, restoredDraft } = await restoreRun(initialRunId)
        if (cancelled) return
        setRun(restoredRun)
        setRunId(restoredRun.id)
        setReportType(restoredRun.reportType)
        setTemplateType(restoredRun.templateType ?? restoredRun.reportType)
        if (restoredDraft !== undefined) {
          setDraft(restoredDraft)
          setGeneratedDraft(restoredDraft)
          draftRef.current = restoredDraft
        }
        if (
          restoredRun.summaryPath &&
          ['succeeded', 'publish_failed'].includes(restoredRun.status)
        ) {
          onSavedRef.current(restoredRun)
        }
      } catch (error) {
        showErrorToast(`无法恢复首次报告：${getErrorMessage(error)}`)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [initialRunId])

  const generate = useMutation({
    mutationFn: () =>
      window.electronAPI.runs.generate({
        reportType,
        ...(reportType === 'custom' ? { templateType } : {}),
        period: period!,
        ...(regenerating && initialReport?.reportId ? { reportId: initialReport.reportId } : {}),
        ...(reportType === 'custom' && title.trim() ? { title: title.trim() } : {}),
        ...(context.trim() ? { userContext: context.trim() } : {}),
      }),
    onMutate: () => {
      setDraft('')
      setGeneratedDraft('')
      draftRef.current = ''
      setRun(undefined)
      setRunId(undefined)
      runIdRef.current = undefined
      setForceSave(false)
    },
    onSuccess: (nextRun) => {
      setRun(nextRun)
      setGeneratedDraft(draftRef.current)
      setRunId(nextRun.id)
      if (runIdRef.current !== nextRun.id) {
        runIdRef.current = nextRun.id
        onRunChange?.(nextRun.id)
      }
    },
    onError: async (error) => {
      await refreshFailedRun()
      if (!isNoCommitsMessage(getErrorMessage(error))) showErrorToast(getErrorMessage(error))
    },
  })
  const templatePreview = useMutation({
    mutationFn: () =>
      window.electronAPI.templates.read(
        templateType,
        period!,
        reportType === 'custom' && title.trim() ? title.trim() : undefined,
      ),
  })
  const retry = useMutation({
    mutationFn: (allowEmpty: boolean) => window.electronAPI.runs.retry(runId!, allowEmpty),
    onMutate: () => {
      setDraft('')
      setGeneratedDraft('')
      draftRef.current = ''
    },
    onSuccess: (nextRun) => {
      setRun(nextRun)
      setGeneratedDraft(draftRef.current)
    },
    onError: async (error) => {
      await refreshFailedRun()
      showErrorToast(getErrorMessage(error))
    },
  })
  const regenerate = useMutation({
    mutationFn: () => window.electronAPI.runs.regenerate(runId!),
    onMutate: () => {
      setDraft('')
      draftRef.current = ''
      setForceSave(false)
    },
    onSuccess: (nextRun) => {
      setRun(nextRun)
      setGeneratedDraft(draftRef.current)
    },
    onError: async (error) => {
      const message = getErrorMessage(error)
      try {
        const id = runIdRef.current!
        const { restoredRun, restoredDraft } = await restoreRun(id)
        setRun(restoredRun)
        if (restoredDraft !== undefined) {
          setDraft(restoredDraft)
          setGeneratedDraft(restoredDraft)
          draftRef.current = restoredDraft
        }
        showErrorToast(`重新生成失败，已恢复上一版草稿：${message}`)
      } catch (restoreError) {
        showErrorToast(
          `重新生成失败，且无法恢复上一版草稿：${message}；${getErrorMessage(restoreError)}`,
        )
      }
    },
  })
  const approve = useMutation({
    mutationFn: () =>
      window.electronAPI.runs.approve(runId!, draft, onboarding ? false : publish, forceSave),
    onSuccess: (nextRun) => {
      showSuccessToast(onboarding || !publish ? '报告已保存' : '报告已保存并推送')
      onSaved(nextRun)
      resetForm()
    },
    onError: (error) => {
      const message = getErrorMessage(error)
      if (isSummaryReplacementRequired(message)) {
        setForceSave(true)
        showWarningToast('该周期已有无法校验的报告，请确认是否覆盖。')
        return
      }
      showErrorToast(message)
    },
  })
  const cancel = useMutation({
    mutationFn: () => window.electronAPI.runs.cancel(runId!),
    onSuccess: (nextRun) => {
      setRun(nextRun)
      showSuccessToast('报告生成已取消')
      onClose?.()
    },
    onError: (error) => showErrorToast(getErrorMessage(error)),
  })
  const busy =
    generate.isPending ||
    retry.isPending ||
    regenerate.isPending ||
    approve.isPending ||
    cancel.isPending
  const generating = generate.isPending || retry.isPending || regenerate.isPending
  const noCommits = run?.status === 'failed' && run.error?.code === 'NO_COMMITS'
  const readyForReview = Boolean(
    runId && draft && (!run?.status || run.status === 'awaiting_review'),
  )

  useEffect(() => {
    onBusyChange?.(busy)
  }, [busy, onBusyChange])

  async function refreshFailedRun() {
    const id = runIdRef.current
    if (!id) return
    try {
      setRun(await window.electronAPI.runs.get(id))
    } catch {
      // The original operation error remains the useful user-facing error.
    }
  }

  function changeReportType(value: string) {
    const next = value as ReportType
    setReportType(next)
    setTemplateType(next)
    templatePreview.reset()
    setTemplatePreviewOpen(false)
    setRegenerating(false)
    setCustomRange(undefined)
    setTitle('')
    if (run?.status === 'failed') {
      setRun(undefined)
      setRunId(undefined)
      runIdRef.current = undefined
      onRunChange?.(null)
    }
  }

  function resetForm() {
    setReportType('weekly')
    setTemplateType('weekly')
    setCustomRange(undefined)
    setTitle('')
    setContext('')
    setDraft('')
    setGeneratedDraft('')
    draftRef.current = ''
    setRun(undefined)
    setRunId(undefined)
    runIdRef.current = undefined
    setPublish(false)
    setForceSave(false)
    setTemplatePreviewOpen(false)
    setConfirmRegenerateOpen(false)
    templatePreview.reset()
    setRegenerating(false)
  }

  function openTemplatePreview() {
    setTemplatePreviewOpen(true)
    templatePreview.reset()
    templatePreview.mutate()
  }

  function requestRegenerate() {
    if (draft !== generatedDraft) {
      setConfirmRegenerateOpen(true)
      return
    }
    regenerate.mutate()
  }

  return (
    <div
      className={
        fixedHeight
          ? 'grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-4'
          : 'space-y-4'
      }
    >
      <div className='space-y-4'>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label>报告类型</Label>
            <Select value={reportType} onValueChange={changeReportType} disabled={generating}>
              <SelectTrigger aria-label='报告类型' className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='daily'>日报</SelectItem>
                <SelectItem value='weekly'>周报</SelectItem>
                <SelectItem value='monthly'>月报</SelectItem>
                {!onboarding ? <SelectItem value='custom'>自定义报告</SelectItem> : null}
              </SelectContent>
            </Select>
          </div>
          {reportType === 'custom' ? (
            <div className='space-y-2'>
              <Label>日期范围</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type='button'
                    variant='outline'
                    className='w-full justify-start font-normal'
                    disabled={generating}
                  >
                    <CalendarDays />
                    {period ? `${period.start} ~ ${period.end}` : '选择开始和结束日期'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align='start' className='w-auto p-0'>
                  <Calendar
                    mode='range'
                    numberOfMonths={2}
                    max={365}
                    selected={customRange}
                    onSelect={setCustomRange}
                    disabled={{ after: new Date() }}
                    defaultMonth={customRange?.from}
                  />
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <div className='space-y-2'>
              <Label>{onboarding ? '推荐报告周期' : '报告周期'}</Label>
              <div className='flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm'>
                {period?.start} ~ {period?.end}
              </div>
            </div>
          )}
        </div>
        {reportType === 'custom' ? (
          <div className='space-y-2'>
            <Label>报告标题（可选）</Label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={generating}
              placeholder='默认使用“自定义报告”'
            />
          </div>
        ) : null}
        {!onboarding ? (
          <div className='space-y-2'>
            <Label>报告模板</Label>
            <div className='flex gap-2'>
              {reportType === 'custom' ? (
                <Select
                  value={templateType}
                  onValueChange={(value) => {
                    setTemplateType(value as ReportType)
                    templatePreview.reset()
                  }}
                  disabled={generating}
                >
                  <SelectTrigger aria-label='报告模板' className='min-w-0 flex-1'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className='flex h-9 min-w-0 flex-1 items-center rounded-md border bg-muted/40 px-3 text-sm'>
                  {getTemplateLabel(templateType)}
                </div>
              )}
              <Button
                type='button'
                variant='outline'
                onClick={openTemplatePreview}
                disabled={generating || !period}
              >
                <Eye />
                预览模板
              </Button>
            </div>
            <p className='text-xs text-muted-foreground'>
              {reportType === 'custom'
                ? '自定义周期可以使用任一当前已保存的模板。'
                : '固定周期始终使用对应的报告模板。'}
            </p>
          </div>
        ) : null}
        <div className='space-y-2'>
          <Label>补充背景（可选）</Label>
          <Textarea
            value={context}
            onChange={(event) => setContext(event.target.value)}
            disabled={generating}
            placeholder='填写无法从 Git 提交中得知的项目背景、工作结果或其他说明。'
          />
        </div>
      </div>
      {generating || draft ? (
        <div className={fixedHeight ? 'flex min-h-0 flex-col gap-2' : 'space-y-2'}>
          <Label className='shrink-0'>报告草稿</Label>
          <Textarea
            aria-label='报告草稿'
            className={
              fixedHeight
                ? 'field-sizing-fixed min-h-0 flex-1 resize-none overflow-y-auto font-mono'
                : 'field-sizing-fixed h-80 min-h-80 max-h-80 resize-none overflow-y-auto font-mono'
            }
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              draftRef.current = event.target.value
            }}
            readOnly={generating}
          />
          {generating ? (
            <p className='flex shrink-0 items-center gap-2 text-sm text-muted-foreground'>
              <Loader2 className='size-4 animate-spin' />
              {regenerate.isPending
                ? '正在重新生成，内容会实时显示…'
                : '正在同步、采集并生成，内容会实时显示…'}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className={fixedHeight ? 'row-start-3 space-y-4' : 'space-y-4'}>
        {noCommits ? (
          <Alert>
            <AlertTitle>这个周期没有匹配提交</AlertTitle>
            <AlertDescription>
              尚未调用 AI。可以更换报告类型或周期重新采集，也可以继续生成一份空周期报告。
            </AlertDescription>
          </Alert>
        ) : null}
        {readyForReview && !onboarding ? (
          <label className='flex items-center gap-2 text-sm'>
            <Checkbox checked={publish} onCheckedChange={(value) => setPublish(value === true)} />
            保存后推送到飞书
          </label>
        ) : null}
        {forceSave ? (
          <Alert variant='destructive'>
            <AlertTitle>该周期已有报告</AlertTitle>
            <AlertDescription>
              现有报告的关联信息缺失、无效或报告类型不同。再次确认会覆盖报告，并将原文件备份到同目录的历史文件夹（.history）中。
            </AlertDescription>
          </Alert>
        ) : null}
        <div className='flex flex-wrap justify-end gap-2 border-t pt-4'>
          {generating && runId ? (
            regenerate.isPending ? null : (
              <Button variant='outline' onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                取消生成
              </Button>
            )
          ) : onClose ? (
            <Button variant='outline' onClick={onClose} disabled={busy}>
              关闭
            </Button>
          ) : null}
          {noCommits ? (
            <>
              <Button
                variant='outline'
                onClick={() => generate.mutate()}
                disabled={busy || !period}
              >
                <Sparkles />
                更换周期后重新采集
              </Button>
              <Button onClick={() => retry.mutate(true)} disabled={busy}>
                {retry.isPending ? <Loader2 className='animate-spin' /> : <Sparkles />}仍然生成
              </Button>
            </>
          ) : regenerate.isPending ? (
            <Button disabled>
              <Loader2 className='animate-spin' />
              重新生成
            </Button>
          ) : readyForReview ? (
            <>
              <Button variant='outline' onClick={requestRegenerate} disabled={busy}>
                <RotateCcw />
                重新生成
              </Button>
              <Button onClick={() => approve.mutate()} disabled={approve.isPending || !draft.trim()}>
                {approve.isPending ? <Loader2 className='animate-spin' /> : <Save />}
                {forceSave ? '覆盖并保存' : '确认并保存'}
              </Button>
            </>
          ) : (
            <Button onClick={() => generate.mutate()} disabled={busy || !period}>
              {generating ? <Loader2 className='animate-spin' /> : <Sparkles />}开始生成
            </Button>
          )}
        </div>
      </div>
      <Dialog open={templatePreviewOpen} onOpenChange={setTemplatePreviewOpen}>
        <DialogContent className='grid max-h-[min(48rem,calc(100vh-2rem))] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-3xl'>
          <DialogHeader>
            <DialogTitle>{getTemplateLabel(templateType)}预览</DialogTitle>
            <DialogDescription>
              当前保存的模板内容，仅供预览。已按 {period?.start} 至 {period?.end} 渲染，不会采集数据或调用 AI。
            </DialogDescription>
          </DialogHeader>
          <div className='min-h-0 overflow-y-auto rounded-lg border p-5'>
            {templatePreview.isPending ? (
              <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                <Loader2 className='animate-spin' />
                正在读取模板…
              </div>
            ) : templatePreview.isError ? (
              <Alert variant='destructive'>
                <AlertTitle>无法预览模板</AlertTitle>
                <AlertDescription>{getErrorMessage(templatePreview.error)}</AlertDescription>
              </Alert>
            ) : (
              <MarkdownViewer content={templatePreview.data?.template.renderedContent ?? ''} />
            )}
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmRegenerateOpen}
        onOpenChange={setConfirmRegenerateOpen}
        title='重新生成报告？'
        desc='当前手动修改会被丢弃，并使用相同的采集数据重新调用 AI。'
        cancelBtnText='保留当前草稿'
        confirmText='放弃修改并重新生成'
        handleConfirm={() => {
          setConfirmRegenerateOpen(false)
          regenerate.mutate()
        }}
      />
    </div>
  )
}

const TEMPLATE_OPTIONS: Array<{ value: ReportType; label: string }> = [
  { value: 'daily', label: '日报模板' },
  { value: 'weekly', label: '周报模板' },
  { value: 'monthly', label: '月报模板' },
  { value: 'custom', label: '自定义报告模板' },
]

function getTemplateLabel(type: ReportType) {
  return TEMPLATE_OPTIONS.find((option) => option.value === type)?.label ?? '报告模板'
}

async function restoreRun(runId: string) {
  const restoredRun = await window.electronAPI.runs.get(runId)
  const restoredDraft =
    restoredRun.status === 'awaiting_review'
      ? await window.electronAPI.runs.readDraft(runId)
      : undefined
  return { restoredRun, restoredDraft }
}

function onboardingPeriod(reportType: Exclude<ReportType, 'custom'>) {
  const date = startOfToday()
  if (reportType === 'daily') {
    const day = formatDate(date)
    return { start: day, end: day }
  }
  if (reportType === 'weekly') {
    const day = date.getDay()
    date.setDate(date.getDate() - (day === 0 ? 7 : day))
    const end = formatDate(date)
    date.setDate(date.getDate() - 6)
    return { start: formatDate(date), end }
  }
  date.setDate(0)
  const end = formatDate(date)
  date.setDate(1)
  return { start: formatDate(date), end }
}

function currentPeriod(reportType: Exclude<ReportType, 'custom'>) {
  const date = startOfToday()
  const end = formatDate(date)
  if (reportType === 'daily') return { start: end, end }
  if (reportType === 'weekly') {
    const day = date.getDay()
    date.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
    return { start: formatDate(date), end }
  }
  date.setDate(1)
  return { start: formatDate(date), end }
}

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function toPeriod(range: DateRange | undefined) {
  if (!range?.from || !range.to) return undefined
  return { start: formatDate(range.from), end: formatDate(range.to) }
}

function toDateRange(period: ReportFile['period'] | undefined): DateRange | undefined {
  if (!period) return undefined
  return {
    from: new Date(`${period.start}T00:00:00`),
    to: new Date(`${period.end}T00:00:00`),
  }
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isSummaryReplacementRequired(message: string) {
  return (
    message.includes('Existing summary metadata is invalid') ||
    message.includes('Existing summary is ')
  )
}

function isNoCommitsMessage(message: string) {
  return message.includes('没有匹配的提交') || message.includes('NO_COMMITS')
}
