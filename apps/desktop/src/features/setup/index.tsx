import { useMemo, useState, type ReactNode } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  FileCheck2,
  FolderGit2,
  FolderSearch,
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  TriangleAlert,
} from 'lucide-react'
import { REPORT_CADENCES } from '@weekly-git-report/shared'
import { Logo } from '@/assets/logo'
import { ThemeSwitch } from '@/components/theme-switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  configDefaultsQueryOptions,
  configStateQueryOptions,
  desktopQueryKeys,
  diagnosticsQueryOptions,
  projectsStateQueryOptions,
} from '@/lib/desktop-queries'
import { getErrorMessage } from '@/lib/errors'
import { selectSystemDirectory } from '@/lib/system-actions'
import { ConfigForm } from '@/features/settings/general/config-form'
import { RepositoryForm } from '@/features/repositories/repository-form'
import { RepositoryImportSheet } from '@/features/repositories/repository-import-sheet'
import type { ProjectsState } from '../../../shared/ipc'

type StepIndex = 0 | 1 | 2 | 3

export function Setup() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const configState = useQuery(configStateQueryOptions)
  const defaults = useQuery({
    ...configDefaultsQueryOptions,
    enabled: configState.data?.config === null,
  })
  const projects = useQuery({
    ...projectsStateQueryOptions,
    enabled: Boolean(configState.data?.config),
  })
  const diagnostics = useQuery(diagnosticsQueryOptions)
  const [selectedStep, setActiveStep] = useState<StepIndex | null>(null)
  const [repositorySkipped, setRepositorySkipped] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [selectingImportFolder, setSelectingImportFolder] = useState(false)
  const [importSession, setImportSession] = useState<{ folder: string; state: ProjectsState }>()

  const gitCheck = diagnostics.data?.find((check) => check.id === 'git')
  const gitReady = gitCheck?.status === 'ok'
  const configReady = Boolean(configState.data?.config && configState.data.revision)
  const activeStep = selectedStep ?? (configReady && gitReady ? 2 : 0)
  const projectState = projects.data ?? { projects: [], revision: null }
  const repositoriesReady = projectState.projects.length > 0
  const repositoryStepReady = repositoriesReady || repositorySkipped

  const templateQueries = useQueries({
    queries: REPORT_CADENCES.map((cadence) => ({
      queryKey: ['summary-template', cadence],
      queryFn: () => window.electronAPI.templates.read(cadence),
      enabled: configReady && activeStep === 3,
      retry: false,
    })),
  })
  const templatesReady = templateQueries.every((query) => query.isSuccess)
  const templatesLoading = templateQueries.some((query) => query.isLoading)
  const templateError = templateQueries.find((query) => query.isError)?.error

  const availability = useMemo(
    () => [true, gitReady, configReady && gitReady, configReady && gitReady && repositoryStepReady] as const,
    [configReady, gitReady, repositoryStepReady]
  )
  const completion = [gitReady, configReady, repositoriesReady || repositorySkipped, false] as const

  function applyProjectState(next: ProjectsState) {
    queryClient.setQueryData(desktopQueryKeys.projectsState, next)
    void queryClient.invalidateQueries({ queryKey: desktopQueryKeys.overview })
    void queryClient.invalidateQueries({ queryKey: desktopQueryKeys.projectsRuntime })
    setRepositorySkipped(false)
  }

  async function openImport() {
    setSelectingImportFolder(true)
    try {
      const folder = await selectSystemDirectory()
      if (folder) setImportSession({ folder, state: projectState })
    } finally {
      setSelectingImportFolder(false)
    }
  }

  async function finish(to: '/' | '/repositories') {
    await queryClient.invalidateQueries({ queryKey: desktopQueryKeys.overview })
    await navigate({ to })
  }

  return (
    <div className='min-h-svh bg-muted/30'>
      <header className='border-b bg-background/95'>
        <div className='mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6'>
          <Logo className='size-8' />
          <div className='min-w-0 flex-1'>
            <p className='truncate font-semibold'>Weekly Git Report</p>
            <p className='truncate text-xs text-muted-foreground'>首次设置</p>
          </div>
          <ThemeSwitch />
        </div>
      </header>

      <main className='mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6'>
        <div className='max-w-2xl space-y-2'>
          <Badge variant='secondary'>本地初始化</Badge>
          <h1 className='text-3xl font-bold tracking-tight'>配置你的报告工作区</h1>
          <p className='text-muted-foreground'>
            按步骤检查环境、保存共享配置并添加仓库。配置和报告都保存在本机，CLI 可以直接复用。
          </p>
        </div>

        <div className='space-y-4'>
          <SetupStep
            index={0}
            title='检查运行环境'
            description='确认系统 Git 可以使用。'
            active={activeStep === 0}
            completed={completion[0]}
            available={availability[0]}
            onOpen={() => setActiveStep(0)}
          >
            {diagnostics.isLoading ? (
              <Loading label='正在检查 Git…' />
            ) : diagnostics.isError ? (
              <StepError title='环境检查失败' error={diagnostics.error} onRetry={() => void diagnostics.refetch()} />
            ) : (
              <div className='space-y-4'>
                <div className='flex items-start gap-3 rounded-lg border p-4'>
                  {gitReady
                    ? <CheckCircle2 className='mt-0.5 size-5 text-emerald-600' />
                    : <TriangleAlert className='mt-0.5 size-5 text-destructive' />}
                  <div className='min-w-0 flex-1'>
                    <p className='font-medium'>{gitReady ? 'Git 已就绪' : '未检测到可用的 Git'}</p>
                    <p className='mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]'>{gitCheck?.message}</p>
                    {!gitReady && (
                      <p className='mt-2 text-sm'>请先安装 Git，并确保终端可以执行 <code>git --version</code>。</p>
                    )}
                  </div>
                </div>
                <div className='flex flex-wrap justify-end gap-2'>
                  <Button type='button' variant='outline' onClick={() => void diagnostics.refetch()} disabled={diagnostics.isFetching}>
                    <RefreshCw className={diagnostics.isFetching ? 'animate-spin' : ''} />
                    重新检查
                  </Button>
                  <Button type='button' disabled={!gitReady} onClick={() => setActiveStep(configReady ? 2 : 1)}>
                    继续
                    <ArrowRight />
                  </Button>
                </div>
              </div>
            )}
          </SetupStep>

          <SetupStep
            index={1}
            title='保存基础配置'
            description='设置报告目录和需要采集的 Git 作者身份。'
            active={activeStep === 1}
            completed={completion[1]}
            available={availability[1]}
            onOpen={() => setActiveStep(1)}
          >
            {configState.data?.config ? (
              <ConfigForm
                key={configState.data.revision}
                initialConfig={configState.data.config}
                state={configState.data}
                isInitializing={false}
                compact
                onSaved={() => setActiveStep(2)}
              />
            ) : defaults.isLoading ? (
              <Loading label='正在读取推荐配置…' />
            ) : defaults.isError ? (
              <StepError title='无法读取推荐配置' error={defaults.error} onRetry={() => void defaults.refetch()} />
            ) : defaults.data ? (
              <ConfigForm
                key='setup-initialize'
                initialConfig={defaults.data.config}
                state={{ config: null, revision: null }}
                isInitializing
                compact
                onSaved={() => setActiveStep(2)}
              />
            ) : null}
            {configReady && (
              <div className='mt-4 flex justify-end'>
                <Button type='button' variant='outline' onClick={() => setActiveStep(2)}>
                  返回仓库设置
                  <ArrowRight />
                </Button>
              </div>
            )}
          </SetupStep>

          <SetupStep
            index={2}
            title='添加并同步仓库'
            description='添加远程仓库或从本地文件夹批量导入，也可以稍后处理。'
            active={activeStep === 2}
            completed={completion[2]}
            available={availability[2]}
            onOpen={() => setActiveStep(2)}
          >
            {projects.isLoading ? (
              <Loading label='正在读取仓库…' />
            ) : projects.isError ? (
              <StepError title='无法读取仓库配置' error={projects.error} onRetry={() => void projects.refetch()} />
            ) : (
              <div className='space-y-4'>
                <div className='grid gap-3 sm:grid-cols-2'>
                  <ActionCard
                    icon={<GitBranch />}
                    title='添加远程仓库'
                    description='读取远程分支，按当前身份完成首次同步。'
                    action='添加仓库'
                    onClick={() => setFormOpen(true)}
                    disabled={!projectState.revision}
                  />
                  <ActionCard
                    icon={<FolderSearch />}
                    title='从本地文件夹导入'
                    description='扫描已有 Git 工作区，批量确认并同步仓库。'
                    action={selectingImportFolder ? '正在选择…' : '选择文件夹'}
                    onClick={() => void openImport()}
                    disabled={!projectState.revision || selectingImportFolder}
                  />
                </div>

                {repositoriesReady && (
                  <Alert>
                    <CheckCircle2 />
                    <AlertTitle>仓库已经就绪</AlertTitle>
                    <AlertDescription>
                      已添加 {projectState.projects.length} 个仓库；成功添加的仓库已完成首次同步。
                    </AlertDescription>
                  </Alert>
                )}

                <div className='flex flex-wrap justify-end gap-2'>
                  <Button
                    type='button'
                    variant='ghost'
                    onClick={() => {
                      setRepositorySkipped(true)
                      setActiveStep(3)
                    }}
                  >
                    稍后添加
                  </Button>
                  <Button type='button' disabled={!repositoriesReady} onClick={() => setActiveStep(3)}>
                    继续
                    <ArrowRight />
                  </Button>
                </div>
              </div>
            )}
          </SetupStep>

          <SetupStep
            index={3}
            title='确认工作区就绪'
            description='检查配置、模板和仓库状态，然后进入工作台。'
            active={activeStep === 3}
            completed={completion[3]}
            available={availability[3]}
            onOpen={() => setActiveStep(3)}
          >
            {templatesLoading ? (
              <Loading label='正在确认三套生成模板…' />
            ) : templateError ? (
              <StepError
                title='模板检查失败'
                error={templateError}
                onRetry={() => void Promise.all(templateQueries.map((query) => query.refetch()))}
              />
            ) : (
              <div className='space-y-5'>
                <div className='grid gap-3 sm:grid-cols-2'>
                  <ReadyItem icon={<GitBranch />} label='Git 环境' value={gitCheck?.message ?? '已就绪'} />
                  <ReadyItem icon={<Settings2 />} label='报告目录' value={configState.data?.config?.outputRoot ?? '—'} />
                  <ReadyItem
                    icon={<FolderGit2 />}
                    label='仓库'
                    value={repositoriesReady ? `${projectState.projects.length} 个仓库已添加` : '已选择稍后添加'}
                  />
                  <ReadyItem icon={<FileCheck2 />} label='生成模板' value={templatesReady ? '日报、周报、月报均已就绪' : '正在确认'} />
                </div>
                <Separator />
                <div className='flex flex-wrap justify-end gap-2'>
                  {repositoriesReady && (
                    <Button type='button' variant='outline' onClick={() => void finish('/repositories')}>
                      查看仓库
                    </Button>
                  )}
                  <Button type='button' disabled={!templatesReady} onClick={() => void finish('/')}>
                    进入工作台
                    <ArrowRight />
                  </Button>
                </div>
              </div>
            )}
          </SetupStep>
        </div>
      </main>

      {formOpen && (
        <RepositoryForm
          key='setup-new-repository'
          open={formOpen}
          onOpenChange={setFormOpen}
          state={projectState}
          onSaved={applyProjectState}
        />
      )}
      {importSession && (
        <RepositoryImportSheet
          key={importSession.folder}
          open
          folder={importSession.folder}
          initialState={importSession.state}
          onImported={applyProjectState}
          onOpenChange={(open) => !open && setImportSession(undefined)}
        />
      )}
    </div>
  )
}

