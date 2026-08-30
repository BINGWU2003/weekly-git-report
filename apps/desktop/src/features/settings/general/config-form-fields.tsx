import { useState } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import type { z } from 'zod'
import { ChevronDown, FolderSearch, Loader2, Plus, Trash2 } from 'lucide-react'
import { ConfigSchema } from '@weekly-git-report/shared'
import type { Config } from '@weekly-git-report/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { selectSystemDirectory } from '@/lib/system-actions'

export type ConfigFormInput = z.input<typeof ConfigSchema>

export function ConfigFormFields({
  compact = false,
  cacheEditable = false,
}: {
  compact?: boolean
  cacheEditable?: boolean
}) {
  const form = useFormContext<ConfigFormInput, unknown, Config>()
  const identities = useFieldArray({ control: form.control, name: 'identities' })
  const [selectingOutput, setSelectingOutput] = useState(false)
  const [selectingCache, setSelectingCache] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  async function selectOutputDirectory() {
    setSelectingOutput(true)
    try {
      const selected = await selectSystemDirectory(form.getValues('outputRoot'))
      if (selected) {
        form.setValue('outputRoot', selected, { shouldDirty: true, shouldValidate: true })
      }
    } finally {
      setSelectingOutput(false)
    }
  }

  async function selectCacheDirectory() {
    setSelectingCache(true)
    try {
      const selected = await selectSystemDirectory(form.getValues('repositoryCacheRoot'))
      if (selected) {
        form.setValue('repositoryCacheRoot', selected, { shouldDirty: true, shouldValidate: true })
      }
    } finally {
      setSelectingCache(false)
    }
  }

  const outputField = (
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
            <Button
              type='button'
              variant='outline'
              onClick={() => void selectOutputDirectory()}
              disabled={selectingOutput}
            >
              {selectingOutput ? <Loader2 className='animate-spin' /> : <FolderSearch />}
              选择
            </Button>
          </div>
          <FormDescription>可以选择文件夹，也可以直接输入完整路径。</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  const cacheField = (
    <FormField
      control={form.control}
      name='repositoryCacheRoot'
      render={({ field }) => (
        <FormItem>
          <FormLabel>仓库缓存目录</FormLabel>
          <div className='flex gap-2'>
            <FormControl>
              <Input
                {...field}
                readOnly={!cacheEditable}
                className={cacheEditable ? undefined : 'bg-muted/50'}
              />
            </FormControl>
            {cacheEditable ? (
              <Button
                type='button'
                variant='outline'
                onClick={() => void selectCacheDirectory()}
                disabled={selectingCache}
              >
                {selectingCache ? <Loader2 className='animate-spin' /> : <FolderSearch />}
                选择
              </Button>
            ) : null}
          </div>
          <FormDescription>
            用于保存本地仓库缓存。
            {cacheEditable ? ' 完成首次设置后不能在桌面端修改。' : ' 此目录不能在桌面端修改。'}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  const includeEmptyField = (
    <FormField
      control={form.control}
      name='includeEmptyProjects'
      render={({ field }) => (
        <FormItem className='flex items-center justify-between gap-4 rounded-lg border p-4'>
          <div>
            <FormLabel>显示无提交仓库</FormLabel>
            <FormDescription>在报告中显示当前周期没有匹配提交的已启用仓库。</FormDescription>
          </div>
          <FormControl>
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          </FormControl>
        </FormItem>
      )}
    />
  )

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>目录</CardTitle>
          <CardDescription>修改目录只影响后续生成内容，不会迁移已有报告或仓库。</CardDescription>
        </CardHeader>
        <CardContent className='space-y-5'>
          {outputField}
          {!compact && cacheField}
        </CardContent>
      </Card>

      <IdentityFields
        fields={identities.fields}
        append={identities.append}
        remove={identities.remove}
      />

      {compact ? (
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <Card>
            <CardHeader>
              <CollapsibleTrigger asChild>
                <Button
                  type='button'
                  variant='ghost'
                  className='h-auto w-full justify-between p-0 text-start'
                >
                  <span>
                    <CardTitle>高级设置</CardTitle>
                    <CardDescription className='mt-1.5'>缓存目录和无提交仓库规则。</CardDescription>
                  </span>
                  <ChevronDown
                    className={
                      advancedOpen ? 'rotate-180 transition-transform' : 'transition-transform'
                    }
                  />
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className='space-y-5'>
                {cacheField}
                {includeEmptyField}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>采集规则</CardTitle>
          </CardHeader>
          <CardContent>{includeEmptyField}</CardContent>
        </Card>
      )}
    </>
  )
}

function IdentityFields({
  fields,
  append,
  remove,
}: {
  fields: Array<{ id: string }>
  append(value: { name: string; email: string }): void
  remove(index: number): void
}) {
  const form = useFormContext<ConfigFormInput, unknown, Config>()
  return (
    <Card>
      <CardHeader className='flex items-start justify-between'>
        <div className='space-y-1.5'>
          <CardTitle>Git 作者身份</CardTitle>
          <CardDescription>采集时只保留匹配这些姓名或邮箱的提交。</CardDescription>
        </div>
        <Button
          type='button'
          size='sm'
          variant='outline'
          onClick={() => append({ name: '', email: '' })}
        >
          <Plus />
          添加身份
        </Button>
      </CardHeader>
      <CardContent className='space-y-3'>
        {fields.map((identity, index) => (
          <div
            key={identity.id}
            className='grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]'
          >
            <FormField
              control={form.control}
              name={`identities.${index}.name`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>姓名</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
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
                  <FormControl>
                    <Input type='email' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type='button'
              size='icon'
              variant='ghost'
              className='self-end'
              disabled={fields.length === 1}
              onClick={() => remove(index)}
              aria-label='删除身份'
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        {fields.length === 0 && (
          <Button type='button' variant='outline' onClick={() => append({ name: '', email: '' })}>
            <Plus />
            添加第一个身份
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
