import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import type { DesktopAPI, ProjectsState } from '../../../shared/ipc'
import { RepositoryImportSheet } from './repository-import-sheet'

const initialState: ProjectsState = { projects: [], revision: 'revision-1' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RepositoryImportSheet', () => {
  it('validates folder repositories and imports selected defaults', async () => {
    const importedState: ProjectsState = {
      revision: 'revision-2',
      projects: [
        {
          id: 'example.com/team/project',
          name: 'project',
          url: 'https://example.com/team/project.git',
          branch: 'main',
          localPath: 'D:/cache/project',
          enabled: true,
        },
      ],
    }
    const scanFolder = vi.fn().mockResolvedValue({
      root: 'D:/code',
      scannedDirectories: 2,
      repositories: [
        {
          sourcePath: 'D:/code/project',
          originUrl: 'https://example.com/team/project.git',
          isBare: false,
        },
      ],
      warnings: [],
      truncated: false,
    })
    const inspect = vi.fn().mockResolvedValue({
      branches: ['main'],
      defaultBranch: 'main',
      suggestedId: 'example.com/team/project',
      suggestedName: 'project',
      suggestedLocalPath: 'D:/cache/project',
    })
    const importRepositories = vi.fn().mockResolvedValue({
      state: importedState,
      added: ['example.com/team/project'],
      errors: [],
    })
    vi.stubGlobal('electronAPI', {
      projects: { scanFolder, inspect, importRepositories },
    } as unknown as DesktopAPI)
    const onImported = vi.fn()
    const screen = await render(
      <RepositoryImportSheet
        folder='D:/code'
        initialState={initialState}
        onImported={onImported}
        onOpenChange={vi.fn()}
        open
      />
    )

    await expect.element(screen.getByText('可导入', { exact: true })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '导入所选仓库（1）' }))

    expect(importRepositories).toHaveBeenCalledWith({
      expectedRevision: 'revision-1',
      projects: importedState.projects,
    })
    expect(onImported).toHaveBeenCalledWith(importedState)
    await expect.element(screen.getByText('已添加')).toBeInTheDocument()
  })
})
