import { describe, expect, it } from 'vitest'
import { getErrorMessage } from './errors'

describe('getErrorMessage', () => {
  it('优先返回 Error 或字符串中的消息', () => {
    expect(getErrorMessage(new Error('仓库同步失败'))).toBe('仓库同步失败')
    expect(getErrorMessage(' 打开目录失败 ')).toBe('打开目录失败')
  })

  it('无可用消息时返回稳定的默认文案', () => {
    expect(getErrorMessage({ code: 'UNKNOWN' })).toBe('操作失败，请稍后重试。')
    expect(getErrorMessage('', '自定义失败文案')).toBe('自定义失败文案')
  })
})
