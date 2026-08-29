import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { DesktopAPI, SecretConfigurationStatus } from '../../../../shared/ipc'
import { AutomationConfig } from './index'

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }))

vi.mock('@/hooks/use-unsaved-changes', () => ({ useUnsavedChanges: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('AutomationConfig', () => {
  it('回填供应商与掩码，并只在查看指定字段时读取明文', async () => {
    const apiKey = 'sk-deepseek-example-1234'
    const webhookUrl = 'https://open.feishu.cn/open-apis/bot/v2/hook/example-5678'
    const signingSecret = 'signing-example-9012'
    const api = createApi({
      aiStatus: {
        configured: true,
        provider: 'deepseek',
        model: 'deepseek-chat',
        apiKeyMasked: 'sk-deep••••1234',
        testedAt: '2026-08-30T01:00:00.000Z',
      },
      feishuStatus: {
        configured: true,
        webhookUrlMasked: 'open.feishu.cn/••••5678',
        signingEnabled: true,
        signingSecretMasked: '••••9012',
      },
      apiKey,
      webhookUrl,
      signingSecret,
    })
    vi.stubGlobal('electronAPI', api)

    const screen = await renderAutomation()

    await expect.element(screen.getByRole('combobox')).toHaveTextContent('DeepSeek')
    await expect.element(screen.getByLabelText('API Key', { exact: true })).toHaveValue('sk-deep••••1234')
    await expect.element(screen.getByLabelText('Webhook', { exact: true })).toHaveValue('open.feishu.cn/••••5678')
    expect(api.ai.reveal).not.toHaveBeenCalled()
    expect(api.feishu.reveal).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: '查看Webhook' }))
    await expect.element(screen.getByLabelText('Webhook', { exact: true })).toHaveValue(webhookUrl)
    expect(api.feishu.reveal).toHaveBeenCalledWith('webhookUrl')
    expect(api.feishu.reveal).not.toHaveBeenCalledWith('signingSecret')

    await userEvent.click(screen.getByRole('button', { name: '查看API Key' }))
    await expect.element(screen.getByLabelText('API Key', { exact: true })).toHaveValue(apiKey)
    expect(api.ai.reveal).toHaveBeenCalledOnce()
  })

  it('移除签名密钥时以补丁保存，保留未修改的 Webhook', async () => {
    const tested: SecretConfigurationStatus = {
      configured: true,
      webhookUrlMasked: 'open.feishu.cn/••••5678',
      signingEnabled: false,
      testedAt: '2026-08-30T02:00:00.000Z',
    }
    const api = createApi({
      aiStatus: { configured: false },
      feishuStatus: {
        configured: true,
        webhookUrlMasked: 'open.feishu.cn/••••5678',
        signingEnabled: true,
        signingSecretMasked: '••••9012',
      },
      feishuConfigureResult: {
        configured: true,
        webhookUrlMasked: 'open.feishu.cn/••••5678',
        signingEnabled: false,
      },
      feishuTestResult: tested,
    })
    vi.stubGlobal('electronAPI', api)

    const screen = await renderAutomation()
    await userEvent.click(screen.getByRole('button', { name: '移除签名密钥' }))
    await userEvent.click(screen.getByRole('button', { name: '标记为待移除' }))
    await expect.element(screen.getByText('保存后移除签名密钥')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: '保存并测试' }).last())

    await vi.waitFor(() => {
      expect(api.feishu.configure).toHaveBeenCalledWith({ signingSecret: null })
      expect(api.feishu.test).toHaveBeenCalledOnce()
    })
    expect(api.feishu.reveal).not.toHaveBeenCalled()
  })

  it('保存成功但测试失败时保留新配置并显示失败状态', async () => {
    const api = createApi({
      aiStatus: {
        configured: true,
        provider: 'openai',
        apiKeyMasked: 'sk-old-••••1234',
        testedAt: '2026-08-30T01:00:00.000Z',
      },
      aiConfigureResult: {
        configured: true,
        provider: 'openai',
        apiKeyMasked: 'sk-new-••••5678',
      },
      aiTestError: new Error('认证失败'),
      feishuStatus: { configured: false },
    })
    vi.stubGlobal('electronAPI', api)

    const screen = await renderAutomation()
    await userEvent.click(screen.getByRole('button', { name: '替换' }).first())
    await userEvent.fill(screen.getByLabelText('API Key', { exact: true }), 'sk-new-example-5678')
    await userEvent.click(screen.getByRole('button', { name: '保存并测试' }).first())

    await vi.waitFor(() => {
      expect(api.ai.configure).toHaveBeenCalledWith({
        provider: 'openai',
        apiKey: 'sk-new-example-5678',
        dataSharingAccepted: true,
      })
      expect(toast.error).toHaveBeenCalledWith('AI 配置已保存，但连接测试失败：认证失败')
    })
    await expect.element(screen.getByText('测试失败', { exact: true })).toBeVisible()
    await expect.element(screen.getByLabelText('API Key', { exact: true })).toHaveValue('sk-new-••••5678')
  })
})

async function renderAutomation() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AutomationConfig />
    </QueryClientProvider>
  )
}

function createApi({
  aiStatus,
  feishuStatus,
  apiKey = 'sk-example-1234',
  webhookUrl = 'https://open.feishu.cn/example-5678',
  signingSecret = 'signing-example-9012',
  aiConfigureResult = aiStatus,
  aiTestError,
  feishuConfigureResult = feishuStatus,
  feishuTestResult = feishuStatus,
}: {
  aiStatus: SecretConfigurationStatus
  feishuStatus: SecretConfigurationStatus
  apiKey?: string
  webhookUrl?: string
  signingSecret?: string
  aiConfigureResult?: SecretConfigurationStatus
  aiTestError?: Error
  feishuConfigureResult?: SecretConfigurationStatus
  feishuTestResult?: SecretConfigurationStatus
}) {
  const aiTest = aiTestError
    ? vi.fn().mockRejectedValue(aiTestError)
    : vi.fn().mockResolvedValue(aiStatus)
  return {
    ai: {
      status: vi.fn().mockResolvedValue(aiStatus),
      reveal: vi.fn().mockResolvedValue({ value: apiKey }),
      configure: vi.fn().mockResolvedValue(aiConfigureResult),
      test: aiTest,
      clear: vi.fn().mockResolvedValue({ configured: false }),
    },
    feishu: {
      status: vi.fn().mockResolvedValue(feishuStatus),
      reveal: vi.fn().mockImplementation((field: 'webhookUrl' | 'signingSecret') =>
        Promise.resolve({ value: field === 'webhookUrl' ? webhookUrl : signingSecret })
      ),
      configure: vi.fn().mockResolvedValue(feishuConfigureResult),
      test: vi.fn().mockResolvedValue(feishuTestResult),
      clear: vi.fn().mockResolvedValue({ configured: false }),
    },
  } as unknown as DesktopAPI
}
