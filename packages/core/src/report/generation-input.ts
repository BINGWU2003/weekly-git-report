import { readFile } from "node:fs/promises";

import { GenerationInputSchema } from "@weekly-git-report/shared";
import type { GenerationInput, Period, ReportType } from "@weekly-git-report/shared";

import type { CollectCommitsResult } from "../collector/collect-commits.js";
import { sha256 } from "../utils/hash.js";
import { writeJsonAtomic } from "../utils/versioned-json.js";

export interface CreateGenerationInputOptions {
  runId: string;
  reportId: string;
  reportType: ReportType;
  reportTitle?: string;
  period: Period;
  templateRevision: string;
  rawManifestHash: string;
  collectResult: CollectCommitsResult;
  userContext?: string;
  createdAt?: string;
}

export function createGenerationInput(options: CreateGenerationInputOptions): GenerationInput {
  return GenerationInputSchema.parse({
    version: 2,
    runId: options.runId,
    reportId: options.reportId,
    reportType: options.reportType,
    ...(options.reportTitle ? { reportTitle: options.reportTitle } : {}),
    period: options.period,
    createdAt: options.createdAt ?? new Date().toISOString(),
    templateRevision: options.templateRevision,
    rawManifestHash: options.rawManifestHash,
    ...(options.userContext?.trim() ? { userContext: options.userContext.trim() } : {}),
    repositories: options.collectResult.projects.map(({ project, commits }) => ({
      id: project.id,
      name: project.name,
      branch: project.branch,
      commits: commits.map((commit) => ({
        hash: commit.hash,
        committedAt: commit.committedAt,
        subject: commit.subject,
        body: commit.body ?? "",
        authorName: commit.author,
      })),
    })),
  });
}

export async function writeGenerationInput(
  file: string,
  input: GenerationInput,
): Promise<{ file: string; hash: string }> {
  const parsed = GenerationInputSchema.parse(input);
  await writeJsonAtomic(file, parsed);
  return { file, hash: sha256(await readFile(file, "utf8")) };
}

export async function hashFile(file: string): Promise<string> {
  return sha256(await readFile(file));
}
