import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { OverflowTooltip } from './overflow-tooltip'

const longText = 'D:/repositories/a-very-long-project-name/with/a/deeply/nested/path'

describe('OverflowTooltip', () => {
  it('does not enable the tooltip when text fits', async () => {
    const screen = await render(
      <OverflowTooltip
        text='短文本'
        data-testid='text'
        style={{ display: 'block', width: 320, overflow: 'hidden', whiteSpace: 'nowrap' }}
      />
    )

    const text = screen.getByTestId('text')
    await expect.element(text).not.toHaveAttribute('data-overflow')
    await expect.element(text).not.toHaveAttribute('tabindex')
  })

  it('shows the complete text on hover and supports keyboard focus when truncated', async () => {
    const screen = await render(
      <OverflowTooltip
        text={longText}
        data-testid='text'
        monospace
        style={{ display: 'block', width: 64, overflow: 'hidden', whiteSpace: 'nowrap' }}
      />
    )

    const text = screen.getByTestId('text')
    await expect.element(text).toHaveAttribute('data-overflow', 'true')
    await expect.element(text).toHaveAttribute('tabindex', '0')

    await userEvent.hover(text)
    await expect.element(screen.getByRole('tooltip')).toHaveTextContent(longText)

    await userEvent.unhover(text)
    await userEvent.tab()
    await expect.element(text).toHaveFocus()
    await expect.element(screen.getByRole('tooltip')).toHaveTextContent(longText)
  })

  it('remeasures when the available width changes', async () => {
    function ResizableExample() {
      const [width, setWidth] = useState(64)

      return (
        <>
          <button type='button' onClick={() => setWidth(640)}>展开</button>
          <OverflowTooltip
            text={longText}
            data-testid='text'
            style={{ display: 'block', width, overflow: 'hidden', whiteSpace: 'nowrap' }}
          />
        </>
      )
    }

    const screen = await render(<ResizableExample />)
    const text = screen.getByTestId('text')

    await expect.element(text).toHaveAttribute('data-overflow', 'true')
    await userEvent.click(screen.getByRole('button', { name: '展开' }))
    await expect.element(text).not.toHaveAttribute('data-overflow')
    await expect.element(text).not.toHaveAttribute('tabindex')
  })
})
