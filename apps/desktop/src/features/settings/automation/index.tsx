import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, CheckCircle2, Eye, EyeOff, Loader2, RotateCcw, Send, Trash2 } from 'lucide-react'
import type { AiProvider } from '@weekly-git-report/shared'
import type { SecretConfigurationStatus } from '../../../../shared/ipc'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes'
import { getErrorMessage } from '@/lib/errors'
import { showErrorToast, showSuccessToast, showWarningToast } from '@/lib/toast'
import { ContentSection } from '../components/content-section'

type SecretEditorState =
  | { mode: 'masked' }
  | {
      mode: 'editing'
      value: string
      originalValue?: string
      replacement: boolean
      visible: boolean
    }

type ClearTarget = 'ai' | 'feishu' | undefined

export function SettingsAutomation() {
  return (
    <ContentSection
      title='AI 与推送'
      desc='配置报告生成服务和飞书机器人。密钥默认以掩码显示。'
      contentClassName='lg:max-w-2xl'
    >
      <AutomationConfig />
    </ContentSection>
  )
}

export function AutomationConfig() {
  const ai = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => window.electronAPI.ai.status(),
    refetchOnWindowFocus: false,
  })
  const feishu = useQuery({
    queryKey: ['feishu-status'],
    queryFn: () => window.electronAPI.feishu.status(),
    refetchOnWindowFocus: false,
  })

  if (ai.isLoading || feishu.isLoading) return <Loading />
  if (ai.isError || feishu.isError) {
    return (
      <Alert variant='destructive'>
        <AlertTitle>无法读取 AI 与推送配置</AlertTitle>
        <AlertDescription>{getErrorMessage(ai.error ?? feishu.error)}</AlertDescription>
      </Alert>
    )
  }
  if (!ai.data || !feishu.data) return <Loading />

  return <AutomationForm aiStatus={ai.data} feishuStatus={feishu.data} />
}

