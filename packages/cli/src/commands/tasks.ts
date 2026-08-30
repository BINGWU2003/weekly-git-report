import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  loadOptionalAiConfig,
  loadOptionalFeishuConfig,
  loadTasksSnapshot,
  saveTasksIfRevision,
} from "@weekly-git-report/core";
import {
  ReportCadenceSchema,
  ReportTaskModeSchema,
  ReportTaskSchema,
} from "@weekly-git-report/shared";
import type { ReportTask, TasksDocument } from "@weekly-git-report/shared";
import {
  generateBuiltInRun,
  prepareReportRun,
  registerTaskSchedule,
  resolveCurrentPeriod,
  resolveScheduledTaskPeriod,
  unregisterTaskSchedule,
} from "@weekly-git-report/workflow";

import { printJson } from "../utils/output.js";

export async function runTasksCommand(
  subcommand: string | undefined,
  args: string[],
): Promise<void> {
  switch (subcommand) {
    case "list":
      return list(args);
    case "add":
      return add(args);
    case "edit":
      return edit(args);
    case "remove":
      return remove(args);
    case "enable":
      return setEnabled(args, true);
    case "disable":
      return setEnabled(args, false);
    case "run":
      return run(args, "manual");
    case "execute":
      return run(args, "scheduled");
    case "schedule":
      return schedule(args);
    default:
      throw new Error(`Unknown tasks command: ${subcommand ?? ""}`);
  }
}

async function list(args: string[]): Promise<void> {
  assertNoExtra(args, 0);
  printJson(await loadTasksSnapshot());
}

async function add(args: string[]): Promise<void> {
  const options = parseTaskOptions(args);
  if (!options.cadence) throw new Error("tasks add requires --type.");
  const snapshot = await loadTasksSnapshot();
  const now = new Date().toISOString();
  const task = ReportTaskSchema.parse({
    id: randomUUID(),
    name: options.name ?? defaultName(options.cadence),
    cadence: options.cadence,
    enabled: false,
    mode: options.mode ?? "draft",
    publishToFeishu: options.publishToFeishu ?? false,
    projectIds: options.projectIds,
    ...(options.userContext ? { userContext: options.userContext } : {}),
    schedule: {
      hour: options.hour ?? 18,
      minute: options.minute ?? 0,
      includeWeekends: options.includeWeekends ?? false,
    },
    createdAt: now,
    updatedAt: now,
  });
  const saved = await saveTasksAndSchedules(
    snapshot.document,
    { version: 1, tasks: [...snapshot.document.tasks, task] },
    snapshot.revision,
  );
  printJson({ task, revision: saved.revision });
}

async function edit(args: string[]): Promise<void> {
  const id = requiredId(args);
  const options = parseTaskOptions(args.slice(1));
  const snapshot = await loadTasksSnapshot();
  const current = requireTask(snapshot.document.tasks, id);
  const updated = ReportTaskSchema.parse({
    ...current,
    ...(options.name ? { name: options.name } : {}),
    ...(options.cadence ? { cadence: options.cadence } : {}),
    ...(options.mode ? { mode: options.mode } : {}),
    ...(options.publishToFeishu !== undefined ? { publishToFeishu: options.publishToFeishu } : {}),
    ...(options.projectIds.length ? { projectIds: options.projectIds } : {}),
    ...(options.userContext ? { userContext: options.userContext } : {}),
    schedule: {
      hour: options.hour ?? current.schedule.hour,
      minute: options.minute ?? current.schedule.minute,
      includeWeekends: options.includeWeekends ?? current.schedule.includeWeekends,
    },
    updatedAt: new Date().toISOString(),
  });
  if (updated.enabled) await assertAutomationReady(updated);
  const saved = await saveTasksAndSchedules(
    snapshot.document,
    {
      version: 1,
      tasks: snapshot.document.tasks.map((task) => (task.id === id ? updated : task)),
    },
    snapshot.revision,
  );
  printJson({ task: updated, revision: saved.revision });
}

async function remove(args: string[]): Promise<void> {
  const id = requiredId(args);
  assertNoExtra(args, 1);
  const snapshot = await loadTasksSnapshot();
  requireTask(snapshot.document.tasks, id);
  const saved = await saveTasksAndSchedules(
    snapshot.document,
    { version: 1, tasks: snapshot.document.tasks.filter((task) => task.id !== id) },
    snapshot.revision,
  );
  printJson({ removed: id, revision: saved.revision });
}

async function setEnabled(args: string[], enabled: boolean): Promise<void> {
  const id = requiredId(args);
  assertNoExtra(args, 1);
  const snapshot = await loadTasksSnapshot();
  const current = requireTask(snapshot.document.tasks, id);
  const updated = ReportTaskSchema.parse({
    ...current,
    enabled,
    updatedAt: new Date().toISOString(),
  });
  if (enabled) await assertAutomationReady(updated);
  const saved = await saveTasksAndSchedules(
    snapshot.document,
    {
      version: 1,
      tasks: snapshot.document.tasks.map((task) => (task.id === id ? updated : task)),
    },
    snapshot.revision,
  );
  printJson({ task: updated, revision: saved.revision });
}

