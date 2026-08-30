const DEFAULT_ERROR_MESSAGE = '操作失败，请稍后重试。'

export function getErrorMessage(
  error: unknown,
  fallback = DEFAULT_ERROR_MESSAGE
): string {
  if (error instanceof Error) return error.message.trim() || fallback
  if (typeof error === 'string') return error.trim() || fallback
  return fallback
}
