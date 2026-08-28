import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, expect, test } from "vitest";

import { createSummaryMetadata, indexReportFiles, ReportIndexError } from "../src/index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test("indexes only canonical reports with semantic metadata", async () => {
  const root = await createTemporaryDirectory();
  const period = { start: "2026-07-27", end: "2026-08-02" };
  const rawPeriod = path.join(root, "raw", "2026", "07", `${period.start}_${period.end}`);
  await mkdir(path.join(rawPeriod, ".history"), { recursive: true });
  await writeFile(path.join(rawPeriod, "index.md"), "# Index");
  await writeFile(path.join(rawPeriod, "project-a1b2c3d4.md"), "# Project");
  await writeFile(
    path.join(rawPeriod, ".history", "project-a1b2c3d4.2026-08-02-12-30-00.md"),
    "# History",
  );
  await writeFile(
    path.join(rawPeriod, "manifest.json"),
    JSON.stringify(createManifest(root, rawPeriod, period)),
  );

  const summary = path.join(root, "summary", "2026", "07", `${period.start}_${period.end}.md`);
  await mkdir(path.dirname(summary), { recursive: true });
  await writeFile(summary, "# Summary");
  const task = path.join(root, "tasks", `${period.start}_${period.end}`, "publish.md");
  await mkdir(path.dirname(task), { recursive: true });
  await writeFile(task, "# Task");
  await mkdir(path.join(root, ".agents"), { recursive: true });
  await writeFile(path.join(root, ".agents", "SKILL.md"), "# Not a report");

  const reports = await indexReportFiles(root);

  expect(reports).toHaveLength(5);
  expect(reports.map((report) => report.role)).toEqual([
    "raw-history",
    "raw-index",
    "raw-project",
    "summary",
    "task",
  ]);
  expect(reports.find((report) => report.role === "raw-project")).toMatchObject({
    title: "Project Alpha",
    projectId: "project-alpha",
    projectName: "Project Alpha",
    period,
  });
  expect(reports.find((report) => report.role === "summary")).toMatchObject({
    title: "周报总结",
    period,
    cadence: "weekly",
    summaryMetadataStatus: "legacy",
  });
  expect(reports.some((report) => report.relativePath.includes(".agents"))).toBe(false);
});

test("rejects a raw period with missing or invalid manifest metadata", async () => {
  const root = await createTemporaryDirectory();
  const rawPeriod = path.join(root, "raw", "2026", "08", "2026-08-03_2026-08-09");
  await mkdir(rawPeriod, { recursive: true });
  await writeFile(path.join(rawPeriod, "index.md"), "# Index");

  await expect(indexReportFiles(root)).rejects.toThrow(ReportIndexError);
  await writeFile(path.join(rawPeriod, "manifest.json"), "{not-json");
  await expect(indexReportFiles(root)).rejects.toThrow(/Raw 报告元数据无效/);
});

test("rejects manifest periods that do not match their directory", async () => {
  const root = await createTemporaryDirectory();
  const directoryPeriod = { start: "2026-08-03", end: "2026-08-09" };
  const rawPeriod = path.join(
    root,
    "raw",
    "2026",
    "08",
    `${directoryPeriod.start}_${directoryPeriod.end}`,
  );
  await mkdir(rawPeriod, { recursive: true });
  await writeFile(path.join(rawPeriod, "index.md"), "# Index");
  await writeFile(path.join(rawPeriod, "project-a1b2c3d4.md"), "# Project");
  await writeFile(
    path.join(rawPeriod, "manifest.json"),
    JSON.stringify(createManifest(root, rawPeriod, { start: "2026-08-04", end: "2026-08-09" })),
  );

  await expect(indexReportFiles(root)).rejects.toThrow(/周期与目录不一致/);
});

test("indexes valid and invalid summary sidecars without losing Markdown reports", async () => {
  const root = await createTemporaryDirectory();
  const monthDir = path.join(root, "summary", "2026", "08");
  await mkdir(monthDir, { recursive: true });

  const dailyPeriod = { start: "2026-08-28", end: "2026-08-28" };
  const dailyContent = "# Daily\n";
  const dailyFile = path.join(monthDir, `${dailyPeriod.start}_${dailyPeriod.end}.md`);
  await writeFile(dailyFile, dailyContent);
  await writeFile(
    path.join(monthDir, `${dailyPeriod.start}_${dailyPeriod.end}.meta.json`),
    JSON.stringify(createSummaryMetadata("daily", dailyPeriod, dailyContent)),
  );

  const monthlyPeriod = { start: "2026-08-01", end: "2026-08-28" };
  const monthlyFile = path.join(monthDir, `${monthlyPeriod.start}_${monthlyPeriod.end}.md`);
  await writeFile(monthlyFile, "# Monthly\n");
  await writeFile(
    path.join(monthDir, `${monthlyPeriod.start}_${monthlyPeriod.end}.meta.json`),
    JSON.stringify({
      ...createSummaryMetadata("monthly", monthlyPeriod, "# Monthly\n"),
      contentHash: `sha256:${"0".repeat(64)}`,
    }),
  );

  const reports = await indexReportFiles(root);
  expect(reports).toHaveLength(2);
  expect(reports.find((report) => report.cadence === "daily")).toMatchObject({
    title: "日报总结",
    summaryMetadataStatus: "valid",
  });
  expect(reports.find((report) => report.cadence === "monthly")).toMatchObject({
    title: "月报总结",
    summaryMetadataStatus: "invalid",
  });
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "weekly-report-index-"));
  temporaryDirectories.push(directory);
  return directory;
}

function createManifest(root: string, outputDir: string, period: { start: string; end: string }) {
  return {
    version: 1,
    period,
    generatedAt: "2026-08-02T12:30:00.000Z",
    outputRoot: root,
    outputDir,
    projects: [
      {
        id: "project-alpha",
        name: "Project Alpha",
        file: "./project-a1b2c3d4.md",
        path: "D:/cache/project-alpha",
        remote: "https://example.com/project-alpha.git",
        branch: "main",
        commitCount: 2,
        contentHash: "sha256:test",
      },
    ],
    errors: [],
  };
}
