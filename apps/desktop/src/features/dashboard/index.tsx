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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { OverflowTooltip } from '@/components/overflow-tooltip'
import { ThemeSwitch } from '@/components/theme-switch'
import { getErrorMessage } from '@/lib/errors'
import { onboardingQueryOptions, overviewQueryOptions } from '@/lib/desktop-queries'
import { showSuccessToast } from '@/lib/toast'

export function Dashboard() {
  const overview = useQuery(overviewQueryOptions)
  const onboarding = useQuery(onboardingQueryOptions)

  const data = overview.data
  const healthyChecks = data?.diagnostics.filter((check) => check.status === 'ok').length ?? 0
  const activeRuns = data
    ? (data.runCounts.queued ?? 0) +
      (data.runCounts.collecting ?? 0) +
      (data.runCounts.generating ?? 0) +
      (data.runCounts.saving ?? 0) +
      (data.runCounts.publishing ?? 0)
    : undefined
  const failedRuns = data
    ? (data.runCounts.failed ?? 0) + (data.runCounts.publish_failed ?? 0)
    : undefined

  async function refreshOverview() {
    const result = await overview.refetch()
    if (!result.isError) showSuccessToast('总览已刷新')
  }

  return (
    <>
      <Header>
        <div className='me-auto'>
          <p className='text-sm font-medium'>本地工作台</p>
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

        {data?.initialized && data.projectCount === 0 && (
          <Alert>
            <TriangleAlert />
            <AlertTitle>还没有添加仓库</AlertTitle>
            <AlertDescription>
              <p>可以继续设置并完成首次同步，也可以直接前往仓库管理。</p>
              <div className='mt-2 flex flex-wrap gap-2'>
                <Button asChild size='sm'>
                  <Link to='/setup'>继续设置</Link>
                </Button>
                <Button asChild size='sm' variant='outline'>
                  <Link to='/repositories'>仓库管理</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {onboarding.data && !onboarding.data.completedAt ? (
          <Alert>
            <TriangleAlert />
            <AlertTitle>首次设置尚未完成</AlertTitle>
            <AlertDescription>
              <p>继续配置仓库和 AI，并审核保存第一份报告。当前会话仍可使用已就绪的功能。</p>
              <Button asChild size='sm' className='mt-2'>
                <Link to='/setup'>继续首次设置</Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : onboarding.data?.completedAt &&
          (!onboarding.data.readiness.repositoryReady ||
            !onboarding.data.readiness.templatesReady) ? (
          <Alert variant='destructive'>
            <TriangleAlert />
            <AlertTitle>报告生成条件需要修复</AlertTitle>
            <AlertDescription>
              仓库或报告模板已不再就绪。前往首次设置检查并修复。
              <Button asChild size='sm' variant='outline' className='mt-2 ms-2'>
                <Link to='/setup'>查看检查清单</Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : onboarding.data?.completedAt && !onboarding.data.readiness.aiReady ? (
          <Alert>
            <TriangleAlert />
            <AlertTitle>AI 服务尚未配置</AlertTitle>
            <AlertDescription>
              配置 API Key、Base URL 和模型后即可生成报告。
              <Button asChild size='sm' variant='outline' className='mt-2 ms-2'>
                <Link to='/settings/automation'>配置 AI</Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
          <MetricCard
            title='已启用仓库'
            value={data ? `${data.enabledProjectCount}/${data.projectCount}` : '—'}
            description='启用仓库 / 全部仓库'
            icon={FolderGit2}
          />
          <MetricCard
            title='报告文件'
            value={data?.reportCount.toString() ?? '—'}
            description='报告目录中的全部文件'
            icon={FileText}
          />
          <MetricCard
            title='自动任务'
            value={data?.enabledTaskCount.toString() ?? '—'}
            description='已启用的系统调度任务'
            icon={TimerReset}
          />
          <MetricCard
            title='排队 / 运行中'
            value={activeRuns?.toString() ?? '—'}
            description='采集、生成、保存或推送'
            icon={TimerReset}
          />
          <MetricCard
            title='待审核草稿'
            value={data?.runCounts.awaiting_review?.toString() ?? '0'}
            description='确认后才会保存到报告库'
            icon={FileText}
          />
          <MetricCard
            title='失败执行'
            value={failedRuns?.toString() ?? '—'}
            description='含报告成功但推送失败'
            icon={AlertCircle}
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
              <CardDescription>检查生成报告所需的本地环境和目录。</CardDescription>
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
                  浏览报告
                </Link>
              </Button>
              <Button asChild variant='outline' className='justify-start'>
                <Link to='/settings'>
                  <Settings2 />
                  检查常规设置
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
