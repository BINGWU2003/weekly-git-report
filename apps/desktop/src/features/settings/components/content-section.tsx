import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type ContentSectionProps = {
  title: string
  desc: string
  children: React.ReactNode
  contentClassName?: string
}

export function ContentSection({ title, desc, children, contentClassName }: ContentSectionProps) {
  return (
    <div className='flex flex-1 flex-col'>
      <div className='flex-none'>
        <h3 className='text-lg font-medium'>{title}</h3>
        <p className='text-sm text-muted-foreground'>{desc}</p>
      </div>
      <Separator className='my-4 flex-none' />
      <div className='h-full w-full overflow-y-auto scroll-smooth pe-4 pb-12'>
        <div className={cn('-mx-1 px-1.5 lg:max-w-xl', contentClassName)}>{children}</div>
      </div>
    </div>
  )
}
