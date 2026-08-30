import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { DesktopAPI, DesktopUpdateStatus } from '../../../../shared/ipc'
import { DesktopUpdatePanel } from './index'

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('DesktopUpdatePanel', () => {
  it('在开发模式说明禁用原因并显示当前版本', async () => {
    stubUpdater({
      phase: 'disabled',
      currentVersion: '0.0.0',
      releaseUrl: 'https://github.com/example/releases/latest',
      disabledReason: '开发模式和未安装版本不启用自动更新。',
    })
    const screen = await renderPanel()

    await expect.element(screen.getByText('0.0.0')).toBeVisible()
    await expect.element(screen.getByText('开发模式和未安装版本不启用自动更新。')).toBeVisible()
    await expect.element(screen.getByRole('button', { name: '检查更新' })).toBeDisabled()
  })

  it('发现版本后展示说明并由用户确认下载', async () => {
    const api = stubUpdater({
      phase: 'available',
      currentVersion: '0.9.0',
      latestVersion: '1.0.0',
      releaseUrl: 'https://github.com/example/releases/latest',
      releaseNotes: '## 新功能\n\n- 自动更新',
    })
    const screen = await renderPanel()

    await expect.element(screen.getByRole('heading', { name: '新功能' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: '下载更新' }))
    await vi.waitFor(() => expect(api.updates.download).toHaveBeenCalledOnce())
  })

  it('报告活跃时禁用立即安装', async () => {
    stubUpdater({
      phase: 'downloaded',
      currentVersion: '0.9.0',
      latestVersion: '1.0.0',
      releaseUrl: 'https://github.com/example/releases/latest',
      progress: 100,
      installBlockedReason: '报告正在生成、保存或推送，请等待运行结束后再安装更新。',
    })
    const screen = await renderPanel()

    await expect.element(screen.getByText('暂时无法重启安装')).toBeVisible()
    await expect.element(screen.getByRole('button', { name: '重启并安装' })).toBeDisabled()
  })

  it('下载失败后直接提供下载重试', async () => {
    const api = stubUpdater({
      phase: 'error',
      currentVersion: '0.9.0',
      latestVersion: '1.0.0',
      releaseUrl: 'https://github.com/example/releases/latest',
      error: '网络连接失败',
      failedAction: 'download',
    })
    const screen = await renderPanel()

    await userEvent.click(screen.getByRole('button', { name: '下载更新' }))
    await vi.waitFor(() => expect(api.updates.download).toHaveBeenCalledOnce())
  })
})

function stubUpdater(status: DesktopUpdateStatus) {
  const api = {
    updates: {
      status: vi.fn().mockResolvedValue(status),
      check: vi.fn().mockResolvedValue(status),
      download: vi.fn().mockResolvedValue({ ...status, phase: 'downloading', progress: 0 }),
      install: vi.fn().mockResolvedValue(undefined),
      openRelease: vi.fn().mockResolvedValue(undefined),
      openLogs: vi.fn().mockResolvedValue(''),
      onStatusChange: vi.fn().mockReturnValue(vi.fn()),
    },
  } as unknown as DesktopAPI
  vi.stubGlobal('electronAPI', api)
  return api
}

async function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <DesktopUpdatePanel />
    </QueryClientProvider>
  )
}
