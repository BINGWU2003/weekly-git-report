import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Loader2, Save } from 'lucide-react'
import { ConfigSchema } from '@weekly-git-report/shared'
import type { Config } from '@weekly-git-report/shared'
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { desktopQueryKeys } from '@/lib/desktop-queries'
import { getErrorMessage } from '@/lib/errors'
import { showErrorToast, showSuccessToast } from '@/lib/toast'
import type { ConfigState } from '../../../../shared/ipc'
import { ConfigFormFields, type ConfigFormInput } from './config-form-fields'

interface ConfigFormProps {
  initialConfig: Config
  state: ConfigState
  isInitializing: boolean
  compact?: boolean
  onSaved?(state: ConfigState): void
}

export function ConfigForm({
  initialConfig,
  state,
  isInitializing,
  compact = false,
  onSaved,
}: ConfigFormProps) {
  const queryClient = useQueryClient()
  const form = useForm<ConfigFormInput, unknown, Config>({
    resolver: zodResolver(ConfigSchema),
    defaultValues: initialConfig,
  })
  const isDirty = form.formState.isDirty
  useUnsavedChanges(isDirty)

  const mutation = useMutation({
    mutationFn: (config: Config) => {
      if (isInitializing) return window.electronAPI.config.initialize(config)
      if (!state.revision) throw new Error('配置版本缺失，请重新读取。')
      return window.electronAPI.config.save(config, state.revision)
    },
    onSuccess: async (next) => {
      form.reset(next.config ?? initialConfig)
      queryClient.setQueryData(desktopQueryKeys.configState, next)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: desktopQueryKeys.overview }),
        queryClient.invalidateQueries({ queryKey: desktopQueryKeys.reports }),
        queryClient.invalidateQueries({ queryKey: desktopQueryKeys.projectsState }),
        queryClient.invalidateQueries({ queryKey: desktopQueryKeys.diagnostics }),
        queryClient.invalidateQueries({ queryKey: desktopQueryKeys.onboarding }),
      ])
      onSaved?.(next)
      showSuccessToast(isInitializing ? '首次设置完成' : '配置已保存')
    },
    onError: async (error) => {
      if (error instanceof Error && error.message.includes('changed since')) {
        showErrorToast('配置已在其他位置修改，请重新加载后再保存。')
        await queryClient.invalidateQueries({ queryKey: desktopQueryKeys.configState })
        return
      }
      showErrorToast(getErrorMessage(error))
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((value) => mutation.mutate(value))} className='space-y-5'>
        {isInitializing && !compact && (
          <Alert>
            <AlertTitle>首次设置</AlertTitle>
            <AlertDescription>
              保存后会创建本地配置、仓库索引和报告目录。
            </AlertDescription>
          </Alert>
        )}

        {state.workspaceError && (
          <Alert variant='destructive'>
            <AlertCircle />
            <AlertTitle>工作区需要修复</AlertTitle>
            <AlertDescription className='[overflow-wrap:anywhere]'>
              {state.workspaceError}。检查目录设置后重新保存，应用会安全补齐缺失内容。
            </AlertDescription>
          </Alert>
        )}

        <ConfigFormFields compact={compact} cacheEditable={isInitializing} />

        {mutation.isError && (
          <Alert variant='destructive'>
            <AlertCircle />
            <AlertTitle>{isInitializing ? '首次设置失败' : '无法保存配置'}</AlertTitle>
            <AlertDescription className='[overflow-wrap:anywhere]'>
              {getErrorMessage(mutation.error)}
            </AlertDescription>
          </Alert>
        )}

        <div className='flex justify-end'>
          <Button type='submit' disabled={mutation.isPending || (!isInitializing && !isDirty)}>
            {mutation.isPending ? <Loader2 className='animate-spin' /> : <Save />}
            {isInitializing ? '保存并继续' : '保存配置'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
