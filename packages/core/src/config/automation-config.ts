import { chmod } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { AiConfigSchema, FeishuConfigSchema, TasksDocumentSchema } from "@weekly-git-report/shared";
import type { AiConfig, FeishuConfig, TasksDocument } from "@weekly-git-report/shared";

import { getAiConfigFilePath, getFeishuConfigFilePath, getTasksFilePath } from "../utils/path.js";
import {
  assertFileRevision,
  getFileRevision,
  readVersionedText,
  writeJsonAtomic,
} from "../utils/versioned-json.js";

const execFileAsync = promisify(execFile);

export interface SecretConfigStatus {
  configured: boolean;
  testedAt?: string;
}

export interface TasksSnapshot {
  document: TasksDocument;
  revision: string | null;
}

export async function loadAiConfig(): Promise<AiConfig> {
  const value = await readJson(getAiConfigFilePath());
  if (isLegacyAiConfig(value)) {
    throw new Error("AI configuration is outdated. Configure the AI service again.");
  }
  return AiConfigSchema.parse(value);
}

export async function loadOptionalAiConfig(): Promise<AiConfig | null> {
  const file = getAiConfigFilePath();
  if ((await getFileRevision(file)) === null) return null;
  const value = await readJson(file);
  return isLegacyAiConfig(value) ? null : AiConfigSchema.parse(value);
}

export async function saveAiConfig(config: AiConfig): Promise<void> {
  await writeSecretJson(getAiConfigFilePath(), AiConfigSchema.parse(config));
}

export async function clearAiConfig(): Promise<void> {
  await writeSecretJson(getAiConfigFilePath(), null);
}

export async function loadFeishuConfig(): Promise<FeishuConfig> {
  return readValidatedJson(getFeishuConfigFilePath(), FeishuConfigSchema);
}

export async function loadOptionalFeishuConfig(): Promise<FeishuConfig | null> {
  return readOptionalValidatedJson(getFeishuConfigFilePath(), FeishuConfigSchema);
}

export async function saveFeishuConfig(config: FeishuConfig): Promise<void> {
  await writeSecretJson(getFeishuConfigFilePath(), FeishuConfigSchema.parse(config));
}

export async function clearFeishuConfig(): Promise<void> {
  await writeSecretJson(getFeishuConfigFilePath(), null);
}

export async function loadTasksSnapshot(): Promise<TasksSnapshot> {
  const file = getTasksFilePath();
  try {
    const document = await readVersionedText(file);
    return {
      document: validateTasks(JSON.parse(document.content)),
      revision: document.revision,
    };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return { document: { version: 1, tasks: [] }, revision: null };
    }
    throw error;
  }
}

export async function saveTasksIfRevision(
  value: TasksDocument,
  expectedRevision: string | null,
): Promise<TasksSnapshot> {
  const file = getTasksFilePath();
  const document = validateTasks(value);
  await assertFileRevision(file, expectedRevision);
  await writeJsonAtomic(file, document);
  return loadTasksSnapshot();
}

async function writeSecretJson(file: string, value: unknown): Promise<void> {
  if (value === null) {
    const { rm } = await import("node:fs/promises");
    await rm(file, { force: true });
    return;
  }
  await writeJsonAtomic(file, value, { prepareTemporaryFile: protectSecretFile });
}

async function protectSecretFile(file: string): Promise<void> {
  if (process.platform !== "win32") {
    await chmod(file, 0o600);
    return;
  }
  const { stdout } = await execFileAsync("whoami.exe", ["/user", "/fo", "csv", "/nh"], {
    windowsHide: true,
    encoding: "utf8",
  });
  const sid = /"(S-\d+(?:-\d+)+)"\s*$/.exec(stdout.trim())?.[1];
  if (!sid) throw new Error("Cannot determine the current Windows user SID.");
  await execFileAsync("icacls.exe", [file, "/inheritance:r", "/grant:r", `*${sid}:(F)`], {
    windowsHide: true,
  });
}

async function readValidatedJson<T>(
  file: string,
  schema: { parse(value: unknown): T },
): Promise<T> {
  const document = await readVersionedText(file);
  return schema.parse(JSON.parse(document.content));
}

async function readJson(file: string): Promise<unknown> {
  const document = await readVersionedText(file);
  return JSON.parse(document.content);
}

async function readOptionalValidatedJson<T>(
  file: string,
  schema: { parse(value: unknown): T },
): Promise<T | null> {
  if ((await getFileRevision(file)) === null) return null;
  return readValidatedJson(file, schema);
}

function validateTasks(value: unknown): TasksDocument {
  const document = TasksDocumentSchema.parse(value);
  const ids = new Set<string>();
  const enabledCadences = new Set<string>();
  for (const task of document.tasks) {
    if (ids.has(task.id)) throw new Error(`Duplicate task id: ${task.id}`);
    ids.add(task.id);
    if (task.enabled) {
      if (enabledCadences.has(task.cadence)) {
        throw new Error(`Only one enabled ${task.cadence} task is allowed.`);
      }
      enabledCadences.add(task.cadence);
    }
  }
  return document;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isLegacyAiConfig(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && "version" in value && value.version === 1);
}
