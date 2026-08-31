import { useState } from 'react'
import { expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { AiProvider } from '@weekly-git-report/shared'
import { AiConnectionFields, initialAiBaseUrl } from './ai-connection-fields'

it('从一致风格的组合框选择推荐模型', async () => {
  const screen = await render(<TestFields provider='openai' />)

  await userEvent.click(screen.getByLabelText('模型'))
  await expect.element(screen.getByText('推荐模型')).toBeVisible()
  await userEvent.click(screen.getByRole('option', { name: 'gpt-5.4-mini' }))

  await expect.element(screen.getByLabelText('模型')).toHaveTextContent('gpt-5.4-mini')
})

it('提供并允许选择 DeepSeek Pro 模型', async () => {
  const screen = await render(<TestFields provider='deepseek' />)

  await userEvent.click(screen.getByLabelText('模型'))
  await userEvent.click(screen.getByRole('option', { name: 'deepseek-v4-pro' }))

  await expect.element(screen.getByLabelText('模型')).toHaveTextContent('deepseek-v4-pro')
})

it('允许搜索并确认任意自定义模型 ID', async () => {
  const screen = await render(<TestFields provider='custom' />)

  await userEvent.click(screen.getByLabelText('模型'))
  await userEvent.fill(screen.getByPlaceholder('搜索或输入模型 ID…'), 'qwen3:8b')
  await userEvent.click(screen.getByRole('option', { name: '使用“qwen3:8b”' }))

  await expect.element(screen.getByLabelText('模型')).toHaveTextContent('qwen3:8b')
})

function TestFields({ provider }: { provider: AiProvider }) {
  const [model, setModel] = useState('')
  return (
    <AiConnectionFields
      idPrefix='test-ai'
      provider={provider}
      baseUrl={initialAiBaseUrl(provider)}
      model={model}
      onProviderChange={() => undefined}
      onBaseUrlChange={() => undefined}
      onModelChange={setModel}
    />
  )
}
