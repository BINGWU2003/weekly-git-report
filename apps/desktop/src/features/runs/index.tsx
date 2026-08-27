import { Activity, Clock3 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'

export function Runs() {
  return (
    <>
      <Header>
        <div className='me-auto text-sm font-medium'>任务执行记录</div>
        <ThemeSwitch />
      </Header>
      <Main className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>运行历史</h1>
          <p className='text-muted-foreground'>查看采集、LLM 总结和飞书推送的执行状态。</p>
        </div>
        <Card className='border-dashed'>
          <CardHeader className='items-center text-center'>
            <div className='mb-2 rounded-full bg-muted p-3'>
              <Activity className='size-6 text-muted-foreground' />
            </div>
            <CardTitle>还没有桌面任务运行记录</CardTitle>
            <CardDescription>SQLite 调度与运行记录将在任务执行阶段接入。</CardDescription>
          </CardHeader>
          <CardContent className='flex justify-center text-sm text-muted-foreground'>
            <Clock3 className='me-2 size-4' />
            CLI 生成的 Markdown 已可在“报告库”中查看
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
