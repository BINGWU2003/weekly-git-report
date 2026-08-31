import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  desktopUpdateAvailableToastId,
  useDesktopUpdateStatus,
} from '@/lib/desktop-updates'

let dismissedVersion: string | undefined

export function UpdateNotifier() {
  const navigate = useNavigate()
  const update = useDesktopUpdateStatus()

  useEffect(() => {
    const status = update.data
    if (
      !status ||
      status.phase !== 'available' ||
      !status.latestVersion ||
      dismissedVersion === status.latestVersion ||
      window.location.hash.includes('/setup')
    ) {
      if (status?.phase !== 'available') toast.dismiss(desktopUpdateAvailableToastId)
      return
    }

    toast.info(`发现新版本 ${status.latestVersion}`, {
      id: desktopUpdateAvailableToastId,
      description: '可前往“关于与更新”查看版本说明并确认下载。',
      duration: Infinity,
      closeButton: true,
      action: {
        label: '查看更新',
        onClick: () => void navigate({ to: '/settings/about' }),
      },
      onDismiss: () => {
        dismissedVersion = status.latestVersion
      },
    })
  }, [navigate, update.data])

  return null
}
