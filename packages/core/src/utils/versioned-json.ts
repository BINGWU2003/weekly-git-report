import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { sha256 } from "./hash.js";

export interface VersionedText {
  content: string;
  revision: string;
}

export interface AtomicWriteOptions {
  prepareTemporaryFile?(temporaryFile: string): Promise<void>;
}

export class FileRevisionConflictError extends Error {
  constructor(file: string) {
    super(`File changed since it was loaded: ${file}`);
    this.name = "FileRevisionConflictError";
  }
}

export async function readVersionedText(file: string): Promise<VersionedText> {
  const content = await readFile(file, "utf8");
  return { content, revision: sha256(content) };
}

export async function getFileRevision(file: string): Promise<string | null> {
  try {
    return (await readVersionedText(file)).revision;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return null;
    throw error;
  }
}

export async function assertFileRevision(
  file: string,
  expectedRevision: string | null,
): Promise<void> {
  if ((await getFileRevision(file)) !== expectedRevision) {
    throw new FileRevisionConflictError(file);
  }
}

export async function writeJsonAtomic(
  file: string,
  value: unknown,
  options?: AtomicWriteOptions,
): Promise<void> {
  await writeTextAtomic(file, `${JSON.stringify(value, null, 2)}\n`, options);
}

export async function writeTextAtomic(
  file: string,
  content: string,
  options?: AtomicWriteOptions,
): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporaryFile = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporaryFile, content, "utf8");
    await options?.prepareTemporaryFile?.(temporaryFile);
    await rename(temporaryFile, file);
  } catch (error) {
    await rm(temporaryFile, { force: true });
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
