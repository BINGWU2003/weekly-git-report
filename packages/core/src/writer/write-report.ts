import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  HISTORY_DIR_NAME,
  INDEX_FILE_NAME,
  MANIFEST_FILE_NAME,
  ManifestSchema,
} from "@weekly-git-report/shared";
import type { Config, Manifest, ManifestError, Period } from "@weekly-git-report/shared";

import type { CollectCommitsResult } from "../collector/collect-commits.js";
import { sha256 } from "../utils/hash.js";
import { getOutputRoot, getPeriodOutputDir } from "../utils/path.js";
import { renderIndexMarkdown } from "./index-markdown.js";
import {
  renderProjectMarkdown,
  renderProjectMarkdownForHash,
} from "./project-markdown.js";

export interface WriteReportOptions {
  config: Config;
  period: Period;
  collectResult: CollectCommitsResult;
  backup: boolean;
}

export interface WriteReportResult {
  outputDir: string;
  indexFile: string;
  manifestFile: string;
  projectCount: number;
  commitCount: number;
  updatedFiles: number;
  skippedFiles: number;
  errors: ManifestError[];
}

export async function writeReport(
  options: WriteReportOptions,
): Promise<WriteReportResult> {
  const generatedAt = new Date().toISOString();
  const outputRoot = getOutputRoot(options.config.outputRoot);
  const outputDir = getPeriodOutputDir(options.config.outputRoot, options.period);
  const manifestFile = path.join(outputDir, MANIFEST_FILE_NAME);
  const indexFile = path.join(outputDir, INDEX_FILE_NAME);
  const previousManifest = await readExistingManifest(manifestFile);
  const previousHashes = new Map(
    previousManifest?.projects.map((project) => [project.id, project.contentHash]) ?? [],
  );
  let updatedFiles = 0;
  let skippedFiles = 0;

  await mkdir(outputDir, { recursive: true });

  const manifestProjects: Manifest["projects"] = [];

  for (const projectResult of options.collectResult.projects) {
    const { project, commits } = projectResult;
    if (commits.length === 0 && !options.config.includeEmptyProjects) {
      continue;
    }

    const markdownForHash = renderProjectMarkdownForHash({
      project,
      period: options.period,
      commits,
    });
    const contentHash = sha256(markdownForHash);
    const markdown = renderProjectMarkdown({
      project,
      period: options.period,
      commits,
      generatedAt,
    });
    const projectFile = path.join(outputDir, project.fileName);

    if (previousHashes.get(project.id) === contentHash) {
      skippedFiles += 1;
    } else {
      await backupExistingFile(projectFile, outputDir, options.backup);
      await writeFile(projectFile, markdown, "utf8");
      updatedFiles += 1;
    }

    manifestProjects.push({
      id: project.id,
      name: project.name,
      file: `./${project.fileName}`,
      path: project.path,
      remote: project.remote,
      branch: project.branch,
      commitCount: commits.length,
      contentHash,
    });
  }

  const manifest = ManifestSchema.parse({
    version: 1,
    period: options.period,
    generatedAt,
    outputRoot,
    outputDir,
    projects: manifestProjects,
    errors: options.collectResult.errors,
  });

  await writeFile(indexFile, renderIndexMarkdown(manifest), "utf8");
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    outputDir,
    indexFile,
    manifestFile,
    projectCount: manifest.projects.length,
    commitCount: manifest.projects.reduce((total, project) => total + project.commitCount, 0),
    updatedFiles,
    skippedFiles,
    errors: manifest.errors,
  };
}

async function readExistingManifest(manifestFile: string): Promise<Manifest | undefined> {
  try {
    return ManifestSchema.parse(JSON.parse(await readFile(manifestFile, "utf8")));
  } catch {
    return undefined;
  }
}

async function backupExistingFile(
  file: string,
  outputDir: string,
  enabled: boolean,
): Promise<void> {
  if (!enabled) {
    return;
  }

  try {
    await readFile(file, "utf8");
  } catch {
    return;
  }

  const historyDir = path.join(outputDir, HISTORY_DIR_NAME);
  const parsed = path.parse(file);
  const timestamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  await mkdir(historyDir, { recursive: true });
  await copyFile(file, path.join(historyDir, `${parsed.name}.${timestamp}${parsed.ext}`));
}
