import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Config, Project, RepositoryProject } from "@weekly-git-report/shared";

import { sha256 } from "../utils/hash.js";
import { normalizeAbsolutePath } from "../utils/path.js";

export function assertSafeRepositoryUrl(repositoryUrl: string): void {
  const value = repositoryUrl.trim();
  if (!value) {
    throw new Error("Repository URL is required.");
  }

  try {
    const url = new URL(value);
    if (url.password) {
      throw new Error("Repository URL must not contain a password or token.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("must not contain")) {
      throw error;
    }

    if (!/^git@[^:]+:.+/.test(value) && !isLocalRepositoryUrl(value)) {
      throw new Error(`Invalid repository URL: ${value}`, { cause: error });
    }
  }
}

export function normalizeRepositoryUrl(repositoryUrl: string): string {
  assertSafeRepositoryUrl(repositoryUrl);
  const value = repositoryUrl.trim().replace(/\\/g, "/");
  if (isLocalRepositoryUrl(value)) {
    return stripGitSuffix(normalizeAbsolutePath(value).replace(/\\/g, "/"));
  }
  const sshMatch = /^git@([^:]+):(.+)$/.exec(value);
  if (sshMatch) {
    return `${sshMatch[1]?.toLowerCase()}/${stripGitSuffix(sshMatch[2] ?? "")}`;
  }

  try {
    const url = new URL(value);
    if (url.protocol === "file:") {
      return stripGitSuffix(fileURLToPath(url).replace(/\\/g, "/"));
    }
    return stripGitSuffix(`${url.host.toLowerCase()}${url.pathname}`);
  } catch {
    return stripGitSuffix(normalizeAbsolutePath(value));
  }
}

export function getRepositoryId(repositoryUrl: string): string {
  return normalizeRepositoryUrl(repositoryUrl);
}

export function getRepositoryName(repositoryUrl: string): string {
  const normalized = normalizeRepositoryUrl(repositoryUrl);
  return normalized.split("/").filter(Boolean).at(-1) || "repository";
}

export function getDefaultRepositoryPath(
  config: Config,
  repositoryUrl: string,
  name = getRepositoryName(repositoryUrl),
): string {
  const suffix = getRepositoryUrlHash(repositoryUrl);
  return normalizeAbsolutePath(
    path.join(config.repositoryCacheRoot, `${sanitizeFileBaseName(name)}-${suffix}`),
  );
}

export function toRuntimeProject(project: RepositoryProject): Project {
  return {
    ...project,
    localPath: normalizeAbsolutePath(project.localPath),
    fileName: `${sanitizeFileBaseName(project.name)}-${getRepositoryUrlHash(project.url)}.md`,
    path: normalizeAbsolutePath(project.localPath),
    remote: project.url,
  };
}

export function getRepositoryUrlHash(repositoryUrl: string): string {
  return sha256(normalizeRepositoryUrl(repositoryUrl)).slice("sha256:".length, 15);
}

function stripGitSuffix(value: string): string {
  return value
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "");
}

function sanitizeFileBaseName(value: string): string {
  const sanitized = [...value.trim()]
    .map((char) => ('<>:"/\\|?*'.includes(char) || char.charCodeAt(0) < 32 ? "-" : char))
    .join("");
  return sanitized || "repository";
}

function isLocalRepositoryUrl(value: string): boolean {
  return /^(?:[a-zA-Z]:[\\/]|\.{0,2}[\\/]|[\\/])/.test(value);
}
