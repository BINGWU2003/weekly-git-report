import { useEffect } from 'react'
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'

export const desktopUpdateQueryKey = ['desktop-update-status'] as const
export const desktopUpdateAvailableToastId = 'desktop-update-available'

export const desktopUpdateQueryOptions = queryOptions({
  queryKey: desktopUpdateQueryKey,
  queryFn: () => window.electronAPI.updates.status(),
  staleTime: Infinity,
})

export function useDesktopUpdateStatus() {
  const queryClient = useQueryClient()
  const query = useQuery(desktopUpdateQueryOptions)

  useEffect(
    () =>
      window.electronAPI.updates.onStatusChange((status) => {
        queryClient.setQueryData(desktopUpdateQueryKey, status)
      }),
    [queryClient]
  )

  return query
}
