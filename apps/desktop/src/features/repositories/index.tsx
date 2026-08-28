import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Edit3, FolderSearch, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { RepositoryProject, RepositoryRuntimeState } from '@weekly-git-report/shared'
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
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ProjectsState, RepositorySyncResult } from '../../../shared/ipc'
import { RepositoryForm } from './repository-form'
import { RepositoryImportSheet } from './repository-import-sheet'

export function Repositories() {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RepositoryProject>()
  const [deleting, setDeleting] = useState<RepositoryProject>()
  const [lastSync, setLastSync] = useState<RepositorySyncResult>()
  const [importSession, setImportSession] = useState<{ folder: string; state: ProjectsState }>()
  const projects = useQuery({
    queryKey: ['projects-state'],
    queryFn: () => window.electronAPI.projects.state(),
  })

  function applyState(next: ProjectsState) {
    queryClient.setQueryData(['projects-state'], next)
    void queryClient.invalidateQueries({ queryKey: ['projects'] })
    void queryClient.invalidateQueries({ queryKey: ['overview'] })
    void queryClient.invalidateQueries({ queryKey: ['projects-runtime'] })
  }

  async function handleConflict(error: unknown) {
    if (error instanceof Error && error.message.includes('changed since')) {
      toast.error('仓库配置已被 CLI 或其他窗口修改，已重新加载。')
      await queryClient.invalidateQueries({ queryKey: ['projects-state'] })
      return
    }
    toast.error(getErrorMessage(error))
  }

  const toggle = useMutation({
    mutationFn: ({ project, enabled }: { project: RepositoryProject; enabled: boolean }) => {
      if (!projects.data?.revision) throw new Error('仓库配置版本缺失。')
      return window.electronAPI.projects.setEnabled(project.id, enabled, projects.data.revision)
    },
    onSuccess: applyState,
    onError: handleConflict,
  })

  const sync = useMutation({
    mutationFn: (ids?: string[]) => window.electronAPI.projects.sync(ids),
    onSuccess: (result) => {
      setLastSync(result)
      void queryClient.invalidateQueries({ queryKey: ['projects-runtime'] })
      if (result.errors.length) {
        toast.warning(`同步完成，${result.errors.length} 个仓库失败`)
      } else {
        toast.success(`已同步 ${result.synced.length} 个仓库`)
      }
    },
  })

  function openAdd() {
    setEditing(undefined)
    setFormOpen(true)
  }

  function openEdit(project: RepositoryProject) {
    setEditing(project)
    setFormOpen(true)
  }

  async function openImport() {
    const folder = await window.electronAPI.system.selectDirectory()
    if (folder) setImportSession({ folder, state })
  }

  const state = projects.data ?? { projects: [], revision: null }
  const runtime = useQuery({
    queryKey: ['projects-runtime'],
    queryFn: () => window.electronAPI.projects.runtimeState(),
    enabled: Boolean(state.revision),
  })
  const runtimeById = useMemo(
    () => new Map(runtime.data?.map((item) => [item.projectId, item]) ?? []),
    [runtime.data]
  )
  const staleProjectIds = useMemo(
    () => new Set(lastSync?.errors.flatMap((error) => error.projectId ?? []) ?? []),
    [lastSync]
  )

  return (
    <>
      <Header>
        <div className='me-auto'>
          <p className='text-sm font-medium'>共享仓库配置</p>
          <p className='text-xs text-muted-foreground'>来源：~/.weekly-git-report/projects.json</p>
        </div>
        <ThemeSwitch />
      </Header>
      <Main className='space-y-6'>
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>仓库</h1>
            <p className='text-muted-foreground'>管理 CLI 与桌面端共同使用的 Git 仓库。</p>
          </div>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              onClick={() => sync.mutate(undefined)}
              disabled={sync.isPending || !state.projects.some((project) => project.enabled)}
            >
              <RefreshCw className={sync.isPending ? 'animate-spin' : ''} />
              同步全部
            </Button>
            <Button variant='outline' onClick={() => void openImport()} disabled={!state.revision}>
              <FolderSearch />
              从文件夹导入
            </Button>
            <Button onClick={openAdd} disabled={!state.revision}>
              <Plus />
              添加仓库
            </Button>
          </div>
        </div>

        {!state.revision && !projects.isLoading && (
          <Alert>
            <AlertCircle />
            <AlertTitle>请先完成全局配置</AlertTitle>
            <AlertDescription>在“设置 → 常规”完成初始化后即可添加仓库。</AlertDescription>
          </Alert>
        )}

        {projects.isError && (
          <Alert variant='destructive'>
            <AlertCircle />
            <AlertTitle>无法读取仓库配置</AlertTitle>
            <AlertDescription>{getErrorMessage(projects.error)}</AlertDescription>
          </Alert>
        )}

        {lastSync?.errors.length ? (
          <Alert variant='destructive'>
            <AlertCircle />
            <AlertTitle>部分仓库同步失败</AlertTitle>
            <AlertDescription>
              <ul className='list-disc space-y-1 ps-5'>
                {lastSync.errors.map((error, index) => (
                  <li key={`${error.projectId ?? error.name}-${index}`}>
                    {error.name ?? error.projectId ?? '未知仓库'}：{error.message}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>仓库</TableHead>
                  <TableHead>分支</TableHead>
                  <TableHead>作者</TableHead>
                  <TableHead>缓存目录</TableHead>
                  <TableHead>最新提交</TableHead>
                  <TableHead className='text-center'>启用</TableHead>
                  <TableHead className='text-end'>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.projects.map((project) => {
                  const syncing = sync.isPending && sync.variables?.includes(project.id)
                  const toggling = toggle.isPending && toggle.variables?.project.id === project.id
                  return (
                    <TableRow key={project.id}>
                      <TableCell className='max-w-xs'>
                        <p className='font-medium'>{project.name}</p>
                        <p className='truncate text-xs text-muted-foreground' title={project.url}>{project.url}</p>
                      </TableCell>
                      <TableCell><Badge variant='outline'>{project.branch}</Badge></TableCell>
                      <TableCell>
                        {project.authors?.length
                          ? project.authors.map((author) => author.email).join(', ')
                          : '继承全局身份'}
                      </TableCell>
                      <TableCell className='max-w-xs truncate text-xs text-muted-foreground' title={project.localPath}>
                        {project.localPath}
                      </TableCell>
                      <TableCell className='max-w-72'>
                        <LatestCommitCell
                          loading={runtime.isLoading}
                          runtime={runtimeById.get(project.id)}
                          stale={staleProjectIds.has(project.id)}
                        />
                      </TableCell>
                      <TableCell className='text-center'>
                        {toggling ? (
                          <Loader2 className='mx-auto size-4 animate-spin' />
                        ) : (
                          <Switch
                            checked={project.enabled}
                            onCheckedChange={(enabled) => toggle.mutate({ project, enabled })}
                            aria-label={`${project.name} 启用状态`}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className='flex justify-end gap-1'>
                          <Button
                            size='icon'
                            variant='ghost'
                            disabled={sync.isPending}
                            onClick={() => sync.mutate([project.id])}
                            aria-label={`同步 ${project.name}`}
                          >
                            <RefreshCw className={syncing ? 'animate-spin' : ''} />
                          </Button>
                          <Button size='icon' variant='ghost' onClick={() => openEdit(project)} aria-label={`编辑 ${project.name}`}>
                            <Edit3 />
                          </Button>
                          <Button size='icon' variant='ghost' onClick={() => setDeleting(project)} aria-label={`删除 ${project.name}`}>
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!projects.isLoading && state.projects.length === 0 && state.revision && (
                  <TableRow>
                    <TableCell colSpan={7} className='h-32 text-center text-muted-foreground'>
                      还没有仓库，点击“添加仓库”开始配置。
                    </TableCell>
                  </TableRow>
                )}
                {projects.isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className='h-32 text-center text-muted-foreground'>
                      <Loader2 className='mx-auto mb-2 animate-spin' />
                      正在读取仓库…
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Main>

      {formOpen && (
        <RepositoryForm
          key={editing?.id ?? 'new'}
          open={formOpen}
          onOpenChange={setFormOpen}
          project={editing}
          state={state}
        />
      )}
      {importSession ? (
        <RepositoryImportSheet
          key={importSession.folder}
          open
          folder={importSession.folder}
          initialState={importSession.state}
          onImported={applyState}
          onOpenChange={(open) => !open && setImportSession(undefined)}
        />
      ) : null}
      <DeleteRepositoryDialog
        project={deleting}
        state={state}
        onClose={() => setDeleting(undefined)}
        onDeleted={applyState}
      />
    </>
  )
}

function LatestCommitCell({
  loading,
  runtime,
  stale,
}: {
  loading: boolean
  runtime?: RepositoryRuntimeState
  stale: boolean
}) {
  if (loading && !runtime) return <Loader2 className='size-4 animate-spin text-muted-foreground' />
  if (!runtime) return <span className='text-xs text-muted-foreground'>暂无状态</span>
  if (!runtime.latestCommit) {
    const label =
      runtime.status === 'not-synced'
        ? '尚未同步'
        : runtime.status === 'missing-branch'
          ? '分支尚无缓存'
          : '缓存读取失败'
    return <span className='text-xs text-muted-foreground' title={runtime.message}>{label}</span>
  }

  const commit = runtime.latestCommit
  const timestamp = formatCommitTime(commit.committedAt)
  const title = `${commit.hash}\n${commit.authorName} <${commit.authorEmail}>\n${timestamp}`
  return (
    <div title={title}>
      <p className='truncate text-sm font-medium'>{commit.subject}</p>
      <p className='mt-1 flex items-center gap-1.5 text-xs text-muted-foreground'>
        <code>{commit.hash.slice(0, 7)}</code>
        <span>·</span>
        <span>{timestamp}</span>
        {stale ? <Badge variant='destructive'>可能过期</Badge> : null}
      </p>
    </div>
  )
}

function formatCommitTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function DeleteRepositoryDialog({
  project,
  state,
  onClose,
  onDeleted,
}: {
  project?: RepositoryProject
  state: ProjectsState
  onClose(): void
  onDeleted(next: ProjectsState): void
}) {
  const queryClient = useQueryClient()
  const [deleteCache, setDeleteCache] = useState(false)
  const [confirmCache, setConfirmCache] = useState(false)
  const mutation = useMutation({
    mutationFn: () => {
      if (!project || !state.revision) throw new Error('仓库配置版本缺失。')
      return window.electronAPI.projects.remove(project.id, deleteCache, state.revision)
    },
    onSuccess: (next) => {
      onDeleted(next)
      toast.success(deleteCache ? '仓库配置和缓存已删除' : '仓库配置已删除，缓存已保留')
      close()
    },
    onError: async (error) => {
      if (error instanceof Error && error.message.includes('changed since')) {
        toast.error('仓库配置已被 CLI 或其他窗口修改，已重新加载。')
        await queryClient.invalidateQueries({ queryKey: ['projects-state'] })
        close()
        return
      }
      toast.error(getErrorMessage(error))
    },
  })

  function close() {
    setDeleteCache(false)
    setConfirmCache(false)
    onClose()
  }

  function submit(event: React.MouseEvent) {
    event.preventDefault()
    if (deleteCache && !confirmCache) {
      setConfirmCache(true)
      return
    }
    mutation.mutate()
  }

  return (
    <AlertDialog open={Boolean(project)} onOpenChange={(open) => !open && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmCache ? '再次确认删除缓存' : `移除 ${project?.name ?? '仓库'}`}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className='space-y-4'>
              {confirmCache ? (
                <>
                  <p>将永久删除以下 Bare Git 缓存目录，此操作无法撤销：</p>
                  <code className='block break-all rounded-md bg-muted p-3 text-foreground'>{project?.localPath}</code>
                </>
              ) : (
                <>
                  <p>默认只从 projects.json 移除配置，本地缓存会保留。</p>
                  <label className='flex items-start gap-3 rounded-md border p-3 text-foreground'>
                    <Checkbox checked={deleteCache} onCheckedChange={(value) => setDeleteCache(value === true)} />
                    <span>
                      <span className='block text-sm font-medium'>同时删除 Bare Git 缓存</span>
                      <span className='block break-all text-xs text-muted-foreground'>{project?.localPath}</span>
                    </span>
                  </label>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>取消</AlertDialogCancel>
          <AlertDialogAction onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className='animate-spin' />}
            {deleteCache ? (confirmCache ? '确认永久删除' : '下一步') : '移除配置'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
