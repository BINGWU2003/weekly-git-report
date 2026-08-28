import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, FolderSearch, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { RepositoryFolderScanResult, RepositoryProject } from '@weekly-git-report/shared'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { OverflowTooltip } from '@/components/overflow-tooltip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getErrorMessage } from '@/lib/errors'
import { showSuccessToast } from '@/lib/toast'
import type { ProjectsState } from '../../../shared/ipc'

type CandidateStatus = 'validating' | 'ready' | 'invalid' | 'importing' | 'added' | 'error'

interface ImportCandidate {
  sourcePath: string
  originUrl?: string
  project?: RepositoryProject
  status: CandidateStatus
  selected: boolean
  message?: string
}

interface RepositoryImportSheetProps {
  folder: string
  initialState: ProjectsState
  onImported(state: ProjectsState): void
  onOpenChange(open: boolean): void
  open: boolean
}

export function RepositoryImportSheet({
  folder,
  initialState,
  onImported,
  onOpenChange,
  open,
}: RepositoryImportSheetProps) {
  const [attempt, setAttempt] = useState(0)
  const [scan, setScan] = useState<RepositoryFolderScanResult>()
  const [candidates, setCandidates] = useState<ImportCandidate[]>([])
  const [validated, setValidated] = useState(0)
  const [scanError, setScanError] = useState<string>()
  const [scanning, setScanning] = useState(true)
  const [importing, setImporting] = useState(false)
  const [revision, setRevision] = useState(initialState.revision)

  useEffect(() => {
    if (!open) return
    let active = true

    async function scanAndValidate(expectedAttempt: number) {
      try {
        const result = await window.electronAPI.projects.scanFolder(folder)
        if (!active || expectedAttempt !== attempt) return
        setScan(result)
        const initial = result.repositories.map<ImportCandidate>((repository) => ({
          sourcePath: repository.sourcePath,
          originUrl: repository.originUrl,
          status: repository.originUrl ? 'validating' : 'invalid',
          selected: false,
          ...(!repository.originUrl ? { message: '未找到 origin，请使用单个添加仓库。' } : {}),
        }))
        setCandidates(initial)

        const knownIds = new Set(initialState.projects.map((project) => project.id))
        let nextIndex = 0
        let completed = initial.filter((candidate) => !candidate.originUrl).length
        setValidated(completed)
        await Promise.all(
          Array.from({ length: Math.min(3, initial.length) }, async () => {
            while (nextIndex < initial.length) {
              if (!active) return
              const index = nextIndex
              nextIndex += 1
              const candidate = initial[index]
              if (!candidate?.originUrl) continue
              try {
                const details = await window.electronAPI.projects.inspect(candidate.originUrl)
                const branch = details.defaultBranch ?? details.branches[0]
                if (!branch) throw new Error('远程仓库没有可用分支。')
                const duplicate = knownIds.has(details.suggestedId)
                if (!duplicate) knownIds.add(details.suggestedId)
                updateCandidate(index, {
                  status: duplicate ? 'invalid' : 'ready',
                  selected: !duplicate,
                  ...(duplicate
                    ? { message: '仓库已存在或在本批次中重复。' }
                    : {
                        project: {
                          id: details.suggestedId,
                          name: details.suggestedName,
                          url: candidate.originUrl,
                          branch,
                          localPath: details.suggestedLocalPath,
                          enabled: true,
                        },
                      }),
                })
              } catch (error) {
                updateCandidate(index, {
                  status: 'invalid',
                  selected: false,
                  message: getErrorMessage(error),
                })
              }
              completed += 1
              if (active) setValidated(completed)
            }
          })
        )
        if (active && expectedAttempt > 0) {
          showSuccessToast(
            `仓库目录已重新扫描，识别 ${result.repositories.length} 个仓库`
          )
        }
      } catch (error) {
        if (active) {
          const message = getErrorMessage(error)
          setScanError(message)
          toast.error(`扫描仓库目录失败：${message}`)
        }
      } finally {
        if (active) setScanning(false)
      }
    }

    function updateCandidate(index: number, patch: Partial<ImportCandidate>) {
      if (!active) return
      setCandidates((current) =>
        current.map((candidate, candidateIndex) =>
          candidateIndex === index ? { ...candidate, ...patch } : candidate
        )
      )
    }

    void scanAndValidate(attempt)
    return () => {
      active = false
    }
  }, [attempt, folder, initialState.projects, open])

  const selectable = useMemo(
    () => candidates.filter((candidate) => candidate.status === 'ready'),
    [candidates]
  )
  const selected = useMemo(
    () => selectable.filter((candidate) => candidate.selected && candidate.project),
    [selectable]
  )
  const failed = useMemo(
    () => candidates.filter((candidate) => candidate.status === 'error' && candidate.project),
    [candidates]
  )
  const allSelected = selectable.length > 0 && selectable.every((candidate) => candidate.selected)

  function restartScan() {
    setScan(undefined)
    setCandidates([])
    setValidated(0)
    setScanError(undefined)
    setScanning(true)
    setAttempt((value) => value + 1)
  }

  function toggleAll(value: boolean) {
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.status === 'ready' ? { ...candidate, selected: value } : candidate
      )
    )
  }

  function toggleCandidate(sourcePath: string, value: boolean) {
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.sourcePath === sourcePath ? { ...candidate, selected: value } : candidate
      )
    )
  }

  async function importCandidates(targets: ImportCandidate[]) {
    if (!revision) return
    const projects = targets
      .map((candidate) => candidate.project)
      .filter((project): project is RepositoryProject => Boolean(project))
    if (projects.length === 0) return
    const targetIds = new Set(projects.map((project) => project.id))
    setImporting(true)
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.project && targetIds.has(candidate.project.id)
          ? { ...candidate, status: 'importing' }
          : candidate
      )
    )
    try {
      const result = await window.electronAPI.projects.importRepositories({
        projects,
        expectedRevision: revision,
      })
      const added = new Set(result.added)
      const errors = new Map(
        result.errors.map((error) => [error.projectId, error.message] as const)
      )
      setCandidates((current) =>
        current.map((candidate) => {
          const id = candidate.project?.id
          if (!id || !targetIds.has(id)) return candidate
          if (added.has(id)) return { ...candidate, status: 'added', selected: false }
          return {
            ...candidate,
            status: 'error',
            selected: false,
            message: errors.get(id) ?? '仓库未添加。',
          }
        })
      )
      setRevision(result.state.revision)
      onImported(result.state)
      if (result.errors.length) {
        toast.warning(`已添加 ${result.added.length} 个仓库，${result.errors.length} 个失败`)
      } else {
        showSuccessToast(`已添加 ${result.added.length} 个仓库`)
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('changed since')) {
        const current = await window.electronAPI.projects.state()
        setRevision(current.revision)
        onImported(current)
      }
      setCandidates((current) =>
        current.map((candidate) =>
          candidate.project && targetIds.has(candidate.project.id)
            ? { ...candidate, status: 'error', message: getErrorMessage(error) }
            : candidate
        )
      )
      toast.error(getErrorMessage(error))
    } finally {
      setImporting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !importing && onOpenChange(next)}>
      <SheetContent className='w-full sm:max-w-4xl'>
        <SheetHeader>
          <SheetTitle>从文件夹导入仓库</SheetTitle>
          <SheetDescription className='[overflow-wrap:anywhere]'>{folder}</SheetDescription>
        </SheetHeader>

        <div className='flex items-center justify-between gap-3 px-4 text-sm'>
          <div className='flex items-center gap-2 text-muted-foreground'>
            {scanning ? <Loader2 className='size-4 animate-spin' /> : <FolderSearch className='size-4' />}
            {scanning
              ? `正在验证 ${validated}/${scan?.repositories.length ?? 0}`
              : `识别 ${scan?.repositories.length ?? 0} 个仓库，可导入 ${selectable.length} 个`}
          </div>
          <Button size='sm' variant='outline' disabled={scanning || importing} onClick={restartScan}>
            <RefreshCw />
            重新扫描
          </Button>
        </div>

        {scanError ? (
          <Alert variant='destructive' className='mx-4 w-auto'>
            <AlertCircle />
            <AlertTitle>扫描失败</AlertTitle>
            <AlertDescription className='[overflow-wrap:anywhere]'>{scanError}</AlertDescription>
          </Alert>
        ) : null}

        {scan?.truncated || scan?.warnings.length ? (
          <Alert className='mx-4 w-auto'>
            <AlertCircle />
            <AlertTitle>{scan.truncated ? '已达到 200 个仓库上限' : '部分目录已跳过'}</AlertTitle>
            <AlertDescription>
              {scan.warnings.length ? `${scan.warnings.length} 个目录无法读取。` : '请缩小扫描范围后重试。'}
            </AlertDescription>
          </Alert>
        ) : null}

        <ScrollArea className='min-h-0 flex-1'>
          <div className='px-4 pb-4'>
            <Table className='min-w-[56rem] table-fixed'>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-12'>
                    <Checkbox
                      checked={allSelected}
                      disabled={!selectable.length || importing}
                      onCheckedChange={(value) => toggleAll(value === true)}
                      aria-label='选择全部可导入仓库'
                    />
                  </TableHead>
                  <TableHead className='w-64'>仓库</TableHead>
                  <TableHead className='w-40'>分支</TableHead>
                  <TableHead className='w-64'>缓存路径</TableHead>
                  <TableHead className='w-56'>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((candidate) => (
                  <TableRow key={candidate.sourcePath}>
                    <TableCell>
                      <Checkbox
                        checked={candidate.selected}
                        disabled={candidate.status !== 'ready' || importing}
                        onCheckedChange={(value) => toggleCandidate(candidate.sourcePath, value === true)}
                        aria-label={`选择 ${candidate.project?.name ?? candidate.sourcePath}`}
                      />
                    </TableCell>
                    <TableCell className='max-w-64'>
                      <OverflowTooltip
                        text={candidate.project?.name ?? candidate.sourcePath}
                        className='font-medium'
                      />
                      <OverflowTooltip
                        text={candidate.originUrl ?? candidate.sourcePath}
                        className='text-xs text-muted-foreground'
                        monospace
                      />
                    </TableCell>
                    <TableCell>
                      {candidate.project?.branch ? (
                        <Badge variant='outline' className='max-w-36'>
                          <OverflowTooltip text={candidate.project.branch} monospace />
                        </Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell className='max-w-64'>
                      <OverflowTooltip
                        text={candidate.project?.localPath ?? '—'}
                        className='text-xs text-muted-foreground'
                        monospace
                      />
                    </TableCell>
                    <TableCell><CandidateStatus candidate={candidate} /></TableCell>
                  </TableRow>
                ))}
                {!scanning && candidates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className='h-28 text-center text-muted-foreground'>未识别到 Git 仓库。</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>

        <SheetFooter className='border-t sm:flex-row sm:justify-end'>
          <Button variant='outline' disabled={importing} onClick={() => onOpenChange(false)}>关闭</Button>
          {failed.length ? (
            <Button disabled={importing} onClick={() => void importCandidates(failed)}>
              {importing && <Loader2 className='animate-spin' />}
              重试失败项（{failed.length}）
            </Button>
          ) : null}
          {selected.length ? (
            <Button disabled={scanning || importing || !revision} onClick={() => void importCandidates(selected)}>
              {importing && <Loader2 className='animate-spin' />}
              导入所选仓库（{selected.length}）
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function CandidateStatus({ candidate }: { candidate: ImportCandidate }) {
  if (candidate.status === 'validating' || candidate.status === 'importing') {
    return <span className='flex items-center gap-1 text-xs text-muted-foreground'><Loader2 className='size-3 animate-spin' />{candidate.status === 'validating' ? '验证中' : '同步中'}</span>
  }
  if (candidate.status === 'added') {
    return <span className='flex items-center gap-1 text-xs text-emerald-600'><CheckCircle2 className='size-3' />已添加</span>
  }
  if (candidate.status === 'ready') return <Badge variant='secondary'>可导入</Badge>
  return (
    <span className='flex max-w-56 items-start gap-1 text-xs text-destructive'>
      <XCircle className='mt-0.5 size-3 shrink-0' />
      <OverflowTooltip
        text={candidate.message ?? '失败'}
        className='text-xs text-destructive'
        lines={2}
      />
    </span>
  )
}
