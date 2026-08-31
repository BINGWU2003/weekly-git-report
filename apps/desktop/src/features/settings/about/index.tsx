import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileClock,
  Loader2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'
import type { DesktopUpdateStatus } from '../../../../shared/ipc'
import { MarkdownViewer } from '@/components/markdown-viewer'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  desktopUpdateAvailableToastId,
  desktopUpdateQueryKey,
  useDesktopUpdateStatus,
} from '@/lib/desktop-updates'
import { getErrorMessage } from '@/lib/errors'
import { ContentSection } from '../components/content-section'

const CHECK_UPDATE_TOAST_ID = 'desktop-update-check'
const DOWNLOAD_UPDATE_TOAST_ID = 'desktop-update-download'
const INSTALL_UPDATE_TOAST_ID = 'desktop-update-install'

export function SettingsAbout() {
  return (
    <ContentSection
      title='关于与更新'
      desc='查看桌面应用版本、更新状态和版本说明。'
      contentClassName='lg:max-w-2xl'
    >
      <DesktopUpdatePanel />
    </ContentSection>
  )
}

export function DesktopUpdatePanel() {
  const queryClient = useQueryClient()
  const update = useDesktopUpdateStatus()
  const setStatus = (next: DesktopUpdateStatus) =>
    queryClient.setQueryData(desktopUpdateQueryKey, next)
  const check = useMutation({
    mutationFn: () => window.electronAPI.updates.check(),
    onMutate: () => {
      toast.loading('正在检查更新…', { id: CHECK_UPDATE_TOAST_ID })
    },
    onSuccess: (next) => {
      setStatus(next)
      if (next.phase === 'available') {
        toast.dismiss(CHECK_UPDATE_TOAST_ID)
        toast.info(`发现新版本 ${next.latestVersion}`, {
          id: desktopUpdateAvailableToastId,
          description: '更新说明已加载，可以确认下载。',
          duration: 5000,
          closeButton: true,
        })
        return
      }
      if (next.phase === 'up-to-date') {
        toast.success(`当前已是最新版本 v${next.latestVersion ?? next.currentVersion}`, {
          id: CHECK_UPDATE_TOAST_ID,
          duration: 3000,
        })
        return
      }
      toast.info('更新状态已刷新', { id: CHECK_UPDATE_TOAST_ID, duration: 3000 })
    },
    onError: (error) => showUpdateErrorToast(CHECK_UPDATE_TOAST_ID, '检查更新失败', error),
  })
  const download = useMutation({
    mutationFn: () => window.electronAPI.updates.download(),
    onMutate: () => {
      toast.loading('正在下载更新…', { id: DOWNLOAD_UPDATE_TOAST_ID })
    },
    onSuccess: (next) => {
      setStatus(next)
      toast.success('更新已下载，可以重启安装', {
        id: DOWNLOAD_UPDATE_TOAST_ID,
        duration: 5000,
      })
    },
    onError: (error) => showUpdateErrorToast(DOWNLOAD_UPDATE_TOAST_ID, '下载更新失败', error),
  })
  const install = useMutation({
    mutationFn: () => window.electronAPI.updates.install(),
    onMutate: () => {
      toast.loading('正在准备安装更新…', { id: INSTALL_UPDATE_TOAST_ID })
    },
    onSuccess: () => {
      toast.success('即将重启并安装更新…', { id: INSTALL_UPDATE_TOAST_ID, duration: 3000 })
    },
    onError: (error) => showUpdateErrorToast(INSTALL_UPDATE_TOAST_ID, '安装更新失败', error),
  })
  const busy = check.isPending || download.isPending || install.isPending

  if (update.isLoading || !update.data) {
    return (
      <div className='flex items-center gap-2 rounded-lg border p-6 text-sm text-muted-foreground'>
        <Loader2 className='animate-spin' />正在读取更新状态…
      </div>
    )
  }
  if (update.isError) {
    return (
      <Alert variant='destructive'>
        <AlertTitle>无法读取更新状态</AlertTitle>
        <AlertDescription>{getErrorMessage(update.error)}</AlertDescription>
      </Alert>
    )
  }

  const status = update.data
  return (
    <div className='space-y-5'>
      <Card>
        <CardHeader>
          <div className='flex items-start justify-between gap-3'>
            <div>
              <CardTitle>Weekly Git Report Desktop</CardTitle>
              <CardDescription>正式安装版通过 GitHub Releases 获取稳定更新。</CardDescription>
            </div>
            <StatusBadge status={status} />
          </div>
        </CardHeader>
        <CardContent className='space-y-5'>
          <dl className='grid gap-3 text-sm sm:grid-cols-2'>
            <VersionItem label='当前版本' value={status.currentVersion} />
            <VersionItem label='最新版本' value={status.latestVersion ?? '尚未检查'} />
          </dl>

          {status.phase === 'disabled' && (
            <Alert>
              <AlertTitle>当前环境不启用自动更新</AlertTitle>
              <AlertDescription>{status.disabledReason}</AlertDescription>
            </Alert>
          )}
          {status.phase === 'error' && status.error && (
            <Alert variant='destructive'>
              <AlertTitle>更新操作失败</AlertTitle>
              <AlertDescription>{status.error}</AlertDescription>
            </Alert>
          )}
          {status.installBlockedReason && (
            <Alert>
              <AlertTitle>暂时无法重启安装</AlertTitle>
              <AlertDescription>{status.installBlockedReason}</AlertDescription>
            </Alert>
          )}
          {status.phase === 'downloading' && (
            <DownloadProgress value={status.progress ?? 0} />
          )}

          <div className='flex flex-wrap justify-end gap-2'>
            <Button
              variant='ghost'
              onClick={() => void window.electronAPI.updates.openLogs()}
            >
              <FileClock />打开更新日志目录
            </Button>
            <Button
              variant='outline'
              onClick={() => void window.electronAPI.updates.openRelease()}
            >
              <ExternalLink />查看发布页面
            </Button>
            <UpdateAction
              status={status}
              busy={busy}
              checking={check.isPending}
              downloading={download.isPending}
              installing={install.isPending}
              onCheck={() => check.mutate()}
              onDownload={() => download.mutate()}
              onInstall={() => install.mutate()}
            />
          </div>
        </CardContent>
      </Card>

      {status.releaseNotes && (
        <Card>
          <CardHeader>
            <CardTitle>{status.releaseName || `版本 ${status.latestVersion} 更新说明`}</CardTitle>
            {status.releaseDate && (
              <CardDescription>发布于 {formatDate(status.releaseDate)}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <MarkdownViewer content={status.releaseNotes} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function UpdateAction({ status, busy, checking, downloading, installing, onCheck, onDownload, onInstall }: { status: DesktopUpdateStatus; busy: boolean; checking: boolean; downloading: boolean; installing: boolean; onCheck(): void; onDownload(): void; onInstall(): void }) {
  if (
    status.phase === 'available' ||
    (status.phase === 'error' && status.failedAction === 'download')
  ) {
    return <Button disabled={busy} onClick={onDownload}>{downloading ? <Loader2 className='animate-spin' /> : <Download />}下载更新</Button>
  }
  if (status.phase === 'downloading') {
    return <Button disabled><Loader2 className='animate-spin' />正在下载</Button>
  }
  if (status.phase === 'downloaded') {
    return <Button disabled={busy || Boolean(status.installBlockedReason)} onClick={onInstall}>{installing ? <Loader2 className='animate-spin' /> : <RotateCcw />}重启并安装</Button>
  }
  return <Button disabled={busy || status.phase === 'disabled'} onClick={onCheck}>{checking || status.phase === 'checking' ? <Loader2 className='animate-spin' /> : <RefreshCw />}{status.phase === 'error' ? '重试检查' : '检查更新'}</Button>
}

function StatusBadge({ status }: { status: DesktopUpdateStatus }) {
  const labels: Record<DesktopUpdateStatus['phase'], string> = {
    disabled: '当前环境已禁用',
    idle: '等待检查',
    checking: '正在检查',
    'up-to-date': '已是最新版本',
    available: '发现新版本',
    downloading: '正在下载',
    downloaded: '等待安装',
    error: '操作失败',
  }
  if (status.phase === 'error') return <Badge variant='destructive'>{labels[status.phase]}</Badge>
  if (status.phase === 'up-to-date') return <Badge variant='secondary'><CheckCircle2 />{labels[status.phase]}</Badge>
  return <Badge variant='outline'>{labels[status.phase]}</Badge>
}

function VersionItem({ label, value }: { label: string; value: string }) {
  return <div className='rounded-lg border p-4'><dt className='text-muted-foreground'>{label}</dt><dd className='mt-1 font-mono text-base font-medium'>{value}</dd></div>
}

function DownloadProgress({ value }: { value: number }) {
  const percentage = Math.round(value)
  return <div className='space-y-2' aria-label={`更新下载进度 ${percentage}%`}><div className='flex justify-between text-sm'><span>下载进度</span><span>{percentage}%</span></div><div className='h-2 overflow-hidden rounded-full bg-secondary'><div className='h-full rounded-full bg-primary transition-[width]' style={{ width: `${percentage}%` }} /></div></div>
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long' }).format(date)
}

function showUpdateErrorToast(id: string, title: string, error: unknown) {
  toast.error(`${title}：${getErrorMessage(error)}`, {
    id,
    closeButton: true,
    duration: 8000,
  })
}
