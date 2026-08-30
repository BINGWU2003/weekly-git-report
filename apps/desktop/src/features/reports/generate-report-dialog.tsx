import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ReportFile } from '../../../shared/ipc'
import { ReportGenerationPanel } from './report-generation-panel'

export function GenerateReportDialog({
  open,
  onOpenChange,
  onSaved,
  initialReport,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  onSaved(): void
  initialReport?: ReportFile
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className='h-[min(54rem,calc(100vh-2rem))] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{initialReport ? '重新生成报告' : '生成报告'}</DialogTitle>
          <DialogDescription>
            每次都会重新同步和采集。AI 生成的内容会先保存为草稿，确认后才会加入报告库。
          </DialogDescription>
        </DialogHeader>
        <div data-testid='report-dialog-body' className='min-h-0 overflow-hidden'>
          <ReportGenerationPanel
            fixedHeight
            initialReport={initialReport}
            onSaved={() => {
              onSaved()
              onOpenChange(false)
            }}
            onClose={() => onOpenChange(false)}
            onBusyChange={setBusy}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
