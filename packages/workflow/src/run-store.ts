import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { ReportRunSchema } from "@weekly-git-report/shared";
import type { ReportRun, ReportRunStatus, ReportRunStep } from "@weekly-git-report/shared";

const TRANSITIONS: Record<ReportRunStatus, readonly ReportRunStatus[]> = {
  queued: ["collecting", "failed", "cancelled"],
  collecting: ["generating", "failed", "cancelled"],
  generating: ["awaiting_review", "saving", "failed", "cancelled", "abandoned"],
  awaiting_review: ["saving", "cancelled"],
  saving: ["awaiting_review", "publishing", "succeeded", "failed", "cancelled"],
  publishing: ["succeeded", "publish_failed", "cancelled"],
  succeeded: ["publishing"],
  publish_failed: ["publishing"],
  failed: ["collecting", "generating"],
  cancelled: [],
  abandoned: [],
};

export class InvalidRunTransitionError extends Error {
  constructor(from: ReportRunStatus, to: ReportRunStatus) {
    super(`Invalid report run transition: ${from} -> ${to}`);
    this.name = "InvalidRunTransitionError";
  }
}

export class ReportRunStore {
  readonly databaseFile: string;
  private readonly database: DatabaseSync;

  constructor(databaseFile: string) {
    this.databaseFile = path.resolve(databaseFile);
    mkdirSync(path.dirname(this.databaseFile), { recursive: true });
    this.database = new DatabaseSync(this.databaseFile);
    this.database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS report_runs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        report_type TEXT NOT NULL,
        task_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        finished_at TEXT,
        data_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS report_runs_status_idx
        ON report_runs(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS report_runs_task_idx
        ON report_runs(task_id, created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS report_runs_single_active_idx
        ON report_runs((1))
        WHERE status IN ('collecting', 'generating');
      CREATE TABLE IF NOT EXISTS report_run_steps (
        run_id TEXT NOT NULL REFERENCES report_runs(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        attempt INTEGER NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        error_json TEXT,
        PRIMARY KEY (run_id, name, attempt)
      );
    `);
  }

  close(): void {
    this.database.close();
  }

  create(run: ReportRun): ReportRun {
    const parsed = ReportRunSchema.parse(run);
    const insert = this.database.prepare(`
      INSERT INTO report_runs
        (id, status, report_type, task_id, created_at, updated_at, finished_at, data_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.database.exec("BEGIN IMMEDIATE");
    try {
      insert.run(
        parsed.id,
        parsed.status,
        parsed.reportType,
        parsed.taskId ?? null,
        parsed.createdAt,
        parsed.updatedAt,
        parsed.finishedAt ?? null,
        JSON.stringify({ ...parsed, steps: [] }),
      );
      for (const step of parsed.steps) this.writeStep(parsed.id, step);
      this.database.exec("COMMIT");
      return parsed;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  get(id: string): ReportRun | null {
    const row = this.database.prepare("SELECT data_json FROM report_runs WHERE id = ?").get(id) as
      | { data_json: string }
      | undefined;
    if (!row) return null;
    return ReportRunSchema.parse({
      ...JSON.parse(row.data_json),
      steps: this.listSteps(id),
    });
  }

  require(id: string): ReportRun {
    const run = this.get(id);
    if (!run) throw new Error(`Report run not found: ${id}`);
    return run;
  }

  list(limit = 100): ReportRun[] {
    const rows = this.database
      .prepare("SELECT id FROM report_runs ORDER BY created_at DESC LIMIT ?")
      .all(Math.max(1, Math.min(limit, 1_000))) as Array<{ id: string }>;
    return rows.map((row) => this.require(row.id));
  }

  countByStatus(): Partial<Record<ReportRunStatus, number>> {
    const rows = this.database
      .prepare("SELECT status, COUNT(*) AS count FROM report_runs GROUP BY status")
      .all() as Array<{ status: ReportRunStatus; count: number }>;
    return Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
  }

  replace(run: ReportRun): ReportRun {
    const parsed = ReportRunSchema.parse(run);
    const current = this.require(parsed.id);
    if (current.status !== parsed.status && !TRANSITIONS[current.status].includes(parsed.status)) {
      throw new InvalidRunTransitionError(current.status, parsed.status);
    }
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database
        .prepare(`
          UPDATE report_runs
          SET status = ?, report_type = ?, task_id = ?, updated_at = ?, finished_at = ?, data_json = ?
          WHERE id = ?
        `)
        .run(
          parsed.status,
          parsed.reportType,
          parsed.taskId ?? null,
          parsed.updatedAt,
          parsed.finishedAt ?? null,
          JSON.stringify({ ...parsed, steps: [] }),
          parsed.id,
        );
      this.database.prepare("DELETE FROM report_run_steps WHERE run_id = ?").run(parsed.id);
      for (const step of parsed.steps) this.writeStep(parsed.id, step);
      this.database.exec("COMMIT");
      return parsed;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  tryReplaceActive(run: ReportRun): ReportRun | null {
    try {
      return this.replace(run);
    } catch (error) {
      if (error instanceof Error && error.message.includes("report_runs_single_active_idx")) {
        return null;
      }
      throw error;
    }
  }

  private listSteps(runId: string): ReportRunStep[] {
    const rows = this.database
      .prepare(`
        SELECT name, attempt, status, started_at, finished_at, error_json
        FROM report_run_steps
        WHERE run_id = ?
        ORDER BY attempt, rowid
      `)
      .all(runId) as Array<{
      name: ReportRunStep["name"];
      attempt: number;
      status: ReportRunStep["status"];
      started_at: string | null;
      finished_at: string | null;
      error_json: string | null;
    }>;
    return rows.map((row) => ({
      name: row.name,
      attempt: Number(row.attempt),
      status: row.status,
      ...(row.started_at ? { startedAt: row.started_at } : {}),
      ...(row.finished_at ? { finishedAt: row.finished_at } : {}),
      ...(row.error_json ? { error: JSON.parse(row.error_json) } : {}),
    }));
  }

  private writeStep(runId: string, step: ReportRunStep): void {
    this.database
      .prepare(`
        INSERT INTO report_run_steps
          (run_id, name, attempt, status, started_at, finished_at, error_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        runId,
        step.name,
        step.attempt,
        step.status,
        step.startedAt ?? null,
        step.finishedAt ?? null,
        step.error ? JSON.stringify(step.error) : null,
      );
  }
}

export function createQueuedRun(
  input: Pick<ReportRun, "id" | "reportId" | "reportType" | "period" | "trigger" | "generator"> &
    Partial<Pick<ReportRun, "title" | "templateType" | "taskId" | "taskSnapshot">>,
): ReportRun {
  const now = new Date().toISOString();
  return ReportRunSchema.parse({
    ...input,
    status: "queued",
    attempt: 1,
    steps: [],
    createdAt: now,
    updatedAt: now,
  });
}
