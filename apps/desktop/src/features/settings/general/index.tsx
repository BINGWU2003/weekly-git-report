import { useQuery } from '@tanstack/react-query'
import { FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ContentSection } from '../components/content-section'

export function SettingsGeneral() {
  const config = useQuery({
    queryKey: ['config'],
    queryFn: () => window.electronAPI.config.get(),
  })

  return (
    <ContentSection
      title='常规设置'
      desc='CLI 与 Electron 共同读取 ~/.weekly-git-report/config.json。'
    >
      <Card>
        <CardContent className='space-y-5 pt-6'>
          <ConfigValue label='报告输出目录' value={config.data?.outputRoot} />
          <ConfigValue label='仓库缓存目录' value={config.data?.repositoryCacheRoot} />
          <ConfigValue
            label='无提交仓库'
            value={config.data ? (config.data.includeEmptyProjects ? '包含' : '忽略') : undefined}
          />
          <ConfigValue
            label='Git 作者身份'
            value={config.data?.identities
              .map((identity) => `${identity.name} <${identity.email}>`)
              .join('\n')}
          />
          {!config.isLoading && !config.data && (
            <p className='rounded-lg bg-muted p-3 text-sm text-muted-foreground'>
              尚未找到配置，请先运行 <code>weekly init</code>。
            </p>
          )}
          <div className='flex gap-2'>
            <Button
              variant='outline'
              disabled={!config.data}
              onClick={() => window.electronAPI.system.openOutputRoot()}
            >
              <FolderOpen />
              打开报告目录
            </Button>
            <Button variant='outline' onClick={() => config.refetch()}>
              重新读取
            </Button>
          </div>
        </CardContent>
      </Card>
    </ContentSection>
  )
}

function ConfigValue({ label, value }: { label: string; value?: string }) {
  return (
    <div className='grid gap-1.5'>
      <p className='text-sm font-medium'>{label}</p>
      <p className='whitespace-pre-wrap break-all rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground'>
        {value || '—'}
      </p>
    </div>
  )
}
