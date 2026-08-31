import { useState } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import {
  AI_MODEL_SUGGESTIONS,
  AI_PROVIDER_BASE_URLS,
  type AiProvider,
} from '@weekly-git-report/shared'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PROVIDER_OPTIONS: Array<{ value: AiProvider; label: string }> = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'custom', label: '自定义服务（OpenAI 兼容）' },
]

export function AiConnectionFields({
  idPrefix,
  provider,
  baseUrl,
  model,
  disabled = false,
  onProviderChange,
  onBaseUrlChange,
  onModelChange,
}: {
  idPrefix: string
  provider: AiProvider
  baseUrl: string
  model: string
  disabled?: boolean
  onProviderChange(provider: AiProvider): void
  onBaseUrlChange(baseUrl: string): void
  onModelChange(model: string): void
}) {
  const modelSuggestions = AI_MODEL_SUGGESTIONS[provider]
  const custom = provider === 'custom'

  function changeProvider(value: string) {
    const next = value as AiProvider
    onProviderChange(next)
  }

  return (
    <div className='grid gap-4 sm:grid-cols-2'>
      <div className='space-y-2'>
        <Label htmlFor={`${idPrefix}-provider`}>AI 服务</Label>
        <Select value={provider} onValueChange={changeProvider} disabled={disabled}>
          <SelectTrigger id={`${idPrefix}-provider`} className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className='space-y-2'>
        <Label htmlFor={`${idPrefix}-model`}>模型</Label>
        <ModelCombobox
          id={`${idPrefix}-model`}
          value={model}
          suggestions={modelSuggestions}
          disabled={disabled}
          onChange={onModelChange}
        />
      </div>
      <div className='space-y-2 sm:col-span-2'>
        <Label htmlFor={`${idPrefix}-base-url`}>API Base URL</Label>
        <Input
          id={`${idPrefix}-base-url`}
          type='url'
          value={baseUrl}
          onChange={(event) => onBaseUrlChange(event.target.value)}
          placeholder='https://example.com/v1'
          readOnly={!custom}
          disabled={disabled}
          className={!custom ? 'bg-muted/50' : undefined}
          required
        />
        <p className='text-sm text-muted-foreground'>
          {custom
            ? '填写完整 API 根地址；应用不会自动补充 /v1。'
            : '官方服务使用固定地址；代理或本地模型请选择“自定义服务”。'}
        </p>
        {isInsecureRemoteAiUrl(baseUrl) ? (
          <p className='text-sm text-amber-700 dark:text-amber-400'>
            此 HTTP 地址不是本机地址，API Key 和报告内容可能被明文传输。
          </p>
        ) : null}
      </div>
    </div>
  )
}

function ModelCombobox({
  id,
  value,
  suggestions,
  disabled,
  onChange,
}: {
  id: string
  value: string
  suggestions: readonly string[]
  disabled: boolean
  onChange(value: string): void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const filteredSuggestions = normalizedQuery
    ? suggestions.filter((suggestion) => suggestion.toLowerCase().includes(normalizedQuery))
    : suggestions
  const exactSuggestion = suggestions.some(
    (suggestion) => suggestion.toLowerCase() === normalizedQuery
  )
  const customValue = query.trim()
  const listId = `${id}-list`

  function selectModel(next: string) {
    onChange(next)
    setQuery('')
    setOpen(false)
  }

  function changeOpen(next: boolean) {
    setOpen(next)
    if (!next) setQuery('')
  }

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type='button'
          variant='outline'
          role='combobox'
          aria-expanded={open}
          aria-controls={listId}
          aria-required='true'
          disabled={disabled}
          className='w-full justify-between px-3 font-normal'
        >
          <span className={value ? 'truncate' : 'truncate text-muted-foreground'}>
            {value || '选择建议或输入模型 ID'}
          </span>
          <ChevronsUpDown className='ms-2 size-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        className='w-(--radix-popover-trigger-width) p-0'
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder='搜索或输入模型 ID…'
            aria-label='搜索或输入模型 ID'
          />
          <CommandList id={listId}>
            {!customValue && filteredSuggestions.length === 0 ? (
              <CommandEmpty>输入完整模型 ID 后确认使用</CommandEmpty>
            ) : null}
            {customValue && !exactSuggestion ? (
              <CommandGroup heading='自定义模型'>
                <CommandItem value={`custom:${customValue}`} onSelect={() => selectModel(customValue)}>
                  <Plus />
                  <span className='min-w-0 truncate'>使用“{customValue}”</span>
                </CommandItem>
              </CommandGroup>
            ) : null}
            {filteredSuggestions.length > 0 ? (
              <CommandGroup heading='推荐模型'>
                {filteredSuggestions.map((suggestion) => (
                  <CommandItem
                    key={suggestion}
                    value={suggestion}
                    onSelect={() => selectModel(suggestion)}
                  >
                    <Check className={value === suggestion ? 'opacity-100' : 'opacity-0'} />
                    {suggestion}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function initialAiBaseUrl(provider: AiProvider): string {
  return provider === 'custom' ? '' : AI_PROVIDER_BASE_URLS[provider]
}

function isInsecureRemoteAiUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'http:' &&
      !['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase())
    )
  } catch {
    return false
  }
}
