import {
  Activity,
  Bot,
  CalendarClock,
  FilePenLine,
  FileText,
  FolderGit2,
  Info,
  LayoutDashboard,
  Palette,
  Settings2,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  navGroups: [
    {
      title: '工作台',
      items: [
        { title: '总览', url: '/', icon: LayoutDashboard },
        { title: '仓库', url: '/repositories', icon: FolderGit2 },
        { title: '报告任务', url: '/tasks', icon: CalendarClock },
        { title: '报告库', url: '/reports', icon: FileText },
        { title: '执行记录', url: '/runs', icon: Activity },
      ],
    },
    {
      title: '系统',
      items: [
        { title: '常规设置', url: '/settings', icon: Settings2 },
        { title: '报告模板', url: '/settings/template', icon: FilePenLine },
        { title: 'AI 与推送', url: '/settings/automation', icon: Bot },
        { title: '关于与更新', url: '/settings/about', icon: Info },
        { title: '外观', url: '/settings/appearance', icon: Palette },
      ],
    },
  ],
}
