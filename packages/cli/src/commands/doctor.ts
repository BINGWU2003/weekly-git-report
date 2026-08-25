import {
  loadConfig,
  loadProjectsIndex,
  normalizeAbsolutePath,
  normalizeRepositoryUrl,
  runGit,
  tryRunGit,
} from "@weekly-git-report/core";

export async function runDoctorCommand(): Promise<void> {
  const checks: Array<{ check: string; ok: boolean; message: string }> = [];
  try {
    checks.push({
      check: "git",
      ok: true,
      message: await runGit(["--version"], process.cwd()),
    });
  } catch (error) {
    checks.push({ check: "git", ok: false, message: getMessage(error) });
  }

  try {
    const config = await loadConfig();
    checks.push({
      check: "config",
      ok: true,
      message: `${config.identities.length} identities`,
    });
  } catch (error) {
    checks.push({ check: "config", ok: false, message: getMessage(error) });
  }

  try {
    const projectsIndex = await loadProjectsIndex();
    const paths = projectsIndex.projects.map((project) =>
      normalizeAbsolutePath(project.localPath).toLowerCase(),
    );
    const duplicatePaths = paths.filter((value, pathIndex) => paths.indexOf(value) !== pathIndex);
    checks.push({
      check: "projects",
      ok: duplicatePaths.length === 0,
      message: `${projectsIndex.projects.length} repositories${duplicatePaths.length ? ", duplicate local paths found" : ""}`,
    });
    for (const project of projectsIndex.projects) {
      const remote = await tryRunGit(["remote", "get-url", "origin"], project.localPath);
      const ok =
        Boolean(remote) &&
        normalizeRepositoryUrl(remote ?? "") === normalizeRepositoryUrl(project.url);
      checks.push({
        check: `repository:${project.name}`,
        ok,
        message: ok
          ? `${project.localPath} (${project.branch})`
          : "Local repository missing or origin does not match",
      });
    }
  } catch (error) {
    checks.push({ check: "projects", ok: false, message: getMessage(error) });
  }

  console.log(JSON.stringify({ checks }, null, 2));
  if (checks.some((check) => !check.ok)) process.exitCode = 1;
}

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
