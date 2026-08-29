import {
  Activity,
  Bot,
  CalendarClock,
  FileText,
  FolderGit2,
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
        { title: '运行历史', url: '/runs', icon: Activity },
      ],
    },
    {
      title: '系统',
      items: [
        { title: '设置', url: '/settings', icon: Settings2 },
        { title: 'AI 与推送', url: '/settings/automation', icon: Bot },
        { title: '外观', url: '/settings/appearance', icon: Palette },
      ],
    },
  ],
}
