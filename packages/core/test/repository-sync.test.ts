import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test } from "vitest";

import type { RepositoryProject } from "@weekly-git-report/shared";
import { ConfigSchema, ProjectsIndexSchema } from "@weekly-git-report/shared";

import { collectCommits, runGit, syncRepository, toRuntimeProject } from "../src/index.js";

test("syncRepository fetches new remote commits and collect uses configured branch", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "weekly-git-report-"));
  try {
    const origin = path.join(root, "origin.git");
    const worktree = path.join(root, "worktree");
    const cache = path.join(root, "cache.git");
    await runGit(["init", "--bare", origin], root);
    await runGit(["init", "--initial-branch=main", worktree], root);
    await runGit(["config", "user.name", "Alice"], worktree);
    await runGit(["config", "user.email", "alice@example.com"], worktree);
    await writeFile(path.join(worktree, "one.txt"), "one\n", "utf8");
    await runGit(["add", "."], worktree);
    await runGit(["commit", "-m", "first"], worktree);
    await runGit(["remote", "add", "origin", origin], worktree);
    await runGit(["push", "-u", "origin", "main"], worktree);

    const repository: RepositoryProject = {
      id: "local/test",
      name: "test",
      url: origin,
      branch: "main",
      localPath: cache,
      enabled: true,
    };
    await syncRepository(repository);
    expect(await runGit(["rev-list", "--count", "refs/remotes/origin/main"], cache)).toBe("1");

    await writeFile(path.join(worktree, "two.txt"), "two\n", "utf8");
    await runGit(["add", "."], worktree);
    await runGit(["commit", "-m", "second"], worktree);
    await runGit(["push"], worktree);

    await runGit(["config", "user.name", "Bob"], worktree);
    await runGit(["config", "user.email", "bob@example.com"], worktree);
    await writeFile(path.join(worktree, "three.txt"), "three\n", "utf8");
    await runGit(["add", "."], worktree);
    await runGit(["commit", "-m", "third by Bob"], worktree);
    await runGit(["push"], worktree);
    await syncRepository(repository);
    expect(await runGit(["rev-list", "--count", "refs/remotes/origin/main"], cache)).toBe("3");

    const result = await collectCommits({
      projects: [toRuntimeProject(repository)],
      period: { start: "2000-01-01", end: "2099-12-31" },
      identities: [{ name: "Alice", email: "alice@example.com" }],
    });
    expect(result.projects[0]?.commits.map((commit) => commit.subject)).toEqual([
      "second",
      "first",
    ]);
    expect(result.projects[0]?.commits[0]?.authorEmail).toBe("alice@example.com");

    await expect(
      syncRepository({ ...repository, url: path.join(root, "different.git") }),
    ).rejects.toThrow(/Origin remote does not match/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("configuration schemas accept only the current explicit repository format", () => {
  expect(
    ConfigSchema.safeParse({
      outputRoot: "C:/reports",
      repositoryCacheRoot: "C:/cache",
      defaultSince: "last monday",
      defaultUntil: "now",
      includeEmptyProjects: false,
      identities: [{ name: "Alice", email: "alice@example.com" }],
      roots: ["C:/work"],
    }).success,
  ).toBe(false);
  expect(
    ProjectsIndexSchema.safeParse({
      projects: [
        {
          id: "example.com/team/app",
          name: "app",
          url: "https://example.com/team/app.git",
          branch: "main",
          localPath: "C:/cache/app",
          enabled: true,
        },
      ],
    }).success,
  ).toBe(true);
});

test("project report file names differ for same-name repositories", () => {
  const base = {
    id: "one",
    name: "web",
    branch: "main",
    localPath: "C:/cache/web",
    enabled: true,
  };
  const first = toRuntimeProject({
    ...base,
    url: "https://example.com/a/web.git",
  });
  const second = toRuntimeProject({
    ...base,
    id: "two",
    url: "https://example.com/b/web.git",
  });
  expect(first.fileName).not.toBe(second.fileName);
});
