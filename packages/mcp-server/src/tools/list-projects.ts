import { loadProjectsIndex } from "@weekly-git-report/core";
import { ListProjectsInputSchema } from "@weekly-git-report/shared";

export async function listProjects(input: unknown) {
  ListProjectsInputSchema.parse(input);
  const index = await loadProjectsIndex();

  return {
    projects: index.projects.map((project) => ({
      id: project.id,
      name: project.name,
      path: project.path,
      remote: project.remote,
      branch: project.branch,
    })),
  };
}
