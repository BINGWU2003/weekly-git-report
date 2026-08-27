import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, FolderOpen, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { MarkdownViewer } from '@/components/markdown-viewer'
import { ThemeSwitch } from '@/components/theme-switch'
import { cn } from '@/lib/utils'

export function Reports() {
  const [selectedId, setSelectedId] = useState<string>()
  const reports = useQuery({
    queryKey: ['reports'],
    queryFn: () => window.electronAPI.reports.list(),
  })
  const selected = useQuery({
    queryKey: ['report', selectedId],
    queryFn: () => window.electronAPI.reports.read(selectedId!),
    enabled: Boolean(selectedId),
  })

  return (
    <>
      <Header>
        <div className='me-auto'>
          <p className='text-sm font-medium'>Markdown 报告库</p>
          <p className='text-xs text-muted-foreground'>Raw、Summary 与 Electron Task 报告</p>
        </div>
        <ThemeSwitch />
      </Header>
      <Main fixed className='gap-4'>
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>报告库</h1>
            <p className='text-muted-foreground'>直接浏览 outputRoot 下的所有 Markdown 文件。</p>
          </div>
          <div className='flex gap-2'>
            <Button variant='outline' onClick={() => window.electronAPI.system.openOutputRoot()}>
              <FolderOpen />
              打开目录
            </Button>
            <Button
              variant='outline'
              onClick={() => reports.refetch()}
              disabled={reports.isFetching}
            >
              <RefreshCw className={reports.isFetching ? 'animate-spin' : ''} />
              刷新
            </Button>
          </div>
        </div>

        <div className='grid min-h-0 flex-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]'>
          <Card className='min-h-0 overflow-hidden'>
            <ScrollArea className='h-full'>
              <CardContent className='space-y-2 p-3'>
                {reports.data?.map((report) => (
                  <button
                    key={report.id}
                    type='button'
                    onClick={() => setSelectedId(report.id)}
                    className={cn(
                      'w-full rounded-lg border p-3 text-start transition-colors hover:bg-muted',
                      selectedId === report.id && 'border-primary bg-muted'
                    )}
                  >
                    <div className='flex items-start gap-2'>
                      <FileText className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                      <div className='min-w-0 flex-1'>
                        <p className='truncate text-sm font-medium'>{report.name}</p>
                        <p className='mt-1 truncate text-xs text-muted-foreground'>
                          {report.relativePath}
                        </p>
                        <div className='mt-2 flex items-center justify-between gap-2'>
                          <ReportKind kind={report.kind} />
                          <span className='text-xs text-muted-foreground'>
                            {formatBytes(report.size)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
                {!reports.isLoading && reports.data?.length === 0 && (
                  <p className='p-6 text-center text-sm text-muted-foreground'>暂无 Markdown 报告。</p>
                )}
                {reports.isLoading && (
                  <p className='p-6 text-center text-sm text-muted-foreground'>正在扫描报告目录…</p>
                )}
              </CardContent>
            </ScrollArea>
          </Card>

          <Card className='min-h-0 overflow-hidden'>
            {selected.data ? (
              <div className='flex h-full min-h-0 flex-col'>
                <div className='flex items-center justify-between gap-3 border-b p-4'>
                  <div className='min-w-0'>
                    <p className='truncate font-medium'>{selected.data.name}</p>
                    <p className='truncate text-xs text-muted-foreground'>
                      {selected.data.relativePath}
                    </p>
                  </div>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => window.electronAPI.reports.showInFolder(selected.data.id)}
                  >
                    <FolderOpen />
                    定位文件
                  </Button>
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
                      <MarkdownViewer content={selected.data.content} className='p-5' />
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value='source' className='min-h-0 flex-1 overflow-hidden'>
                    <ScrollArea className='h-full'>
                      <pre className='min-w-full whitespace-pre-wrap break-words p-5 font-mono text-sm leading-6'>
                        {selected.data.content}
                      </pre>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className='flex h-full min-h-72 items-center justify-center p-8 text-center text-muted-foreground'>
                {selected.isLoading ? '正在读取报告…' : '从左侧选择一个 Markdown 文件查看内容。'}
              </div>
            )}
          </Card>
        </div>
      </Main>
    </>
  )
}

function ReportKind({ kind }: { kind: 'raw' | 'summary' | 'task' | 'other' }) {
  const labels = { raw: 'Raw', summary: 'Summary', task: 'Task', other: '其他' }
  return <Badge variant='outline'>{labels[kind]}</Badge>
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}
