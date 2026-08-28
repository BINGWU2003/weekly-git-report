import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  FolderGit2,
  RefreshCw,
  Settings2,
  TimerReset,
  TriangleAlert,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { OverflowTooltip } from '@/components/overflow-tooltip'
import { ThemeSwitch } from '@/components/theme-switch'
import { getErrorMessage } from '@/lib/errors'
import { showSuccessToast } from '@/lib/toast'

export function Dashboard() {
  const overview = useQuery({
    queryKey: ['desktop-overview'],
    queryFn: () => window.electronAPI.overview.get(),
  })

  const data = overview.data
  const healthyChecks = data?.diagnostics.filter((check) => check.status === 'ok').length ?? 0

  async function refreshOverview() {
    const result = await overview.refetch()
    if (!result.isError) showSuccessToast('总览已刷新')
  }

  return (
    <>
      <Header>
        <div className='me-auto'>
          <p className='text-sm font-medium'>本地工作台</p>
          <p className='text-xs text-muted-foreground'>Git 数据不会离开你的电脑</p>
        </div>
        <ThemeSwitch />
      </Header>

      <Main className='space-y-6'>
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>总览</h1>
            <p className='text-muted-foreground'>查看仓库、报告和桌面运行环境的当前状态。</p>
          </div>
          <Button
            variant='outline'
            onClick={() => void refreshOverview()}
            disabled={overview.isFetching}
          >
            <RefreshCw className={overview.isFetching ? 'animate-spin' : ''} />
            刷新
          </Button>
        </div>

        {overview.isError && (
          <Alert variant='destructive'>
            <AlertCircle />
            <AlertTitle>无法读取本地状态</AlertTitle>
            <AlertDescription className='[overflow-wrap:anywhere]'>
              {getErrorMessage(overview.error)}
            </AlertDescription>
          </Alert>
        )}

        {data && !data.initialized && (
          <Alert>
            <TriangleAlert />
            <AlertTitle>尚未完成初始化</AlertTitle>
            <AlertDescription>
              <p>前往常规设置创建共享配置、仓库索引、报告目录和生成模板，无需先运行 CLI。</p>
              <Button asChild size='sm' variant='outline' className='mt-2'>
                <Link to='/settings'>
                  <Settings2 />
                  开始初始化
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
          <MetricCard
            title='已启用仓库'
            value={data ? `${data.enabledProjectCount}/${data.projectCount}` : '—'}
            description='启用仓库 / 全部仓库'
            icon={FolderGit2}
          />
          <MetricCard
            title='Markdown 报告'
            value={data?.reportCount.toString() ?? '—'}
            description='outputRoot 下的报告文件'
            icon={FileText}
          />
          <MetricCard
            title='自动任务'
            value='0'
            description='调度能力将在下一阶段接入'
            icon={TimerReset}
          />
          <MetricCard
            title='环境检查'
            value={data ? `${healthyChecks}/${data.diagnostics.length}` : '—'}
            description='Git、配置与输出目录'
            icon={CheckCircle2}
          />
        </div>

        <div className='grid gap-4 lg:grid-cols-[1.35fr_1fr]'>
          <Card>
            <CardHeader>
              <CardTitle>环境状态</CardTitle>
              <CardDescription>桌面端直接读取 CLI 使用的同一套本地配置。</CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              {data?.diagnostics.map((check) => (
                <div
                  key={check.id}
                  className='flex items-start justify-between gap-4 rounded-lg border p-3'
                >
                  <div className='min-w-0 flex-1'>
                    <p className='font-medium'>{check.label}</p>
                    <OverflowTooltip
                      text={check.message}
                      className='text-sm text-muted-foreground'
                    />
                  </div>
                  <StatusBadge status={check.status} />
                </div>
              ))}
              {!data && <p className='text-sm text-muted-foreground'>正在读取环境状态…</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>快速开始</CardTitle>
              <CardDescription>从现有仓库配置和报告开始。</CardDescription>
            </CardHeader>
            <CardContent className='grid gap-3'>
              <Button asChild className='justify-start'>
                <Link to='/repositories'>
                  <FolderGit2 />
                  查看仓库
                </Link>
              </Button>
              <Button asChild variant='outline' className='justify-start'>
                <Link to='/reports'>
                  <FileText />
                  浏览 Markdown 报告
                </Link>
              </Button>
              <Button asChild variant='outline' className='justify-start'>
                <Link to='/settings'>
                  <Settings2 />
                  检查共享配置
                </Link>
              </Button>
              {data?.config && (
                <div className='mt-2 rounded-lg bg-muted p-3 text-sm'>
                  <p className='font-medium'>当前报告目录</p>
                  <p className='mt-1 text-muted-foreground [overflow-wrap:anywhere]'>
                    {data.config.outputRoot}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}

type MetricCardProps = {
  title: string
  value: string
  description: string
  icon: React.ElementType
}

function MetricCard({ title, value, description, icon: Icon }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        <Icon className='size-4 text-muted-foreground' />
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{value}</div>
        <p className='text-xs text-muted-foreground'>{description}</p>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: 'ok' | 'warning' | 'error' }) {
  if (status === 'ok') return <Badge variant='secondary'>正常</Badge>
  if (status === 'warning') return <Badge variant='outline'>待处理</Badge>
  return <Badge variant='destructive'>错误</Badge>
}
