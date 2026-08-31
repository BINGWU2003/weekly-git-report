import { Outlet, useLocation } from '@tanstack/react-router'
import { Bot, FilePenLine, Info, Palette, Settings2 } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { SidebarNav } from './components/sidebar-nav'

const sidebarNavItems = [
  { title: '常规设置', href: '/settings', icon: <Settings2 size={18} /> },
  { title: '报告模板', href: '/settings/template', icon: <FilePenLine size={18} /> },
  { title: 'AI 与推送', href: '/settings/automation', icon: <Bot size={18} /> },
  { title: '关于与更新', href: '/settings/about', icon: <Info size={18} /> },
  { title: '外观', href: '/settings/appearance', icon: <Palette size={18} /> },
]

export function Settings() {
  const { pathname } = useLocation()
  const page = settingsPageCopy(pathname)

  return (
    <>
      <Header>
        <div className='me-auto text-sm font-medium'>桌面应用设置</div>
        <ThemeSwitch />
      </Header>
      <Main fixed>
        <div className='space-y-0.5'>
          <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>{page.title}</h1>
          <p className='text-muted-foreground'>{page.description}</p>
        </div>
        <Separator className='my-4 lg:my-6' />
        <div className='flex flex-1 flex-col space-y-2 overflow-hidden lg:flex-row lg:space-y-0 lg:space-x-12'>
          <aside className='top-0 lg:sticky lg:w-1/5'>
            <SidebarNav items={sidebarNavItems} />
          </aside>
          <div className='flex w-full overflow-y-auto p-1'>
            <Outlet />
          </div>
        </div>
      </Main>
    </>
  )
}

function settingsPageCopy(pathname: string) {
  if (pathname === '/settings/template') {
    return {
      title: '报告模板',
      description: '设置日报、周报、月报和自定义报告的生成规则。',
    }
  }
  if (pathname === '/settings/automation') {
    return {
      title: 'AI 与推送',
      description: '配置报告生成服务、API 密钥和飞书机器人。',
    }
  }
  if (pathname === '/settings/about') {
    return { title: '关于与更新', description: '查看当前版本、更新状态和版本说明。' }
  }
  if (pathname === '/settings/appearance') {
    return { title: '外观', description: '选择应用字体和显示主题。' }
  }
  return {
    title: '常规设置',
    description: '管理报告目录、仓库缓存和 Git 作者身份。',
  }
}