function AutomationForm({
  aiStatus,
  feishuStatus,
}: {
  aiStatus: SecretConfigurationStatus
  feishuStatus: SecretConfigurationStatus
}) {
  const queryClient = useQueryClient()
  const [provider, setProvider] = useState<AiProvider>(aiStatus.provider ?? 'openai')
  const [accepted, setAccepted] = useState(aiStatus.configured)
  const [apiKey, setApiKey] = useState<SecretEditorState>(() => secretFromMask(aiStatus.apiKeyMasked))
  const [webhookUrl, setWebhookUrl] = useState<SecretEditorState>(() => secretFromMask(feishuStatus.webhookUrlMasked))
  const [signingSecret, setSigningSecret] = useState<SecretEditorState>(() => secretFromMask(feishuStatus.signingSecretMasked))
  const [removeSigningSecret, setRemoveSigningSecret] = useState(false)
  const [clearTarget, setClearTarget] = useState<ClearTarget>()
  const [confirmSecretRemoval, setConfirmSecretRemoval] = useState(false)
  const [revealing, setRevealing] = useState<string>()
  const [aiTestError, setAiTestError] = useState<string>()
  const [feishuTestError, setFeishuTestError] = useState<string>()

  const aiDirty = useMemo(
    () =>
      provider !== (aiStatus.provider ?? 'openai') ||
      accepted !== aiStatus.configured ||
      secretIsDirty(apiKey, aiStatus.configured),
    [accepted, aiStatus, apiKey, provider]
  )
  const feishuDirty = useMemo(
    () =>
      secretIsDirty(webhookUrl, feishuStatus.configured) ||
      secretIsDirty(signingSecret, Boolean(feishuStatus.signingEnabled)) ||
      removeSigningSecret,
    [feishuStatus, removeSigningSecret, signingSecret, webhookUrl]
  )
  useUnsavedChanges(aiDirty || feishuDirty)

  const aiSave = useMutation({
    mutationFn: async () => {
      const apiKeyUpdate = secretUpdate(apiKey)
      const saved = await window.electronAPI.ai.configure({
        provider,
        dataSharingAccepted: accepted,
        ...(apiKeyUpdate !== undefined ? { apiKey: apiKeyUpdate } : {}),
      })
      try {
        return { status: await window.electronAPI.ai.test() }
      } catch (error) {
        return { status: saved, testError: getErrorMessage(error) }
      }
    },
    onSuccess: ({ status, testError }) => {
      queryClient.setQueryData(['ai-status'], status)
      setProvider(status.provider ?? 'openai')
      setAccepted(status.configured)
      setApiKey(secretFromMask(status.apiKeyMasked))
      setAiTestError(testError)
      if (testError) {
        showErrorToast(`AI 配置已保存，但连接测试失败：${testError}`)
      } else {
        showSuccessToast('AI 配置已保存，连接正常')
      }
    },
    onError: (error) => showErrorToast(getErrorMessage(error)),
  })
  const aiTest = useMutation({
    mutationFn: () => window.electronAPI.ai.test(),
    onSuccess: (status) => {
      queryClient.setQueryData(['ai-status'], status)
      setAiTestError(undefined)
      showSuccessToast('AI 连接正常')
    },
    onError: (error) => {
      const message = getErrorMessage(error)
      setAiTestError(message)
      showErrorToast(message)
    },
  })
  const feishuSave = useMutation({
    mutationFn: async () => {
      const webhookUpdate = secretUpdate(webhookUrl)
      const signingSecretUpdate = secretUpdate(signingSecret)
      const saved = await window.electronAPI.feishu.configure({
        ...(webhookUpdate !== undefined ? { webhookUrl: webhookUpdate } : {}),
        ...(removeSigningSecret
          ? { signingSecret: null }
          : signingSecretUpdate !== undefined
            ? { signingSecret: signingSecretUpdate }
            : {}),
      })
      try {
        return { status: await window.electronAPI.feishu.test() }
      } catch (error) {
        return { status: saved, testError: getErrorMessage(error) }
      }
    },
    onSuccess: ({ status, testError }) => {
      queryClient.setQueryData(['feishu-status'], status)
      setWebhookUrl(secretFromMask(status.webhookUrlMasked))
      setSigningSecret(secretFromMask(status.signingSecretMasked))
      setRemoveSigningSecret(false)
      setFeishuTestError(testError)
      if (testError) {
        showErrorToast(`飞书配置已保存，但连接测试失败：${testError}`)
      } else {
        showSuccessToast('飞书配置已保存，连接正常')
      }
    },
    onError: (error) => showErrorToast(getErrorMessage(error)),
  })
  const feishuTest = useMutation({
    mutationFn: () => window.electronAPI.feishu.test(),
    onSuccess: (status) => {
      queryClient.setQueryData(['feishu-status'], status)
      setFeishuTestError(undefined)
      showSuccessToast('飞书连接正常')
    },
    onError: (error) => {
      const message = getErrorMessage(error)
      setFeishuTestError(message)
      showErrorToast(message)
    },
  })
  const clear = useMutation({
    mutationFn: (target: Exclude<ClearTarget, undefined>) =>
      target === 'ai' ? window.electronAPI.ai.clear() : window.electronAPI.feishu.clear(),
    onSuccess: (status, target) => {
      queryClient.setQueryData([`${target}-status`], status)
      if (target === 'ai') {
        setProvider('openai')
        setAccepted(false)
        setApiKey(emptySecret())
        setAiTestError(undefined)
      } else {
        setWebhookUrl(emptySecret())
        setSigningSecret(emptySecret())
        setRemoveSigningSecret(false)
        setFeishuTestError(undefined)
      }
      setClearTarget(undefined)
      showSuccessToast(target === 'ai' ? 'AI 配置已清除' : '飞书配置已清除')
    },
    onError: (error) => showErrorToast(getErrorMessage(error)),
  })

  const revealAi = async () => {
    if (apiKey.mode === 'editing') {
      if (
        apiKey.visible &&
        !apiKey.replacement &&
        apiKey.value === apiKey.originalValue
      ) {
        setApiKey(secretFromMask(aiStatus.apiKeyMasked))
        return
      }
      setApiKey({ ...apiKey, visible: !apiKey.visible })
      return
    }
    setRevealing('apiKey')
    try {
      const { value } = await window.electronAPI.ai.reveal()
      setApiKey({ mode: 'editing', value, originalValue: value, replacement: false, visible: true })
    } catch (error) {
      showErrorToast(getErrorMessage(error))
    } finally {
      setRevealing(undefined)
    }
  }
  const revealFeishu = async (
    field: 'webhookUrl' | 'signingSecret',
    state: SecretEditorState,
    setState: (value: SecretEditorState) => void
  ) => {
    if (state.mode === 'editing') {
      if (state.visible && !state.replacement && state.value === state.originalValue) {
        setState(
          secretFromMask(
            field === 'webhookUrl'
              ? feishuStatus.webhookUrlMasked
              : feishuStatus.signingSecretMasked
          )
        )
        return
      }
      setState({ ...state, visible: !state.visible })
      return
    }
    setRevealing(field)
    try {
      const { value } = await window.electronAPI.feishu.reveal(field)
      setState({ mode: 'editing', value, originalValue: value, replacement: false, visible: true })
    } catch (error) {
      showErrorToast(getErrorMessage(error))
    } finally {
      setRevealing(undefined)
    }
  }

  const changeProvider = (next: AiProvider) => {
    setProvider(next)
    setAiTestError(undefined)
    if (next === aiStatus.provider) {
      setAccepted(aiStatus.configured)
      setApiKey(secretFromMask(aiStatus.apiKeyMasked))
      return
    }
    setAccepted(false)
    setApiKey(emptySecret())
  }
  const resetAi = () => {
    setProvider(aiStatus.provider ?? 'openai')
    setAccepted(aiStatus.configured)
    setApiKey(secretFromMask(aiStatus.apiKeyMasked))
    setAiTestError(undefined)
  }
  const resetFeishu = () => {
    setWebhookUrl(secretFromMask(feishuStatus.webhookUrlMasked))
    setSigningSecret(secretFromMask(feishuStatus.signingSecretMasked))
    setRemoveSigningSecret(false)
    setFeishuTestError(undefined)
  }
  const requestClear = (target: Exclude<ClearTarget, undefined>) => {
    if ((target === 'ai' && aiDirty) || (target === 'feishu' && feishuDirty)) {
      showWarningToast('请先保存或取消当前修改，再清除配置。')
      return
    }
    setClearTarget(target)
  }

  const aiNeedsKey = !aiStatus.configured || provider !== aiStatus.provider
  const aiKeyValue = apiKey.mode === 'editing' ? apiKey.value.trim() : ''
  const webhookValue = webhookUrl.mode === 'editing' ? webhookUrl.value.trim() : ''
  const aiSecretDirty = secretIsDirty(apiKey, aiStatus.configured)
  const webhookSecretDirty = secretIsDirty(webhookUrl, feishuStatus.configured)
  const signingSecretDirty = secretIsDirty(signingSecret, Boolean(feishuStatus.signingEnabled))
  const signingSecretValue = signingSecret.mode === 'editing' ? signingSecret.value.trim() : ''
  const aiBusy = aiSave.isPending || aiTest.isPending || clear.isPending
  const feishuBusy = feishuSave.isPending || feishuTest.isPending || clear.isPending

  return (
    <div className='space-y-5'>
      <Card>
        <CardHeader>
          <CardHeading
            icon={<Bot />}
            title='AI 生成'
            desc='选择供应商并填写 API 密钥，其他参数由应用自动管理。'
            status={<Status status={aiStatus} dirty={aiDirty} failed={Boolean(aiTestError)} />}
          />
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label>供应商</Label>
              <Select value={provider} onValueChange={(value) => changeProvider(value as AiProvider)} disabled={aiBusy}>
                <SelectTrigger className='w-full'><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='openai'>OpenAI</SelectItem>
                  <SelectItem value='deepseek'>DeepSeek</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <SecretField
              id='ai-key'
              label='API 密钥'
              state={apiKey}
              maskedValue={aiStatus.apiKeyMasked}
              disabled={aiBusy}
              revealing={revealing === 'apiKey'}
              onChange={(value) => setApiKey(updateSecretValue(apiKey, value))}
              onToggleReveal={() => void revealAi()}
              onReplace={() => setApiKey(emptySecret())}
              onCancelReplace={() => setApiKey(secretFromMask(aiStatus.apiKeyMasked))}
            />
          </div>
          <Alert>
            <AlertTitle>发送给模型的数据</AlertTitle>
            <AlertDescription>仓库名、分支、提交哈希、时间、标题、正文、作者姓名和你填写的补充背景。不会主动包含作者邮箱、仓库地址、本地路径或代码差异；提交文本和补充背景中的内容会原样发送。</AlertDescription>
          </Alert>
          <label className='flex items-start gap-2 text-sm'>
            <Checkbox checked={accepted} onCheckedChange={(value) => setAccepted(value === true)} disabled={aiBusy} />
            <span>我已了解并同意在生成报告时将上述数据发送给所选供应商。</span>
          </label>
          {aiTestError && <TestError message={aiTestError} />}
          <div className='flex flex-wrap justify-end gap-2'>
            {aiStatus.configured && <Button variant='ghost' onClick={() => requestClear('ai')} disabled={aiBusy}><Trash2 />清除配置</Button>}
            {aiDirty && <Button variant='outline' onClick={resetAi} disabled={aiBusy}><RotateCcw />取消修改</Button>}
            {aiStatus.configured && !aiDirty && <Button variant='outline' onClick={() => aiTest.mutate()} disabled={aiBusy}>{aiTest.isPending ? <Loader2 className='animate-spin' /> : <CheckCircle2 />}重新测试</Button>}
            <Button onClick={() => aiSave.mutate()} disabled={!aiDirty || !accepted || (aiNeedsKey && !aiKeyValue) || (aiSecretDirty && !aiKeyValue) || aiBusy}>{aiSave.isPending && <Loader2 className='animate-spin' />}保存并测试</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardHeading
            icon={<Send />}
            title='飞书推送'
            desc='配置一个飞书群自定义机器人，签名密钥为可选项。'
            status={<Status status={feishuStatus} dirty={feishuDirty} failed={Boolean(feishuTestError)} />}
          />
        </CardHeader>
        <CardContent className='space-y-4'>
          <SecretField
            id='feishu-webhook'
            label='机器人 Webhook'
            state={webhookUrl}
            maskedValue={feishuStatus.webhookUrlMasked}
            disabled={feishuBusy}
            revealing={revealing === 'webhookUrl'}
            placeholder='https://open.feishu.cn/open-apis/bot/v2/hook/...'
            onChange={(value) => setWebhookUrl(updateSecretValue(webhookUrl, value))}
            onToggleReveal={() => void revealFeishu('webhookUrl', webhookUrl, setWebhookUrl)}
            onReplace={() => setWebhookUrl(emptySecret())}
            onCancelReplace={() => setWebhookUrl(secretFromMask(feishuStatus.webhookUrlMasked))}
          />
          <SecretField
            id='feishu-secret'
            label='签名密钥（可选）'
            state={signingSecret}
            maskedValue={feishuStatus.signingSecretMasked}
            disabled={feishuBusy || removeSigningSecret}
            revealing={revealing === 'signingSecret'}
            onChange={(value) => setSigningSecret(updateSecretValue(signingSecret, value))}
            onToggleReveal={() => void revealFeishu('signingSecret', signingSecret, setSigningSecret)}
            onReplace={() => setSigningSecret(emptySecret())}
            onCancelReplace={() => setSigningSecret(secretFromMask(feishuStatus.signingSecretMasked))}
          />
          {feishuStatus.signingEnabled && !removeSigningSecret && (
            <div className='flex justify-end'><Button variant='link' className='h-auto p-0 text-destructive' onClick={() => setConfirmSecretRemoval(true)} disabled={feishuBusy}>移除签名密钥</Button></div>
          )}
          {removeSigningSecret && (
            <Alert variant='destructive'>
              <AlertTitle>保存后移除签名密钥</AlertTitle>
              <AlertDescription className='flex items-center justify-between gap-3'>
                <span>当前机器人将改为无签名方式调用。</span>
                <Button variant='outline' size='sm' onClick={() => setRemoveSigningSecret(false)}>取消移除</Button>
              </AlertDescription>
            </Alert>
          )}
          {feishuTestError && <TestError message={feishuTestError} />}
          <div className='flex flex-wrap justify-end gap-2'>
            {feishuStatus.configured && <Button variant='ghost' onClick={() => requestClear('feishu')} disabled={feishuBusy}><Trash2 />清除配置</Button>}
            {feishuDirty && <Button variant='outline' onClick={resetFeishu} disabled={feishuBusy}><RotateCcw />取消修改</Button>}
            {feishuStatus.configured && !feishuDirty && <Button variant='outline' onClick={() => feishuTest.mutate()} disabled={feishuBusy}>{feishuTest.isPending ? <Loader2 className='animate-spin' /> : <CheckCircle2 />}重新测试</Button>}
            <Button onClick={() => feishuSave.mutate()} disabled={!feishuDirty || (!feishuStatus.configured && !webhookValue) || (webhookSecretDirty && !webhookValue) || (signingSecretDirty && !signingSecretValue && !removeSigningSecret) || feishuBusy}>{feishuSave.isPending && <Loader2 className='animate-spin' />}保存并测试</Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(clearTarget)}
        onOpenChange={(open) => !open && setClearTarget(undefined)}
        title={clearTarget === 'ai' ? '清除 AI 配置？' : '清除飞书配置？'}
        desc={clearTarget === 'ai' ? '清除后，现有报告任务不会被修改，但后续报告生成会失败，直到重新配置并测试 AI。' : '清除后，现有报告任务不会被修改，但启用了飞书推送的任务会在推送阶段失败。'}
        cancelBtnText='取消'
        confirmText='确认清除'
        destructive
        isLoading={clear.isPending}
        handleConfirm={() => clearTarget && clear.mutate(clearTarget)}
      />
      <ConfirmDialog
        open={confirmSecretRemoval}
        onOpenChange={setConfirmSecretRemoval}
        title='移除飞书签名密钥？'
        desc='确认后会标记为待移除，只有点击“保存并测试”才会真正写入配置。'
        cancelBtnText='取消'
        confirmText='标记为待移除'
        destructive
        handleConfirm={() => {
          setRemoveSigningSecret(true)
          setSigningSecret(secretFromMask(feishuStatus.signingSecretMasked))
          setConfirmSecretRemoval(false)
        }}
      />
    </div>
  )
}

