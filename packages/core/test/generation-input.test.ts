import { describe, expect, test } from "vitest";

import { createGenerationInput } from "../src/index.js";

describe("generation input", () => {
  test("keeps report facts while excluding credentials and repository locations", () => {
    const input = createGenerationInput({
      runId: "run-1",
      reportId: "report-1",
      reportType: "weekly",
      period: { start: "2026-08-17", end: "2026-08-23" },
      templateRevision: "sha256:template",
      rawManifestHash: `sha256:${"1".repeat(64)}`,
      createdAt: "2026-08-24T00:00:00.000Z",
      collectResult: {
        errors: [],
        projects: [
          {
            project: {
              id: "project-1",
              name: "Project One",
              branch: "main",
              url: "https://token@example.com/private.git",
              localPath: "D:/secret/worktree",
              path: "D:/secret/cache",
              remote: "https://token@example.com/private.git",
              fileName: "project.md",
              enabled: true,
            },
            commits: [
              {
                hash: "0123456789abcdef",
                committedAt: "2026-08-20T10:00:00+08:00",
                subject: "feat: add report runs",
                body: "Record provenance.",
                author: "Alice",
                authorEmail: "alice@example.com",
              },
            ],
          },
        ],
      },
    });

    expect(input.repositories[0]).toMatchObject({
      id: "project-1",
      name: "Project One",
      branch: "main",
      commits: [{ authorName: "Alice", body: "Record provenance." }],
    });
    const serialized = JSON.stringify(input);
    expect(serialized).not.toContain("alice@example.com");
    expect(serialized).not.toContain("D:/secret");
    expect(serialized).not.toContain("token@example.com");
  });
});
