import { loadConfig, loadProjectsIndex } from "@weekly-git-report/core";

export async function runListCommand(): Promise<void> {
  await loadConfig();
  const index = await loadProjectsIndex();

  if (index.projects.length === 0) {
    console.log("No projects found. Run: weekly scan");
    return;
  }

  for (const project of index.projects) {
    const name = project.name.padEnd(20);
    const branch = (project.branch ?? "").padEnd(12);
    const remote = project.remote ?? "";
    console.log(`${name} ${branch} ${remote}`.trimEnd());
  }
}