function SecretField({ id, label, state, maskedValue, disabled, revealing, placeholder, onChange, onToggleReveal, onReplace, onCancelReplace }: { id: string; label: string; state: SecretEditorState; maskedValue?: string; disabled: boolean; revealing: boolean; placeholder?: string; onChange(value: string): void; onToggleReveal(): void; onReplace(): void; onCancelReplace(): void }) {
  const editing = state.mode === 'editing'
  return (
    <div className='space-y-2'>
      <Label htmlFor={id}>{label}</Label>
      <div className='flex gap-2'>
        <div className='relative min-w-0 flex-1'>
          <Input id={id} type={!editing || state.visible ? 'text' : 'password'} value={editing ? state.value : (maskedValue ?? '')} readOnly={!editing} disabled={disabled} placeholder={placeholder} className='pe-10' onChange={(event) => onChange(event.target.value)} />
          <Button type='button' size='icon' variant='ghost' className='absolute inset-e-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground' disabled={disabled || revealing} onClick={onToggleReveal} aria-label={editing && state.visible ? `隐藏${label}` : `查看${label}`}>
            {revealing ? <Loader2 className='animate-spin' /> : editing && state.visible ? <EyeOff /> : <Eye />}
          </Button>
        </div>
        {maskedValue && state.mode === 'masked' && <Button type='button' variant='outline' onClick={onReplace} disabled={disabled}>替换</Button>}
        {maskedValue && editing && state.replacement && <Button type='button' variant='outline' onClick={onCancelReplace} disabled={disabled}>取消替换</Button>}
      </div>
    </div>
  )
}

