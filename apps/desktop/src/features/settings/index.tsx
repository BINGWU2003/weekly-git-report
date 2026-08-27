import { Outlet } from '@tanstack/react-router'
import { Palette, Settings2 } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { SidebarNav } from './components/sidebar-nav'

const sidebarNavItems = [
  { title: '常规', href: '/settings', icon: <Settings2 size={18} /> },
  { title: '外观', href: '/settings/appearance', icon: <Palette size={18} /> },
]

export function Settings() {
  return (
    <>
      <Header>
        <div className='me-auto text-sm font-medium'>桌面应用配置</div>
        <ThemeSwitch />
      </Header>
      <Main fixed>
        <div className='space-y-0.5'>
          <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>设置</h1>
          <p className='text-muted-foreground'>管理共享配置和桌面界面偏好。</p>
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
