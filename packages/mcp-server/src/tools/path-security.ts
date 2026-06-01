import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { INDEX_FILE_NAME, MANIFEST_FILE_NAME, ManifestSchema } from "@weekly-git-report/shared";
import type { Manifest, Period } from "@weekly-git-report/shared";
import { getOutputRoot, getPeriodOutputDir } from "@weekly-git-report/core";

export function assertWithinOutputRoot(targetPath: string, outputRoot: string): void {
  const root = getOutputRoot(outputRoot);
  const target = path.resolve(targetPath);
  const relative = path.relative(root, target);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to read outside outputRoot: ${target}`);
  }
}

export function getSafePeriodOutputDir(outputRoot: string, period: Period): string {
  const outputDir = getPeriodOutputDir(outputRoot, period);
  assertWithinOutputRoot(outputDir, outputRoot);
  return outputDir;
}

export async function readWeekIndexFile(
  outputRoot: string,
  period: Period,
): Promise<string> {
  const outputDir = getSafePeriodOutputDir(outputRoot, period);
  const indexFile = path.join(outputDir, INDEX_FILE_NAME);
  assertWithinOutputRoot(indexFile, outputRoot);
  return readFile(indexFile, "utf8");
}

export async function readWeekManifest(
  outputRoot: string,
  period: Period,
): Promise<Manifest> {
  const outputDir = getSafePeriodOutputDir(outputRoot, period);
  const manifestFile = path.join(outputDir, MANIFEST_FILE_NAME);
  assertWithinOutputRoot(manifestFile, outputRoot);
  return ManifestSchema.parse(JSON.parse(await readFile(manifestFile, "utf8")));
}

export async function readWeekProjectFiles(
  outputRoot: string,
  period: Period,
) {
  const outputDir = getSafePeriodOutputDir(outputRoot, period);
  const manifest = await readWeekManifest(outputRoot, period);
  const manifestFiles = new Set(manifest.projects.map((project) => project.file.replace(/^\.\//, "")));
  const entries = await readdir(outputDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === INDEX_FILE_NAME) {
      continue;
    }

    if (!manifestFiles.has(entry.name)) {
      continue;
    }

    const filePath = path.join(outputDir, entry.name);
    assertWithinOutputRoot(filePath, outputRoot);
    files.push({ name: entry.name, content: await readFile(filePath, "utf8") });
  }

  return files;
}
