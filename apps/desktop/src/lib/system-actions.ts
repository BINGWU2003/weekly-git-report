import { toast } from 'sonner'
import { getErrorMessage } from './errors'

export async function openOutputRoot(): Promise<void> {
  try {
    const errorMessage = await window.electronAPI.system.openOutputRoot()
    if (errorMessage) toast.error(`打开报告目录失败：${errorMessage}`)
  } catch (error) {
    toast.error(`打开报告目录失败：${getErrorMessage(error)}`)
  }
}

export async function showReportInFolder(reportId: string): Promise<void> {
  try {
    await window.electronAPI.reports.showInFolder(reportId)
  } catch (error) {
    toast.error(`定位报告失败：${getErrorMessage(error)}`)
  }
}

export async function selectSystemDirectory(initialPath?: string): Promise<string | null> {
  try {
    return await window.electronAPI.system.selectDirectory(initialPath)
  } catch (error) {
    toast.error(`选择目录失败：${getErrorMessage(error)}`)
    return null
  }
}
