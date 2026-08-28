import { useCallback } from 'react'
import { useBlocker } from '@tanstack/react-router'

export function useUnsavedChanges(isDirty: boolean) {
  const shouldBlockFn = useCallback(() => {
    if (!isDirty) return false
    return !window.confirm('当前页面有未保存的修改，确定要放弃吗？')
  }, [isDirty])

  useBlocker({
    shouldBlockFn,
    enableBeforeUnload: () => isDirty,
    disabled: !isDirty,
  })
}
