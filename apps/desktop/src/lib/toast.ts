import { toast } from 'sonner'

const SUCCESS_TOAST_DURATION = 3000

export function showSuccessToast(message: string) {
  toast.success(message, { duration: SUCCESS_TOAST_DURATION })
}
