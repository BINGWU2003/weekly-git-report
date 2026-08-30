import { mkdtemp, readFile, rm, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({ outputRoot: "" }));

vi.mock("@weekly-git-report/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@weekly-git-report/core")>()),
  loadConfig: vi.fn<() => Promise<{ outputRoot: string }>>(async () => ({
    outputRoot: state.outputRoot,
  })),
  hashFile: vi.fn<() => Promise<string>>(async () => `sha256:${"1".repeat(64)}`),
  readSummaryTemplate: vi.fn<() => Promise<{ template: { revision: string } }>>(async () => ({
    template: { revision: "sha256:template" },
  })),
}));

import { saveSummary } from "../src/index.js";

beforeEach(async () => {
  state.outputRoot = await mkdtemp(path.join(os.tmpdir(), "weekly-summary-save-"));
});

afterEach(async () => {
  await rm(state.outputRoot, { recursive: true, force: true });
});

test("writes v2 sidecars, backs up replacements, and separates report types", async () => {
  const period = { start: "2026-08-24", end: "2026-08-24" };
  const first = await saveSummary({
    ...period,
    reportType: "weekly",
    content: "# Weekly",
  });
  expect(first).toMatchObject({ reportType: "weekly", replaced: false, backupFiles: [] });
  expect(JSON.parse(await readFile(first.metadataFile, "utf8"))).toMatchObject({
    version: 2,
    generator: "external-agent",
    templateRevision: "sha256:template",
    rawManifestHash: `sha256:${"1".repeat(64)}`,
    reportId: first.reportId,
    reportType: "weekly",
    period,
  });

  const replaced = await saveSummary({
    ...period,
    reportType: "weekly",
    content: "# Weekly updated",
  });
  expect(replaced.replaced).toBe(true);
  expect(replaced.backupFiles).toHaveLength(2);

  const daily = await saveSummary({
    ...period,
    reportType: "daily",
    content: "# Daily",
  });
  expect(daily).toMatchObject({ reportType: "daily", replaced: false });
  expect(daily.summaryFile).not.toBe(first.summaryFile);
});

test("requires explicit force before replacing a summary with a missing sidecar", async () => {
  const period = { start: "2026-08-17", end: "2026-08-23" };
  const first = await saveSummary({
    ...period,
    reportType: "weekly",
    content: "# Legacy weekly report",
  });
  await unlink(first.metadataFile);

  await expect(
    saveSummary({ ...period, reportType: "weekly", content: "# Generated weekly report" }),
  ).rejects.toThrow(/--force/);
  expect(await readFile(first.summaryFile, "utf8")).toBe("# Legacy weekly report\n");

  const replaced = await saveSummary({
    ...period,
    reportType: "weekly",
    content: "# Generated weekly report",
    force: true,
  });
  expect(replaced).toMatchObject({ replaced: true, reportType: "weekly" });
  expect(replaced.backupFiles).toHaveLength(1);
  expect(await readFile(replaced.backupFiles[0]!, "utf8")).toBe("# Legacy weekly report\n");
});
