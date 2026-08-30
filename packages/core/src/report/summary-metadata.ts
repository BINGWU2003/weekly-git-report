import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  ReportTypeSchema,
  SUMMARY_METADATA_SUFFIX,
  SummaryMetadataSchema,
} from "@weekly-git-report/shared";
import type {
  Period,
  ReportType,
  SummaryMetadata,
  SummaryMetadataStatus,
  SummaryProvenance,
} from "@weekly-git-report/shared";

import { sha256 } from "../utils/hash.js";
import { validateSummaryPeriod } from "./report-cadence.js";

export interface SummaryMetadataInspection {
  status: SummaryMetadataStatus;
  reportId?: string;
  reportType?: ReportType;
  title?: string;
  metadata?: SummaryMetadata;
  message?: string;
}

export function getSummaryMetadataFilePath(summaryFile: string): string {
  const parsed = path.parse(summaryFile);
  return path.join(parsed.dir, `${parsed.name}${SUMMARY_METADATA_SUFFIX}`);
}

export function createSummaryMetadata(
  reportType: ReportType,
  period: Period,
  content: string,
  provenance: SummaryProvenance,
  title?: string,
  savedAt = new Date().toISOString(),
): SummaryMetadata {
  validateSummaryPeriod(reportType, period);
  return SummaryMetadataSchema.parse({
    version: 2,
    ...provenance,
    reportType,
    ...(title?.trim() ? { title: title.trim() } : {}),
    period,
    savedAt,
    contentHash: sha256(content),
  });
}

export async function inspectSummaryMetadata(
  summaryFile: string,
  period: Period,
  content?: string,
  expected?: { reportType?: ReportType; reportId?: string },
): Promise<SummaryMetadataInspection> {
  const metadataFile = getSummaryMetadataFilePath(summaryFile);
  let raw: string;
  try {
    raw = await readFile(metadataFile, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return { status: "invalid", message: "Summary sidecar is missing." };
    }
    return { status: "invalid", message: getMessage(error) };
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
    const metadata = SummaryMetadataSchema.parse(value);
    validateSummaryPeriod(metadata.reportType, metadata.period);
    if (metadata.period.start !== period.start || metadata.period.end !== period.end) {
      throw new Error("Sidecar period does not match the summary file name.");
    }
    if (expected?.reportType && metadata.reportType !== expected.reportType) {
      throw new Error("Sidecar reportType does not match the summary file name.");
    }
    if (expected?.reportId && metadata.reportId !== expected.reportId) {
      throw new Error("Sidecar reportId does not match the summary file name.");
    }
    const summaryContent = content ?? (await readFile(summaryFile, "utf8"));
    if (metadata.contentHash !== sha256(summaryContent)) {
      throw new Error("Sidecar contentHash does not match the summary Markdown.");
    }
    return {
      status: "valid",
      reportId: metadata.reportId,
      reportType: metadata.reportType,
      ...(metadata.title ? { title: metadata.title } : {}),
      metadata,
    };
  } catch (error) {
    const reportType = getReportTypeHint(value);
    return {
      status: "invalid",
      ...(reportType ? { reportType } : {}),
      message: getMessage(error),
    };
  }
}

function getReportTypeHint(value: unknown): ReportType | undefined {
  if (!value || typeof value !== "object" || !("reportType" in value)) return undefined;
  const parsed = ReportTypeSchema.safeParse(value.reportType);
  return parsed.success ? parsed.data : undefined;
}

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
