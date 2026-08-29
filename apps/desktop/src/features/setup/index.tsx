import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  FolderSearch,
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { ConfigSchema } from '@weekly-git-report/shared'
import type { Config, Identity } from '@weekly-git-report/shared'
import { toast } from 'sonner'
import { Logo } from '@/assets/logo'
import { ThemeSwitch } from '@/components/theme-switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  configDefaultsQueryOptions,
  configStateQueryOptions,
  desktopQueryKeys,
  diagnosticsQueryOptions,
  onboardingQueryOptions,
  projectsStateQueryOptions,
} from '@/lib/desktop-queries'
import { getErrorMessage } from '@/lib/errors'
import { ONBOARDING_DEFER_SESSION_KEY } from '@/lib/onboarding'
import { selectSystemDirectory } from '@/lib/system-actions'
import { showSuccessToast } from '@/lib/toast'
import { ReportGenerationPanel } from '@/features/reports/report-generation-panel'
import { RepositoryForm } from '@/features/repositories/repository-form'
import { RepositoryImportSheet } from '@/features/repositories/repository-import-sheet'
import type { DesktopReadiness, ProjectsState } from '../../../shared/ipc'
import { AiConfigCard, FeishuConfigCard } from './automation-cards'

export function Setup() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const onboarding = useQuery(onboardingQueryOptions)
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
  const [selectedStep, setSelectedStep] = useState<number | null>(null)
  const [draftConfigOverride, setDraftConfigOverride] = useState<Config>()
  const [formOpen, setFormOpen] = useState(false)
  const [selectingImportFolder, setSelectingImportFolder] = useState(false)
  const [selectingDirectory, setSelectingDirectory] = useState<'output' | 'cache'>()
  const [importSession, setImportSession] = useState<{ folder: string; state: ProjectsState }>()

  const draftConfig = draftConfigOverride ?? configState.data?.config ?? defaults.data?.config

  const readiness = onboarding.data?.readiness
  const gitCheck = diagnostics.data?.find((check) => check.id === 'git')
  const projectState = projects.data ?? { projects: [], revision: null }
  const completion = [
    Boolean(readiness?.gitReady && readiness.configReady && readiness.workspaceReady),
    Boolean(readiness?.configReady),
    Boolean(readiness?.repositoryReady),
    Boolean(readiness?.aiReady),
    Boolean(readiness?.firstReportReady),
    Boolean(onboarding.data?.completedAt),
  ]
  const firstIncomplete = completion.findIndex((value) => !value)
  const activeStep = selectedStep ?? (firstIncomplete === -1 ? 5 : firstIncomplete)
  const availability = [
    true,
    Boolean(readiness?.gitReady),
    Boolean(readiness?.gitReady && readiness.configReady && readiness.workspaceReady),
    Boolean(
      readiness?.gitReady &&
      readiness.configReady &&
      readiness.workspaceReady &&
      readiness.repositoryReady,
    ),
    Boolean(
      readiness?.gitReady &&
      readiness.configReady &&
      readiness.workspaceReady &&
      readiness.repositoryReady &&
      readiness.aiReady &&
      readiness.templatesReady,
    ),
    Boolean(readiness?.firstReportReady && onboarding.data?.completedAt),
  ]

  const initialize = useMutation({
    mutationFn: async () => {
      if (!draftConfig) throw new Error('推荐配置尚未读取。')
      return window.electronAPI.config.initialize(ConfigSchema.parse(draftConfig))
    },
    onSuccess: async (next) => {
      queryClient.setQueryData(desktopQueryKeys.configState, next)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: desktopQueryKeys.onboarding }),
        queryClient.invalidateQueries({ queryKey: desktopQueryKeys.projectsState }),
        queryClient.invalidateQueries({ queryKey: desktopQueryKeys.overview }),
      ])
      showSuccessToast('本地工作区已创建')
      setSelectedStep(2)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const complete = useMutation({
    mutationFn: (runId: string) => window.electronAPI.onboarding.complete(runId),
    onSuccess: async (next) => {
      queryClient.setQueryData(desktopQueryKeys.onboarding, next)
      await queryClient.invalidateQueries({ queryKey: desktopQueryKeys.overview })
      setSelectedStep(5)
      showSuccessToast('首次设置已完成')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const publishFirstReport = useMutation({
    mutationFn: (runId: string) => window.electronAPI.runs.publish(runId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: desktopQueryKeys.onboarding })
      showSuccessToast('第一份报告已推送到飞书')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const setupComplete = Boolean(onboarding.data?.completedAt)
  if (setupComplete && selectedStep === null) {
    return (
      <SetupShell subtitle='初始化检查清单'>
        <CompletedChecklist readiness={readiness!} onEnter={() => void navigate({ to: '/' })} />
      </SetupShell>
    )
  }

  function updateDraft(patch: Partial<Config>) {
    if (draftConfig) setDraftConfigOverride({ ...draftConfig, ...patch })
  }

  async function chooseDirectory(field: 'outputRoot' | 'repositoryCacheRoot') {
    if (!draftConfig) return
    setSelectingDirectory(field === 'outputRoot' ? 'output' : 'cache')
    try {
      const selected = await selectSystemDirectory(draftConfig[field])
      if (selected) updateDraft({ [field]: selected })
    } finally {
      setSelectingDirectory(undefined)
    }
  }

  function applyProjectState(next: ProjectsState) {
    queryClient.setQueryData(desktopQueryKeys.projectsState, next)
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: desktopQueryKeys.onboarding }),
      queryClient.invalidateQueries({ queryKey: desktopQueryKeys.overview }),
      queryClient.invalidateQueries({ queryKey: desktopQueryKeys.projectsRuntime }),
    ])
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

  async function rememberRun(runId: string | null) {
    const next = await window.electronAPI.onboarding.rememberRun(runId)
    queryClient.setQueryData(desktopQueryKeys.onboarding, next)
  }

  function enterWorkbenchTemporarily() {
    sessionStorage.setItem(ONBOARDING_DEFER_SESSION_KEY, '1')
    void navigate({ to: '/' })
  }

  return (
    <SetupShell subtitle='首次设置'>
      <div className='max-w-2xl space-y-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <Badge variant='secondary'>本地初始化</Badge>
          {configState.data?.config && !setupComplete ? (
            <Button type='button' size='sm' variant='ghost' onClick={enterWorkbenchTemporarily}>
              暂时进入工作台
            </Button>
          ) : null}
        </div>
        <h1 className='text-3xl font-bold tracking-tight'>生成并保存你的第一份报告</h1>
        <p className='text-muted-foreground'>
          所有必要设置都在这个页面完成；每一步都会读取真实状态，中断后再次打开可以继续。
        </p>
      </div>

      {onboarding.isError ? (
        <StepError
          title='无法读取初始化状态'
          error={onboarding.error}
          onRetry={() => void onboarding.refetch()}
        />
      ) : null}

      <div className='space-y-4'>
        <SetupStep
          index={0}
          title='环境与目录'
          description='确认 Git 可用，并选择报告与仓库缓存目录。'
          active={activeStep === 0}
          completed={completion[0]}
          available={availability[0]}
          onOpen={() => setSelectedStep(0)}
        >
          {!draftConfig || diagnostics.isLoading ? (
            <Loading label='正在读取环境与推荐目录…' />
          ) : (
            <div className='space-y-5'>
              <div className='flex items-start gap-3 rounded-lg border p-4'>
                {readiness?.gitReady ? (
                  <CheckCircle2 className='mt-0.5 size-5 text-emerald-600' />
                ) : (
                  <TriangleAlert className='mt-0.5 size-5 text-destructive' />
                )}
                <div className='min-w-0 flex-1'>
                  <p className='font-medium'>
                    {readiness?.gitReady ? 'Git 已就绪' : '未检测到可用的 Git'}
                  </p>
                  <p className='mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]'>
                    {gitCheck?.message}
                  </p>
                </div>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => void diagnostics.refetch()}
                >
                  <RefreshCw className={diagnostics.isFetching ? 'animate-spin' : ''} />
                  重新检查
                </Button>
              </div>
              <DirectoryField
                label='报告输出目录'
                value={draftConfig.outputRoot}
                selecting={selectingDirectory === 'output'}
                onChange={(value) => updateDraft({ outputRoot: value })}
                onSelect={() => void chooseDirectory('outputRoot')}
              />
              <DirectoryField
                label='仓库缓存目录'
                value={draftConfig.repositoryCacheRoot}
                selecting={selectingDirectory === 'cache'}
                onChange={(value) => updateDraft({ repositoryCacheRoot: value })}
                onSelect={() => void chooseDirectory('repositoryCacheRoot')}
                description='这里只保存用于读取 Git 日志的 Bare 仓库；初始化后桌面端不再允许修改。'
              />
              <div className='flex justify-end'>
                <Button
                  type='button'
                  disabled={!readiness?.gitReady}
                  onClick={() => setSelectedStep(1)}
                >
                  继续设置作者身份
                  <ArrowRight />
                </Button>
              </div>
            </div>
          )}
        </SetupStep>

        <SetupStep
          index={1}
          title='Git 作者身份'
          description='只采集与你身份匹配的提交，保存后创建共享工作区和四套报告模板。'
          active={activeStep === 1}
          completed={completion[1]}
          available={availability[1]}
          onOpen={() => setSelectedStep(1)}
        >
          {!draftConfig ? (
            <Loading label='正在读取作者身份…' />
          ) : configState.data?.config ? (
            <div className='space-y-4'>
              <ReadyItem
                icon={<CheckCircle2 />}
                label='共享配置已创建'
                value={`${draftConfig.identities.length} 个作者身份`}
              />
              <div className='flex justify-end'>
                <Button onClick={() => setSelectedStep(2)}>
                  继续添加仓库
                  <ArrowRight />
                </Button>
              </div>
            </div>
          ) : (
            <div className='space-y-4'>
              <IdentityEditor
                identities={draftConfig.identities}
                onChange={(identities) => updateDraft({ identities })}
              />
              <Alert>
                <AlertTitle>本地凭据说明</AlertTitle>
                <AlertDescription>
                  后续 AI 与飞书密钥会保存在当前用户可访问、受文件 ACL 保护的本地 JSON
                  中，不会写入日志或界面回显。
                </AlertDescription>
              </Alert>
              <div className='flex justify-end'>
                <Button
                  onClick={() => initialize.mutate()}
                  disabled={initialize.isPending || draftConfig.identities.length === 0}
                >
                  {initialize.isPending ? <Loader2 className='animate-spin' /> : <Settings2 />}
                  保存并创建工作区
                </Button>
              </div>
            </div>
          )}
        </SetupStep>

        <SetupStep
          index={2}
          title='添加并同步仓库'
          description='至少添加并启用一个仓库，首次添加会立即同步。'
          active={activeStep === 2}
          completed={completion[2]}
          available={availability[2]}
          onOpen={() => setSelectedStep(2)}
        >
          {projects.isLoading ? (
            <Loading label='正在读取仓库…' />
          ) : (
            <div className='space-y-4'>
              <div className='grid gap-3 sm:grid-cols-2'>
                <ActionCard
                  icon={<GitBranch />}
                  title='添加远程仓库'
                  description='确认远程分支和采集身份后完成首次同步。'
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
              {readiness?.repositoryReady ? (
                <Alert>
                  <CheckCircle2 />
                  <AlertTitle>仓库已就绪</AlertTitle>
                  <AlertDescription>
                    已有 {readiness.enabledRepositoryCount} 个启用仓库。
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <TriangleAlert />
                  <AlertTitle>需要至少一个启用仓库</AlertTitle>
                  <AlertDescription>首份报告会使用全部启用仓库。</AlertDescription>
                </Alert>
              )}
              <div className='flex justify-end'>
                <Button disabled={!readiness?.repositoryReady} onClick={() => setSelectedStep(3)}>
                  继续配置 AI
                  <ArrowRight />
                </Button>
              </div>
            </div>
          )}
        </SetupStep>

        <SetupStep
          index={3}
          title='配置并测试 AI'
          description='保存密钥后立即进行一次真实连接测试。'
          active={activeStep === 3}
          completed={completion[3]}
          available={availability[3]}
          onOpen={() => setSelectedStep(3)}
        >
          <div className='space-y-4'>
            <AiConfigCard setup onTested={() => setSelectedStep(4)} />
            {readiness?.aiReady ? (
              <div className='flex justify-end'>
                <Button onClick={() => setSelectedStep(4)}>
                  继续生成报告
                  <ArrowRight />
                </Button>
              </div>
            ) : null}
          </div>
        </SetupStep>

        <SetupStep
          index={4}
          title='生成、审核并保存第一份报告'
          description='默认生成上一完整周的周报；草稿经过你确认后才写入 Summary。'
          active={activeStep === 4}
          completed={completion[4]}
          available={availability[4]}
          onOpen={() => setSelectedStep(4)}
        >
          <ReportGenerationPanel
            onboarding
            initialRunId={onboarding.data?.firstRunId}
            onRunChange={(runId) => void rememberRun(runId)}
            onSaved={(run) => complete.mutate(run.id)}
          />
          {complete.isPending ? <Loading label='正在确认初始化完成状态…' /> : null}
        </SetupStep>

        <SetupStep
          index={5}
          title='完成与扩展'
          description='飞书推送和自动任务均为可选项，不影响初始化完成。'
          active={activeStep === 5}
          completed={completion[5]}
          available={availability[5]}
          onOpen={() => setSelectedStep(5)}
        >
          <div className='space-y-5'>
            <Alert>
              <CheckCircle2 />
              <AlertTitle>工作台已就绪</AlertTitle>
              <AlertDescription>
                第一份报告已经保存。你可以直接进入工作台，也可以继续配置飞书。
              </AlertDescription>
            </Alert>
            <FeishuConfigCard setup />
            {readiness?.feishuReady && onboarding.data?.firstRunId ? (
              <div className='flex justify-end'>
                <Button
                  variant='outline'
                  onClick={() => publishFirstReport.mutate(onboarding.data!.firstRunId!)}
                  disabled={publishFirstReport.isPending}
                >
                  {publishFirstReport.isPending ? <Loader2 className='animate-spin' /> : <Send />}
                  推送第一份报告
                </Button>
              </div>
            ) : null}
            <Separator />
            <div className='flex flex-wrap justify-end gap-2'>
              <Button asChild variant='outline'>
                <Link to='/tasks'>稍后创建自动任务</Link>
              </Button>
              <Button onClick={() => void navigate({ to: '/' })}>
                进入工作台
                <ArrowRight />
              </Button>
            </div>
          </div>
        </SetupStep>
      </div>

      {formOpen ? (
        <RepositoryForm
          key='setup-new-repository'
          open={formOpen}
          onOpenChange={setFormOpen}
          state={projectState}
          onSaved={applyProjectState}
        />
      ) : null}
      {importSession ? (
        <RepositoryImportSheet
          key={importSession.folder}
          open
          folder={importSession.folder}
          initialState={importSession.state}
          onImported={applyProjectState}
          onOpenChange={(open) => !open && setImportSession(undefined)}
        />
      ) : null}
    </SetupShell>
  )
}

