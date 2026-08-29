import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getErrorMessage } from '@/lib/errors'
import { ContentSection } from '../components/content-section'
import { ConfigForm } from './config-form'
import { AutomationConfig } from './automation-config'

export function SettingsGeneral() {
  const state = useQuery({
    queryKey: ['config-state'],
    queryFn: () => window.electronAPI.config.state(),
  })
  const defaults = useQuery({
    queryKey: ['config-defaults'],
    queryFn: () => window.electronAPI.config.defaults(),
    enabled: state.data?.config === null,
  })

  return (
    <ContentSection
      title='常规设置'
      desc='CLI 与 Electron 共同读取 ~/.weekly-git-report/config.json。'
    >
      <div className='space-y-5'>
        {state.isLoading && <Loading />}
        {state.isError && (
          <Alert variant='destructive'>
            <AlertCircle />
            <AlertTitle>无法读取配置</AlertTitle>
            <AlertDescription>{getErrorMessage(state.error)}</AlertDescription>
          </Alert>
        )}
        {state.data?.config && (
          <ConfigForm
            key={state.data.revision}
            initialConfig={state.data.config}
            state={state.data}
            isInitializing={false}
          />
        )}
        {state.data?.config === null && defaults.isLoading && <Loading />}
        {state.data?.config === null && defaults.data && (
          <ConfigForm
            key='initialize'
            initialConfig={defaults.data.config}
            state={state.data}
            isInitializing
          />
        )}
        {state.data?.config && <AutomationConfig />}
      </div>
    </ContentSection>
  )
}

function Loading() {
  return (
    <div className='flex items-center gap-2 rounded-lg border p-6 text-sm text-muted-foreground'>
      <Loader2 className='animate-spin' />
      正在读取配置…
    </div>
  )
}
