import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type OverflowTooltipProps = Omit<ComponentProps<'span'>, 'children' | 'content'> & {
  text: string
  content?: ReactNode
  contentClassName?: string
  focusable?: boolean
  lines?: 1 | 2
  monospace?: boolean
}

export function OverflowTooltip({
  text,
  content = text,
  className,
  contentClassName,
  focusable = true,
  lines = 1,
  monospace = false,
  ...props
}: OverflowTooltipProps) {
  const elementRef = useRef<HTMLSpanElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  const measure = useCallback(() => {
    const element = elementRef.current
    if (!element) return

    const next =
      element.scrollWidth > element.clientWidth + 1 ||
      element.scrollHeight > element.clientHeight + 1
    setIsOverflowing((current) => (current === next ? current : next))
  }, [])

  useLayoutEffect(() => {
    measure()
  })

  useLayoutEffect(() => {
    const element = elementRef.current
    if (!element) return

    let active = true
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    const fontsReady = document.fonts?.ready
    if (fontsReady) {
      void fontsReady.then(() => {
        if (active) measure()
        return undefined
      })
    }

    return () => {
      active = false
      observer.disconnect()
    }
  }, [measure])

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <span
          ref={elementRef}
          tabIndex={isOverflowing && focusable ? 0 : undefined}
          data-overflow={isOverflowing || undefined}
          className={cn(
            'min-w-0 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            lines === 1 ? 'block truncate' : 'line-clamp-2',
            className
          )}
          {...props}
        >
          {text}
        </span>
      </TooltipTrigger>
      {isOverflowing ? (
        <TooltipContent
          sideOffset={4}
          className={cn(
            'max-w-[min(36rem,calc(100vw-2rem))] whitespace-normal text-start [overflow-wrap:anywhere]',
            monospace && 'font-mono',
            contentClassName
          )}
        >
          {content}
        </TooltipContent>
      ) : null}
    </Tooltip>
  )
}