function SetupStep({
  index,
  title,
  description,
  active,
  completed,
  available,
  onOpen,
  children,
}: {
  index: StepIndex
  title: string
  description: string
  active: boolean
  completed: boolean
  available: boolean
  onOpen(): void
  children: ReactNode
}) {
  return (
    <Card className={active ? 'border-primary/50 shadow-sm' : ''}>
      <CardHeader>
        <button
          type='button'
          className='flex w-full items-start gap-3 text-start disabled:cursor-not-allowed disabled:opacity-60'
          disabled={!available}
          onClick={onOpen}
          aria-expanded={active}
          aria-label={`${active ? '当前步骤' : completed ? '重新编辑' : '打开'}：${title}`}
        >
          <span className={completed ? 'flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground' : active ? 'flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-primary text-sm font-semibold text-primary' : 'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm text-muted-foreground'}>
            {completed ? <Check className='size-4' /> : index + 1}
          </span>
          <span className='min-w-0 flex-1'>
            <CardTitle>{title}</CardTitle>
            <CardDescription className='mt-1.5'>{description}</CardDescription>
          </span>
          {completed ? <Badge variant='secondary'>已完成</Badge> : active ? <Badge>当前步骤</Badge> : <Circle className='mt-1 size-4 text-muted-foreground' />}
        </button>
      </CardHeader>
      {active && <CardContent>{children}</CardContent>}
    </Card>
  )
}

