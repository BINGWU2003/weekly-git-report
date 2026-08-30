import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import type { DesktopUpdateStatus } from '../../shared/ipc'
import { UpdateNotifier } from './update-notifier'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  toast: { info: vi.fn(), dismiss: vi.fn() },
  status: undefined as DesktopUpdateStatus | undefined,
}))

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }))
vi.mock('sonner', () => ({ toast: mocks.toast }))
vi.mock('@/lib/desktop-updates', () => ({
  useDesktopUpdateStatus: () => ({ data: mocks.status }),
}))

afterEach(() => vi.clearAllMocks())

describe('UpdateNotifier', () => {
  it('关闭版本提醒后在本次会话不再重复显示', async () => {
    mocks.status = {
      phase: 'available',
      currentVersion: '0.9.0',
      latestVersion: '1.0.0',
      releaseUrl: 'https://github.com/example/releases/latest',
    }

    const first = await render(<UpdateNotifier />)
    await vi.waitFor(() => expect(mocks.toast.info).toHaveBeenCalledOnce())
    const options = mocks.toast.info.mock.calls[0]?.[1] as { onDismiss(): void }
    options.onDismiss()
    first.unmount()

    await render(<UpdateNotifier />)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mocks.toast.info).toHaveBeenCalledOnce()
  })
})
