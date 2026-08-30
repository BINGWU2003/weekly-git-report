import { afterEach, describe, expect, it, vi } from 'vitest'
import { showErrorToast, showSuccessToast, showWarningToast } from './toast'

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }))

vi.mock('sonner', () => ({ toast }))

afterEach(() => {
  vi.clearAllMocks()
})

describe('toast helpers', () => {
  it('成功提示显示 3 秒', () => {
    showSuccessToast('已保存')

    expect(toast.success).toHaveBeenCalledWith('已保存', { duration: 3000 })
  })

  it('警告提示显示 5 秒', () => {
    showWarningToast('请检查配置')

    expect(toast.warning).toHaveBeenCalledWith('请检查配置', { duration: 5000 })
  })

  it('错误提示显示 8 秒并允许手动关闭', () => {
    showErrorToast('无法保存')

    expect(toast.error).toHaveBeenCalledWith('无法保存', {
      closeButton: true,
      duration: 8000,
    })
  })
})
