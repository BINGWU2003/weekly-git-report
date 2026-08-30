import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import {
  createQueuedRun,
  InvalidRunTransitionError,
  ReportRunStore,
  resolveCurrentPeriod,
  resolvePreviousPeriod,
  resolveScheduledTaskPeriod,
} from "../src/index.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("report run store", () => {
  test("persists run metadata and normalized steps", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "weekly-run-store-"));
    directories.push(directory);
    const store = new ReportRunStore(path.join(directory, "runs.db"));
    const queued = store.create(
      createQueuedRun({
        id: "run-1",
        reportId: "report-1",
        reportType: "weekly",
        period: { start: "2026-08-17", end: "2026-08-23" },
        trigger: "manual",
        generator: "builtin-ai",
      }),
    );
    const updated = store.replace({
      ...queued,
      status: "collecting",
      updatedAt: "2026-08-24T00:00:01.000Z",
      steps: [
        {
          name: "collect",
          attempt: 1,
          status: "running",
          startedAt: "2026-08-24T00:00:01.000Z",
        },
      ],
    });
    expect(store.require("run-1")).toEqual(updated);
    expect(store.countByStatus()).toEqual({ collecting: 1 });
    expect(() => store.replace({ ...updated, status: "succeeded" })).toThrow(
      InvalidRunTransitionError,
    );
    store.close();
  });

  test("resolves previous complete periods in local time", () => {
    const monday = new Date(2026, 7, 24, 9);
    expect(resolvePreviousPeriod("daily", monday)).toEqual({
      start: "2026-08-21",
      end: "2026-08-21",
    });
    expect(resolvePreviousPeriod("weekly", monday)).toEqual({
      start: "2026-08-17",
      end: "2026-08-23",
    });
    expect(resolvePreviousPeriod("monthly", monday)).toEqual({
      start: "2026-07-01",
      end: "2026-07-31",
    });
  });

  test("separates manual current periods from scheduled task periods", () => {
    const monday = new Date(2026, 7, 24, 9);
    expect(resolveCurrentPeriod("daily", monday)).toEqual({
      start: "2026-08-24",
      end: "2026-08-24",
    });
    expect(resolveCurrentPeriod("weekly", monday)).toEqual({
      start: "2026-08-24",
      end: "2026-08-24",
    });
    expect(resolveCurrentPeriod("monthly", monday)).toEqual({
      start: "2026-08-01",
      end: "2026-08-24",
    });
    expect(resolveScheduledTaskPeriod("daily", monday)).toEqual({
      start: "2026-08-24",
      end: "2026-08-24",
    });
    expect(resolveScheduledTaskPeriod("weekly", monday)).toEqual({
      start: "2026-08-17",
      end: "2026-08-23",
    });
    expect(resolveScheduledTaskPeriod("monthly", monday)).toEqual({
      start: "2026-07-01",
      end: "2026-07-31",
    });
  });

  test("allows a saved run to be published later", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "weekly-run-store-"));
    directories.push(directory);
    const store = new ReportRunStore(path.join(directory, "runs.db"));
    let run = store.create(
      createQueuedRun({
        id: "run-publish",
        reportId: "report-publish",
        reportType: "daily",
        period: { start: "2026-08-28", end: "2026-08-28" },
        trigger: "manual",
        generator: "builtin-ai",
      }),
    );
    for (const status of [
      "collecting",
      "generating",
      "awaiting_review",
      "saving",
      "succeeded",
      "publishing",
      "publish_failed",
      "publishing",
      "succeeded",
    ] as const) {
      run = store.replace({ ...run, status, updatedAt: new Date().toISOString() });
    }
    expect(run.status).toBe("succeeded");
    store.close();
  });

  test("allows only one collecting or generating run across connections", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "weekly-run-store-"));
    directories.push(directory);
    const databaseFile = path.join(directory, "runs.db");
    const firstStore = new ReportRunStore(databaseFile);
    const secondStore = new ReportRunStore(databaseFile);
    let first = firstStore.create(
      createQueuedRun({
        id: "run-first",
        reportId: "report-first",
        reportType: "daily",
        period: { start: "2026-08-28", end: "2026-08-28" },
        trigger: "manual",
        generator: "builtin-ai",
      }),
    );
    let second = secondStore.create(
      createQueuedRun({
        id: "run-second",
        reportId: "report-second",
        reportType: "daily",
        period: { start: "2026-08-28", end: "2026-08-28" },
        trigger: "scheduled",
        generator: "builtin-ai",
      }),
    );
    first = firstStore.replace({ ...first, status: "collecting" });
    expect(secondStore.tryReplaceActive({ ...second, status: "collecting" })).toBeNull();
    first = firstStore.replace({ ...first, status: "generating" });
    expect(secondStore.tryReplaceActive({ ...second, status: "collecting" })).toBeNull();
    firstStore.replace({ ...first, status: "awaiting_review" });
    second = secondStore.tryReplaceActive({ ...second, status: "collecting" })!;
    expect(second.status).toBe("collecting");
    firstStore.close();
    secondStore.close();
  });
});
