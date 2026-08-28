import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test } from "vitest";

import type { RepositoryProject } from "@weekly-git-report/shared";

import {
  getRepositoryRuntimeState,
  importRepositoryProjects,
  loadProjectsIndex,
  loadProjectsIndexSnapshot,
  runGit,
  scanRepositoryFolder,
  syncRepository,
  writeProjectsIndex,
} from "../src/index.js";

test("scanRepositoryFolder discovers nested normal and bare repositories safely", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "weekly-folder-scan-"));
  try {
    const normal = path.join(root, "group", "normal");
    const bare = path.join(root, "bare.git");
    const withoutOrigin = path.join(root, "without-origin");
    const ignored = path.join(root, "node_modules", "ignored");
    await mkdir(path.dirname(normal), { recursive: true });
    await mkdir(path.dirname(ignored), { recursive: true });
    await runGit(["init", normal], root);
    await runGit(["remote", "add", "origin", "https://example.com/team/normal.git"], normal);
    await runGit(["init", "--bare", bare], root);
    await runGit(["remote", "add", "origin", "git@example.com:team/bare.git"], bare);
    await runGit(["init", withoutOrigin], root);
    await runGit(["init", ignored], root);

    const result = await scanRepositoryFolder(root);
    expect(result.truncated).toBe(false);
    expect(result.repositories.map((item) => path.basename(item.sourcePath))).toEqual([
      "bare.git",
      "normal",
      "without-origin",
    ]);
    expect(result.repositories.find((item) => item.sourcePath === bare)?.isBare).toBe(true);
    expect(result.repositories.find((item) => item.sourcePath === normal)?.originUrl).toBe(
      "https://example.com/team/normal.git",
    );
    expect(result.repositories.find((item) => item.sourcePath === withoutOrigin)?.originUrl).toBe(
      undefined,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("repository runtime reads the configured remote branch tip", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "weekly-runtime-"));
  try {
    const origin = path.join(root, "origin.git");
    const worktree = path.join(root, "worktree");
    const cache = path.join(root, "cache.git");
    await createOriginWithCommit(origin, worktree, "支持中文提交");
    const repository = createProject("runtime", origin, cache);
    await syncRepository(repository);

    const state = await getRepositoryRuntimeState(repository);
    expect(state.status).toBe("ready");
    expect(state.latestCommit).toMatchObject({
      subject: "支持中文提交",
      authorName: "Alice",
      authorEmail: "alice@example.com",
    });
    expect(state.latestCommit?.hash).toMatch(/^[0-9a-f]{40}$/);
    expect(state.latestCommit?.committedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await expect(
      getRepositoryRuntimeState({ ...repository, branch: "missing" }),
    ).resolves.toMatchObject({ status: "missing-branch", latestCommit: null });
    await expect(
      getRepositoryRuntimeState({ ...repository, localPath: path.join(root, "missing-cache") }),
    ).resolves.toMatchObject({ status: "not-synced", latestCommit: null });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("batch import saves successful repositories once and reports failures", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "weekly-batch-import-"));
  const projectsFile = path.join(root, "projects.json");
  try {
    const origin = path.join(root, "origin.git");
    const worktree = path.join(root, "worktree");
    await createOriginWithCommit(origin, worktree, "initial");
    await writeProjectsIndex({ projects: [] }, projectsFile);
    const before = await loadProjectsIndexSnapshot(projectsFile);
    const good = createProject("good", origin, path.join(root, "good-cache.git"));
    const bad = createProject(
      "bad",
      path.join(root, "missing-origin.git"),
      path.join(root, "bad-cache.git"),
    );

    const result = await importRepositoryProjects({
      projects: [good, bad],
      expectedRevision: before.revision,
      projectsFile,
    });
    expect(result.added.map((project) => project.id)).toEqual(["good"]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.projectId).toBe("bad");
    expect((await loadProjectsIndex(projectsFile)).projects).toEqual([good]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function createOriginWithCommit(
  origin: string,
  worktree: string,
  subject: string,
): Promise<void> {
  await runGit(["init", "--bare", origin], path.dirname(origin));
  await runGit(["init", "--initial-branch=main", worktree], path.dirname(worktree));
  await runGit(["config", "user.name", "Alice"], worktree);
  await runGit(["config", "user.email", "alice@example.com"], worktree);
  await writeFile(path.join(worktree, "README.md"), "test\n", "utf8");
  await runGit(["add", "."], worktree);
  await runGit(["commit", "-m", subject], worktree);
  await runGit(["remote", "add", "origin", origin], worktree);
  await runGit(["push", "-u", "origin", "main"], worktree);
}

function createProject(id: string, url: string, localPath: string): RepositoryProject {
  return { id, name: id, url, branch: "main", localPath, enabled: true };
}
