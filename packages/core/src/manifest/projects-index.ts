import { ProjectsIndexSchema } from "@weekly-git-report/shared";
import type { ProjectsIndex } from "@weekly-git-report/shared";

import { getProjectsFilePath } from "../utils/path.js";
import { assertFileRevision, readVersionedText, writeJsonAtomic } from "../utils/versioned-json.js";

export interface ProjectsIndexSnapshot {
  index: ProjectsIndex;
  revision: string;
}

export class ProjectsIndexNotFoundError extends Error {
  constructor(projectsFile = getProjectsFilePath()) {
    super(`Projects index not found: ${projectsFile}`);
    this.name = "ProjectsIndexNotFoundError";
  }
}

export async function writeProjectsIndex(
  index: ProjectsIndex,
  projectsFile = getProjectsFilePath(),
): Promise<void> {
  const parsed = ProjectsIndexSchema.parse(index);
  await writeJsonAtomic(projectsFile, parsed);
}

export async function loadProjectsIndex(
  projectsFile = getProjectsFilePath(),
): Promise<ProjectsIndex> {
  return (await loadProjectsIndexSnapshot(projectsFile)).index;
}

export async function loadProjectsIndexSnapshot(
  projectsFile = getProjectsFilePath(),
): Promise<ProjectsIndexSnapshot> {
  let document;

  try {
    document = await readVersionedText(projectsFile);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new ProjectsIndexNotFoundError(projectsFile);
    }

    throw error;
  }

  return {
    index: ProjectsIndexSchema.parse(JSON.parse(document.content)),
    revision: document.revision,
  };
}

export async function writeProjectsIndexIfRevision(
  index: ProjectsIndex,
  expectedRevision: string | null,
  projectsFile = getProjectsFilePath(),
): Promise<ProjectsIndexSnapshot> {
  const parsed = ProjectsIndexSchema.parse(index);
  await assertFileRevision(projectsFile, expectedRevision);
  await writeJsonAtomic(projectsFile, parsed);
  return loadProjectsIndexSnapshot(projectsFile);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
