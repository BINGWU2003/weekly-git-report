import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Ban, Clock3, Loader2, RefreshCw, RotateCcw, Save } from 'lucide-react'
import type { ReportRun, ReportRunStatus } from '@weekly-git-report/shared'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { getErrorMessage } from '@/lib/errors'
import { showErrorToast, showSuccessToast, showWarningToast } from '@/lib/toast'

export function Runs() {
  const queryClient = useQueryClient()
  const [reviewing, setReviewing] = useState<ReportRun>()
  const runs = useQuery({ queryKey: ['runs'], queryFn: () => window.electronAPI.runs.list(200), refetchInterval: 5_000 })
  const action = useMutation({
    mutationFn: ({ type, id }: { type: 'retry' | 'cancel'; id: string }) => type === 'retry' ? window.electronAPI.runs.retry(id) : window.electronAPI.runs.cancel(id),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['runs'] })
      showSuccessToast(variables.type === 'cancel' ? '执行已取消' : '已开始重试')
    },
    onError: (error) => showErrorToast(getErrorMessage(error)),
  })

  return <>
    <Header><div className='me-auto text-sm font-medium'>报告生成过程</div><ThemeSwitch /></Header>
    <Main className='space-y-6'>
      <div className='flex items-end justify-between gap-3'><div><h1 className='text-2xl font-bold tracking-tight md:text-3xl'>执行记录</h1><p className='text-muted-foreground'>查看报告采集、生成、审核、保存和飞书推送的完整状态。</p></div><Button variant='outline' onClick={() => void runs.refetch()} disabled={runs.isFetching}><RefreshCw className={runs.isFetching ? 'animate-spin' : ''} />刷新</Button></div>
      {runs.isError && <Alert variant='destructive'><AlertTitle>无法读取执行记录</AlertTitle><AlertDescription>{getErrorMessage(runs.error)}</AlertDescription></Alert>}
      <div className='space-y-3'>
        {runs.data?.map((run) => <Card key={run.id}><CardHeader><div className='flex flex-wrap items-start justify-between gap-3'><div><CardTitle className='flex items-center gap-2'><Activity />{run.title?.trim() || reportTypeLabel(run.reportType)} · {run.period.start} ~ {run.period.end}</CardTitle><CardDescription className='mt-1 font-mono'>{run.id}</CardDescription></div><Status status={run.status} /></div></CardHeader><CardContent className='space-y-3'>
          <div className='flex flex-wrap gap-2 text-sm text-muted-foreground'><span>第 {run.attempt} 次尝试</span><span>·</span><span>{run.generator === 'builtin-ai' ? `${run.provider ?? 'AI'} / ${run.model ?? '等待生成'}` : '外部 AI'}</span>{run.tokenUsage && <><span>·</span><span>用量：输入 {run.tokenUsage.inputTokens}、输出 {run.tokenUsage.outputTokens}、总计 {run.tokenUsage.totalTokens}</span></>}</div>
          <div className='flex flex-wrap gap-2'>{run.steps.map((step) => <Badge key={`${step.name}-${step.attempt}`} variant={step.status === 'failed' ? 'destructive' : 'outline'}>{stepLabel(step.name)} · {stepStatusLabel(step.status)}</Badge>)}</div>
          {run.error && <Alert variant='destructive'><AlertTitle>执行失败</AlertTitle><AlertDescription className='space-y-1 whitespace-pre-wrap [overflow-wrap:anywhere]'><p>{runErrorMessage(run.error.message, run.error.code)}</p><p className='text-xs opacity-80'>错误代码：{run.error.code}</p></AlertDescription></Alert>}
          <div className='flex justify-end gap-2'>
            {['queued', 'collecting', 'generating', 'awaiting_review'].includes(run.status) && <Button size='sm' variant='outline' onClick={() => action.mutate({ type: 'cancel', id: run.id })}><Ban />取消执行</Button>}
            {(run.status === 'failed' || run.status === 'publish_failed') && <Button size='sm' variant='outline' onClick={() => action.mutate({ type: 'retry', id: run.id })}><RotateCcw />{run.status === 'publish_failed' ? '重试推送' : '重试执行'}</Button>}
            {run.status === 'awaiting_review' && <Button size='sm' onClick={() => setReviewing(run)}><Save />审核草稿</Button>}
          </div>
        </CardContent></Card>)}
      </div>
      {runs.isLoading && <p className='flex items-center gap-2 text-muted-foreground'><Loader2 className='animate-spin' />正在读取执行记录…</p>}
      {runs.data?.length === 0 && <Card className='border-dashed'><CardHeader className='items-center py-14 text-center'><Clock3 className='size-8 text-muted-foreground' /><CardTitle>还没有执行记录</CardTitle><CardDescription>可以从报告库生成报告，或在报告任务中立即执行一次。</CardDescription></CardHeader></Card>}
    </Main>
    {reviewing && <ReviewDialog run={reviewing} open onOpenChange={(open) => !open && setReviewing(undefined)} onSaved={async () => { setReviewing(undefined); await queryClient.invalidateQueries({ queryKey: ['runs'] }); await queryClient.invalidateQueries({ queryKey: ['reports'] }) }} />}
  </>
}

