import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import {
  getOutputRoot,
  getSummaryTemplateFilePath,
  inspectSummaryMetadata,
  loadConfig,
  loadProjectsIndex,
  normalizeAbsolutePath,
  normalizeRepositoryUrl,
  runGit,
  tryRunGit,
  validateSummaryTemplate,
} from "@weekly-git-report/core";
import {
  REPORT_CADENCES,
  SUMMARY_DIR_NAME,
  SUMMARY_METADATA_SUFFIX,
} from "@weekly-git-report/shared";
import type { Config, Period } from "@weekly-git-report/shared";

export async function runDoctorCommand(): Promise<void> {
  const checks: Array<{ check: string; ok: boolean; message: string }> = [];
  let loadedConfig: Config | undefined;
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
    loadedConfig = config;
    checks.push({
      check: "config",
      ok: true,
      message: `${config.identities.length} identities`,
    });
  } catch (error) {
    checks.push({ check: "config", ok: false, message: getMessage(error) });
  }

  for (const cadence of REPORT_CADENCES) {
    const templateFile = getSummaryTemplateFilePath(cadence);
    try {
      validateSummaryTemplate(await readFile(templateFile, "utf8"));
      checks.push({
        check: `template:${cadence}`,
        ok: true,
        message: templateFile,
      });
    } catch (error) {
      checks.push({
        check: `template:${cadence}`,
        ok: false,
        message: getMessage(error),
      });
    }
  }

  if (loadedConfig) {
    checks.push(...(await checkSummaryMetadata(getOutputRoot(loadedConfig.outputRoot))));
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

async function checkSummaryMetadata(
  outputRoot: string,
): Promise<Array<{ check: string; ok: boolean; message: string }>> {
  const checks: Array<{ check: string; ok: boolean; message: string }> = [];
  const summaryRoot = path.join(outputRoot, SUMMARY_DIR_NAME);
  for (const year of await readDirectories(summaryRoot)) {
    for (const month of await readDirectories(path.join(summaryRoot, year.name))) {
      const monthDir = path.join(summaryRoot, year.name, month.name);
      for (const entry of await readFiles(monthDir)) {
        const file = path.join(monthDir, entry.name);
        const relative = path.relative(outputRoot, file).replaceAll("\\", "/");
        if (entry.name.endsWith(SUMMARY_METADATA_SUFFIX)) {
          const markdownFile = file.slice(0, -SUMMARY_METADATA_SUFFIX.length) + ".md";
          if (!(await fileExists(markdownFile))) {
            checks.push({
              check: `summary-metadata:${relative}`,
              ok: false,
              message: "Orphan summary sidecar without Markdown.",
            });
          }
          continue;
        }
        if (path.extname(entry.name).toLowerCase() !== ".md") continue;
        const period = parsePeriod(path.basename(entry.name, ".md"));
        if (!period) continue;
        const metadata = await inspectSummaryMetadata(file, period);
        checks.push({
          check: `summary-metadata:${relative}`,
          ok: metadata.status !== "invalid",
          message:
            metadata.status === "legacy"
              ? "Legacy weekly summary without sidecar."
              : metadata.status === "valid"
                ? `${metadata.cadence} sidecar and content hash are valid.`
                : (metadata.message ?? "Invalid summary sidecar."),
        });
      }
    }
  }
  return checks;
}

function parsePeriod(value: string): Period | undefined {
  const match = /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/.exec(value);
  return match?.[1] && match[2] ? { start: match[1], end: match[2] } : undefined;
}

async function readDirectories(directory: string) {
  return (await readEntries(directory)).filter((entry) => entry.isDirectory());
}

async function readFiles(directory: string) {
  return (await readEntries(directory)).filter((entry) => entry.isFile());
}

async function readEntries(directory: string) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return [];
    throw error;
  }
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
