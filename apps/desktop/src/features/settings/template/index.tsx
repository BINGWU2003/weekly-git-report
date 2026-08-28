import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { AlertCircle, Loader2, RefreshCw, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'
import type { Period, SummaryTemplateResult } from '@weekly-git-report/shared'
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes'
import { MarkdownViewer } from '@/components/markdown-viewer'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { getErrorMessage } from '@/lib/errors'
import { showSuccessToast } from '@/lib/toast'
import { ContentSection } from '../components/content-section'

export function SettingsTemplate() {
  const [period] = useState(getExamplePeriod)
  const template = useQuery({
    queryKey: ['summary-template', period.start, period.end],
    queryFn: () => window.electronAPI.templates.read(period),
  })

  return (
    <ContentSection
      title='生成模板'
      desc='CLI、Agent 与 Electron 共同读取这一份周报生成提示词。'
      contentClassName='lg:max-w-none'
    >
      {template.isLoading && <Loading />}
      {template.isError && (
        <Alert variant='destructive'>
          <AlertCircle />
          <AlertTitle>无法读取生成模板</AlertTitle>
          <AlertDescription>{getErrorMessage(template.error)}</AlertDescription>
        </Alert>
      )}
      {template.data && (
        <SummaryTemplateEditor
          key={template.data.template.revision}
          initial={template.data}
          period={period}
        />
      )}
    </ContentSection>
  )
}

interface SummaryTemplateEditorProps {
  initial: SummaryTemplateResult
  period: Period
}

export function SummaryTemplateEditor({ initial, period }: SummaryTemplateEditorProps) {
  const queryClient = useQueryClient()
  const [content, setContent] = useState(initial.template.content)
  const [preview, setPreview] = useState(initial.template.renderedContent)
  const [previewError, setPreviewError] = useState<string>()
  const [reloading, setReloading] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const dirty = content !== initial.template.content
  useUnsavedChanges(dirty)

  useEffect(() => {
    let cancelled = false
    const timeout = window.setTimeout(() => {
      void updatePreview()
    }, 200)

    async function updatePreview() {
      try {
        const next = await window.electronAPI.templates.preview({ content, period })
        if (cancelled) return
        setPreview(next)
        setPreviewError(undefined)
      } catch (error) {
        if (cancelled) return
        setPreview(null)
        setPreviewError(getErrorMessage(error))
      }
    }

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [content, period])

  const save = useMutation({
    mutationFn: () =>
      window.electronAPI.templates.save({
        content,
        expectedRevision: initial.template.revision,
        period,
      }),
    onSuccess: (next) => {
      setTemplateQueryData(queryClient, period, next)
      setContent(next.template.content)
      setPreview(next.template.renderedContent)
      showSuccessToast('生成模板已保存')
    },
    onError: (error) => showTemplateError(error),
  })

  const reset = useMutation({
    mutationFn: () =>
      window.electronAPI.templates.reset({
        expectedRevision: initial.template.revision,
        period,
      }),
    onSuccess: (next) => {
      setTemplateQueryData(queryClient, period, next)
      setContent(next.template.content)
      setPreview(next.template.renderedContent)
      setResetDialogOpen(false)
      showSuccessToast('已恢复默认生成模板')
    },
    onError: (error) => showTemplateError(error),
  })

  async function reload() {
    if (dirty && !window.confirm('当前模板有未保存的修改，确定重新读取吗？')) return
    setReloading(true)
    try {
      const next = await window.electronAPI.templates.read(period)
      setTemplateQueryData(queryClient, period, next)
      setContent(next.template.content)
      setPreview(next.template.renderedContent)
      setPreviewError(undefined)
      showSuccessToast('生成模板已重新读取')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setReloading(false)
    }
  }

  function restoreDefault(event: React.MouseEvent) {
    if (initial.template.isDefault) {
      setContent(initial.template.content)
      setPreview(initial.template.renderedContent)
      setPreviewError(undefined)
      return
    }
    event.preventDefault()
    reset.mutate()
  }

  return (
    <div className='space-y-5'>
      <Alert>
        <AlertTitle>模板由 CLI 和桌面端共享</AlertTitle>
        <AlertDescription>
          Agent 通过 <code>weekly templates read</code>{' '}
          获取提示词。Raw 提交记录不会写入模板，而是作为独立数据交给模型。
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className='gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div className='space-y-1.5'>
            <div className='flex flex-wrap items-center gap-2'>
              <CardTitle>周报生成提示词</CardTitle>
              <Badge variant={initial.template.isDefault ? 'secondary' : 'outline'}>
                {dirty ? '未保存修改' : initial.template.isDefault ? '默认模板' : '自定义模板'}
              </Badge>
            </div>
            <CardDescription className='break-all font-mono text-xs'>
              {initial.template.path}
            </CardDescription>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => void reload()}
              disabled={reloading || save.isPending || reset.isPending}
            >
              <RefreshCw className={reloading ? 'animate-spin' : ''} />
              重新读取
            </Button>
            <AlertDialog
              open={resetDialogOpen}
              onOpenChange={(open) => !reset.isPending && setResetDialogOpen(open)}
            >
              <AlertDialogTrigger asChild>
                <Button
                  type='button'
                  variant='outline'
                  disabled={
                    (initial.template.isDefault && !dirty) ||
                    reloading ||
                    save.isPending ||
                    reset.isPending
                  }
                >
                  <RotateCcw />
                  恢复默认
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>恢复默认生成模板？</AlertDialogTitle>
                  <AlertDialogDescription>
                    当前自定义内容会被内置默认模板替换，此操作不会自动创建备份。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={reset.isPending}>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={restoreDefault} disabled={reset.isPending}>
                    {reset.isPending && <Loader2 className='animate-spin' />}
                    确认恢复
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              type='button'
              onClick={() => save.mutate()}
              disabled={
                !dirty ||
                Boolean(previewError) ||
                reloading ||
                save.isPending ||
                reset.isPending
              }
            >
              {save.isPending ? <Loader2 className='animate-spin' /> : <Save />}
              保存模板
            </Button>
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='text-sm text-muted-foreground'>
            可用变量：<code>{'{{startDate}}'}</code>、<code>{'{{endDate}}'}</code>
            。两个变量都必须保留，其他变量不会被接受。
          </div>
          <Tabs defaultValue='edit'>
            <TabsList>
              <TabsTrigger value='edit'>编辑</TabsTrigger>
              <TabsTrigger value='preview'>预览</TabsTrigger>
            </TabsList>
            <TabsContent value='edit' className='mt-3'>
              <Textarea
                aria-label='周报生成提示词'
                value={content}
                onChange={(event) => setContent(event.target.value)}
                spellCheck={false}
                className='min-h-[520px] resize-y font-mono text-sm leading-6'
              />
            </TabsContent>
            <TabsContent value='preview' className='mt-3'>
              <div className='mb-3 text-sm text-muted-foreground'>
                示例周期：{period.start} 至 {period.end}
              </div>
              {previewError ? (
                <Alert variant='destructive'>
                  <AlertCircle />
                  <AlertTitle>模板无法预览</AlertTitle>
                  <AlertDescription>{previewError}</AlertDescription>
                </Alert>
              ) : (
                <div className='min-h-[520px] rounded-lg border p-5'>
                  <MarkdownViewer content={preview ?? ''} />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function setTemplateQueryData(
  queryClient: QueryClient,
  period: Period,
  value: SummaryTemplateResult
) {
  queryClient.setQueryData(['summary-template', period.start, period.end], value)
}

function showTemplateError(error: unknown) {
  if (error instanceof Error && error.message.includes('changed since')) {
    toast.error('模板已被 CLI 或其他窗口修改，请重新读取后再保存。')
    return
  }
  toast.error(getErrorMessage(error))
}

function getExamplePeriod(): Period {
  const end = new Date()
  const start = new Date(end)
  const day = start.getDay()
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1))
  return { start: formatDate(start), end: formatDate(end) }
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function Loading() {
  return (
    <div className='flex items-center gap-2 rounded-lg border p-6 text-sm text-muted-foreground'>
      <Loader2 className='animate-spin' />
      正在读取生成模板…
    </div>
  )
}
