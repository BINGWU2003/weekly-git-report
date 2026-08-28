import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { FolderSearch, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfigSchema } from '@weekly-git-report/shared'
import type { Config } from '@weekly-git-report/shared'
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { ConfigState } from '../../../../shared/ipc'

interface ConfigFormProps {
  initialConfig: Config
  state: ConfigState
  isInitializing: boolean
}

type ConfigFormInput = z.input<typeof ConfigSchema>

export function ConfigForm({ initialConfig, state, isInitializing }: ConfigFormProps) {
  const queryClient = useQueryClient()
  const form = useForm<ConfigFormInput, unknown, Config>({
    resolver: zodResolver(ConfigSchema),
    defaultValues: initialConfig,
  })
  const identities = useFieldArray({ control: form.control, name: 'identities' })
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
      queryClient.setQueryData(['config-state'], next)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['config'] }),
        queryClient.invalidateQueries({ queryKey: ['overview'] }),
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
        queryClient.invalidateQueries({ queryKey: ['projects-state'] }),
      ])
      toast.success(isInitializing ? '初始化完成' : '配置已保存')
    },
    onError: async (error) => {
      if (error instanceof Error && error.message.includes('changed since')) {
        toast.error('配置已被 CLI 或其他窗口修改，请重新加载后再保存。')
        await queryClient.invalidateQueries({ queryKey: ['config-state'] })
        return
      }
      toast.error(getErrorMessage(error))
    },
  })

  const defaultSince = useWatch({ control: form.control, name: 'defaultSince' })
  const defaultUntil = useWatch({ control: form.control, name: 'defaultUntil' })
  const sinceMode = defaultSince === 'last monday' ? 'last-monday' : 'date'
  const untilMode = defaultUntil === 'now' ? 'now' : 'date'

  async function selectOutputDirectory() {
    const selected = await window.electronAPI.system.selectDirectory(form.getValues('outputRoot'))
    if (selected) form.setValue('outputRoot', selected, { shouldDirty: true, shouldValidate: true })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((value) => mutation.mutate(value))} className='space-y-5'>
        {isInitializing && (
          <Alert>
            <AlertTitle>首次初始化</AlertTitle>
            <AlertDescription>
              保存后将创建共享配置、仓库索引和报告目录，CLI 可直接读取同一份配置。
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>目录</CardTitle>
            <CardDescription>修改目录只影响后续生成内容，不会迁移已有报告或仓库。</CardDescription>
          </CardHeader>
          <CardContent className='space-y-5'>
            <FormField
              control={form.control}
              name='outputRoot'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>报告输出目录</FormLabel>
                  <div className='flex gap-2'>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <Button type='button' variant='outline' onClick={selectOutputDirectory}>
                      <FolderSearch />
                      选择
                    </Button>
                  </div>
                  <FormDescription>支持绝对路径或以 ~/ 开头的用户目录路径。</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='repositoryCacheRoot'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>仓库缓存目录</FormLabel>
                  <FormControl>
                    <Input {...field} readOnly className='bg-muted/50' />
                  </FormControl>
                  <FormDescription>
                    应用在这里维护只用于读取 Git 日志的 Bare 仓库。初始化后 Electron 不允许修改该目录。
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>默认采集周期</CardTitle>
            <CardDescription>手动执行或任务未指定日期时使用这些默认值。</CardDescription>
          </CardHeader>
          <CardContent className='grid gap-5 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='defaultSince'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>开始时间</FormLabel>
                  <Select
                    value={sinceMode}
                    onValueChange={(value) =>
                      field.onChange(value === 'last-monday' ? 'last monday' : today())
                    }
                  >
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='last-monday'>上周一</SelectItem>
                      <SelectItem value='date'>指定日期</SelectItem>
                    </SelectContent>
                  </Select>
                  {sinceMode === 'date' && <Input type='date' {...field} />}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='defaultUntil'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>结束时间</FormLabel>
                  <Select
                    value={untilMode}
                    onValueChange={(value) => field.onChange(value === 'now' ? 'now' : today())}
                  >
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='now'>当前时间</SelectItem>
                      <SelectItem value='date'>指定日期</SelectItem>
                    </SelectContent>
                  </Select>
                  {untilMode === 'date' && <Input type='date' {...field} />}
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>采集规则</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name='includeEmptyProjects'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between gap-4 rounded-lg border p-4'>
                  <div>
                    <FormLabel>显示无提交仓库</FormLabel>
                    <FormDescription>
                      在报告中显示当前周期没有匹配提交的已启用仓库。
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex-row items-start justify-between'>
            <div className='space-y-1.5'>
              <CardTitle>Git 作者身份</CardTitle>
              <CardDescription>采集时只保留匹配这些姓名或邮箱的提交。</CardDescription>
            </div>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() => identities.append({ name: '', email: '' })}
            >
              <Plus />
              添加身份
            </Button>
          </CardHeader>
          <CardContent className='space-y-3'>
            {identities.fields.map((identity, index) => (
              <div key={identity.id} className='grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]'>
                <FormField
                  control={form.control}
                  name={`identities.${index}.name`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>姓名</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`identities.${index}.email`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>邮箱</FormLabel>
                      <FormControl><Input type='email' {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type='button'
                  size='icon'
                  variant='ghost'
                  className='self-end'
                  disabled={identities.fields.length === 1}
                  onClick={() => identities.remove(index)}
                  aria-label='删除身份'
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            {identities.fields.length === 0 && (
              <Button type='button' variant='outline' onClick={() => identities.append({ name: '', email: '' })}>
                <Plus />
                添加第一个身份
              </Button>
            )}
          </CardContent>
        </Card>

        <div className='flex justify-end'>
          <Button type='submit' disabled={mutation.isPending || (!isInitializing && !isDirty)}>
            {mutation.isPending ? <Loader2 className='animate-spin' /> : <Save />}
            {isInitializing ? '完成初始化' : '保存配置'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

function today(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