function SetupShell({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <div className='min-h-svh bg-muted/30'>
      <header className='border-b bg-background/95'>
        <div className='mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6'>
          <Logo className='size-8' />
          <div className='min-w-0 flex-1'>
            <p className='truncate font-semibold'>Weekly Git Report</p>
            <p className='truncate text-xs text-muted-foreground'>{subtitle}</p>
          </div>
          <ThemeSwitch />
        </div>
      </header>
      <main className='mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6'>{children}</main>
    </div>
  )
}

function CompletedChecklist({
  readiness,
  onEnter,
}: {
  readiness: DesktopReadiness
  onEnter(): void
}) {
  const items = [
    ['环境与目录', readiness.gitReady && readiness.configReady && readiness.workspaceReady],
    ['Git 作者身份', readiness.configReady],
    ['启用仓库', readiness.repositoryReady],
    ['AI 连接', readiness.aiReady],
    ['四套报告模板', readiness.templatesReady],
    ['首份报告', readiness.firstReportReady],
    ['飞书推送（可选）', readiness.feishuReady],
  ] as const
  return (
    <div className='space-y-6'>
      <div>
        <Badge variant='secondary'>设置已完成</Badge>
        <h1 className='mt-2 text-3xl font-bold tracking-tight'>初始化检查清单</h1>
        <p className='mt-2 text-muted-foreground'>
          这里保留首次设置结果的只读状态；需要修改时前往对应功能页。
        </p>
      </div>
      <Card>
        <CardContent className='grid gap-3 pt-6 sm:grid-cols-2'>
          {items.map(([label, ready]) => (
            <div key={label} className='flex items-center gap-3 rounded-lg border p-3'>
              {ready ? (
                <CheckCircle2 className='text-emerald-600' />
              ) : (
                <TriangleAlert className='text-amber-600' />
              )}
              <span>{label}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className='flex flex-wrap justify-end gap-2'>
        <Button asChild variant='outline'>
          <Link to='/settings'>修改设置</Link>
        </Button>
        <Button onClick={onEnter}>
          进入工作台
          <ArrowRight />
        </Button>
      </div>
    </div>
  )
}

function DirectoryField({
  label,
  value,
  description,
  selecting,
  onChange,
  onSelect,
}: {
  label: string
  value: string
  description?: string
  selecting: boolean
  onChange(value: string): void
  onSelect(): void
}) {
  return (
    <div className='space-y-2'>
      <Label>{label}</Label>
      <div className='flex gap-2'>
        <Input value={value} onChange={(event) => onChange(event.target.value)} />
        <Button type='button' variant='outline' onClick={onSelect} disabled={selecting}>
          {selecting ? <Loader2 className='animate-spin' /> : <FolderSearch />}选择
        </Button>
      </div>
      <p className='text-sm text-muted-foreground'>
        {description ?? '支持绝对路径或以 ~/ 开头的用户目录路径。'}
      </p>
    </div>
  )
}

function IdentityEditor({
  identities,
  onChange,
}: {
  identities: Identity[]
  onChange(identities: Identity[]): void
}) {
  return (
    <div className='space-y-3'>
      {identities.map((identity, index) => (
        <div key={index} className='grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]'>
          <div className='space-y-2'>
            <Label>姓名</Label>
            <Input
              value={identity.name}
              onChange={(event) =>
                onChange(
                  identities.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, name: event.target.value } : item,
                  ),
                )
              }
            />
          </div>
          <div className='space-y-2'>
            <Label>邮箱</Label>
            <Input
              type='email'
              value={identity.email}
              onChange={(event) =>
                onChange(
                  identities.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, email: event.target.value } : item,
                  ),
                )
              }
            />
          </div>
          <Button
            type='button'
            size='icon'
            variant='ghost'
            className='self-end'
            disabled={identities.length === 1}
            onClick={() => onChange(identities.filter((_, itemIndex) => itemIndex !== index))}
            aria-label='删除身份'
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type='button'
        variant='outline'
        onClick={() => onChange([...identities, { name: '', email: '' }])}
      >
        <Plus />
        添加身份
      </Button>
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
  index: number
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
        >
          <span
            className={
              completed
                ? 'flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground'
                : active
                  ? 'flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-primary text-sm font-semibold text-primary'
                  : 'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm text-muted-foreground'
            }
          >
            {completed ? <Check className='size-4' /> : index + 1}
          </span>
          <span className='min-w-0 flex-1'>
            <CardTitle>{title}</CardTitle>
            <CardDescription className='mt-1.5'>{description}</CardDescription>
          </span>
          {completed ? (
            <Badge variant='secondary'>已完成</Badge>
          ) : active ? (
            <Badge>当前步骤</Badge>
          ) : (
            <Circle className='mt-1 size-4 text-muted-foreground' />
          )}
        </button>
      </CardHeader>
      {active ? <CardContent>{children}</CardContent> : null}
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
      <span className='mb-3 flex size-9 items-center justify-center rounded-md bg-muted [&>svg]:size-5'>
        {icon}
      </span>
      <p className='font-medium'>{title}</p>
      <p className='mt-1 flex-1 text-sm text-muted-foreground'>{description}</p>
      <Button
        type='button'
        variant='outline'
        className='mt-4'
        disabled={disabled}
        onClick={onClick}
      >
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
  return (
    <div className='flex items-center gap-2 py-6 text-sm text-muted-foreground'>
      <Loader2 className='animate-spin' />
      {label}
    </div>
  )
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
