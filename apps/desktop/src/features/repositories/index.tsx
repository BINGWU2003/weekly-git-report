import { useQuery } from '@tanstack/react-query'
import { AlertCircle, GitBranch, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function Repositories() {
  const projects = useQuery({
    queryKey: ['projects'],
    queryFn: () => window.electronAPI.projects.list(),
  })

  return (
    <>
      <Header>
        <div className='me-auto'>
          <p className='text-sm font-medium'>共享仓库配置</p>
          <p className='text-xs text-muted-foreground'>来源：~/.weekly-git-report/projects.json</p>
        </div>
        <ThemeSwitch />
      </Header>
      <Main className='space-y-6'>
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>仓库</h1>
            <p className='text-muted-foreground'>查看 CLI 与桌面端共同使用的 Git 仓库。</p>
          </div>
          <Button
            variant='outline'
            onClick={() => projects.refetch()}
            disabled={projects.isFetching}
          >
            <RefreshCw className={projects.isFetching ? 'animate-spin' : ''} />
            重新读取
          </Button>
        </div>

        {projects.isError && (
          <Alert variant='destructive'>
            <AlertCircle />
            <AlertTitle>无法读取仓库配置</AlertTitle>
            <AlertDescription>{getErrorMessage(projects.error)}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent>
            <Table >
              <TableHeader>
                <TableRow>
                  <TableHead>仓库</TableHead>
                  <TableHead>分支</TableHead>
                  <TableHead>作者</TableHead>
                  <TableHead>缓存目录</TableHead>
                  <TableHead className='text-center'>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.data?.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className='max-w-xs'>
                      <p className='font-medium'>{project.name}</p>
                      <p className='truncate text-xs text-muted-foreground' title={project.url}>
                        {project.url}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className='inline-flex items-center gap-1.5'>
                        <GitBranch className='size-3.5 text-muted-foreground' />
                        {project.branch}
                      </span>
                    </TableCell>
                    <TableCell>
                      {project.authors?.length
                        ? project.authors.map((author) => author.email).join(', ')
                        : '继承全局身份'}
                    </TableCell>
                    <TableCell className='max-w-xs truncate text-xs text-muted-foreground'>
                      <span title={project.localPath}>{project.localPath}</span>
                    </TableCell>
                    <TableCell className='text-center'>
                      {project.enabled ? (
                        <Badge variant='secondary'>已启用</Badge>
                      ) : (
                        <Badge variant='outline'>已停用</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!projects.isLoading && projects.data?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className='h-32 text-center text-muted-foreground'>
                      还没有仓库。当前可先通过 CLI 添加，桌面编辑能力将在下一阶段接入。
                    </TableCell>
                  </TableRow>
                )}
                {projects.isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className='h-32 text-center text-muted-foreground'>
                      正在读取仓库…
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
