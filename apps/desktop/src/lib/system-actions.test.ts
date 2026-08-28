import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DesktopAPI } from '../../shared/ipc'
import { openOutputRoot, selectSystemDirectory, showReportInFolder } from './system-actions'

const toast = vi.hoisted(() => ({ error: vi.fn() }))

vi.mock('sonner', () => ({ toast }))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('system actions', () => {
  it('用户取消目录选择时保持静默', async () => {
    vi.stubGlobal('electronAPI', {
      system: { selectDirectory: vi.fn().mockResolvedValue(null) },
    } as unknown as DesktopAPI)

    await expect(selectSystemDirectory()).resolves.toBeNull()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('目录选择异常时显示错误并返回 null', async () => {
    vi.stubGlobal('electronAPI', {
      system: { selectDirectory: vi.fn().mockRejectedValue(new Error('无权访问')) },
    } as unknown as DesktopAPI)

    await expect(selectSystemDirectory()).resolves.toBeNull()
    expect(toast.error).toHaveBeenCalledWith('选择目录失败：无权访问')
  })

  it('识别 shell.openPath 返回的错误文本', async () => {
    vi.stubGlobal('electronAPI', {
      system: { openOutputRoot: vi.fn().mockResolvedValue('目录不存在') },
    } as unknown as DesktopAPI)

    await openOutputRoot()
    expect(toast.error).toHaveBeenCalledWith('打开报告目录失败：目录不存在')
  })

  it('定位报告的 IPC 失败时显示错误', async () => {
    vi.stubGlobal('electronAPI', {
      reports: { showInFolder: vi.fn().mockRejectedValue(new Error('文件已被删除')) },
    } as unknown as DesktopAPI)

    await showReportInFolder('report-id')
    expect(toast.error).toHaveBeenCalledWith('定位报告失败：文件已被删除')
  })
})
