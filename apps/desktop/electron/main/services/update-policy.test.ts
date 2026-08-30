import { describe, expect, it } from "vitest";
import type { ReportRun } from "@weekly-git-report/shared";

import {
  getUpdateInstallBlockReason,
  isDesktopUpdaterSupported,
  shouldInstallDesktopUpdateOnQuit,
} from "./update-policy.js";

describe("desktop update policy", () => {
  it("只在 Windows 正式安装包中启用更新", () => {
    expect(isDesktopUpdaterSupported({ isPackaged: true, platform: "win32" })).toBe(true);
    expect(isDesktopUpdaterSupported({ isPackaged: false, platform: "win32" })).toBe(false);
    expect(isDesktopUpdaterSupported({ isPackaged: true, platform: "darwin" })).toBe(false);
  });

  it.each(["queued", "collecting", "generating", "saving", "publishing"] as const)(
    "在 %s 报告运行期间阻止安装",
    (status) => {
      expect(getUpdateInstallBlockReason([run(status)])).toContain("报告正在生成");
    },
  );

  it("允许在待审核或已结束状态安装", () => {
    expect(getUpdateInstallBlockReason([run("awaiting_review"), run("succeeded")])).toBeUndefined();
  });

  it("只在更新已下载且没有活动报告时执行退出后安装", () => {
    expect(
      shouldInstallDesktopUpdateOnQuit({
        phase: "downloaded",
        hasActiveRuns: false,
        installRequested: false,
      }),
    ).toBe(true);
    expect(
      shouldInstallDesktopUpdateOnQuit({
        phase: "available",
        hasActiveRuns: false,
        installRequested: false,
      }),
    ).toBe(false);
    expect(
      shouldInstallDesktopUpdateOnQuit({
        phase: "downloaded",
        hasActiveRuns: true,
        installRequested: false,
      }),
    ).toBe(false);
    expect(
      shouldInstallDesktopUpdateOnQuit({
        phase: "downloaded",
        hasActiveRuns: false,
        installRequested: true,
      }),
    ).toBe(false);
  });
});

function run(status: ReportRun["status"]): ReportRun {
  return { status } as ReportRun;
}
