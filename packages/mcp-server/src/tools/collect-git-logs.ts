import {
  collectCommits,
  loadConfig,
  loadProjectsIndex,
  resolveAuthor,
  writeReport,
} from "@weekly-git-report/core";
import { CollectGitLogsInputSchema } from "@weekly-git-report/shared";

export async function collectGitLogs(input: unknown) {
  const args = CollectGitLogsInputSchema.parse(input);
  const config = await loadConfig();
  const projectsIndex = await loadProjectsIndex();
  const selected = new Set(args.projectIds);
  const projects =
    args.projectIds.length === 0
      ? projectsIndex.projects
      : projectsIndex.projects.filter(
          (project) => selected.has(project.id) || selected.has(project.name),
        );
  const author = await resolveAuthor(config, args.author);
  const period = { start: args.since, end: args.until };
  const collectResult = await collectCommits({ projects, period, author });
  const report = await writeReport({
    config,
    period,
    collectResult,
    backup: false,
  });

  return {
    outputDir: report.outputDir,
    indexFile: report.indexFile,
    manifestFile: report.manifestFile,
    projectCount: report.projectCount,
    commitCount: report.commitCount,
    errors: report.errors,
  };
}
