import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test } from "vitest";

import type { Config, RepositoryProject } from "@weekly-git-report/shared";

import {
  FileRevisionConflictError,
  loadConfigSnapshot,
  loadProjectsIndex,
  loadProjectsIndexSnapshot,
  removeRepositoryProject,
  runGit,
  setRepositoryEnabled,
  writeConfig,
  writeConfigIfRevision,
  writeProjectsIndex,
  writeTextAtomic,
} from "../src/index.js";

const config: Config = {
  outputRoot: "~/weekly-reports",
  repositoryCacheRoot: "~/.weekly-git-report/repositories",
  includeEmptyProjects: false,
  identities: [{ name: "Alice", email: "alice@example.com" }],
};

test("versioned config writes reject stale editors", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "weekly-config-version-"));
  const configFile = path.join(root, "config.json");
  try {
    await writeConfig(config, configFile);
    const first = await loadConfigSnapshot(configFile);
    await writeConfig({ ...config, includeEmptyProjects: true }, configFile);

    await expect(
      writeConfigIfRevision({ ...config, outputRoot: "C:/reports" }, first.revision, configFile),
    ).rejects.toBeInstanceOf(FileRevisionConflictError);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("versioned project writes reject stale editors", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "weekly-project-version-"));
  const projectsFile = path.join(root, "projects.json");
  const project = createProject(path.join(root, "cache.git"), path.join(root, "origin.git"));
  try {
    await writeProjectsIndex({ projects: [project] }, projectsFile);
    const first = await loadProjectsIndexSnapshot(projectsFile);
    await writeProjectsIndex({ projects: [{ ...project, name: "changed" }] }, projectsFile);

    await expect(
      setRepositoryEnabled(project.id, false, first.revision, projectsFile),
    ).rejects.toBeInstanceOf(FileRevisionConflictError);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("atomic writes preserve the previous file when preparation fails", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "weekly-atomic-write-"));
  const file = path.join(root, "secret.json");
  try {
    await writeTextAtomic(file, "previous");
    await expect(
      writeTextAtomic(file, "replacement", {
        prepareTemporaryFile: async () => {
          throw new Error("permission update failed");
        },
      }),
    ).rejects.toThrow("permission update failed");
    expect(await readFile(file, "utf8")).toBe("previous");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("repository removal can safely delete a matching bare cache", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "weekly-project-remove-"));
  const projectsFile = path.join(root, "projects.json");
  const origin = path.join(root, "origin.git");
  const cache = path.join(root, "repositories", "cache.git");
  const project = createProject(cache, origin);
  try {
    await runGit(["init", "--bare", origin], root);
    await runGit(["init", "--bare", cache], root);
    await runGit(["remote", "add", "origin", origin], cache);
    await writeProjectsIndex({ projects: [project] }, projectsFile);
    const snapshot = await loadProjectsIndexSnapshot(projectsFile);

    await removeRepositoryProject({
      id: project.id,
      deleteCache: true,
      expectedRevision: snapshot.revision,
      config: { ...config, repositoryCacheRoot: path.dirname(cache) },
      projectsFile,
    });

    await expect(stat(cache)).rejects.toMatchObject({ code: "ENOENT" });
    expect((await loadProjectsIndex(projectsFile)).projects).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("repository removal keeps the cache unless deletion is requested", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "weekly-project-keep-"));
  const projectsFile = path.join(root, "projects.json");
  const origin = path.join(root, "origin.git");
  const cache = path.join(root, "repositories", "cache.git");
  const project = createProject(cache, origin);
  try {
    await runGit(["init", "--bare", origin], root);
    await runGit(["init", "--bare", cache], root);
    await runGit(["remote", "add", "origin", origin], cache);
    await writeProjectsIndex({ projects: [project] }, projectsFile);
    const snapshot = await loadProjectsIndexSnapshot(projectsFile);

    await removeRepositoryProject({
      id: project.id,
      deleteCache: false,
      expectedRevision: snapshot.revision,
      config: { ...config, repositoryCacheRoot: path.dirname(cache) },
      projectsFile,
    });

    expect((await stat(cache)).isDirectory()).toBe(true);
    expect((await loadProjectsIndex(projectsFile)).projects).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("repository removal refuses to delete a cache with a different origin", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "weekly-project-origin-"));
  const projectsFile = path.join(root, "projects.json");
  const configuredOrigin = path.join(root, "configured-origin.git");
  const actualOrigin = path.join(root, "actual-origin.git");
  const cache = path.join(root, "repositories", "cache.git");
  const project = createProject(cache, configuredOrigin);
  try {
    await runGit(["init", "--bare", configuredOrigin], root);
    await runGit(["init", "--bare", actualOrigin], root);
    await runGit(["init", "--bare", cache], root);
    await runGit(["remote", "add", "origin", actualOrigin], cache);
    await writeProjectsIndex({ projects: [project] }, projectsFile);
    const snapshot = await loadProjectsIndexSnapshot(projectsFile);

    await expect(
      removeRepositoryProject({
        id: project.id,
        deleteCache: true,
        expectedRevision: snapshot.revision,
        config: { ...config, repositoryCacheRoot: path.dirname(cache) },
        projectsFile,
      }),
    ).rejects.toThrow(/Origin remote does not match/);
    expect((await stat(cache)).isDirectory()).toBe(true);
    expect((await loadProjectsIndex(projectsFile)).projects).toHaveLength(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("repository removal refuses to delete the cache root itself", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "weekly-project-protected-"));
  const projectsFile = path.join(root, "projects.json");
  const cacheRoot = path.join(root, "repositories");
  const origin = path.join(root, "origin.git");
  const project = createProject(cacheRoot, origin);
  try {
    await runGit(["init", "--bare", origin], root);
    await runGit(["init", "--bare", cacheRoot], root);
    await runGit(["remote", "add", "origin", origin], cacheRoot);
    await writeProjectsIndex({ projects: [project] }, projectsFile);
    const snapshot = await loadProjectsIndexSnapshot(projectsFile);

    await expect(
      removeRepositoryProject({
        id: project.id,
        deleteCache: true,
        expectedRevision: snapshot.revision,
        config: { ...config, repositoryCacheRoot: cacheRoot },
        projectsFile,
      }),
    ).rejects.toThrow(/protected path/);
    expect((await loadProjectsIndex(projectsFile)).projects).toHaveLength(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function createProject(localPath: string, url: string): RepositoryProject {
  return {
    id: "local/test",
    name: "test",
    url,
    branch: "main",
    localPath,
    enabled: true,
  };
}