function ActionCard({
  icon,
  title,
  description,
  action,
  disabled,
  onClick,
}: {
  icon: ReactNode
  title: string
  description: string
  action: string
  disabled: boolean
  onClick(): void
}) {
  return (
    <div className='flex flex-col rounded-lg border p-4'>
      <span className='mb-3 flex size-9 items-center justify-center rounded-md bg-muted [&>svg]:size-5'>{icon}</span>
      <p className='font-medium'>{title}</p>
      <p className='mt-1 flex-1 text-sm text-muted-foreground'>{description}</p>
      <Button type='button' variant='outline' className='mt-4' disabled={disabled} onClick={onClick}>
        <Plus />
        {action}
      </Button>
    </div>
  )
}

function ReadyItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className='flex items-start gap-3 rounded-lg border p-4'>
      <span className='mt-0.5 text-emerald-600 [&>svg]:size-5'>{icon}</span>
      <div className='min-w-0'>
        <p className='font-medium'>{label}</p>
        <p className='mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]'>{value}</p>
      </div>
    </div>
  )
}

function Loading({ label }: { label: string }) {
  return <div className='flex items-center gap-2 py-6 text-sm text-muted-foreground'><Loader2 className='animate-spin' />{label}</div>
}

function StepError({ title, error, onRetry }: { title: string; error: unknown; onRetry(): void }) {
  return (
    <Alert variant='destructive'>
      <TriangleAlert />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p className='[overflow-wrap:anywhere]'>{getErrorMessage(error)}</p>
        <Button type='button' size='sm' variant='outline' className='mt-2' onClick={onRetry}>
          <RefreshCw />
          重试
        </Button>
      </AlertDescription>
    </Alert>
  )
}
