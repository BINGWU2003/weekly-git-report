import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CalendarDays, Loader2, Save, Sparkles } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import type { ReportType } from '@weekly-git-report/shared'
import type { ReportFile } from '../../../shared/ipc'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getErrorMessage } from '@/lib/errors'
import { showSuccessToast } from '@/lib/toast'

export function GenerateReportDialog({
  open,
  onOpenChange,
  onSaved,
  initialReport,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  onSaved(): void
  initialReport?: ReportFile
}) {
  const [reportType, setReportType] = useState<ReportType>(initialReport?.reportType ?? 'weekly')
  const [customRange, setCustomRange] = useState<DateRange | undefined>(() => toDateRange(initialReport?.period))
  const [title, setTitle] = useState(initialReport?.reportTitle ?? '')
  const [regenerating, setRegenerating] = useState(Boolean(initialReport))
  const [context, setContext] = useState('')
  const [draft, setDraft] = useState('')
  const [runId, setRunId] = useState<string>()
  const [publish, setPublish] = useState(false)
  const [forceSave, setForceSave] = useState(false)
  const period = regenerating && initialReport?.period
    ? initialReport.period
    : reportType === 'custom'
      ? toPeriod(customRange)
      : currentPeriod(reportType)

  useEffect(() => window.electronAPI.runs.onGenerationDelta((id, delta) => {
    setRunId(id)
    setDraft((value) => value + delta)
  }), [])

  const generate = useMutation({
    mutationFn: () => window.electronAPI.runs.generate({
      reportType,
      period: period!,
      ...(regenerating && initialReport?.reportId ? { reportId: initialReport.reportId } : {}),
      ...(reportType === 'custom' && title.trim() ? { title: title.trim() } : {}),
      ...(context.trim() ? { userContext: context.trim() } : {}),
    }),
    onMutate: () => { setDraft(''); setRunId(undefined); setForceSave(false) },
    onSuccess: (run) => setRunId(run.id),
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const approve = useMutation({
    mutationFn: () => window.electronAPI.runs.approve(runId!, draft, publish, forceSave),
    onSuccess: () => {
      showSuccessToast(publish ? '报告已保存并推送' : '报告已保存')
      resetForm()
      onSaved()
      onOpenChange(false)
    },
    onError: (error) => {
      const message = getErrorMessage(error)
      if (isSummaryReplacementRequired(message)) {
        setForceSave(true)
        toast.warning('目标周期已有无法校验的报告，请确认是否覆盖。')
        return
      }
      toast.error(message)
    },
  })
  const cancel = useMutation({
    mutationFn: () => window.electronAPI.runs.cancel(runId!),
    onSuccess: () => {
      showSuccessToast('运行已取消')
      resetForm()
      onOpenChange(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function changeReportType(value: string) {
    setReportType(value as ReportType)
    setRegenerating(false)
    setCustomRange(undefined)
    setTitle('')
  }

  function resetForm() {
    setReportType('weekly')
    setCustomRange(undefined)
    setTitle('')
    setContext('')
    setDraft('')
    setRunId(undefined)
    setPublish(false)
    setForceSave(false)
    setRegenerating(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !generate.isPending && !approve.isPending && onOpenChange(next)}>
      <DialogContent className='max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{regenerating ? '重新生成报告' : '生成报告'}</DialogTitle>
          <DialogDescription>每次都会重新同步和采集。AI 输出先作为草稿，确认后才写入 Summary。</DialogDescription>
        </DialogHeader>
        <div className='min-h-0 space-y-4 overflow-y-auto overscroll-contain pe-1'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label>报告类型</Label>
              <Select value={reportType} onValueChange={changeReportType} disabled={generate.isPending}>
                <SelectTrigger className='w-full'><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='daily'>日报</SelectItem>
                  <SelectItem value='weekly'>周报</SelectItem>
                  <SelectItem value='monthly'>月报</SelectItem>
                  <SelectItem value='custom'>自定义报告</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {reportType === 'custom' ? (
              <div className='space-y-2'>
                <Label>日期范围</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type='button' variant='outline' className='w-full justify-start font-normal' disabled={generate.isPending}>
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
                <Label>生成周期</Label>
                <div className='flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm'>
                  {period?.start} ~ {period?.end}
                </div>
              </div>
            )}
          </div>
          {reportType === 'custom' ? (
            <div className='space-y-2'>
              <Label>报告标题（可选）</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} disabled={generate.isPending} placeholder='默认使用“自定义报告”' />
            </div>
          ) : null}
          <div className='space-y-2'>
            <Label>本次补充事实（可选）</Label>
            <Textarea value={context} onChange={(event) => setContext(event.target.value)} disabled={generate.isPending} placeholder='只填写模型无法从 Git 提交中得知的背景或结果。' />
          </div>
          {(generate.isPending || draft) && (
            <div className='space-y-2'>
              <Label>报告草稿</Label>
              <Textarea
                aria-label='报告草稿'
                className='field-sizing-fixed h-80 min-h-80 max-h-80 resize-none overflow-y-auto font-mono'
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                readOnly={generate.isPending}
              />
              {generate.isPending && <p className='flex items-center gap-2 text-sm text-muted-foreground'><Loader2 className='size-4 animate-spin' />正在同步、采集并生成，内容会实时显示…</p>}
            </div>
          )}
          {runId && !generate.isPending && (
            <label className='flex items-center gap-2 text-sm'><Checkbox checked={publish} onCheckedChange={(value) => setPublish(value === true)} />保存后推送到飞书</label>
          )}
          {forceSave && (
            <Alert variant='destructive'>
              <AlertTitle>目标周期已有报告</AlertTitle>
              <AlertDescription>现有报告的元数据缺失、无效或类型不同。再次确认会覆盖报告，并将原文件备份到同目录的 .history 中。</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter className='border-t pt-4'>
          {generate.isPending && runId ? (
            <Button variant='outline' onClick={() => cancel.mutate()} disabled={cancel.isPending}>取消运行</Button>
          ) : (
            <Button variant='outline' onClick={() => onOpenChange(false)} disabled={approve.isPending}>关闭</Button>
          )}
          {!runId || generate.isPending ? (
            <Button onClick={() => generate.mutate()} disabled={generate.isPending || !period}>{generate.isPending ? <Loader2 className='animate-spin' /> : <Sparkles />}开始生成</Button>
          ) : (
            <Button onClick={() => approve.mutate()} disabled={approve.isPending || !draft.trim()}>{approve.isPending ? <Loader2 className='animate-spin' /> : <Save />}{forceSave ? '覆盖并保存' : '确认并保存'}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function currentPeriod(reportType: Exclude<ReportType, 'custom'>) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  const end = formatDate(date)
  if (reportType === 'daily') {
    const day = formatDate(date)
    return { start: day, end: day }
  }
  if (reportType === 'weekly') {
    const day = date.getDay()
    date.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
    return { start: formatDate(date), end }
  }
  date.setDate(1)
  return { start: formatDate(date), end }
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
  return message.includes('Existing summary metadata is invalid') || message.includes('Existing summary is ')
}
