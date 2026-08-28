import { type SVGProps } from 'react'
import { cn } from '@/lib/utils'

export function Logo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      id='weekly-git-report-logo'
      viewBox='0 0 64 64'
      xmlns='http://www.w3.org/2000/svg'
      height='24'
      width='24'
      fill='none'
      stroke='currentColor'
      strokeWidth='3.5'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
      focusable='false'
      className={cn('size-6', className)}
      {...props}
    >
      <rect x='7' y='11' width='50' height='47' rx='6' />
      <path d='M7 23 H57 M18 6 V16 M46 6 V16' />
      <path d='M21 34 V47 M24 40 H34 C39 40 43 36 43 31' />
      <circle cx='21' cy='31' r='3' />
      <circle cx='21' cy='50' r='3' />
      <circle cx='43' cy='28' r='3' />
    </svg>
  )
}