function CardHeading({ icon, title, desc, status }: { icon: React.ReactNode; title: string; desc: string; status: React.ReactNode }) {
  return <div className='flex items-start justify-between gap-3'><div><CardTitle className='flex items-center gap-2'>{icon}{title}</CardTitle><CardDescription>{desc}</CardDescription></div>{status}</div>
}

function Status({ status, dirty, failed }: { status?: SecretConfigurationStatus; dirty: boolean; failed: boolean }) {
  if (dirty) return <Badge variant='outline'>有未保存修改</Badge>
  if (!status?.configured) return <Badge variant='outline'>未配置</Badge>
  if (failed) return <Badge variant='destructive'>测试失败</Badge>
  return status.testedAt ? <Badge variant='secondary'>连接正常</Badge> : <Badge variant='outline'>尚未测试</Badge>
}

function TestError({ message }: { message: string }) {
  return <Alert variant='destructive'><AlertTitle>无法连接</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>
}

function Loading() {
  return <div className='flex items-center gap-2 rounded-lg border p-6 text-sm text-muted-foreground'><Loader2 className='animate-spin' />正在读取 AI 与推送配置…</div>
}

function emptySecret(): SecretEditorState {
  return { mode: 'editing', value: '', replacement: true, visible: false }
}

function secretFromMask(masked?: string): SecretEditorState {
  return masked ? { mode: 'masked' } : emptySecret()
}

function updateSecretValue(state: SecretEditorState, value: string): SecretEditorState {
  return state.mode === 'editing' ? { ...state, value } : state
}

function secretIsDirty(state: SecretEditorState, configured: boolean): boolean {
  if (state.mode === 'masked') return false
  if (!configured || state.replacement) return Boolean(state.value.trim())
  return state.value !== state.originalValue
}

function secretUpdate(state: SecretEditorState): string | undefined {
  if (state.mode !== 'editing' || !secretIsDirty(state, Boolean(state.originalValue))) return undefined
  return state.value.trim()
}
