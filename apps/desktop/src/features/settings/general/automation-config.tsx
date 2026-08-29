import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, CheckCircle2, Loader2, Send, Trash2 } from 'lucide-react'
import type { AiProvider } from '@weekly-git-report/shared'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getErrorMessage } from '@/lib/errors'
import { showSuccessToast } from '@/lib/toast'

export function AutomationConfig() {
  const queryClient = useQueryClient()
  const [provider, setProvider] = useState<AiProvider>('openai')
  const [apiKey, setApiKey] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [signingSecret, setSigningSecret] = useState('')
  const ai = useQuery({ queryKey: ['ai-status'], queryFn: () => window.electronAPI.ai.status() })
  const feishu = useQuery({ queryKey: ['feishu-status'], queryFn: () => window.electronAPI.feishu.status() })

  const aiAction = useMutation({
    mutationFn: async (action: 'save' | 'test' | 'clear') => {
      if (action === 'save') return window.electronAPI.ai.configure(provider, apiKey)
      if (action === 'test') return window.electronAPI.ai.test()
      return window.electronAPI.ai.clear()
    },
    onSuccess: async (_, action) => {
      setApiKey('')
      await queryClient.invalidateQueries({ queryKey: ['ai-status'] })
      showSuccessToast(action === 'test' ? 'AI 连接测试成功' : action === 'clear' ? 'AI 配置已清除' : 'AI 配置已保存')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const feishuAction = useMutation({
    mutationFn: async (action: 'save' | 'test' | 'clear') => {
      if (action === 'save') return window.electronAPI.feishu.configure(webhookUrl, signingSecret || undefined)
      if (action === 'test') return window.electronAPI.feishu.test()
      return window.electronAPI.feishu.clear()
    },
    onSuccess: async (_, action) => {
      setWebhookUrl('')
      setSigningSecret('')
      await queryClient.invalidateQueries({ queryKey: ['feishu-status'] })
      showSuccessToast(action === 'test' ? '飞书连接测试成功' : action === 'clear' ? '飞书配置已清除' : '飞书配置已保存')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <div className='space-y-5'>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <CardTitle className='flex items-center gap-2'><Bot />AI 生成</CardTitle>
              <CardDescription>只选择供应商并填写密钥；模型和生成参数由应用版本管理。</CardDescription>
            </div>
            <Status configured={ai.data?.configured} tested={Boolean(ai.data?.testedAt)} />
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label>供应商</Label>
              <Select value={provider} onValueChange={(value) => setProvider(value as AiProvider)}>
                <SelectTrigger className='w-full'><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='openai'>OpenAI</SelectItem>
                  <SelectItem value='deepseek'>DeepSeek</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='ai-key'>API Key</Label>
              <Input id='ai-key' type='password' value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={ai.data?.configured ? '输入新密钥以替换现有配置' : '不会显示或写入日志'} />
            </div>
          </div>
          <Alert>
            <AlertTitle>发送给模型的数据</AlertTitle>
            <AlertDescription>仓库名、分支、Commit Hash、时间、标题、正文、作者姓名和你填写的任务背景。不会主动包含作者邮箱、仓库远程 URL、本地路径或代码 Diff；提交文本和任务背景中自行写入的内容会原样发送。</AlertDescription>
          </Alert>
          <label className='flex items-start gap-2 text-sm'>
            <Checkbox checked={accepted} onCheckedChange={(value) => setAccepted(value === true)} />
            <span>我已了解并同意在生成报告时将上述数据发送给所选供应商。</span>
          </label>
          <div className='flex flex-wrap justify-end gap-2'>
            {ai.data?.configured && <Button variant='ghost' onClick={() => aiAction.mutate('clear')} disabled={aiAction.isPending}><Trash2 />清除</Button>}
            {ai.data?.configured && <Button variant='outline' onClick={() => aiAction.mutate('test')} disabled={aiAction.isPending}>{aiAction.isPending ? <Loader2 className='animate-spin' /> : <CheckCircle2 />}测试连接</Button>}
            <Button onClick={() => aiAction.mutate('save')} disabled={!apiKey.trim() || !accepted || aiAction.isPending}>保存 AI 配置</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <CardTitle className='flex items-center gap-2'><Send />飞书推送</CardTitle>
              <CardDescription>首版支持一个全局群自定义机器人 Webhook，可选签名密钥。</CardDescription>
            </div>
            <Status configured={feishu.data?.configured} tested={Boolean(feishu.data?.testedAt)} />
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='feishu-webhook'>Webhook</Label>
            <Input id='feishu-webhook' type='password' value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder={feishu.data?.configured ? '输入新 Webhook 以替换现有配置' : 'https://open.feishu.cn/open-apis/bot/v2/hook/...'} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='feishu-secret'>签名密钥（可选）</Label>
            <Input id='feishu-secret' type='password' value={signingSecret} onChange={(event) => setSigningSecret(event.target.value)} />
          </div>
          <div className='flex flex-wrap justify-end gap-2'>
            {feishu.data?.configured && <Button variant='ghost' onClick={() => feishuAction.mutate('clear')} disabled={feishuAction.isPending}><Trash2 />清除</Button>}
            {feishu.data?.configured && <Button variant='outline' onClick={() => feishuAction.mutate('test')} disabled={feishuAction.isPending}>{feishuAction.isPending ? <Loader2 className='animate-spin' /> : <CheckCircle2 />}测试连接</Button>}
            <Button onClick={() => feishuAction.mutate('save')} disabled={!webhookUrl.trim() || feishuAction.isPending}>保存飞书配置</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Status({ configured, tested }: { configured?: boolean; tested: boolean }) {
  if (!configured) return <Badge variant='outline'>未配置</Badge>
  return tested ? <Badge variant='secondary'>已测试</Badge> : <Badge variant='outline'>待测试</Badge>
}
