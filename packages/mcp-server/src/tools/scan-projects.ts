import {
  buildProjectIndex,
  getProjectsFilePath,
  loadConfig,
  writeProjectsIndex,
} from "@weekly-git-report/core";
import { ScanProjectsInputSchema } from "@weekly-git-report/shared";

export async function scanProjects(input: unknown) {
  const args = ScanProjectsInputSchema.parse(input);
  const config = await loadConfig();
  const result = await buildProjectIndex(config, args);

  await writeProjectsIndex(result.index);

  return {
    projectCount: result.index.projects.length,
    projectsFile: getProjectsFilePath(),
    warnings: result.warnings,
  };
}
