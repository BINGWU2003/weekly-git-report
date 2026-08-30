import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import type { DesktopAPI, ProjectsState } from '../../../shared/ipc'
import { RepositoryForm } from './repository-form'

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))

vi.mock('@/hooks/use-unsaved-changes', () => ({ useUnsavedChanges: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

const state: ProjectsState = { projects: [], revision: 'revision-1' }

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('RepositoryForm', () => {
  it('explains that remote branches must be read before saving', async () => {
    vi.stubGlobal('electronAPI', {
      projects: { save: vi.fn() },
    } as unknown as DesktopAPI)
    const screen = await renderRepositoryForm()

    await userEvent.click(screen.getByRole('button', { name: '同步并保存' }))

    await expect.element(
      screen.getByText('请先读取远程分支，确认仓库地址和本机 Git 凭据可用。')
    ).toBeInTheDocument()
    expect(window.electronAPI.projects.save).not.toHaveBeenCalled()
  })

  it('submits the generated repository defaults after inspecting the remote', async () => {
    const inspect = vi.fn().mockResolvedValue({
      branches: ['main'],
      defaultBranch: 'main',
      suggestedId: 'example.com/team/project',
      suggestedName: 'project',
      suggestedLocalPath: 'D:/cache/project',
    })
    const save = vi.fn().mockResolvedValue({
      projects: [],
      revision: 'revision-2',
    })
    vi.stubGlobal('electronAPI', {
      projects: { inspect, save },
    } as unknown as DesktopAPI)
    const screen = await renderRepositoryForm()

    await userEvent.fill(
      screen.getByRole('textbox', { name: '远程地址' }),
      'https://example.com/team/project.git'
    )
    await userEvent.click(screen.getByRole('button', { name: '读取分支' }))
    await expect.element(screen.getByRole('textbox', { name: '仓库名称' })).toHaveValue('project')
    await userEvent.click(screen.getByRole('combobox', { name: '采集分支' }))
    await userEvent.click(screen.getByRole('option', { name: 'main' }))
    await userEvent.click(screen.getByRole('button', { name: '同步并保存' }))

    expect(toast.error).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(save).toHaveBeenCalledWith({
      expectedRevision: 'revision-1',
      project: {
        id: 'example.com/team/project',
        name: 'project',
        url: 'https://example.com/team/project.git',
        branch: 'main',
        localPath: 'D:/cache/project',
        enabled: true,
      },
    }))
  })
})

async function renderRepositoryForm() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <RepositoryForm open onOpenChange={vi.fn()} state={state} />
    </QueryClientProvider>
  )
}
