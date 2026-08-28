import { useEffect, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { ChevronDown, Loader2, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { RepositoryProjectSchema } from '@weekly-git-report/shared'
import type { RepositoryProject } from '@weekly-git-report/shared'
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import type { ProjectsState, RemoteRepositoryDetails } from '../../../shared/ipc'

type RepositoryFormInput = z.input<typeof RepositoryProjectSchema>

interface RepositoryFormProps {
  open: boolean
  onOpenChange(open: boolean): void
  project?: RepositoryProject
  state: ProjectsState
}

export function RepositoryForm({ open, onOpenChange, project, state }: RepositoryFormProps) {
  const queryClient = useQueryClient()
  const [remote, setRemote] = useState<RemoteRepositoryDetails | null>(null)
  const [inspecting, setInspecting] = useState(Boolean(project))
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [inheritAuthors, setInheritAuthors] = useState(project?.authors === undefined)
  const form = useForm<RepositoryFormInput, unknown, RepositoryProject>({
    resolver: zodResolver(RepositoryProjectSchema),
    defaultValues: project ?? {
      id: '',
      name: '',
      url: '',
      branch: '',
      localPath: '',
      enabled: true,
    },
  })
  const authors = useFieldArray({ control: form.control, name: 'authors' })
  const dirty = form.formState.isDirty
  useUnsavedChanges(open && dirty)

  useEffect(() => {
    if (!open || !project) return
    let active = true
    const url = project.url

    async function loadRemote() {
      try {
        const value = await window.electronAPI.projects.inspect(url)
        if (active) setRemote(value)
      } catch (error) {
        if (active) toast.error(`读取远程仓库失败：${getErrorMessage(error)}`)
      } finally {
        if (active) setInspecting(false)
      }
    }

    void loadRemote()
    return () => {
      active = false
    }
  }, [open, project])

  const save = useMutation({
    mutationFn: (value: RepositoryProject) => {
      if (!state.revision) throw new Error('请先完成全局配置初始化。')
      return window.electronAPI.projects.save({
        project: value,
        expectedRevision: state.revision,
        ...(project ? { currentId: project.id } : {}),
      })
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['projects-state'], next)
      void queryClient.invalidateQueries({ queryKey: ['overview'] })
      toast.success(project ? '仓库配置已更新' : '仓库已添加并完成首次同步')
      form.reset()
      onOpenChange(false)
    },
    onError: async (error) => {
      if (error instanceof Error && error.message.includes('changed since')) {
        toast.error('仓库配置已被其他进程修改，请重新加载。')
        await queryClient.invalidateQueries({ queryKey: ['projects-state'] })
        return
      }
      toast.error(getErrorMessage(error))
    },
  })

  async function inspectRemote() {
    const url = form.getValues('url')?.trim()
    if (!url) {
      form.setError('url', { message: '请输入仓库地址。' })
      return
    }
    setInspecting(true)
    try {
      const details = await window.electronAPI.projects.inspect(url)
      setRemote(details)
      form.clearErrors('url')
      if (!project) {
        form.setValue('id', details.suggestedId, { shouldDirty: true })
        form.setValue('name', details.suggestedName, { shouldDirty: true })
        form.setValue('localPath', details.suggestedLocalPath, { shouldDirty: true })
      }
      const currentBranch = form.getValues('branch')
      const branch = details.branches.includes(currentBranch)
        ? currentBranch
        : (details.defaultBranch ?? details.branches[0] ?? '')
      form.setValue('branch', branch, { shouldDirty: true, shouldValidate: true })
      toast.success(`已读取 ${details.branches.length} 个远程分支`)
    } catch (error) {
      toast.error(`读取远程仓库失败：${getErrorMessage(error)}`)
    } finally {
      setInspecting(false)
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next && dirty && !window.confirm('仓库表单有未保存的修改，确定放弃吗？')) return
    onOpenChange(next)
  }

  function setAuthorsInherited(checked: boolean) {
    setInheritAuthors(checked)
    if (checked) {
      form.setValue('authors', undefined, { shouldDirty: true })
    } else if (!form.getValues('authors')?.length) {
      form.setValue('authors', [{ name: '', email: '' }], { shouldDirty: true })
    }
  }

  const branches = remote?.branches ?? (project ? [project.branch] : [])

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className='w-full sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>{project ? '编辑仓库' : '添加仓库'}</SheetTitle>
          <SheetDescription>
            {project ? '远程地址不可修改；保存前会同步所选分支。' : '使用系统 Git 和本机凭据检查并缓存远程仓库。'}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className='min-h-0 flex-1 px-4'>
          <Form {...form}>
            <form id='repository-form' onSubmit={form.handleSubmit((value) => save.mutate(value))} className='space-y-5 pb-6'>
              <FormField
                control={form.control}
                name='url'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>远程地址</FormLabel>
                    <div className='flex gap-2'>
                      <FormControl>
                        <Input
                          {...field}
                          readOnly={Boolean(project)}
                          onChange={(event) => {
                            field.onChange(event)
                            setRemote(null)
                          }}
                          placeholder='git@gitlab.example.com:team/project.git'
                        />
                      </FormControl>
                      <Button type='button' variant='outline' disabled={inspecting} onClick={inspectRemote}>
                        {inspecting ? <Loader2 className='animate-spin' /> : <Search />}
                        读取分支
                      </Button>
                    </div>
                    <FormDescription>HTTPS、SSH 和本地 Git 地址均使用系统 Git 的认证能力。</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>仓库名称</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='branch'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>采集分支</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={!branches.length}>
                        <FormControl>
                          <SelectTrigger className='w-full'><SelectValue placeholder='先读取远程分支' /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {branches.map((branch) => <SelectItem key={branch} value={branch}>{branch}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='enabled'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                    <div>
                      <FormLabel>启用仓库</FormLabel>
                      <FormDescription>停用后不参与批量同步和报告采集。</FormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )}
              />

              <div className='flex items-center justify-between rounded-lg border p-4'>
                <div>
                  <p className='text-sm font-medium'>继承全局 Git 身份</p>
                  <p className='text-sm text-muted-foreground'>关闭后为此仓库设置专属作者。</p>
                </div>
                <Switch checked={inheritAuthors} onCheckedChange={setAuthorsInherited} />
              </div>

              {!inheritAuthors && (
                <div className='space-y-3'>
                  <div className='flex items-center justify-between'>
                    <p className='text-sm font-medium'>仓库作者身份</p>
                    <Button type='button' size='sm' variant='outline' onClick={() => authors.append({ name: '', email: '' })}>
                      <Plus /> 添加
                    </Button>
                  </div>
                  {authors.fields.map((author, index) => (
                    <div key={author.id} className='grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]'>
                      <FormField control={form.control} name={`authors.${index}.name`} render={({ field }) => (
                        <FormItem><FormLabel>姓名</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name={`authors.${index}.email`} render={({ field }) => (
                        <FormItem><FormLabel>邮箱</FormLabel><FormControl><Input type='email' {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <Button type='button' size='icon' variant='ghost' className='self-end' disabled={authors.fields.length === 1} onClick={() => authors.remove(index)} aria-label='删除作者'>
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button type='button' variant='ghost' className='w-full justify-between'>
                    高级设置
                    <ChevronDown className={advancedOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className='pt-3'>
                  <FormField
                    control={form.control}
                    name='localPath'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bare Git 缓存路径</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormDescription>仅用于日志采集，不要指向日常开发工作区。</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CollapsibleContent>
              </Collapsible>
            </form>
          </Form>
        </ScrollArea>
        <SheetFooter className='border-t'>
          <Button type='submit' form='repository-form' disabled={save.isPending || inspecting || !remote}>
            {save.isPending && <Loader2 className='animate-spin' />}
            {save.isPending ? '正在同步并保存…' : '同步并保存'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
