import { type ImgHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Logo({
  className,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}images/favicon.png`}
      alt=''
      aria-hidden='true'
      draggable={false}
      className={cn('size-6', className)}
      {...props}
    />
  )
}
