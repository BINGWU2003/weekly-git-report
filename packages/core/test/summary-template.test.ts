import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import {
  DEFAULT_SUMMARY_TEMPLATE,
  FileRevisionConflictError,
  initializeSummaryTemplate,
  readSummaryTemplate,
  resetSummaryTemplate,
  saveSummaryTemplate,
  validateSummaryTemplate,
} from "../src/index.js";

describe("summary template management", () => {
  test("initializes once and renders the supported date variables", async () => {
    await withTemplate(async (templateFile) => {
      const initialized = await initializeSummaryTemplate({ templateFile });
      expect(initialized.created).toBe(true);
      expect(initialized.template.isDefault).toBe(true);
      expect(initialized.template.renderedContent).toBeNull();

      const existing = await readSummaryTemplate({
        templateFile,
        period: { start: "2026-08-18", end: "2026-08-24" },
      });
      expect(existing.created).toBe(false);
      expect(existing.template.renderedContent).toContain("2026-08-18 ~ 2026-08-24");
      expect(existing.template.renderedContent).not.toContain("{{startDate}}");
    });
  });

  test("never overwrites an existing template during initialization", async () => {
    await withTemplate(async (templateFile) => {
      await initializeSummaryTemplate({ templateFile });
      const custom = DEFAULT_SUMMARY_TEMPLATE.replaceAll("本周工作概览", "工作概览");
      await writeFile(templateFile, custom, "utf8");

      const result = await initializeSummaryTemplate({ templateFile });
      expect(result.created).toBe(false);
      expect(result.template.content).toContain("## 工作概览");
      expect(result.template.isDefault).toBe(false);
    });
  });

  test("validates variables and rejects stale saves", async () => {
    await withTemplate(async (templateFile) => {
      const initial = await initializeSummaryTemplate({ templateFile });
      expect(() => validateSummaryTemplate("only {{startDate}}")).toThrow(
        /Missing summary template variables: endDate/,
      );
      expect(() => validateSummaryTemplate("{{startDate}} {{endDate}} {{rawContent}}")).toThrow(
        /Unsupported summary template variables: rawContent/,
      );

      const custom = DEFAULT_SUMMARY_TEMPLATE.replace("主要工作", "工作明细");
      const saved = await saveSummaryTemplate({
        templateFile,
        content: custom,
        expectedRevision: initial.template.revision,
      });
      expect(saved.template.isDefault).toBe(false);

      await writeFile(templateFile, DEFAULT_SUMMARY_TEMPLATE, "utf8");
      await expect(
        saveSummaryTemplate({
          templateFile,
          content: custom,
          expectedRevision: saved.template.revision,
        }),
      ).rejects.toBeInstanceOf(FileRevisionConflictError);
    });
  });

  test("resets safely with a revision or explicitly forces replacement", async () => {
    await withTemplate(async (templateFile) => {
      const initial = await initializeSummaryTemplate({ templateFile });
      const custom = DEFAULT_SUMMARY_TEMPLATE.replace("关键改动", "技术改动");
      const saved = await saveSummaryTemplate({
        templateFile,
        content: custom,
        expectedRevision: initial.template.revision,
      });

      const reset = await resetSummaryTemplate({
        templateFile,
        expectedRevision: saved.template.revision,
      });
      expect(reset.template.isDefault).toBe(true);

      await writeFile(templateFile, custom, "utf8");
      await resetSummaryTemplate({ templateFile, force: true });
      expect(await readFile(templateFile, "utf8")).toBe(DEFAULT_SUMMARY_TEMPLATE);
    });
  });
});

async function withTemplate(run: (templateFile: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "weekly-summary-template-"));
  try {
    await run(path.join(root, "templates", "weekly", "summary.md"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
