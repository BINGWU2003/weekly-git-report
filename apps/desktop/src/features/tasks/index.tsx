import { CalendarClock, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'

export function Tasks() {
  return (
    <>
      <Header>
        <div className='me-auto text-sm font-medium'>Electron 专属自动化</div>
        <ThemeSwitch />
      </Header>
      <Main className='space-y-6'>
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>报告任务</h1>
            <p className='text-muted-foreground'>配置周期、仓库、LLM 和飞书推送。</p>
          </div>
          <Button disabled>
            <Plus />
            新建任务
          </Button>
        </div>
        <Card className='border-dashed'>
          <CardHeader className='items-center py-14 text-center'>
            <div className='mb-2 rounded-full bg-muted p-3'>
              <CalendarClock className='size-6 text-muted-foreground' />
            </div>
            <CardTitle>自动任务即将接入</CardTitle>
            <CardDescription className='max-w-lg'>
              当前阶段先打通共享配置、仓库和报告读取。下一阶段会加入 tasks.json、周期计算和手动运行。
            </CardDescription>
          </CardHeader>
        </Card>
      </Main>
    </>
  )
}
