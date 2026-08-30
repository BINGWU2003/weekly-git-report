import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as Workflow from "@weekly-git-report/workflow";

const workflow = vi.hoisted(() => ({
  completeExternalRun: vi.fn<typeof Workflow.completeExternalRun>(),
  failExternalRun: vi.fn<typeof Workflow.failExternalRun>(),
  getReportRun: vi.fn<typeof Workflow.getReportRun>(),
  prepareReportRun: vi.fn<typeof Workflow.prepareReportRun>(),
  publishReportRun: vi.fn<typeof Workflow.publishReportRun>(),
  resolveCurrentPeriod: vi.fn<typeof Workflow.resolveCurrentPeriod>(),
}));

vi.mock("@weekly-git-report/workflow", () => workflow);

import { completeReport } from "../src/tools/complete-report.js";
import { failReport } from "../src/tools/fail-report.js";
import { prepareReport } from "../src/tools/prepare-report.js";
import { publishReport } from "../src/tools/publish-report.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MCP report tools", () => {
  it("prepares a normalized external-agent run with the current standard period", async () => {
    const period = { start: "2026-08-24", end: "2026-08-30" };
    const prepared = {
      run: { id: "run-1", status: "generating" },
      template: "# 周报",
      generationInput: { version: 2, runId: "run-1" },
      generationInputFile: "ignored.json",
    } as Awaited<ReturnType<typeof Workflow.prepareReportRun>>;
    workflow.resolveCurrentPeriod.mockReturnValue(period);
    workflow.prepareReportRun.mockResolvedValue(prepared);

    await expect(prepareReport({ reportType: "weekly" })).resolves.toEqual({
      runId: "run-1",
      run: prepared.run,
      template: prepared.template,
      generationInput: prepared.generationInput,
    });
    expect(workflow.resolveCurrentPeriod).toHaveBeenCalledWith("weekly");
    expect(workflow.prepareReportRun).toHaveBeenCalledWith({
      reportType: "weekly",
      period,
      generator: "external-agent",
      trigger: "external-agent",
      projectIds: [],
    });
  });

  it("requires an explicit period for custom reports", async () => {
    await expect(prepareReport({ reportType: "custom" })).rejects.toThrow(
      "Custom reports require an explicit period.",
    );
    expect(workflow.prepareReportRun).not.toHaveBeenCalled();
  });

  it("passes the external Markdown through without trimming it", async () => {
    const succeeded = { id: "run-1", status: "succeeded" } as Awaited<
      ReturnType<typeof Workflow.completeExternalRun>
    >;
    workflow.completeExternalRun.mockResolvedValue(succeeded);

    await expect(
      completeReport({
        runId: "run-1",
        content: "  # 报告\\n",
        publish: false,
      }),
    ).resolves.toBe(succeeded);
    expect(workflow.completeExternalRun).toHaveBeenCalledWith("run-1", "  # 报告\\n", {
      publish: false,
      force: false,
    });
  });

  it("returns the saved run when only Feishu publishing failed", async () => {
    const failed = {
      id: "run-1",
      status: "publish_failed",
      summaryPath: "summary/report.md",
      error: { message: "Feishu unavailable" },
    } as ReturnType<typeof Workflow.getReportRun>;
    workflow.completeExternalRun.mockRejectedValue(new Error("Feishu unavailable"));
    workflow.getReportRun.mockReturnValue(failed);

    await expect(
      completeReport({
        runId: "run-1",
        content: "# 报告",
        publish: true,
      }),
    ).resolves.toBe(failed);
  });

  it("fails an unfinished external-agent run", () => {
    const failed = { id: "run-1", status: "failed" } as ReturnType<typeof Workflow.failExternalRun>;
    workflow.failExternalRun.mockReturnValue(failed);

    expect(failReport({ runId: "run-1", message: "Agent failed" })).toBe(failed);
    expect(workflow.failExternalRun).toHaveBeenCalledWith("run-1", "Agent failed");
  });

  it("publishes a saved run and returns a structured publish failure", async () => {
    const failed = { id: "run-1", status: "publish_failed" } as ReturnType<
      typeof Workflow.getReportRun
    >;
    workflow.publishReportRun.mockRejectedValue(new Error("Feishu unavailable"));
    workflow.getReportRun.mockReturnValue(failed);

    await expect(publishReport({ runId: "run-1" })).resolves.toBe(failed);
    expect(workflow.publishReportRun).toHaveBeenCalledWith("run-1");
  });
});
