import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ProjectsIndexSchema } from "@weekly-git-report/shared";
import type { ProjectsIndex } from "@weekly-git-report/shared";

import { getProjectsFilePath } from "../utils/path.js";

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
  await mkdir(path.dirname(projectsFile), { recursive: true });
  await writeFile(projectsFile, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
}

export async function loadProjectsIndex(
  projectsFile = getProjectsFilePath(),
): Promise<ProjectsIndex> {
  let content: string;

  try {
    content = await readFile(projectsFile, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new ProjectsIndexNotFoundError(projectsFile);
    }

    throw error;
  }

  return ProjectsIndexSchema.parse(JSON.parse(content));
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
