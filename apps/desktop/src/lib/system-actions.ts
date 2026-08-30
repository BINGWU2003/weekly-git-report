import { getErrorMessage } from './errors'
import { showErrorToast } from './toast'

export async function openOutputRoot(): Promise<void> {
  try {
    const errorMessage = await window.electronAPI.system.openOutputRoot()
    if (errorMessage) showErrorToast(`无法打开报告目录：${errorMessage}`)
  } catch (error) {
    showErrorToast(`无法打开报告目录：${getErrorMessage(error)}`)
  }
}

export async function showReportInFolder(reportId: string): Promise<void> {
  try {
    await window.electronAPI.reports.showInFolder(reportId)
  } catch (error) {
    showErrorToast(`无法定位报告文件：${getErrorMessage(error)}`)
  }
}

export async function selectSystemDirectory(initialPath?: string): Promise<string | null> {
  try {
    return await window.electronAPI.system.selectDirectory(initialPath)
  } catch (error) {
    showErrorToast(`无法选择目录：${getErrorMessage(error)}`)
    return null
  }
}
