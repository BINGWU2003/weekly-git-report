import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  ReportCadenceSchema,
  SUMMARY_METADATA_SUFFIX,
  SummaryMetadataSchema,
} from "@weekly-git-report/shared";
import type {
  Period,
  ReportCadence,
  SummaryMetadata,
  SummaryMetadataStatus,
} from "@weekly-git-report/shared";

import { sha256 } from "../utils/hash.js";
import { validateSummaryPeriod } from "./report-cadence.js";

export interface SummaryMetadataInspection {
  status: SummaryMetadataStatus;
  cadence?: ReportCadence;
  metadata?: SummaryMetadata;
  message?: string;
}

export function getSummaryMetadataFilePath(summaryFile: string): string {
  const parsed = path.parse(summaryFile);
  return path.join(parsed.dir, `${parsed.name}${SUMMARY_METADATA_SUFFIX}`);
}

export function createSummaryMetadata(
  cadence: ReportCadence,
  period: Period,
  content: string,
  savedAt = new Date().toISOString(),
): SummaryMetadata {
  validateSummaryPeriod(cadence, period);
  return SummaryMetadataSchema.parse({
    version: 1,
    cadence,
    period,
    savedAt,
    contentHash: sha256(content),
  });
}

export async function inspectSummaryMetadata(
  summaryFile: string,
  period: Period,
  content?: string,
): Promise<SummaryMetadataInspection> {
  const metadataFile = getSummaryMetadataFilePath(summaryFile);
  let raw: string;
  try {
    raw = await readFile(metadataFile, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return { status: "legacy", cadence: "weekly" };
    }
    return { status: "invalid", message: getMessage(error) };
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
    const metadata = SummaryMetadataSchema.parse(value);
    validateSummaryPeriod(metadata.cadence, metadata.period);
    if (metadata.period.start !== period.start || metadata.period.end !== period.end) {
      throw new Error("Sidecar period does not match the summary file name.");
    }
    const summaryContent = content ?? (await readFile(summaryFile, "utf8"));
    if (metadata.contentHash !== sha256(summaryContent)) {
      throw new Error("Sidecar contentHash does not match the summary Markdown.");
    }
    return { status: "valid", cadence: metadata.cadence, metadata };
  } catch (error) {
    const cadence = getCadenceHint(value);
    return {
      status: "invalid",
      ...(cadence ? { cadence } : {}),
      message: getMessage(error),
    };
  }
}

function getCadenceHint(value: unknown): ReportCadence | undefined {
  if (!value || typeof value !== "object" || !("cadence" in value)) return undefined;
  const parsed = ReportCadenceSchema.safeParse(value.cadence);
  return parsed.success ? parsed.data : undefined;
}

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
