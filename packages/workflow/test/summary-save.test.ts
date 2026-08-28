import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({ outputRoot: "" }));

vi.mock("@weekly-git-report/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@weekly-git-report/core")>()),
  loadConfig: vi.fn<() => Promise<{ outputRoot: string }>>(async () => ({
    outputRoot: state.outputRoot,
  })),
}));

import { saveSummary } from "../src/index.js";

beforeEach(async () => {
  state.outputRoot = await mkdtemp(path.join(os.tmpdir(), "weekly-summary-save-"));
});

afterEach(async () => {
  await rm(state.outputRoot, { recursive: true, force: true });
});

test("writes sidecars, backs up replacements, and protects cross-cadence saves", async () => {
  const period = { start: "2026-08-24", end: "2026-08-24" };
  const first = await saveSummary({
    ...period,
    cadence: "weekly",
    content: "# Weekly",
  });
  expect(first).toMatchObject({ cadence: "weekly", replaced: false, backupFiles: [] });
  expect(JSON.parse(await readFile(first.metadataFile, "utf8"))).toMatchObject({
    version: 1,
    cadence: "weekly",
    period,
  });

  const replaced = await saveSummary({
    ...period,
    cadence: "weekly",
    content: "# Weekly updated",
  });
  expect(replaced.replaced).toBe(true);
  expect(replaced.backupFiles).toHaveLength(2);

  await expect(saveSummary({ ...period, cadence: "daily", content: "# Daily" })).rejects.toThrow(
    /pass --force/,
  );

  const forced = await saveSummary({
    ...period,
    cadence: "daily",
    content: "# Daily",
    force: true,
  });
  expect(forced).toMatchObject({ cadence: "daily", replaced: true });
});
