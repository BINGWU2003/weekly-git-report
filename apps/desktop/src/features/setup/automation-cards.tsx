import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, CheckCircle2, Loader2, Send, Trash2 } from 'lucide-react'
import type { AiProvider } from '@weekly-git-report/shared'
import {
  AiConnectionFields,
  initialAiBaseUrl,
} from '@/components/ai-connection-fields'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { desktopQueryKeys } from '@/lib/desktop-queries'
import { getErrorMessage } from '@/lib/errors'
import { showErrorToast, showSuccessToast } from '@/lib/toast'
import type { SecretConfigurationStatus } from '../../../shared/ipc'

export function AiConfigCard({
  setup = false,
  onSaved,
  onSkip,
  skipping = false,
}: {
  setup?: boolean
  onSaved?(status: SecretConfigurationStatus): void
  onSkip?(): void
  skipping?: boolean
}) {
  const queryClient = useQueryClient()
  const [providerOverride, setProviderOverride] = useState<AiProvider>()
  const [baseUrlOverride, setBaseUrlOverride] = useState<string>()
  const [modelOverride, setModelOverride] = useState<string>()
  const [apiKey, setApiKey] = useState('')
  const [acceptedOverride, setAcceptedOverride] = useState<boolean>()
  const ai = useQuery({
    queryKey: desktopQueryKeys.aiStatus,
    queryFn: () => window.electronAPI.ai.status(),
  })

  const provider = providerOverride ?? ai.data?.provider ?? 'openai'
  const baseUrl =
    baseUrlOverride ?? ai.data?.baseUrl ?? initialAiBaseUrl(ai.data?.provider ?? 'openai')
  const model = modelOverride ?? ai.data?.model ?? ''
  const accepted = acceptedOverride ?? ai.data?.dataSharingAccepted ?? false

  function changeProvider(next: AiProvider) {
    setProviderOverride(next)
    setBaseUrlOverride(
      next === ai.data?.provider
        ? (ai.data.baseUrl ?? initialAiBaseUrl(next))
        : initialAiBaseUrl(next)
    )
    setModelOverride(next === ai.data?.provider ? (ai.data.model ?? '') : '')
    setApiKey('')
  }

  const action = useMutation({
    mutationFn: async (nextAction: 'save' | 'test' | 'save-and-test' | 'clear') => {
      if (nextAction === 'clear') return window.electronAPI.ai.clear()
      if (nextAction === 'test') return window.electronAPI.ai.test()
      const saved = await window.electronAPI.ai.configure({
        provider,
        baseUrl,
        model,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        dataSharingAccepted: accepted,
      })
      if (nextAction === 'save') return { status: saved, testError: undefined }
      try {
        return { status: await window.electronAPI.ai.test(), testError: undefined }
      } catch (error) {
        return { status: saved, testError: getErrorMessage(error) }
      }
    },
    onSuccess: async (result, nextAction) => {
      const status = 'status' in result ? result.status : result
      const testError = 'testError' in result ? result.testError : undefined
      setApiKey('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: desktopQueryKeys.aiStatus }),
        queryClient.invalidateQueries({ queryKey: desktopQueryKeys.onboarding }),
      ])
      if ((nextAction === 'save' || nextAction === 'save-and-test') && !testError) onSaved?.(status)
      if (testError) {
        showErrorToast(`AI 配置已保存，但连接测试失败：${testError}`)
        return
      }
      showSuccessToast(
        nextAction === 'test' || nextAction === 'save-and-test'
          ? 'AI 配置已保存，连接正常'
          : nextAction === 'clear'
            ? 'AI 配置已清除'
            : 'AI 配置已保存',
      )
    },
    onError: (error) => showErrorToast(getErrorMessage(error)),
  })

  const needsKey = !ai.data?.configured || provider !== ai.data.provider
  const canSubmit = Boolean(
    baseUrl.trim() &&
      model.trim() &&
      accepted &&
      (!needsKey || apiKey.trim()) &&
      !action.isPending
  )

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between gap-3'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <Bot />
              AI 生成
            </CardTitle>
            <CardDescription>配置 AI 服务、API 地址、模型和密钥。</CardDescription>
          </div>
          <Status configured={ai.data?.configured} tested={Boolean(ai.data?.testedAt)} />
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        <AiConnectionFields
          idPrefix={setup ? 'setup-ai' : 'ai'}
          provider={provider}
          baseUrl={baseUrl}
          model={model}
          disabled={action.isPending}
          onProviderChange={changeProvider}
          onBaseUrlChange={setBaseUrlOverride}
          onModelChange={setModelOverride}
        />
        <div className='space-y-2'>
          <Label htmlFor='ai-key'>API 密钥</Label>
          <Input
            id='ai-key'
            type='password'
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={ai.data?.configured ? '输入新密钥以替换当前配置' : '密钥只保存在本机，不会写入日志'}
          />
        </div>
        <Alert>
          <AlertTitle>发送给模型的数据</AlertTitle>
          <AlertDescription>
            仓库名、分支、提交哈希、时间、标题、正文、作者姓名和你填写的补充背景。不会主动包含作者邮箱、仓库地址、本地路径或代码差异；提交文本和补充背景中的内容会原样发送。
          </AlertDescription>
        </Alert>
        <label className='flex items-start gap-2 text-sm'>
          <Checkbox
            checked={accepted}
            onCheckedChange={(value) => setAcceptedOverride(value === true)}
          />
          <span>我已了解并同意在生成报告时将上述数据发送到我配置的 AI 服务。</span>
        </label>
        <div className='flex flex-wrap justify-end gap-2'>
          {ai.data?.configured ? (
            <Button
              variant='ghost'
              onClick={() => action.mutate('clear')}
              disabled={action.isPending}
            >
              <Trash2 />
              清除配置
            </Button>
          ) : null}
          {setup && onSkip ? (
            <Button variant='ghost' onClick={onSkip} disabled={action.isPending || skipping}>
              {skipping ? <Loader2 className='animate-spin' /> : null}
              暂时跳过
            </Button>
          ) : null}
          {ai.data?.configured && !apiKey.trim() ? (
            <Button
              variant='outline'
              onClick={() => action.mutate('test')}
              disabled={action.isPending}
            >
              {action.isPending ? <Loader2 className='animate-spin' /> : <CheckCircle2 />}
              测试连接
            </Button>
          ) : null}
          {setup ? (
            <Button
              variant='outline'
              onClick={() => action.mutate('save')}
              disabled={!canSubmit}
            >
              {action.isPending ? <Loader2 className='animate-spin' /> : <CheckCircle2 />}
              保存，稍后测试
            </Button>
          ) : null}
          <Button onClick={() => action.mutate('save-and-test')} disabled={!canSubmit}>
            {action.isPending ? <Loader2 className='animate-spin' /> : <CheckCircle2 />}
            保存并测试
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function FeishuConfigCard({
  setup = false,
  onTested,
}: {
  setup?: boolean
  onTested?(status: SecretConfigurationStatus): void
}) {
  const queryClient = useQueryClient()
  const [webhookUrl, setWebhookUrl] = useState('')
  const [signingSecret, setSigningSecret] = useState('')
  const feishu = useQuery({
    queryKey: desktopQueryKeys.feishuStatus,
    queryFn: () => window.electronAPI.feishu.status(),
  })
  const action = useMutation({
    mutationFn: async (nextAction: 'save' | 'test' | 'save-and-test' | 'clear') => {
      if (nextAction === 'clear') return window.electronAPI.feishu.clear()
      if (nextAction === 'test') return window.electronAPI.feishu.test()
      await window.electronAPI.feishu.configure({
        webhookUrl,
        ...(signingSecret.trim() ? { signingSecret: signingSecret.trim() } : {}),
      })
      return nextAction === 'save-and-test'
        ? window.electronAPI.feishu.test()
        : window.electronAPI.feishu.status()
    },
    onSuccess: async (status, nextAction) => {
      setWebhookUrl('')
      setSigningSecret('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: desktopQueryKeys.feishuStatus }),
        queryClient.invalidateQueries({ queryKey: desktopQueryKeys.onboarding }),
      ])
      if (status.testedAt) onTested?.(status)
      showSuccessToast(
        nextAction === 'test' || nextAction === 'save-and-test'
          ? '飞书配置已保存，连接正常'
          : nextAction === 'clear'
            ? '飞书配置已清除'
            : '飞书配置已保存',
      )
    },
    onError: (error) => showErrorToast(getErrorMessage(error)),
  })

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between gap-3'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <Send />
              飞书推送
            </CardTitle>
            <CardDescription>配置一个飞书群自定义机器人，签名密钥为可选项。</CardDescription>
          </div>
          <Status configured={feishu.data?.configured} tested={Boolean(feishu.data?.testedAt)} />
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='feishu-webhook'>机器人 Webhook</Label>
          <Input
            id='feishu-webhook'
            type='password'
            value={webhookUrl}
            onChange={(event) => setWebhookUrl(event.target.value)}
            placeholder={
              feishu.data?.configured
                ? '输入新 Webhook 以替换当前配置'
                : 'https://open.feishu.cn/open-apis/bot/v2/hook/...'
            }
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='feishu-secret'>签名密钥（可选）</Label>
          <Input
            id='feishu-secret'
            type='password'
            value={signingSecret}
            onChange={(event) => setSigningSecret(event.target.value)}
          />
        </div>
        <div className='flex flex-wrap justify-end gap-2'>
          {feishu.data?.configured ? (
            <Button
              variant='ghost'
              onClick={() => action.mutate('clear')}
              disabled={action.isPending}
            >
              <Trash2 />
              清除配置
            </Button>
          ) : null}
          {feishu.data?.configured && !webhookUrl.trim() ? (
            <Button
              variant='outline'
              onClick={() => action.mutate('test')}
              disabled={action.isPending}
            >
              {action.isPending ? <Loader2 className='animate-spin' /> : <CheckCircle2 />}
              测试连接
            </Button>
          ) : null}
          <Button
            onClick={() => action.mutate(setup ? 'save-and-test' : 'save')}
            disabled={!webhookUrl.trim() || action.isPending}
          >
            {action.isPending ? <Loader2 className='animate-spin' /> : <CheckCircle2 />}
            {setup ? '保存并测试' : '保存飞书配置'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Status({ configured, tested }: { configured?: boolean; tested: boolean }) {
  if (!configured) return <Badge variant='outline'>未配置</Badge>
  return tested ? (
    <Badge variant='secondary'>连接正常</Badge>
  ) : (
    <Badge variant='outline'>尚未测试</Badge>
  )
}
