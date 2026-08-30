import { toast } from 'sonner'

const SUCCESS_TOAST_DURATION = 3000
const WARNING_TOAST_DURATION = 5000
const ERROR_TOAST_DURATION = 8000

export function showSuccessToast(message: string) {
  toast.success(message, { duration: SUCCESS_TOAST_DURATION })
}

export function showWarningToast(message: string) {
  toast.warning(message, { duration: WARNING_TOAST_DURATION })
}

export function showErrorToast(message: string) {
  toast.error(message, {
    closeButton: true,
    duration: ERROR_TOAST_DURATION,
  })
}