function ReviewDialog({ run, open, onOpenChange, onSaved }: { run: ReportRun; open: boolean; onOpenChange(open: boolean): void; onSaved(): Promise<void> }) {
  const [content, setContent] = useState<string>()
  const [publish, setPublish] = useState(false)
  const [forceSave, setForceSave] = useState(() => isSummaryReplacementRequired(run.error?.message, run.error?.code))
  const draft = useQuery({ queryKey: ['run-draft', run.id], queryFn: () => window.electronAPI.runs.readDraft(run.id) })
  const draftContent = content ?? draft.data ?? ''
  const approve = useMutation({ mutationFn: () => window.electronAPI.runs.approve(run.id, draftContent, publish, forceSave), onSuccess: async () => { showSuccessToast(publish ? '报告已保存并推送' : '报告已保存'); await onSaved() }, onError: (error) => { const message = getErrorMessage(error); if (isSummaryReplacementRequired(message)) { setForceSave(true); showWarningToast('该周期已有无法校验的报告，请确认是否覆盖。'); return }; showErrorToast(message) } })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='grid h-[calc(100vh-2rem)] max-h-[48rem] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>审核{run.title?.trim() || reportTypeLabel(run.reportType)}草稿</DialogTitle>
          <DialogDescription>可以在保存前编辑草稿；确认后报告才会加入报告库。</DialogDescription>
        </DialogHeader>
        {draft.isLoading ? (
          <p className='flex min-h-0 items-center gap-2 text-muted-foreground'>
            <Loader2 className='animate-spin' />
            正在读取草稿…
          </p>
        ) : (
          <Textarea
            aria-label='审核报告草稿'
            className='field-sizing-fixed h-full min-h-0 resize-none overflow-y-auto font-mono'
            value={draftContent}
            onChange={(event) => setContent(event.target.value)}
          />
        )}
        <div className='space-y-4'>
          {forceSave && (
            <Alert variant='destructive'>
              <AlertTitle>该周期已有报告</AlertTitle>
              <AlertDescription>
                现有报告的关联信息缺失、无效或报告类型不同。再次确认会覆盖报告，并将原文件备份到同目录的历史文件夹（.history）中。
              </AlertDescription>
            </Alert>
          )}
          <label className='flex items-center gap-2 text-sm'>
            <Checkbox checked={publish} onCheckedChange={(value) => setPublish(value === true)} />
            保存后推送飞书
          </label>
          <DialogFooter>
            <Button variant='outline' onClick={() => onOpenChange(false)}>取消</Button>
            <Button onClick={() => approve.mutate()} disabled={approve.isPending || !draftContent.trim()}>
              {approve.isPending ? <Loader2 className='animate-spin' /> : <Save />}
              {forceSave ? '覆盖并保存' : '确认并保存'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Status({ status }: { status: ReportRunStatus }) { const destructive = status === 'failed' || status === 'publish_failed'; return <Badge variant={destructive ? 'destructive' : status === 'succeeded' ? 'secondary' : 'outline'}>{statusLabel(status)}</Badge> }
function reportTypeLabel(value: ReportRun['reportType']) { return value === 'daily' ? '日报' : value === 'weekly' ? '周报' : value === 'monthly' ? '月报' : '自定义报告' }
function stepLabel(value: ReportRun['steps'][number]['name']) { return { collect: '采集', generate: 'AI', review: '审核', save: '保存', publish: '推送' }[value] }
function stepStatusLabel(value: ReportRun['steps'][number]['status']) { return { pending: '等待中', running: '进行中', succeeded: '已完成', failed: '失败', cancelled: '已取消' }[value] }
function statusLabel(value: ReportRunStatus) { return { queued: '排队中', collecting: '采集中', generating: '生成中', awaiting_review: '待审核', saving: '保存中', publishing: '推送中', succeeded: '已完成', publish_failed: '推送失败', failed: '失败', cancelled: '已取消', abandoned: '已放弃' }[value] }

function runErrorMessage(message: string, code: string) {
  if (isSummaryReplacementRequired(message, code)) {
    return '该周期已有无法校验的报告，请审核草稿并确认是否覆盖。'
  }
  return message
}

function isSummaryReplacementRequired(message?: string, code?: string) { return code === 'SUMMARY_REPLACE_REQUIRED' || Boolean(message?.includes('Existing summary metadata is invalid') || message?.includes('Existing summary is ')) }