async function schedule(args: string[]): Promise<void> {
  const id = requiredId(args);
  assertNoExtra(args, 1);
  const task = requireTask((await loadTasksSnapshot()).document.tasks, id);
  if (!task.enabled) throw new Error("Enable the task before registering its schedule.");
  await assertAutomationReady(task);
  await registerTaskSchedule(task, schedulerCommand(task.id));
  printJson({ scheduled: true, taskId: id });
}

async function run(args: string[], trigger: "manual" | "scheduled"): Promise<void> {
  const id = requiredId(args);
  assertNoExtra(args, 1);
  const task = requireTask((await loadTasksSnapshot()).document.tasks, id);
  if (trigger === "scheduled" && !task.enabled) throw new Error("Scheduled task is disabled.");
  await assertAutomationReady(task);
  const prepared = await prepareReportRun({
    reportType: task.cadence,
    period:
      trigger === "manual"
        ? resolveCurrentPeriod(task.cadence)
        : resolveScheduledTaskPeriod(task.cadence, new Date(), task.schedule.includeWeekends),
    generator: "builtin-ai",
    trigger,
    task,
  });
  const completed = await generateBuiltInRun(prepared.run.id, {
    autoSave: task.mode === "autoPublish",
    publish: task.mode === "autoPublish" && task.publishToFeishu,
  });
  printJson(completed);
}

async function assertAutomationReady(task: ReportTask): Promise<void> {
  const ai = await loadOptionalAiConfig();
  if (!ai?.testedAt) throw new Error("AI configuration must pass a connection test first.");
  if (task.mode === "autoPublish" && task.publishToFeishu) {
    const feishu = await loadOptionalFeishuConfig();
    if (!feishu?.testedAt)
      throw new Error("Feishu configuration must pass a connection test first.");
  }
}

async function saveTasksAndSchedules(
  previous: TasksDocument,
  next: TasksDocument,
  expectedRevision: string | null,
) {
  const saved = await saveTasksIfRevision(next, expectedRevision);
  try {
    await syncTaskSchedules(previous.tasks, next.tasks);
  } catch (error) {
    try {
      await saveTasksIfRevision(previous, saved.revision);
      await syncTaskSchedules(next.tasks, previous.tasks);
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Task scheduling failed and rollback could not fully restore the previous state.",
        { cause: rollbackError },
      );
    }
    throw error;
  }
  return saved;
}

async function syncTaskSchedules(previous: ReportTask[], next: ReportTask[]): Promise<void> {
  const nextIds = new Set(next.map((task) => task.id));
  for (const task of previous) {
    if (!nextIds.has(task.id) || !next.find((candidate) => candidate.id === task.id)?.enabled) {
      await unregisterTaskSchedule(task.id);
    }
  }
  for (const task of next.filter((candidate) => candidate.enabled)) {
    await registerTaskSchedule(task, schedulerCommand(task.id));
  }
}

function parseTaskOptions(args: string[]) {
  const result: {
    cadence?: ReportTask["cadence"];
    mode?: ReportTask["mode"];
    name?: string;
    hour?: number;
    minute?: number;
    publishToFeishu?: boolean;
    includeWeekends?: boolean;
    projectIds: string[];
    userContext?: string;
  } = { projectIds: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    const next = () => {
      const value = args[++index];
      if (!value) throw new Error(`Missing value for ${arg}`);
      return value;
    };
    if (arg === "--type") result.cadence = ReportCadenceSchema.parse(next());
    else if (arg === "--mode") result.mode = ReportTaskModeSchema.parse(next());
    else if (arg === "--name") result.name = next();
    else if (arg === "--hour") result.hour = Number(next());
    else if (arg === "--minute") result.minute = Number(next());
    else if (arg === "--project") result.projectIds.push(next());
    else if (arg === "--context") result.userContext = next();
    else if (arg === "--publish") result.publishToFeishu = true;
    else if (arg === "--no-publish") result.publishToFeishu = false;
    else if (arg === "--include-weekends") result.includeWeekends = true;
    else if (arg === "--exclude-weekends") result.includeWeekends = false;
    else throw new Error(`Unknown task option: ${arg}`);
  }
  return result;
}

function schedulerCommand(taskId: string) {
  const cliEntry = process.argv[1];
  if (!cliEntry) throw new Error("Cannot resolve the weekly CLI entry point.");
  return {
    executable: process.execPath,
    args: [path.resolve(cliEntry), "tasks", "execute", taskId],
  };
}

function requiredId(args: string[]): string {
  const id = args[0];
  if (!id || id.startsWith("-")) throw new Error("Task id is required.");
  return id;
}

function requireTask(tasks: ReportTask[], id: string): ReportTask {
  const task = tasks.find((item) => item.id === id);
  if (!task) throw new Error(`Task not found: ${id}`);
  return task;
}

function defaultName(cadence: ReportTask["cadence"]): string {
  return cadence === "daily" ? "日报任务" : cadence === "weekly" ? "周报任务" : "月报任务";
}

function assertNoExtra(args: string[], expected: number): void {
  if (args.length > expected) throw new Error(`Unexpected argument: ${args[expected]}`);
}
